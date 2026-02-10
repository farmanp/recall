/**
 * Hook for aggregating file artifacts from PlaybackFrame array
 *
 * Tracks files that were created, modified, or read during a session,
 * supporting both cumulative (up to current position) and full session views.
 */

import { useMemo } from 'react';
import type { PlaybackFrame } from '../types/transcript';
import type {
  ArtifactFile,
  ArtifactOperation,
  ArtifactStatus,
  ArtifactsSummary,
  ArtifactSortOption,
  ArtifactFilters,
} from '../types/artifacts';
import { isReadTool, isWriteTool, isEditTool } from '../utils/tool-normalization';

/**
 * Detect language from file path extension
 */
function detectLanguage(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  const languageMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    py: 'python',
    rb: 'ruby',
    go: 'go',
    rs: 'rust',
    java: 'java',
    kt: 'kotlin',
    swift: 'swift',
    c: 'c',
    cpp: 'cpp',
    h: 'c',
    hpp: 'cpp',
    cs: 'csharp',
    php: 'php',
    html: 'html',
    css: 'css',
    scss: 'scss',
    less: 'less',
    json: 'json',
    yaml: 'yaml',
    yml: 'yaml',
    xml: 'xml',
    md: 'markdown',
    sql: 'sql',
    sh: 'bash',
    bash: 'bash',
    zsh: 'bash',
    dockerfile: 'dockerfile',
    makefile: 'makefile',
    toml: 'toml',
    ini: 'ini',
    env: 'plaintext',
    txt: 'plaintext',
  };
  return languageMap[ext] || 'plaintext';
}

/**
 * Extract filename from path
 */
function getFilename(filePath: string): string {
  return filePath.split('/').pop() || filePath;
}

/**
 * Extract directory from path
 */
function getDirectory(filePath: string): string {
  const parts = filePath.split('/');
  parts.pop();
  return parts.join('/') || '/';
}

/**
 * Calculate diff stats from old/new content
 */
function calculateDiffStats(
  oldContent?: string,
  newContent?: string
): { additions: number; deletions: number } {
  if (!oldContent && newContent) {
    // New file - all additions
    return { additions: newContent.split('\n').length, deletions: 0 };
  }
  if (oldContent && !newContent) {
    // File deleted - all deletions
    return { additions: 0, deletions: oldContent.split('\n').length };
  }
  if (!oldContent || !newContent) {
    return { additions: 0, deletions: 0 };
  }

  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');

  // Simple line-based diff counting
  const oldSet = new Set(oldLines);
  const newSet = new Set(newLines);

  let additions = 0;
  let deletions = 0;

  for (const line of newLines) {
    if (!oldSet.has(line)) additions++;
  }
  for (const line of oldLines) {
    if (!newSet.has(line)) deletions++;
  }

  return { additions, deletions };
}

/**
 * Determine file status based on operations
 */
function determineStatus(operations: ArtifactOperation[]): ArtifactStatus {
  const hasWrite = operations.some((op) => op.type === 'write');
  const hasEdit = operations.some((op) => op.type === 'edit');
  const hasReadBeforeWrite =
    operations.length > 0 &&
    operations[0].type === 'read' &&
    operations.some((op) => op.type === 'write' || op.type === 'edit');

  if (hasWrite && !hasReadBeforeWrite) {
    // Written without prior read - likely created
    return 'created';
  }
  if (hasWrite || hasEdit) {
    return 'modified';
  }
  return 'read_only';
}

/**
 * Extract file path from tool execution.
 * Handles different parameter names used by Claude, Gemini, and Codex.
 */
function extractFilePath(_tool: string, input: Record<string, any>): string | null {
  // Common patterns for file path parameters across agents
  if (input.file_path) return input.file_path;
  if (input.filePath) return input.filePath;
  if (input.path) return input.path;
  if (input.notebook_path) return input.notebook_path;
  // Gemini uses 'file' for some operations
  if (input.file) return input.file;
  // Gemini uses 'filename' for some operations
  if (input.filename) return input.filename;

  return null;
}

/**
 * Process a single frame and extract file operations
 */
