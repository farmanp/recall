/**
 * Frame Search Utilities
 *
 * Search, filter, and highlight functionality for playback frames.
 */

import React from 'react';
import type { PlaybackFrame } from '../types/transcript';

/**
 * Extracts all searchable text from a frame
 * Combines user messages, thinking, responses, tool executions, and file diffs
 */
export function getSearchableText(frame: PlaybackFrame): string {
  const parts: string[] = [];

  if (frame.userMessage?.text) {
    parts.push(frame.userMessage.text);
  }

  if (frame.thinking?.text) {
    parts.push(frame.thinking.text);
  }

  if (frame.claudeResponse?.text) {
    parts.push(frame.claudeResponse.text);
  }

  if (frame.toolExecution) {
    parts.push(frame.toolExecution.tool);

    if (frame.toolExecution.output?.content) {
      parts.push(frame.toolExecution.output.content);
    }

    if (frame.toolExecution.fileDiff) {
      parts.push(frame.toolExecution.fileDiff.filePath);
      parts.push(frame.toolExecution.fileDiff.newContent);

      if (frame.toolExecution.fileDiff.oldContent) {
        parts.push(frame.toolExecution.fileDiff.oldContent);
      }
    }
  }

  return parts.join('\n');
}

/**
 * Returns true if frame contains query (case-insensitive)
 */
export function frameMatchesQuery(frame: PlaybackFrame, query: string): boolean {
  if (!query.trim()) {
    return false;
  }

  const searchableText = getSearchableText(frame);
  return searchableText.toLowerCase().includes(query.toLowerCase());
}

/**
 * Returns array of frame indices that match the query
 */
export function findMatchingFrameIndices(frames: PlaybackFrame[], query: string): number[] {
  if (!query.trim()) {
    return [];
  }

  const indices: number[] = [];

  for (let i = 0; i < frames.length; i++) {
    if (frameMatchesQuery(frames[i], query)) {
      indices.push(i);
    }
  }

  return indices;
}

/**
 * Find next match index after currentIndex, wrapping to start if needed
 * Returns -1 if no matches exist
 */
export function findNextMatchIndex(currentIndex: number, matchIndices: number[]): number {
  if (matchIndices.length === 0) {
    return -1;
  }

  // Find the first match index that is greater than currentIndex
  for (const matchIndex of matchIndices) {
    if (matchIndex > currentIndex) {
      return matchIndex;
    }
  }

  // Wrap to the beginning
  return matchIndices[0];
}

/**
 * Find previous match index before currentIndex, wrapping to end if needed
 * Returns -1 if no matches exist
 */
export function findPrevMatchIndex(currentIndex: number, matchIndices: number[]): number {
  if (matchIndices.length === 0) {
    return -1;
  }

  // Find the last match index that is less than currentIndex
  for (let i = matchIndices.length - 1; i >= 0; i--) {
    if (matchIndices[i] < currentIndex) {
      return matchIndices[i];
    }
  }

  // Wrap to the end
  return matchIndices[matchIndices.length - 1];
}

/**
 * Returns JSX with query matches wrapped in highlight markup
 * Handles case-insensitive matching
 * If query is empty, returns text as-is
 */
export function highlightText(text: string, query: string): React.ReactNode {
  if (!query.trim()) {
    return text;
  }

  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let matchIndex = lowerText.indexOf(lowerQuery);
  let keyCounter = 0;

  while (matchIndex !== -1) {
    // Add text before the match
    if (matchIndex > lastIndex) {
      parts.push(text.substring(lastIndex, matchIndex));
    }

    // Add the highlighted match (preserving original case)
    parts.push(
      React.createElement(
        'mark',
        {
          key: keyCounter++,
          className: 'bg-yellow-400 text-black rounded px-0.5',
        },
        text.substring(matchIndex, matchIndex + query.length)
      )
    );

    lastIndex = matchIndex + query.length;
    matchIndex = lowerText.indexOf(lowerQuery, lastIndex);
  }

  // Add remaining text after last match
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts.length > 0 ? parts : text;
}
