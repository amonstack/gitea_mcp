# Gitea object field reference

The shapes of the JSON objects these tools return (verbatim from the Gitea API).
Use this to read results correctly and pick the right identifier.

## Issue
- `id` (number) — internal id. NOT used by tools; tools use `number`.
- `number` (number) — the issue index shown in the URL (#42). This is the `index`
  passed to get_issue / update_issue / delete_issue / comments tools.
- `title` (string), `body` (string?), `state` ("open" | "closed")
- `html_url`, `url` (string)
- `comments` (number) — comment COUNT, not the comments themselves
- `labels` (Label[])
- `assignee` (User?), `assignees` (User[]?)
- `milestone` (Milestone?)
- `repository` (Repository) — present on search_issues results
- `created_at`, `updated_at` (string ISO); `closed_at` (string?, when closed)

## Label
- `id` (number) — used by remove_issue_label / update_label / delete_label
- `name` (string) — used by add_issue_labels / replace_issue_labels
- `color` (string) — 6-digit hex, with or without "#"
- `description` (string?)

## User
- `id` (number), `login` (string), `full_name` (string?), `avatar_url` (string),
  `email` (string?)

## Milestone
- `id` (number) — used by get/update/delete_milestone; also the `milestone` value on
  create/update_issue
- `title` (string), `description` (string?), `state` ("open" | "closed")
- `open_issues` (number), `closed_issues` (number) — counts for progress
- `due_on` (string?, ISO)

## Comment
- `id` (number) — used by update_comment / delete_comment. NOT the issue number.
- `body` (string) — Markdown
- `html_url` (string), `created_at`, `updated_at` (string ISO)
- `user` (User) — comment author

## Repository (embedded on issues)
- `id` (number), `full_name` (string "owner/repo"), `name` (string),
  `owner` ({ login: string })

## Repo (from list_my_repos)
- `id`, `full_name`, `name`, `owner` (User), `description?`, `html_url`,
  `default_branch?`, `created_at`, `updated_at`
