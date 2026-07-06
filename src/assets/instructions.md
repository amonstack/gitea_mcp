# Gitea MCP — usage strategy

You manage Gitea issues, comments, labels, and milestones through this MCP server.
Every tool returns Gitea's JSON verbatim as text. Follow these rules to use them
correctly.

## Config is auto-discovered from git (env vars optional)

On start the server reads `<cwd>/.git/config` and derives `baseUrl`, `owner`, `repo`,
and `token` so one global install can serve many projects. The `GITEA_BASE_URL` /
`GITEA_TOKEN` / `GITEA_DEFAULT_OWNER` / `GITEA_DEFAULT_REPO` env vars are OPTIONAL
overrides; when set they take precedence over git discovery. The remote is chosen
`upstream` first, then `origin`. If the cwd has no git remote and `GITEA_BASE_URL` is
unset, the server does not start (it prints a skip reason and exits 0). If you hit a
401/403 or the connection looks unset, use the **gitea-configure** skill.

## Resolve owner/repo FIRST (most common failure)

Most tools target one repository and need both `owner` and `repo`. They resolve in
this order:

1. The `owner` / `repo` arguments you pass to the call.
2. `GITEA_DEFAULT_OWNER` / `GITEA_DEFAULT_REPO` env vars (or the git-discovered defaults
   captured at server start).
3. The `resolve_repo` tool (re-reads `.git/config` and returns `baseUrl`, `owner`, `repo`,
   the selected `remote`, and every parsed remote under `remotes`).

If none resolve, the call errors. Before a batch of work on a repo you have not used this
session, call `resolve_repo` once and reuse the result — do not guess.

## Labels: IDs vs names (critical gotcha)

Label endpoints are NOT consistent — mixing them up silently fails or hits the wrong label:

- `add_issue_labels`, `replace_issue_labels` → take label **names** (`string[]`).
- `remove_issue_label` → takes a label **ID** (`number`). You must `list_labels` first to get IDs.
- `create_issue` / `update_issue` `labels` field → takes label **IDs** (`number[]`).

Always `list_labels` before any label mutation so you use the right identifier, and
prefer `replace_issue_labels` (name-based) when you want a known final set.

## Comments use comment IDs, not issue numbers

`update_comment` and `delete_comment` take the comment `id`, NOT the issue `index`.
`list_comments` returns each comment's `id`. Never reuse an issue number where a
comment id is required.

## Pagination

List endpoints are 1-based: `page` starts at 1, `limit` max 100. To fetch everything,
page forward until a page returns fewer than `limit` items (or an empty page). Do not
assume one page is complete.

## Destructive operations — confirm before running

These are irreversible on most Gitea instances (no trash/recycle):

- `delete_issue`, `delete_label`, `delete_milestone`, `delete_comment`
- `clear_issue_labels`, `replace_issue_labels` (replaces the ENTIRE label set)

Confirm the target id/index and scope with the user before calling. For labels,
`replace_issue_labels` overwrites — read current labels first if any must survive.

## Search vs list

- `list_issues` — one repo, paginated, filterable by state/labels.
- `search_issues` — across ALL repos the token can see, by keyword/type/state. Use it
  for "find issues about X" or duplicate detection, not for listing one repo.

## Error format

Failed calls throw `Gitea API error (<status>): <body>`. Read the status: 401/403 →
token missing, wrong, or lacks scope — run the **gitea-configure** skill to fix the
connection; 404 → wrong owner/repo or no permission; 409 → conflict; 422 → validation.
Do not retry blindly on 4xx.
