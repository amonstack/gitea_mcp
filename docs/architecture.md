# Architecture

This document is the concrete architecture blueprint for `gitea-mcp` — the
specific tech stack, module layout, dependency relationships, and core
patterns. It is the baseline that keeps the project stable and consistent
across iterations, and it is maintained alongside the code.

`AGENTS.md` remains the authority on **how the AI operates** within the repo
(workflow, boundaries, coding rules); where a rule there and this blueprint
appear to conflict, `AGENTS.md` governs and this document MUST be reconciled
to it. For what `gitea-mcp` does from a user's perspective (installation,
configuration, MCP client wiring), see `README.md`.

## 1. Overview & Data Flow

`gitea-mcp` is a [Model Context Protocol (MCP)](https://modelcontextprotocol.io/)
server that exposes Gitea repository operations as MCP tools. It communicates
with MCP clients over stdio and translates each tool call into one or more
requests against the [Gitea REST API (`/api/v1`)](https://docs.gitea.com/api/1.22/).

```
┌───────────────┐     stdio      ┌──────────────────────────────┐     HTTPS     ┌──────────────────────┐
│  MCP Client   │ ◄──────────► │  McpServer (server.ts)       │ ◄──────────► │  Gitea /api/v1       │
│  (Claude,     │   JSON-RPC   │   ├─ tools.ts (Zod schemas)  │   token auth  │  (issues, labels,    │
│   opencode…)  │              │   └─ GiteaClient.request<T>  │               │   milestones, …)     │
└───────────────┘              └──────────────────────────────┘               └──────────────────────┘
        ▲
        │ env: GITEA_BASE_URL, GITEA_TOKEN, GITEA_DEFAULT_OWNER, GITEA_DEFAULT_REPO
   cli.ts (process entry)
```

Per-call flow:

1. The MCP client sends a tool invocation (tool name + JSON arguments).
2. `server.ts` validates the arguments against the matching Zod schema from
   `tools.ts`, then resolves the target repository.
3. The handler delegates to a `GiteaClient` method, which builds the URL and
   calls the private `request<T>` helper.
4. `request<T>` attaches the `Authorization: token <token>` header, performs
   the `fetch`, and returns parsed JSON (or `undefined` for HTTP `204`).
5. The handler serializes the result into an MCP `content` text block and
   returns it to the client.

## 2. Tech Stack & Dependencies

| Concern | Choice |
|---------|--------|
| Runtime | Node.js ≥ 18 (uses the global `fetch`) |
| Language | TypeScript, `target: ES2022`, `strict: true`; emits `declaration` + `sourceMap` |
| Module system | ESM (`"type": "module"`, `"module": "Node16"`) |
| Build | Plain `tsc` (no bundler) — `src/` → `dist/` |
| MCP SDK | `@modelcontextprotocol/sdk` (server + stdio transport) |
| Schema validation | `zod` (tool input schemas) |
| Dev tooling | `tsx` (dev runner), `vitest` (test runner), `typescript`, `@types/node` |

`package.json` is the single source of dependency truth. Runtime dependencies
are intentionally minimal: only the MCP SDK and Zod. No HTTP client library is
added — the global `fetch` is used exclusively.

## 3. Module Layout

The codebase is intentionally small and flat. Each file has a fixed
responsibility:

```
src/
├── index.ts           # Package entry (main); re-exports createServer/runServer for programmatic use
├── cli.ts            # Process entry point (env → runServer, skills CLI dispatch)
├── server.ts         # McpServer, tool/prompt/resource registration, resolve(), parseGitRemoteUrl
├── tools.ts          # One Zod schema per tool input
├── gitea-client.ts   # GiteaClient REST wrapper (request<T> + HTTP methods)
├── skills.ts         # opencode skill install logic (gitea-mcp skills install)
├── assets/           # Guidance content (shipped inside dist/ via copy-assets)
│   ├── instructions.md          # handshake instructions (Track A)
│   ├── resources/*.md           # on-demand reference docs (Track A)
│   └── skills/<action>/SKILL.md # opencode action skills, one per workflow (Track B)
└── __tests__/
    ├── *.test.ts             # Unit tests (stub global.fetch)
    └── *.integration.test.ts # Integration tests (live Gitea, opt-in)
scripts/
└── copy-assets.mjs  # copies src/assets/** → dist/assets/** during build
```

| File | Responsibility (invariant) |
|------|----------------------------|
| `src/index.ts` | The package `main` entry. Re-exports `createServer` and `runServer` from `server.ts` so `import "@amonstack/gitea-mcp"` works for programmatic use. Defines nothing of its own. |
| `src/cli.ts` | Process entry point for the `gitea-mcp` bin. Reads env vars (`GITEA_BASE_URL`, `GITEA_TOKEN`, `GITEA_DEFAULT_OWNER`, `GITEA_DEFAULT_REPO`), validates the required ones, and calls `runServer`. Dispatches the `gitea-mcp skills ...` subcommand (no credentials required) to `skills.ts`. Contains no tool or HTTP logic. |
| `src/server.ts` | Creates the `McpServer`, registers every tool (name + Zod schema + handler), prompt, and resource, owns the `resolve()` owner/repo fallback and `parseGitRemoteUrl`, and loads the handshake `instructions` from `assets/instructions.md`. Exports `createServer` and `runServer`. |
| `src/tools.ts` | Exports one Zod schema per tool input. The set of schemas stays 1:1 with the tools registered in `server.ts` and the tool tables in `README.md`. |
| `src/gitea-client.ts` | `GiteaClient` — the REST client wrapping Gitea `/api/v1`. Owns the `request<T>` helper (auth header, JSON, `204` handling) and all HTTP methods. Contains no MCP/stdio logic. |
| `src/skills.ts` | The `gitea-mcp skills install` implementation: copies every bundled skill (each subdirectory of `dist/assets/skills/` containing a `SKILL.md`) into the user's opencode skills directory, one folder per skill. No MCP/HTTP logic; no Gitea credentials required. |
| `src/assets/**` | Markdown guidance content (instructions, resources, the opencode action skills). Pure data, read at runtime; copied into `dist/assets/` by `scripts/copy-assets.mjs` so it ships with the published package. |

`cli.ts` is a thin shell; `server.ts` is the composition root; `tools.ts` is
pure schema declarations; `gitea-client.ts` is pure HTTP. Mixing concerns
across these files is a deviation from the architecture.

## 4. Module Dependency Graph

Dependencies point downward (a file may only import what is below it in the
list):

```
cli.ts
  ├─► server.ts        (runServer — default MCP mode)
  └─► skills.ts        (runSkillsCommand — only the `gitea-mcp skills` subcommand)
server.ts
  ├─► tools.ts          (Zod schemas)
  ├─► gitea-client.ts   (GiteaClient)
  ├─► @modelcontextprotocol/sdk  (McpServer, StdioServerTransport)
  └─► assets/*.md       (readFile at runtime: instructions + resources)
skills.ts
  └─► assets/skills/<action>/SKILL.md  (read bundled skills tree, copy to opencode dir)
```

Rules implied by the graph:

- `gitea-client.ts` and `tools.ts` are leaves — they import none of the other
  project files, only external packages.
- `server.ts` is the only file that imports both `tools.ts` and
  `gitea-client.ts`; it is the composition root that wires schemas to handlers
  to client methods. It also reads guidance markdown from `assets/`.
- `cli.ts` depends on `server.ts`'s `runServer` and (lazily, only for the
  `skills` subcommand) on `skills.ts`. No file imports `cli.ts`.
- `skills.ts` is a leaf that only reads the bundled skills tree; it touches no
  MCP/HTTP logic and needs no Gitea credentials.
- There are no cycles and no hidden lateral imports (e.g. `gitea-client.ts`
  never imports `tools.ts`).

## 5. Core Patterns

### 5.1 MCP Tool Registration

Every tool is registered with a fixed three-part shape in `server.ts`:

```ts
server.registerTool(
  "<snake_case_name>",            // matches the contract in README.md
  { description: "...", inputSchema: <XxxSchema>.shape },
  async (input) => {
    const { owner, repo } = resolve(input);          // owner/repo fallback
    const data = await client.<method>({ ...input, owner, repo });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  },
);
```

- Tool names are `snake_case`; schema names are PascalCase
  `<Verb><Resource>Schema` — the two are paired 1:1.
- Handlers always return `{ content: [{ type: "text", text }] }`.
- Mutations that return no body (deletes, clears) return a short human-readable
  confirmation string instead of JSON.

### 5.2 Owner / Repo Resolution

`resolve()` in `server.ts` applies a fallback chain so callers can omit
`owner` / `repo` on every call:

```
explicit argument  ─►  GITEA_DEFAULT_OWNER / GITEA_DEFAULT_REPO  ─►  throw
```

The `resolve_repo` tool offers a fourth source: it parses the `origin` remote
URL from a local git working copy (`parseGitRemoteUrl` handles both SSH and
HTTPS forms) and returns `{ owner, repo }` for the caller to supply.

### 5.3 HTTP via `request<T>`

All Gitea calls go through `GiteaClient.request<T>` in `gitea-client.ts`:

- Base URL is normalized (trailing slashes stripped once).
- Auth is an `Authorization: token <token>` header; the token is never logged
  or echoed (see AGENTS.md §4 Secret Handling).
- Request bodies are JSON; `Content-Type` is set only when a body is present.
- `204 No Content` resolves to `undefined`.
- Non-`ok` responses throw an `Error` of the form
  `Gitea API error (<status>): <body>` — the status and body are always
  carried, never the token.
- Path segments for `owner` / `repo` are `encodeURIComponent`-escaped; query
  parameters are assembled with `URLSearchParams`.

### 5.4 Adding a New Tool

Adding a tool is a coordinated change across four places:

1. **`tools.ts`** — declare the Zod schema (`<Verb><Resource>Schema`) with
   `.describe(...)` on every field (these become the MCP client's parameter
   docs).
2. **`gitea-client.ts`** — add the `GiteaClient` method that performs the HTTP
   call (unless the tool needs no API call, like `resolve_repo`).
3. **`server.ts`** — `registerTool` the name + schema + handler.
4. **`README.md` / `README.zh-CN.md`** — add a row to the matching tool table.

This keeps schemas, registrations, client methods, and documentation in sync.

### 5.5 Guidance Layer (instructions / prompts / resources / skill)

Beyond tools, the server ships usage guidance through four channels, authored as
markdown under `src/assets/` (copied into `dist/assets/` at build time):

| Channel | Where | Loaded | Audience |
|---------|-------|--------|----------|
| `instructions` | `assets/instructions.md`, read in `createServer` and passed to `McpServer({ … }, { instructions })` | MCP handshake (`InitializeResult`) | all clients that read it |
| tool `description` | inline in `server.ts` `registerTool` | `tools/list` | all clients |
| prompts | `server.ts` `registerPrompt` (body is an inline template) | `prompts/get` | clients that surface prompts |
| resources | `server.ts` `registerResource`, reads `assets/resources/*.md` | `resources/read` | clients that surface resources |
| opencode skills | `assets/skills/<action>/SKILL.md` (one per workflow) | `gitea-mcp skills install` copies each to the opencode skills dir, one folder per skill | opencode |

Coordination rule (parallel to §5.4): guidance is a coordinated change across
`server.ts` (the registration / load site) + the matching `assets/*.md` (the content)
+ `README.md` / `README.zh-CN.md` (the user-facing description). Descriptions,
prompts, resources, the instructions digest, and the action skills MUST stay consistent
with the actual tool behavior.

## 6. Environment Contract

| Variable | Required | Consumer | Purpose |
|----------|:--------:|----------|---------|
| `GITEA_BASE_URL` | Yes | `cli.ts` → `GiteaClient` | Gitea instance origin (e.g. `https://gitea.example.com`) |
| `GITEA_TOKEN` | Yes | `cli.ts` → `GiteaClient` | API access token, sent only as the `Authorization: token` header |
| `GITEA_DEFAULT_OWNER` | No | `cli.ts` → `server.resolve` | Default repository owner so `owner` can be omitted per call |
| `GITEA_DEFAULT_REPO` | No | `cli.ts` → `server.resolve` | Default repository name so `repo` can be omitted per call |
| `NPM_TOKEN` | No (publish only) | `make publish` | npm publish token; never read at runtime |

`cli.ts` validates that `GITEA_BASE_URL` and `GITEA_TOKEN` are present and
exits `1` with a clear message if either is missing.

## 7. Build & Packaging

- **Two tsconfigs separate "verify by emitting" from "ship to dist":**
  - `tsconfig.json` — the authoritative verification (and IDE/LSP) config. It does a
    **real emit with declarations** (`declaration: true`, no `--noEmit`) to the
    gitignored throwaway `outDir` `.dist/typecheck`, with `include: ["src"]` and
    **tests included**, `types: ["node"]`. `make lint` (`tsc -p tsconfig.json`) runs
    this and MUST pass. Emitting (not `--noEmit`) is required because `--noEmit`
    silently masks declaration-emit errors (e.g. TS4023/TS4058 private-type leakage),
    emit-stage config problems, and JS-output issues. Including tests is required
    because a lint that skips `src/__tests__` is not real verification either.
  - `tsconfig.build.json` — extends the verify config, repoints `outDir` to `dist`,
    and excludes `src/__tests__` (and the vitest configs) so the published `dist/`
    contains no test code. `make build` runs this.
- `make lint` = `tsc -p tsconfig.json` (real decl+JS emit to `.dist/typecheck`).
- `make build` = `tsc -p tsconfig.build.json` then `npm run build:assets`
  (`scripts/copy-assets.mjs` copies `src/assets/**` → `dist/assets/**`).
- `make test` (`vitest run`) plus a runtime smoke run of the built `dist/` cover the
  runtime/type-decoupling and module-resolution classes that neither emit nor
  `--noEmit` can catch.
- The published npm package ships **only** `dist/` (`"files": ["dist"]` in
  `package.json`; `src/`, `tsconfig*.json`, and tests are excluded via `.npmignore`).
  Guidance markdown rides along inside `dist/assets/`.
- `make package` produces a release tarball under `.dist/releases/`.
- Both `dist/` and `.dist/` are gitignored and MUST NOT be committed.
- `make publish` publishes `@amonstack/gitea-mcp` with `--access public`; it
  requires `NPM_TOKEN` and is run only on explicit user instruction.

## 8. Testing Strategy

- **Unit tests** (`*.test.ts`, run via `make test`) are deterministic and
  hermetic. HTTP behavior in `gitea-client.ts` is tested by stubbing the global
  `fetch` — never by hitting a live instance. Schema tests assert parse
  success/failure and defaults.
- **Integration tests** (`*.integration.test.ts`, run via
  `make test-integration`) MAY call a real Gitea instance
  (`GITEA_BASE_URL` / `GITEA_TOKEN`) but are opt-in and MUST clean up any
  resources they create.
- Tests MUST assert observable behavior; coverage is a floor, not proof of
  correctness.

See AGENTS.md §3 for the full test contract that binds AI-implemented code.
