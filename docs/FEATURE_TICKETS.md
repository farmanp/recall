# Feature Tickets: Market Readiness Gaps

**Created:** 2026-02-11
**Baseline:** Entireio CLI feature parity + Recall's unique strengths

---

# Epic 1: Git Commit Linking

**Goal:** Associate AI sessions with git commits so users can see "what AI help was used for this commit"

**Estimated Effort:** 1 session (6-8 tasks)

## Ticket 1.1: Database Schema for Commit-Session Links

### User Story

As a developer, I want sessions linked to commits so I can see which AI sessions contributed to each commit.

### Acceptance Criteria

- [ ] Migration creates `session_commits` table
- [ ] Links session_id to commit SHA, branch, timestamp
- [ ] Supports many-to-many (one session can span multiple commits, one commit can have multiple sessions)

### Files to Create

- `backend/src/db/migrations/030_session_commits.sql`

### Testing

- Migration applies successfully
- Schema matches expected structure

---

## Ticket 1.2: Commit Detection During Session Import

### User Story

As a Recall user, I want commits made during a session to be automatically detected and linked.

### Acceptance Criteria

- [ ] During import, detect commits made between session start and end time
- [ ] Link commits to session in database
- [ ] Handle sessions spanning multiple commits

### Files to Modify

- `backend/src/services/transcript-importer.ts`
- `backend/src/services/git-extractor.ts`

### Testing

- Import session that spans 2 commits → both linked
- Import session with no commits → no links created

---

## Ticket 1.3: API Endpoints for Commit Links

### User Story

As a frontend developer, I need API endpoints to fetch commit-session relationships.

### Acceptance Criteria

- [ ] `GET /api/sessions/:id/commits` - Get commits for a session
- [ ] `GET /api/commits/:sha/sessions` - Get sessions for a commit
- [ ] Include commit message, author, timestamp

### Files to Create

- `backend/src/routes/commits.ts`

### Files to Modify

- `backend/src/server.ts` (register route)

---

## Ticket 1.4: Frontend Commit Display

### User Story

As a user viewing a session, I want to see which commits were made during that session.

### Acceptance Criteria

- [ ] Session player shows linked commits in sidebar or header
- [ ] Clicking commit shows details (message, SHA, files changed)
- [ ] Visual indicator on timeline where commits occurred

### Files to Modify

- `frontend/src/pages/SessionPlayerPage.tsx`
- `frontend/src/components/` (new CommitBadge component)

---

## Ticket 1.5: Commits View in Session List

### User Story

As a user browsing sessions, I want to see commit count for each session.

### Acceptance Criteria

- [ ] Session list shows "2 commits" badge
- [ ] Filter sessions by "has commits"
- [ ] Sort by commit count

### Files to Modify

- `frontend/src/pages/SessionListPage.tsx`

---

## Ticket 1.6: Git Log Integration (Optional Enhancement)

### User Story

As a user, I want to browse commits and see which had AI assistance.

### Acceptance Criteria

- [ ] New `/commits` page showing recent commits
- [ ] Each commit shows linked session count
- [ ] Click to jump to session

### Files to Create

- `frontend/src/pages/CommitsPage.tsx`
- `backend/src/routes/commits.ts` (extend)

---

# Epic 2: LLM-Powered Summaries

**Goal:** Generate rich AI summaries capturing intent, outcome, learnings, and friction points

**Estimated Effort:** 1-2 sessions (8-10 tasks)

## Ticket 2.1: Summary Generation Service

### User Story

As a Recall user, I want AI-generated summaries that capture what I was trying to do and what happened.

### Acceptance Criteria

- [ ] Service calls Claude API with session transcript
- [ ] Extracts: intent, outcome, learnings, friction points, open items
- [ ] Handles rate limits and errors gracefully
- [ ] Configurable (enable/disable, model selection)

### Files to Create

- `backend/src/services/llm-summarizer.ts`

### Files to Modify

- `backend/src/db/migrations/028_summaries.sql` (add structured fields)

### Environment

- `ANTHROPIC_API_KEY` required
- `RECALL_SUMMARIES_ENABLED=true` to enable

---

## Ticket 2.2: Summary Prompt Engineering

### User Story

As a product owner, I want summaries to consistently extract valuable insights.

### Acceptance Criteria

- [ ] Prompt tested on 10+ diverse sessions
- [ ] Consistent JSON output structure
- [ ] Handles edge cases (empty sessions, errors, long sessions)

### Deliverables

- Prompt template in `backend/src/services/llm-summarizer.ts`
- Test results documented

---

## Ticket 2.3: On-Demand Summary Generation API

### User Story

As a user, I want to generate a summary for any session on demand.

### Acceptance Criteria

- [ ] `POST /api/sessions/:id/summarize` triggers generation
- [ ] Returns immediately with job ID
- [ ] `GET /api/sessions/:id/summary` returns result when ready
- [ ] Caches result to avoid re-generation

### Files to Modify

