# Syntax Highlighting Implementation

## Overview

Added comprehensive syntax highlighting to the session player using Prism.js with a dark theme that matches the UI.

## What Was Implemented

### 1. Installed Dependencies

```bash
npm install prismjs @types/prismjs
```

### 2. Created CodeBlock Component

**File**: `/Users/fpirzada/Documents/recall/frontend/src/components/CodeBlock.tsx`

Features:

- Syntax highlighting for 25+ programming languages
- Line numbers via Prism plugin
- Dark theme (prism-tomorrow)
- Automatic language detection from file extensions
- Configurable max height with scrolling
- File name header with language badge
- Two main exports:
  - `CodeBlock`: Single code block with syntax highlighting
  - `DiffBlock`: Side-by-side diff view for file changes

### 3. Updated SessionPlayerPage

**File**: `/Users/fpirzada/Documents/recall/frontend/src/pages/SessionPlayerPage.tsx`

Changes:

- Imported `CodeBlock` and `DiffBlock` components
- Added `ToolOutputBlock` helper component for intelligent output rendering
- Updated `FrameRenderer` to use syntax highlighting

### 4. Syntax Highlighting Coverage

#### Tool Execution Output

- **Read tool**: Shows file content with syntax highlighting
- **Write tool**: Shows new file content with highlighting
- **Edit tool**: Shows before/after diff with highlighting
- **Bash tool**: Detects and highlights JSON, code, or shows plain text
- **Grep tool**: Shows search results

#### File Diffs

- Side-by-side view with "Before" and "After" panels
- Separate highlighting for old and new content
- Red/green color coding for deleted/added content
- Language detected from file extension

#### Bash Command Output

- Intelligent detection of code vs. plain text
- JSON detection and highlighting
- Language hints from file extensions in output

### 5. Supported Languages

- **JavaScript/TypeScript**: js, jsx, ts, tsx, mjs, cjs
- **Python**: py, pyw
- **Web**: html, xml, svg, css, scss, sass, less
- **Config**: json, yaml, yml, toml, ini
- **Shell**: sh, bash, zsh, fish
- **Markdown**: md, mdx
- **Systems**: c, h, cpp, cc, cxx, hpp, rs, go
- **Others**: java, cs, php, rb, swift, kt, sql, diff, patch

### 6. Smart Features

#### Language Detection

```typescript
// Automatic detection from file extension
<CodeBlock fileName="src/App.tsx" code={content} />
// Detected language: tsx

// Manual override
<CodeBlock language="python" code={content} />
```

#### Output Truncation

- Limits output to 2000 characters for performance
- Shows truncation notice with total character count
- Maintains readability for large files

#### Error Handling

- Special styling for error output (red border, red text)
- Falls back to plain text if language not supported
- Graceful degradation

## Usage Examples

### Basic Code Block

```tsx
<CodeBlock
  code="const hello = 'world';"
  language="javascript"
  showLineNumbers={true}
  maxHeight="500px"
/>
```

### File Diff

```tsx
<DiffBlock
  oldContent={originalContent}
  newContent={modifiedContent}
  fileName="src/utils/helper.ts"
  language="typescript"
/>
```

### In Session Player

```tsx
{
  frame.toolExecution.fileDiff ? (
    <DiffBlock
      oldContent={frame.toolExecution.fileDiff.oldContent}
      newContent={frame.toolExecution.fileDiff.newContent}
      fileName={frame.toolExecution.fileDiff.filePath}
      language={frame.toolExecution.fileDiff.language}
    />
  ) : (
    <ToolOutputBlock
      tool={frame.toolExecution.tool}
      output={frame.toolExecution.output.content}
      isError={frame.toolExecution.output.isError}
    />
  );
}
```

## Visual Design

### Dark Theme

- Uses Prism Tomorrow theme for syntax colors
- Matches the app's gray-900/gray-950 background
- Proper contrast for readability

### Code Blocks

- Gray-950 background
- Gray-800 borders
- File name header with language badge
- Scrollable with max-height constraints

### Diff Blocks

- Side-by-side layout (grid-cols-2)
- Red tint for "Before" panel
- Green tint for "After" panel
- Synchronized scrolling

## Testing

Build successful:

```bash
npm run build
✓ built in 847ms
```

Dev server starts without errors:

```bash
npm run dev
VITE v6.4.1 ready in 93 ms
```

## Files Modified/Created

### Created

1. `/Users/fpirzada/Documents/recall/frontend/src/components/CodeBlock.tsx`
2. `/Users/fpirzada/Documents/recall/frontend/src/components/CodeBlock.README.md`
3. `/Users/fpirzada/Documents/recall/frontend/SYNTAX_HIGHLIGHTING_IMPLEMENTATION.md`

### Modified

1. `/Users/fpirzada/Documents/recall/frontend/package.json` (added prismjs dependencies)
2. `/Users/fpirzada/Documents/recall/frontend/src/pages/SessionPlayerPage.tsx`

## Next Steps (Optional Enhancements)

1. **Copy to Clipboard**: Add button to copy code blocks
2. **Expand/Collapse**: Toggle for long code blocks
3. **Unified Diff View**: Option for inline diff instead of side-by-side
4. **Language Selector**: Manual override for detected language
5. **Theme Switcher**: Support for light theme
6. **Search in Code**: Highlight search terms in code blocks

## Dependencies

```json
{
  "prismjs": "^1.29.0",
  "@types/prismjs": "^1.26.3"
}
```

## Browser Support

Works in all modern browsers that support:

- ES6+ JavaScript
- CSS Grid (for diff layout)
- Flexbox
- Custom CSS properties
