# Backend Test Suite Documentation

## Overview

This comprehensive test suite validates the backend API for the Recall application. The suite includes unit tests, integration tests, and API endpoint tests with >80% code coverage target.

## Test Structure

```
backend/src/__tests__/
├── setup.ts                    # Global test setup and test database creation
├── db/
│   └── queries.test.ts        # Database query function tests
├── routes/
│   └── sessions.test.ts       # API endpoint tests with supertest
└── server.test.ts             # Server creation and middleware tests
```

## Testing Stack

- **Vitest**: Fast, modern test runner with native TypeScript support
- **Supertest**: HTTP assertion library for testing Express routes
- **@vitest/ui**: Interactive test UI for development
- **@vitest/coverage-v8**: Code coverage reporting using V8

## Test Categories

### 1. Database Query Tests (`db/queries.test.ts`)

Tests all database query functions with focus on:

- **getSessions**: Pagination, filtering by project, date range ordering
- **getSessionById**: Valid/invalid session retrieval
- **getSessionStats**: Event count calculations
- **getSessionEvents**: TIME-FIRST ordering validation, JSON parsing, filtering
- **getEventById**: Prompt and observation retrieval
- **getProjects**: Project list retrieval
- **JSON Parsing**: Validation of array field parsing (facts, concepts, files_read, files_modified)
- **Error Handling**: Graceful handling of missing data

**Key Validation:**

- TIME-FIRST ordering (ts ASC, then prompt_number ASC, then kind_rank ASC)
- JSON field parsing for observation fields
- Correct pagination and filtering
- Database connection and read-only mode

### 2. API Route Tests (`routes/sessions.test.ts`)

Tests all REST API endpoints using supertest:

- **GET /api/sessions**: List sessions with filtering and pagination
- **GET /api/sessions/:id**: Get session details with statistics
- **GET /api/sessions/:id/events**: Get session timeline events
- **GET /api/sessions/:sessionId/events/:eventType/:eventId**: Get individual event
- **GET /api/sessions/meta/projects**: Get project list

**Key Validation:**

- HTTP status codes (200, 404, 400, 500)
- Response structure and data types
- Query parameter handling
- Error responses
- TIME-FIRST ordering in event endpoints
- JSON parsing validation
- CORS headers

### 3. Server Tests (`server.test.ts`)

Tests Express server creation and middleware:

- **Server Creation**: App instantiation and configuration
- **Middleware**: CORS, JSON parsing, request logging
- **Health Check**: /api/health endpoint
- **Route Mounting**: Proper route registration
- **Error Handling**: 404s, malformed requests
- **Concurrent Requests**: Server reliability under load
- **Response Headers**: Content-Type, CORS headers

## Running Tests

### Run All Tests

```bash
npm test
```

### Run Tests with UI

```bash
npm run test:ui
```

### Run Tests with Coverage

```bash
npm run test:coverage
```

### Run Tests in Watch Mode

```bash
npm test -- --watch
```

### Run Specific Test File

```bash
npm test -- queries.test.ts
```

### Run Tests Matching Pattern

```bash
npm test -- --grep "TIME-FIRST"
```

## Test Database

The test suite uses a dedicated test database created in `src/__tests__/.claude-mem/claude-mem.db`. This database is:

- Created before all tests run
- Populated with test data (2 sessions, 2 prompts, 2 observations)
- Cleaned up after all tests complete
- Isolated from production data

### Test Data Structure

**Sessions:**

- `session-1`: Active session with 2 prompts and 2 observations
- `session-2`: Completed session from 1 hour ago

**Prompts:**

- Prompt 1: "Create a test suite" (ts: now + 1000)
- Prompt 2: "Add more tests" (ts: now + 3000)

**Observations:**

- Feature observation with JSON fields (ts: now + 2000)
- Decision observation without JSON fields (ts: now + 4000)

## Coverage Thresholds

The test suite enforces minimum coverage thresholds:

- **Lines**: 80%
- **Functions**: 80%
- **Branches**: 80%
- **Statements**: 80%

Coverage reports are generated in:

- `coverage/` - HTML report (open `coverage/index.html` in browser)
- Console output with summary

## Key Test Validations

### TIME-FIRST Ordering

The most critical validation is the TIME-FIRST ordering of events:

