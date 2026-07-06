/**
 * Credential candidate model and state machine for fault-tolerant Gitea auth.
 *
 * A discovered credential is treated as an opaque candidate: the `secret`
 * field might be a Gitea Personal Access Token, an account login password,
 * or an OAuth token — the type cannot be determined statically from any
 * source (`~/.git-credentials` stores whatever the user typed into git's
 * password prompt, and `[gitea] token` / `GITEA_TOKEN` are by convention but
 * not guarantee a PAT). The runtime therefore tries each candidate under
 * one or more HTTP auth schemes, advancing on 401/403 until something works
 * or every candidate × scheme is exhausted.
 *
 * This module is pure (no I/O, no fetch) so the state machine is unit-tested
 * directly. Mutation is contained to per-candidate state fields; callers
 * never replace the candidates array.
 *
 * SECURITY: `secret` is never logged, never interpolated into error
 * messages, and never surfaced by `summarizeCandidates`. Diagnostic output
 * only ever carries `secretPresent: boolean` and a masked `username`.
 */

/** Where a candidate came from. Determines scheme ordering and priority. */
export type CredentialSource = "gitea-config" | "env" | "credential-store";

/**
 * HTTP auth scheme. Both are sent via the `Authorization` header.
 * - `token` → `Authorization: token <PAT>` (Gitea's PAT/OAuth-token scheme)
 * - `basic` → `Authorization: Basic base64(<username>:<secret>)` (works for
 *   both account passwords and PATs when the username matches the owner)
 */
export type AuthScheme = "token" | "basic";

/**
 * A single candidate credential with its runtime state. The state fields
 * (`status`, `nextSchemeIndex`, `lastTriedScheme`, `lastError`,
 * `activeScheme`) are mutated by the GiteaClient as requests succeed or fail.
 */
export interface CandidateCredential {
  source: CredentialSource;
  /** Username from a credential-store URL. Undefined for config/env sources. */
  username?: string;
  /** The secret value (PAT, password, or OAuth token). Never logged. */
  secret: string;
  /**
   * Ordered list of auth schemes to try for this candidate. The first scheme
   * that succeeds is locked in via `activeScheme` and reused for subsequent
   * requests without re-iterating.
   */
  schemes: AuthScheme[];
  /** Runtime state: pending (untried), active (verified working), exhausted. */
  status: "pending" | "active" | "exhausted";
  /** Index into `schemes` for the next untried scheme. */
  nextSchemeIndex: number;
  /** The scheme that last produced an HTTP error (for diagnostics). */
  lastTriedScheme?: AuthScheme;
  /**
   * The scheme that succeeded and is in active use. Set when status becomes
   * "active"; subsequent requests reuse it without re-iterating.
   */
  activeScheme?: AuthScheme;
  /**
   * Short error reason from the last failed attempt (e.g. "401"). Never
   * contains the secret or the response body.
   */
  lastError?: string;
}

/** Result of credential discovery — feeds straight into GiteaClient. */
export interface CredentialDiscoveryResult {
  baseUrl: string;
  defaultOwner?: string;
  defaultRepo?: string;
  /** Name of the remote the values were derived from. */
  remote?: string;
  /** Candidates in priority order (highest priority first). */
  candidates: CandidateCredential[];
}

/** A picked next attempt — the candidate index plus the scheme to apply. */
export interface Attempt {
  candidateIndex: number;
  scheme: AuthScheme;
}

/**
 * Decide scheme ordering for a credential-store entry based on username
 * heuristic. Config/env candidates always use `["token"]` (per project
 * decision to preserve their "simple token" semantics).
 *
 * - Username `oauth2`, `x-oauth-basic`, or empty → `["token", "basic"]`:
 *   these are git OAuth conventions; basic auth with such a username fails
 *   for real passwords, so try `token` first.
 * - Any other (real-looking) username → `["basic", "token"]`: basic auth
 *   with the correct username works for both PATs and passwords, so it has
 *   the widest coverage and goes first.
 */
export function orderSchemesForCredentialStore(username?: string): AuthScheme[] {
  if (username === undefined) return ["token", "basic"];
  const u = username.toLowerCase();
  if (u === "oauth2" || u === "x-oauth-basic" || u === "") {
    return ["token", "basic"];
  }
  return ["basic", "token"];
}

