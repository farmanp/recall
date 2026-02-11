/**
 * Heuristic-based Session Summarizer
 *
 * Generates session summaries using pattern matching and heuristics
 * without requiring LLM calls. Fast and lightweight for real-time use.
 *
 * @module summarizer
 */

import type { PlaybackFrame } from '../types/transcript';

/**
 * Session summary data structure
 */
export interface SessionSummary {
  sessionId: string;
  summaryText: string;
  keyDecisions: string[];
  filesChanged: {
    created: string[];
    modified: string[];
    deleted: string[];
  };
  toolsUsed: Record<string, number>;
  errorCount: number;
  successIndicators: string[];
  generatedAt: string;
  generatedBy: 'heuristic' | 'llm';
}

/**
 * Database row format for session_summaries table
 */
export interface SessionSummaryRow {
  session_id: string;
  summary_text: string;
  key_decisions: string | null;
  files_changed: string | null;
  tools_used: string | null;
  error_count: number;
  success_indicators: string | null;
  generated_at: string;
  generated_at_epoch: number;
  generated_by: string;
}

/**
 * Heuristic-based session summarizer
 *
 * Analyzes session frames to extract:
 * - Tool usage statistics
 * - File changes (created, modified)
 * - Error counts
 * - Key decisions (from language patterns)
 * - Success indicators (passing tests, successful builds)
 */
export class Summarizer {
  /**
   * Generate a heuristic-based summary from session frames
   *
   * @param sessionId - Session UUID
   * @param frames - Array of playback frames
   * @returns SessionSummary object
   *
   * @example
   * const summary = Summarizer.generateSummary('abc-123', frames);
   * console.log(summary.summaryText);
   */
  static generateSummary(sessionId: string, frames: PlaybackFrame[]): SessionSummary {
    const toolsUsed = this.countToolUsage(frames);
    const filesChanged = this.extractFileChanges(frames);
    const errorCount = this.countErrors(frames);
    const keyDecisions = this.extractKeyDecisions(frames);
    const successIndicators = this.detectSuccessIndicators(frames);
    const summaryText = this.generateSummaryText(frames, toolsUsed, filesChanged, errorCount);

    return {
      sessionId,
      summaryText,
      keyDecisions,
      filesChanged,
      toolsUsed,
      errorCount,
      successIndicators,
      generatedAt: new Date().toISOString(),
      generatedBy: 'heuristic',
    };
  }

  /**
   * Count tool usage frequency
   *
   * Iterates through frames and counts occurrences of each tool.
   *
   * @param frames - Array of playback frames
   * @returns Object mapping tool names to usage counts
   *
   * @example
   * const counts = Summarizer.countToolUsage(frames);
   * // { "Bash": 10, "Edit": 5, "Read": 20 }
   */
  static countToolUsage(frames: PlaybackFrame[]): Record<string, number> {
    const counts: Record<string, number> = {};

    for (const frame of frames) {
      if (frame.type === 'tool_execution' && frame.toolExecution) {
        const tool = frame.toolExecution.tool;
        counts[tool] = (counts[tool] || 0) + 1;
      }
    }

    return counts;
  }

  /**
   * Extract file changes from frames
   *
   * Tracks which files were created vs modified by analyzing the order
   * of Read and Write/Edit operations.
   *
   * @param frames - Array of playback frames
   * @returns Object with created, modified, and deleted file arrays
   *
   * @example
   * const changes = Summarizer.extractFileChanges(frames);
   * // { created: ['new-file.ts'], modified: ['existing.ts'], deleted: [] }
   */
  static extractFileChanges(frames: PlaybackFrame[]): {
    created: string[];
    modified: string[];
    deleted: string[];
  } {
    const created = new Set<string>();
    const modified = new Set<string>();
    const readFiles = new Set<string>();

    for (const frame of frames) {
      if (frame.type !== 'tool_execution' || !frame.toolExecution) continue;

      const { tool, input } = frame.toolExecution;
      const filePath = input.file_path || input.path;

      if (!filePath || typeof filePath !== 'string') continue;

      // Normalize the file path for consistent comparison
      const normalizedPath = filePath.trim();

      if (tool === 'Read' || tool === 'Glob' || tool === 'Grep') {
        // Track files that were read (existed before)
        if (tool === 'Read') {
          readFiles.add(normalizedPath);
        }
      } else if (tool === 'Write' || tool === 'Edit' || tool === 'NotebookEdit') {
        // If file was read before being written, it's a modification
        if (readFiles.has(normalizedPath)) {
          modified.add(normalizedPath);
        } else {
          // File wasn't read first, could be new or modified
          // For Edit operations, we assume modification (edits existing content)
          if (tool === 'Edit') {
            modified.add(normalizedPath);
          } else {
            // Write without prior Read - likely a new file
            created.add(normalizedPath);
          }
        }
        // Mark as read for subsequent operations
        readFiles.add(normalizedPath);
      }
    }

    // Remove files from created if they're also in modified
    // (they were read at some point, meaning they existed)
    for (const file of modified) {
      created.delete(file);
    }

    return {
      created: Array.from(created).sort(),
      modified: Array.from(modified).sort(),
      deleted: [], // Currently not tracking deletes
    };
  }

