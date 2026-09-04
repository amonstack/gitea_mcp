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
│  (Claude,     │   JSON-RPC   │   ├─ tools.ts (Zod schemas)  │   token/basic │  (issues, labels,    │
│   opencode…)  │              │   └─ GiteaClient.request<T>  │   auth        │   milestones, topics,│
└───────────────┘              └──────────────────────────────┘               │   pull requests,…)  │
                                                                              └──────────────────────┘
        ▲
        │ env (all optional overrides): GITEA_BASE_URL, GITEA_REPO_URL, GITEA_TOKEN, GITEA_DEFAULT_OWNER, GITEA_DEFAULT_REPO
   cli.ts (process entry) ──► git-config.ts (discoverConfig: .git/config remotes + git credential machinery + env)
                                  └─► credentials.ts (candidate state machine: pure functions)
```

GitLab mode (issue #84) keeps the same shape, wired to the second client leaf:
`cli.ts` → `discoverGitLabConfig` → `GitLabClient` → the GitLab REST API v4
(`/api/v4`, `Authorization: Bearer`). The platform is selected once per process:
explicit `MCP_PLATFORM`, else auto-detected from `GITLAB_*` presence (without a
`GITEA_*` connection variable), else `gitea`. See §5.6.

Per-call flow:

1. The MCP client sends a tool invocation (tool name + JSON arguments).
2. `server.ts` validates the arguments against the matching Zod schema from
   `tools.ts`, then resolves the target repository.
3. The handler delegates to the active client's method (`GiteaClient` or
   `GitLabClient` — one platform per process), which builds the URL and
   calls the private `request<T>` helper.
4. `request<T>` selects an auth header from the active candidate (or advances
   through the candidate × scheme list on `401`/`403`), performs the `fetch`,
   and returns parsed JSON (or `undefined` for HTTP `204`). See §5.3.
5. The handler serializes the result into an MCP `content` text block and
   returns it to the client.

## 2. Tech Stack & Dependencies

| Concern | Choice |
|---------|--------|
| Runtime | Node.js ≥ 24 (uses the global `fetch`) |
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
├── cli.ts            # Process entry point (discoverConfig → runServer, init CLI dispatch)
├── credentials.ts    # Pure credential candidate state machine (types + transition functions, no I/O)
├── git-config.ts     # Auto-discovery: parse remotes, resolve baseUrl/owner/repo + build candidates from git + env
├── server.ts         # McpServer, tool/prompt/resource registration, resolve()
├── tools.ts          # One Zod schema per tool input
├── gitea-client.ts   # GiteaClient REST wrapper (request<T> candidate iteration + HTTP methods)
├── gitlab-client.ts  # GitLabClient REST wrapper (/api/v4; mirrors the GiteaClient method surface)
├── skills.ts         # skill install logic + tool registry (gitea-mcp init --tool <name>)
├── assets/           # Guidance content (shipped inside dist/ via copy-assets)
│   ├── instructions.md          # handshake instructions (Track A)
│   ├── instructions-gitlab.md   # GitLab handshake instructions (§5.6)
│   ├── resources/*.md           # on-demand reference docs (Track A)
│   └── skills/<action>/SKILL.md # action skills, one per workflow (Track B)
└── __tests__/
    ├── *.test.ts             # Unit tests (stub global.fetch)
    └── *.integration.test.ts # Integration tests (live Gitea, opt-in)
scripts/
└── copy-assets.mjs  # copies src/assets/** → dist/assets/** during build
```

