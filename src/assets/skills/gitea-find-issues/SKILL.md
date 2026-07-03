---
name: gitea-find-issues
description: Invoke to DISCOVER or READ Gitea issues — listing one repo's issues, cross-repo keyword search, reading a single issue, or triage. Do NOT invoke to create/edit/close/delete (gitea-create-issue / gitea-update-issue), to manage labels (gitea-label-issue), or to read the comment discussion (gitea-summarize-issue).
---

# gitea-find-issues

Read-only issue discovery. Tools: `list_issues`, `search_issues`, `get_issue`.

## Prerequisites
- Resolve `owner`+`repo` for `list_issues`/`get_issue`: pass explicitly, else `GITEA_DEFAULT_OWNER`/`GITEA_DEFAULT_REPO`, else `resolve_repo` (gitea-resolve-repo). Never guess — wrong values 404 or silently target the wrong repo.
- Paginate 1-based, `limit` ≤ 100. A page is final ONLY when it returns fewer than `limit` items. Always set `limit` (default page size is server-controlled).

## Choose the tool
- ONE repo's issues, filtered by state/labels → `list_issues`.
- ACROSS repos by keyword, or duplicate check → `search_issues` (global; no owner/repo).
- ONE issue's full detail → `get_issue`.

## list_issues
- RULES: `labels` = comma-separated NAMES, AND-matched; a mistyped or non-existent name returns EMPTY with no error. Results include pull requests (no `type` filter here); identify a PR by a non-null `pull_request` field in the JSON.
- CHECK FIRST: confirm label names via `list_labels` (gitea-manage-labels) before filtering.
- CHECK AFTER: if `length === limit`, fetch the next page before treating the list as complete.

## search_issues
- RULES: GLOBAL — no owner/repo; each result carries its own `repository`. Returns issues AND PRs by default; set `type: "issues"` to exclude PRs (`type: "pulls"` for PRs only). `labels` = names. `query` matches title + body.
- CHECK FIRST: set `type` deliberately.
- CHECK AFTER: page fully if completeness matters.

## get_issue
- RULES: pass `index` = the issue `number` (URL #42 → 42), never the internal `id`.
- NOTE: the `comments` field is a COUNT only — to read the discussion use `list_comments` (gitea-summarize-issue).
