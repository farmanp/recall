/**
 * ToolCard Component
 *
 * Expandable card for displaying tool executions in the transcript view.
 * Collapsed state shows tool name, file path, and status.
 * Expanded state shows input parameters and output with specialized viewers.
 */

import React from 'react';
import {
  ChevronRight,
  ChevronDown,
  Terminal,
  FileText,
  FilePen,
  FileCode,
  Eye,
  AlertCircle,
  CheckCircle,
  Clock,
  Search,
  Folder,
} from 'lucide-react';
import type { ToolExecution } from '../../../types/transcript';
import { CodeBlock } from '../../CodeBlock';
import { DiffViewer } from '../../DiffViewer';
import {
  isReadTool,
  isWriteTool,
  isEditTool,
  isShellTool,
} from '../../../utils/tool-normalization';
import { highlightText } from '../../../lib/frameSearch';

interface ToolCardProps {
  toolExecution: ToolExecution;
  timestamp: string;
  frameIndex: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onNavigateToFrame: (index: number) => void;
  searchQuery?: string;
}

/**
 * Get the appropriate icon for a tool
 */
function getToolIcon(toolName: string): React.ReactNode {
  if (isShellTool(toolName)) {
    return <Terminal className="w-4 h-4" />;
  }
  if (isEditTool(toolName)) {
    return <FilePen className="w-4 h-4" />;
  }
  if (isWriteTool(toolName)) {
    return <FileCode className="w-4 h-4" />;
  }
  if (isReadTool(toolName)) {
    return <Eye className="w-4 h-4" />;
  }
  // Search tools
  if (toolName === 'Grep' || toolName === 'Glob') {
    return <Search className="w-4 h-4" />;
  }
  // Default
  return <FileText className="w-4 h-4" />;
}

/**
 * Get color class for tool category
 */
function getToolColor(toolName: string): string {
  if (isShellTool(toolName)) {
    return 'text-accent-purple';
  }
  if (isEditTool(toolName)) {
    return 'text-accent-amber';
  }
  if (isWriteTool(toolName)) {
    return 'text-accent-green';
  }
  if (isReadTool(toolName)) {
    return 'text-accent-cyan';
  }
  return 'text-forensic-text-secondary';
}

/**
 * Extract file path from tool input params
 */
function extractFilePath(input: Record<string, unknown>): string | null {
  // Check common path parameter names across different agents
  const pathKeys = [
    'file_path',
    'filePath',
    'path',
    'notebook_path',
    'file',
    'filename',
    'command',
  ];
  for (const key of pathKeys) {
    if (typeof input[key] === 'string') {
      return input[key] as string;
    }
  }
  return null;
}

/**
 * Get language from file path
 */
function getLanguageFromPath(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase();
  const langMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'tsx',
    js: 'javascript',
    jsx: 'jsx',
    py: 'python',
    json: 'json',
    yaml: 'yaml',
    yml: 'yaml',
    md: 'markdown',
    css: 'css',
    html: 'markup',
    sh: 'bash',
    bash: 'bash',
    sql: 'sql',
    rs: 'rust',
    go: 'go',
  };
  return langMap[ext || ''] || 'plaintext';
}

