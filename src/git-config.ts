import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

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

export interface DiscoveredConfig {
  baseUrl: string;
  /** Undefined when no token source resolves — the server still starts and a Skill guides the user. */
  token?: string;
  defaultOwner?: string;
  defaultRepo?: string;
  /** Name of the remote the values were derived from (undefined when derived purely from env). */
  remote?: string;
  source: "env" | "git";
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
 * Find a credential for `host` in a `git-credentials` file. Each line is a URL;
 * the password (preferred) or username is returned as the token. Malformed and
 * non-matching lines are skipped.
 */
export function parseGitCredentials(content: string, host: string): string | undefined {
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    try {
      const credUrl = new URL(line);
      if (credUrl.host !== host) continue;
      const tok = credUrl.password || credUrl.username;
      if (tok) return decodeURIComponent(tok);
    } catch {
      continue;
    }
  }
  return undefined;
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
 * Discover the Gitea connection config from env + the local git context.
 *
 * baseUrl: `GITEA_BASE_URL` (env) wins; otherwise derived from the selected
 *   remote (`upstream` → `origin` → first). Returns null only when neither is
 *   available — callers should treat that as "do not start the server".
 *
 * token: `.git/config` `[gitea "<baseUrl>"] token` → bare `[gitea] token` →
 *   matching entry in a git credential store → `GITEA_TOKEN` (env). May be
 *   undefined when nothing resolves; the server still starts and a Skill
 *   guides the user to provide one.
 *
 * owner/repo: `GITEA_DEFAULT_OWNER`/`GITEA_DEFAULT_REPO` (env) win; otherwise
 *   taken from the selected remote.
 */
export async function discoverConfig(options: DiscoverOptions = {}): Promise<DiscoveredConfig | null> {
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

  let token: string | undefined;
  if (host) {
    token = readTokenFromGitConfig(gitConfigContent, baseUrl);
    if (!token) {
      const paths = options.credentialsPaths ?? defaultCredentialsPaths();
      for (const path of paths) {
        const cred = await readOptionalFile(path);
        if (cred) {
          token = parseGitCredentials(cred, host);
          if (token) break;
        }
      }
    }
  }
  if (!token) token = env.GITEA_TOKEN;

  return {
    baseUrl,
    token,
    defaultOwner: env.GITEA_DEFAULT_OWNER ?? selected?.owner,
    defaultRepo: env.GITEA_DEFAULT_REPO ?? selected?.repo,
    remote: selected?.remote,
    source: envBaseUrl ? "env" : "git",
  };
}
