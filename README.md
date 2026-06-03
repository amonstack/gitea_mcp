# gitea-mcp

MCP server for managing [Gitea](https://about.gitea.com/) repositories — issues, comments, labels, milestones, and more via the Gitea API.

## Installation

```bash
make install
# or: npm ci
```

## Build & Run

| Purpose | Command | Equivalent |
|---------|---------|------------|
| Full check + build | `make all` | `npm run lint && npm run build` |
| Type check only | `make lint` | `npm run lint` (tsc --noEmit) |
| Build to `dist/` | `make build` | `npm run build` |
| Run directly (tsx) | `make dev` | `npm run dev` |
| Run compiled output | — | `npm run start` |
| Clean `dist/` | `make clean` | `rm -rf dist` |

**Order**: `make all` (or `make lint` then `make build`).

## Environment Variables

### Runtime (required by server)

| Variable | Required | Description |
|----------|----------|-------------|
| `GITEA_BASE_URL` | Yes | Gitea instance URL (e.g. `https://gitea.example.com`) |
| `GITEA_TOKEN` | Yes | Gitea API access token |
| `GITEA_DEFAULT_OWNER` | No | Default repository owner (avoid passing `owner` on every call) |
| `GITEA_DEFAULT_REPO` | No | Default repository name (avoid passing `repo` on every call) |

### Publishing (required by `make publish`)

| Variable | Required | Description |
|----------|----------|-------------|
| `GITHUB_PUBLISH_TOKEN` | GitHub | PAT with `write:packages` scope |
| `GITEA_PUBLISH_TOKEN` | Gitea | Token with `write:package` scope |
| `GITEA_PUBLISH_URL` | Gitea | Full registry URL (e.g. `https://gitea.example.com/api/packages/OWNER/npm/`) |
| `OWNER` | No | Package scope namespace (auto-detected from git remote if not set) |

## MCP Tools

All tools accept `owner` and `repo` parameters optionally when `GITEA_DEFAULT_OWNER` / `GITEA_DEFAULT_REPO` are set.

### Issues

| Tool | Description |
|------|-------------|
| `list_issues` | List issues (filter by `state`, `labels`, pagination) |
| `get_issue` | Get a single issue by `index` (issue number) |
| `create_issue` | Create issue with `title`, `body`, `assignee`, `labels`, `milestone` |
| `update_issue` | Update issue fields or `state` |
| `delete_issue` | Delete an issue by `index` |
| `search_issues` | Search across repos by `query`, `type`, `state`, `labels` |

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
| `list_labels` | List repo labels |
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
| `create_milestone` | Create milestone with `title`, `description`, `due_on` |
| `update_milestone` | Update milestone fields or `state` |
| `delete_milestone` | Delete a milestone by `id` |

### Repository

| Tool | Description |
|------|-------------|
| `list_my_repos` | List repos the authenticated user can access |
| `resolve_repo` | Auto-detect `owner` and `repo` from git remote URL in the current or specified directory |

## Usage with MCP Clients

### Claude Desktop (`claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "gitea-mcp": {
      "command": "node",
      "args": ["/path/to/gitea-mcp/dist/cli.js"],
      "env": {
        "GITEA_BASE_URL": "https://gitea.example.com",
        "GITEA_TOKEN": "your-token-here",
        "GITEA_DEFAULT_OWNER": "myorg",
        "GITEA_DEFAULT_REPO": "myrepo"
      }
    }
  }
}
```

### opencode

```json
{
  "mcpServers": {
    "gitea-mcp": {
      "command": "node",
      "args": ["/path/to/gitea-mcp/dist/cli.js"],
      "env": {
        "GITEA_BASE_URL": "https://gitea.example.com",
        "GITEA_TOKEN": "your-token-here"
      }
    }
  }
}
```

## Testing

| Command | Description |
|---------|-------------|
| `make test` | Unit tests |
| `make test-watch` | Watch mode |
| `make test-integration` | Integration tests (requires `GITEA_BASE_URL` and `GITEA_TOKEN`) |

## Packaging & Publishing

Run `make package` first to build and package, then `make publish` to publish.

### Step 1: Build and package

```bash
make package
# Creates .dist/{platform}/sources/gitea-mcp-src-{version}.tgz
# Creates .dist/{platform}/releases/gitea-mcp-{version}.tgz
```

Platform is auto-detected from git remote URL. Override with `OWNER` env var.

### Step 2: Publish

```bash
# GitHub Packages (default)
export GITHUB_PUBLISH_TOKEN=ghp_your_token
make publish

# Gitea Package Registry
export GITEA_PUBLISH_TOKEN=your_token
export GITEA_PUBLISH_URL=https://gitea.example.com/api/packages/OWNER/npm/
make publish
```

### Install (consumers)

```bash
# GitHub Packages
npm set @OWNER:registry https://npm.pkg.github.com
npm install @OWNER/gitea-mcp

# Gitea Package Registry
npm set @OWNER:registry https://gitea.example.com/api/packages/OWNER/npm/
npm install @OWNER/gitea-mcp
```

## Project Structure

```
src/
  cli.ts           # Entry point, reads env vars
  server.ts        # McpServer setup, tool registration
  tools.ts         # Zod input schemas for all tools
  gitea-client.ts  # REST client wrapping Gitea /api/v1 endpoints
```

## License

MIT
