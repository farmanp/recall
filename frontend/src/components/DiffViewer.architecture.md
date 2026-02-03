# DiffViewer Component Architecture

## Component Tree

```
DiffViewer
│
├── Props
│   ├── filePath: string
│   ├── oldContent?: string
│   ├── newContent: string
│   ├── language: string
│   └── isEdit?: boolean
│
├── State
│   ├── isCollapsed: boolean
│   └── viewMode: 'split' | 'unified'
│
├── Computed (useMemo)
│   ├── leftLines: DiffLine[]
│   ├── rightLines: DiffLine[]
│   └── stats: { additions, deletions, unchanged }
│
└── Render Tree
    ├── Container (bg-gray-900, rounded-lg, border)
    │
    ├── Header Section
    │   ├── Left Group
    │   │   ├── Collapse Button (chevron icon)
    │   │   ├── File Icon (emoji)
    │   │   ├── File Path (font-mono)
    │   │   └── Stats Badges
    │   │       ├── Additions (+N green)
    │   │       └── Deletions (-N red)
    │   │
    │   └── Right Group (if !collapsed)
    │       ├── Split Button
    │       └── Unified Button
    │
    └── Content Section (if !collapsed)
        ├── Split View Mode
        │   ├── Left Panel (flex-1)
        │   │   ├── Header ("Before")
        │   │   └── Lines
        │   │       └── For each leftLine
        │   │           ├── Line Number (w-12, right-aligned)
        │   │           └── Content (pre, font-mono)
        │   │
        │   └── Right Panel (flex-1)
        │       ├── Header ("After" or "New File")
        │       └── Lines
        │           └── For each rightLine
        │               ├── Line Number (w-12, right-aligned)
        │               └── Content (pre, font-mono)
        │
        └── Unified View Mode
            ├── Header ("Unified Diff")
            └── Lines
                └── For each merged line
                    ├── Line Number (w-12)
                    ├── Indicator (+/- or blank)
                    └── Content (pre, font-mono)
```

## Data Flow

```
Input Props
    ↓
useMemo Diff Computation
    ↓
┌───────────────────────────────┐
│   Diff Algorithm (diff lib)  │
│   - diffLines(old, new)       │
│   - Analyze changes           │
└───────────────────────────────┘
    ↓
┌───────────────────────────────┐
│   Line Processing             │
│   - Map to DiffLine objects   │
│   - Assign line numbers       │
│   - Track statistics          │
└───────────────────────────────┘
    ↓
┌───────────────────────────────┐
│   Synchronized Arrays         │
│   - leftLines[]               │
│   - rightLines[]              │
│   - stats{}                   │
└───────────────────────────────┘
    ↓
Render Functions
    ├── renderSplitView()
    └── renderUnifiedView()
```

## DiffLine Interface

```typescript
interface DiffLine {
  type: 'added' | 'removed' | 'unchanged';
  content: string;
  oldLineNumber?: number;  // Present for old content lines
  newLineNumber?: number;  // Present for new content lines
}
```

### Example DiffLine Objects

**Unchanged Line:**
```typescript
{
  type: 'unchanged',
  content: 'const x = 1;',
  oldLineNumber: 1,
  newLineNumber: 1
}
```

**Added Line:**
```typescript
{
  type: 'added',
  content: 'const y = 2;',
  oldLineNumber: undefined,
  newLineNumber: 2
}
```

**Removed Line:**
```typescript
{
  type: 'removed',
  content: 'const z = 3;',
  oldLineNumber: 2,
  newLineNumber: undefined
}
```

## Split View Layout

