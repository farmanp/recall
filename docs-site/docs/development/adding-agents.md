---
sidebar_position: 3
---

# Adding a New Agent

This guide explains how to add support for a new AI coding agent to Recall.

## Overview

Adding a new agent requires changes to both the backend (parsing) and frontend (filtering).

## Steps

### 1. Create the Parser

Create `backend/src/parser/{agent}-parser.ts` extending `BaseParser`:

```typescript
import { BaseParser } from './base-parser';
import type { PlaybackFrame, SessionMetadata } from '../types';

export class MyAgentParser extends BaseParser {
  async parseFile(filePath: string): Promise<{
    metadata: SessionMetadata;
    frames: PlaybackFrame[];
  }> {
    // Read and parse the file
    const content = await fs.readFile(filePath, 'utf-8');

    // Parse into frames
    const frames: PlaybackFrame[] = [];

    // Return metadata and frames
    return {
      metadata: {
        sessionId: this.generateSessionId(filePath),
        agent: 'myagent',
        // ... other metadata
      },
      frames,
    };
  }
}
```

### 2. Register with Agent Detector

Update `backend/src/parser/agent-detector.ts`:

```typescript
export function detectAgent(filePath: string): AgentType | null {
  if (filePath.includes('/.myagent/')) {
    return 'myagent';
  }
  // ... existing detection
}
```

### 3. Register with Parser Factory

Update `backend/src/parser/parser-factory.ts`:

```typescript
import { MyAgentParser } from './myagent-parser';

export function createParser(agent: AgentType): BaseParser {
  switch (agent) {
    case 'myagent':
      return new MyAgentParser();
    // ... existing parsers
  }
}
```

### 4. Add Directory Scanning

Update `backend/src/parser/session-indexer.ts` to scan the new agent's session directory:

```typescript
const AGENT_DIRECTORIES = {
  claude: '~/.claude/projects',
  codex: '~/.codex/sessions',
  gemini: '~/.gemini/tmp',
  myagent: '~/.myagent/sessions', // Add this
};
```

### 5. Add Frontend Filter

Update `frontend/src/pages/SessionListPage.tsx` to add a filter tab:

```tsx
const AGENT_TABS = ['all', 'claude', 'codex', 'gemini', 'myagent'];
```

### 6. Add Tool Normalization

Update `frontend/src/utils/tool-normalization.ts` to map the agent's tool names:

```typescript
const READ_TOOLS = ['Read', 'read_file', 'myagent_read'];
const WRITE_TOOLS = ['Write', 'write_file', 'myagent_write'];
// etc.
```

Also add equivalent methods in `backend/src/parser/base-parser.ts` for server-side normalization.

## Testing

1. Place sample session files in the expected directory
2. Run `npm run dev` and verify sessions appear in the list
3. Open a session and verify frames parse correctly
4. Test file operation detection (read/write/edit)
