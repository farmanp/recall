# Milestone: Indie Ready

---

# Ticket Dependency Graph

```
                    ┌─────────────────────────────────────────────────────────┐
                    │                    INDIE READY                          │
                    └─────────────────────────────────────────────────────────┘
                                              │
                    ┌─────────────────────────┴─────────────────────────┐
                    │                                                   │
                    ▼                                                   ▼
    ┌───────────────────────────────┐               ┌───────────────────────────────┐
    │   FEATURE A: LLM SUMMARIES    │               │   FEATURE B: EXPORT/SHARE     │
    │         (1 session)           │               │       (0.5 session)           │
    └───────────────────────────────┘               └───────────────────────────────┘
                    │                                               │
                    ▼                                               ▼
            ┌───────────────┐                               ┌───────────────┐
            │     A.1       │                               │     B.1       │
            │  DB Schema    │                               │  Export JSON  │
            │  (backend)    │                               │  (backend)    │
            └───────┬───────┘                               └───────┬───────┘
                    │                                               │
                    ▼                                               ▼
            ┌───────────────┐                               ┌───────────────┐
            │     A.2       │                               │     B.2       │
            │  LLM Service  │                               │  Export HTML  │
            │  (backend)    │                               │  (backend)    │
            └───────┬───────┘                               └───────┬───────┘
                    │                                               │
          ┌─────────┼─────────┐                                     │
          │         │         │                                     │
          ▼         ▼         ▼                                     ▼
    ┌──────────┐ ┌──────────┐ ┌──────────┐                  ┌───────────────┐
    │   A.3    │ │   A.6    │ │          │                  │     B.3       │
    │   API    │ │  Auto-   │ │          │                  │ Export Button │
    │ Endpoints│ │ Generate │ │          │                  │  (frontend)   │
    │(backend) │ │(backend) │ │          │                  └───────────────┘
    └────┬─────┘ └──────────┘ │          │
         │        (optional)  │          │
         │                    │          │
    ┌────┴────────────────────┘          │
    │                                    │
    ▼                                    │
┌─────────────────────────┐              │
│      A.4 & A.5          │              │
│  (can run in parallel)  │              │
├────────────┬────────────┤              │
│    A.4     │    A.5     │              │
│  Summary   │  Session   │              │
│   Panel    │   List     │              │
│ (frontend) │ (frontend) │              │
└────────────┴────────────┘              │
                                         │
                    ┌────────────────────┘
                    │
                    ▼
            ┌───────────────┐
            │   COMPLETE    │
            └───────────────┘
```

## Dependency Table

| Task    | Depends On | Can Parallel With | Agent Focus |
| ------- | ---------- | ----------------- | ----------- |
| **A.1** | None       | B.1               | Backend     |
| **A.2** | A.1        | B.2               | Backend     |
| **A.3** | A.2        | A.6, B.2          | Backend     |
| **A.4** | A.3        | A.5, B.3          | Frontend    |
| **A.5** | A.3        | A.4, B.3          | Frontend    |
| **A.6** | A.2        | A.3, A.4, A.5     | Backend     |
| **B.1** | None       | A.1               | Backend     |
| **B.2** | B.1        | A.2, A.3          | Backend     |
| **B.3** | B.2        | A.4, A.5          | Frontend    |

## Parallel Execution Strategy

### Wave 1 (No dependencies - START HERE)

```
┌─────────────┐     ┌─────────────┐
│ AGENT 1     │     │ AGENT 2     │
│ Task A.1    │     │ Task B.1    │
│ DB Schema   │     │ Export JSON │
└─────────────┘     └─────────────┘
```

### Wave 2 (After Wave 1)

```
┌─────────────┐     ┌─────────────┐
│ AGENT 1     │     │ AGENT 2     │
│ Task A.2    │     │ Task B.2    │
│ LLM Service │     │ Export HTML │
└─────────────┘     └─────────────┘
```

### Wave 3 (After Wave 2)

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ AGENT 1     │     │ AGENT 2     │     │ AGENT 3     │
│ Task A.3    │     │ Task A.6    │     │ Task B.3    │
│ API Endpts  │     │ Auto-Gen    │     │ Export Btn  │
└─────────────┘     └─────────────┘     └─────────────┘
```

### Wave 4 (After Wave 3)

```
┌─────────────┐     ┌─────────────┐
│ AGENT 1     │     │ AGENT 2     │
│ Task A.4    │     │ Task A.5    │
│ Summary UI  │     │ List Preview│
└─────────────┘     └─────────────┘
```

## Single-Agent Sequential Order

If running with one agent at a time:

```
1. A.1 (DB Schema)           ─┐
2. B.1 (Export JSON)          │ Foundation
3. A.2 (LLM Service)         ─┘
4. B.2 (Export HTML)         ─┐
5. A.3 (API Endpoints)        │ Core Features
6. A.6 (Auto-Generate)       ─┘
7. B.3 (Export Button)       ─┐
8. A.4 (Summary Panel)        │ UI Polish
9. A.5 (Session List)        ─┘
```

## Critical Path

The longest dependency chain (determines minimum time):

```
A.1 → A.2 → A.3 → A.4
 │
 └── 4 tasks in sequence = ~8-10 hours minimum