```
┌────────────────────────────────────────────────────────────────┐
│  Header                                                        │
│  ▼ 📘 /path/file.ts    +3  -1         [Split] [Unified]      │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌─────────────────────────┬─────────────────────────┐       │
│  │       Before            │        After            │       │
│  ├─────────────────────────┼─────────────────────────┤       │
│  │ Line# │ Content         │ Line# │ Content         │       │
│  ├───────┼─────────────────┼───────┼─────────────────┤       │
│  │   1   │ const x = 1;    │   1   │ const x = 1;    │ ──┐  │
│  │   2   │ const y = 2;    │       │                 │ ──┤  │
│  │       │                 │   2   │ const z = 3;    │ ──┤  │
│  │   3   │ function foo()  │   3   │ function foo()  │ ──┘  │
│  └───────┴─────────────────┴───────┴─────────────────┘       │
│                                                                │
│  Legend:                                                       │
│  ── unchanged (gray bg)                                        │
│  ── removed (red bg on left)                                   │
│  ── added (green bg on right)                                  │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

## Unified View Layout

```
┌────────────────────────────────────────────────────────────────┐
│  Header                                                        │
│  ▼ 📘 /path/file.ts    +3  -1         [Split] [Unified]      │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │                    Unified Diff                          │ │
│  ├──────────────────────────────────────────────────────────┤ │
│  │ Line# │ ± │ Content                                      │ │
│  ├───────┼───┼──────────────────────────────────────────────┤ │
│  │   1   │   │ const x = 1;                                 │ │
│  │   2   │ - │ const y = 2;              (red bg)           │ │
│  │   2   │ + │ const z = 3;              (green bg)         │ │
│  │   3   │   │ function foo()                               │ │
│  └───────┴───┴──────────────────────────────────────────────┘ │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

## Color System

### Background Colors
```typescript
const bgColors = {
  container: 'bg-gray-900',
  header: 'bg-gray-800',
  codeBlock: 'bg-gray-950',
  unchanged: 'bg-gray-900',
  added: 'bg-green-900/30',      // 30% opacity
  removed: 'bg-red-900/30',      // 30% opacity
};
```

### Text Colors
```typescript
const textColors = {
  primary: 'text-gray-200',      // File path
  secondary: 'text-gray-400',    // Headers
  code: 'text-gray-300',         // Code content
  lineNumbers: 'text-gray-500',  // Line numbers
  additionBadge: 'text-green-300',
  deletionBadge: 'text-red-300',
  additionIndicator: 'text-green-400',
  deletionIndicator: 'text-red-400',
};
```

### Border Colors
```typescript
const borderColors = {
  outer: 'border-gray-700',
  inner: 'border-gray-800',
};
```

## State Management

### isCollapsed State
```typescript
const [isCollapsed, setIsCollapsed] = useState(false);

// When collapsed:
// - Hide content section
// - Hide view mode toggle
// - Show only header with file info

// When expanded:
// - Show content section
// - Show view mode toggle
// - Render diffs
```

### viewMode State
```typescript
const [viewMode, setViewMode] = useState<'split' | 'unified'>('split');

// 'split':
// - Show side-by-side panels
// - Left: old content
// - Right: new content

// 'unified':
// - Show single merged view
// - Use +/- indicators
// - More compact
```

## Diff Computation Algorithm

```typescript
// Step 1: Check if Write tool (no old content)
if (!isEdit || !oldContent) {
  return {
    leftLines: [],
    rightLines: newContent.split('\n').map((line, i) => ({
      type: 'added',
      content: line,
      newLineNumber: i + 1
    })),
    stats: { additions: lineCount, deletions: 0, unchanged: 0 }
  };
}

// Step 2: Compute line diff
const changes = Diff.diffLines(oldContent, newContent);

// Step 3: Process changes into synchronized arrays
let oldLineNum = 1;
let newLineNum = 1;

changes.forEach(change => {
  const lines = change.value.split('\n');

  if (change.added) {
    // Add to right only, empty on left
    lines.forEach(content => {
      leftLines.push({ type: 'unchanged', content: '', oldLineNumber: undefined });
      rightLines.push({ type: 'added', content, newLineNumber: newLineNum++ });
    });
  } else if (change.removed) {
    // Add to left only, empty on right
    lines.forEach(content => {
      leftLines.push({ type: 'removed', content, oldLineNumber: oldLineNum++ });
      rightLines.push({ type: 'unchanged', content: '', newLineNumber: undefined });
    });
  } else {
    // Unchanged: add to both
    lines.forEach(content => {
      leftLines.push({ type: 'unchanged', content, oldLineNumber: oldLineNum++ });
      rightLines.push({ type: 'unchanged', content, newLineNumber: newLineNum++ });
    });
  }
});
```