export const ToolCard: React.FC<ToolCardProps> = ({
  toolExecution,
  timestamp,
  frameIndex,
  isExpanded,
  onToggleExpand,
  searchQuery = '',
}) => {
  const { tool, input, output, fileDiff } = toolExecution;
  const isError = output.isError;
  const filePath = extractFilePath(input);
  const language = filePath ? getLanguageFromPath(filePath) : 'plaintext';

  // Status badge
  const statusBadge = isError ? (
    <span className="flex items-center gap-1 px-2 py-0.5 bg-accent-red/20 text-accent-red text-xs font-medium rounded border border-accent-red/30">
      <AlertCircle className="w-3 h-3" />
      Failed
    </span>
  ) : (
    <span className="flex items-center gap-1 px-2 py-0.5 bg-accent-green/20 text-accent-green text-xs font-medium rounded border border-accent-green/30">
      <CheckCircle className="w-3 h-3" />
      Success
    </span>
  );

  // Collapsed header content
  const headerContent = (
    <div className="flex items-center gap-3 flex-1 min-w-0">
      {/* Expand/Collapse icon */}
      <span className="text-forensic-text-muted flex-shrink-0">
        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </span>

      {/* Tool icon */}
      <span className={`flex-shrink-0 ${getToolColor(tool)}`}>{getToolIcon(tool)}</span>

      {/* Tool name */}
      <span className={`font-mono text-sm font-semibold ${getToolColor(tool)}`}>{tool}</span>

      {/* File path (if applicable) */}
      {filePath && (
        <span className="font-mono text-xs text-forensic-text-secondary truncate flex items-center gap-1">
          <Folder className="w-3 h-3 flex-shrink-0" />
          <span className="truncate">{filePath}</span>
        </span>
      )}
    </div>
  );

  return (
    <div
      className={`border rounded-lg overflow-hidden transition-all ${
        isError
          ? 'border-accent-red/30 bg-accent-red/5'
          : 'border-forensic-border bg-forensic-bg-secondary hover:border-forensic-border-hover'
      }`}
    >
      {/* Collapsed Header - Always visible */}
      <button
        onClick={onToggleExpand}
        className="w-full flex items-center justify-between p-3 hover:bg-forensic-bg-tertiary/50 transition-colors text-left"
      >
        {headerContent}

        {/* Right side: timestamp, frame #, status */}
        <div className="flex items-center gap-3 flex-shrink-0 ml-2">
          <span className="font-mono text-xs text-forensic-text-muted flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {timestamp}
          </span>
          <span className="font-mono text-xs text-forensic-text-muted">#{frameIndex}</span>
          {statusBadge}
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-forensic-border bg-forensic-bg-primary">
          {/* Input Parameters */}
          <div className="p-4 border-b border-forensic-border">
            <span className="font-mono text-[10px] uppercase tracking-wide text-forensic-text-muted block mb-2">
              // Input Parameters
            </span>
            <CodeBlock
              code={JSON.stringify(input, null, 2)}
              language="json"
              showLineNumbers={false}
              maxHeight="200px"
            />
          </div>

          {/* Output */}
          <div className="p-4">
            <span className="font-mono text-[10px] uppercase tracking-wide text-forensic-text-muted block mb-2">
              // Output
            </span>

            {/* Edit tool with diff */}
            {isEditTool(tool) && fileDiff ? (
              <DiffViewer
                filePath={fileDiff.filePath}
                oldContent={fileDiff.oldContent}
                newContent={fileDiff.newContent}
                language={fileDiff.language || language}
                isEdit={true}
              />
            ) : isWriteTool(tool) && fileDiff ? (
              /* Write tool - show new content only */
              <DiffViewer
                filePath={fileDiff.filePath}
                newContent={fileDiff.newContent}
                language={fileDiff.language || language}
                isEdit={false}
              />
            ) : isReadTool(tool) || isWriteTool(tool) ? (
              /* Read tool - show content with syntax highlighting */
              <CodeBlock
                code={output.content || '// No output'}
                language={language}
                showLineNumbers={true}
                maxHeight="400px"
              />
            ) : isShellTool(tool) ? (
              /* Shell tool - show command output */
              <div className="space-y-2">
                {/* Command */}
                {input.command && (
                  <div className="bg-forensic-bg-tertiary border border-forensic-border rounded p-3">
                    <span className="font-mono text-xs text-accent-green">$</span>
                    <span className="font-mono text-sm text-forensic-text-primary ml-2">
                      {searchQuery
                        ? highlightText(String(input.command), searchQuery)
                        : String(input.command)}
                    </span>
                  </div>
                )}
                {/* Output */}
                <CodeBlock
                  code={output.content || '// No output'}
                  language="bash"
                  showLineNumbers={false}
                  maxHeight="400px"
                />
                {/* Exit code if error */}
                {isError && output.exitCode !== undefined && (
                  <div className="text-xs text-accent-red font-mono">
                    Exit code: {output.exitCode}
                  </div>
                )}
              </div>
            ) : (
              /* Generic tool output */
              <CodeBlock
                code={output.content || '// No output'}
                language="plaintext"
                showLineNumbers={false}
                maxHeight="400px"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};
