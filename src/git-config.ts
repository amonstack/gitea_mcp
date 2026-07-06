import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import {
  type CandidateCredential,
  type CredentialDiscoveryResult,
  orderSchemesForCredentialStore,
} from "./credentials.js";

/** A single parsed git remote. `remote` is the remote name (`origin`, `upstream`, ...). */
export interface ParsedRemote {
  remote: string;
  url: string;
  host: string;
  baseUrl: string;
  owner: string;
  repo: string;
}

/** A raw `[remote "<name>"]` url entry extracted from a git config file. */
export interface RawRemote {
  name: string;
  url: string;
}

export interface DiscoverOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  /** Override credential-store paths (defaults to XDG then `~/.git-credentials`). */
  credentialsPaths?: string[];
}

/**
 * A parsed `~/.git-credentials` line. Both `username` and `password` are
 * URL-decoded. Either may be absent:
 * - `https://user:pass@host` → both present
 * - `https://:pass@host` → only password
 * - `https://tok@host` → only username (git stores a token here when the
 *   host accepts one as the "username"; the caller treats it as the secret)
 *
 * `path` is the URL pathname with leading/trailing slashes and any `.git`
 * suffix stripped, used to narrow multiple host matches toward the target repo.
 */
export interface ParsedCredentialEntry {
  username?: string;
  password?: string;
  host: string;
  path: string;
}

/**
 * Parse a git remote URL into host/baseUrl/owner/repo. Accepts `ssh://`, the
 * scp-like `user@host:owner/repo` form, and `http(s)://`. SSH URLs derive an
 * `https://` baseUrl because the Gitea API is served over HTTP(S); a non-standard
 * web port cannot be inferred from an SSH URL — use an HTTPS remote or GITEA_BASE_URL.
 */
export function parseGitRemoteUrl(url: string, remote = "origin"): ParsedRemote | null {
  const u = url.trim();

  let m = u.match(/^ssh:\/\/(?:[^@/\s]+@)?([^:/\s]+)(?::\d+)?\/([^/\s]+)\/([^/\s]+?)(?:\.git)?$/);
  if (m) {
    const [, host, owner, repo] = m;
    return { remote, url: u, host, baseUrl: `https://${host}`, owner, repo };
  }

  m = u.match(/^(https?:)\/\/(?:[^@/\s]+@)?([^:/\s]+)(?::(\d+))?\/([^/\s]+)\/([^/\s]+?)(?:\.git)?$/);
  if (m) {
    const [, scheme, host, port, owner, repo] = m;
    const baseUrl = port ? `${scheme}//${host}:${port}` : `${scheme}//${host}`;
    return { remote, url: u, host: port ? `${host}:${port}` : host, baseUrl, owner, repo };
  }

  m = u.match(/^(?:[^@/\s]+@)?([^@:/\s]+):([^/\s]+)\/([^/\s]+?)(?:\.git)?$/);
  if (m) {
    const [, host, owner, repo] = m;
    return { remote, url: u, host, baseUrl: `https://${host}`, owner, repo };
  }

  return null;
}

/** Extract every `[remote "<name>"]` url entry from a git config file's contents. */
export function readGitRemotes(content: string): RawRemote[] {
  const remotes: RawRemote[] = [];
  let currentName: string | null = null;
  for (const rawLine of content.split(/\r?\n/)) {
    const section = rawLine.match(/^\s*\[remote\s+"([^"]+)"\]/);
    if (section) {
      currentName = section[1];
      continue;
    }
    if (/^\s*\[[^\]]+\]/.test(rawLine)) {
      currentName = null;
      continue;
    }
    if (currentName !== null) {
      const urlMatch = rawLine.match(/^\s*url\s*=\s*(.+?)\s*$/);
      if (urlMatch) {
        remotes.push({ name: currentName, url: urlMatch[1] });
        currentName = null;
      }
    }
  }
  return remotes;
}

/** Parse all remotes in a git config file's contents, dropping unparseable urls. */
export function parseRemotes(content: string): ParsedRemote[] {
  return readGitRemotes(content)
    .map((r) => parseGitRemoteUrl(r.url, r.name))
    .filter((r): r is ParsedRemote => r !== null);
}

