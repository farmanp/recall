# API Client Quick Reference Card

## Import Paths

```typescript
// Shared types
import type { Session, SessionEvent, SessionListQuery } from '../../../shared/types';

// API client
import { apiClient, ApiClientError } from './api/client';

// React Query hooks
import { useSessions, useSession, useSessionEvents } from './hooks/useApi';
```

## API Client Methods

```typescript
// Health check
const health = await apiClient.healthCheck();

// List sessions
const sessions = await apiClient.listSessions({
  offset: 0,
  limit: 20,
  project: 'my-project',
});

// Get session
const session = await apiClient.getSession(123);

// Get session events
const events = await apiClient.getSessionEvents(123, {
  offset: 0,
  limit: 100,
  types: 'decision,bugfix',
});

// Get specific event
const event = await apiClient.getEvent(123, 'observation', 456);
```

## React Query Hooks

```typescript
// Health check
const { data, isLoading } = useHealthCheck();

// List sessions
const { data, isLoading } = useSessions({ offset: 0, limit: 20 });

// Get session with live updates
const { data } = useLiveSession(sessionId);

// Get session events
const { data } = useSessionEvents(sessionId, { limit: 100 });

// Get all sessions (helper)
const { data } = useAllSessions('my-project');
```

## Error Handling

```typescript
try {
  const session = await apiClient.getSession(123);
} catch (error) {
  if (error instanceof ApiClientError) {
    console.error('Status:', error.statusCode);
    console.error('Message:', error.message);

    if (error.statusCode === 404) {
      // Handle not found
    } else if (error.statusCode === 408) {
      // Handle timeout
    }
  }
}
```

## React Query Provider Setup

```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5000,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <YourApp />
    </QueryClientProvider>
  );
}
```

## Cache Management

```typescript
import { queryKeys } from './hooks/useApi';
import { useQueryClient } from '@tanstack/react-query';

function MyComponent() {
  const queryClient = useQueryClient();

  // Invalidate sessions list
  queryClient.invalidateQueries({ queryKey: queryKeys.sessions() });

  // Invalidate specific session
  queryClient.invalidateQueries({ queryKey: queryKeys.session(123) });

  // Invalidate events
  queryClient.invalidateQueries({ queryKey: queryKeys.sessionEvents(123) });
}
```

## Type Definitions

```typescript
// Session
interface Session {
  id: number;
  claude_session_id: string;
  project: string;
  status: 'active' | 'completed' | 'failed';
  started_at: string;
  // ... more fields
}

// Session Event
interface SessionEvent {
  event_type: 'prompt' | 'observation';
  row_id: number;
  ts: number;
  text: string;
  // ... more fields
}

// Query parameters
interface SessionListQuery {
  offset?: number;
  limit?: number;
  project?: string;
  dateStart?: string;
  dateEnd?: string;
}
```

## Common Patterns

```typescript
// Paginated list
function SessionList() {
  const [page, setPage] = useState(0);
  const pageSize = 20;

  const { data } = useSessions({
    offset: page * pageSize,
    limit: pageSize,
  });

  const totalPages = Math.ceil((data?.total || 0) / pageSize);

  return (
    <div>
      {data?.sessions.map(s => <Item key={s.id} />)}
      <Pagination page={page} total={totalPages} onChange={setPage} />
    </div>
  );
}

// Filtered events
function EventsList({ sessionId }: { sessionId: number }) {
  const [types, setTypes] = useState<string>('');

  const { data } = useSessionEvents(sessionId, {
    types: types || undefined,
    limit: 100,
  });

  return (
    <div>
      <select value={types} onChange={(e) => setTypes(e.target.value)}>
        <option value="">All</option>
        <option value="decision">Decisions</option>
        <option value="bugfix">Bug Fixes</option>
      </select>
      {data?.events.map(e => <Event key={e.row_id} />)}
    </div>
  );
}

// Live session updates
function LiveSessionDetails({ id }: { id: number }) {
  const { data } = useLiveSession(id, 5000); // Refetch every 5s

  return (
    <div>
      <h2>{data?.session.project}</h2>
      <p>Status: {data?.session.status}</p>
      {data?.session.status === 'active' && <LiveIndicator />}
    </div>
  );
}
```

## Configuration

```typescript
// Custom base URL
apiClient.setBaseUrl('https://api.production.com');

// Custom timeout
apiClient.setTimeout(60000); // 60 seconds

// Environment variable
const client = new ApiClient({
  baseUrl: process.env.REACT_APP_API_URL || 'http://localhost:3001',
  timeout: 30000,
});
```

## Testing

```bash
# Test API connectivity
node test-api-client.js

# Expected output:
# ✅ All API client tests passed successfully!
```

## File Locations

| What       | Where                                              |
| ---------- | -------------------------------------------------- |
| Types      | `/shared/types.ts`                                 |
| API Client | `/frontend/src/api/client.ts`                      |
| Hooks      | `/frontend/src/hooks/useApi.ts`                    |
| Examples   | `/frontend/src/examples/SessionViewer.example.tsx` |
| Tests      | `/test-api-client.js`                              |

## Quick Commands

```bash
# Install dependencies
npm install @tanstack/react-query

# Run test
node test-api-client.js

# Check backend
curl http://localhost:3001/api/health

# Start development
npm run dev
```

## Status Indicators

```typescript
// Session status colors
const statusColors = {
  active: 'bg-green-100 text-green-800',
  completed: 'bg-blue-100 text-blue-800',
  failed: 'bg-red-100 text-red-800',
};

// Event type colors
const eventTypeColors = {
  prompt: 'bg-purple-100 text-purple-800',
  observation: 'bg-teal-100 text-teal-800',
};

// Observation type colors
const obsTypeColors = {
  decision: 'bg-yellow-100 text-yellow-800',
  bugfix: 'bg-red-100 text-red-800',
  feature: 'bg-green-100 text-green-800',
  refactor: 'bg-blue-100 text-blue-800',
  discovery: 'bg-indigo-100 text-indigo-800',
  change: 'bg-gray-100 text-gray-800',
};
```

## Troubleshooting

| Issue              | Solution                          |
| ------------------ | --------------------------------- |
| CORS errors        | Enable CORS in backend            |
| Type import errors | Check tsconfig.json paths         |
| Timeout errors     | Increase timeout or check backend |
| 404 errors         | Verify backend is running         |
| Cache issues       | Invalidate query cache            |

## Resources

- API Documentation: `/frontend/API_CLIENT_README.md`
- Setup Guide: `/frontend/SETUP.md`
- Examples: `/frontend/src/examples/SessionViewer.example.tsx`
- Summary: `/API_CLIENT_SUMMARY.md`
- Checklist: `/IMPLEMENTATION_CHECKLIST.md`
