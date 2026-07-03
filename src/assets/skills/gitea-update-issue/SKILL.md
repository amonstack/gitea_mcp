---
name: gitea-update-issue
description: Invoke to EDIT fields, CLOSE, REOPEN, or CLEAR assignee/milestone on ONE existing Gitea issue. Do NOT invoke to create (gitea-create-issue), delete (destructive — no skill), find/read (gitea-find-issues), or change a single label (gitea-label-issue).
---

# gitea-update-issue

Edit one issue's fields or change its state. Tools: `get_issue`, `update_issue`.

## Prerequisites
- Resolve `owner`+`repo`: pass explicitly, else `GITEA_DEFAULT_OWNER`/`GITEA_DEFAULT_REPO`, else `resolve_repo` (gitea-resolve-repo).
- There is NO optimistic locking — always read current state first.

## Flow
1. READ CURRENT: `get_issue({ index })` — `index` = issue `number` (URL #N → N), never the internal `id`.
2. APPLY: `update_issue({ index, ...changedFields })`.

## update_issue
- RULES: PATCH — only fields you pass change; omit = unchanged. To CLEAR a field pass its EMPTY form, do NOT omit it: `milestone: 0` clears the milestone, `assignees: []` clears assignees. Use `assignees` (array), not the deprecated `assignee`. State values are `open` | `closed`.
- NOT FOR single-label changes: `labels` here are IDs and REPLACE the entire set — to add/remove one label use `add_issue_labels` / `remove_issue_label` (gitea-label-issue).
- CHECK FIRST: `get_issue` for current values if state may have changed since your last read; state the intended change to the user before writing.
