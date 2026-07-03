# AGENTS.md

Uppercase MUST, MUST NOT, and MAY are binding directives; lowercase forms are ordinary words (RFC 2119/8174 convention). FIRST and EXACTLY denote strict precedence and exactness.

This file constrains AI design and development **process, rules, and boundaries only**; it contains no project description. Project capabilities, deployment, and the MCP client setup guide live in `README.md` / `README.zh-CN.md`; the concrete architecture (tech stack, module layout, dependency relationships, core patterns) lives in `docs/architecture.md` (see §5 Appendix).

## 1. Agent Guidelines

This section defines how the agent operates on this repository — the workflow to follow and the rules that bind edits and commits.

### 1.1 Before Running Any Command

- MUST verify the target file or directory exists before operating on it.
- MUST NOT assume `make`, `npm run`, or other scripts work until the corresponding target exists; check the `Makefile` and `package.json` scripts before invoking.
- The project is an installed ESM workspace — `node_modules/` already holds dependencies. Prefer existing tooling over installing new tooling.

### 1.2 Branch and Worktree Workflow

This project uses a two-remote model: `origin` is the personal fork (`ake131998/gitea_mcp`) and `upstream` is the canonical repo (`amonstack/gitea_mcp`). Each change MUST follow an isolated branch + worktree workflow:

- MUST NOT edit, stage, commit, merge, rebase, or cherry-pick on `master` / `main`. The local `master` is a **read-only integration branch** that mirrors `upstream` and is synchronized **only** from `upstream`; the sole permitted advance is `git fetch upstream && git merge --ff-only upstream/master`. No branch — feature, fix, the working branch, or any `origin/*` ref — is ever merged into `master`; `master` is never the merge target, only the fast-forward target from `upstream`. It MUST stay free of direct work — not "just this once", not even for a one-line fix.
- **`master` accepts no merges.** A branch reaches `master` exclusively through the upstream round-trip: squash to one commit → push to `origin` → PR against `upstream` `master` → upstream merges → local `master` fast-forwards from `upstream`. Assembling `master` by merging local or `origin` branches is forbidden.
- Before the first edit of any task, MUST verify the current branch with `git branch --show-current`; if it is `master` / `main`, MUST stop and switch to a feature branch (or a worktree) FIRST, then begin.
- Branch from the latest `master` as `<type>/<name>` (`feat/...`, `fix/...`, `chore/...`, `docs/...`, `refactor/...`, `test/...`) + short kebab-case name (e.g. `feat/user-issues`).
- Work in an isolated git worktree at `.opencode/worktrees/<name>`, not in the primary checkout; the primary checkout MUST stay clean.
- Before committing, show the full diff and wait for explicit approval; commit only after approval (per 1.6).
- When shipping: squash the branch to a single clean commit, push to `origin` (the fork), and open a PR against `upstream` `master`. Pushing to `origin` and opening a PR are both user-gated — do neither unless explicitly requested.
- After the PR merges: fetch `upstream`, advance local `master` with `git merge --ff-only upstream/master`, remove the worktree, and delete the branch.

Violation Signals (each pattern below indicates a breach of the rules above):

- A `git merge <branch>` (feature, fix, the working branch, or `origin/*`) targeting `master` / `main`.
- Local `master` advanced by anything other than `git merge --ff-only upstream/master` (a direct commit, a non-fast-forward merge, a rebase, or a reset to a local or `origin` branch).
- A commit on `master` whose source is not `upstream/master`.

### 1.3 Implementation

- Follow existing patterns in `src/`; where none exist, apply Sections 2 through 4.
- Treat `README.md` conventions (tool inventory, env vars) and `docs/architecture.md` (module layout, dependency graph, core patterns) as the design target. Where the architecture blueprint and this file appear to conflict, AGENTS.md governs and `docs/architecture.md` MUST be reconciled to it.

### 1.4 Verification

