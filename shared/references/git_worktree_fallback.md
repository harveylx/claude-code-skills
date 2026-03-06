# Git Worktree Fallback

<!-- SCOPE: Branch isolation strategy with worktree/branch fallback. Read strategy from docs/tools_config.md Git section. -->

## Strategy Selection

Read `docs/tools_config.md` → Git → Branch strategy:

| Strategy | When | Isolation | Cleanup |
|----------|------|-----------|---------|
| `worktree` | Worktree available (default) | Separate directory per story | `git worktree remove` |
| `branch` | Worktree unavailable | Same directory, branch switch | `git branch -d` |

## Operations by Strategy

| Operation | worktree | branch |
|-----------|----------|--------|
| **Create isolation** | `git worktree add -b feature/{id}-{slug} .worktrees/story-{id} develop` | `git checkout -b feature/{id}-{slug}` |
| **Work directory** | `.worktrees/story-{id}/` | Current directory |
| **Git commands** | `git -C {worktree_dir} ...` | `git ...` (no -C needed) |
| **Sync with develop** | `git -C {dir} fetch origin develop && git -C {dir} rebase origin/develop` | `git fetch origin develop && git rebase origin/develop` |
| **Collect metrics** | `git -C {dir} diff --stat develop...HEAD` | `git diff --stat develop...HEAD` |
| **Merge to develop** | `git merge --squash feature/{id}-{slug} && git commit` | `git checkout develop && git merge --squash feature/{id}-{slug} && git commit` |
| **Cleanup** | `git worktree remove .worktrees/story-{id} --force` | `git branch -d feature/{id}-{slug}` |

## Usage in SKILL.md

```markdown
**MANDATORY READ:** Load `shared/references/git_worktree_fallback.md`
```

---
**Version:** 1.0.0
**Last Updated:** 2026-03-04
