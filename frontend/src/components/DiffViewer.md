# DiffViewer Component

A beautiful, feature-rich side-by-side file diff visualization component for React.

## Features

- **Side-by-side comparison**: View old and new content in a split view
- **Line-by-line highlighting**:
  - Additions highlighted in green
  - Deletions highlighted in red
  - Unchanged lines in neutral gray
- **Line numbers**: Both old and new line numbers displayed
- **Collapsible/Expandable**: Toggle to save screen space
- **View modes**: Switch between split and unified diff views
- **File icons**: Automatic icon assignment based on file extension
- **Statistics**: Shows count of additions and deletions
- **Max height**: Scrollable container with max height of 600px
- **Smart handling**: Automatically detects Edit vs Write tool operations

## Installation

```bash
npm install diff @types/diff
```

## Usage

### Basic Example (Edit Tool)

```tsx
import { DiffViewer } from '../components/DiffViewer';

<DiffViewer
  filePath="/path/to/file.tsx"
  oldContent="const x = 1;"
  newContent="const x = 2;"
  language="typescript"
  isEdit={true}
/>;
```

### Write Tool Example

```tsx
<DiffViewer
  filePath="/path/to/newfile.tsx"
  oldContent={undefined}
  newContent="const greeting = 'Hello World';"
  language="typescript"
  isEdit={false}
/>
```

### Integration with SessionPlayerPage

```tsx
{frame.toolExecution.fileDiff ? (
  <DiffViewer
    filePath={frame.toolExecution.fileDiff.filePath}
    oldContent={frame.toolExecution.fileDiff.oldContent}
    newContent={frame.toolExecution.fileDiff.newContent}
    language={frame.toolExecution.fileDiff.language}
    isEdit={frame.toolExecution.tool === 'Edit'}
  />
) : (
  // Show regular tool output
)}
```

## Props

| Prop         | Type      | Required | Default | Description                                                         |
| ------------ | --------- | -------- | ------- | ------------------------------------------------------------------- |
| `filePath`   | `string`  | Yes      | -       | Path to the file being diffed                                       |
| `oldContent` | `string`  | No       | `''`    | Original content (before changes)                                   |
| `newContent` | `string`  | Yes      | -       | New content (after changes)                                         |
| `language`   | `string`  | Yes      | -       | Programming language for syntax highlighting                        |
| `isEdit`     | `boolean` | No       | `true`  | Whether this is an Edit operation (true) or Write operation (false) |

## View Modes

### Split View (Default)

Shows old and new content side-by-side:

```
┌─────────────────┬─────────────────┐
│     Before      │      After      │
├─────────────────┼─────────────────┤
│ 1  old line 1   │ 1  new line 1   │
│ 2  old line 2   │                 │ (deletion highlighted in red)
│                 │ 2  new line 2   │ (addition highlighted in green)
│ 3  same line    │ 3  same line    │
└─────────────────┴─────────────────┘
```

### Unified View

Shows all changes in a single column with +/- indicators:

```
┌─────────────────────────────┐
│      Unified Diff           │
├─────────────────────────────┤
│ 1    old line 1             │
│ 2  - old line 2             │ (red background)
│ 2  + new line 2             │ (green background)
│ 3    same line              │
└─────────────────────────────┘
```

## File Icons

The component automatically assigns icons based on file extensions:

| Extension       | Icon |
| --------------- | ---- |
| `.ts`           | 📘   |
| `.tsx`, `.jsx`  | ⚛️   |
| `.js`           | 📜   |
| `.py`           | 🐍   |
| `.json`         | 📋   |
| `.md`           | 📝   |
| `.css`          | 🎨   |
| `.html`         | 🌐   |
| `.yml`, `.yaml` | ⚙️   |
| Other           | 📄   |

## Styling

The component uses Tailwind CSS with a dark theme optimized for code viewing:

- Background: `bg-gray-900` / `bg-gray-950`
- Additions: `bg-green-900/30`
- Deletions: `bg-red-900/30`
- Borders: `border-gray-700` / `border-gray-800`
- Text: `text-gray-300`

## Performance

The diff computation is memoized using React's `useMemo` hook, ensuring:

- Recalculation only when oldContent or newContent changes
- Efficient rendering even with large files
- Smooth user interactions

## Accessibility

- Collapsible button has `aria-label` for screen readers
- Semantic HTML structure
- Keyboard navigation friendly
- High contrast colors for readability

## Advanced Features

### Virtual Scrolling

The component sets a max-height of 600px and provides scrolling for larger files, making it performant even with thousands of lines.

### Smart Diff Algorithm

Uses the `diff` library's line-based diffing algorithm:

- Accurately identifies changed, added, and removed lines
- Handles edge cases like empty files
- Preserves line number accuracy

### Responsive Design

The split view maintains equal widths for both panels, ensuring:

- Consistent comparison experience
- Proper alignment of line numbers
- Clean visual hierarchy

## Example Screenshot Layout

```
┌──────────────────────────────────────────────────────────┐
│ ▼ 📘 /path/to/file.ts           +5  -2   [Split][Unified]│
├──────────────────────────────────────────────────────────┤
│                                                           │
│  ┌───────────────────┬───────────────────┐              │
│  │      Before       │       After       │              │
│  ├───────────────────┼───────────────────┤              │
│  │ 1  const x = 1;   │ 1  const x = 2;   │              │
│  │ 2  const y = 3;   │ 2  const y = 3;   │              │
│  │ 3  old line       │                   │ (red bg)     │
│  │                   │ 3  new line       │ (green bg)   │
│  └───────────────────┴───────────────────┘              │
│                                                           │
└──────────────────────────────────────────────────────────┘
```

## License

MIT
