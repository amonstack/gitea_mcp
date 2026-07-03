# Label management guide

Labels are the most error-prone area because endpoints mix **names** and **ids**.

## The name-vs-id matrix (memorize)

| Operation | Identifier | Type |
|---|---|---|
| `add_issue_labels` | name | `string[]` |
| `replace_issue_labels` | name | `string[]` |
| `remove_issue_label` | **id** | `number` |
| `create_issue` / `update_issue` `.labels` | **id** | `number[]` |
| `update_label` / `delete_label` | **id** | `number` |

**Workflow rule:** call `list_labels` first and keep the `id`↔`name` map for the
whole session. Translate before any call that needs the other form.

## Conventions

- **Color:** 6-digit hex, with or without `#`. Keep a consistent palette per repo.
- **Names are unique** per repo. Rename with `update_label` (by id); never recreate
  to rename.
- **Scoped/exclusive labels** use `scope/name` (e.g. `priority/low`, `priority/high`).
  Within a scope, labels are mutually exclusive — adding `priority/high` removes
  `priority/low`. Use this intentionally for single-value dimensions (priority,
  type, status); use plain labels for multi-value dimensions (topic, team).

## Safe operations

- **Add one label without disturbing others** → `add_issue_labels(["name"])`
  (additive, by name).
- **Remove one label** → `remove_issue_label(id)` (by id; get it from the issue's
  `labels`).
- **Set an exact known set** → `replace_issue_labels(["a","b"])` — but read the
  current labels first and confirm, since it removes everything not listed.
- **Bulk cleanup** → `delete_label(id)` removes the label from EVERY issue; only
  after user confirmation.

## Anti-patterns

- Passing a label **name** to `remove_issue_label` (needs id) — hits the wrong id
  or 404s.
- Passing a label **id** to `add_issue_labels` (needs name) — 404s.
- Using `update_issue({ labels })` to "add" a label — it REPLACES the whole set.
  Use `add_issue_labels` instead.
- Deleting a label to "remove it from one issue" — that removes it from all issues.
  Use `remove_issue_label` for one issue.
