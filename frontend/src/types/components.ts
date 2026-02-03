/**
 * Component-specific types
 */

import type { SessionEvent, ObservationType } from './api';

/**
 * Phase 2: Gap between events (dead air)
 */
export interface Gap {
  duration: number; // milliseconds
  displayText: string; // e.g., "32 min later"
  summary?: GapSummary;
}

export interface GapSummary {
  filesTouched: string[];
  conceptsMentioned: string[];
  observationCounts: Record<ObservationType, number>;
}

/**
 * Phase 2: Chapter marker for important events
 */
export interface ChapterMarker {
  index: number;
  event: SessionEvent;
  type: 'feature' | 'decision' | 'bugfix';
  color: string;
}

/**
 * Phase 2: File touch aggregation
 */
export interface FileTouchSummary {
  path: string;
  reads: number;
  modifies: number;
  total: number;
}

/**
 * Phase 2: Playback state
 */
export interface PlaybackState {
  currentEventIndex: number;
  isPlaying: boolean;
  speed: 0.5 | 1 | 2 | 5;
}

/**
 * Virtualization
 */
export interface VirtualItem {
  index: number;
  start: number;
  size: number;
  end: number;
  key: string | number;
}
