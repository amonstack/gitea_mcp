---
name: gitea-resolve-repo
description: Invoke to RESOLVE which owner/repo (and baseUrl) the other gitea tools should target (auto-detect from a git remote) or to LIST repositories the token can access. Run FIRST when the target repository is unknown. Do NOT invoke for issue/comment/label/milestone work once owner/repo are known.
---

# gitea-resolve-repo

Discover the target repository and instance. Tools: `resolve_repo`, `list_my_repos`.

## resolve_repo
- Reads `.git/config` of the git repo at `path` (default: current directory) and parses
  EVERY remote from SSH (`git@gitea.example:owner/repo.git`) or HTTPS
  (`https://gitea.example/owner/repo.git`) URLs.
- Selects the remote to target in this priority: `upstream` → `origin` → any other.
  SSH remotes resolve to `baseUrl = https://<host>` (the API is assumed HTTPS).
- Returns `{ baseUrl, owner, repo, remote, remote_url, remotes: { <name>: {baseUrl, owner, repo, url} } }`.
  Read `baseUrl` to know which instance a token must be valid for; read `remotes` to see
  upstream vs origin when they differ.
- Throws `No parseable git remotes found` if the cwd has no git remote or none parse. Do
  NOT guess owner/repo from context — call this, or ask the user.

## list_my_repos
- Lists repositories the token can access. GLOBAL. Returns large objects — paginate (`limit` ≤ 100) and read only the fields you need (name, full_name, owner.login). If this returns
  401/403 there is no usable token — switch to the **gitea-configure** skill.

## Resolution order (every repo-scoped tool)
explicit `owner`/`repo` args → `GITEA_DEFAULT_OWNER`/`GITEA_DEFAULT_REPO` (or git-discovered
defaults) → `resolve_repo`. If none resolve, the tool throws `owner and repo are required`.
Wrong values 404 or silently target the wrong repo — never guess.
