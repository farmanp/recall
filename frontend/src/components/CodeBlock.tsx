/**
 * CodeBlock Component
 *
 * Syntax-highlighted code block with line numbers and scrolling support
 */

import React, { useRef, useMemo, useCallback } from 'react';
import Prism from 'prismjs';
import { useVirtualizer } from '@tanstack/react-virtual';

// Import core Prism themes
import 'prismjs/themes/prism-tomorrow.css';

// Import language support
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-yaml';
import 'prismjs/components/prism-markdown';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-go';
import 'prismjs/components/prism-rust';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-cpp';
import 'prismjs/components/prism-csharp';
import 'prismjs/components/prism-php';
import 'prismjs/components/prism-ruby';
import 'prismjs/components/prism-swift';
import 'prismjs/components/prism-kotlin';
import 'prismjs/components/prism-xml-doc';
import 'prismjs/components/prism-markup';
import 'prismjs/components/prism-diff';

// Import line numbers plugin
import 'prismjs/plugins/line-numbers/prism-line-numbers';
import 'prismjs/plugins/line-numbers/prism-line-numbers.css';

interface CodeBlockProps {
  code: string;
  language?: string;
  showLineNumbers?: boolean;
  maxHeight?: string;
  fileName?: string;
}

/**
 * Maps file extensions to Prism language identifiers
 */
const getLanguageFromExtension = (fileName: string): string => {
  const ext = fileName.split('.').pop()?.toLowerCase();

  const extensionMap: Record<string, string> = {
    // JavaScript/TypeScript
    js: 'javascript',
    jsx: 'jsx',
    ts: 'typescript',
    tsx: 'tsx',
    mjs: 'javascript',
    cjs: 'javascript',

    // Python
    py: 'python',
    pyw: 'python',

    // Web
    html: 'markup',
    htm: 'markup',
    xml: 'markup',
    svg: 'markup',
    css: 'css',
    scss: 'css',
    sass: 'css',
    less: 'css',

    // Config/Data
    json: 'json',
    yaml: 'yaml',
    yml: 'yaml',
    toml: 'toml',
    ini: 'ini',

    // Shell
    sh: 'bash',
    bash: 'bash',
    zsh: 'bash',
    fish: 'bash',

    // Markdown
    md: 'markdown',
    mdx: 'markdown',

    // Systems languages
    c: 'c',
    h: 'c',
    cpp: 'cpp',
    cc: 'cpp',
    cxx: 'cpp',
    hpp: 'cpp',
    rs: 'rust',
    go: 'go',

    // Other languages
    java: 'java',
    cs: 'csharp',
    php: 'php',
    rb: 'ruby',
    swift: 'swift',
    kt: 'kotlin',
    sql: 'sql',

    // Others
    diff: 'diff',
    patch: 'diff',
  };

  return extensionMap[ext || ''] || 'plaintext';
};

/**
 * Normalizes language identifier to Prism-compatible name
 */
const normalizeLanguage = (lang?: string): string => {
  if (!lang) return 'plaintext';

  const normalized = lang.toLowerCase();

  // Handle common aliases
  const aliasMap: Record<string, string> = {
    shell: 'bash',
    console: 'bash',
    terminal: 'bash',
    js: 'javascript',
    ts: 'typescript',
    py: 'python',
    rb: 'ruby',
    yml: 'yaml',
    html: 'markup',
    xml: 'markup',
    svg: 'markup',
  };

  return aliasMap[normalized] || normalized;
};

