---
name: gitea-configure
description: Invoke to CONFIGURE / SET UP / FIX the Gitea connection — instance URL, token, or owner/repo discovery. Use when a tool fails with 401/403 (bad or missing token), when the user asks how to wire up gitea-mcp, or when baseUrl/owner/repo could not be auto-detected. Do NOT invoke for normal issue/label/milestone work once the connection works.
---

# gitea-configure

Diagnose and fix the Gitea connection. The server auto-discovers its config from the
project's git remotes; this skill is the fallback when that fails or the token is wrong.

## How gitea-mcp discovers config (no env vars required)

On start, the server reads `<cwd>/.git/config` and resolves in this order:

1. **baseUrl** — `GITEA_BASE_URL` env var, else derived from the selected remote's host.
   SSH remotes (`git@host:owner/repo`) resolve to `https://host`.
2. **owner / repo** — `GITEA_DEFAULT_OWNER` / `GITEA_DEFAULT_REPO` env vars, else from the
   selected remote's URL.
3. **Remote selection** — `upstream` remote first, falling back to `origin`, then any
   other remote. Both are surfaced in `resolve_repo` output.

If the working directory has NO git remote and `GITEA_BASE_URL` is unset, the server does
NOT start (it prints a skip reason and exits 0). That is intentional, not a crash.

## Token discovery chain (tried in order)

1. `.git/config` — a `[gitea "<baseUrl>"]` section, e.g.
   ```ini
   [gitea "https://gitea.example.com"]
       token = <your-token>
   ```
   A bare `[gitea]` section with `token = ...` is a host-wide fallback.
2. The git credential store (`~/.git-credentials`, or `$XDG_CONFIG_HOME/git/credentials`)
   — a line whose host matches the instance, e.g.
   `https://oauth2:<token>@gitea.example.com`.
3. `GITEA_TOKEN` env var.
4. If none of the above yield a token, the server starts WITHOUT a token (anonymous). Public
   repos may be read; writes and private repos return 401 — that is the signal to help the
   user add a token via one of the sources above.

## Fix flow — when a tool returns 401 / 403

1. Confirm the instance: run `resolve_repo` (no args) and read its `baseUrl` and `remote`.
   If it throws, the cwd has no usable git remote — tell the user to run gitea-mcp from a
   cloned repo, or set `GITEA_BASE_URL` + `GITEA_TOKEN`.
2. Ask the user to create a token at `<baseUrl>/user/settings/applications` (Gitea → Settings
   → Applications → Access Tokens). Capture the scopes they need: `issue`, `comment`,
   `label`, `milestone` (read+write). NEVER have the user paste a token into chat unless they
   explicitly choose to — prefer having them run a git command themselves.
3. Have the user store it so discovery finds it. Recommend, in priority order:
   - `git config --file=.git/config gitea."<baseUrl>".token "<token>"` (project-scoped), or
   - add to the credential store, or
   - export `GITEA_TOKEN` (and `GITEA_BASE_URL`) in their MCP client config.
   `<baseUrl>` is the EXACT value `resolve_repo` reported (scheme + host, with port if any).
4. The server must be restarted for new config to take effect — discovery runs once at start.

## Never log the token

Tokens are secret. Do not echo, paste into notes, or include in issue/comment bodies. Pass
configuration values to the user as commands to run themselves; never print a token back.