```typescript
ORDER BY
  ts ASC,                           // Primary: timestamp ascending
  COALESCE(prompt_number, 999999) ASC,  // Secondary: prompt number
  kind_rank ASC,                    // Tertiary: prompts (0) before observations (1)
  row_id ASC                        // Tie-breaker
```

Tests verify:

1. Events are ordered by timestamp first
2. Within same timestamp, prompt_number orders events
3. Within same timestamp+prompt_number, prompts come before observations
4. Row ID breaks any remaining ties

### JSON Parsing

Tests validate that JSON string fields are properly parsed to arrays:

- `facts`: JSON array → string[]
- `concepts`: JSON array → string[]
- `files_read`: JSON array → string[]
- `files_modified`: JSON array → string[]

Tests verify:

- Valid JSON is parsed correctly
- Null values remain undefined
- Invalid JSON returns undefined (graceful handling)

## Test Execution Flow

1. **Setup Phase** (`setup.ts`):
   - Override HOME env var to point to test directory
   - Create test database directory
   - Initialize SQLite database
   - Create schema (sdk_sessions, observations, user_prompts)
   - Insert test data

2. **Test Execution**:
   - Each test suite runs independently
   - Database connection is closed/reopened between tests
   - Supertest creates new app instance per test

3. **Teardown Phase** (`setup.ts`):
   - Delete test database
   - Remove test directory
   - Clean up resources

## Troubleshooting

### Tests Fail with "Database not found"

Ensure the setup file is running correctly:

```bash
# Check if setup.ts is in setupFiles
cat vitest.config.ts | grep setupFiles
```

### Coverage Below 80%

Run coverage report to see uncovered lines:

```bash
npm run test:coverage
open coverage/index.html
```

### Tests Timeout

Increase timeout in vitest.config.ts:

```typescript
test: {
  testTimeout: 10000; // 10 seconds
}
```

### Database Lock Errors

Ensure database connections are properly closed:

```typescript
afterEach(() => {
  closeDatabase();
});
```

## Best Practices

1. **Isolation**: Each test is independent and can run in any order
2. **Cleanup**: Always close database connections in afterEach hooks
3. **Assertions**: Use specific assertions (toBe, toEqual, toContain)
4. **Descriptive Names**: Test names clearly describe what is being tested
5. **Arrange-Act-Assert**: Follow AAA pattern in all tests
6. **Edge Cases**: Test both happy paths and error conditions

## Adding New Tests

When adding new features, follow this pattern:

1. **Add to setup.ts** if new test data is needed
2. **Create test file** in appropriate directory (db/, routes/, or root)
3. **Import dependencies**: vitest, supertest, types
4. **Setup/teardown**: Use beforeEach/afterEach for cleanup
5. **Write tests**: Cover happy path, edge cases, errors
6. **Run coverage**: Ensure new code is covered

Example:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { myNewFunction } from '../myModule';

describe('My New Feature', () => {
  beforeEach(() => {
    // Setup
  });

  afterEach(() => {
    // Cleanup
  });

  it('should do something', () => {
    // Arrange
    const input = 'test';

    // Act
    const result = myNewFunction(input);

    // Assert
    expect(result).toBe('expected');
  });
});
```

## Continuous Integration

For CI/CD pipelines, use:

```bash
npm test -- --run --coverage
```

This runs tests once (no watch mode) and generates coverage reports.

## Test Metrics

Current test suite includes:

- **Total Test Files**: 3
- **Total Test Cases**: 100+
- **Database Tests**: 50+
- **Route Tests**: 40+
- **Server Tests**: 20+
- **Coverage Target**: >80%

## Future Enhancements

Potential improvements for the test suite:

1. **Performance Tests**: Add benchmarks for query performance
2. **Load Tests**: Stress test with concurrent requests
3. **Snapshot Tests**: Validate response structures don't change
4. **Integration Tests**: Test with real claude-mem database
5. **E2E Tests**: Test with frontend integration
6. **Security Tests**: Validate input sanitization
7. **Database Migration Tests**: Test schema changes

## References

- [Vitest Documentation](https://vitest.dev)
- [Supertest Documentation](https://github.com/visionmedia/supertest)
- [Better-sqlite3 Documentation](https://github.com/WiseLibs/better-sqlite3)
- [Express Testing Best Practices](https://expressjs.com/en/advanced/best-practice-performance.html)