export const CodeBlock: React.FC<CodeBlockProps> = ({
  code,
  language,
  showLineNumbers = true,
  maxHeight = '500px',
  fileName,
}) => {
  // Determine the language to use
  const detectedLanguage = fileName
    ? getLanguageFromExtension(fileName)
    : normalizeLanguage(language);

  const prismLanguage = normalizeLanguage(detectedLanguage);

  // Check if language is supported by Prism
  const grammar = Prism.languages[prismLanguage];

  // Escape HTML to prevent XSS when displaying plain text
  const escapeHtml = (text: string): string => {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  };

  // Highlight cache
  const highlightCache = useRef<Record<string, string>>({});

  const highlightLine = useCallback((lineText: string): string => {
    if (!lineText || lineText.trim() === '') return '\u00A0';

    const cacheKey = `${prismLanguage}:${lineText}`;
    if (highlightCache.current[cacheKey]) return highlightCache.current[cacheKey];

    let result: string;
    if (!grammar) {
      result = escapeHtml(lineText);
    } else {
      try {
        result = Prism.highlight(lineText, grammar, prismLanguage);
      } catch (e) {
        result = escapeHtml(lineText);
      }
    }

    highlightCache.current[cacheKey] = result;
    return result;
  }, [grammar, prismLanguage]);

  const lines = useMemo(() => code.split('\n'), [code]);
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: lines.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 24,
    overscan: 10,
  });

  return (
    <div className="code-block-wrapper rounded-lg overflow-hidden bg-gray-950 border border-gray-800">
      {fileName && (
        <div className="bg-gray-900 px-4 py-2 border-b border-gray-800 flex items-center justify-between">
          <span className="text-xs text-gray-400 font-mono">{fileName}</span>
          <span className="text-xs text-gray-500 uppercase">{detectedLanguage}</span>
        </div>
      )}

      <div
        ref={parentRef}
        className="overflow-auto bg-gray-950 font-mono text-sm leading-relaxed"
        style={{ maxHeight }}
      >
        <div
          className="relative w-full"
          style={{ height: `${virtualizer.getTotalSize()}px` }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => (
            <div
              key={virtualRow.key}
              data-index={virtualRow.index}
              className="absolute top-0 left-0 w-full flex hover:bg-white/5 transition-colors group"
              style={{
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              {showLineNumbers && (
                <div className="w-12 flex-shrink-0 text-right pr-4 text-gray-600 select-none border-r border-gray-800 bg-gray-900/30 font-mono text-xs py-1">
                  {virtualRow.index + 1}
                </div>
              )}
              <div className="flex-1 px-4 overflow-hidden py-1">
                <pre style={{ margin: 0, background: 'transparent' }}>
                  <code
                    className={grammar ? `language-${prismLanguage}` : 'language-plaintext'}
                    style={{ background: 'transparent', textShadow: 'none' }}
                    dangerouslySetInnerHTML={{ __html: highlightLine(lines[virtualRow.index]) }}
                  />
                </pre>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/**
 * DiffBlock Component for side-by-side file diffs
 */
interface DiffBlockProps {
  oldContent?: string;
  newContent: string;
  fileName: string;
  language?: string;
}

export const DiffBlock: React.FC<DiffBlockProps> = ({
  oldContent,
  newContent,
  fileName,
  language,
}) => {
  const detectedLanguage = getLanguageFromExtension(fileName);
  const displayLanguage = language || detectedLanguage;

  // If no old content, just show the new content
  if (!oldContent) {
    return (
      <CodeBlock
        code={newContent}
        language={displayLanguage}
        fileName={fileName}
        showLineNumbers={true}
      />
    );
  }

  // Show side-by-side diff
  return (
    <div className="diff-block-wrapper">
      <div className="bg-gray-900 px-4 py-2 border-b border-gray-800">
        <span className="text-xs text-gray-400 font-mono">{fileName}</span>
      </div>

      <div className="grid grid-cols-2 gap-0">
        {/* Old content */}
        <div className="border-r border-gray-800">
          <div className="bg-red-950 bg-opacity-30 px-4 py-1 border-b border-gray-800">
            <span className="text-xs text-red-400">Before</span>
          </div>
          <CodeBlock
            code={oldContent}
            language={displayLanguage}
            showLineNumbers={true}
            maxHeight="400px"
          />
        </div>

        {/* New content */}
        <div>
          <div className="bg-green-950 bg-opacity-30 px-4 py-1 border-b border-gray-800">
            <span className="text-xs text-green-400">After</span>
          </div>
          <CodeBlock
            code={newContent}
            language={displayLanguage}
            showLineNumbers={true}
            maxHeight="400px"
          />
        </div>
      </div>
    </div>
  );
};
