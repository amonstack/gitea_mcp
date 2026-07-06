import { describe, it, expect } from "vitest";
import {
  orderSchemesForCredentialStore,
  buildAuthHeader,
  pickNextAttempt,
  markAttemptFailed,
  markAttemptSucceeded,
  maskUsername,
  summarizeCandidates,
  findActiveCandidateIndex,
  type CandidateCredential,
  type AuthScheme,
} from "../credentials.js";

/**
 * Build a fresh pending candidate. Tests must never share candidate objects
 * because the state-machine functions mutate them in place.
 */
function makeCandidate(overrides: Partial<CandidateCredential> = {}): CandidateCredential {
  return {
    source: "credential-store",
    secret: "sekrit",
    schemes: ["token", "basic"],
    status: "pending",
    nextSchemeIndex: 0,
    ...overrides,
  };
}

describe("credentials — orderSchemesForCredentialStore", () => {
  it("returns [basic, token] for a real-looking username", () => {
    expect(orderSchemesForCredentialStore("ake131998")).toEqual(["basic", "token"]);
  });

  it("returns [token, basic] for the oauth2 convention username", () => {
    expect(orderSchemesForCredentialStore("oauth2")).toEqual(["token", "basic"]);
  });

  it("returns [token, basic] for the x-oauth-basic convention username", () => {
    expect(orderSchemesForCredentialStore("x-oauth-basic")).toEqual(["token", "basic"]);
  });

  it("returns [token, basic] for an empty username", () => {
    expect(orderSchemesForCredentialStore("")).toEqual(["token", "basic"]);
  });

  it("returns [token, basic] when username is undefined", () => {
    expect(orderSchemesForCredentialStore(undefined)).toEqual(["token", "basic"]);
  });

  it("is case-insensitive on convention usernames", () => {
    expect(orderSchemesForCredentialStore("OAUTH2")).toEqual(["token", "basic"]);
    expect(orderSchemesForCredentialStore("X-OAuth-Basic")).toEqual(["token", "basic"]);
  });
});

describe("credentials — buildAuthHeader", () => {
  it("builds a token scheme header", () => {
    const c = makeCandidate({ secret: "abc123" });
    expect(buildAuthHeader(c, "token")).toBe("token abc123");
  });

  it("builds a basic scheme header with the candidate username", () => {
    const c = makeCandidate({ username: "alice", secret: "pw" });
    const expected = `Basic ${Buffer.from("alice:pw").toString("base64")}`;
    expect(buildAuthHeader(c, "basic")).toBe(expected);
  });

  it("falls back to oauth2 username for basic when username is absent", () => {
    const c = makeCandidate({ username: undefined, secret: "pw" });
    const expected = `Basic ${Buffer.from("oauth2:pw").toString("base64")}`;
    expect(buildAuthHeader(c, "basic")).toBe(expected);
  });

  it("never mutates the candidate", () => {
    const c = makeCandidate({ username: "bob", secret: "s" });
    const snapshot: CandidateCredential = { ...c };
    buildAuthHeader(c, "basic");
    buildAuthHeader(c, "token");
    expect({ ...c }).toEqual(snapshot);
  });
});

describe("credentials — pickNextAttempt", () => {
  it("picks the first pending candidate's first scheme", () => {
    const candidates = [makeCandidate({ schemes: ["token", "basic"] })];
    expect(pickNextAttempt(candidates)).toEqual({ candidateIndex: 0, scheme: "token" });
  });

  it("skips exhausted candidates", () => {
    const candidates = [
      makeCandidate({ status: "exhausted" }),
      makeCandidate({ schemes: ["basic", "token"] }),
    ];
    expect(pickNextAttempt(candidates)).toEqual({ candidateIndex: 1, scheme: "basic" });
  });

  it("respects nextSchemeIndex within a candidate", () => {
    const candidates = [
      makeCandidate({ schemes: ["token", "basic"], nextSchemeIndex: 1 }),
    ];
    expect(pickNextAttempt(candidates)).toEqual({ candidateIndex: 0, scheme: "basic" });
  });

  it("returns null when all candidates are exhausted", () => {
    const candidates = [
      makeCandidate({ status: "exhausted" }),
      makeCandidate({ status: "exhausted" }),
    ];
    expect(pickNextAttempt(candidates)).toBeNull();
  });

  it("returns null for an empty candidate list", () => {
    expect(pickNextAttempt([])).toBeNull();
  });

  it("surfaces an active candidate with its locked scheme", () => {
    const candidates = [
      makeCandidate({ status: "active", activeScheme: "basic" }),
    ];
    expect(pickNextAttempt(candidates)).toEqual({ candidateIndex: 0, scheme: "basic" });
  });

  it("surfaces an active candidate with its first scheme when activeScheme is unset", () => {
    const candidates = [
      makeCandidate({ status: "active", activeScheme: undefined, schemes: ["token"] }),
    ];
    expect(pickNextAttempt(candidates)).toEqual({ candidateIndex: 0, scheme: "token" });
  });
});