- After every TypeScript change, run the checks in order and they MUST pass: `make lint` FIRST, then `make build`, then `make test` per §3, then a runtime smoke run of the built `dist/`.
- **`make lint` MUST be a real emit, never `--noEmit`.** `tsc --noEmit` is forbidden for verification because it silently masks declaration-emit errors (e.g. TS4023/TS4058 private-type leakage through public APIs), emit-stage config problems (outDir/declarationDir legality, source-map paths), and JS-output issues. `make lint` runs `tsc -p tsconfig.json`, which emits declarations + JS to the gitignored throwaway `.dist/typecheck/`; this surfaces every error `--noEmit` would hide.
- **`make lint` MUST cover tests.** `tsconfig.json` includes all of `src/` (including `src/__tests__`) with `types: ["node"]`. Excluding tests from lint — or any other trick that makes a check skip the affected files — is a bypass, not a pass, and is forbidden.
- `make build` = `tsc -p tsconfig.build.json` (emits non-test `src/` → `dist/`, with declarations + source maps) then `npm run build:assets` (`scripts/copy-assets.mjs` copies `src/assets/**` → `dist/assets/**`).
- `make test` runs unit tests via `vitest run`; a runtime smoke run of the built `dist/` (e.g. `node dist/cli.js init --tool opencode --dir <tmp>` and constructing the server from `dist/server.js`) covers the runtime/type-decoupling and module-resolution classes that neither emit nor `--noEmit` can catch.
- `make test-integration` exercises a live Gitea instance (`GITEA_BASE_URL` / `GITEA_TOKEN`) and is non-blocking for routine changes; run it only when a change touches `gitea-client.ts` HTTP behavior and an instance is available.
- If a check is unavailable or cannot run, state this explicitly rather than claiming success; never report a task complete without the required checks passing.
- Build output and packaging artifacts MUST reside under the gitignored trees: compiled JS in `dist/`, release tarballs in `.dist/releases/`, verification emit in `.dist/typecheck/`. Neither `dist/` nor `.dist/` MUST be committed (both are in `.gitignore`).
- Only `dist/` is published to npm (`"files": ["dist"]`); `src/`, config, and tests are excluded via `.npmignore`.

### 1.5 Edits

- MUST NOT hand-edit generated output under `dist/`; change `src/` and re-run `make build`.
- MUST NOT introduce tools, libraries, or patterns outside Sections 2 through 4 without updating this file.
- MUST NOT modify `README.md` / `README.zh-CN.md` to match a code deviation; the documented tool inventory and env contract are the baseline and deviations MUST be reconciled back to them.
- MUST NOT modify `docs/architecture.md` to match a code deviation; the architecture is the baseline and deviations MUST be reconciled back to it.

### 1.6 Commits & Pull Requests

Commits:

- MUST NOT commit secrets, keys, tokens, or credentials (per §4 Secret Handling).
- MUST NOT commit unless explicitly instructed.
- Before committing, MUST verify staged files via `git status` and `git diff` against the intended change set.
- MUST NOT commit `package-lock.json` drift unrelated to the change.
- Commit messages follow Conventional Commits (`feat:` / `fix:` / `chore:` / `docs:` / `refactor:` / `test:`); subject line imperative mood, lowercase, ≤72 characters.

Pull Requests:

- A PR to `upstream` `master` is opened only when the user explicitly requests it (per §1.2).
- **Title**: `<type>: <summary>` — `type` is a Conventional Commits prefix (`feat` / `fix` / `chore` / `docs` / `refactor` / `test`); `summary` is imperative mood and ≤72 characters total; capitalize the first word and any proper nouns (e.g. `Gitea`, `API`, `MCP`) when the text contains Latin letters. Examples: `feat: Add Gitea milestone search`, `fix: Prevent token leak in API error messages`.
- **Body**: organize the description by Conventional Commits category; summarize the change as a capability or functional outcome (what users gain or what is fixed), not the code mechanics; write in a friendly, personified tone.

## 2. TypeScript Development Constraints

This section defines the invariants for the TypeScript code — the static structure, module system, and coding rules the agent MUST honor. The concrete tech stack, module layout, dependency graph, and core patterns for this project are specified in `docs/architecture.md` (§5.2); where a rule here and the blueprint appear to conflict, AGENTS.md governs and the blueprint MUST be reconciled to it.

### 2.1 Naming