function processFrame(
  frame: PlaybackFrame,
  frameIndex: number,
  fileMap: Map<string, ArtifactFile>
): void {
  if (frame.type !== 'tool_execution' || !frame.toolExecution) {
    return;
  }

  const { tool, input, output, fileDiff } = frame.toolExecution;
  const filePath = extractFilePath(tool, input);

  if (!filePath) {
    return;
  }

  // Determine operation type using centralized tool normalization
  let operationType: 'read' | 'write' | 'edit' | null = null;
  if (isReadTool(tool)) {
    operationType = 'read';
  } else if (isWriteTool(tool)) {
    operationType = 'write';
  } else if (isEditTool(tool)) {
    operationType = 'edit';
  }

  if (!operationType) {
    return;
  }

  // Create operation record
  const operation: ArtifactOperation = {
    type: operationType,
    frameIndex,
    timestamp: frame.timestamp,
    tool,
    isError: output.isError,
    errorMessage: output.isError ? output.content : undefined,
    // Store content for reads (truncate large content)
    content:
      operationType === 'read' && !output.isError ? output.content?.slice(0, 50000) : undefined,
  };

  // Add diff info for edits/writes
  if (fileDiff && (operationType === 'edit' || operationType === 'write')) {
    const diffStats = calculateDiffStats(fileDiff.oldContent, fileDiff.newContent);
    operation.diff = {
      additions: diffStats.additions,
      deletions: diffStats.deletions,
      oldContent: fileDiff.oldContent,
      newContent: fileDiff.newContent,
    };
  }

  // Get or create artifact entry
  let artifact = fileMap.get(filePath);
  if (!artifact) {
    artifact = {
      path: filePath,
      filename: getFilename(filePath),
      directory: getDirectory(filePath),
      language: detectLanguage(filePath),
      status: 'read_only', // Will be updated after all operations
      reads: 0,
      writes: 0,
      edits: 0,
      operations: [],
      firstFrameIndex: frameIndex,
      lastFrameIndex: frameIndex,
      firstTimestamp: frame.timestamp,
      lastTimestamp: frame.timestamp,
      totalAdditions: 0,
      totalDeletions: 0,
      hasErrors: false,
    };
    fileMap.set(filePath, artifact);
  }

  // Update counts
  if (operationType === 'read') {
    artifact.reads++;
  } else if (operationType === 'write') {
    artifact.writes++;
  } else if (operationType === 'edit') {
    artifact.edits++;
  }

  // Update timestamps and indices
  artifact.lastFrameIndex = frameIndex;
  artifact.lastTimestamp = frame.timestamp;

  // Update diff totals
  if (operation.diff) {
    artifact.totalAdditions += operation.diff.additions;
    artifact.totalDeletions += operation.diff.deletions;
  }

  // Track errors
  if (output.isError) {
    artifact.hasErrors = true;
  }

  // Add operation
  artifact.operations.push(operation);
}

/**
 * Aggregate artifacts from frames
 */
function aggregateArtifacts(frames: PlaybackFrame[], maxFrameIndex?: number): ArtifactFile[] {
  const fileMap = new Map<string, ArtifactFile>();

  const limit = maxFrameIndex !== undefined ? maxFrameIndex + 1 : frames.length;

  for (let i = 0; i < limit && i < frames.length; i++) {
    processFrame(frames[i], i, fileMap);
  }

  // Update status for all artifacts based on their operations
  for (const artifact of fileMap.values()) {
    artifact.status = determineStatus(artifact.operations);
  }

  return Array.from(fileMap.values());
}

/**
 * Calculate summary statistics
 */
function calculateSummary(artifacts: ArtifactFile[]): ArtifactsSummary {
  let createdCount = 0;
  let modifiedCount = 0;
  let readOnlyCount = 0;
  let totalReads = 0;
  let totalWrites = 0;
  let totalEdits = 0;
  let errorCount = 0;

  for (const artifact of artifacts) {
    switch (artifact.status) {
      case 'created':
        createdCount++;
        break;
      case 'modified':
        modifiedCount++;
        break;
      case 'read_only':
        readOnlyCount++;
        break;
    }
    totalReads += artifact.reads;
    totalWrites += artifact.writes;
    totalEdits += artifact.edits;
    if (artifact.hasErrors) {
      errorCount++;
    }
  }

  return {
    totalFiles: artifacts.length,
    createdCount,
    modifiedCount,
    readOnlyCount,
    totalReads,
    totalWrites,
    totalEdits,
    errorCount,
  };
}

/**
 * Sort artifacts by the specified option
 */
function sortArtifacts(artifacts: ArtifactFile[], sortBy: ArtifactSortOption): ArtifactFile[] {
  const sorted = [...artifacts];

  switch (sortBy) {
    case 'activity':
      // Sort by total operations (most active first)
      sorted.sort((a, b) => {
        const aOps = a.reads + a.writes + a.edits;
        const bOps = b.reads + b.writes + b.edits;
        return bOps - aOps;
      });
      break;
    case 'name':
      // Sort alphabetically by filename
      sorted.sort((a, b) => a.filename.localeCompare(b.filename));
      break;
    case 'recent':
      // Sort by most recent operation
      sorted.sort((a, b) => b.lastFrameIndex - a.lastFrameIndex);
      break;
    case 'type':
      // Sort by status (created > modified > read_only), then by name
      const statusOrder: Record<ArtifactStatus, number> = {
        created: 0,
        modified: 1,
        read_only: 2,
      };
      sorted.sort((a, b) => {
        const statusDiff = statusOrder[a.status] - statusOrder[b.status];
        if (statusDiff !== 0) return statusDiff;
        return a.filename.localeCompare(b.filename);
      });
      break;
  }

  return sorted;
}