describe("credentials — markAttemptFailed", () => {
  it("records the error and advances the scheme index", () => {
    const candidates = [makeCandidate({ schemes: ["token", "basic"] })];
    markAttemptFailed(candidates, 0, "401");
    expect(candidates[0].lastError).toBe("401");
    expect(candidates[0].lastTriedScheme).toBe("token");
    expect(candidates[0].nextSchemeIndex).toBe(1);
    expect(candidates[0].status).toBe("pending");
  });

  it("marks the candidate exhausted when no schemes remain", () => {
    const candidates = [
      makeCandidate({ schemes: ["token"], nextSchemeIndex: 0 }),
    ];
    markAttemptFailed(candidates, 0, "403");
    expect(candidates[0].status).toBe("exhausted");
    expect(candidates[0].nextSchemeIndex).toBe(1);
    expect(candidates[0].activeScheme).toBeUndefined();
  });

  it("marks the candidate exhausted once schemes run out", () => {
    const candidates = [makeCandidate({ schemes: ["token", "basic"] })];
    markAttemptFailed(candidates, 0, "401");
    expect(candidates[0].status).toBe("pending");
    markAttemptFailed(candidates, 0, "401");
    expect(candidates[0].status).toBe("exhausted");
    // Further failures keep it exhausted (pickNextAttempt skips it regardless
    // of the exact nextSchemeIndex value).
    markAttemptFailed(candidates, 0, "401");
    expect(candidates[0].status).toBe("exhausted");
  });
});

describe("credentials — markAttemptSucceeded", () => {
  it("locks the active scheme on the succeeding candidate", () => {
    const candidates = [makeCandidate({ schemes: ["basic", "token"] })];
    markAttemptSucceeded(candidates, 0, "basic");
    expect(candidates[0].status).toBe("active");
    expect(candidates[0].activeScheme).toBe("basic");
    expect(candidates[0].lastError).toBeUndefined();
  });

  it("marks all prior candidates as exhausted", () => {
    const candidates = [
      makeCandidate({ schemes: ["token"] }),
      makeCandidate({ schemes: ["token"] }),
      makeCandidate({ schemes: ["basic"] }),
    ];
    markAttemptSucceeded(candidates, 2, "basic");
    expect(candidates[0].status).toBe("exhausted");
    expect(candidates[1].status).toBe("exhausted");
    expect(candidates[2].status).toBe("active");
  });

  it("leaves earlier active candidates active (defensive)", () => {
    const candidates = [
      makeCandidate({ status: "active", activeScheme: "token", schemes: ["token"] }),
      makeCandidate({ schemes: ["basic"] }),
    ];
    markAttemptSucceeded(candidates, 1, "basic");
    expect(candidates[0].status).toBe("active");
    expect(candidates[1].status).toBe("active");
  });
});

describe("credentials — findActiveCandidateIndex", () => {
  it("returns null when no candidate is active", () => {
    expect(findActiveCandidateIndex([makeCandidate()])).toBeNull();
  });

  it("returns the index of the active candidate", () => {
    const candidates = [
      makeCandidate({ status: "exhausted" }),
      makeCandidate({ status: "active", activeScheme: "basic" }),
    ];
    expect(findActiveCandidateIndex(candidates)).toBe(1);
  });

  it("returns the first active candidate when multiple are active", () => {
    const candidates = [
      makeCandidate({ status: "active", activeScheme: "token" }),
      makeCandidate({ status: "active", activeScheme: "basic" }),
    ];
    expect(findActiveCandidateIndex(candidates)).toBe(0);
  });

  it("returns null for an empty list", () => {
    expect(findActiveCandidateIndex([])).toBeNull();
  });
});

