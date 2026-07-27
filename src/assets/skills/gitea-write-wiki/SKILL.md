---
name: gitea-write-wiki
description: Invoke to WRITE / CREATE / EDIT / RESTRUCTURE pages in a Gitea repository wiki. Applies the bundled OSS wiki format spec (page model, naming, Markdown style, templates) so pages look like mainstream open-source documentation. Do NOT invoke to delete a page (no skill — destructive; use delete_wiki_page only after explicit user confirmation), or to work on issues/PRs/Actions.
---

# gitea-write-wiki

Create or edit wiki pages following mainstream open-source conventions (Gitea/GitHub wiki model + GitLab-derived Markdown style). Tools: `list_wiki_pages`, `get_wiki_page`, `create_wiki_page`, `update_wiki_page`, `list_wiki_revisions`.

## Prerequisites
- Resolve `owner`+`repo`: pass explicitly, else `GITEA_DEFAULT_OWNER`/`GITEA_DEFAULT_REPO`, else `resolve_repo` (gitea-resolve-repo).
- The repo's wiki feature must be enabled — the endpoints return 404 otherwise.
- There is NO optimistic locking — always read a page before overwriting it.

## Flow
1. SURVEY (always first): `list_wiki_pages({})`. Decide create vs update; check for near-duplicate titles to merge into instead of creating a parallel page.
2. READ (edit only): `get_wiki_page({ pageName })` — never blind-overwrite; base the edit on the current content.
3. WRITE: `create_wiki_page({ title, content, message? })` or `update_wiki_page({ pageName, content?, message? })`, with `content` formatted per `format-guide.md` (bundled next to this file — read it before writing).
4. LINK: a page nobody can navigate to is a lost page. Add new pages to the `_Sidebar` navigation (and the `Home` index when the wiki is curated there) via `update_wiki_page({ pageName: "_Sidebar", ... })`.
5. ALWAYS pass a `message` (commit message) summarizing the change — the wiki is a git repo and the history is the audit trail.

## Tool rules
- `pageName` / `title` are the page title as it appears in the wiki URL (`Home`, `Getting-Started`) — hyphenated, no `.md` suffix, no spaces.
- `create_wiki_page` FAILS if the title already exists — that is the signal to switch to `update_wiki_page`, not to retry.
- `update_wiki_page` is a PATCH: omit `content` to keep the current content. Passing `title` RENAMES the page and breaks every existing link to the old name — update those links in the same pass.
- `content` is plain Markdown — the tools handle the API's base64 encoding for you; never send base64 yourself.
- Special pages: `Home` (the landing page), `_Sidebar` (persistent navigation), `_Footer` (page footer). They are ordinary pages to write, but their titles are reserved.
- History: `list_wiki_revisions({ pageName })` shows who changed what; use it before reverting or when summarizing changes. Deleting a page is only recoverable from the wiki git clone — there is no skill for deletion; require explicit user confirmation.

## Format spec (core)
The full specification with templates lives in `format-guide.md` next to this file. Key points:
- One H1 per page, matching the title; sections H2/H3, never skip levels; blank lines around headings, lists, code blocks, tables.
- Page names are hyphenated (`API-Reference`); internal links are `[Display text](Page-Name)` — relative, no `.md` suffix.
- Organize the wiki by user journey: `Home` → Getting-Started → Installation → feature pages → API-Reference → FAQ / Troubleshooting.
- Active, concise voice; `-` unordered lists, `1.` ordered lists; fenced code blocks WITH a language tag; bold for UI elements only; descriptive link text (never "click here").
