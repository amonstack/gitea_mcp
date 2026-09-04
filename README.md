<p align="center">
  <img alt="gitea-mcp" src="https://raw.githubusercontent.com/amonstack/gitea_mcp/master/docs/assets/gitea-mcp-banner.png" />
  <h3 align="center">gitea-mcp</h3>
  <p align="center">MCP server that exposes Gitea and GitLab repository operations — issues, labels, milestones, comments, pull requests, releases, Actions, and wiki — as tools for AI assistants</p>
</p>

---

[![npm version](https://img.shields.io/npm/v/@amonstack/gitea-mcp?logo=npm)](https://www.npmjs.com/package/@amonstack/gitea-mcp)
[![codecov](https://codecov.io/gh/amonstack/gitea_mcp/branch/master/graph/badge.svg)](https://codecov.io/gh/amonstack/gitea_mcp)
[![license](https://img.shields.io/npm/l/@amonstack/gitea-mcp)](https://github.com/amonstack/gitea_mcp/blob/master/LICENSE)
[![Node](https://img.shields.io/node/v/@amonstack/gitea-mcp?logo=node.js)](https://www.npmjs.com/package/@amonstack/gitea-mcp)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![MCP](https://img.shields.io/badge/MCP-server-6f42c1?logo=modelcontextprotocol&logoColor=white)](https://modelcontextprotocol.io)

**English** | [中文文档](https://github.com/amonstack/gitea_mcp/blob/master/README.zh-CN.md)

`gitea-mcp` is a [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server that exposes Gitea repository operations as tools. Once connected to an MCP client (Claude Desktop, opencode, Cursor, etc.), an AI assistant can list, create, update, and delete issues, labels, milestones, comments, pull requests, releases, Actions runs, and wiki pages on your Gitea instance — all through natural language.

The server communicates over stdio and wraps the [Gitea REST API (`/api/v1`)](https://docs.gitea.com/api/1.22/). **GitLab** (gitlab.com and self-managed) is supported as a second platform — see [GitLab support](#gitlab-support).

## Features

- **GitLab support** — the same tool set against gitlab.com and self-managed GitLab instances (`MCP_PLATFORM=gitlab` or the `GITLAB_*` env contract)
- **Full Gitea project management** — issues, labels, milestones, comments, and topics via natural language
- **Zero-config auto-discovery** — reads `baseUrl`, `owner`, `repo`, and token from the project's git config; one global install serves many repos
- **Multi-source auth with failover** — tries the `GITEA_REPO_URL` userinfo, `[gitea]` config tokens, `GITEA_TOKEN`, then git's own credential machinery (`git credential fill` — store file or OS keychain), advancing automatically on `401`/`403`
- **Action-scoped skills** — ships one skill per workflow (find, create, label, comment, plan milestones, …) for opencode, Claude Code, Cursor, and more
- **Client-agnostic** — works with any stdio-based MCP client; ships guidance prompts and on-demand reference resources too

## Table of Contents

- [Features](#features)
- [Requirements](#requirements)
- [Installation](#installation)
- [Configuration](#configuration)
- [MCP Client Setup](#mcp-client-setup)
- [Available Tools](#available-tools)
- [AI Guidance & Skills](#ai-guidance--skills)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)

## Requirements

- **Node.js ≥ 24** — uses the global `fetch`
- **git ≥ 2.46** on `PATH` — used for credential discovery (`git config get` / `git credential fill`; `git credential fill` also honors every configured credential helper, including OS keychains). When git cannot be used at all, discovery falls back to the env-only sources (`GITEA_REPO_URL` / `GITEA_TOKEN`) / anonymous mode — `gitea_status` reports `gitAvailable: false`. On git < 2.46, the `.git/config [gitea]` token source silently fails (exit codes are indistinguishable); credential helpers and the env sources still work.
- A **Gitea instance** (self-hosted or Gitea Cloud) — or a **GitLab instance** (gitlab.com or self-managed) — reachable over HTTP
- A **Gitea API token** (or a git credential) for anything beyond reading public repositories

## Installation

### From npm (npmjs.com)

```bash
npm install -g @amonstack/gitea-mcp
```

Or run directly without global install:

```bash
npx @amonstack/gitea-mcp
```

### From GitHub Packages

Each release is also published to GitHub Packages. Route the `@amonstack` scope there
once, then install:

```bash
echo "@amonstack:registry=https://npm.pkg.github.com" >> ~/.npmrc
npm install -g @amonstack/gitea-mcp
```

### Build from source

```bash
git clone https://github.com/amonstack/gitea_mcp.git
cd gitea_mcp
npm ci
npm run build
node dist/cli.js
```

## Configuration

All variables are optional — `gitea-mcp` auto-discovers the Gitea instance, repository,
and token from the project's local git config so a single global install can serve many
projects. Set them only to override the discovery or to restrict the tool surface.

| Variable | Required | Description |
|----------|:--------:|-------------|
| `GITEA_BASE_URL` | No | Gitea instance URL (e.g. `https://gitea.example.com`). Auto-detected from the project's git remote when omitted. |
| `GITEA_TOKEN` | No | Gitea API access token. One of several auth candidates; tried after the `GITEA_REPO_URL` userinfo and a `.git/config [gitea]` token, and before git's credential machinery (see [Token discovery](#token-discovery)). |
| `GITEA_REPO_URL` | No | One self-contained credentialed clone URL — `https://<user>:<token>@<host>[:<port>]/<owner>/<repo>.git` — carrying the instance URL, default owner/repo, and an auth candidate in a single variable. Each part sits below its explicit override (`GITEA_BASE_URL`, `GITEA_DEFAULT_OWNER`, `GITEA_DEFAULT_REPO`) and above the git remote; parsed in-memory, works without git, and the embedded secret never appears in any output. |
| `GITEA_DEFAULT_OWNER` | No | Default repository owner — skip passing `owner` on every call |
| `GITEA_DEFAULT_REPO` | No | Default repository name — skip passing `repo` on every call |
| `GITEA_UPLOAD_ROOT` | No | Root directory that attachment uploads (`create_issue_attachment` / `create_issue_comment_attachment`) may read from. Defaults to the server's working directory; the resolved path must stay inside this root. |
| `MCP_PLATFORM` | No | Which platform this server process serves: `gitea` (default) or `gitlab`. Overrides the auto-detection described in [GitLab support](#gitlab-support). |
| `MCP_TOOL_ALLOWLIST` | No | Comma-separated `snake_case` tool names the server may expose (entries are trimmed and matched exactly). Unset or empty keeps every tool available; an entry naming no tool on the active platform aborts startup with a `Fatal error`. |
| `GITLAB_BASE_URL` | No | GitLab instance URL (e.g. `https://gitlab.example.com`). Auto-detected from the project's git remote when omitted; its presence (without a `GITEA_*` connection variable) selects GitLab mode. |
| `GITLAB_TOKEN` | No | GitLab API access token. One of several auth candidates; tried after the `GITLAB_REPO_URL` userinfo and a `.git/config [gitlab]` token, and before git's credential machinery. Always sent as `Authorization: Bearer <token>`. |
| `GITLAB_REPO_URL` | No | GitLab counterpart of `GITEA_REPO_URL` — one credentialed clone URL supplying the instance URL, default owner/project, and a `Bearer` auth candidate. Its presence (without a `GITEA_*` connection variable) selects GitLab mode. |
| `GITLAB_DEFAULT_OWNER` | No | Default project owner (GitLab mode) — skip passing `owner` on every call |
| `GITLAB_DEFAULT_REPO` | No | Default project name (GitLab mode) — skip passing `repo` on every call |

### GitLab support

`gitea-mcp` also runs against **GitLab** (gitlab.com and self-managed). One server
process serves one platform — to use both, register two MCP client entries. The
platform is selected at startup:

1. `MCP_PLATFORM=gitlab` (or `gitea`) wins when set;
2. otherwise GitLab is auto-selected when any of `GITLAB_BASE_URL`, `GITLAB_TOKEN`,
   or `GITLAB_REPO_URL` is set and no `GITEA_*` connection variable is;
3. the default remains `gitea` (existing configurations behave unchanged).

In GitLab mode the same 68 business tool names run against the GitLab REST API v4
(`/api/v4`), plus `configure_gitlab` / `gitlab_status` instead of `configure_gitea` /
`gitea_status`. Discovery mirrors the Gitea contract: a `GITLAB_REPO_URL` repo URL,
a `[gitlab "<baseUrl>"] token` git-config entry, `GITLAB_TOKEN`, and
`git credential fill` — every credential is
sent only as `Authorization: Bearer <token>` (never as a URL query parameter).

Coverage notes — operations without a GitLab counterpart fail with a typed
`GitLabUnsupportedError`, and Premium/Ultimate-gated operations fail with
`GitLabTierError` (never a raw API error):

- **Fully supported**: issues, comments (list/create), labels, milestones, topics,
  merge requests, releases (list/create/by-tag), wiki pages, and pipelines (the
  Actions group: list/get/cancel/rerun).
- **Tier-gated (GitLab Premium/Ultimate)**: the issue dependency/block tools
  (`list_issue_dependencies`, `add/remove_issue_dependency`, `list_issue_blocks`,
  `add/remove_issue_block`, `check_issue_blocked`) — GitLab Free rejects the
  blocking link types.
- **Not available on GitLab**: the issue attachment tools; `update_comment` /
  `delete_comment` (GitLab notes are addressed per-issue); `get_release`,
  `update_release`, `delete_release` (GitLab releases are addressed by
  `tag_name` — use `get_release_by_tag`); `rerun_action_run_failed_jobs`;
  `list_wiki_revisions`; `merge_pull_request` with `rebase` / `rebase-merge`;
  and the `draft`/`prerelease` release flags, `update_repo`'s `website`/`private`,
  wiki `message`, and `search_issues` `labels` parameters.
- **Addressing** follows GitLab conventions: issues and merge requests by
  project-scoped `iid`, milestones and pipelines by numeric ID, releases by
  `tag_name`, wiki pages by slug; responses return GitLab's native JSON
  (`iid`, `web_url`, `references`, …).
- The bundled action skills and the three guide resources teach Gitea specifics
  and are served on the Gitea platform only; GitLab guidance ships via the
  server instructions instead.

### How auto-discovery works

On start, `gitea-mcp` reads `<cwd>/.git/config` and derives:

- **Instance URL** — from the selected remote's host. SSH remotes (`git@host:owner/repo`)
  resolve to `https://host`. Override with `GITEA_BASE_URL`.
- **owner / repo** — from the selected remote's URL. Override with `GITEA_DEFAULT_OWNER` /
  `GITEA_DEFAULT_REPO`, or detect ad hoc with the `resolve_repo` tool.
- **Remote selection** — the `upstream` remote is preferred, falling back to `origin`, then
  any other remote. Both are reported by `resolve_repo` when they differ.

A `GITEA_REPO_URL` value — one credentialed clone URL of the form
`https://<user>:<token>@<host>[:<port>]/<owner>/<repo>.git` — is a self-contained
alternative to the whole chain above: it supplies the instance URL, the default
owner/repo, and an auth candidate at once (parsed in-memory, so it works even when
git is unavailable). Its parts sit below the explicit `GITEA_BASE_URL` /
`GITEA_DEFAULT_OWNER` / `GITEA_DEFAULT_REPO` overrides and above the git remote,
and the raw URL is never echoed: `resolve_repo` strips embedded userinfo from the
remote URLs it reports.

If the current directory has no git remote and neither `GITEA_BASE_URL` nor
`GITEA_REPO_URL` is set, the server
starts in an **unconfigured** state — `tools/list` is fully available, but business tools
return a `NotConfiguredError` on invocation. Use the `configure_gitea` tool to set the
connection at runtime (session-scoped, never persisted), or run from inside a cloned
Gitea repository, or set `GITEA_BASE_URL` / `GITEA_TOKEN` explicitly.

### Token discovery

`gitea-mcp` collects authentication **candidates** from four sources, in this
priority order — and asks git itself for the stored ones, so every credential
helper you have configured works (including OS keychains: `wincred`,
`osxkeychain`, `libsecret`):

1. The `GITEA_REPO_URL` repo URL, when it points at the instance host — its
   embedded `user:secret` userinfo becomes the top-priority candidate, tried
   with the same username heuristic as a git credential (`basic` first for a
   real-looking username, `token` first for `oauth2` / `x-oauth-basic` / a
   token stored in the username position).
2. A `[gitea "<baseUrl>"]` section in `.git/config` (a bare `[gitea]` section is
   a host-wide fallback), read via `git config get --url=<baseUrl> gitea.token`:
   ```ini
   [gitea "https://gitea.example.com"]
       token = <your-token>
   ```
   Always sent as `Authorization: token <token>`.
3. The `GITEA_TOKEN` environment variable — also sent as `Authorization: token`.
   When the `git` binary is not usable at runtime, the env sources above are
   the only remaining candidates.
4. The credential git itself would use for the instance host, retrieved via
   `git credential fill` (config chain + credential helpers — the store file,
   OS keychains, or any helper you configured). With several identities stored
   for the host, git picks the one it would use; `configure_gitea`'s `username`
   narrows the lookup to that identity.

A git credential's `password` field may hold a real PAT, an account password,
or an OAuth token — git stores whatever was typed at the prompt, and the server
cannot tell them apart statically. So the credential is tried under **two
authentication schemes**:

- `Authorization: Basic <base64(user:pass)>` — works for account passwords and
  PATs alike (Gitea checks that the username matches the secret's owner).
- `Authorization: token <secret>` — works only for real PATs.

The order is chosen by a username heuristic: a convention username
(`oauth2`, `x-oauth-basic`, or empty) tries `token` first; a real-looking
username (e.g. `alice`) tries `basic` first.

**Fault tolerance.** On `401`/`403` the server advances to the next
scheme/candidate and retries the same request; once a combination succeeds it is
locked for the rest of the session (no re-probing). Non-auth errors (`404`,
`500`, network) propagate immediately and do **not** trigger a retry.

**Diagnostics.** The `gitea_status` tool (see [Repository Helpers](#repository-helpers))
returns a redacted view of the current state — which candidate is active, which
are exhausted, the last status seen — without ever exposing the secret. Use it
to troubleshoot a `401` instead of guessing.

If no source resolves a credential, the server still starts anonymously. Public
repositories may be read; private repos and write operations return `401` — use
the `gitea-configure` skill to guide setup, or set `GITEA_TOKEN`.

When `GITEA_DEFAULT_OWNER` and `GITEA_DEFAULT_REPO` are set, you can omit the
`owner` and `repo` parameters in tool calls. The `resolve_repo` tool can also
auto-detect them from a local git repository.

## MCP Client Setup

### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "gitea-mcp": {
      "command": "gitea-mcp",
      "env": {
        "GITEA_BASE_URL": "https://gitea.example.com",
        "GITEA_TOKEN": "your-token-here",
        "GITEA_DEFAULT_OWNER": "my-org",
        "GITEA_DEFAULT_REPO": "my-repo"
      }
    }
  }
}
```

If you built from source, use `node /path/to/gitea-mcp/dist/cli.js` instead.

### opencode

Add to your opencode MCP configuration:

```json
{
  "mcpServers": {
    "gitea-mcp": {
      "command": "gitea-mcp",
      "env": {
        "GITEA_BASE_URL": "https://gitea.example.com",
        "GITEA_TOKEN": "your-token-here"
      }
    }
  }
}
```

If you built from source, use `node /path/to/gitea-mcp/dist/cli.js` instead.

opencode and other AI tools can load native **skills** — one per action (find,
create, update, label, comment, summarize, plan milestones, resolve repo) — that
teach the assistant the safest workflow for that action, including pre-use checks
and pitfalls. Install them once with the `init` command, targeting your tool
(`--tool`, default `opencode`):

```bash
gitea-mcp init                      # opencode (global ~/.config/opencode/skills/)
gitea-mcp init --tool claude        # Claude Code (~/.claude/skills/)
gitea-mcp init --tool cursor        # Cursor (~/.cursor/skills/)
gitea-mcp init --project            # this project (./.<tool>/skills/)
gitea-mcp init --dir /exact/path    # custom location
```

Supported `--tool` values: `amazon-q`, `antigravity`, `auggie`, `claude`,
`cline`, `codex`, `codebuddy`, `continue`, `costrict`, `crush`, `cursor`,
`factory`, `gemini`, `github-copilot`, `iflow`, `kimi`, `kilocode`, `opencode`,
`qoder`, `qwen`, `roocode`, `windsurf`. Paths follow each tool's conventional
skills directory; use `--dir` for an exact location. Then restart your tool. See
[AI Guidance & Skills](#ai-guidance--skills) below.

### Other MCP Clients

Any client that supports stdio-based MCP servers can use `gitea-mcp`. After
installation, run it from inside a cloned Gitea repository (config is auto-discovered):

```bash
cd /path/to/your/gitea-repo
gitea-mcp
```

Or set the variables explicitly if you prefer:

```bash
export GITEA_BASE_URL="https://gitea.example.com"
export GITEA_TOKEN="your-access-token"
gitea-mcp
```

## Available Tools

> The tables below describe the tool contract. On the GitLab platform the same
> 68 business tools run against the GitLab REST API v4 (plus `configure_gitlab` /
> `gitlab_status` instead of `configure_gitea` / `gitea_status`) — per-tool
> coverage differences are documented in [GitLab support](#gitlab-support).

### Issues

| Tool | Description |
|------|-------------|
| `list_issues` | List issues (filter by `state`, `labels`, page/limit) |
| `get_issue` | Get a single issue by `index` (issue number) |
| `create_issue` | Create an issue with `title`, `body`, `assignee`, `labels`, `milestone` |
| `update_issue` | Update issue fields or `state` |
| `delete_issue` | Delete an issue by `index` |
| `search_issues` | Search across repositories by `query`, `type`, `state`, `labels` |

### Issue Dependencies

| Tool | Description |
|------|-------------|
| `list_issue_dependencies` | List the issues that BLOCK an issue (`blocked by`), with page/limit |
| `add_issue_dependency` | Make an issue depend on (be blocked by) another issue — `dep_index` is the blocker |
| `remove_issue_dependency` | Remove a dependency so an issue is no longer blocked by `dep_index` |
| `list_issue_blocks` | List the issues that are BLOCKED BY an issue (`blocking`), with page/limit |
| `add_issue_block` | Make an issue block another issue — `index` is the blocker, `dep_index` is blocked |
| `remove_issue_block` | Remove a block so `dep_index` is no longer blocked by `index` |
| `check_issue_blocked` | Check whether an issue is blocked by open dependencies — returns `blocked`, `blockers`, `total_dependencies`, `open_blockers` in one call (aggregates `list_issue_dependencies` internally) |

> **Note:** dependency tools require the repo to enable `enable_issue_dependencies`
> (a 404 means it is off). `dep_owner` / `dep_repo` default to the same repo as the
> issue but may point at another repo (the instance must enable
> `AllowCrossRepositoryDependencies`). Mutations return the path issue as JSON.

### Comments

| Tool | Description |
|------|-------------|
| `list_comments` | List comments on an issue |
| `create_comment` | Add a comment to an issue |
| `update_comment` | Update a comment by `id` |
| `delete_comment` | Delete a comment by `id` |

### Issue Attachments

| Tool | Description |
|------|-------------|
| `create_issue_attachment` | Upload a local file (`file_path`) as an attachment on an issue (`index`), optional `name`. The path is confined to the upload root (cwd or `GITEA_UPLOAD_ROOT`), extension-allow-listed, and size-capped |
| `list_issue_attachments` | List the attachments on an issue |
| `get_issue_attachment` | Get one attachment's metadata by `attachment_id` |
| `edit_issue_attachment` | Rename an attachment by `attachment_id` |
| `delete_issue_attachment` | Delete an attachment by `attachment_id` |
| `create_issue_comment_attachment` | Upload a local file as an attachment on a comment (`comment_id`), optional `name`; same path confinement as `create_issue_attachment` |

> **Note:** attachment tools read `file_path` from the machine running
> `gitea-mcp`. Instances can disable attachments (a 404 means the feature is
> off) and cap the upload size (oversize fails 413/422).

### Labels

| Tool | Description |
|------|-------------|
| `list_labels` | List repository labels |
| `create_label` | Create a label (`name`, `color`, `description`) |
| `update_label` | Update a label by `id` |
| `delete_label` | Delete a label by `id` |
| `add_issue_labels` | Add labels to an issue by name |
| `remove_issue_label` | Remove a label from an issue by label `id` |
| `replace_issue_labels` | Replace all labels on an issue |
| `clear_issue_labels` | Remove all labels from an issue |

### Milestones

| Tool | Description |
|------|-------------|
| `list_milestones` | List milestones (filter by `state`) |
| `get_milestone` | Get a milestone by `id` |
| `create_milestone` | Create a milestone with `title`, `description`, `due_on` |
| `update_milestone` | Update milestone fields or `state` |
| `delete_milestone` | Delete a milestone by `id` |

### Topics

| Tool | Description |
|------|-------------|
| `list_topics` | List a repository's topics (tags) |
| `replace_topics` | Replace ALL topics with the given list (pass `[]` to clear) |
| `add_topic` | Add a single topic by name |
| `remove_topic` | Remove a single topic by name |

### Pull Requests

| Tool | Description |
|------|-------------|
| `list_pull_requests` | List pull requests in a repo (filter by state, labels, sort, milestone) |
| `get_pull_request` | Fetch one pull request by its number |
| `create_pull_request` | Create a pull request (title, head, base, body) |
| `update_pull_request` | Edit a pull request or close/reopen it (state: open \| closed) |
| `merge_pull_request` | Merge a pull request (strategy: merge \| squash \| rebase \| rebase-merge) — **irreversible** |
| `is_pull_merged` | Check whether a pull request has been merged |
| `list_pull_commits` | List the commits in a pull request |
| `list_pull_files` | List the files changed in a pull request |

> **Note:** a pull request shares its number space with issues (PR #N == Issue #N).
> Comments, labels, and milestones on a PR reuse the **issue** tools — pass the PR
> number as the `index`. Only PR-specific operations use the tools above.

### Actions

| Tool | Description |
|------|-------------|
| `list_action_runs` | List Gitea Actions workflow runs (filter by `status`, `branch`, `event`, `actor`, `head_sha`) |
| `get_action_run` | Get a single workflow run by `runId` — check status before cancel/rerun |
| `cancel_action_run` | Cancel an **active** run (queued, in_progress, running) — partially destructive |
| `rerun_action_run` | Rerun an entire **completed** run — requires Gitea 1.26.0+ |
| `rerun_action_run_failed_jobs` | Rerun only the failed jobs of a completed run — requires Gitea 1.26.0+ |

> **Note:** cancel only works on active runs; rerun only works on completed runs.
> Always call `get_action_run` first to verify the current status, and confirm the
> `runId` with the user before cancelling or rerunning.

### Releases

| Tool | Description |
|------|-------------|
| `list_releases` | List releases in a repo (filter by `draft`, `prerelease`, page/limit) |
| `get_release` | Get a single release by its numeric `id` |
| `get_release_by_tag` | Get a release by its `tag` name (e.g. `v1.2.0`) |
| `create_release` | Create a release with `tag_name`, `name` (title), `body` (notes), `target_commitish`, `draft`, `prerelease` |
| `update_release` | Update a release's title, notes, draft/prerelease flags, or rename the tag |
| `delete_release` | Delete a release by `id` — **irreversible** |

> **Note:** a release is identified by its numeric `id` (from `list_releases` or
> `get_release_by_tag`), NOT the tag name. `create_release` and `update_release`
> maintain the title (`name`) and release notes (`body`). Deleting a release may or
> may not delete the underlying Git tag depending on the Gitea configuration.

### Repository

| Tool | Description |
|------|-------------|
| `update_repo` | Edit a repository's metadata — `description`, `name` (rename), `website`, `private`, `default_branch` (only provided fields change) |

> **Note:** `name` renames the repository and changes its URL; confirm with the
> user before renaming. To change the repo description, pass only `description`
> (an empty string clears it).

### Wiki

| Tool | Description |
|------|-------------|
| `list_wiki_pages` | List all wiki pages in a repo (metadata only, page/limit) |
| `get_wiki_page` | Get one wiki page by `pageName` — `content` returned as plain Markdown (base64 decoded) |
| `create_wiki_page` | Create a wiki page (`title`, plain-Markdown `content`, optional `message`) |
| `update_wiki_page` | Edit a wiki page by `pageName`; pass `title` to rename (only provided fields change) |
| `delete_wiki_page` | Delete a wiki page by `pageName` — recoverable only from the wiki git clone |
| `list_wiki_revisions` | List the revision history of one wiki page by `pageName` |

> **Note:** `pageName` is the page title as it appears in the wiki URL (e.g.
> `Home`, `Getting-Started`). `Home` is the landing page; `_Sidebar` and
> `_Footer` are the layout pages. Page content is always plain Markdown — the
> tools handle the API's base64 encoding for you. Requires the repo's wiki
> feature to be enabled (404 otherwise).

### Projects (Placeholder)

| Tool | Description |
|------|-------------|
| `list_projects` | List project boards (kanban) — **placeholder: always returns `[]`** (Gitea has no projects REST API yet) |
| `get_project` | Get a project board by `id` — **placeholder: always reports not-found** (Gitea has no projects REST API yet) |

> **Note:** These tools exist as a stable contract so planning workflows can ask
> about projects without breaking. They make no HTTP request and always return
> empty / not-found results. When the upstream Gitea projects REST API lands
> ([go-gitea/gitea#36824](https://github.com/go-gitea/gitea/issues/36824)),
> real HTTP calls will be wired in transparently.

### Repository Helpers

| Tool | Description |
|------|-------------|
| `list_my_repos` | List repositories accessible to the authenticated user |
| `resolve_repo` | Detect `baseUrl`, `owner`, and `repo` from the project's git remotes (`upstream` preferred, then `origin`); echoed remote URLs are stripped of any embedded userinfo |
| `gitea_status` | Inspect credential-handling state — active candidate, exhausted candidates, last error (redacted; secrets never exposed) |
| `configure_gitea` | Configure the Gitea connection at runtime (session-scoped, never persisted). Accepts `base_url`, `owner`, `repo`, and/or `username`. Providing `base_url` or `username` triggers credential re-discovery from the existing local sources — tokens never pass through this tool |

## AI Guidance & Skills

The server ships guidance so assistants use the tools correctly and safely,
through three channels:

- **`instructions` (on connect)** — a concise strategy the server sends during the
  MCP handshake; capable clients inject it into the system prompt automatically.
- **Tool descriptions** — every tool's description flags its key risk (pagination,
  label ID-vs-name, destructive scope) and a minimal usage example.
- **Prompts & resources** — workflow templates (`triage_issues`,
  `summarize_issue`, `triage_pull_requests`, `summarize_pull_request`,
  `audit_labels`, `milestone_report`, `triage_action_runs`) and on-demand
  reference docs (field reference, label guide, tool cookbook) for clients that
  surface them.

### Action skills

For opencode and other tools, the server ships a set of **action-scoped skills**
— one per workflow, so the assistant loads only the guidance it needs (and never,
say, delete instructions while creating). Install them with the
`gitea-mcp init --tool <name>` command shown above.

| Skill | Invoke when |
|-------|-------------|
| `gitea-find-issues` | discovering / reading / triaging issues |
| `gitea-update-issue` | editing fields, closing, clearing assignee/milestone |
| `gitea-label-issue` | adding / replacing / removing / clearing labels on an issue |
| `gitea-manage-labels` | creating or editing label definitions |
| `gitea-comment-issue` | posting a comment that advances an issue's discussion |
| `gitea-summarize-issue` | reading and summarizing an issue's discussion |
| `gitea-plan-milestones` | creating / editing / closing milestones |
| `gitea-resolve-repo` | resolving owner/repo or listing repositories |
| `gitea-configure` | fixing the connection — instance URL, token, or 401/403 errors |
| `gitea-find-pulls` | discovering / reading pull requests, their commits and files |
| `gitea-create-pull` | creating a pull request (after a duplicate check) |
| `gitea-update-pull` | editing fields, closing without merging, reopening, WIP toggle |
| `gitea-merge-pull` | merging a pull request (after mergeability check + user confirmation) |
| `gitea-summarize-pull` | reading and summarizing a pull request for review |
| `gitea-find-actions` | discovering / reading Actions workflow runs |
| `gitea-cancel-action` | cancelling an active run (after status check + user confirmation) |
| `gitea-rerun-action` | rerunning a completed run — full or failed jobs only |
| `gitea-write-wiki` | writing / editing wiki pages per the bundled OSS wiki format spec |

Each skill is a short, AI-facing action flow (purpose, when to use, when not to,
rules, and what to check first). The comment and milestone skills also
embed **body templates** (comment, milestone)
that standardize the format of what the assistant writes. Destructive
single-tool actions (delete issue / comment / label / milestone) are intentionally
left to the tool descriptions so they never contaminate a creative workflow.

## Development

```bash
git clone https://github.com/amonstack/gitea_mcp.git
cd gitea_mcp
npm ci
```

| Command | Description |
|---------|-------------|
| `make lint` | Type-check only |
| `make build` | Compile `src/` to `dist/` |
| `make test` | Run unit tests |
| `make test-watch` | Run tests in watch mode |
| `make test-integration` | Run integration tests (needs live Gitea instance) |
| `make scan` | Scan for leaked secrets with gitleaks (part of `make verify`) |
| `make verify` | Full CI gate: install, secret scan, lint, build, unit tests, smoke run |
| `make dev` | Run directly with tsx |

For the full architecture — module layout, dependency graph, core patterns, and
the guide to adding a new tool — see [`docs/architecture.md`](docs/architecture.md).

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on reporting bugs, suggesting features, and submitting pull requests.

## License

[MIT](LICENSE) — Copyright (c) 2026 [amonstack](https://github.com/amonstack).