describe("credentials — maskUsername", () => {
  it("returns the first character plus ***", () => {
    expect(maskUsername("alice")).toBe("a***");
  });

  it("returns null for an undefined username", () => {
    expect(maskUsername(undefined)).toBeNull();
  });

  it("returns null for an empty username", () => {
    expect(maskUsername("")).toBeNull();
  });

  it("handles a single-character username", () => {
    expect(maskUsername("a")).toBe("a***");
  });
});

describe("credentials — summarizeCandidates (redaction)", () => {
  it("never includes the raw secret", () => {
    const candidates = [
      makeCandidate({ secret: "super-secret-value", username: "alice" }),
    ];
    const summary = summarizeCandidates(candidates);
    const serialized = JSON.stringify(summary);
    expect(serialized).not.toContain("super-secret-value");
  });

  it("reports secretPresent=true when a non-empty secret exists", () => {
    const candidates = [makeCandidate({ secret: "x" })];
    expect(summarizeCandidates(candidates)[0].secretPresent).toBe(true);
  });

  it("reports secretPresent=false for an empty secret", () => {
    const candidates = [makeCandidate({ secret: "" })];
    expect(summarizeCandidates(candidates)[0].secretPresent).toBe(false);
  });

  it("masks the username", () => {
    const candidates = [makeCandidate({ username: "ake131998" })];
    expect(summarizeCandidates(candidates)[0].username).toBe("a***");
  });

  it("reports null username when absent", () => {
    const candidates = [makeCandidate({ username: undefined })];
    expect(summarizeCandidates(candidates)[0].username).toBeNull();
  });

  it("carries status, schemes, activeScheme, lastTriedScheme, lastError", () => {
    const candidates = [
      makeCandidate({
        source: "env",
        schemes: ["token"],
        status: "active",
        activeScheme: "token",
        lastTriedScheme: "token",
        lastError: undefined,
      }),
    ];
    const s = summarizeCandidates(candidates)[0];
    expect(s.source).toBe("env");
    expect(s.schemes).toEqual(["token"]);
    expect(s.status).toBe("active");
    expect(s.activeScheme).toBe("token");
    expect(s.lastTriedScheme).toBe("token");
    expect(s.lastError).toBeNull();
  });

  it("returns an empty array for an empty input", () => {
    expect(summarizeCandidates([])).toEqual([]);
  });
});

describe("credentials — iteration sequence (end-to-end)", () => {
  it("walks candidate × scheme in priority order until exhaustion", () => {
    const schemes: AuthScheme[] = [];
    const candidates = [
      makeCandidate({ schemes: ["basic", "token"] }),
      makeCandidate({ schemes: ["token"] }),
    ];
    let attempt = pickNextAttempt(candidates);
    while (attempt) {
      schemes.push(attempt.scheme);
      markAttemptFailed(candidates, attempt.candidateIndex, "401");
      attempt = pickNextAttempt(candidates);
    }
    // Expected order: cand0 basic → cand0 token → cand1 token
    expect(schemes).toEqual(["basic", "token", "token"]);
    expect(candidates.every((c) => c.status === "exhausted")).toBe(true);
  });

  it("stops iterating once a candidate succeeds", () => {
    const candidates = [
      makeCandidate({ schemes: ["token"] }),       // exhausts first
      makeCandidate({ schemes: ["basic", "token"] }), // succeeds on basic
      makeCandidate({ schemes: ["token"] }),       // never reached
    ];
    // Candidate 0: token fails → exhausted.
    const first = pickNextAttempt(candidates)!;
    expect(first).toEqual({ candidateIndex: 0, scheme: "token" });
    markAttemptFailed(candidates, first.candidateIndex, "401");

    // Candidate 1: basic succeeds → active.
    const second = pickNextAttempt(candidates)!;
    expect(second).toEqual({ candidateIndex: 1, scheme: "basic" });
    markAttemptSucceeded(candidates, second.candidateIndex, second.scheme);

    // After success, pickNextAttempt returns the active candidate only.
    expect(pickNextAttempt(candidates)).toEqual({ candidateIndex: 1, scheme: "basic" });
    expect(candidates[0].status).toBe("exhausted");
    expect(candidates[1].status).toBe("active");
    // Candidate 2 was never tried and stays pending.
    expect(candidates[2].status).toBe("pending");
  });
});
