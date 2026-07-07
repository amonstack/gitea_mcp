<p align="center">
  <img alt="gitea-mcp" src="https://raw.githubusercontent.com/amonstack/gitea_mcp/master/docs/assets/gitea-mcp-banner.png" />
  <h3 align="center">gitea-mcp</h3>
  <p align="center">MCP server that exposes Gitea issues, labels, milestones, and comments as tools for AI assistants</p>
</p>

---

[![npm version](https://img.shields.io/npm/v/@amonstack/gitea-mcp?logo=npm)](https://www.npmjs.com/package/@amonstack/gitea-mcp)
[![codecov](https://codecov.io/gh/amonstack/gitea_mcp/branch/master/graph/badge.svg)](https://codecov.io/gh/amonstack/gitea_mcp)
[![license](https://img.shields.io/npm/l/@amonstack/gitea-mcp)](https://github.com/amonstack/gitea_mcp/blob/master/LICENSE)
[![Node](https://img.shields.io/node/v/@amonstack/gitea-mcp?logo=node.js)](https://www.npmjs.com/package/@amonstack/gitea-mcp)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![MCP](https://img.shields.io/badge/MCP-server-6f42c1?logo=modelcontextprotocol&logoColor=white)](https://modelcontextprotocol.io)

**English** | [中文文档](https://github.com/amonstack/gitea_mcp/blob/master/README.zh-CN.md)

`gitea-mcp` is a [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server that exposes Gitea repository operations as tools. Once connected to an MCP client (Claude Desktop, opencode, Cursor, etc.), an AI assistant can list, create, update, and delete issues, labels, milestones, and comments on your Gitea instance — all through natural language.

The server communicates over stdio and wraps the [Gitea REST API (`/api/v1`)](https://docs.gitea.com/api/1.22/).

## Features

- **Full Gitea project management** — issues, labels, milestones, and comments via natural language
- **Zero-config auto-discovery** — reads `baseUrl`, `owner`, `repo`, and token from the project's git config; one global install serves many repos
- **Multi-source auth with failover** — tries `[gitea]` config tokens, `GITEA_TOKEN`, then the git credential store, advancing automatically on `401`/`403`
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
- A **Gitea instance** (self-hosted or Gitea Cloud) reachable over HTTP
- A **Gitea API token** (or a git credential-store entry) for anything beyond reading public repositories

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
git clone https://github.com/amonstack/gitea-mcp.git
cd gitea-mcp
npm ci
npm run build
node dist/cli.js
```

## Configuration

All variables are optional — `gitea-mcp` auto-discovers the Gitea instance, repository,
and token from the project's local git config so a single global install can serve many
projects. Set them only to override the discovery.

| Variable | Required | Description |
|----------|:--------:|-------------|
| `GITEA_BASE_URL` | No | Gitea instance URL (e.g. `https://gitea.example.com`). Auto-detected from the project's git remote when omitted. |
| `GITEA_TOKEN` | No | Gitea API access token. One of several auth candidates; tried after a `.git/config [gitea]` token and before the git credential store (see [Token discovery](#token-discovery)). |
| `GITEA_DEFAULT_OWNER` | No | Default repository owner — skip passing `owner` on every call |
| `GITEA_DEFAULT_REPO` | No | Default repository name — skip passing `repo` on every call |

### How auto-discovery works

On start, `gitea-mcp` reads `<cwd>/.git/config` and derives:

- **Instance URL** — from the selected remote's host. SSH remotes (`git@host:owner/repo`)
  resolve to `https://host`. Override with `GITEA_BASE_URL`.
- **owner / repo** — from the selected remote's URL. Override with `GITEA_DEFAULT_OWNER` /
  `GITEA_DEFAULT_REPO`, or detect ad hoc with the `resolve_repo` tool.
- **Remote selection** — the `upstream` remote is preferred, falling back to `origin`, then
  any other remote. Both are reported by `resolve_repo` when they differ.

If the current directory has no git remote and `GITEA_BASE_URL` is not set, the server does
**not** start — it prints a skip reason and exits 0. Run it from inside a cloned Gitea
repository, or set `GITEA_BASE_URL` / `GITEA_TOKEN` explicitly.

### Token discovery

`gitea-mcp` collects authentication **candidates** from three sources, in this
priority order:

1. A `[gitea "<baseUrl>"]` section in `.git/config` (a bare `[gitea]` section is
   a host-wide fallback):
   ```ini
   [gitea "https://gitea.example.com"]
       token = <your-token>
   ```
   Always sent as `Authorization: token <token>`.
2. The `GITEA_TOKEN` environment variable — also sent as `Authorization: token`.
3. The git credential store (`~/.git-credentials`, or
   `$XDG_CONFIG_HOME/git/credentials`) — every line whose host matches the
   instance, e.g. `https://alice:s3cret@gitea.example.com`. When several lines
   match, the one whose path best matches `owner/repo` is tried first.

A credential-store entry's `password` field may hold a real PAT, an account
password, or an OAuth token — git stores whatever was typed at the prompt, and
the server cannot tell them apart statically. So each credential-store entry is
tried under **two authentication schemes**:

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
`factory`, `gemini`, `github-copilot`, `iflow`, `kilocode`, `opencode`, `qoder`,
`qwen`, `roocode`, `windsurf`. Paths follow each tool's conventional skills
directory; use `--dir` for an exact location. Then restart your tool. See
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

### Issues

| Tool | Description |
|------|-------------|
| `list_issues` | List issues (filter by `state`, `labels`, page/limit) |
| `get_issue` | Get a single issue by `index` (issue number) |
| `create_issue` | Create an issue with `title`, `body`, `assignee`, `labels`, `milestone` |
| `update_issue` | Update issue fields or `state` |
| `delete_issue` | Delete an issue by `index` |
| `search_issues` | Search across repositories by `query`, `type`, `state`, `labels` |

### Comments

| Tool | Description |
|------|-------------|
| `list_comments` | List comments on an issue |
| `create_comment` | Add a comment to an issue |
| `update_comment` | Update a comment by `id` |
| `delete_comment` | Delete a comment by `id` |

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

### Repository Helpers

| Tool | Description |
|------|-------------|
| `list_my_repos` | List repositories accessible to the authenticated user |
| `resolve_repo` | Detect `baseUrl`, `owner`, and `repo` from the project's git remotes (`upstream` preferred, then `origin`) |
| `gitea_status` | Inspect credential-handling state — active candidate, exhausted candidates, last error (redacted; secrets never exposed) |

## AI Guidance & Skills

The server ships guidance so assistants use the tools correctly and safely,
through three channels:

- **`instructions` (on connect)** — a concise strategy the server sends during the
  MCP handshake; capable clients inject it into the system prompt automatically.
- **Tool descriptions** — every tool's description flags its key risk (pagination,
  label ID-vs-name, destructive scope) and a minimal usage example.
- **Prompts & resources** — workflow templates (`triage_issues`,
  `summarize_issue`, `audit_labels`, `milestone_report`) and on-demand reference
  docs (field reference, label guide, tool cookbook) for clients that surface them.

### Action skills

For opencode and other tools, the server ships a set of **action-scoped skills**
— one per workflow, so the assistant loads only the guidance it needs (and never,
say, delete instructions while creating). Install them with the
`gitea-mcp init --tool <name>` command shown above.

| Skill | Invoke when |
|-------|-------------|
| `gitea-find-issues` | discovering / reading / triaging issues |
| `gitea-create-issue` | creating an issue (after a duplicate check) |
| `gitea-update-issue` | editing fields, closing, clearing assignee/milestone |
| `gitea-label-issue` | adding / replacing / removing / clearing labels on an issue |
| `gitea-manage-labels` | creating or editing label definitions |
| `gitea-comment-issue` | posting a comment that advances an issue's discussion |
| `gitea-summarize-issue` | reading and summarizing an issue's discussion |
| `gitea-plan-milestones` | creating / editing / closing milestones |
| `gitea-resolve-repo` | resolving owner/repo or listing repositories |
| `gitea-configure` | fixing the connection — instance URL, token, or 401/403 errors |

Each skill is a short, AI-facing action flow (purpose, when to use, when not to,
rules, and what to check first). The create, comment, and milestone skills also
embed **body templates** (bug / feature / performance issue, comment, milestone)
that standardize the format of what the assistant writes. Destructive
single-tool actions (delete issue / comment / label / milestone) are intentionally
left to the tool descriptions so they never contaminate a creative workflow.

## Development

```bash
git clone https://github.com/amonstack/gitea-mcp.git
cd gitea-mcp
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
| `make dev` | Run directly with tsx |

For the full architecture — module layout, dependency graph, core patterns, and
the guide to adding a new tool — see [`docs/architecture.md`](docs/architecture.md).

## Contributing

Contributions are welcome!

- Found a bug or have a feature idea? Please [open an issue](https://github.com/amonstack/gitea_mcp/issues).
- Pull requests are gladly accepted. This repo follows [Conventional Commits](https://www.conventionalcommits.org/) and the workflow described in [`AGENTS.md`](AGENTS.md) — please skim it before your first PR.
- For the module layout, dependency graph, and the guide to adding a new tool, see [`docs/architecture.md`](docs/architecture.md).

## License

[MIT](LICENSE) — Copyright (c) 2026 [amonstack](https://github.com/amonstack).