| File | Responsibility (invariant) |
|------|----------------------------|
| `src/index.ts` | The package `main` entry. Re-exports `createServer` and `runServer` from `server.ts` so `import "@amonstack/gitea-mcp"` works for programmatic use. Defines nothing of its own. |
| `src/cli.ts` | Process entry point for the `gitea-mcp` bin. Calls `git-config.ts`'s `discoverConfig()` (or `discoverGitLabConfig()` in GitLab mode — selected by `MCP_PLATFORM` / the `GITLAB_*`-vs-`GITEA_*` env mix, see `resolvePlatform`) to resolve the instance, credential candidates, and default owner/repo from git + env, then passes the candidates to `runServer`, alongside the `MCP_TOOL_ALLOWLIST` list parsed by `resolveToolAllowlist` (unset or blank means the gate is off). With no git remote and no `GITEA_BASE_URL` / `GITEA_REPO_URL` / `GITLAB_BASE_URL` / `GITLAB_REPO_URL`, it prints a one-line notice and starts the server in an **unconfigured** state (business tools return `NotConfiguredError`; the `configure_gitea` / `configure_gitlab` tool enables runtime configuration). Dispatches the `gitea-mcp init ...` subcommand (no credentials required) to `skills.ts`. Contains no tool or HTTP logic. |
| `src/credentials.ts` | Pure credential candidate state machine — types (`CandidateCredential`, `CredentialDiscoveryResult`, `AuthScheme`) and transition functions (`pickNextAttempt`, `markAttemptFailed`, `markAttemptSucceeded`, `buildAuthHeader`, `orderSchemesForCredentialStore`, `summarizeCandidates`). No I/O, no MCP, no HTTP — a pure leaf both `git-config.ts` (candidate construction) and `gitea-client.ts` (request-time iteration) depend on. |
| `src/git-config.ts` | Auto-discovery leaf module. Parses `.git/config` remotes (`parseGitRemoteUrl`, `readGitRemotes`, `selectRemote`) via file reads, resolves the instance URL (SSH remote → `https://<host>`), parses the `GITEA_REPO_URL` / `GITLAB_REPO_URL` self-contained credentialed repo URL (`parseRepoUrl` — userinfo decoded and stripped from the derived baseUrl; `stripUrlUserInfo` redacts echoed remote URLs), and builds the ordered candidate list through git's own machinery: the repo URL's userinfo (host-matched) → `[gitea "<baseUrl>"] token` / `[gitlab "<baseUrl>"] token` via `git config get --url=<baseUrl> <section>.token` → `GITEA_TOKEN` / `GITLAB_TOKEN` env → the credential git would use via `git credential fill` (config chain + credential helpers — the OS-keychain support the in-process parser never had). The secret therefore enters the process via subprocess stdout or an explicitly provided env URL, not a `node:fs` read — this removed the CodeQL `js/file-access-to-http` file-read source (issue #79). Platform knobs (config section, env vars, source tag, scheme set) are parametrized so the Gitea pipeline (`discoverConfig` / `discoverCredentialsForHost`, `token`/`basic` schemes) and the GitLab pipeline (`discoverGitLabConfig` / `discoverGitLabCredentialsForHost`, `bearer` only) share the machinery but never each other's credential sources. Each credential candidate gets its scheme order from `credentials.ts`. Exports `discoverConfig({cwd,env})` returning `CredentialDiscoveryResult` (`{baseUrl, candidates, defaultOwner?, defaultRepo?, remote?, gitAvailable?}`) or `null` when no instance can be found; `gitAvailable:false` means the git binary could not be used (env-source / anonymous fallback). Also exports the host-scoped re-discovery functions used by the `configure_gitea` / `configure_gitlab` tools, with strict `username` narrowing. No MCP/HTTP logic; file reads swallow only `ENOENT` (rethrow other errors), git subprocess non-zero exits map to "no value" (the ENOENT analogue) and spawn failures / timeouts to `gitAvailable:false`. |
| `src/server.ts` | Creates the `McpServer`, registers every tool (name + Zod schema + handler), prompt, and resource, owns the `resolve()` owner/repo fallback (backed by session-scoped mutable state), and loads the handshake `instructions` from `assets/instructions.md` (or `assets/instructions-gitlab.md` in GitLab mode). The `resolve_repo` tool delegates remote parsing to `git-config.ts` (`parseRemotes` + `selectRemote`); the `gitea_status` / `gitlab_status` tool delegates to the active client's `getCredentialStatus()`; the `configure_gitea` / `configure_gitlab` tool composes runtime configuration (calls the platform's host-scoped discovery for re-discovery, then `client.configure()`). The attachment-upload handlers read caller-supplied files through a confinement choke point (`readUploadFile`): realpath resolution inside an upload root (`process.cwd()` or `GITEA_UPLOAD_ROOT`), sensitive-location deny-list, extension allow-list, size cap, and generic path-free errors — the only non-fixed-path file reads in this file besides the fixed-path `assets/*.md` loads. Exports `createServer` and `runServer` (all parameters optional; a 5th `deps?: { discoverCredentials? }` injection point supports hermetic unit tests, a 6th `gitAvailable?: boolean` seeds the session's git-availability flag, a 7th `platform` selects the backing client, and an 8th `toolAllowlist` gates the tool surface at startup — non-whitelisted tools are `disable()`d on their `RegisteredTool` handles so the SDK hides them from `tools/list` and rejects their `tools/call`, while an entry naming no tool on the active platform aborts startup with an error). The three Gitea guide resources are registered on the Gitea platform only. |
| `src/tools.ts` | Exports one Zod schema per tool input. The set of schemas stays 1:1 with the tools registered in `server.ts` and the tool tables in `README.md`. |
| `src/gitea-client.ts` | `GiteaClient` — the REST client wrapping Gitea `/api/v1`. `baseUrl` is optional (client starts unconfigured when omitted); `configure({baseUrl?, candidates?})` replaces the connection state atomically with a full state-machine reset. `request<T>` throws `NotConfiguredError` before any fetch when unconfigured, then iterates the candidate × scheme list (delegating state transitions to `credentials.ts`). Also owns the `GiteaApiError` class (typed `status`/`body` for status-based branching without substring matching), `getCredentialStatus()` for the diagnostic tool, the shared API params/response type definitions, and all HTTP methods. Contains no MCP/stdio logic. |
| `src/gitlab-client.ts` | `GitLabClient` — the REST client wrapping GitLab `/api/v4` (issue #84), parallel to `GiteaClient`. Presents the **identical public method surface** (names, parameters, declared return types) so `server.ts` holds either client behind one union type; response bodies pass through in GitLab's native JSON shape. Projects are addressed by URL-encoded path (`owner%2Frepo`), issues/merge requests by project-scoped `iid`, milestones/pipelines by ID, releases by `tag_name`, wiki pages by slug. Operations without a GitLab counterpart fail with `GitLabUnsupportedError`; Premium/Ultimate-gated issue-link operations fail through `requestTierGated`, which converts a runtime 403 (while a credential is already active) into `GitLabTierError` instead of letting the retry loop burn a working candidate. Owns `GitLabApiError` / `GitLabNotConfiguredError` and `getCredentialStatus()`. The secret rides only in the `Authorization: Bearer` header — never a query string. Contains no MCP/stdio logic. |
| `src/skills.ts` | The `gitea-mcp init --tool <name>` implementation: carries the registry of supported target tools and, for the chosen tool, copies every bundled skill (each subdirectory of `dist/assets/skills/` containing a `SKILL.md`) into that tool's skills directory, one folder per skill. No MCP/HTTP logic; no Gitea credentials required. |
| `src/assets/**` | Markdown guidance content (instructions, resources, the action skills). Pure data, read at runtime; copied into `dist/assets/` by `scripts/copy-assets.mjs` so it ships with the published package. |

`cli.ts` is a thin shell; `git-config.ts` is a discovery leaf (file reads for
remotes + git subprocesses for secrets) that builds candidates via
`credentials.ts`; `credentials.ts` is a pure leaf
(types + transition functions, no I/O); `server.ts` is the composition root;
`tools.ts` is pure schema declarations; `gitea-client.ts` is HTTP + the
request-time candidate iteration. Mixing concerns across these files is a
deviation from the architecture.

## 4. Module Dependency Graph

Dependencies point downward (a file may only import what is below it in the
list):

```
cli.ts
  ├─► git-config.ts      (discoverConfig — resolves baseUrl/candidates/owner/repo before runServer)
  ├─► server.ts          (runServer — default MCP mode)
  └─► skills.ts          (runInitCommand — only the `gitea-mcp init` subcommand)
git-config.ts
  ├─► credentials.ts     (CandidateCredential types, orderSchemesForCredentialStore)
  ├─► node:child_process (execFile — `git config get --url=... gitea.token`,
  │    `git credential fill`; secret retrieval via git's own machinery, so the
  │    credential never passes through a `node:fs` read of a secret-bearing file)
  └─► node:fs/promises, node:path  (reads `.git`/`config` for the remote
       listing — non-secret content; env)
credentials.ts
  └─► (none — pure leaf: types + state-machine transition functions)
server.ts
  ├─► tools.ts          (Zod schemas)
  ├─► git-config.ts     (parseRemotes, selectRemote — used by the resolve_repo tool)
  ├─► gitea-client.ts   (GiteaClient)
  ├─► gitlab-client.ts  (GitLabClient — selected by the platform param)
  ├─► credentials.ts    (CandidateCredential type — the candidates param of createServer/runServer)
  ├─► @modelcontextprotocol/sdk  (McpServer, StdioServerTransport)
  └─► node:fs/promises, node:path (fixed-path `assets/*.md` loads; confined
       upload reads via readUploadFile — realpath/stat/readFile under the
       upload-root, deny-list, allow-list, and size-cap rules)
gitea-client.ts
  ├─► credentials.ts    (pickNextAttempt, markAttemptFailed/Succeeded, buildAuthHeader, summarizeCandidates)
  └─► (global fetch)
gitlab-client.ts
  ├─► credentials.ts    (same state-machine functions; candidates carry the bearer scheme)
  ├─► gitea-client.ts   (TYPE-ONLY: the shared params/response type contract, so
  │                      both clients present one identical method surface to server.ts)
  └─► (global fetch)
skills.ts
  └─► assets/skills/<action>/SKILL.md  (read bundled skills tree, copy to target tool dir)
```

Rules implied by the graph:

- `credentials.ts`, `tools.ts` are pure leaves — they import none of the other
  project files. `git-config.ts` is a discovery leaf (file reads for remotes +
  git subprocesses for secrets + env) that imports `credentials.ts` for
  candidate construction.
- `gitea-client.ts` imports `credentials.ts` (the state-machine functions) but
  no other project file — it stays pure HTTP + candidate iteration.
- `server.ts` is the composition root: the only file that imports both
  `tools.ts` and the client modules (`gitea-client.ts`, `gitlab-client.ts`),
  wiring schemas to handlers to client methods. It also reads guidance
  markdown from `assets/` and reuses `git-config.ts`'s remote parsers for
  `resolve_repo`.
- `cli.ts` depends on `server.ts`'s `runServer`, `git-config.ts`'s
  `discoverConfig` / `discoverGitLabConfig`, and (lazily, only for the `init`
  subcommand) on `skills.ts`. No file imports `cli.ts`.
- `skills.ts` is a leaf that only reads the bundled skills tree; it touches no
  MCP/HTTP logic and needs no Gitea credentials.
- There are no cycles and no hidden lateral imports (e.g. `gitea-client.ts`
  never imports `tools.ts`). The one sanctioned lateral edge is
  `gitlab-client.ts`'s **type-only** import of `gitea-client.ts`'s shared
  params/response types — both clients serve the same tool contract, and the
  types are that contract; runtime code flows strictly downward.

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

At server start, `cli.ts` runs `discoverConfig()` (`git-config.ts`) which reads
`<cwd>/.git/config`, parses every `[remote "<name>"]` URL, and selects one with
the priority **`upstream` → `origin` → first remaining**. The selected remote
contributes the default `owner` / `repo`, and its host becomes the Gitea
instance base URL (an SSH remote like `git@host:owner/repo.git` is mapped to
`https://<host>`). `GITEA_BASE_URL`, `GITEA_DEFAULT_OWNER`, and
`GITEA_DEFAULT_REPO` are **optional overrides** that win over the git-derived
values. `GITEA_REPO_URL` — one self-contained credentialed clone URL
(`https://<user>:<token>@<host>[:<port>]/<owner>/<repo>.git`, parsed by
`parseRepoUrl`) — tiers between them and the git remote: each of its parts
(baseUrl, owner, repo) applies only when the matching explicit override is
unset, and its userinfo becomes the top-priority credential candidate (§5.3).
With no git remote and neither `GITEA_BASE_URL` nor `GITEA_REPO_URL`, `cli.ts`
prints a one-line notice and starts the server in an **unconfigured** state —
business tools throw `NotConfiguredError` on invocation, while `tools/list`,
`resolve_repo`, `gitea_status`, and `configure_gitea` remain usable. The
`configure_gitea` tool enables session-scoped runtime configuration (see §5.5).

`resolve()` in `server.ts` then applies a per-call fallback so individual tool
invocations can still omit `owner` / `repo`:

```
explicit argument  ─►  session default owner/repo  ─►  throw
```

Session defaults are set at startup from env/git discovery and can be updated
at runtime by `configure_gitea`.

The `resolve_repo` tool offers an explicit re-detection path: it parses ALL
remotes (via `git-config.ts`'s `parseRemotes` + `selectRemote`) and returns
`{ baseUrl, owner, repo, remote, remote_url, remotes: { <name>: { baseUrl,
owner, repo, url } } }` so the caller can see both `upstream` and `origin` at
once. Echoed remote URLs carry no userinfo — `stripUrlUserInfo` removes any
embedded `user:token@` credentials so a credentialed remote never leaks its
secret. It throws `No parseable git remotes found in <path>` when none parse.

### 5.3 HTTP via `request<T>` and the credential state machine

All Gitea calls go through `GiteaClient.request<T>` in `gitea-client.ts`. The
credential behavior is a small state machine over a `CandidateCredential[]`
(pure transition functions live in `credentials.ts`; `request<T>` drives them):

- **Candidates** are built at startup by `discoverConfig()` (or rebuilt at runtime
  by `discoverCredentialsForHost()` when `configure_gitea` triggers re-discovery),
  in priority order: the `GITEA_REPO_URL` repo URL's userinfo (collected only
  when the URL's host matches the host being discovered for, so its secret is
  never attempted against another instance) → `[gitea "<baseUrl>"]` token (via
  `git config get --url=<baseUrl> gitea.token`, which also falls back to the
  bare `[gitea]` section natively) → `GITEA_TOKEN` env → the credential git
  itself would use for the host (`git credential fill` — config chain + every
  configured credential helper, including OS keychains; with `username`
  provided the lookup is narrowed to that identity and strictly filtered on
  the returned username). Config/env candidates carry only the `token` scheme;
  credential-store and repo-URL candidates carry both `basic` and `token`,
  ordered by a username heuristic (real username → `basic` first; convention
  username like `oauth2` → `token` first). When the git binary cannot be used,
  only the env sources (`GITEA_REPO_URL` / `GITEA_TOKEN`) remain and
  `gitea_status` reports `gitAvailable: false` as fix guidance.
  When `configure_gitea` provides new candidates, `client.configure()` replaces
  the entire list with defensive copies whose state machine is fully reset
  (all back to `pending`) — this prevents an old host's active candidate from
  sending its old token to a new host.
- **Per request**, if a candidate is already `active` its locked scheme is
  reused with no probing. Otherwise `pickNextAttempt` walks candidate × scheme
  in priority order; the chosen `{candidate, scheme}` becomes an
  `Authorization: Basic <base64(user:secret)>` or `Authorization: token <secret>`
  header (built by `buildAuthHeader`).
- **`401`/`403`** advances to the next scheme/candidate via
  `markAttemptFailed` and the request is retried. **Any 2xx** locks the winning
  combination via `markAttemptSucceeded` (prior candidates are marked
  exhausted). **Non-auth failures** (`404`, `500`, network) throw immediately
  via `GiteaApiError` and do **not** trigger a retry — only auth exhaustion does.
- On total exhaustion the last `GiteaApiError` is re-thrown (preserving the
  `Gitea API error (<status>): <body>` message format).
- Base URL is normalized (trailing slashes stripped once). Request bodies are
  JSON — except multipart uploads (issue/comment attachments), which pass a
  `FormData` so `fetch` derives the `Content-Type` (with boundary) itself;
  otherwise `Content-Type` is set only when a body is present. `204 No Content`
  resolves to `undefined`. Path segments for `owner` / `repo` are
  `encodeURIComponent`-escaped; query parameters use `URLSearchParams`.
- Secrets are never logged, interpolated into error messages, or echoed in tool
  output (see AGENTS.md §4 Secret Handling). The `gitea_status` diagnostic tool
  surfaces a redacted view via `getCredentialStatus()` → `summarizeCandidates()`
  (`secretPresent: boolean`, masked username `firstChar***`).
- **CodeQL `js/file-access-to-http` mitigation:** one designed file → HTTP
  data flow reaches the `doRequest` fetch sink, and it carries a justified
  line-scoped suppression where the taint enters the request — the rule stays
  globally enabled: the attachment-upload flow — multipart `FormData` bodies
  carry a local file's bytes, and the upload source was hardened FIRST per
  issue #76: `readUploadFile` in `server.ts` confines it (realpath upload-root
  confinement, sensitive-location deny-list, extension allow-list, size cap,
  path-free generic errors) before the bytes ever reach the client; the alert
  is dismissed once on GitHub with a recorded reason (#79), and a CI guard
  fails on any NEW open alert of this rule (`.github/workflows/codeql-guard.yml`).
  The former credential flow (alert #8) no longer exists as a file-read flow:
  since #79, credential retrieval goes through git's own machinery
  (`git config get --url=...` / `git credential fill`), so the secret enters
  via subprocess stdout, which the query's `FileSystemReadAccess` source does
  not match — no suppression needed, and the rule keeps guarding the rest of
  the codebase against genuine backdoor injection. The GitLab client
  (`gitlab-client.ts`, issue #84) has no multipart path at all — GitLab has
  no attachment API, its attachment tools fail with a typed error before any
  request, and its request bodies are always JSON — so it needs neither the
  designed flow nor a suppression.

`GiteaApiError extends Error` with typed `{status, statusText, body}` fields so
callers can branch on `err.status === 401` without substring-matching the
message (AGENTS.md §2.3 compliant).

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

**Pull request note:** a PR shares its number space with issues (PR #N == Issue
#N), so comments, labels, and milestones on a PR reuse the **issue** tools
(`list_comments`, `add_issue_labels`, …) — they are NOT re-implemented for PRs.
Only PR-specific operations (create/update/merge, list commits/files, merge-check)
get their own schemas, client methods, tool registrations, and README rows.

### 5.5 Guidance Layer (instructions / prompts / resources / skill)

Beyond tools, the server ships usage guidance through four channels, authored as
markdown under `src/assets/` (copied into `dist/assets/` at build time):

| Channel | Where | Loaded | Audience |
|---------|-------|--------|----------|
| `instructions` | `assets/instructions.md`, read in `createServer` and passed to `McpServer({ … }, { instructions })` | MCP handshake (`InitializeResult`) | all clients that read it |
| tool `description` | inline in `server.ts` `registerTool` | `tools/list` | all clients |
| prompts | `server.ts` `registerPrompt` (body is an inline template) | `prompts/get` | clients that surface prompts |
| resources | `server.ts` `registerResource`, reads `assets/resources/*.md` | `resources/read` | clients that surface resources |
| action skills | `assets/skills/<action>/SKILL.md` (one per workflow) | `gitea-mcp init --tool <name>` copies each to the target tool's skills dir, one folder per skill | opencode + other tools (via `--tool`) |

Coordination rule (parallel to §5.4): guidance is a coordinated change across
`server.ts` (the registration / load site) + the matching `assets/*.md` (the content)
+ `README.md` / `README.zh-CN.md` (the user-facing description). Descriptions,
prompts, resources, the instructions digest, and the action skills MUST stay consistent
with the actual tool behavior. The pull-request guidance mirrors the issue guidance
symmetrically: for every PR tool group there is a matching action skill
(`gitea-find-pulls`, `gitea-create-pull`, `gitea-update-pull`, `gitea-merge-pull`,
`gitea-summarize-pull`), a prompt (`triage_pull_requests`, `summarize_pull_request`),
and a tool-cookbook / field-reference / instructions entry. The Actions guidance
follows the same pattern for workflow-run maintenance: skills
(`gitea-find-actions`, `gitea-cancel-action`, `gitea-rerun-action`) and a prompt
(`triage_action_runs`) cover the list/get/cancel/rerun tool group, with cancel and
rerun skills enforcing a pre-check (status verification) + user-confirmation flow
mirroring the merge-pull safety pattern. The Wiki tool group
(`list/get/create/update/delete_wiki_page`, `list_wiki_revisions`) pairs with the
`gitea-write-wiki` skill, which bundles `format-guide.md` — the OSS wiki format
spec (page model, naming, Markdown style, templates) — and is referenced from the
handshake instructions and the tool cookbook.

### 5.6 Platform selection and the GitLab client (issue #84)

One server process serves one platform. `createServer` / `runServer` take a
trailing `platform` parameter (`"gitea" | "gitlab"`, default `"gitea"`), and
`cli.ts` resolves it via `resolvePlatform(process.env)`:

1. `MCP_PLATFORM=gitlab` (or `gitea`) wins; an invalid value exits `1`;
2. otherwise GitLab is auto-selected when any of `GITLAB_BASE_URL`,
   `GITLAB_TOKEN`, or `GITLAB_REPO_URL` is set and no `GITEA_*` connection
   variable is;
3. the default remains `gitea`, so existing configurations are unchanged.

Consequences of the one-platform-per-process rule:

- The 68 shared business tools keep their names; `server.ts` types the client
  as `GiteaClient | GitLabClient` and calls the identical method surface.
- The diagnostic pair is per-platform: `configure_gitea` + `gitea_status`
 (Gitea) vs `configure_gitlab` + `gitlab_status` (GitLab); the Gitea pair's
 names, descriptions, and messages are byte-identical to the pre-#84 text.
- `resolve()`'s error guidance names the platform's env vars and configure
  tool (Gitea wording is unchanged).
- The three guide resources document Gitea object shapes and are registered
  on the Gitea platform only; GitLab mode loads
  `assets/instructions-gitlab.md` as the handshake instructions.

`GitLabClient` (in `gitlab-client.ts`) mirrors the `GiteaClient` request core:
the same candidate × scheme retry loop over `401`/`403`, atomic
`configure()` with a full state-machine reset, and redacted
`getCredentialStatus()`. Platform differences:

- **API root & auth**: `/api/v4`; candidates carry the `bearer` scheme —
  the secret rides only in `Authorization: Bearer <token>` (never
  `?private_token=`, never a `node:fs` read).
- **Addressing**: projects by URL-encoded path (`owner%2Frepo`); issues/MRs
  by project-scoped `iid`; milestones/pipelines by ID; releases by
  `tag_name`; wiki pages by URL-encoded slug. Issue labels arrive as
  comma-separated NAMES, so Gitea-style label IDs are resolved through the
  labels API, and assignee usernames through the project members API.
- **Typed failures**: `GitLabApiError` (status/body), `GitLabTierError` for
  Premium/Ultimate-gated issue links, `GitLabUnsupportedError` for missing
  counterparts (attachments, global-ID note edits, ID-addressed releases,
  failed-jobs-only rerun, wiki revisions, rebase merge strategies, and
  parameter-level gaps such as `website`/`private` on `update_repo`).
- **Tier gating**: `requestTierGated` converts a runtime `403` on
  issue-links endpoints into `GitLabTierError` only when a credential is
  already active — auth probing (no active candidate yet) keeps the plain
  retry semantics, so a bad token is never misread as a tier limit.

## 6. Environment Contract

| Variable | Required | Consumer | Purpose |
|----------|:--------:|----------|---------|
| `GITEA_BASE_URL` | No | `cli.ts` → `GiteaClient` | Gitea instance origin (e.g. `https://gitea.example.com`). When unset, auto-detected from the selected git remote's host. |
| `GITEA_TOKEN` | No | `cli.ts` → `GiteaClient` | API access token. One of several auth candidates, tried after the `GITEA_REPO_URL` userinfo and a `.git/config [gitea]` token, and before git's credential machinery; always sent as `Authorization: token`. When git is unavailable the env sources are the only candidates. If no candidate resolves, the server starts anonymously and write calls fail `401/403` — the `gitea_status` tool and `gitea-configure` skill guide the user to add one. |
| `GITEA_REPO_URL` | No | `cli.ts` → `git-config.ts` (`parseRepoUrl`) → `GiteaClient` | One self-contained credentialed clone URL (`https://<user>:<token>@<host>[:<port>]/<owner>/<repo>.git`). Supplies baseUrl, default owner/repo, and the top-priority credential candidate; each part sits below the matching scalar override and above the git remote. Parsed in-memory (works with `gitAvailable: false`); the userinfo is stripped from the derived baseUrl, and the raw URL is never echoed (`resolve_repo` strips userinfo too). A malformed value is ignored, not fatal. |
| `GITEA_DEFAULT_OWNER` | No | `cli.ts` → `server.resolve` | Default repository owner so `owner` can be omitted per call; defaults to the selected remote's owner. |
| `GITEA_DEFAULT_REPO` | No | `cli.ts` → `server.resolve` | Default repository name so `repo` can be omitted per call; defaults to the selected remote's repo. |
| `GITEA_UPLOAD_ROOT` | No | `server.ts` (`readUploadFile`) | Root directory attachment uploads may read from. Defaults to the server's working directory; the realpath-resolved `file_path` must stay inside this root. |
| `MCP_PLATFORM` | No | `cli.ts` (`resolvePlatform`) | Platform selection: `gitea` (default) or `gitlab`. Wins over the `GITLAB_*`-presence auto-detection; an invalid value exits `1`. |
| `MCP_TOOL_ALLOWLIST` | No | `cli.ts` (`resolveToolAllowlist`) → `server.ts` (registration gate) | Startup tool allowlist: comma-separated `snake_case` tool names (trimmed, matched exactly against the registered names of the active platform). Unset or empty keeps every tool available; a non-whitelisted tool disappears from `tools/list` and its `tools/call` returns a tool-level error without executing; an entry naming no tool on the active platform exits `1`. |
| `GITLAB_BASE_URL` | No | `cli.ts` → `GitLabClient` | GitLab instance origin (e.g. `https://gitlab.example.com`). When unset, auto-detected from the selected git remote's host. Its presence (without a `GITEA_*` connection variable) selects GitLab mode. |
| `GITLAB_TOKEN` | No | `cli.ts` → `GitLabClient` | GitLab API access token. Tried after the `GITLAB_REPO_URL` userinfo and a `.git/config [gitlab]` token, and before git's credential machinery; always sent as `Authorization: Bearer`. When git is unavailable the env sources are the only candidates. |
| `GITLAB_REPO_URL` | No | `cli.ts` → `git-config.ts` (`parseRepoUrl`) → `GitLabClient` | GitLab counterpart of `GITEA_REPO_URL`; its candidate is `Bearer`-only. Its presence (without a `GITEA_*` connection variable) selects GitLab mode. |
| `GITLAB_DEFAULT_OWNER` | No | `cli.ts` → `server.resolve` | Default project owner (GitLab mode) so `owner` can be omitted per call; defaults to the selected remote's owner. |
| `GITLAB_DEFAULT_REPO` | No | `cli.ts` → `server.resolve` | Default project name (GitLab mode) so `repo` can be omitted per call; defaults to the selected remote's repo. |
| `NPM_TOKEN` | No (publish only) | `make publish` | npm publish token; never read at runtime |

All six `GITEA_*` variables are optional overrides; none is validated as
required. `cli.ts` calls `discoverConfig()` (`git-config.ts`) to resolve the
instance URL, build the credential candidate list from the selected git remote
plus git's own credential machinery (and the env vars), and derive default
owner/repo. Credential discovery needs the `git` binary at runtime (git ≥ 2.46
for `git config get`); when git cannot be used, discovery degrades to the
env-only sources (`GITEA_REPO_URL` / `GITEA_TOKEN`) / anonymous mode and
`gitea_status` reports
`gitAvailable: false`. When no instance can be resolved (no git remote and
neither `GITEA_BASE_URL` nor `GITEA_REPO_URL`), `cli.ts` prints a one-line
notice to stderr and starts the
server in an **unconfigured** state — business tools throw `NotConfiguredError`,
while `tools/list`, `resolve_repo`, `gitea_status`, and `configure_gitea` remain
usable so the connection can be established at runtime without restarting.
`MCP_TOOL_ALLOWLIST` interacts with that guidance: when an allowlist trims the
`configure_*` / `*_status` pair, the startup notice and the `resolve()`
guidance still name those tools, but they are no longer callable — a
deployment that needs runtime configuration must list them explicitly.
The GitLab mode applies the same contract with the `GITLAB_*` names
(`discoverGitLabConfig()`, unconfigured guidance naming `GITLAB_BASE_URL` and
`configure_gitlab`); `MCP_PLATFORM` selects between them (see §5.6).

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
- `make scan` runs `gitleaks detect` against the working tree (config in
  `.gitleaks.toml`, report written to `.dist/leaks.json`); it is the FIRST step
  of `make verify` so a leaked secret fails the CI build before any other check.
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
