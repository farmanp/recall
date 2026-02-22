# Subagent/Task Hierarchy

Recall visualizes complex multi-agent workflows as hierarchical trees, making it easy to understand how Claude's Task tool spawns subagents and how they relate to the parent session.

## Overview

When Claude uses the Task tool, it spawns specialized subagents that run autonomously and return results. Recall tracks these parent-child relationships and provides:

1. **Tree View** - Hierarchical visualization of agent spawning
2. **Subagent Details** - Drill-down into individual subagent execution
3. **Aggregate Metrics** - Duration, tokens, and frame counts per subtree

## View Modes

### Transcript View (Default)

Linear, chronological view of all frames in the session. Traditional timeline display.

**When to use**: Following the conversation flow, debugging specific interactions.

### Tree View

Hierarchical view organizing frames by parent-child relationships.

**When to use**: Understanding multi-agent workflows, seeing which subagents were spawned.

**Toggle**: Click the view mode buttons in the session player toolbar.

## Components

### SubagentTreeView

The main tree visualization component showing frames as collapsible nodes.

**Location**: Session Player main content area (when Tree View is selected)

**Features**:

- Hierarchical indentation with connector lines
- Collapsible/expandable nodes
- Frame type icons (User, Response, Thinking, Tool)
- Aggregate stats per subtree (duration, tokens, frame count)
- Current frame highlighting
- Click to navigate to frame in timeline
- External link button to open subagent details

**Visual Structure**:

```
├─ 👤 User: "Search for authentication code"
├─ 💬 Response: "I'll search the codebase..."
├─ 🔧 Task: Explore - "Find auth implementation"
│   ├─ 💬 Response: "Let me search..."
│   ├─ 🔧 Grep: pattern="authenticate"
│   └─ 💬 Response: "Found 3 files..."
├─ 💬 Response: "Based on my search..."
└─ 🔧 Edit: auth.ts
```

**Subtree Stats**:
Each Task node shows aggregate metrics for its subtree:

- Duration (e.g., "2m 34s")
- Token count (e.g., "45.2K tokens")
- Frame count (e.g., "23 frames")

### SubagentDetailModal

Modal overlay showing detailed view of a subagent's execution.

**Location**: Opens when clicking the external link button on a Task node

**Features**:

- Task description header (from Task tool input)
- Metrics row: duration, input/output tokens, frame count
- Mini-transcript showing the subagent's frames
- Nested subagent display for recursive hierarchies
- Navigate to specific frame in main timeline

**Metrics Display**:

```
┌─────────────────────────────────────────────────────┐
│  🔍 Explore - "Find auth implementation"            │
├─────────────────────────────────────────────────────┤
│  ⏱ 2m 34s  │  ⚡ 45.2K tokens  │  📑 23 frames    │
├─────────────────────────────────────────────────────┤
│  [Mini-transcript of subagent frames...]           │
└─────────────────────────────────────────────────────┘
```

## Data Model

### PlaybackFrame Hierarchy Fields

```typescript
interface PlaybackFrame {
  // ... other fields ...

  // Hierarchy fields for subagent trees
  parentFrameId?: string; // ID of parent frame that spawned this
  isSubagent?: boolean; // Whether this frame belongs to a subagent
  agentId?: string; // Unique identifier for grouping subagent frames
  taskDescription?: string; // Description from Task tool invocation
}
```

### Tree Node Structure

```typescript
interface TreeNode {
  frame: PlaybackFrame;
  frameIndex: number;
  children: TreeNode[];
  depth: number;
}
```

## Backend Services

### Subagent Resolver

**File**: `backend/src/parser/subagent-resolver.ts`

Discovers and parses subagent JSONL files:

```typescript
// Scan session directory for subagent files
function findSubagentFiles(sessionDir: string): string[];

// Parse subagent file and link to parent session
function parseSubagentFile(filePath: string, parentSessionId: string): PlaybackFrame[];

// Resolve all subagents for a session
function resolveSubagents(sessionId: string, frames: PlaybackFrame[]): PlaybackFrame[];
```

### Frame Tree Builder

**File**: `backend/src/services/frame-tree-builder.ts`

Builds hierarchical tree from flat frame array:

