# Competitive Analysis: Recall vs Entireio CLI

**Date:** 2026-02-11
**Purpose:** Identify feature gaps for market readiness

## Product Positioning

| Aspect           | Recall                       | Entireio CLI                         |
| ---------------- | ---------------------------- | ------------------------------------ |
| **Focus**        | Session replay/visualization | Session capture & git integration    |
| **Architecture** | Web app (local server)       | CLI tool with git hooks              |
| **Installation** | `npx recall-player`          | `brew install` or `go install`       |
| **Data Storage** | SQLite databases             | Git branch (`entire/checkpoints/v1`) |

## Feature Comparison Matrix

### Session Capture & Display

| Feature                      | Recall | Entireio      | Gap?         |
| ---------------------------- | ------ | ------------- | ------------ |
| Claude Code support          | ✅     | ✅            | —            |
| Gemini CLI support           | ✅     | ✅ (preview)  | —            |
| Codex CLI support            | ✅     | ❌            | Recall ahead |
| Session list view            | ✅     | ❌ (CLI only) | Recall ahead |
| Session replay/playback      | ✅     | ❌            | Recall ahead |
| Timeline scrubber            | ✅     | ❌            | Recall ahead |
| Artifacts panel              | ✅     | ❌            | Recall ahead |
| Diff viewer                  | ✅     | ❌            | Recall ahead |
| Search across sessions       | ✅     | ❌            | Recall ahead |
| Filter by project/agent      | ✅     | ❌            | Recall ahead |
| Real-time session monitoring | ✅     | ✅            | —            |

### Git Integration

| Feature                       | Recall     | Entireio | Gap?    |
| ----------------------------- | ---------- | -------- | ------- |
| Git hooks for capture         | ❌         | ✅       | **GAP** |
| Link sessions to commits      | ❌         | ✅       | **GAP** |
| Checkpoint on commit          | ❌         | ✅       | **GAP** |
| Sessions stored in git        | ❌         | ✅       | **GAP** |
| Git context extraction        | ✅ (basic) | ✅       | —       |
| Branch awareness              | ❌         | ✅       | **GAP** |
| `resume` command for branches | ❌         | ✅       | **GAP** |

### Rewind/Restore

| Feature                    | Recall | Entireio | Gap?         |
| -------------------------- | ------ | -------- | ------------ |
| Rewind to point in session | ✅     | ✅       | —            |
| Preview before restore     | ✅     | ❌       | Recall ahead |
| Undo rewind                | ✅     | ❌       | Recall ahead |
| Backup before restore      | ✅     | ❌       | Recall ahead |
| Checkpoint strategies      | ❌     | ✅       | **GAP**      |

### AI Features

| Feature                  | Recall         | Entireio | Gap?              |
| ------------------------ | -------------- | -------- | ----------------- |
| AI summaries of sessions | ✅ (heuristic) | ✅ (LLM) | **GAP** (quality) |
| Intent/outcome capture   | ❌             | ✅       | **GAP**           |
| Learnings extraction     | ❌             | ✅       | **GAP**           |
| Friction points          | ❌             | ✅       | **GAP**           |
| `explain` command        | ❌             | ✅       | **GAP**           |

### Work Organization

| Feature                       | Recall | Entireio | Gap?         |
| ----------------------------- | ------ | -------- | ------------ |
| Work units (session grouping) | ✅     | ❌       | Recall ahead |
| CLAUDE.md version history     | ✅     | ❌       | Recall ahead |
| Commentary integration        | ✅     | ❌       | Recall ahead |
| Project-based filtering       | ✅     | ✅       | —            |

### Developer Experience

| Feature                   | Recall | Entireio            | Gap?         |
| ------------------------- | ------ | ------------------- | ------------ |
| Zero-config startup       | ✅     | ❌ (needs `enable`) | Recall ahead |
| Web UI                    | ✅     | ❌                  | Recall ahead |
| Keyboard shortcuts        | ✅     | ❌                  | Recall ahead |
| `doctor` command (repair) | ❌     | ✅                  | **GAP**      |
| `status` command          | ❌     | ✅                  | **GAP**      |
| Accessibility mode        | ❌     | ✅                  | **GAP**      |

---

## Critical Gaps for Market Readiness

### Priority 1: Must Have (Blocking)

| Gap                         | Description                                                | Effort |
| --------------------------- | ---------------------------------------------------------- | ------ |
| **Git commit linking**      | Associate sessions with git commits for context            | Medium |
| **LLM-powered summaries**   | Generate richer summaries with intent/outcome/learnings    | Medium |
| **Explain command/feature** | Natural language explanation of what happened in a session | Medium |

### Priority 2: Should Have (Competitive)

| Gap                       | Description                                     | Effort |
| ------------------------- | ----------------------------------------------- | ------ |
| **Checkpoint strategies** | Manual-commit vs auto-commit checkpoint options | Medium |
| **Git hooks integration** | Optional hooks to auto-capture on commit        | High   |
| **Branch session resume** | Continue sessions when switching branches       | Medium |
| **CLI commands**          | `recall status`, `recall doctor`, etc.          | Low    |

### Priority 3: Nice to Have (Differentiator)

| Gap                        | Description                               | Effort |
| -------------------------- | ----------------------------------------- | ------ |
| **Sessions in git branch** | Store session data in git for portability | High   |
| **Accessibility mode**     | Screen reader friendly output             | Low    |
| **Team sharing**           | Share sessions with team members          | High   |

---

## Recall's Competitive Advantages

Recall has significant advantages that Entireio lacks:

1. **Visual Replay** - No other tool offers video-like session playback
2. **Web UI** - Rich interactive interface vs CLI-only
3. **Multi-agent support** - Best-in-class with Claude, Gemini, AND Codex
4. **Artifacts panel** - See files changed at each step
5. **Timeline scrubber** - Jump to any point visually
6. **Work units** - Group related sessions together
7. **CLAUDE.md tracking** - Version history of project instructions
8. **Safe rewind** - Preview, execute, and undo with backups
9. **Search** - Full-text search across all sessions

---

## Recommended Roadmap

### Phase 1: Core Gaps (4-6 weeks)

1. Git commit linking - associate sessions with commits
2. LLM summaries - use Claude API for rich summaries
3. Explain feature - "What happened in this session?"

### Phase 2: Git Integration (4-6 weeks)

1. Checkpoint strategies (manual vs auto)
2. Branch awareness and session resume
3. Optional git hooks

### Phase 3: Polish (2-4 weeks)

1. CLI commands (status, doctor)
2. Accessibility improvements
3. Documentation and tutorials

---

## Sources

- [Entireio CLI GitHub](https://github.com/entireio/cli)
- Recall CLAUDE.md and codebase analysis
