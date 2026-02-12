# Git Worktree Setup for Parallel Development

## Overview

Each AI coding agent works in their own worktree to enable parallel development without conflicts.

## Directory Structure

```
~/Documents/projects/
├── recall/                          # Main repo (Claude Code)
├── recall-antigravity/              # Antigravity worktree
├── recall-gemini/                   # Gemini worktree
└── recall-codex/                    # Codex worktree
```

## Setup Commands

Run these from the main `recall` directory:

```bash
# Ensure we're on main and up to date
cd ~/Documents/projects/recall
git checkout main
git pull origin main

# Create branches for each agent
git branch feat/live-sharing-security   # Claude Code
git branch feat/llm-summaries           # Antigravity
git branch feat/git-capture-export      # Gemini
git branch feat/share-ui                # Codex

# Create worktrees
git worktree add ../recall-antigravity feat/llm-summaries
git worktree add ../recall-gemini feat/git-capture-export
git worktree add ../recall-codex feat/share-ui

# Claude Code stays in main repo on feat/live-sharing-security
git checkout feat/live-sharing-security
```

## Verify Setup

```bash
git worktree list
# Should show:
# /Users/farman/Documents/projects/recall                  <branch>
# /Users/farman/Documents/projects/recall-antigravity      feat/llm-summaries
# /Users/farman/Documents/projects/recall-gemini           feat/git-capture-export
# /Users/farman/Documents/projects/recall-codex            feat/share-ui
```

## Agent Assignments

| Agent                    | Directory             | Branch                       | Spec File             |
| ------------------------ | --------------------- | ---------------------------- | --------------------- |
| Claude Code (Sonnet 4.5) | `recall/`             | `feat/live-sharing-security` | `CLAUDE_CODE_SPEC.md` |
| Antigravity (Sonnet 4.5) | `recall-antigravity/` | `feat/llm-summaries`         | `ANTIGRAVITY_SPEC.md` |
| Gemini (Flash 3)         | `recall-gemini/`      | `feat/git-capture-export`    | `GEMINI_SPEC.md`      |
| Codex (5.3)              | `recall-codex/`       | `feat/share-ui`              | `CODEX_SPEC.md`       |

## Merging Back

When an agent completes their work:

```bash
# From main recall directory
cd ~/Documents/projects/recall
git checkout main

# Merge completed branch
git merge feat/<branch-name> --no-ff

# Remove worktree when done
git worktree remove ../recall-<agent>
git branch -d feat/<branch-name>
```

## Dependency Notes

- **Codex (share-ui)** depends on **Claude Code (security)** completing first
- **Gemini** and **Antigravity** can work in parallel
- All branches should be based off `main` at v2.3.0
