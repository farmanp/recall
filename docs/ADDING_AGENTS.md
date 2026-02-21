# Adding New Agent Parsers

This guide explains how to add support for new AI coding agents (like GitHub Copilot CLI, Aider, Cursor, etc.) to Recall.

## Architecture Overview

Recall uses a **parser architecture** to normalize logs from different agents into a common format for storage and playback.

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Agent Session  │ ──▶ │  Agent Parser    │ ──▶ │  Normalized     │
│  Files          │     │  (extends Base)  │     │  Frames         │
└─────────────────┘     └──────────────────┘     └─────────────────┘
       │                        │                        │
       │                        ▼                        ▼
  ~/.agent/logs/        Parses agent-specific    PlaybackFrame[]
  *.jsonl or *.json     format into standard     stored in SQLite
                        TranscriptEntry[]
```

### Key Components

| File                                   | Purpose                                       |
| -------------------------------------- | --------------------------------------------- |
| `backend/src/parser/base-parser.ts`    | Abstract base class with shared parsing logic |
| `backend/src/parser/agent-detector.ts` | Detects agent type from file path/content     |
| `backend/src/parser/parser-factory.ts` | Factory for creating agent-specific parsers   |
| `backend/src/parser/{agent}-parser.ts` | Agent-specific implementation                 |
| `backend/src/types/transcript.ts`      | Core type definitions                         |

## Step-by-Step Guide

### Step 1: Understand the Agent's Log Format

Before coding, analyze the agent's session files:

1. **Find log location**: Where does the agent store sessions?
   - Example: `~/.aider/sessions/`, `~/.cursor/chats/`

2. **Identify file format**: JSON, JSONL, or other?
   - JSONL: One JSON object per line (Claude, Codex)
   - JSON: Single JSON object with array (Gemini)

3. **Map the structure**: What fields exist?
   - Session ID
   - Timestamps
   - User messages
   - Agent responses
   - Tool calls and results
   - Token usage (if available)

**Example Analysis:**

```json
// ~/.aider/sessions/2026-01-15_abc123.jsonl
{"type": "user", "content": "Fix the login bug", "timestamp": "2026-01-15T10:00:00Z"}
{"type": "assistant", "content": "I'll fix that...", "model": "gpt-4"}
{"type": "tool", "name": "edit_file", "args": {"path": "auth.py", "changes": "..."}}
```

### Step 2: Add Agent Type

Edit `backend/src/parser/agent-detector.ts`:

```typescript
// 1. Add to AgentType union
export type AgentType = 'claude' | 'codex' | 'gemini' | 'aider' | 'unknown';

// 2. Add session directory
export function getAgentSessionDirs(): Map<AgentType, string> {
  const homeDir = os.homedir();
  return new Map<AgentType, string>([
    // ... existing entries ...
    ['aider', path.join(homeDir, '.aider', 'sessions')],
  ]);
}

// 3. Add to agent configs
export function getAgentConfigs(): AgentDirConfig[] {
  return [
    // ... existing entries ...
    {
      type: 'aider',
      baseDir: path.join(os.homedir(), '.aider', 'sessions'),
      filePattern: /\.jsonl$/, // or /\.json$/ for single-file format
    },
  ];
}

// 4. Add path detection
export function detectAgentFromPath(filePath: string): AgentType {
  // ... existing checks ...

  if (normalizedPath.includes('/.aider/')) {
    return 'aider';
  }

  return 'unknown';
}

// 5. Add content signatures (optional but recommended)
function hasAiderSignatures(entry: any): boolean {
  // Check for Aider-specific patterns
  if (entry.aider_version) return true;
  if (entry.model?.includes('gpt') && entry.aider_mode) return true;
  return false;
}
```

### Step 3: Create the Parser

Create `backend/src/parser/aider-parser.ts`:

```typescript
/**
 * Aider Parser
 *
 * Parses Aider AI coding assistant session files.
 */

import { AgentParser } from './base-parser';
import { AgentType } from './agent-detector';
import {
  TranscriptEntry,
  PlaybackFrame,
  ToolUseBlock,
  ToolResultBlock,
  ToolExecution,
} from '../types/transcript';

export class AiderParser extends AgentParser {
  // Required: Declare the agent type
  readonly agentType: AgentType = 'aider';

