---
name: gitea-resolve-repo
description: Invoke to RESOLVE which owner/repo the other gitea tools should target (auto-detect from a git remote) or to LIST repositories the token can access. Run FIRST when the target repository is unknown. Do NOT invoke for issue/comment/label/milestone work once owner/repo are known.
---

# gitea-resolve-repo

Discover the target repository. Tools: `resolve_repo`, `list_my_repos`.

## resolve_repo
- Reads the `origin` remote of the git repo at `path` (default: current directory) and parses owner/repo from SSH (`git@gitea.example:owner/repo.git`) or HTTPS (`https://gitea.example/owner/repo.git`) URLs.
- Throws if there is no `origin` remote or the URL is unparseable. Do NOT guess owner/repo from context — call this, or ask the user.

## list_my_repos
- Lists repositories the token can access. GLOBAL. Returns large objects — paginate (`limit` ≤ 100) and read only the fields you need (name, full_name, owner.login).

## Resolution order (every repo-scoped tool)
explicit `owner`/`repo` args → `GITEA_DEFAULT_OWNER`/`GITEA_DEFAULT_REPO` → `resolve_repo`. If none resolve, the tool throws `owner and repo are required`. Wrong values 404 or silently target the wrong repo — never guess.
