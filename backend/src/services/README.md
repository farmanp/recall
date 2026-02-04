# Transcript Importer Service

Comprehensive service for importing Claude Code session transcripts from `.jsonl` files into a SQLite database for fast querying and playback.

## Features

- **Bulk Import**: Scan and import all transcripts from `~/.claude/projects/` directory
- **Single File Import**: Import individual transcript files
- **Parallel Processing**: Process multiple files concurrently (default: 10 sessions at a time)
- **Progress Tracking**: Real-time progress callbacks and database status tracking
- **Skip Existing**: Automatically skip already-imported sessions (configurable)
- **Error Handling**: Graceful error handling that doesn't stop batch imports
- **Progress Persistence**: Track import status in `parsing_status` table

## Files

- **`transcript-importer.ts`** - Core service with import logic
- **`import-cli.ts`** - CLI tool for running imports
- **`example-import.ts`** - Usage examples and documentation

## Quick Start

### CLI Usage

```bash
# Import all transcripts from default location (~/.claude/projects/)
npm run import

# Import from a specific directory
npm run import -- --source /path/to/transcripts

# Import a single file
npm run import -- --single ~/.claude/projects/my-project/session-123.jsonl

# Import with 20 parallel workers
npm run import -- --parallel 20

# Force re-import (skip existing = false)
npm run import -- --no-skip

# Show import statistics
npm run import -- --stats

# Show help
npm run import -- --help
```

### Programmatic Usage

```typescript
import { bulkImportTranscripts, importTranscript } from './services/transcript-importer';

// Bulk import with progress tracking
const summary = await bulkImportTranscripts({
  sourcePath: '~/.claude/projects',
  parallel: 10,
  skipExisting: true,
  onProgress: (completed, total) => {
    console.log(`Progress: ${completed}/${total}`);
  },
});

console.log(`Imported ${summary.successful} sessions`);

// Import a single file
await importTranscript('/path/to/session.jsonl');
```

## API Reference

### `importTranscript(filePath: string): Promise<void>`

Import a single transcript file into the database.

**Parameters:**

- `filePath` - Absolute path to `.jsonl` transcript file

**Behavior:**

1. Parses the `.jsonl` file using `transcript-parser.ts`
2. Builds a timeline using `timeline-builder.ts`
3. Inserts session metadata into `session_metadata` table
4. Inserts all frames into `playback_frames` table
5. Inserts tool executions into `tool_executions` table
6. Updates `parsing_status` table for progress tracking

**Error Handling:**