  /**
   * Parse a raw JSON entry into a normalized TranscriptEntry
   *
   * This is where you map the agent's format to Recall's standard format.
   */
  parseEntry(rawEntry: any): TranscriptEntry | null {
    // Skip invalid entries
    if (!rawEntry || typeof rawEntry !== 'object') {
      return null;
    }

    // Must have timestamp
    if (!rawEntry.timestamp) {
      return null;
    }

    // Map to normalized format
    return {
      uuid: rawEntry.id || this.generateUuid(),
      timestamp: rawEntry.timestamp,
      type: this.mapEntryType(rawEntry.type),
      message: this.extractMessage(rawEntry),
      cwd: rawEntry.cwd || rawEntry.working_dir,
      sessionId: rawEntry.session_id,
    };
  }

  /**
   * Map agent-specific types to standard types
   */
  private mapEntryType(type: string): string {
    const typeMap: Record<string, string> = {
      user: 'user',
      assistant: 'assistant',
      ai: 'assistant',
      tool: 'tool_use',
      command: 'tool_use',
    };
    return typeMap[type] || type;
  }

  /**
   * Extract message content into standard format
   */
  private extractMessage(rawEntry: any): { role: string; content: any[] } | undefined {
    if (!rawEntry.content && !rawEntry.message) {
      return undefined;
    }

    const content = rawEntry.content || rawEntry.message;
    const role = rawEntry.type === 'user' ? 'user' : 'assistant';

    // Normalize content to array of blocks
    if (typeof content === 'string') {
      return {
        role,
        content: [{ type: 'text', text: content }],
      };
    }

    return { role, content };
  }

  /**
   * Collect tool results from entries
   *
   * Map tool_use_id -> ToolResultBlock for matching calls with results.
   */
  collectToolResults(entries: TranscriptEntry[]): Map<string, ToolResultBlock> {
    const resultMap = new Map<string, ToolResultBlock>();

    for (const entry of entries) {
      // Aider might store results differently - adapt as needed
      if (entry.type === 'tool_result' && entry.tool_use_id) {
        resultMap.set(entry.tool_use_id, {
          type: 'tool_result',
          tool_use_id: entry.tool_use_id,
          content: entry.result || entry.output || '',
          is_error: entry.is_error || entry.error,
        });
      }
    }

    return resultMap;
  }

  /**
   * Build ToolExecution from tool use and result
   */
  extractToolExecution(
    toolUse: ToolUseBlock,
    toolResult: ToolResultBlock | undefined
  ): ToolExecution {
    const output = this.extractToolOutput(toolResult);
    const fileDiff = this.extractFileDiff(toolUse, toolResult);

    return {
      tool: this.normalizeToolName(toolUse.name),
      input: toolUse.input,
      output,
      fileDiff,
    };
  }

  /**
   * Normalize tool names to standard categories
   */
  private normalizeToolName(name: string): string {
    const toolMap: Record<string, string> = {
      edit_file: 'Edit',
      write_file: 'Write',
      read_file: 'Read',
      run_command: 'Bash',
      shell: 'Bash',
    };
    return toolMap[name] || name;
  }

  /**
   * Extract playback frames from a transcript entry
   */
  extractFramesFromEntry(
    entry: TranscriptEntry,
    toolResultMap: Map<string, ToolResultBlock>
  ): PlaybackFrame[] {
    const frames: PlaybackFrame[] = [];
    const timestamp = new Date(entry.timestamp).getTime();
    const baseContext = { cwd: entry.cwd || '' };

    // User message frame
    if (entry.type === 'user' && entry.message?.content) {
      const text = this.extractTextContent(entry.message.content);
      if (text) {
        frames.push({
          id: `${entry.uuid}-user`,
          type: 'user_message',
          timestamp,
          agent: this.agentType,
          userMessage: { text },
          context: baseContext,
        });
      }
    }

    // Assistant response frame
    if (entry.type === 'assistant' && entry.message?.content) {
      const text = this.extractTextContent(entry.message.content);
      if (text) {
        frames.push({
          id: `${entry.uuid}-response`,
          type: 'claude_response', // Keep this name for compatibility
          timestamp,
          agent: this.agentType,
          claudeResponse: { text }, // Keep this name for compatibility
          context: baseContext,
        });
      }
    }

    // Tool execution frames
    if (entry.message?.content) {
      const toolUses = this.extractToolUses(entry.message.content);
      for (const toolUse of toolUses) {
        const toolResult = toolResultMap.get(toolUse.id);
        const execution = this.extractToolExecution(toolUse, toolResult);

        frames.push({
          id: `${entry.uuid}-tool-${toolUse.id}`,
          type: 'tool_execution',
          timestamp,
          agent: this.agentType,
          toolExecution: execution,
          context: {
            ...baseContext,
            ...this.extractFileContext(toolUse),
          },
        });
      }
    }

    return frames;
  }

