import { describe, it, expect, beforeEach, vi } from "vitest";
import { readFile } from "node:fs/promises";

vi.mock("node:fs/promises", () => ({ readFile: vi.fn() }));

import {
  parseGitRemoteUrl,
  readGitRemotes,
  parseRemotes,
  selectRemote,
  readTokenFromGitConfig,
  parseGitCredentials,
  defaultCredentialsPaths,
  discoverConfig,
} from "../git-config.js";

function mockFiles(files: Record<string, string>): void {
  vi.mocked(readFile).mockImplementation(async (path) => {
    const p = typeof path === "string" ? path : String(path);
    if (p in files) return files[p];
    const err = new Error(`ENOENT: ${p}`) as NodeJS.ErrnoException;
    err.code = "ENOENT";
    throw err;
  });
}

describe("parseGitRemoteUrl", () => {
  it("parses scp-like SSH with .git suffix", () => {
    expect(parseGitRemoteUrl("git@gitea.example:owner/repo.git", "origin")).toEqual({
      remote: "origin",
      url: "git@gitea.example:owner/repo.git",
      host: "gitea.example",
      baseUrl: "https://gitea.example",
      owner: "owner",
      repo: "repo",
    });
  });

  it("parses scp-like SSH without .git suffix", () => {
    const r = parseGitRemoteUrl("git@gitea.example:owner/repo");
    expect(r).toMatchObject({ host: "gitea.example", owner: "owner", repo: "repo", baseUrl: "https://gitea.example" });
  });

  it("parses ssh:// protocol", () => {
    expect(parseGitRemoteUrl("ssh://git@gitea.example/owner/repo.git", "upstream")).toMatchObject({
      remote: "upstream", host: "gitea.example", baseUrl: "https://gitea.example", owner: "owner", repo: "repo",
    });
  });

  it("parses ssh:// with a port (port dropped from baseUrl)", () => {
    const r = parseGitRemoteUrl("ssh://git@gitea.example:2222/owner/repo.git");
    expect(r).toMatchObject({ host: "gitea.example", baseUrl: "https://gitea.example" });
  });

  it("parses ssh:// without a user", () => {
    const r = parseGitRemoteUrl("ssh://gitea.example/owner/repo.git");
    expect(r).toMatchObject({ host: "gitea.example", owner: "owner", repo: "repo" });
  });

  it("parses HTTPS with .git suffix", () => {
    const r = parseGitRemoteUrl("https://gitea.example/owner/repo.git");
    expect(r).toMatchObject({ host: "gitea.example", baseUrl: "https://gitea.example", owner: "owner", repo: "repo" });
  });

  it("parses HTTPS without .git suffix", () => {
    const r = parseGitRemoteUrl("https://gitea.example/owner/repo");
    expect(r).toMatchObject({ owner: "owner", repo: "repo", baseUrl: "https://gitea.example" });
  });

  it("parses HTTPS with a non-standard port (port kept in baseUrl and host)", () => {
    const r = parseGitRemoteUrl("https://gitea.example:3000/owner/repo.git");
    expect(r).toMatchObject({ host: "gitea.example:3000", baseUrl: "https://gitea.example:3000" });
  });

  it("parses HTTPS with userinfo (userinfo ignored)", () => {
    const r = parseGitRemoteUrl("https://user:pass@gitea.example/owner/repo.git");
    expect(r).toMatchObject({ host: "gitea.example", owner: "owner", repo: "repo" });
  });

  it("parses HTTP", () => {
    const r = parseGitRemoteUrl("http://gitea.example/owner/repo.git");
    expect(r).toMatchObject({ baseUrl: "http://gitea.example", host: "gitea.example" });
  });

  it("defaults the remote name to origin", () => {
    expect(parseGitRemoteUrl("git@gitea.example:owner/repo.git")!.remote).toBe("origin");
  });

  it("returns null for an unparseable url", () => {
    expect(parseGitRemoteUrl("not-a-valid-url")).toBeNull();
  });

  it("returns null when only host is given (no owner/repo)", () => {
    expect(parseGitRemoteUrl("https://gitea.example")).toBeNull();
  });

  it("trims surrounding whitespace before parsing", () => {
    const r = parseGitRemoteUrl("  git@gitea.example:owner/repo.git  ");
    expect(r).toMatchObject({ owner: "owner", repo: "repo" });
  });
});