  /**
   * Count errors in tool executions
   *
   * @param frames - Array of playback frames
   * @returns Number of frames with tool execution errors
   */
  static countErrors(frames: PlaybackFrame[]): number {
    return frames.filter((f) => f.type === 'tool_execution' && f.toolExecution?.output?.isError)
      .length;
  }

  /**
   * Extract key decisions from user messages and responses
   *
   * Looks for patterns indicating decision-making language:
   * - "let's..."
   * - "I'll..."
   * - "going to..."
   * - "decided to..."
   *
   * @param frames - Array of playback frames
   * @returns Array of decision strings (max 5)
   */
  static extractKeyDecisions(frames: PlaybackFrame[]): string[] {
    const decisions: string[] = [];
    const seenDecisions = new Set<string>();

    const decisionPatterns = [
      /\blet['']?s\s+(.{10,100}?)(?:\.|,|!|\?|$)/gi,
      /\bI['']?ll\s+(.{10,100}?)(?:\.|,|!|\?|$)/gi,
      /\bgoing to\s+(.{10,100}?)(?:\.|,|!|\?|$)/gi,
      /\bdecided to\s+(.{10,100}?)(?:\.|,|!|\?|$)/gi,
      /\bwe should\s+(.{10,100}?)(?:\.|,|!|\?|$)/gi,
      /\bI recommend\s+(.{10,100}?)(?:\.|,|!|\?|$)/gi,
    ];

    for (const frame of frames) {
      if (decisions.length >= 5) break;

      const textToSearch = frame.claudeResponse?.text || '';
      if (!textToSearch) continue;

      for (const pattern of decisionPatterns) {
        if (decisions.length >= 5) break;

        // Reset regex lastIndex for global patterns
        pattern.lastIndex = 0;
        let match;

        while ((match = pattern.exec(textToSearch)) !== null && decisions.length < 5) {
          if (!match[1]) continue;

          const decision = match[1]
            .trim()
            .replace(/[.!?,;:]$/, '')
            .replace(/\s+/g, ' ');

          // Skip if too short or already seen
          if (decision.length < 15) continue;

          const lowerDecision = decision.toLowerCase();
          if (seenDecisions.has(lowerDecision)) continue;

          seenDecisions.add(lowerDecision);
          decisions.push(decision);
        }
      }
    }

    return decisions;
  }

  /**
   * Detect success indicators (completed tasks, passing tests, etc.)
   *
   * Searches for patterns indicating successful outcomes:
   * - "tests pass(ed/ing)"
   * - "build succeed"
   * - "successfully created/updated/deployed"
   * - Checkmarks
   *
   * @param frames - Array of playback frames
   * @returns Array of success indicator strings (max 5)
   */
  static detectSuccessIndicators(frames: PlaybackFrame[]): string[] {
    const indicators: string[] = [];
    const seenIndicators = new Set<string>();

    const successPatterns: Array<{ pattern: RegExp; label: string }> = [
      { pattern: /\d+\s+(?:tests?|specs?)\s+pass(?:ed|ing)?/gi, label: 'tests passing' },
      { pattern: /all\s+tests?\s+pass(?:ed|ing)?/gi, label: 'all tests passing' },
      { pattern: /build\s+succeed(?:ed)?/gi, label: 'build succeeded' },
      { pattern: /successfully\s+(created|updated|deployed|installed|completed)/gi, label: '' },
      { pattern: /\[(?:pass|passed|ok|success)\]/gi, label: '' },
      { pattern: /npm\s+(?:run\s+)?test.*\n.*(?:passed|ok)/gi, label: 'npm tests passing' },
      { pattern: /vitest.*passed/gi, label: 'vitest tests passing' },
      { pattern: /jest.*passed/gi, label: 'jest tests passing' },
      { pattern: /compilation\s+successful/gi, label: 'compilation successful' },
      { pattern: /no\s+(?:type\s+)?errors/gi, label: 'no errors' },
    ];

    for (const frame of frames) {
      if (indicators.length >= 5) break;

      const content = frame.toolExecution?.output?.content || '';
      if (!content) continue;

      for (const { pattern, label } of successPatterns) {
        if (indicators.length >= 5) break;

        pattern.lastIndex = 0;
        const match = content.match(pattern);

        if (match) {
          const indicator = label || match[0].trim().toLowerCase();
          const normalizedIndicator = indicator.replace(/\s+/g, ' ');

          if (!seenIndicators.has(normalizedIndicator)) {
            seenIndicators.add(normalizedIndicator);
            indicators.push(normalizedIndicator);
          }
        }
      }
    }

    return indicators;
  }