/**
 * Filter artifacts by status
 */
function filterArtifacts(artifacts: ArtifactFile[], filters: ArtifactFilters): ArtifactFile[] {
  return artifacts.filter((artifact) => {
    switch (artifact.status) {
      case 'created':
        return filters.showCreated;
      case 'modified':
        return filters.showModified;
      case 'read_only':
        return filters.showReadOnly;
      default:
        return true;
    }
  });
}

/**
 * Filter artifacts by search query
 */
function searchArtifacts(artifacts: ArtifactFile[], query: string): ArtifactFile[] {
  if (!query.trim()) {
    return artifacts;
  }

  const lowerQuery = query.toLowerCase();
  return artifacts.filter(
    (artifact) =>
      artifact.path.toLowerCase().includes(lowerQuery) ||
      artifact.filename.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Hook return type
 */
export interface UseArtifactsResult {
  artifacts: ArtifactFile[];
  summary: ArtifactsSummary;
  sortedAndFiltered: (
    sortBy: ArtifactSortOption,
    filters: ArtifactFilters,
    searchQuery: string
  ) => ArtifactFile[];
}

/**
 * Hook for aggregating file artifacts from frames
 *
 * @param frames - Array of playback frames
 * @param currentFrameIndex - Current frame position (for cumulative mode)
 * @param viewMode - 'cumulative' or 'full' to control which frames to process
 * @returns Aggregated artifacts with summary and filtering utilities
 */
export function useArtifacts(
  frames: PlaybackFrame[],
  currentFrameIndex: number,
  viewMode: 'cumulative' | 'full'
): UseArtifactsResult {
  // Memoize artifacts based on frames and view mode
  const artifacts = useMemo(() => {
    if (viewMode === 'cumulative') {
      return aggregateArtifacts(frames, currentFrameIndex);
    }
    return aggregateArtifacts(frames);
  }, [frames, currentFrameIndex, viewMode]);

  // Memoize summary
  const summary = useMemo(() => {
    return calculateSummary(artifacts);
  }, [artifacts]);

  // Function to get sorted and filtered artifacts
  const sortedAndFiltered = useMemo(() => {
    return (sortBy: ArtifactSortOption, filters: ArtifactFilters, searchQuery: string) => {
      let result = artifacts;
      result = filterArtifacts(result, filters);
      result = searchArtifacts(result, searchQuery);
      result = sortArtifacts(result, sortBy);
      return result;
    };
  }, [artifacts]);

  return {
    artifacts,
    summary,
    sortedAndFiltered,
  };
}

/**
 * Export artifacts to various formats
 */
export function exportArtifacts(
  artifacts: ArtifactFile[],
  format: 'json' | 'markdown' | 'csv'
): string {
  switch (format) {
    case 'json':
      return JSON.stringify(artifacts, null, 2);

    case 'markdown': {
      let md = '# File Artifacts\n\n';
      md += `Total: ${artifacts.length} files\n\n`;

      const created = artifacts.filter((a) => a.status === 'created');
      const modified = artifacts.filter((a) => a.status === 'modified');
      const readOnly = artifacts.filter((a) => a.status === 'read_only');

      if (created.length > 0) {
        md += '## Created Files\n\n';
        for (const a of created) {
          md += `- \`${a.path}\` (+${a.totalAdditions})\n`;
        }
        md += '\n';
      }

      if (modified.length > 0) {
        md += '## Modified Files\n\n';
        for (const a of modified) {
          md += `- \`${a.path}\` (+${a.totalAdditions} -${a.totalDeletions})\n`;
        }
        md += '\n';
      }

      if (readOnly.length > 0) {
        md += '## Read Files\n\n';
        for (const a of readOnly) {
          md += `- \`${a.path}\` (${a.reads} reads)\n`;
        }
        md += '\n';
      }

      return md;
    }

    case 'csv': {
      const headers = ['Path', 'Status', 'Reads', 'Writes', 'Edits', 'Additions', 'Deletions'];
      const rows = artifacts.map((a) =>
        [
          `"${a.path}"`,
          a.status,
          a.reads,
          a.writes,
          a.edits,
          a.totalAdditions,
          a.totalDeletions,
        ].join(',')
      );

      return [headers.join(','), ...rows].join('\n');
    }
  }
}
