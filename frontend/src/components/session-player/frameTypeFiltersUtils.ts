import type { PlaybackFrame } from '../../types/transcript';

/**
 * Helper: Find next visible frame index
 * Used by SessionPlayerPage for Prev/Next navigation
 */
export function findNextVisibleFrame(
  startIndex: number,
  frames: PlaybackFrame[],
  activeTypes: Set<string>
): number {
  for (let i = startIndex; i < frames.length; i++) {
    if (activeTypes.has(frames[i].type)) {
      return i;
    }
  }
  // If no visible frame found, return last frame
  return frames.length - 1;
}

/**
 * Helper: Find previous visible frame index
 * Used by SessionPlayerPage for Prev/Next navigation
 */
export function findPrevVisibleFrame(
  startIndex: number,
  frames: PlaybackFrame[],
  activeTypes: Set<string>
): number {
  for (let i = startIndex; i >= 0; i--) {
    if (activeTypes.has(frames[i].type)) {
      return i;
    }
  }
  // If no visible frame found, return first frame
  return 0;
}
