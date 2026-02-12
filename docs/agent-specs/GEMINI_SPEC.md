# Gemini Agent Spec: Git Capture & Export Improvements

**Agent:** Gemini (Flash 3)
**Branch:** `feat/git-capture-export`
**Directory:** `~/Documents/projects/recall-gemini/`
**Priority:** MEDIUM - Completes existing features

---

## Mission

Wire up git context capture during session import (table exists, just needs data flow) and improve export functionality with better HTML output and copy-friendly markdown.

---

## Tasks

### Task G.1: Wire Up Git Context Capture During Import

**Current State:**

- `git_activity` table exists (migration 025)
- `GitExtractor` service exists at `backend/src/services/git-extractor.ts`
- Sessions import but don't capture git context

**Goal:** Capture git context when sessions are imported.

**Files to Modify:**

- `backend/src/services/transcript-importer.ts`

**Implementation:**

Find the `importTranscript` function and add git extraction after parsing:

```typescript
// In transcript-importer.ts, after parsing the session

import { GitExtractor } from './git-extractor';
import { saveGitActivity } from '../db/git-queries';

// After session is parsed and saved to session_metadata:
async function captureGitContext(sessionId: string, cwd: string): Promise<void> {
  try {
    const gitContext = await GitExtractor.extractFromDirectory(cwd);
    if (gitContext) {
      saveGitActivity({
        sessionId,
        commitHash: gitContext.headCommit,
        commitMessage: gitContext.commitMessage,
        branchName: gitContext.branch,
        parentCommit: gitContext.parentCommit,
        isDirty: gitContext.isDirty,
        filesStaged: JSON.stringify(gitContext.stagedFiles || []),
        filesModified: JSON.stringify(gitContext.modifiedFiles || []),
        untrackedCount: gitContext.untrackedCount || 0,
      });
      console.log(
        `[Import] Captured git context: ${gitContext.branch}@${gitContext.headCommit?.slice(0, 7)}`
      );
    }
  } catch (error) {
    // Git capture is optional - don't fail import
    console.log(`[Import] Could not capture git context: ${error}`);
  }
}
```

**Acceptance Criteria:**

- [ ] Git context captured when session has valid CWD
- [ ] Works for Claude, Codex, and Gemini sessions
- [ ] Graceful failure if not a git repo
- [ ] Data appears in GitPanel when viewing session

**Testing:**

```bash
# Import a session from a git repo
curl -X POST http://localhost:3001/api/import/single \
  -H "Content-Type: application/json" \
  -d '{"filePath": "/path/to/session.jsonl"}'

# Check git context was captured
sqlite3 ~/.recall-player/transcripts.db "SELECT * FROM git_activity LIMIT 5"
```

---

### Task G.2: HTML Export with Embedded Styles

**Current State:** Export modal exists, HTML export is basic.

**Goal:** Create beautiful, self-contained HTML export that looks good when shared.

**File to Modify:** `frontend/src/lib/exportSession.ts`

**Implementation:**