```

Feature B is shorter and can complete faster:

```
B.1 → B.2 → B.3
 │
 └── 3 tasks in sequence = ~4-5 hours
```

---

**Target:** Indie developers and startups
**Effort:** 1.5 sessions
**Goal:** Answer "What did the AI do?" and "Can I share this?"

---

# Feature A: LLM-Powered Summaries

**Why:** Indie devs come back to a session and ask "What happened here?" Current heuristic summaries don't capture intent or learnings.

**Effort:** 1 session (6 tasks)

---

## Task A.1: Database Schema Update for Rich Summaries

### User Story

As a developer, I need structured storage for AI-generated summaries with intent, outcome, and learnings.

### Acceptance Criteria

- [ ] Migration `031_rich_summaries.sql` adds columns to `recall_summaries`:
  - `intent` TEXT - What the user was trying to accomplish
  - `outcome` TEXT - What actually happened
  - `learnings` TEXT - Key insights or patterns (JSON array)
  - `friction_points` TEXT - What went wrong or was difficult (JSON array)
  - `files_summary` TEXT - Plain English summary of file changes
- [ ] Existing heuristic summaries preserved (backward compatible)

### Files to Create

- `backend/src/db/migrations/031_rich_summaries.sql`

### Commit Message

```
feat(db): add structured fields for LLM-powered summaries
```

---

## Task A.2: LLM Summary Service

### User Story

As a Recall user, I want AI-generated summaries that capture what I was trying to do and what happened.

### Acceptance Criteria

- [ ] New service `llm-summarizer.ts` with `generateSummary(sessionId)` function
- [ ] Uses Anthropic SDK to call Claude API
- [ ] Prompt extracts: intent, outcome, learnings, friction points
- [ ] Returns structured JSON matching database schema
- [ ] Handles errors gracefully (API failures, rate limits)
- [ ] Configurable via `ANTHROPIC_API_KEY` env var
- [ ] Falls back to heuristic if no API key

### Files to Create

- `backend/src/services/llm-summarizer.ts`

### Dependencies

- `@anthropic-ai/sdk` (add to package.json)

### Prompt Template (starting point)

```
You are analyzing an AI coding session transcript. Extract:

1. **Intent**: What was the user trying to accomplish? (1-2 sentences)
2. **Outcome**: What actually happened? Did they succeed? (1-2 sentences)
3. **Learnings**: Key insights, patterns, or techniques used (3-5 bullet points)
4. **Friction Points**: What went wrong or was difficult? (0-3 bullet points)
5. **Files Summary**: Plain English summary of file changes (1 sentence)

Respond in JSON format:
{
  "intent": "...",
  "outcome": "...",
  "learnings": ["...", "..."],
  "friction_points": ["...", "..."],
  "files_summary": "..."
}
```

### Commit Message

```
feat(services): add LLM-powered summary generation

Uses Claude API to generate rich summaries capturing intent, outcome,
learnings, and friction points. Falls back to heuristic summaries
when ANTHROPIC_API_KEY is not configured.
```

---

## Task A.3: Summary Generation API Endpoint

### User Story

As a frontend developer, I need an API to trigger and retrieve summaries.

### Acceptance Criteria

- [ ] `POST /api/sessions/:id/summarize` triggers LLM summary generation
  - Returns `{ status: "generating" | "completed" | "failed", jobId?: string }`
  - If summary exists and is recent (<24h), returns cached
  - Optional `?force=true` to regenerate
- [ ] `GET /api/sessions/:id/summary` returns summary
  - Returns full summary object if exists
  - Returns `{ status: "not_generated" }` if none
  - Includes `generatedBy: "heuristic" | "llm"`
- [ ] Summary generation runs synchronously (simple for v1)

### Files to Modify

- `backend/src/routes/summaries.ts`
- `backend/src/db/summary-queries.ts` (add rich fields)

### Commit Message

```
feat(api): add endpoints for LLM summary generation and retrieval
```

---

## Task A.4: Summary Panel UI Component

### User Story

As a user viewing a session, I want to see a rich summary of what happened.

### Acceptance Criteria

- [ ] New `SummaryPanel` component with sections:
  - **Intent** - What you were trying to do
  - **Outcome** - What happened
  - **Learnings** - Bullet list
  - **Friction Points** - Bullet list (if any)
  - **Files Changed** - Summary sentence
- [ ] Collapsible sections (default: Intent and Outcome expanded)
- [ ] "Generate Summary" button if no LLM summary exists
- [ ] Loading spinner while generating
- [ ] Graceful fallback to heuristic summary display

### Files to Create

- `frontend/src/components/SummaryPanel.tsx`
- `frontend/src/components/SummaryPanel.css`

### Files to Modify

- `frontend/src/pages/SessionPlayerPage.tsx` (integrate panel)

### Commit Message

```
feat(ui): add SummaryPanel for rich session summaries