describe("readGitRemotes", () => {
  it("extracts multiple remotes with their urls", () => {
    const content = [
      '[remote "origin"]',
      "\turl = https://gitea.example/origin/repo.git",
      "\tfetch = +refs/heads/*:refs/remotes/origin/*",
      '[remote "upstream"]',
      "\turl = git@gitea.example:upstream/repo.git",
    ].join("\n");
    expect(readGitRemotes(content)).toEqual([
      { name: "origin", url: "https://gitea.example/origin/repo.git" },
      { name: "upstream", url: "git@gitea.example:upstream/repo.git" },
    ]);
  });

  it("takes the first url of a remote and ignores fetch/other keys", () => {
    const content = '[remote "origin"]\n\turl = https://h/o/r.git\n\turl = https://h/o2/r.git\n';
    expect(readGitRemotes(content)).toEqual([{ name: "origin", url: "https://h/o/r.git" }]);
  });

  it("stops collecting keys when a new non-remote section begins", () => {
    const content = [
      '[remote "origin"]',
      "\turl = https://h/o/r.git",
      '[branch "main"]',
      "\turl = should-not-be-collected",
    ].join("\n");
    expect(readGitRemotes(content)).toEqual([{ name: "origin", url: "https://h/o/r.git" }]);
  });

  it("returns an empty array when there are no remotes", () => {
    expect(readGitRemotes("")).toEqual([]);
    expect(readGitRemotes('[core]\n\trepositoryformatversion = 0\n')).toEqual([]);
  });
});

describe("parseRemotes", () => {
  it("parses valid remotes and drops unparseable ones", () => {
    const content = [
      '[remote "origin"]',
      "\turl = https://gitea.example/owner/repo.git",
      '[remote "broken"]',
      "\turl = not-a-url",
    ].join("\n");
    const r = parseRemotes(content);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ remote: "origin", owner: "owner" });
  });
});

describe("selectRemote", () => {
  const mk = (remote: string, owner = "o") => ({
    remote, owner, url: `https://h/${owner}/r`, host: "h", baseUrl: "https://h", repo: "r",
  });

  it("prefers upstream over origin", () => {
    expect(selectRemote([mk("origin"), mk("upstream")])!.remote).toBe("upstream");
  });

  it("falls back to origin when no upstream", () => {
    expect(selectRemote([mk("origin"), mk("fork")])!.remote).toBe("origin");
  });

  it("falls back to the first remote when neither upstream nor origin", () => {
    expect(selectRemote([mk("fork1"), mk("fork2")])!.remote).toBe("fork1");
  });

  it("returns null for an empty list", () => {
    expect(selectRemote([])).toBeNull();
  });
});

describe("readTokenFromGitConfig", () => {
  it("reads a scoped [gitea \"<baseUrl>\"] token", () => {
    const content = '[gitea "https://gitea.example"]\n\ttoken = abc123\n';
    expect(readTokenFromGitConfig(content, "https://gitea.example")).toBe("abc123");
  });

  it("matches only the requested baseUrl (other scopes ignored)", () => {
    const content = '[gitea "https://other.example"]\n\ttoken = nope\n[gitea "https://gitea.example"]\n\ttoken = yes\n';
    expect(readTokenFromGitConfig(content, "https://gitea.example")).toBe("yes");
  });

  it("falls back to a bare [gitea] token when no scoped match", () => {
    const content = '[gitea]\n\ttoken = globaltok\n';
    expect(readTokenFromGitConfig(content, "https://gitea.example")).toBe("globaltok");
  });

  it("prefers a scoped token over the bare [gitea] fallback", () => {
    const content = '[gitea "https://gitea.example"]\n\ttoken = scoped\n[gitea]\n\ttoken = bare\n';
    expect(readTokenFromGitConfig(content, "https://gitea.example")).toBe("scoped");
  });

  it("returns undefined when no token section matches", () => {
    expect(readTokenFromGitConfig("[core]\n\tx = 1\n", "https://gitea.example")).toBeUndefined();
  });

  it("does not confuse [gitea \"url\"] with a bare [gitea] section", () => {
    const content = '[gitea "https://gitea.example"]\n\ttoken = scoped\n';
    expect(readTokenFromGitConfig(content, "https://other.example")).toBeUndefined();
  });
});

