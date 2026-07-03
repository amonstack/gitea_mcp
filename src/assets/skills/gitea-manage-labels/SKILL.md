---
name: gitea-manage-labels
description: Invoke to CREATE or EDIT a Gitea label in the repo's taxonomy (the set of available label definitions). Do NOT invoke to attach labels to an issue (gitea-label-issue) or to delete a label (destructive — no skill).
---

# gitea-manage-labels

Create or edit the repo's label definitions. Tools: `list_labels`, `create_label`, `update_label`.

## Prerequisites
- Resolve `owner`+`repo`: pass explicitly, else `GITEA_DEFAULT_OWNER`/`GITEA_DEFAULT_REPO`, else `resolve_repo` (gitea-resolve-repo).

## list_labels
- Enumerate available labels (name, id, color, description). Use to resolve names→ids and to check name uniqueness before create. Paginate 1-based, `limit` ≤ 100.

## create_label
- RULES: `name` required and UNIQUE per repo (duplicate → conflict). `color` = 6-digit hex, with or without leading `#` (e.g. `#ff0000` or `ff0000`). `description` optional.
- CHECK FIRST: `list_labels` to avoid a name collision.

## update_label
- RULES: identifies the label by `id` (number). PATCH — only `name` / `color` / `description` you pass change; omit = unchanged. `color` stays 6-digit hex.
- NOTE: renaming or recoloring a label updates it on EVERY issue that currently has it.