/**
 * Build the `Authorization` header value for one attempt. Mutates nothing.
 *
 * For `basic`, the username falls back to `oauth2` when absent (a missing
 * username only happens for malformed credential-store entries; Gitea
 * rejects basic auth without a username, so the attempt will fail and the
 * state machine will advance).
 */
export function buildAuthHeader(candidate: CandidateCredential, scheme: AuthScheme): string {
  if (scheme === "basic") {
    const user = candidate.username ?? "oauth2";
    const encoded = Buffer.from(`${user}:${candidate.secret}`).toString("base64");
    return `Basic ${encoded}`;
  }
  return `token ${candidate.secret}`;
}

/**
 * Pick the next (candidate, scheme) to try. Skips exhausted candidates and
 * candidates whose scheme list is fully tried. Does NOT mutate state — the
 * caller records the attempt via `markAttemptFailed` / `markAttemptSucceeded`.
 *
 * Returns null when every candidate × scheme has been tried.
 */
export function pickNextAttempt(candidates: CandidateCredential[]): Attempt | null {
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    if (c.status === "exhausted") continue;
    if (c.status === "active") {
      // An active candidate with a locked scheme should be used directly by
      // the caller; this function is only for re-iteration after failure.
      // If we reach here it means prior candidates were exhausted and we
      // should keep using the active one — surface it.
      return { candidateIndex: i, scheme: c.activeScheme ?? c.schemes[0] };
    }
    if (c.nextSchemeIndex >= c.schemes.length) continue;
    return { candidateIndex: i, scheme: c.schemes[c.nextSchemeIndex] };
  }
  return null;
}

/**
 * Record that an attempt failed with `error` (a short reason like "401").
 * Advances the candidate's scheme index; when no schemes remain, marks the
 * candidate as exhausted.
 */
export function markAttemptFailed(
  candidates: CandidateCredential[],
  candidateIndex: number,
  error: string,
): void {
  const c = candidates[candidateIndex];
  c.lastError = error;
  c.lastTriedScheme = c.schemes[c.nextSchemeIndex];
  c.nextSchemeIndex += 1;
  if (c.nextSchemeIndex >= c.schemes.length || c.status === "active") {
    c.status = "exhausted";
    c.activeScheme = undefined;
  }
}

/**
 * Record that an attempt succeeded. Marks the candidate as active, locks in
 * `activeScheme`, and marks all PRIOR candidates as exhausted (they were
 * tried and failed before this one succeeded).
 */
export function markAttemptSucceeded(
  candidates: CandidateCredential[],
  candidateIndex: number,
  scheme: AuthScheme,
): void {
  for (let i = 0; i < candidateIndex; i++) {
    if (candidates[i].status !== "active") candidates[i].status = "exhausted";
  }
  const c = candidates[candidateIndex];
  c.status = "active";
  c.activeScheme = scheme;
  c.lastError = undefined;
}

/**
 * Mask a username for diagnostic output: first character plus `***`. Returns
 * null when the candidate has no username (config/env sources, or malformed
 * credential-store entries).
 */
export function maskUsername(username?: string): string | null {
  if (!username) return null;
  return `${username.charAt(0)}***`;
}

/**
 * Build a redacted summary of all candidates for the `gitea_status` tool.
 * The `secret` value is never included — only `secretPresent: true`. The
 * caller passes the active candidate index (or null) so the summary can flag
 * which candidate is currently in use.
 */
export interface CandidateSummary {
  source: CredentialSource;
  schemes: AuthScheme[];
  username: string | null;
  secretPresent: boolean;
  status: "pending" | "active" | "exhausted";
  lastTriedScheme: AuthScheme | null;
  activeScheme: AuthScheme | null;
  lastError: string | null;
}

export function summarizeCandidates(
  candidates: CandidateCredential[],
): CandidateSummary[] {
  return candidates.map((c) => ({
    source: c.source,
    schemes: c.schemes,
    username: maskUsername(c.username),
    secretPresent: c.secret.length > 0,
    status: c.status,
    lastTriedScheme: c.lastTriedScheme ?? null,
    activeScheme: c.activeScheme ?? null,
    lastError: c.lastError ?? null,
  }));
}

/** Find the index of the active candidate, or null when none is active. */
export function findActiveCandidateIndex(candidates: CandidateCredential[]): number | null {
  for (let i = 0; i < candidates.length; i++) {
    if (candidates[i].status === "active") return i;
  }
  return null;
}