describe("parseGitCredentials", () => {
  it("returns the password for a matching host", () => {
    expect(parseGitCredentials("https://oauth2:secret@gitea.example\n", "gitea.example")).toBe("secret");
  });

  it("returns the username when no password is set", () => {
    expect(parseGitCredentials("https://tokenonly@gitea.example\n", "gitea.example")).toBe("tokenonly");
  });

  it("skips entries for other hosts", () => {
    expect(parseGitCredentials("https://oauth2:x@other.example\nhttps://oauth2:y@gitea.example\n", "gitea.example")).toBe("y");
  });

  it("URL-decodes the token", () => {
    expect(parseGitCredentials("https://oauth2:a%2Bb@gitea.example\n", "gitea.example")).toBe("a+b");
  });

  it("skips blank and comment lines", () => {
    expect(parseGitCredentials("\n# a comment\nhttps://oauth2:z@gitea.example\n", "gitea.example")).toBe("z");
  });

  it("skips malformed lines", () => {
    expect(parseGitCredentials("not-a-url\nhttps://oauth2:z@gitea.example\n", "gitea.example")).toBe("z");
  });

  it("returns undefined when nothing matches", () => {
    expect(parseGitCredentials("https://x@other.example\n", "gitea.example")).toBeUndefined();
  });

  it("matches a host with a port", () => {
    expect(parseGitCredentials("https://oauth2:z@gitea.example:3000\n", "gitea.example:3000")).toBe("z");
  });
});

describe("defaultCredentialsPaths", () => {
  it("includes the XDG path when XDG_CONFIG_HOME is set, before the home path", () => {
    const saved = process.env.XDG_CONFIG_HOME;
    process.env.XDG_CONFIG_HOME = "/tmp/xdg";
    try {
      const paths = defaultCredentialsPaths();
      expect(paths[0]).toBe("/tmp/xdg/git/credentials");
      expect(paths.length).toBe(2);
    } finally {
      if (saved === undefined) delete process.env.XDG_CONFIG_HOME;
      else process.env.XDG_CONFIG_HOME = saved;
    }
  });
});