- `backend/src/routes/summaries.ts`

---

## Ticket 2.4: Background Summary Generation

### User Story

As a Recall user, I want summaries generated automatically for new sessions.

### Acceptance Criteria

- [ ] After session import, queue for summarization
- [ ] Process queue in background (not blocking import)
- [ ] Configurable delay (wait for session to "settle")

### Files to Create

- `backend/src/services/summary-queue.ts`

### Files to Modify

- `backend/src/services/transcript-importer.ts`

---

## Ticket 2.5: Summary Display in UI

### User Story

As a user viewing a session, I want to see the AI-generated summary.

### Acceptance Criteria

- [ ] Summary panel in session player
- [ ] Collapsible sections: Intent, Outcome, Learnings, Friction, Open Items
- [ ] "Generate Summary" button if not yet generated
- [ ] Loading state while generating

### Files to Modify

- `frontend/src/pages/SessionPlayerPage.tsx`
- `frontend/src/components/` (new SummaryPanel component)

---

## Ticket 2.6: Summary in Session List

### User Story

As a user browsing sessions, I want to see summary snippets.

### Acceptance Criteria

- [ ] Session card shows intent/outcome preview
- [ ] Expandable to see full summary
- [ ] Filter by "has summary"

### Files to Modify

- `frontend/src/pages/SessionListPage.tsx`

---

## Ticket 2.7: Explain Feature (Natural Language)

### User Story

As a user, I want to ask "What happened in this session?" and get a conversational answer.

### Acceptance Criteria

- [ ] `POST /api/sessions/:id/explain` with optional question
- [ ] Default: "Summarize what happened"
- [ ] Custom: "Why did the tests fail?" or "What files were changed?"
- [ ] Uses session transcript as context

### Files to Create

- `backend/src/services/session-explainer.ts`

### Files to Modify

- `backend/src/routes/sessions.ts`

---

## Ticket 2.8: Explain UI Component

### User Story

As a user, I want a chat-like interface to ask questions about a session.

### Acceptance Criteria

- [ ] "Ask about this session" input in player
- [ ] Shows AI response inline
- [ ] Suggested questions: "What was the goal?", "What went wrong?"

### Files to Create

- `frontend/src/components/SessionExplainer.tsx`

---

# Epic 3: Checkpoint Strategies

**Goal:** Allow users to choose how/when checkpoints are created (manual vs auto)

**Estimated Effort:** 1 session (6-8 tasks)

## Ticket 3.1: Strategy Configuration Schema

### User Story

As a Recall user, I want to configure my checkpoint strategy per project.

### Acceptance Criteria

- [ ] Settings stored in `.recall/settings.json` in project root
- [ ] Strategies: `manual-commit`, `auto-response`, `manual-only`
- [ ] Default: `manual-commit`

### Files to Create

- `backend/src/services/settings-manager.ts`

---

## Ticket 3.2: Manual-Commit Strategy Implementation

### User Story

As a user with manual-commit strategy, I want checkpoints created when I or the agent commits.

### Acceptance Criteria

- [ ] Detect git commits during session
- [ ] Create checkpoint at each commit
- [ ] Store checkpoint with commit SHA reference

### Files to Modify

- `backend/src/services/checkpoint-manager.ts`

---

## Ticket 3.3: Auto-Response Strategy Implementation

### User Story

As a user with auto-response strategy, I want a checkpoint after every agent response.

### Acceptance Criteria

