---
name: gitea-create-issue
description: Invoke to CREATE / FILE / OPEN a new Gitea issue. The flow checks for an existing duplicate first, then creates. Do NOT invoke to edit/close (gitea-update-issue), delete (no skill — destructive), read/find (gitea-find-issues), or attach labels (gitea-label-issue).
---

# gitea-create-issue

Open one new issue after ruling out a duplicate. Tools: `search_issues`, `create_issue`.

## Prerequisites
- Resolve `owner`+`repo`: pass explicitly, else `GITEA_DEFAULT_OWNER`/`GITEA_DEFAULT_REPO`, else `resolve_repo` (gitea-resolve-repo). Never guess — wrong values create the issue in the wrong repo.

## Flow
1. DUPLICATE CHECK (always first): `search_issues({ query: "<title keywords>", type: "issues" })`. If a match exists, comment on it (gitea-comment-issue) instead of creating a duplicate. Do NOT skip this — creation does not de-duplicate.
2. CREATE: `create_issue({ title, body?, assignees? })`.

## create_issue
- RULES: `title` required; `body` is Markdown. Use `assignees` (array); do NOT also set the deprecated single `assignee`.
- Do NOT pass `labels` or `milestone` here: `labels` expect IDs (error-prone) and milestone needs an id. Create WITHOUT them, then attach labels by name via `add_issue_labels` (gitea-label-issue) and set the milestone via `update_issue` (gitea-update-issue).
- CHECK FIRST: confirm no duplicate (step 1) and that `owner`/`repo` are correct before writing.
- CHECK AFTER: the returned object's `number` is the new issue index.

## Body templates — standardize what you write into `body`
Always structure `body` with the template matching the issue type. Ask the user which type if it is not obvious. Drop a section only when it is genuinely empty; never invent data. These are GitHub-OSS conventions adapted for the Markdown body that `create_issue` accepts.

### Bug report
```markdown
**Summary:** <one-line description of what is wrong>

**Steps to reproduce**
1. <step>
2. <step>

**Expected:** <what should happen>
**Actual:** <what happens instead>

**Environment**
- gitea-mcp version:
- Gitea version:
- Node / runtime:
- OS:
```

### Feature request
```markdown
**Motivation:** <the problem or need this addresses>

**Proposal:** <what to add or change>

**Alternatives considered:** <other approaches and why they fall short>
```

### Performance issue
```markdown
**Symptom:** <what is slow, or which metric regressed>

**How to reproduce:** <scenario + data size / load>

**Measurements**
- Before: <baseline metric>
- After / target: <current or goal metric>

**Suspected bottleneck:** <where the cost seems to come from>
```
