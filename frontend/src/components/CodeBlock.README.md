# CodeBlock Component

Syntax-highlighted code block component using Prism.js with support for multiple languages and dark theme.

## Features

- **Syntax Highlighting**: Supports 25+ programming languages
- **Line Numbers**: Optional line numbering via Prism plugin
- **Dark Theme**: Uses `prism-tomorrow` theme for dark UI compatibility
- **Language Detection**: Automatic language detection from file extensions
- **Scrolling**: Configurable max height with auto-scrolling
- **File Diffs**: Side-by-side diff view for file changes

## Supported Languages

JavaScript, TypeScript, JSX/TSX, Python, Bash, JSON, YAML, Markdown, CSS, SQL, Java, Go, Rust, C/C++, C#, PHP, Ruby, Swift, Kotlin, HTML/XML, and more.

## Usage

### Basic Code Block

```tsx
import { CodeBlock } from '../components/CodeBlock';

<CodeBlock
  code="const hello = 'world';"
  language="javascript"
  showLineNumbers={true}
  maxHeight="500px"
/>;
```

### Code Block with File Name

```tsx
<CodeBlock code={fileContent} fileName="src/App.tsx" showLineNumbers={true} />
```

### File Diff View

```tsx
import { DiffBlock } from '../components/CodeBlock';

<DiffBlock
  oldContent={originalContent}
  newContent={modifiedContent}
  fileName="src/utils/helper.ts"
  language="typescript"
/>;
```

## Props

### CodeBlock

| Prop              | Type      | Default     | Description                            |
| ----------------- | --------- | ----------- | -------------------------------------- |
| `code`            | `string`  | required    | The code to display                    |
| `language`        | `string`  | `undefined` | Language identifier (js, ts, py, etc.) |
| `showLineNumbers` | `boolean` | `true`      | Show line numbers                      |
| `maxHeight`       | `string`  | `"500px"`   | Maximum height before scrolling        |
| `fileName`        | `string`  | `undefined` | File name (auto-detects language)      |

### DiffBlock

| Prop         | Type     | Default     | Description                 |
| ------------ | -------- | ----------- | --------------------------- |
| `oldContent` | `string` | `undefined` | Original file content       |
| `newContent` | `string` | required    | Modified file content       |
| `fileName`   | `string` | required    | File path/name              |
| `language`   | `string` | `undefined` | Override language detection |

## Language Detection

The component automatically detects languages from file extensions:

- `.js`, `.jsx`, `.ts`, `.tsx` → JavaScript/TypeScript
- `.py` → Python
- `.sh`, `.bash` → Bash
- `.json` → JSON
- `.yaml`, `.yml` → YAML
- `.md` → Markdown
- And many more...

## Styling

The component uses:

- Prism Tomorrow theme (dark)
- Tailwind CSS utility classes
- Custom borders and backgrounds matching the app's dark UI

## Integration with SessionPlayerPage

The CodeBlock is used in three places:

1. **Tool Execution Output**: When tools like `Read`, `Write`, or `Bash` output code
2. **File Diffs**: When showing before/after file changes with `Edit` or `Write`
3. **Bash Command Output**: Intelligently detects JSON, code, or plain text output

## Example in Context

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