- [ ] Create checkpoint after each assistant message
- [ ] Lightweight storage (don't duplicate unchanged files)
- [ ] Configurable: every response vs every N responses

### Files to Modify

- `backend/src/services/checkpoint-manager.ts`

---

## Ticket 3.4: Manual-Only Strategy Implementation

### User Story

As a user, I want to manually trigger checkpoints via the UI.

### Acceptance Criteria

- [ ] "Create Checkpoint" button in session player
- [ ] `POST /api/sessions/:id/checkpoint` API
- [ ] Optional label/note for checkpoint

### Files to Modify

- `backend/src/routes/checkpoints.ts`
- `frontend/src/pages/SessionPlayerPage.tsx`

---

## Ticket 3.5: Checkpoint List UI

### User Story

As a user, I want to see all checkpoints for a session and jump to any of them.

### Acceptance Criteria

- [ ] Checkpoint list in sidebar
- [ ] Shows timestamp, strategy, label
- [ ] Click to rewind to checkpoint
- [ ] Visual markers on timeline

### Files to Create

- `frontend/src/components/CheckpointList.tsx`

---

## Ticket 3.6: Settings UI

### User Story

As a user, I want to configure my checkpoint strategy in the UI.

### Acceptance Criteria

- [ ] Settings page or modal
- [ ] Strategy selector with descriptions
- [ ] Per-project or global setting
- [ ] Persists to `.recall/settings.json`

### Files to Create

- `frontend/src/pages/SettingsPage.tsx`

---

# Epic 4: Branch Session Resume

**Goal:** Continue sessions when switching git branches

**Estimated Effort:** 1 session (5-7 tasks)

## Ticket 4.1: Branch Tracking in Sessions

### User Story

As a developer, I want sessions to track which git branch they're on.

### Acceptance Criteria

- [ ] Store branch name in session metadata
- [ ] Update if branch changes during session
- [ ] Handle detached HEAD state

### Files to Modify

- `backend/src/services/git-extractor.ts`
- `backend/src/db/transcript-queries.ts`

---

## Ticket 4.2: Branch Filter in Session List

### User Story

As a user, I want to filter sessions by git branch.

### Acceptance Criteria

- [ ] Branch filter dropdown in session list
- [ ] "Current branch" quick filter
- [ ] Shows branch name on session cards

### Files to Modify

- `frontend/src/pages/SessionListPage.tsx`
- `backend/src/routes/sessions.ts`

---

## Ticket 4.3: Resume Session API

### User Story

As a developer switching branches, I want to find and resume the session for that branch.

### Acceptance Criteria

- [ ] `GET /api/sessions/for-branch/:branch` returns most recent session
- [ ] `POST /api/sessions/:id/resume` marks session as "active"
- [ ] Only one active session per project

### Files to Create

- `backend/src/routes/resume.ts`

---

## Ticket 4.4: Resume UI Flow

### User Story

As a user, I want to be prompted to resume a session when opening Recall on a branch with existing sessions.

### Acceptance Criteria

- [ ] On load, detect current branch
- [ ] If session exists for branch, show "Resume session?" prompt
- [ ] Quick action to jump to that session

### Files to Modify

- `frontend/src/pages/SessionListPage.tsx`

---

## Ticket 4.5: Branch-Aware Rewind

### User Story

As a user rewinding, I want to be warned if I'm on a different branch than the session.

### Acceptance Criteria

- [ ] Rewind preview shows branch mismatch warning
- [ ] Option to switch branches before rewind
- [ ] Prevent rewind if uncommitted changes exist

### Files to Modify

- `backend/src/services/rewind-engine.ts`
- `frontend/src/components/RewindModal.tsx`

---

# Epic 5: CLI Commands

**Goal:** Add utility CLI commands for power users

**Estimated Effort:** 0.5 session (4-5 tasks)

## Ticket 5.1: CLI Framework Setup

### User Story

As a developer, I want to run `recall status` from the terminal.

### Acceptance Criteria

- [ ] `recall` command available after global install
- [ ] Subcommand routing (status, doctor, version)
- [ ] Help text for each command

### Files to Create

- `bin/recall-cli.js`

### Files to Modify

- `package.json` (bin entry)

---

## Ticket 5.2: Status Command

### User Story

As a user, I want to see current Recall status from CLI.

### Acceptance Criteria

- [ ] `recall status` shows:
  - Server running? (port)
  - Current project
  - Active session count
  - Database stats
- [ ] Colorized output

---

## Ticket 5.3: Doctor Command

### User Story

As a user with issues, I want a diagnostic command to fix problems.

### Acceptance Criteria

- [ ] `recall doctor` checks:
  - Database integrity
  - Orphaned sessions
  - Stale file watchers
  - Permissions issues
- [ ] Auto-fix option for common issues

---

## Ticket 5.4: Version Command

### User Story

As a user, I want to check my Recall version.

### Acceptance Criteria

- [ ] `recall version` or `recall --version`
- [ ] Shows version, node version, platform

---

## Ticket 5.5: Open Command

### User Story

As a user, I want to quickly open Recall UI from CLI.

### Acceptance Criteria

- [ ] `recall open` launches browser to UI
- [ ] `recall open <session-id>` opens specific session
- [ ] Starts server if not running

---

# Summary

| Epic                       | Tickets | Sessions    | Priority |
| -------------------------- | ------- | ----------- | -------- |
| 1. Git Commit Linking      | 6       | 1           | P1       |
| 2. LLM Summaries + Explain | 8       | 1-2         | P1       |
| 3. Checkpoint Strategies   | 6       | 1           | P2       |
| 4. Branch Session Resume   | 5       | 1           | P2       |
| 5. CLI Commands            | 5       | 0.5         | P3       |
| **Total**                  | **30**  | **4.5-5.5** |          |

## Recommended Order

1. **Epic 2: LLM Summaries** - Highest user value, differentiator
2. **Epic 1: Git Commit Linking** - Essential for developer workflow
3. **Epic 5: CLI Commands** - Quick win, can do alongside others
4. **Epic 3: Checkpoint Strategies** - Power user feature
5. **Epic 4: Branch Resume** - Nice to have, complex

---

## How to Use These Tickets

Each ticket can be implemented in a single Claude Code task using the pattern:

```
Implement Ticket X.Y: [Title]

[Copy acceptance criteria and file lists from ticket]
```

For complex tickets, Claude Code will create a similar task breakdown as the Gemini hash mapping feature (7 sub-tasks with commits).
