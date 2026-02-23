---
sidebar_position: 3
---

# Checkpoints

Checkpoints capture the complete file state at any point in a session. This is useful for comparing code states or restoring to a known-good state.

## Creating Checkpoints

1. Open a session in the player
2. Navigate to the frame where you want to create a checkpoint
3. Click the checkpoint button or use the keyboard shortcut
4. Optionally add a name and notes

## What's Captured

When you create a checkpoint, Recall captures:

- **All files touched** - Every file that was read, written, or edited up to that point
- **File contents** - The actual content of each file at that moment
- **Metadata** - Timestamp, frame index, and your custom name/notes

## Comparing Checkpoints

You can diff two checkpoints to see exactly what changed between them:

1. Open the checkpoints panel
2. Select two checkpoints to compare
3. View the side-by-side diff of all changed files

## Use Cases

### Debugging

Something broke after an AI session? Create checkpoints at different points and compare them to find the change that caused the issue.

### Code Review

Create a checkpoint before and after a major change to get a clean diff of what the AI modified.

### Safety Net

Before letting the AI make significant changes, create a checkpoint so you can easily see or restore the previous state.

## API

```bash
# Create checkpoint
POST /api/sessions/:id/checkpoints
Body: { frameIndex: number, name?: string, notes?: string }

# List checkpoints
GET /api/sessions/:id/checkpoints

# Compare checkpoints
GET /api/checkpoints/:id/diff/:otherId
```
