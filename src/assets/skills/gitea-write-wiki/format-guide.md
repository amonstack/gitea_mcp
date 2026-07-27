# Gitea Wiki Format & Style Guide

This specification summarizes how mainstream open-source projects write wiki
documentation, distilled from the Gitea wiki documentation, GitHub wiki
conventions, and the GitLab documentation style guide (a representative,
battle-tested OSS doc standard). Follow it for every page written with
`create_wiki_page` / `update_wiki_page`.

## 1. Page model (Gitea / GitHub wiki mechanics)

- **A wiki is a git repository** (`<owner>/<repo>.wiki.git`). Every page is one
  Markdown file; every save is a commit. Write meaningful commit messages.
- **Flat structure** — no nested directories. Hierarchy is expressed through
  naming and the `_Sidebar`, not folders.
- **Special pages** (reserved titles):
  - `Home` — the landing page; the wiki's front door and table of contents.
  - `_Sidebar` — persistent navigation shown on every page.
  - `_Footer` — footer shown on every page (license, last-updated, links).
- **Page naming**: hyphenated words, kebab-case or Title-Case —
  `Getting-Started`, `API-Reference`, `Troubleshooting`. Avoid spaces (they
  become ugly URLs), underscores, run-together words (`gettingstarted`), and
  ALL-CAPS. Names are case-sensitive; pick one casing convention and keep it.
- **Internal links**: `[Display text](Page-Name)` — relative to the wiki root,
  no `.md` suffix, no leading slash. Use full URLs only for external targets.
- **Organize by user journey**, not by implementation module:
  1. `Home` — what the project is, who it is for, links to everything below.
  2. Getting-Started — the shortest path to a working result.
  3. Installation — detailed setup for each supported environment.
  4. Feature / usage pages — one page per major capability.
  5. API-Reference — endpoints, parameters, examples.
  6. FAQ / Troubleshooting — symptoms first, then cause, then fix.
  7. Contributing — how to build, test, and submit changes.

## 2. Page anatomy

- Exactly **one H1** per page (`# Title`), matching the page title.
- Sections use `##`, subsections `###`. **Never skip a level** (`##` → `####`
  is wrong). Avoid going deeper than `####`; split the page instead.
- One blank line **before and after** every heading, list, code block, table,
  and blockquote.
- Task-oriented pages lead with **Prerequisites**, then numbered **Steps**,
  then **Verify / Troubleshooting** — readers scan, they do not read linearly.
- Keep lines to roughly 100 characters so git diffs stay readable (soft rule;
  never break a link across lines).

## 3. Markdown style rules

Derived from the GitLab documentation style guide and common OSS practice.

### Voice and language

- Active voice, present tense: "The server validates the token", not "the token
  is validated".
- Concise and direct — cut filler. Never use "easily", "simply", "just", or
  marketing claims; state facts and let the reader judge.
- Write to the reader ("you"), not about the project's authors ("we").
- Prefer lists and tables over long paragraphs — documentation is scanned.

### Lists

- Unordered lists use `-` (never `*`).
- Ordered lists start every item with `1.` (the renderer numbers them).
- Items are parallel in structure, start with a capital letter, and share one
  punctuation convention (period only for complete sentences).
- Introduce a list with a complete sentence ending in a colon.

### Code

- Fenced code blocks **always carry a language tag** for highlighting:

  ````markdown
  ```bash
  gitea-mcp init --tool opencode
  ```
  ````

- Blank lines around code blocks; placeholders inside them use `<angle_brackets>`.
- Inline code (single backticks) for: filenames, commands, flags, config keys,
  API methods/status codes, short inputs and outputs — never for emphasis.

### Emphasis

- **Bold** is reserved for UI elements (buttons, tabs, menu items) and matches
  the label exactly: select **Save Page**.
- Avoid italics for emphasis; rewrite the sentence instead.

### Tables

- Pipes padded with spaces (`| Cell |`, not `|Cell|`); header row and
  delimiter row the same length; sentence-case headers.
- Use tables for matrix-like data (parameter × default × description);
  otherwise prefer a list.

### Links

- Link text is descriptive and lowercase: `see [wiki pages](Wiki-Pages)` —
  never "click here", "this page", or a bare URL in prose.
- Do not duplicate the same link repeatedly on one page; do not put links in
  headings.
- External links rot — prefer linking to the project's own pages; when an
  external link is required, use the full URL.

## 4. Templates

Fill the placeholders; drop a section only when it is genuinely empty. Never
invent commands, flags, or output — verify against the actual project first.

### `Home`

```markdown
# <Project> Wiki

<One-paragraph description: what the project does and who this wiki serves.>

## Documentation

- [Getting Started](Getting-Started) — install and run in five minutes
- [Installation](Installation) — detailed setup per environment
- [Configuration](Configuration) — every option, with defaults
- [API Reference](API-Reference) — endpoints and examples
- [FAQ](FAQ) — common questions
- [Troubleshooting](Troubleshooting) — known issues and fixes

## Community

- [Issue tracker](../issues) — report bugs and request features
- [Contributing](Contributing) — how to build, test, and submit changes
```

### Feature / concept page

````markdown
# <Feature Name>

<What the feature does and when to use it — two or three sentences.>

## Overview

<Concepts and mental model. Define terms on first use.>

## Usage

<The common case, with a copy-pasteable example.>

```bash
<command> <required-arg> [--option <value>]
```

## Configuration

| Option | Default | Description |
|--------|---------|-------------|
| `<key>` | `<value>` | <What it controls.> |

## Limitations

- <What the feature does NOT do.>

## See also

- [Related Page](Related-Page)
````

### How-to / task page

```markdown
# <Do This Thing>

<One sentence: the outcome this page achieves.>

## Prerequisites

- <Access, versions, or setup required before starting.>

## Steps

1. <First action.>
1. <Next action.>
1. <Final action.>

## Verify

<How to confirm it worked — a command and its expected output.>

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| <error text> | <why> | <what to do> |
```

### `_Sidebar`

```markdown
## Documentation

- [Home](Home)
- [Getting Started](Getting-Started)
- [Installation](Installation)
- [Configuration](Configuration)
- [API Reference](API-Reference)

## Reference

- [FAQ](FAQ)
- [Troubleshooting](Troubleshooting)
- [Contributing](Contributing)
```

### `_Footer`

```markdown
[Home](Home) · [Issue tracker](../issues) · <Project> is <license> licensed.
```