- **Files**: kebab-case (`gitea-client.ts`); unit tests `*.test.ts`, integration tests `*.integration.test.ts` under `src/__tests__/`.
- **Classes**: PascalCase (`GiteaClient`).
- **Interfaces / types**: PascalCase (`Issue`, `Label`, `GiteaConfig`); parameter-bag interfaces named `<Action>Params` (`CreateIssueParams`, `UpdateIssueParams`).
- **Zod schemas**: PascalCase `<Verb><Resource>Schema` (`ListIssuesSchema`, `GetIssueSchema`) — one exported schema per registered tool.
- **Functions**: camelCase (`runServer`, `createServer`, `parseGitRemoteUrl`).
- **Tool names** registered with the MCP server: snake_case (`list_issues`, `create_comment`), matching the public contract in `README.md`.

### 2.2 Module System

- The project is ESM: `"type": "module"`, `"module": "Node16"`. Relative imports MUST use the `.js` extension even for `.ts` sources (e.g. `import { GiteaClient } from "./gitea-client.js"`).
- MUST import `McpServer` from `@modelcontextprotocol/sdk/server/mcp.js` and `StdioServerTransport` from `@modelcontextprotocol/sdk/server/stdio.js` — the barrel re-export does NOT include `McpServer`.
- MUST use the global `fetch` (Node ≥ 18); MUST NOT add `axios`, `node-fetch`, or other HTTP clients.
- Node built-ins are imported with the `node:` prefix (`node:fs/promises`, `node:path`, `node:module`).
- `package.json` is the single source of dependency truth; after adding or removing a dependency MUST run `npm install` so `package-lock.json` stays in sync.

Violation Signals (each pattern below indicates a breach of the rules above):

- A relative import omitting the `.js` extension, or `McpServer` imported from the SDK barrel.
- A third-party HTTP or runtime dependency added to `package.json` that duplicates a built-in capability.

### 2.3 Error Handling

- Errors MUST be thrown as `Error` objects carrying context; the `GiteaClient.request` failure message MUST include the HTTP status and the response body (`Gitea API error (<status>): <body>`).
- Errors MUST NOT be swallowed silently; the CLI entry (`cli.ts`) attaches a top-level `.catch` that logs and exits non-zero, and missing required env vars MUST exit `1` with a clear message.
- MUST NOT branch control flow on a substring of an error message.

Violation Signals (each pattern below indicates a breach of the rules above):

- A `.catch(() => {})` or empty `try/catch` that discards an error.
- A control-flow decision based on string-matching an error message.

### 2.4 Toolchain and Dependencies

- Runtime: Node ≥ 18 (global `fetch`). TypeScript `target: ES2022`, `strict: true`; `declaration` and `sourceMap` are emitted.
- Build is plain `tsc` (no bundler); the published package ships only the compiled `dist/`.
- Key dependencies: `@modelcontextprotocol/sdk` (server + stdio transport), `zod` (tool input schemas). Dev: `tsx` (dev runner), `vitest` (test runner), `typescript`.

### 2.5 Code Placement