```typescript
// Build tree structure using parentFrameId relationships
function buildFrameTree(frames: PlaybackFrame[]): TreeNode[];

// Calculate aggregate stats for subtree
function calculateSubtreeStats(node: TreeNode): SubtreeStats;

// Flatten tree back to array with depth info
function flattenTree(nodes: TreeNode[]): FlattenedNode[];
```

## API Endpoints

### Get Subagent Details

```bash
GET /api/sessions/:sessionId/subagents/:agentId

# Response
{
  "agentId": "agent-123",
  "taskDescription": "Find authentication implementation",
  "frames": [...],
  "stats": {
    "frameCount": 23,
    "duration": 154000,
    "inputTokens": 35000,
    "outputTokens": 10200
  }
}
```

### Session Frames with Hierarchy

Hierarchy fields are included in standard frame responses:

```bash
GET /api/sessions/:id/frames

# Response includes hierarchy fields
{
  "frames": [
    {
      "id": "frame-1",
      "type": "tool_execution",
      "toolExecution": { "tool": "Task", ... },
      "taskDescription": "Find auth implementation"
    },
    {
      "id": "frame-2",
      "type": "claude_response",
      "parentFrameId": "frame-1",  // Child of Task frame
      "isSubagent": true,
      "agentId": "agent-123"
    }
  ]
}
```

## How Subagents Are Detected

### From Task Tool Calls

When Claude uses the Task tool:

```json
{
  "type": "tool_use",
  "name": "Task",
  "input": {
    "description": "Find authentication implementation",
    "subagent_type": "Explore",
    "prompt": "Search for auth code..."
  }
}
```

The parser:

1. Creates a frame for the Task tool call
2. Sets `taskDescription` from input.description
3. Generates unique `agentId` for the subagent
4. Tags subsequent frames with `parentFrameId` and `isSubagent`

### From Subagent JSONL Files

For agents that write separate files (e.g., `agent_*.jsonl`):

1. Scanner finds `{sessionDir}/agent_*.jsonl` files
2. Parser reads subagent transcript
3. Links frames via `sessionId` matching parent UUID
4. Merges into main timeline with proper hierarchy

## Use Cases

### 1. Understanding Complex Workflows

When a session uses many Task invocations:

1. Switch to Tree View
2. See hierarchy of spawned agents
3. Collapse uninteresting branches
4. Expand specific subagents to see their work

### 2. Debugging Subagent Failures

When a Task-spawned agent fails:

1. Find the Task node in Tree View
2. Click external link to open SubagentDetailModal
3. Review the subagent's full transcript
4. Identify where it went wrong

### 3. Analyzing Agent Efficiency

Compare different subagent strategies:

1. Look at subtree stats (duration, tokens)
2. Identify expensive subagents
3. Consider alternative approaches for future sessions

### 4. Navigating Large Sessions

Sessions with 100+ frames become unwieldy in linear view:

1. Switch to Tree View
2. Collapse all nodes
3. Expand only relevant branches
4. Click to jump to specific frames

## Keyboard Shortcuts

| Key      | Action                                    |
| -------- | ----------------------------------------- |
| `t`      | Toggle between Transcript and Tree views  |
| `←` `→`  | Navigate between frames                   |
| `Enter`  | Expand/collapse selected node (Tree View) |
| `Escape` | Close SubagentDetailModal                 |

## Visual Design

### Tree Connector Lines

```
│   Vertical line connecting siblings
├─  Branch to non-last child
└─  Branch to last child
    Indentation (4 spaces per level)
```

### Frame Type Icons

| Type            | Icon | Color  |
| --------------- | ---- | ------ |
| User Message    | 👤   | Cyan   |
| Thinking        | 🧠   | Purple |
| Response        | 💬   | Green  |
| Tool Execution  | 🔧   | Amber  |
| Task (Subagent) | 🌳   | Purple |

### Depth Limits

Tree renders up to 10 levels deep. Deeper hierarchies are truncated with "..." indicator.

## Future Enhancements

- [ ] Parallel subagent visualization (timeline lanes)
- [ ] Subagent comparison view
- [ ] Export subagent transcript separately
- [ ] Subagent search/filter
- [ ] Collapse all / Expand all buttons
- [ ] Subagent execution timeline (Gantt-style)