  /**
   * Helper: Extract text from content blocks
   */
  private extractTextContent(content: any[]): string {
    if (!Array.isArray(content)) return '';
    return content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('\n');
  }

  /**
   * Helper: Extract tool use blocks from content
   */
  private extractToolUses(content: any[]): ToolUseBlock[] {
    if (!Array.isArray(content)) return [];
    return content.filter((b) => b.type === 'tool_use') as ToolUseBlock[];
  }

  /**
   * Helper: Generate UUID for entries without one
   */
  private generateUuid(): string {
    return `aider-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

### Step 4: Register the Parser

Edit `backend/src/parser/parser-factory.ts`:

```typescript
import { AiderParser } from './aider-parser';

// In initializeParsers():
private static initializeParsers(): void {
  if (ParserFactory.parsers === null) {
    ParserFactory.parsers = new Map<AgentType, AgentParser>([
      ['claude', new ClaudeParser()],
      ['codex', new CodexParser()],
      ['gemini', new GeminiParser()],
      ['aider', new AiderParser()],  // Add new parser
    ]);
  }
}
```

### Step 5: Add Session Indexing

Edit `backend/src/parser/session-indexer.ts`:

The session indexer scans for session files. If your agent uses a standard directory structure, it should work automatically. If not, you may need to add custom scanning logic:

```typescript
// In scanAgentDirectory() or similar
case 'aider':
  // Aider might have nested directories by date
  // Add custom scanning if needed
  break;
```

### Step 6: Update Frontend

#### Add Tool Normalization

Edit `frontend/src/utils/tool-normalization.ts`:

```typescript
// Add Aider tools to normalization maps
const READ_TOOLS = [...existing, 'read_file', 'view_file'];
const WRITE_TOOLS = [...existing, 'write_file', 'create_file'];
const EDIT_TOOLS = [...existing, 'edit_file', 'patch_file'];
const SHELL_TOOLS = [...existing, 'run_command', 'execute'];
```

#### Add Agent Display Info

Edit `frontend/src/components/AgentBadge.tsx` (or similar):

```typescript
const AGENT_COLORS = {
  // ... existing
  aider: '#10B981', // Green
};

const AGENT_LABELS = {
  // ... existing
  aider: 'Aider',
};
```

### Step 7: Add Tests

Create `backend/src/__tests__/parser/aider-parser.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { AiderParser } from '../../parser/aider-parser';

describe('AiderParser', () => {
  const parser = new AiderParser();

  describe('parseEntry', () => {
    it('parses user messages', () => {
      const entry = parser.parseEntry({
        id: 'abc123',
        timestamp: '2026-01-15T10:00:00Z',
        type: 'user',
        content: 'Fix the bug',
      });

      expect(entry).not.toBeNull();
      expect(entry?.type).toBe('user');
    });

    it('parses assistant responses', () => {
      const entry = parser.parseEntry({
        id: 'def456',
        timestamp: '2026-01-15T10:00:01Z',
        type: 'assistant',
        content: 'I will fix that...',
        model: 'gpt-4',
      });

      expect(entry).not.toBeNull();
      expect(entry?.type).toBe('assistant');
    });

    it('handles tool executions', () => {
      // Test tool parsing
    });

    it('returns null for invalid entries', () => {
      expect(parser.parseEntry(null)).toBeNull();
      expect(parser.parseEntry({})).toBeNull();
      expect(parser.parseEntry({ type: 'user' })).toBeNull(); // missing timestamp
    });
  });

  describe('extractFramesFromEntry', () => {
    it('creates frames from user message', () => {
      // Test frame extraction
    });
  });
});
```

### Step 8: Update Documentation

1. Add agent spec to `docs/agent-specs/AIDER_SPEC.md`
2. Update `README.md` Supported Agents table
3. Update `CLAUDE.md` if needed

## Data Flow Summary

```
1. Session Files     → Raw JSONL/JSON from ~/.agent/
                        ↓
2. Agent Detection   → detectAgentFromPath() determines parser
                        ↓
3. Parser            → parseEntry() normalizes to TranscriptEntry[]
                        ↓
4. Timeline Builder  → buildTimeline() creates PlaybackFrame[]
                        ↓
5. Importer          → Stores in SQLite: session_metadata, session_frames
                        ↓
6. API               → /api/sessions/:id/frames returns frames
                        ↓
7. Frontend          → Session player renders frames
```

## Normalized Data Types

### TranscriptEntry (Input)

Every agent's raw format must map to this:

```typescript
interface TranscriptEntry {
  uuid: string; // Unique identifier
  parentUuid?: string; // For threading
  timestamp: string; // ISO 8601
  type: string; // 'user', 'assistant', 'tool_use', etc.
  message?: {
    role: string;
    content: ContentBlock[];
  };
  cwd?: string; // Working directory
  sessionId?: string;
}
```

### PlaybackFrame (Output)

Parsers produce frames for the video player:

```typescript
interface PlaybackFrame {
  id: string;
  type: 'user_message' | 'claude_thinking' | 'claude_response' | 'tool_execution';
  timestamp: number; // epoch ms
  duration?: number; // ms to next frame
  agent: AgentType;

  userMessage?: { text: string };
  thinking?: { text: string };
  claudeResponse?: { text: string };
  toolExecution?: ToolExecution;

  context: {
    cwd: string;
    filesRead?: string[];
    filesModified?: string[];
  };
}
```

## Tool Categories

For consistent artifact detection, map agent tools to these categories:

| Category  | Purpose                | Examples                                              |
| --------- | ---------------------- | ----------------------------------------------------- |
| **Read**  | File/directory reading | `Read`, `Glob`, `Grep`, `read_file`, `list_directory` |
| **Write** | File creation          | `Write`, `write_file`, `create_file`                  |
| **Edit**  | File modification      | `Edit`, `replace`, `edit_file`, `patch`               |
| **Shell** | Command execution      | `Bash`, `shell`, `run_command`, `execute`             |

Use the base class helpers:

```typescript
this.isReadTool(name); // Check if read operation
this.isWriteTool(name); // Check if write operation
this.isEditTool(name); // Check if edit operation
this.isShellTool(name); // Check if shell operation
```

## Troubleshooting

### Sessions Not Appearing

1. Check path detection: `detectAgentFromPath()` returning correct type?
2. Check file pattern: Does `filePattern` match your files?
3. Check parser registration: Is parser in `ParserFactory`?

### Parse Errors

1. Add logging to `parseEntry()` to see raw data
2. Check required fields: `uuid`, `timestamp`
3. Validate content structure matches expected format

### Frames Not Generated

1. Check `extractFramesFromEntry()` output
2. Verify content block extraction
3. Check tool result matching

### Tests Failing

```bash
cd backend
npm test -- --grep "AiderParser"
```

## Example: Real Parser Comparison

| Aspect           | Claude                 | Gemini                | Your Agent |
| ---------------- | ---------------------- | --------------------- | ---------- |
| **File Format**  | JSONL                  | JSON                  | ?          |
| **Session ID**   | `sessionId` field      | `sessionId` field     | ?          |
| **Timestamp**    | `timestamp`            | `timestamp`           | ?          |
| **User Message** | `message.role: 'user'` | `type: 'user'`        | ?          |
| **Tool Calls**   | `tool_use` blocks      | `toolCalls` array     | ?          |
| **Tool Results** | `tool_result` blocks   | In `toolCalls.result` | ?          |
| **Thinking**     | `thinking` blocks      | `thoughts` array      | ?          |
| **Token Usage**  | `message.usage`        | `tokens` object       | ?          |

Fill in the "?" columns for your agent, then map to the normalized format.

## Checklist

- [ ] Analyzed agent's log format
- [ ] Added AgentType to `agent-detector.ts`
- [ ] Added path detection
- [ ] Added content signatures (optional)
- [ ] Created parser class extending `AgentParser`
- [ ] Implemented `parseEntry()`
- [ ] Implemented `collectToolResults()`
- [ ] Implemented `extractToolExecution()`
- [ ] Implemented `extractFramesFromEntry()`
- [ ] Registered parser in `ParserFactory`
- [ ] Updated session indexer if needed
- [ ] Added frontend tool normalization
- [ ] Added frontend agent display info
- [ ] Written unit tests
- [ ] Updated documentation
- [ ] Tested end-to-end with real session files