describe("discoverConfig", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when there is no .git/config and no GITEA_BASE_URL", async () => {
    mockFiles({});
    const cfg = await discoverConfig({ cwd: "/repo", env: {}, credentialsPaths: ["/cred"] });
    expect(cfg).toBeNull();
  });

  it("derives baseUrl/owner/repo from the upstream remote (preferred over origin)", async () => {
    mockFiles({
      "/repo/.git/config": [
        '[remote "origin"]', "\turl = https://gitea.example/origin/repo.git",
        '[remote "upstream"]', "\turl = https://gitea.example/upstream/repo.git",
      ].join("\n"),
    });
    const cfg = await discoverConfig({ cwd: "/repo", env: {}, credentialsPaths: ["/cred"] });
    expect(cfg).toMatchObject({
      baseUrl: "https://gitea.example",
      defaultOwner: "upstream",
      defaultRepo: "repo",
      remote: "upstream",
      source: "git",
    });
  });

  it("falls back to the origin remote when upstream is absent", async () => {
    mockFiles({
      "/repo/.git/config": '[remote "origin"]\n\turl = https://gitea.example/origin/repo.git\n',
    });
    const cfg = await discoverConfig({ cwd: "/repo", env: {}, credentialsPaths: ["/cred"] });
    expect(cfg).toMatchObject({ defaultOwner: "origin", remote: "origin" });
  });

  it("derives an https baseUrl from an SSH remote", async () => {
    mockFiles({
      "/repo/.git/config": '[remote "origin"]\n\turl = git@gitea.example:owner/repo.git\n',
    });
    const cfg = await discoverConfig({ cwd: "/repo", env: {}, credentialsPaths: ["/cred"] });
    expect(cfg).toMatchObject({ baseUrl: "https://gitea.example" });
  });

  it("reads the token from .git/config [gitea \"<baseUrl>\"] first", async () => {
    mockFiles({
      "/repo/.git/config": [
        '[remote "origin"]', "\turl = https://gitea.example/owner/repo.git",
        '[gitea "https://gitea.example"]', "\ttoken = configtok",
      ].join("\n"),
      "/cred": "https://oauth2:credtok@gitea.example\n",
    });
    const cfg = await discoverConfig({ cwd: "/repo", env: { GITEA_TOKEN: "envtok" }, credentialsPaths: ["/cred"] });
    expect(cfg!.token).toBe("configtok");
  });

  it("falls back to the git credential store when .git/config has no token", async () => {
    mockFiles({
      "/repo/.git/config": '[remote "origin"]\n\turl = https://gitea.example/owner/repo.git\n',
      "/cred": "https://oauth2:credtok@gitea.example\n",
    });
    const cfg = await discoverConfig({ cwd: "/repo", env: { GITEA_TOKEN: "envtok" }, credentialsPaths: ["/cred"] });
    expect(cfg!.token).toBe("credtok");
  });

  it("falls back to GITEA_TOKEN when neither .git/config nor credentials resolve", async () => {
    mockFiles({
      "/repo/.git/config": '[remote "origin"]\n\turl = https://gitea.example/owner/repo.git\n',
    });
    const cfg = await discoverConfig({ cwd: "/repo", env: { GITEA_TOKEN: "envtok" }, credentialsPaths: ["/cred"] });
    expect(cfg!.token).toBe("envtok");
  });

  it("leaves token undefined when no source resolves", async () => {
    mockFiles({
      "/repo/.git/config": '[remote "origin"]\n\turl = https://gitea.example/owner/repo.git\n',
    });
    const cfg = await discoverConfig({ cwd: "/repo", env: {}, credentialsPaths: ["/cred"] });
    expect(cfg!.token).toBeUndefined();
  });

  it("lets GITEA_BASE_URL override the derived baseUrl", async () => {
    mockFiles({
      "/repo/.git/config": '[remote "origin"]\n\turl = https://internal.example/owner/repo.git\n',
    });
    const cfg = await discoverConfig({
      cwd: "/repo",
      env: { GITEA_BASE_URL: "https://gitea.override.example" },
      credentialsPaths: ["/cred"],
    });
    expect(cfg).toMatchObject({ baseUrl: "https://gitea.override.example", source: "env" });
    // owner/repo still derived from the selected remote
    expect(cfg).toMatchObject({ defaultOwner: "owner", defaultRepo: "repo" });
  });

  it("uses GITEA_BASE_URL host to look up a credential when no remote is present", async () => {
    mockFiles({
      "/cred": "https://oauth2:credmatch@gitea.example\n",
    });
    const cfg = await discoverConfig({
      cwd: "/repo",
      env: { GITEA_BASE_URL: "https://gitea.example" },
      credentialsPaths: ["/cred"],
    });
    expect(cfg).toMatchObject({ baseUrl: "https://gitea.example", token: "credmatch" });
  });

  it("lets GITEA_DEFAULT_OWNER/REPO override the derived values", async () => {
    mockFiles({
      "/repo/.git/config": '[remote "origin"]\n\turl = https://gitea.example/owner/repo.git\n',
    });
    const cfg = await discoverConfig({
      cwd: "/repo",
      env: { GITEA_DEFAULT_OWNER: "myorg", GITEA_DEFAULT_REPO: "myrepo" },
      credentialsPaths: ["/cred"],
    });
    expect(cfg).toMatchObject({ defaultOwner: "myorg", defaultRepo: "myrepo" });
  });

  it("rethrows non-ENOENT filesystem errors", async () => {
    vi.mocked(readFile).mockImplementation(async () => {
      const err = new Error("EACCES") as NodeJS.ErrnoException;
      err.code = "EACCES";
      throw err;
    });
    await expect(discoverConfig({ cwd: "/repo", env: {}, credentialsPaths: ["/cred"] })).rejects.toThrow("EACCES");
  });
});
