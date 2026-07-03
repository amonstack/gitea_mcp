# gitea-mcp

[中文文档](https://github.com/amonstack/gitea_mcp/blob/master/README.zh-CN.md)

> MCP server that lets AI assistants manage Gitea repositories — issues, labels,
> milestones, comments, and more via the Gitea API.

## What is gitea-mcp?

`gitea-mcp` is a [Model Context Protocol (MCP)](https://modelcontextprotocol.io/)
server that exposes Gitea repository operations as tools. Once connected to an
MCP client (Claude Desktop, opencode, Cursor, etc.), an AI assistant can list,
create, update, and delete issues, labels, milestones, and comments on your
Gitea instance — all through natural language.

The server communicates over stdio and wraps the [Gitea REST API
(`/api/v1`)](https://docs.gitea.com/api/1.22/).

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

| Variable | Required | Description |
|----------|:--------:|-------------|
| `GITEA_BASE_URL` | Yes | Gitea instance URL (e.g. `https://gitea.example.com`) |
| `GITEA_TOKEN` | Yes | Gitea API access token |
| `GITEA_DEFAULT_OWNER` | No | Default repository owner — skip passing `owner` on every call |
| `GITEA_DEFAULT_REPO` | No | Default repository name — skip passing `repo` on every call |

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
installation, set the required environment variables and run:

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
| `resolve_repo` | Auto-detect `owner` and `repo` from a local git remote URL |

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
| `make dev` | Run directly with tsx |

For the full architecture — module layout, dependency graph, core patterns, and
the guide to adding a new tool — see [`docs/architecture.md`](docs/architecture.md).

## License

MIT
