---
name: gitea-create-issue
description: Invoke to CREATE / FILE / OPEN a new Gitea issue. The flow checks for an existing duplicate first, then creates. Do NOT invoke to edit/close (gitea-update-issue), delete (no skill — destructive), read/find (gitea-find-issues), or attach labels (gitea-label-issue).
---

# gitea-create-issue

Open one new issue after ruling out a duplicate. Tools: `search_issues`, `create_issue`.

## Prerequisites
- Resolve `owner`+`repo`: pass explicitly, else `GITEA_DEFAULT_OWNER`/`GITEA_DEFAULT_REPO`, else `resolve_repo` (gitea-resolve-repo). Never guess — wrong values create the issue in the wrong repo.

## Flow
1. DUPLICATE CHECK (always first): `search_issues({ query: "<title keywords>", type: "issues" })`. If a match exists, comment on it (gitea-summarize-issue, then `create_comment`) instead of creating a duplicate. Do NOT skip this — creation does not de-duplicate.
2. CREATE: `create_issue({ title, body?, assignees? })`.

## create_issue
- RULES: `title` required; `body` is Markdown. Use `assignees` (array); do NOT also set the deprecated single `assignee`.
- Do NOT pass `labels` or `milestone` here: `labels` expect IDs (error-prone) and milestone needs an id. Create WITHOUT them, then attach labels by name via `add_issue_labels` (gitea-label-issue) and set the milestone via `update_issue` (gitea-update-issue).
- CHECK FIRST: confirm no duplicate (step 1) and that `owner`/`repo` are correct before writing.
- CHECK AFTER: the returned object's `number` is the new issue index.