Displays intent, outcome, learnings, and friction points.
Includes "Generate Summary" button for on-demand LLM generation.
```

---

## Task A.5: Summary in Session List Preview

### User Story

As a user browsing sessions, I want to see a quick summary preview.

### Acceptance Criteria

- [ ] Session card shows intent (truncated to 100 chars)
- [ ] Hover or click expands to show outcome
- [ ] Visual badge: "AI Summary" vs "Auto Summary"
- [ ] Sessions with LLM summaries sortable/filterable

### Files to Modify

- `frontend/src/pages/SessionListPage.tsx`
- `frontend/src/components/SessionCard.tsx` (if exists)

### Commit Message

```
feat(ui): show summary preview in session list cards
```

---

## Task A.6: Auto-Generate on Import (Optional)

### User Story

As a user, I want summaries generated automatically for new sessions.

### Acceptance Criteria

- [ ] After session import completes, queue for summarization
- [ ] Only if `ANTHROPIC_API_KEY` is set
- [ ] Configurable: `RECALL_AUTO_SUMMARIZE=true` (default: false)
- [ ] Rate limit: max 1 summary per 10 seconds

### Files to Modify

- `backend/src/services/transcript-importer.ts`
- `backend/src/index.ts` (config)

### Commit Message

```
feat(import): optionally auto-generate summaries on session import
```

---

# Feature B: Session Export/Share

**Why:** Startups need to show teammates or stakeholders what the AI did.

**Effort:** 0.5 session (3 tasks)

---

## Task B.1: Export Session as JSON

### User Story

As a user, I want to export a session's data for backup or sharing.

### Acceptance Criteria

- [ ] `GET /api/sessions/:id/export` returns full session data as JSON
- [ ] Includes: metadata, frames, summary, tool executions
- [ ] Option: `?format=json` (default) or `?format=minimal` (metadata only)
- [ ] Filename: `recall-session-{id}-{date}.json`

### Files to Modify

- `backend/src/routes/sessions.ts`

### Commit Message

```
feat(api): add session export endpoint
```

---

## Task B.2: Export Session as Standalone HTML

### User Story

As a user, I want to export a session as an HTML file I can share with anyone.

### Acceptance Criteria

- [ ] `GET /api/sessions/:id/export?format=html` returns self-contained HTML
- [ ] HTML includes:
  - Session metadata (project, date, duration)
  - Summary (if available)
  - All frames rendered as timeline
  - Embedded CSS (no external dependencies)
  - Collapsible tool outputs
- [ ] Works offline (no API calls needed to view)
- [ ] Responsive design (works on mobile)

### Files to Create

- `backend/src/services/html-exporter.ts`
- `backend/src/templates/session-export.html` (template)

### Commit Message

```
feat(export): generate standalone HTML for session sharing

Creates self-contained HTML file with embedded styles that can be
shared via email, Slack, or any file sharing service.
```

---

## Task B.3: Export UI Button

### User Story

As a user viewing a session, I want to easily export it.

### Acceptance Criteria

- [ ] "Export" button in session player header
- [ ] Dropdown: "Export as JSON" / "Export as HTML"
- [ ] Downloads file directly to browser
- [ ] Success toast notification

### Files to Modify

- `frontend/src/pages/SessionPlayerPage.tsx`
- `frontend/src/components/ExportButton.tsx` (new)

### Commit Message

```
feat(ui): add export button to session player
```

---

# Summary

| Task      | Description                  | Effort         |
| --------- | ---------------------------- | -------------- |
| A.1       | DB schema for rich summaries | 1-2 hrs        |
| A.2       | LLM summary service          | 2-3 hrs        |
| A.3       | Summary API endpoints        | 1-2 hrs        |
| A.4       | Summary panel UI             | 2-3 hrs        |
| A.5       | Summary in session list      | 1-2 hrs        |
| A.6       | Auto-generate on import      | 1 hr           |
| B.1       | Export as JSON               | 1 hr           |
| B.2       | Export as HTML               | 2-3 hrs        |
| B.3       | Export UI button             | 1 hr           |
| **Total** |                              | **~12-18 hrs** |

---

# Implementation Order

## Session 1: LLM Summaries

1. A.1 - Database schema
2. A.2 - LLM service
3. A.3 - API endpoints
4. A.4 - Summary panel UI
5. A.5 - Session list preview
6. A.6 - Auto-generate (optional)

## Session 2: Export/Share (can be half session)

1. B.1 - Export JSON
2. B.2 - Export HTML
3. B.3 - Export button

---

# Environment Setup

Before starting, ensure:

```bash
# For LLM summaries
export ANTHROPIC_API_KEY="sk-ant-..."

# Optional: auto-generate summaries
export RECALL_AUTO_SUMMARIZE=true
```

---

# Definition of Done

- [ ] All tasks committed to feature branch
- [ ] Tests pass (backend + frontend)
- [ ] Manual testing: generate summary for real session
- [ ] Manual testing: export HTML and open in browser
- [ ] Manual testing: share HTML file with someone else
