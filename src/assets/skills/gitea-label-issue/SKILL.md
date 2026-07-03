---
name: gitea-label-issue
description: Invoke to ATTACH labels to ONE Gitea issue — add, replace, remove one, or clear all. Covers the label name-vs-id pitfall. Do NOT invoke to create/edit/delete the repo's label definitions (gitea-manage-labels) or to create/edit the issue (gitea-create-issue / gitea-update-issue).
---

# gitea-label-issue

Manage the labels ON one issue. Tools: `list_labels`, `add_issue_labels`, `replace_issue_labels`, `remove_issue_label`, `clear_issue_labels`.

## Prerequisites
- Resolve `owner`+`repo`: pass explicitly, else `GITEA_DEFAULT_OWNER`/`GITEA_DEFAULT_REPO`, else `resolve_repo` (gitea-resolve-repo).

## CRITICAL — name vs id (the endpoints are inconsistent)
- BY NAME (string[]): `add_issue_labels`, `replace_issue_labels`.
- BY ID (number): `remove_issue_label` (param `id`).
Resolve names→ids via `list_labels` when you need an id.

## Choose the tool
- ADD labels (keep existing) → `add_issue_labels({ index, labels: [names] })`.
- SET the exact label set (overwrites all) → `replace_issue_labels({ index, labels: [names] })`.
- REMOVE ONE label → `remove_issue_label({ index, id })` (id, not name).
- REMOVE ALL → `clear_issue_labels({ index })`.

## Rules
- `index` = issue `number` (URL #N → N).
- Adding a non-existent NAME → 404. Confirm names via `list_labels` first.
- Scoped/exclusive labels (`scope/name`) are mutually exclusive within a scope — adding one may replace another in the same scope.
- CHECK FIRST: for `replace`, `get_issue` (gitea-find-issues) to see current labels so you don't drop one unintentionally; for `remove`, `list_labels` to resolve the id.
