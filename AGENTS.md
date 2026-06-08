# AGENTS.md

## Commands

| Phase | Command | Description |
|-------|---------|-------------|
| Lint | `make lint` | Type-check only |
| Build | `make build` | Compile src/ → dist/ |
| Test | `make test` | Unit tests |
| Test (watch) | `make test-watch` | Watch mode |
| Test (integration) | `make test-integration` | Integration tests |
| Package | `make package` | Build + release tarball |
| Publish | `make publish` | Publish to npm registry |
| Clean | `make clean` | Remove dist/ and .dist/ |
| Dev | `make dev` | Run directly with tsx |
| All | `make all` | lint + build |

## Environment

### Runtime
- `GITEA_BASE_URL` — Gitea instance URL
- `GITEA_TOKEN` — API access token

### Publishing
- `NPM_TOKEN` — npm access token (publish permission)

## Architecture

ESM project (`"type": "module"`, `"module": "Node16"`).

| File | Role |
|------|------|
| `src/cli.ts` | Entry point for `npx gitea-mcp` |
| `src/server.ts` | Creates `McpServer`, registers tools |
| `src/gitea-client.ts` | REST client wrapping Gitea `/api/v1` endpoints |
| `src/tools.ts` | Zod schemas for tool input parameters |

## SDK Note

Import `McpServer` from `@modelcontextprotocol/sdk/server/mcp.js` — the barrel re-export does not include `McpServer`.
