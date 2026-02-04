# Claude-Mem Commentary Integration

## Overview

This document describes the integration of `claude-mem` observations into the session replay player, providing "Pop Up Video" style commentary bubbles that display contextual insights during playback.

## Features

1. **Timeline Bubbles**: Small colored dots appear on the timeline at timestamps where observations were recorded
2. **Hover Preview**: Hovering over a bubble shows the observation title and type
3. **Click to Expand**: Clicking a bubble opens a full modal with the complete observation details
4. **Color Coding**: Different observation types are color-coded:
   - Purple: Decision
   - Blue: Feature
   - Red: Bugfix
   - Green: Observation
   - Yellow: Insight
   - Gray: Default/Other
5. **Toggle Control**: Commentary can be shown/hidden via a checkbox in the playback controls

## Architecture

### Backend (`/backend/src/routes/commentary.ts`)

The commentary route provides an API endpoint to query claude-mem observations:

**Endpoint**: `GET /api/sessions/:id/commentary`

**Response Format**:

```json
{
  "commentary": [
    {
      "id": 1,
      "timestamp": 1706889600000,
      "type": "decision",
      "title": "Architecture Decision",
      "content": "Decided to use React Query for state management...",
      "metadata": {}
    }
  ],
  "total": 1,
  "sessionId": "abc123-xyz-789"
}
```

**Implementation Details**:

- Queries claude-mem MCP server via `claude mcp call` command
- Falls back gracefully if claude-mem is not available
- Alternative direct SQLite access method available (`queryClaudeMemDirect`)

### Frontend Components

#### 1. **CommentaryBubble Component** (`/frontend/src/components/CommentaryBubble.tsx`)

Three main sub-components:

- **TimelineBubbleIcon**: Small colored dot on timeline with hover preview
- **CommentaryCard**: Full-screen modal showing complete observation details
- **CommentaryTimeline**: Container that positions all bubbles on timeline

#### 2. **SessionPlayerPage Integration** (`/frontend/src/pages/SessionPlayerPage.tsx`)

Updates include:

- Fetches commentary data via `useSessionCommentary` hook
- Renders `CommentaryTimeline` overlay on progress bar
- Shows `CommentaryCard` modal when bubble is clicked
- Toggle control for showing/hiding commentary

### API Client & Hooks

**API Client** (`/frontend/src/api/transcriptClient.ts`):

```typescript
export async function fetchSessionCommentary(sessionId: string): Promise<CommentaryResponse>;
```

**React Query Hook** (`/frontend/src/hooks/useTranscriptApi.ts`):

```typescript
export function useSessionCommentary(sessionId: string | undefined);
```

## Usage

### Prerequisites

1. **Install claude-mem** (if not already installed):

   ```bash
   npm install -g @anthropic/claude-mem
   ```

2. **Configure claude-mem MCP server** in your Claude Code settings

### Recording Observations

During a Claude Code session, observations are automatically recorded by claude-mem when:

- Important decisions are made
- Features are implemented
- Bugs are fixed
- Insights are discovered

The session ID is automatically associated with each observation.

### Viewing Commentary

1. Open a session in the replay player
2. Commentary bubbles automatically appear on the timeline if observations exist
3. Hover over bubbles to preview
4. Click bubbles to view full details
5. Use the "Commentary" toggle to show/hide bubbles

## Data Flow

```
User Opens Session
       ↓
SessionPlayerPage loads
       ↓
useSessionCommentary hook triggers
       ↓
fetchSessionCommentary API call
       ↓
GET /api/sessions/:id/commentary
       ↓
queryClaudeMemObservations()
       ↓
claude mcp call claude-mem search
       ↓
Parse observations from claude-mem
       ↓
Return commentary data
       ↓
Render CommentaryTimeline on progress bar
```

## Configuration

### Backend Environment Variables

No additional configuration required. The backend automatically:

- Attempts to query claude-mem MCP server
- Falls back gracefully if unavailable
- Returns empty array if no observations found

### Frontend State

Commentary state is managed in `SessionPlayerPage`:

```typescript
const [showCommentary, setShowCommentary] = useState(true);
const [selectedCommentary, setSelectedCommentary] = useState<CommentaryData | null>(null);
```

