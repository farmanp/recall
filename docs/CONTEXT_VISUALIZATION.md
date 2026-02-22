# Context Window Visualization

Recall provides real-time visualization of Claude's context window usage, helping you understand token consumption patterns and anticipate context compaction events.

## Overview

The context visualization system tracks three key aspects:

1. **Context Fill Level** - How much of the context window is used
2. **Token Attribution** - What's consuming context (tools, thinking, messages)
3. **Compaction Events** - When and how context is compressed

## Components

### ContextMeter

A horizontal progress bar showing accumulated context window usage.

**Location**: Top of the Session Player (toggle with Gauge button)

**Features**:

- Real-time fill percentage with smooth gradient colors:
  - **Green** (0-50%): Plenty of room
  - **Yellow** (50-80%): Getting full
  - **Red** (80-100%): Near limit, compaction likely
- Absolute token count display
- Phase number indicator (shows after compaction)
- Threshold markers at 50% and 80%
- Phase boundary markers (vertical purple lines)

**Usage**:

```
Press the Gauge (meter) button in the session player toolbar to toggle
```

**Props**:
| Prop | Type | Description |
|------|------|-------------|
| `accumulatedContext` | `number` | Running total of context tokens |
| `phaseNumber` | `number` | Current phase (1-based, increments after compaction) |
| `maxContext` | `number` | Maximum context window size (default: 200K) |
| `phaseBoundaries` | `number[]` | Token counts where compaction occurred |

### CompactionBoundary

A visual divider in the transcript marking context compaction events.

**Location**: Inline in transcript at compaction points

**Features**:

- Amber/yellow styling to draw attention
- Shows token reduction: "150K → 20K tokens"
- Displays reduction percentage (-87%)
- Shows number of frames summarized

**Visual Design**:

```
─────────── ✂ Context Compacted │ 150K → 20K tokens │ -87% │ 42 frames summarized ───────────
```

### SessionContextPanel

Detailed breakdown of what's consuming context across the entire session.

**Location**: Side panel (toggle with dedicated button)

**Features**:

- Collapsible sections by category:
  - **CLAUDE.md Files** - Project context injected at start
  - **Tool Outputs** - Results from Bash, Read, etc.
  - **Thinking** - Claude's reasoning blocks
  - **User Messages** - Your prompts
  - **Responses** - Claude's replies
  - **Cache** - Cached/reused tokens
- Token count and percentage for each category
- Click to navigate to first frame of that type
- Helps identify what's consuming the most context

### TokenBreakdownBadge

Per-turn token attribution displayed on individual frames.

**Location**: In frame headers throughout the transcript

**Features**:

- Compact badge showing total tokens
- Click to expand detailed breakdown popover
- Shows token count by category:
  - User Input (cyan)
  - Tool Output (amber)
  - Thinking (purple)
  - Response (green)
  - Cache (blue)
- Estimated cost display

## Data Model

### PlaybackFrame Context Fields

```typescript
interface PlaybackFrame {
  // ... other fields ...

  // Context window tracking
  phaseNumber?: number; // Context phase (1-based)
  accumulatedContext?: number; // Running total of tokens

  // Token attribution
  tokenAttribution?: TokenAttribution;
  estimatedCostCents?: number;
}

interface TokenAttribution {
  userInput: number; // Tokens from user messages
  toolOutput: number; // Tokens from tool results
  thinking: number; // Tokens from thinking blocks
  response: number; // Tokens from assistant responses
  claudeMd: number; // Tokens from CLAUDE.md injection
  cache: number; // Cached/reused tokens
}

interface CompactionInfo {
  tokensBefore: number; // Context size before compaction
  tokensAfter: number; // Context size after compaction
  summarizedFrames: number; // Number of frames summarized
}
```

### Context Phase Tracking

Sessions can have multiple "phases" separated by compaction events:

```
Phase 1: 0 → 180K tokens
         ↓ [Compaction: 180K → 20K]
Phase 2: 20K → 150K tokens
         ↓ [Compaction: 150K → 15K]
Phase 3: 15K → 95K tokens (session end)
```

Each phase starts fresh after context is compressed.

## Backend Services

### Context Phase Tracker

**File**: `backend/src/services/context-phase-tracker.ts`

Tracks context phases across session frames:

```typescript
// Detect compaction events from summary entries
function detectCompactionEvents(frames: PlaybackFrame[]): CompactionEvent[];

// Calculate accumulated context for each frame
function calculateAccumulatedContext(frames: PlaybackFrame[]): void;

// Tag frames with phase numbers
function tagPhaseNumbers(frames: PlaybackFrame[]): void;
```

### Token Attribution Service

**File**: `backend/src/services/token-attribution.ts`

Attributes tokens to categories based on frame content:

```typescript
// Calculate per-turn token attribution
function calculateTokenAttribution(frame: PlaybackFrame): TokenAttribution;

// Estimate cost based on model and token counts
function estimateCost(tokens: TokenUsage, model: string): number;
```

## API Endpoints

Context data is included in frame responses:

```bash
# Get frames with context data
GET /api/sessions/:id/frames?source=db

# Response includes:
{
  "frames": [
    {
      "id": "frame-1",
      "type": "claude_response",
      "accumulatedContext": 45000,
      "phaseNumber": 1,
      "tokenUsage": { "input_tokens": 1200, "output_tokens": 500 },
      "tokenAttribution": {
        "userInput": 200,
        "toolOutput": 800,
        "thinking": 150,
        "response": 500,
        "claudeMd": 50,
        "cache": 0
      },
      "estimatedCostCents": 2.4
    }
  ]
}
```

## Use Cases

### 1. Debugging Context Overflow

When sessions end unexpectedly or Claude loses context:

1. Open the ContextMeter to see fill level
2. Look for CompactionBoundary markers
3. Check SessionContextPanel to see what's consuming context
4. Optimize: reduce tool output verbosity, trim CLAUDE.md, etc.

### 2. Cost Optimization

Identify expensive operations:

1. Click TokenBreakdownBadge on expensive turns
2. See which category dominates (usually tool output)
3. Consider caching, summarizing, or reducing output

### 3. Understanding Session Flow

Visualize how context builds up:

1. Watch ContextMeter fill as you scroll through frames
2. Note phase boundaries where compaction occurred
3. Understand the session's context lifecycle

## Configuration

### Default Context Window Size

The default max context is 200K tokens. Override per-session:

```tsx
<ContextMeter maxContext={128000} /> // For 128K models
```

### Color Thresholds

Current thresholds (hardcoded):

- Green zone: 0-50%
- Yellow zone: 50-80%
- Red zone: 80-100%

## Future Enhancements

- [ ] Context window size detection per model
- [ ] Predictive "compaction likely" warnings
- [ ] Token budget recommendations
- [ ] Export context attribution reports
- [ ] Compare context efficiency across sessions