- New code MUST be placed in the source file whose responsibility matches the layout in `docs/architecture.md` §3. Each file has a fixed role; mixing concerns across them is a deviation.
- `src/cli.ts` holds only the process entry, env wiring, and CLI subcommand dispatch (`gitea-mcp init ...`); `src/server.ts` holds only MCP composition and tool/prompt/resource registration; `src/tools.ts` holds only Zod schemas; `src/gitea-client.ts` holds only the REST client; `src/skills.ts` holds only the skill install logic behind the `gitea-mcp init --tool <name>` command (ships the bundled action skills and copies each into the target tool's skills directory, one folder per skill; carries the registry of supported tools).
- Adding a new tool is a coordinated change in four places: a schema in `tools.ts`, a `GiteaClient` method (if it calls the API) in `gitea-client.ts`, a `registerTool` call in `server.ts`, and a row in the `README.md` / `README.zh-CN.md` tool tables — they MUST stay in sync (see `docs/architecture.md` §5.4).

## 3. Testing

This section governs the test contract for AI-implemented code. Because human review of large AI-generated diffs is impractical, tests are the primary guarantee of reliability.

- Every change that adds or modifies a tool, schema, or client method MUST ship unit tests before the task is considered complete, covering behavior, error branches, and edge cases.
- Per task, the agent MUST run and pass `make test` for the affected code.
- Existing tests MUST remain green. Deleting or weakening an existing test to make a change pass is forbidden — a failing existing test signals a regression (or a deliberate contract change that MUST be justified).
- Unit tests MUST be deterministic and hermetic — no reliance on external network, wall-clock time, or shared mutable state. HTTP behavior in `gitea-client.ts` MUST be tested by stubbing `global.fetch`, never by hitting a live instance.
- Integration tests (`*.integration.test.ts`, run via `make test-integration`) MAY call a real Gitea instance but MUST be opt-in and MUST clean up any resources they create.
- Coverage is a floor, not a proof of correctness: tests MUST assert observable behavior. Assertionless tests that merely execute lines are defects.

Violation Signals (each pattern below indicates a breach of the rules above):

- A tool/schema/client change marked complete with no new tests.
- An existing test deleted or weakened to make a change pass.
- A unit test that makes a real network call, or a test that executes code without asserting observable behavior.

## 4. Secret Handling & Redaction

- MUST NOT commit secrets, credentials, API keys, tokens, or private data to the repository.
- MUST NOT hardcode secrets in source code or config; secrets MUST be read from the environment (`GITEA_TOKEN`, `NPM_TOKEN`) and MUST stay outside version control (respect `.gitignore`).
- The Gitea token is sent ONLY as an `Authorization: token <token>` header inside `GiteaClient.request`; it MUST NOT be logged, interpolated into error messages returned to the MCP client, or echoed in tool output.
- If a committed secret is discovered, treat it as exposed and rotate it; do not merely delete the line.

Violation Signals (each pattern below indicates a breach of the rules above):

- Plaintext tokens appearing in logs, thrown errors, or MCP tool `content` responses.
- String interpolation or formatting that includes the `GITEA_TOKEN` / `NPM_TOKEN` value.

## 5. Appendix: Document Index

This index points to authoritative documents that live outside AGENTS.md. It records their location so they are discoverable; the documents themselves carry their own content.

### 5.1 README.md / README.zh-CN.md

- `README.md` (and its Chinese mirror `README.zh-CN.md`) is the project's capability, installation, and deployment description — what the server does, how to install and run it, and how to wire it into MCP clients (Claude Desktop, opencode, etc.).
- The first reader of `README.md` is a **user** (an operator or developer who wants to run `gitea-mcp` and call its tools), not a contributor reading the source. It MUST be written from the user's perspective.
- The **Available Tools** tables in `README.md` are the public tool contract; they MUST stay in sync with `server.ts` registrations and `tools.ts` schemas (see §2.5). Editing a tool's parameters requires updating the corresponding schema, handler, and README row together.
- Internal architecture details (module layout, dependency graph, core patterns, the guide to adding a tool) belong in `docs/architecture.md`, not in `README.md`. `README.md` MAY link to it.
- The tone MUST be professional but approachable — plain language, short sentences, no jargon without context.

### 5.2 docs/architecture.md

- `docs/architecture.md` is the project's concrete architecture blueprint — the specific tech stack, module layout, dependency relationships, and core patterns selected for the project.
- It is the baseline that keeps the project's architecture stable and consistent across iterations; it is maintained alongside the codebase and updated as decisions evolve.
- It describes the project itself (not AI working boundaries). This file, AGENTS.md, remains the authority on how the AI operates within the repo; where the two appear to conflict, AGENTS.md governs and `docs/architecture.md` MUST be reconciled to it.

### 5.3 Makefile / package.json

- `Makefile` is the task entry point (`make lint|build|build-assets|assets|test|test-integration|smoke|dev|package|publish|clean|verify`); it MUST delegate to the `package.json` scripts rather than reimplementing commands.
- `package.json` scripts are the canonical command definitions; `Makefile` targets are thin wrappers. When adding a script, add the matching `make` target.
- `make publish` requires `NPM_TOKEN` and publishes `@amonstack/gitea-mcp` with `--access public`; it MUST NOT be run without explicit user instruction.