## Error Handling

The implementation is designed to be fault-tolerant:

1. **MCP Server Unavailable**: Returns empty commentary array
2. **No Observations**: UI gracefully handles empty state
3. **Query Errors**: Logged to console, don't block playback
4. **React Query Retry**: Disabled (`retry: false`) to avoid repeated failures

## Customization

### Adding New Observation Types

1. Update `typeColors` in `CommentaryBubble.tsx`:

   ```typescript
   const typeColors: Record<string, string> = {
     // ... existing types
     custom_type: 'bg-pink-500 hover:bg-pink-600',
   };
   ```

2. Update both `TimelineBubbleIcon` and `CommentaryCard` components

### Changing Bubble Position

Edit `getBubblePosition` function in `CommentaryTimeline` component:

```typescript
const getBubblePosition = (timestamp: number): number => {
  // Custom positioning logic
};
```

### Styling

All styles use Tailwind CSS classes. Key customization points:

- Bubble size: `w-4 h-4` class in `TimelineBubbleIcon`
- Modal width: `max-w-2xl` class in `CommentaryCard`
- Color scheme: `typeColors` objects in both components

## Troubleshooting

### Commentary Not Appearing

1. **Check if claude-mem is installed**:

   ```bash
   claude mcp list
   ```

   Should show `claude-mem` in the list.

2. **Verify observations exist**:

   ```bash
   sqlite3 ~/.claude-mem/memory.db "SELECT COUNT(*) FROM observations WHERE session_id='<SESSION_ID>'"
   ```

3. **Check browser console** for API errors

4. **Verify backend logs** for claude-mem query errors

### Bubbles in Wrong Position

- Check that frame timestamps are correctly ordered
- Verify `getBubblePosition` calculation logic
- Ensure first/last frame timestamps are valid

### Modal Not Closing

- Verify click handler on close button
- Check for z-index conflicts in CSS
- Ensure overlay click handler is working

## Future Enhancements

Possible improvements:

1. Timeline scrubbing to jump to commentary timestamps
2. Filtering by observation type
3. Search/filter commentary
4. Export commentary as markdown
5. Real-time commentary sync during live sessions
6. Custom tags and categorization
7. Collaborative commentary (multi-user)

## Files Modified/Created

### Created:

- `/backend/src/routes/commentary.ts` - Backend API route
- `/frontend/src/components/CommentaryBubble.tsx` - UI components

### Modified:

- `/backend/src/server.ts` - Mount commentary routes
- `/frontend/src/types/transcript.ts` - Add commentary types
- `/frontend/src/api/transcriptClient.ts` - Add API client
- `/frontend/src/hooks/useTranscriptApi.ts` - Add React Query hook
- `/frontend/src/pages/SessionPlayerPage.tsx` - Integrate UI

## API Reference

### GET /api/sessions/:id/commentary

**Parameters**:

- `id` (path): Session UUID

**Response**:

```typescript
interface CommentaryResponse {
  commentary: CommentaryData[];
  total: number;
  sessionId: string;
}

interface CommentaryData {
  id: number;
  timestamp: number;
  frameIndex?: number;
  type: string;
  title: string;
  content: string;
  metadata?: Record<string, any>;
}
```

**Status Codes**:

- 200: Success
- 400: Invalid session ID
- 500: Server error

## Testing

### Manual Testing Steps

1. Start a Claude Code session with claude-mem enabled
2. Perform actions that create observations
3. Complete the session
4. Open session in replay player
5. Verify bubbles appear on timeline
6. Test hover preview
7. Test click to expand
8. Test toggle on/off
9. Test modal close

### Integration Testing

```bash
# Backend
cd backend
npm test

# Frontend
cd frontend
npm test
```

## Performance Considerations

- Commentary data is fetched once per session load
- No retry on failure to avoid performance impact
- Observations are cached by React Query
- Timeline calculations are memoized in component
- Modal uses CSS transforms for smooth animations

## Security Notes

- Session IDs are validated server-side
- No user input is executed in shell commands
- Database access is read-only
- MCP calls are sanitized
- JSON parsing includes error handling
