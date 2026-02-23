---
sidebar_position: 6
---

# Rewind (File Restoration)

Restore files to their exact state at any point in a session. This is the "undo" button for AI coding sessions.

## How It Works

1. Navigate to a frame in the session where the files were in a good state
2. Click "Rewind to this point"
3. Preview what files would be changed
4. Execute the rewind

## Safety Features

### Preview Changes

Before any files are modified, you can see exactly what would change:

- Files that would be created
- Files that would be modified (with diff)
- Files that would be deleted

### Automatic Backups

Before executing a rewind, Recall automatically creates backups of all files that will be modified.

### Undo Support

Made a mistake? You can undo the last rewind operation to restore from the automatic backup.

## Selective Restoration

You can choose which files to restore rather than rewinding everything. This is useful when you only want to undo changes to specific files.

## API

```bash
# Preview what would change
POST /api/sessions/:id/rewind/preview
Body: { frameIndex: number }

# Execute rewind
POST /api/sessions/:id/rewind/execute
Body: { frameIndex: number, files?: string[] }

# Undo last rewind
POST /api/sessions/:id/rewind/undo

# Check if undo is available
GET /api/sessions/:id/rewind/undo-info

# Get rewind history
GET /api/sessions/:id/rewind/history
```

## Viewer Mode

When `RECALL_VIEWER_MODE=true`, rewind operations are disabled to prevent accidental file modifications.
