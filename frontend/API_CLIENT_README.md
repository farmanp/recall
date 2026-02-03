# Recall - API Client Library

A fully typed API client library for the Recall frontend application.

## Files Created

### 1. Shared Types (`/shared/types.ts`)
Contains all TypeScript types shared between frontend and backend:
- Database entity types: `Session`, `Observation`, `UserPrompt`
- Event types: `SessionEvent`
- API response types: `SessionListResponse`, `SessionDetailsResponse`, `SessionEventsResponse`, `HealthCheckResponse`
- Query parameter types: `SessionListQuery`, `SessionEventsQuery`
- Error types: `ApiError`
- Frontend utility types

### 2. API Client (`/frontend/src/api/client.ts`)
Type-safe API client with the following features:
- `ApiClient` class with configurable base URL and timeout
- `ApiClientError` class for structured error handling
- Methods for all API endpoints
- Automatic error handling and timeout management
- Query string building helper

### 3. React Query Hooks (`/frontend/src/hooks/useApi.ts`)
React Query hooks for data fetching with caching and state management:
- `useHealthCheck()` - Health check endpoint
- `useSessions(query)` - List sessions with filtering
- `useSession(id)` - Get session details
- `useSessionEvents(id, query)` - Get session events
- `useEvent(sessionId, eventType, eventId)` - Get specific event
- Helper hooks for common use cases
- Live data hooks with auto-refetch

## API Endpoints

### Health Check
```typescript
GET /api/health
Response: { status: 'ok' | 'error', timestamp: number, database?: string }
```

### List Sessions
```typescript
GET /api/sessions?offset=0&limit=20&project=...&dateStart=...&dateEnd=...
Response: { sessions: Session[], total: number, offset: number, limit: number }
```

### Get Session Details
```typescript
GET /api/sessions/:id
Response: { session: Session, eventCount: number, promptCount: number, observationCount: number }
```

### Get Session Events
```typescript
GET /api/sessions/:id/events?offset=0&limit=100&types=...&afterTs=...
Response: { events: SessionEvent[], total: number, offset: number, limit: number, sessionId: string }
```

### Get Specific Event
```typescript
GET /api/sessions/:sessionId/events/:eventType/:eventId
Response: SessionEvent | Observation | UserPrompt
```

## Usage Examples

### Using the API Client Directly

```typescript
import { apiClient } from './api/client';

// Health check
const health = await apiClient.healthCheck();

// List sessions
const sessions = await apiClient.listSessions({
  offset: 0,
  limit: 20,
  project: 'my-project'
});

// Get session details
const sessionDetails = await apiClient.getSession(123);

// Get session events
const events = await apiClient.getSessionEvents(123, {
  offset: 0,
  limit: 100,
  types: 'decision,bugfix'
});

// Get specific event
const event = await apiClient.getEvent(123, 'observation', 456);

// Error handling
try {
  const session = await apiClient.getSession(999999);
} catch (error) {
  if (error instanceof ApiClientError) {
    console.error('API Error:', error.message);
    console.error('Status Code:', error.statusCode);
  }
}
```

### Using React Query Hooks

```typescript
import {
  useHealthCheck,
  useSessions,
  useSession,
  useSessionEvents,
  useEvent,
  useLiveSession,
} from './hooks/useApi';

// In a React component
function SessionList() {
  // List sessions with pagination
  const { data, isLoading, error } = useSessions({
    offset: 0,
    limit: 20,
    project: 'my-project'
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      {data.sessions.map(session => (
        <SessionItem key={session.id} session={session} />
      ))}
    </div>
  );
}

function SessionDetails({ sessionId }: { sessionId: number }) {
  // Get session details with auto-refetch for active sessions
  const { data: session } = useLiveSession(sessionId);
  const { data: events } = useSessionEvents(sessionId, { limit: 100 });

  return (
    <div>
      <h1>{session?.session.project}</h1>
      <p>Status: {session?.session.status}</p>
      <p>Events: {session?.eventCount}</p>

      {events?.events.map(event => (
        <EventItem key={`${event.event_type}-${event.row_id}`} event={event} />
      ))}
    </div>
  );
}

function HealthStatus() {
  const { data, isError } = useHealthCheck({
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  return (
    <div>
      Status: {isError ? '🔴 Down' : '🟢 Up'}
      {data && <span> (DB: {data.database})</span>}
    </div>
  );
}
```