  /**
   * Generate human-readable summary text
   *
   * Creates a concise paragraph summarizing the session based on:
   * - Number of user messages
   * - Total tool executions
   * - Top tools used
   * - Files changed
   * - Error count
   *
   * @param frames - Array of playback frames
   * @param toolsUsed - Tool usage counts
   * @param filesChanged - File changes object
   * @param errorCount - Number of errors
   * @returns Human-readable summary string
   */
  static generateSummaryText(
    frames: PlaybackFrame[],
    toolsUsed: Record<string, number>,
    filesChanged: { created: string[]; modified: string[] },
    errorCount: number
  ): string {
    const parts: string[] = [];

    // Count message types
    const userMessages = frames.filter((f) => f.type === 'user_message').length;
    const totalTools = Object.values(toolsUsed).reduce((a, b) => a + b, 0);

    // Opening with message count
    if (userMessages > 0) {
      const turnLabel = userMessages === 1 ? 'turn' : 'turns';
      parts.push(`Session with ${userMessages} conversation ${turnLabel}`);
    } else {
      parts.push('Session');
    }

    // Tool usage summary
    if (totalTools > 0) {
      const topTools = Object.entries(toolsUsed)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([tool, count]) => `${tool} (${count})`)
        .join(', ');

      parts.push(`${totalTools} tool executions (${topTools})`);
    }

    // File changes summary
    const createdCount = filesChanged.created.length;
    const modifiedCount = filesChanged.modified.length;
    const totalFileChanges = createdCount + modifiedCount;

    if (totalFileChanges > 0) {
      const fileDetails: string[] = [];
      if (createdCount > 0) {
        fileDetails.push(`${createdCount} created`);
      }
      if (modifiedCount > 0) {
        fileDetails.push(`${modifiedCount} modified`);
      }
      parts.push(`${totalFileChanges} files touched (${fileDetails.join(', ')})`);
    }

    // Error summary
    if (errorCount > 0) {
      const errorLabel = errorCount === 1 ? 'error' : 'errors';
      parts.push(`${errorCount} ${errorLabel} encountered`);
    }

    // Build final summary
    let summary = parts[0] || 'Session';
    if (parts.length > 1) {
      summary += ' with ' + parts.slice(1).join(', ') + '.';
    } else {
      summary += '.';
    }

    return summary;
  }

  /**
   * Convert SessionSummary to database row format
   *
   * @param summary - SessionSummary object
   * @returns Object ready for database insertion
   */
  static toRow(summary: SessionSummary): SessionSummaryRow {
    const now = new Date(summary.generatedAt);

    return {
      session_id: summary.sessionId,
      summary_text: summary.summaryText,
      key_decisions: summary.keyDecisions.length > 0 ? JSON.stringify(summary.keyDecisions) : null,
      files_changed: JSON.stringify(summary.filesChanged),
      tools_used:
        Object.keys(summary.toolsUsed).length > 0 ? JSON.stringify(summary.toolsUsed) : null,
      error_count: summary.errorCount,
      success_indicators:
        summary.successIndicators.length > 0 ? JSON.stringify(summary.successIndicators) : null,
      generated_at: summary.generatedAt,
      generated_at_epoch: now.getTime(),
      generated_by: summary.generatedBy,
    };
  }

  /**
   * Convert database row to SessionSummary object
   *
   * @param row - Database row
   * @returns SessionSummary object
   */
  static fromRow(row: SessionSummaryRow): SessionSummary {
    return {
      sessionId: row.session_id,
      summaryText: row.summary_text,
      keyDecisions: row.key_decisions ? JSON.parse(row.key_decisions) : [],
      filesChanged: row.files_changed
        ? JSON.parse(row.files_changed)
        : { created: [], modified: [], deleted: [] },
      toolsUsed: row.tools_used ? JSON.parse(row.tools_used) : {},
      errorCount: row.error_count,
      successIndicators: row.success_indicators ? JSON.parse(row.success_indicators) : [],
      generatedAt: row.generated_at,
      generatedBy: row.generated_by as 'heuristic' | 'llm',
    };
  }
}