```typescript
// frontend/src/lib/exportSession.ts

export function sessionToHTML(session: SessionTimeline, frames: PlaybackFrame[]): string {
  const css = `
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body {
        font-family: 'SF Mono', 'Consolas', monospace;
        background: #0d1117;
        color: #c9d1d9;
        padding: 2rem;
        line-height: 1.6;
      }
      .header {
        border-bottom: 1px solid #30363d;
        padding-bottom: 1rem;
        margin-bottom: 2rem;
      }
      .header h1 { color: #58a6ff; font-size: 1.5rem; }
      .header .meta { color: #8b949e; font-size: 0.875rem; margin-top: 0.5rem; }
      .frame {
        margin-bottom: 1.5rem;
        padding: 1rem;
        border-left: 3px solid #30363d;
        background: #161b22;
      }
      .frame.user { border-left-color: #58a6ff; }
      .frame.assistant { border-left-color: #7ee787; }
      .frame.tool { border-left-color: #d29922; }
      .frame-header {
        font-size: 0.75rem;
        color: #8b949e;
        margin-bottom: 0.5rem;
        text-transform: uppercase;
      }
      .frame-content { white-space: pre-wrap; }
      pre {
        background: #0d1117;
        padding: 1rem;
        overflow-x: auto;
        border: 1px solid #30363d;
        margin: 0.5rem 0;
      }
      code { font-family: inherit; }
      .summary {
        background: #1f2937;
        border: 1px solid #7ee787;
        padding: 1rem;
        margin-bottom: 2rem;
      }
      .summary h2 { color: #7ee787; margin-bottom: 0.5rem; }
      .footer {
        margin-top: 2rem;
        padding-top: 1rem;
        border-top: 1px solid #30363d;
        color: #8b949e;
        font-size: 0.75rem;
      }
    </style>
  `;

  const header = `
    <div class="header">
      <h1>${escapeHtml(session.slug || 'Session')}</h1>
      <div class="meta">
        <span>${session.project}</span> ·
        <span>${new Date(session.startedAt).toLocaleString()}</span> ·
        <span>${frames.length} frames</span>
      </div>
    </div>
  `;

  const framesHtml = frames
    .map((frame) => {
      const typeClass =
        frame.type === 'user_message'
          ? 'user'
          : frame.type === 'claude_response'
            ? 'assistant'
            : 'tool';
      const typeLabel = frame.type.replace('_', ' ').toUpperCase();

      return `
      <div class="frame ${typeClass}">
        <div class="frame-header">${typeLabel}</div>
        <div class="frame-content">${formatFrameContent(frame)}</div>
      </div>
    `;
    })
    .join('');

  const footer = `
    <div class="footer">
      Exported from <a href="https://github.com/anthropics/recall" style="color: #58a6ff;">Recall</a> ·
      ${new Date().toLocaleString()}
    </div>
  `;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(session.slug || 'Session')} - Recall Export</title>
  ${css}
</head>
<body>
  ${header}
  ${framesHtml}
  ${footer}
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatFrameContent(frame: PlaybackFrame): string {
  // Format based on frame type
  if (frame.userMessage?.text) {
    return escapeHtml(frame.userMessage.text);
  }
  if (frame.claudeResponse?.text) {
    return escapeHtml(frame.claudeResponse.text);
  }
  if (frame.toolExecution) {
    const tool = frame.toolExecution;
    return `<strong>${escapeHtml(tool.toolName)}</strong>\n${escapeHtml(tool.input?.slice(0, 500) || '')}`;
  }
  return '';
}
```

**Acceptance Criteria:**

- [ ] HTML is self-contained (no external CSS/JS)
- [ ] Looks professional when opened in browser
- [ ] Handles code blocks properly
- [ ] Includes session metadata header
- [ ] Has Recall branding in footer

---

### Task G.3: Copy-Friendly Markdown Export

**Goal:** Markdown that pastes well into GitHub, Notion, Slack.

**File to Modify:** `frontend/src/lib/exportSession.ts`

**Improve `sessionToMarkdown`:**

````typescript
export function sessionToMarkdown(session: SessionTimeline, frames: PlaybackFrame[]): string {
  const lines: string[] = [];

  // Header
  lines.push(`# ${session.slug || 'Session'}`);
  lines.push('');
  lines.push(`**Project:** ${session.project}`);
  lines.push(`**Date:** ${new Date(session.startedAt).toLocaleString()}`);
  lines.push(`**Frames:** ${frames.length}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // Frames
  for (const frame of frames) {
    if (frame.userMessage?.text) {
      lines.push('### User');
      lines.push('');
      lines.push(frame.userMessage.text);
      lines.push('');
    } else if (frame.claudeResponse?.text) {
      lines.push('### Assistant');
      lines.push('');
      lines.push(frame.claudeResponse.text);
      lines.push('');
    } else if (frame.toolExecution) {
      const tool = frame.toolExecution;
      lines.push(`### Tool: ${tool.toolName}`);
      lines.push('');
      if (tool.input) {
        lines.push('```');
        lines.push(tool.input.slice(0, 1000));
        lines.push('```');
        lines.push('');
      }
    }
  }

  // Footer
  lines.push('---');
  lines.push('');
  lines.push('*Exported from [Recall](https://github.com/anthropics/recall)*');

  return lines.join('\n');
}
````

**Acceptance Criteria:**

- [ ] Valid markdown syntax
- [ ] Proper code fencing
- [ ] Headers for each frame type
- [ ] Session metadata at top
- [ ] Pastes cleanly into GitHub issues

---

## Testing Strategy

**Git Capture:**

```bash
cd backend && npm test -- --grep "git"
```

**Export:**

```bash
cd frontend && npm test -- --grep "export"
```

**Manual:**

1. Import a session, check GitPanel shows data
2. Export as HTML, open in browser
3. Export as Markdown, paste into GitHub

---

## Definition of Done

- [ ] Git context captured on import
- [ ] GitPanel shows real data
- [ ] HTML export looks professional
- [ ] Markdown export is clean
- [ ] All tests passing

---

## Commit Messages

```
feat(git): capture git context during session import
feat(export): improve HTML export with embedded styles
feat(export): improve markdown export for copy-paste
```

---

## Notes for Agent

- **Keep it simple** - These are well-defined tasks, don't over-engineer
- **Test incrementally** - Verify git capture before moving to export
- **Check existing code** - GitExtractor and export functions exist, improve don't rewrite
