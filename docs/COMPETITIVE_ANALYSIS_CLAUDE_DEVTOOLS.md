# Competitive Analysis: Recall vs claude-devtools

**Date:** 2026-02-14
**Subject:** `claude-devtools` (matt1398) vs `Recall` (farmanp)

## Executive Summary

While both tools visualize `~/.claude` session logs, they serve fundamentally different "jobs to be done."

- **Recall** is a **"DVR for Coding"**. It focuses on _playback_, _narrative_, and _cross-agent history_. It is designed for understanding "how a feature was built" over time, supporting multiple AI agents (Claude, Gemini, Codex).
- **claude-devtools** is a **"Debugger/IDE"**. It focuses on _inspection_, _token forensics_, and _deep structural analysis_. It is designed for optimizing prompt engineering, debugging agent loops, and monitoring live costs/context.

## Feature Comparison Matrix

### 1. Scope & Support

| Feature              | Recall                         | claude-devtools           | Verdict                      |
| :------------------- | :----------------------------- | :------------------------ | :--------------------------- |
| **Agents Supported** | **Claude, Gemini, Codex**      | Claude Code Only          | **Recall** (Broader)         |
| **Data Source**      | `~/.claude`, `~/.gemini`, etc. | `~/.claude` only          | **Recall** (Broader)         |
| **Remote/SSH**       | Local Only                     | **Full SSH/SFTP Support** | **claude-devtools** (Better) |
| **Platform**         | Web App (Browser)              | Electron (Desktop App)    | Tie (Preference)             |

### 2. Visualization Paradigm

| Feature          | Recall                                  | claude-devtools                  | Verdict                                             |
| :--------------- | :-------------------------------------- | :------------------------------- | :-------------------------------------------------- |
| **Metaphor**     | **Video Player** (Timeline, Play/Pause) | **Trace Inspector** (Tree/Cards) | Distinct Approaches                                 |
| **Navigation**   | Scrubber, Chapters, 20x Speed           | Scroll, Expand/Collapse          | Recall for _Review_, DevTools for _Debug_           |
| **File Changes** | Diff View (Unified/Split)               | Inline Diffs in Cards            | Tie                                                 |
| **Sub-Agents**   | Linearized in timeline                  | **Recursive Tree View**          | **claude-devtools** (Better for deep agent nesting) |

### 3. Context & Forensics

| Feature            | Recall      | claude-devtools                                  | Verdict                              |
| :----------------- | :---------- | :----------------------------------------------- | :----------------------------------- |
| **Token Usage**    | Basic Stats | **Deep Reconstruction** (7-category breakdown)   | **claude-devtools** (Superior)       |
| **Context Window** | N/A         | **Compaction Visualizer** (See what was dropped) | **claude-devtools** (Unique feature) |
| **Cost Analysis**  | Basic       | Detailed per-turn cost                           | **claude-devtools**                  |
| **Notifications**  | None        | **Custom Triggers** (Regex, .env access)         | **claude-devtools** (Unique feature) |

### 4. Knowledge Management

| Feature          | Recall                                   | claude-devtools                   | Verdict                                 |
| :--------------- | :--------------------------------------- | :-------------------------------- | :-------------------------------------- |
| **Search**       | **Full-Text (FTS5)** across ALL sessions | Command Palette (Spotlight-style) | **Recall** (Better for archival search) |
| **Organization** | **Work Units** (Group related sessions)  | Project-based Folders             | **Recall** (Better for project history) |
| **History**      | **CLAUDE.md Diffing**                    | Current State only                | **Recall** (Unique feature)             |

## Key Differentiators

### 🟢 Recall Wins On:

1.  **Multi-Agent Ecosystem**: If a user switches between Gemini and Claude, Recall is the only unified history.
2.  **"The Story"**: Work Units and Linear Playback are better for demos, tutorials, or remembering "what I did last week."
3.  **Lightweight**: Runs as a local web server, no Electron overhead if just viewing.
4.  **Project Evolution**: Tracking changes to `CLAUDE.md` over time.

### 🔵 claude-devtools Wins On:

1.  **Deep Debugging**: If Claude is looping or hallucinating, DevTools shows exactly _why_ (context compaction, hidden system prompts).
2.  **Remote Work**: First-class support for inspecting sessions on headless dev servers via SSH.
3.  **Real-time Monitoring**: Notifications for sensitive file access (`.env`) or high costs.
4.  **Agent Internals**: Visualizing the "Team" and "Sub-agent" hierarchy explicitly.

## Strategic Recommendations for Recall

To compete or coexist effectively, Recall should lean into its **"Knowledge Base"** strengths rather than trying to out-debug DevTools.

1.  **Emphasize "Work Units"**: This is a major differentiator. DevTools sees isolated sessions; Recall sees a _feature implementation_ spread across 5 sessions.
2.  **Enhance "The Movie"**: Add annotations or auto-generated chapters to make the playback even more consumable for _sharing_ (e.g., "Show my team how I built this").
3.  **Universal Search**: Double down on being the "Google for your local AI history."
4.  **Adopt "Compaction Awareness"**: While we don't need deep forensics, knowing _when_ context was lost (a marker on the timeline) would be valuable.

## Conclusion

**claude-devtools** is for the **Engineer** optimizing the _Agent_.
**Recall** is for the **Developer** tracking the _Work_.

They are complementary. A user might use **claude-devtools** while actively coding to monitor tokens/loops, and use **Recall** to review the week's work, search for a snippet from a month ago, or show a colleague how a complex refactor was handled.