### Advanced Usage

```typescript
// Custom API client instance with different base URL
import { ApiClient } from './api/client';

const customClient = new ApiClient({
  baseUrl: 'https://api.example.com',
  timeout: 60000, // 60 seconds
});

// Dynamic base URL updates
apiClient.setBaseUrl('http://localhost:3001');

// Using query keys for cache invalidation
import { queryKeys } from './hooks/useApi';
import { useQueryClient } from '@tanstack/react-query';

function MyComponent() {
  const queryClient = useQueryClient();

  // Invalidate sessions list cache
  queryClient.invalidateQueries({ queryKey: queryKeys.sessions() });

  // Invalidate specific session cache
  queryClient.invalidateQueries({ queryKey: queryKeys.session(123) });
}
```

## Testing the API Client

### Run the JavaScript Test
```bash
cd /Users/fpirzada/Documents/cc_mem_video_player
node test-api-client.js
```

This will test all API endpoints and verify:
- Health check is working
- Sessions can be listed
- Session details can be retrieved
- Events can be fetched
- Specific events can be accessed
- Error handling works correctly

### Expected Test Output
```
Starting API Client Tests...

1. Testing Health Check...
   ✓ Health Check: { status: 'ok', timestamp: '...', database: 'connected' }

2. Testing List Sessions...
   ✓ Found X total sessions
   ✓ Returned Y sessions
   ✓ First session ID: ...
   ✓ First session status: ...

...

✅ All API client tests passed successfully!
```

## Type Safety

All API calls are fully typed:

```typescript
// TypeScript will catch errors at compile time
const sessions = await apiClient.listSessions({
  offset: 0,
  limit: 20,
  invalidParam: 'test' // ❌ Type error: invalidParam doesn't exist
});

// Response types are inferred
const health = await apiClient.healthCheck();
health.status // ✓ Type: 'ok' | 'error'
health.timestamp // ✓ Type: number
health.invalidField // ❌ Type error: Property doesn't exist

// Query parameters are typed
const { data } = useSessions({
  offset: 0,
  limit: 'not-a-number' // ❌ Type error: limit must be number
});
```

## Error Handling

The API client provides structured error handling:

```typescript
import { ApiClientError } from './api/client';

try {
  const session = await apiClient.getSession(123);
} catch (error) {
  if (error instanceof ApiClientError) {
    // Structured error with status code and response
    console.error('Status:', error.statusCode);
    console.error('Message:', error.message);
    console.error('Response:', error.response);

    // Handle specific errors
    if (error.statusCode === 404) {
      console.log('Session not found');
    } else if (error.statusCode === 408) {
      console.log('Request timeout');
    }
  }
}
```

## Configuration

### Default Configuration
- Base URL: `http://localhost:3001`
- Timeout: 30 seconds

### Custom Configuration
```typescript
import { ApiClient } from './api/client';

const apiClient = new ApiClient({
  baseUrl: process.env.REACT_APP_API_URL || 'http://localhost:3001',
  timeout: 60000, // 60 seconds
});
```

## Dependencies

Required packages (should be installed in the frontend):
- `@tanstack/react-query` - For React Query hooks
- TypeScript 4.5+ - For type support

## Next Steps

1. Install React Query in the frontend:
   ```bash
   npm install @tanstack/react-query
   ```

2. Set up React Query provider in your app:
   ```typescript
   import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

   const queryClient = new QueryClient();

   function App() {
     return (
       <QueryClientProvider client={queryClient}>
         <YourApp />
       </QueryClientProvider>
     );
   }
   ```

3. Import and use the hooks in your components:
   ```typescript
   import { useSessions, useSession } from './hooks/useApi';
   ```

4. Run the test script to verify everything works:
   ```bash
   node test-api-client.js
   ```

## Files Summary

- **`/shared/types.ts`** - Shared TypeScript types (374 lines)
- **`/frontend/src/api/client.ts`** - API client implementation (209 lines)
- **`/frontend/src/hooks/useApi.ts`** - React Query hooks (169 lines)
- **`/frontend/src/api/client.test.ts`** - TypeScript test file (95 lines)
- **`/test-api-client.js`** - JavaScript test script (101 lines)

Total: ~950 lines of fully typed, tested API client code.