/** Pick the remote to derive values from: `upstream` first, then `origin`, then the first. */
export function selectRemote(remotes: ParsedRemote[]): ParsedRemote | null {
  if (remotes.length === 0) return null;
  return (
    remotes.find((r) => r.remote === "upstream") ??
    remotes.find((r) => r.remote === "origin") ??
    remotes[0]
  );
}

/**
 * Read a Gitea token from a git config. A scoped `[gitea "<baseUrl>"] token = ...`
 * section wins; a bare `[gitea] token = ...` is the fallback. Returns undefined
 * when neither matches.
 */
export function readTokenFromGitConfig(content: string, baseUrl: string): string | undefined {
  const escaped = baseUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const scoped = content.match(new RegExp(`\\[gitea\\s+"${escaped}"\\]([\\s\\S]*?)(?=\\n\\s*\\[|$)`));
  if (scoped) {
    const t = scoped[1].match(/^\s*token\s*=\s*(.+?)\s*$/m);
    if (t) return t[1];
  }
  const globalSection = content.match(/(?:^|\n)\[gitea\][\t ]*([\s\S]*?)(?=\n\s*\[|$)/);
  if (globalSection) {
    const t = globalSection[1].match(/^\s*token\s*=\s*(.+?)\s*$/m);
    if (t) return t[1];
  }
  return undefined;
}

/**
 * Parse every credential-store line whose host matches. Each line is a URL of
 * the form `protocol://[user[:pass]]@host[:port][/path]`; malformed and
 * non-matching lines are skipped. Returns entries in file order; callers
 * narrow and re-sort by repo path specificity.
 *
 * The `password` field — when present — holds whatever the user typed into
 * git's password prompt: a real account password, a Personal Access Token,
 * or an OAuth token. Git itself does not distinguish, and neither does this
 * parser; the GiteaClient runtime tries each entry under multiple auth
 * schemes to discover what works.
 */
export function parseGitCredentials(content: string, host: string): ParsedCredentialEntry[] {
  const entries: ParsedCredentialEntry[] = [];
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    try {
      const credUrl = new URL(line);
      if (credUrl.host !== host) continue;
      entries.push({
        username: credUrl.username ? decodeURIComponent(credUrl.username) : undefined,
        password: credUrl.password ? decodeURIComponent(credUrl.password) : undefined,
        host: credUrl.host,
        path: credUrl.pathname.replace(/^\/+|\/+$/g, "").replace(/\.git$/, ""),
      });
    } catch {
      continue;
    }
  }
  return entries;
}

/**
 * Score a credential entry's path specificity against the target repo path
 * (`owner/repo`). Higher = more specific. Used to narrow multiple host
 * matches toward the most relevant entry first.
 *
 * - Path is empty (host-only entry) → 0
 * - Path is a prefix of the repo path → length of the matching path
 * - Path does not match → -1 (deprioritized but still tried as a fallback)
 */
function scoreEntryPath(entryPath: string, repoPath: string): number {
  if (!entryPath) return 0;
  if (!repoPath) return 0;
  if (repoPath === entryPath || repoPath.startsWith(`${entryPath}/`)) {
    return entryPath.length;
  }
  return -1;
}

/** Default credential-store paths: `$XDG_CONFIG_HOME/git/credentials` then `~/.git-credentials`. */
export function defaultCredentialsPaths(): string[] {
  const paths: string[] = [];
  const xdg = process.env.XDG_CONFIG_HOME;
  if (xdg) paths.push(join(xdg, "git", "credentials"));
  paths.push(join(homedir(), ".git-credentials"));
  return paths;
}