## Performance Characteristics

### Time Complexity
- Diff computation: O(n + m) where n = old lines, m = new lines
- Rendering: O(max(n, m)) for split view
- Total: O(n + m)

### Space Complexity
- O(n + m) for storing line arrays
- Memoization prevents redundant computation
- Virtual scrolling limits DOM nodes

### Optimization Strategies
1. **useMemo**: Recompute only when content changes
2. **Max Height**: Limit rendered viewport
3. **Lazy Rendering**: Skip content when collapsed
4. **Efficient String Operations**: Single pass through lines

## File Icon Mapping Function

```typescript
const getFileIcon = (path: string): string => {
  const ext = path.split('.').pop()?.toLowerCase();

  const iconMap: Record<string, string> = {
    'ts':   '📘',  // TypeScript
    'tsx':  '⚛️',  // React TypeScript
    'js':   '📜',  // JavaScript
    'jsx':  '⚛️',  // React JavaScript
    'py':   '🐍',  // Python
    'json': '📋',  // JSON
    'md':   '📝',  // Markdown
    'css':  '🎨',  // CSS
    'html': '🌐',  // HTML
    'yml':  '⚙️',  // YAML
    'yaml': '⚙️',  // YAML
  };

  return iconMap[ext || ''] || '📄';  // Default
};
```

## Responsive Design

### Breakpoints (Tailwind)
```css
/* Mobile: stack panels vertically (future enhancement) */
@media (max-width: 768px) {
  .diff-split { flex-direction: column; }
}

/* Desktop: side-by-side */
@media (min-width: 768px) {
  .diff-split { flex-direction: row; }
}
```

### Scroll Behavior
```css
max-height: 600px;
overflow-y: auto;
overflow-x: auto;  /* For long lines */
```

## Accessibility Features

1. **Semantic HTML**: Proper use of divs, buttons, pre tags
2. **ARIA Labels**: Collapse button has aria-label
3. **Keyboard Navigation**: All interactive elements keyboard accessible
4. **Color Contrast**: High contrast text colors
5. **Screen Reader**: Logical tab order and hierarchy

## Integration API

### Import
```typescript
import { DiffViewer } from '../components/DiffViewer';
```

### Usage (Edit Tool)
```tsx
<DiffViewer
  filePath={fileDiff.filePath}
  oldContent={fileDiff.oldContent}
  newContent={fileDiff.newContent}
  language={fileDiff.language}
  isEdit={true}
/>
```

### Usage (Write Tool)
```tsx
<DiffViewer
  filePath={fileDiff.filePath}
  oldContent={undefined}  // or omit
  newContent={fileDiff.newContent}
  language={fileDiff.language}
  isEdit={false}
/>
```

## Testing Strategy

### Unit Tests
- Test diff computation with various inputs
- Test line number assignment
- Test statistics calculation
- Test edge cases (empty files, single line, no changes)

### Integration Tests
- Test with SessionPlayerPage
- Test Edit tool integration
- Test Write tool integration
- Test view mode switching
- Test collapse/expand

### Visual Tests
- Test color scheme
- Test layout responsiveness
- Test scrolling behavior
- Test with large files (100+ lines)

### Edge Cases
- Empty old content
- Empty new content
- No changes (identical files)
- Single line file
- Very long lines
- Binary file indicators
- Special characters
- Unicode content

## Summary

This architecture provides:

✅ **Clean separation of concerns**: Props → Computation → Rendering
✅ **Performance**: Memoization and virtual scrolling
✅ **Flexibility**: Multiple view modes and collapse state
✅ **Maintainability**: Clear data structures and flow
✅ **User Experience**: Intuitive interface and responsive design
✅ **Accessibility**: Keyboard navigation and screen reader support
✅ **Scalability**: Handles large files efficiently
