/**
 * Event Helper Utilities (Phase 2)
 *
 * Gap detection, file aggregation, chapter markers, etc.
 */

import type { SessionEvent, Gap, ChapterMarker, FileTouchSummary, ObservationType } from '@/types';
import { formatGapDuration } from './formatters';

const FIVE_MINUTES = 5 * 60 * 1000;
const CHAPTER_TYPES: ObservationType[] = ['feature', 'decision', 'bugfix'];

/**
 * Detect gap between two events (Phase 2)
 */
export function detectGap(prevEvent: SessionEvent | undefined, currentEvent: SessionEvent): Gap | null {
  if (!prevEvent) return null;

  const timeDiff = currentEvent.ts - prevEvent.ts;

  if (timeDiff > FIVE_MINUTES) {
    return {
      duration: timeDiff,
      displayText: formatGapDuration(timeDiff),
      // summary: summarizeGap(prevEvent, currentEvent), // Future enhancement
    };
  }

  return null;
}

/**
 * Get chapter markers from events (Phase 2)
 */
export function getChapterMarkers(events: SessionEvent[]): ChapterMarker[] {
  return events
    .map((event, index) => ({
      index,
      event,
      isChapter:
        event.event_type === 'observation' &&
        event.obs_type !== undefined &&
        CHAPTER_TYPES.includes(event.obs_type),
    }))
    .filter((marker): marker is ChapterMarker & { isChapter: true } => marker.isChapter)
    .map(({ index, event }) => ({
      index,
      event,
      type: event.obs_type as 'feature' | 'decision' | 'bugfix',
      color: getTypeColor(event.obs_type!),
    }));
}

/**
 * Aggregate files touched across events (Phase 2)
 */
export function aggregateFilesTouched(
  events: SessionEvent[],
  upToIndex?: number
): FileTouchSummary[] {
  const eventSubset = upToIndex !== undefined ? events.slice(0, upToIndex + 1) : events;

  const fileMap = new Map<string, { reads: number; modifies: number }>();

  eventSubset.forEach((event) => {
    if (event.event_type === 'observation') {
      // Count reads
      event.files_read?.forEach((file) => {
        const entry = fileMap.get(file) || { reads: 0, modifies: 0 };
        entry.reads++;
        fileMap.set(file, entry);
      });

      // Count modifies
      event.files_modified?.forEach((file) => {
        const entry = fileMap.get(file) || { reads: 0, modifies: 0 };
        entry.modifies++;
        fileMap.set(file, entry);
      });
    }
  });

  return Array.from(fileMap.entries())
    .map(([path, counts]) => ({
      path,
      ...counts,
      total: counts.reads + counts.modifies,
    }))
    .sort((a, b) => b.total - a.total);
}

/**
 * Find event index by timestamp (Phase 2 - Deep links)
 */
export function findEventByTimestamp(events: SessionEvent[], timestamp: number): number {
  // Find closest event to timestamp
  let closestIndex = 0;
  let closestDiff = Math.abs(events[0]?.ts - timestamp);

  events.forEach((event, index) => {
    const diff = Math.abs(event.ts - timestamp);
    if (diff < closestDiff) {
      closestDiff = diff;
      closestIndex = index;
    }
  });

  return closestIndex;
}

/**
 * Get color for observation type
 */
function getTypeColor(type: ObservationType): string {
  const colors: Record<ObservationType, string> = {
    feature: '#8B5CF6', // Purple
    bugfix: '#EF4444', // Red
    decision: '#F59E0B', // Yellow
    discovery: '#3B82F6', // Blue
    refactor: '#6B7280', // Gray
    change: '#10B981', // Green
  };

  return colors[type] || '#6B7280';
}

/**
 * Calculate delay for auto-advance (Phase 2)
 */
export function calculatePlaybackDelay(event: SessionEvent, speed: number): number {
  const baseDelay = event.event_type === 'prompt' ? 3000 : 1500;
  return baseDelay / speed;
}