- Updates `parsing_status` with error details
- Throws error (doesn't swallow exceptions)

**Example:**

```typescript
try {
  await importTranscript('/Users/me/.claude/projects/my-project/session-123.jsonl');
  console.log('Import successful!');
} catch (error) {
  console.error('Import failed:', error);
}
```

---

### `bulkImportTranscripts(config?: ImportJobConfig): Promise<ImportSummary>`

Bulk import all transcript files from a directory.

**Parameters:**

- `config` (optional) - Import job configuration

**Config Options:**

```typescript
interface ImportJobConfig {
  sourcePath?: string; // default: ~/.claude/projects/
  parallel?: number; // default: 10
  skipExisting?: boolean; // default: true
  onProgress?: (completed: number, total: number) => void;
}
```

**Returns:**

```typescript
interface ImportSummary {
  totalFiles: number;
  successful: number;
  failed: number;
  skipped: number;
  results: ImportResult[];
  duration: number; // milliseconds
}
```

**Behavior:**

1. Scans source directory recursively for `.jsonl` files
2. Processes files in parallel batches
3. Skips already-imported sessions (if `skipExisting: true`)
4. Calls `onProgress` callback after each file
5. Returns comprehensive summary

**Example:**

```typescript
const summary = await bulkImportTranscripts({
  sourcePath: '/Users/me/.claude/projects',
  parallel: 20,
  skipExisting: true,
  onProgress: (completed, total) => {
    const percent = Math.round((completed / total) * 100);
    console.log(`${completed}/${total} (${percent}%)`);
  },
});

console.log(`Total: ${summary.totalFiles}`);
console.log(`Successful: ${summary.successful}`);
console.log(`Failed: ${summary.failed}`);
console.log(`Skipped: ${summary.skipped}`);

// Handle failures
if (summary.failed > 0) {
  summary.results
    .filter((r) => !r.success)
    .forEach((r) => {
      console.error(`Failed: ${r.filePath}`);
      console.error(`Error: ${r.error}`);
    });
}
```

---

### `getImportProgress(): ImportStats`

Get current import statistics from the database.

**Returns:**

```typescript
interface ImportStats {
  total: number;
  pending: number;
  completed: number;
  failed: number;
}
```

**Example:**

```typescript
const stats = getImportProgress();
console.log(`Total: ${stats.total}`);
console.log(`Pending: ${stats.pending}`);
console.log(`Completed: ${stats.completed}`);
console.log(`Failed: ${stats.failed}`);
```

## Database Schema

The importer uses the following tables:

### `session_metadata`

Stores high-level session information for fast listing.

```sql
CREATE TABLE session_metadata (
  session_id TEXT PRIMARY KEY,
  slug TEXT NOT NULL,
  project TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT,
  duration_seconds INTEGER,
  event_count INTEGER NOT NULL DEFAULT 0,
  frame_count INTEGER NOT NULL DEFAULT 0,
  cwd TEXT NOT NULL,
  first_user_message TEXT,
  parsed_at TEXT NOT NULL
);
```

### `playback_frames`

Stores individual frames for session playback.

```sql
CREATE TABLE playback_frames (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  frame_type TEXT NOT NULL,
  timestamp_ms INTEGER NOT NULL,
  duration_ms INTEGER,
  user_message_text TEXT,
  thinking_text TEXT,
  thinking_signature TEXT,
  response_text TEXT,
  cwd TEXT NOT NULL,
  files_read TEXT,
  files_modified TEXT,
  FOREIGN KEY (session_id) REFERENCES session_metadata(session_id)
);
```

### `tool_executions`

Stores tool call details (Bash, Read, Write, Edit, etc.).

```sql
CREATE TABLE tool_executions (
  id TEXT PRIMARY KEY,
  frame_id TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  tool_input TEXT NOT NULL,
  output_content TEXT NOT NULL,
  is_error INTEGER NOT NULL DEFAULT 0,
  exit_code INTEGER,
  FOREIGN KEY (frame_id) REFERENCES playback_frames(id)
);
```

### `file_diffs`

Stores file edits from Write/Edit operations.

```sql
CREATE TABLE file_diffs (
  id TEXT PRIMARY KEY,
  tool_execution_id TEXT NOT NULL,
  file_path TEXT NOT NULL,
  old_content TEXT,
  new_content TEXT NOT NULL,
  language TEXT NOT NULL,
  FOREIGN KEY (tool_execution_id) REFERENCES tool_executions(id)
);
```

### `parsing_status`

Tracks import progress for each session.

```sql
CREATE TABLE parsing_status (
  session_id TEXT PRIMARY KEY,
  transcript_file_path TEXT NOT NULL,
  total_entries INTEGER NOT NULL,
  frames_created INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  started_at TEXT NOT NULL,
  completed_at TEXT,
  error_message TEXT
);
```

## Implementation Details

### Parallel Processing

The bulk importer uses a batching strategy to respect concurrency limits:

```typescript
const batches = chunkArray(files, parallel);
for (const batch of batches) {
  await Promise.all(batch.map((file) => importFile(file)));
}
```

This ensures we never import more than `parallel` sessions at once.

### Skip Existing Sessions

Before importing, the importer checks if a session already exists:

```typescript
const existing = getTranscriptSessionById(sessionId);
if (existing && skipExisting) {
  return { success: true, skipped: true };
}
```

### Error Handling

Errors in individual imports don't stop the batch:

```typescript
const results = await Promise.all(
  batch.map(async (file) => {
    try {
      return await importFile(file);
    } catch (error) {
      return { success: false, error: error.message };
    }
  })
);
```

Failed imports are tracked in the `parsing_status` table with error details.

### Progress Updates

Progress is updated every 100 frames during import:

```typescript
if (framesInserted % 100 === 0) {
  updateParsingStatus(sessionId, {
    frames_created: framesInserted,
  });
}
```

## Performance

- **Parallel Processing**: 10 concurrent imports by default
- **Batch Updates**: Progress updated every 100 frames
- **Skip Existing**: Avoids re-parsing already imported sessions
- **Database Indexes**: Optimized queries on session_id, timestamp, frame_type

Typical performance:

- Single session (~100 frames): ~100-200ms
- Bulk import (100 sessions): ~10-30 seconds (with 10 parallel workers)

## Troubleshooting

### "Directory does not exist"

The default source path is `~/.claude/projects/`. If you have a different location, specify it:

```bash
npm run import -- --source /path/to/claude/projects
```

### Failed imports

Check the import statistics to see failed sessions:

```bash
npm run import -- --stats
```

Query the `parsing_status` table for error details:

```sql
SELECT session_id, error_message
FROM parsing_status
WHERE status = 'failed';
```

### Re-import failed sessions

Force re-import by disabling skip existing:

```bash
npm run import -- --no-skip
```

Or delete the session from the database first:

```sql
DELETE FROM session_metadata WHERE session_id = 'session-123';
DELETE FROM parsing_status WHERE session_id = 'session-123';
```

## Integration

### With Express API

```typescript
import express from 'express';
import { bulkImportTranscripts, getImportProgress } from './services/transcript-importer';

const router = express.Router();

// Trigger bulk import
router.post('/import/start', async (req, res) => {
  try {
    const summary = await bulkImportTranscripts(req.body);
    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get import progress
router.get('/import/status', (req, res) => {
  const stats = getImportProgress();
  res.json(stats);
});
```

### With File Watcher

Automatically import new transcripts as they're created:

```typescript
import { watch } from 'fs';
import { importTranscript } from './services/transcript-importer';

watch('~/.claude/projects/', { recursive: true }, (eventType, filename) => {
  if (filename.endsWith('.jsonl')) {
    importTranscript(filename).catch(console.error);
  }
});
```

## Testing

See `example-import.ts` for usage examples.

To test the importer:

```bash
# Run the example script
npx ts-node src/services/example-import.ts

# Or use the CLI
npm run import -- --help
```

## License

Part of the Recall backend.