async function readOptionalFile(path: string): Promise<string> {
  try {
    return await readFile(path, "utf-8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    return "";
  }
}

/**
 * Build a `CandidateCredential` from a parsed credential-store entry.
 *
 * - `https://:pass@host` or `https://user:pass@host` → secret = pass,
 *   username preserved (basic auth needs it).
 * - `https://tok@host` (username but no password) → secret = tok, no
 *   username: this is git's "store the token as the username" convention.
 *   Try `token` first (most common), fall back to `basic`.
 */
function candidateFromEntry(entry: ParsedCredentialEntry): CandidateCredential | null {
  if (entry.password) {
    return {
      source: "credential-store",
      username: entry.username,
      secret: entry.password,
      schemes: orderSchemesForCredentialStore(entry.username),
      status: "pending",
      nextSchemeIndex: 0,
    };
  }
  if (entry.username) {
    return {
      source: "credential-store",
      secret: entry.username,
      schemes: ["token", "basic"],
      status: "pending",
      nextSchemeIndex: 0,
    };
  }
  return null;
}

/**
 * Discover the Gitea connection config from env + the local git context.
 *
 * baseUrl: `GITEA_BASE_URL` (env) wins; otherwise derived from the selected
 *   remote (`upstream` → `origin` → first). Returns null only when neither is
 *   available — callers should treat that as "do not start the server".
 *
 * candidates (in priority order):
 *   1. `[gitea "<baseUrl>"] token` / bare `[gitea] token` from `.git/config`
 *      (explicit user configuration; `token` scheme only).
 *   2. `GITEA_TOKEN` env var (explicit env; `token` scheme only — preserves
 *      the simple-token semantics).
 *   3. Every host-matching entry in a git credential store, narrowed by repo
 *      path specificity (most specific first). Each entry may be a PAT,
 *      password, or OAuth token; the client tries each under `basic` and/or
 *      `token` schemes per the username heuristic.
 *
 * owner/repo: `GITEA_DEFAULT_OWNER`/`GITEA_DEFAULT_REPO` (env) win; otherwise
 * taken from the selected remote.
 *
 * The result may have an empty `candidates` array (anonymous mode); the server
 * still starts and a Skill guides the user to provide one. Write tools will
 * fail with 401/403 until a working credential is added.
 */
export async function discoverConfig(options: DiscoverOptions = {}): Promise<CredentialDiscoveryResult | null> {
  const cwd = options.cwd ?? process.cwd();
  const env = options.env ?? process.env;
  const envBaseUrl = env.GITEA_BASE_URL;

  const gitConfigContent = await readOptionalFile(join(cwd, ".git", "config"));
  const parsedRemotes = parseRemotes(gitConfigContent);
  const selected = selectRemote(parsedRemotes);

  const baseUrl = envBaseUrl ?? selected?.baseUrl;
  if (!baseUrl) return null;

  let host: string | undefined;
  if (envBaseUrl) {
    try {
      host = new URL(envBaseUrl).host;
    } catch {
      host = undefined;
    }
  } else {
    host = selected?.host;
  }

  const candidates: CandidateCredential[] = [];

  // Source 1: .git/config [gitea "<baseUrl>"] token / bare [gitea] token.
  if (host) {
    const configToken = readTokenFromGitConfig(gitConfigContent, baseUrl);
    if (configToken) {
      candidates.push({
        source: "gitea-config",
        secret: configToken,
        schemes: ["token"],
        status: "pending",
        nextSchemeIndex: 0,
      });
    }
  }

  // Source 2: GITEA_TOKEN env (simple-token semantics — no scheme probing).
  const envToken = env.GITEA_TOKEN;
  if (envToken) {
    candidates.push({
      source: "env",
      secret: envToken,
      schemes: ["token"],
      status: "pending",
      nextSchemeIndex: 0,
    });
  }

  // Source 3..N: credential-store entries, host-matched and path-narrowed.
  if (host) {
    const paths = options.credentialsPaths ?? defaultCredentialsPaths();
    const repoPath = selected ? `${selected.owner}/${selected.repo}` : "";
    const scored: { entry: ParsedCredentialEntry; score: number; order: number }[] = [];
    let order = 0;
    for (const path of paths) {
      const cred = await readOptionalFile(path);
      if (!cred) continue;
      for (const entry of parseGitCredentials(cred, host)) {
        scored.push({ entry, score: scoreEntryPath(entry.path, repoPath), order: order++ });
      }
    }
    // Sort by score desc; stable within same score (preserve file/discovery order).
    scored.sort((a, b) => b.score - a.score || a.order - b.order);
    for (const { entry } of scored) {
      const candidate = candidateFromEntry(entry);
      if (candidate) candidates.push(candidate);
    }
  }

  return {
    baseUrl,
    defaultOwner: env.GITEA_DEFAULT_OWNER ?? selected?.owner,
    defaultRepo: env.GITEA_DEFAULT_REPO ?? selected?.repo,
    remote: selected?.remote,
    candidates,
  };
}
