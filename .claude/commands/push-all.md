---
description: Commit and push ALL changes (staged + unstaged + untracked)
allowed-tools: Bash
---

# Push All Changes

Commit and push ALL current changes to the remote repository.

## Instructions

1. Run `git add -A` to stage everything (all modified, deleted, and untracked files)
2. Run `git diff --cached --stat` to show what will be committed
3. Run `git log --oneline -3` to see recent commit style
4. Compose a concise commit message summarizing ALL changes (follow repo's existing style)
5. Commit with the message (include `Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>`)
6. Push to the current branch's remote tracking branch
7. Report: branch name, commit hash, files changed count
