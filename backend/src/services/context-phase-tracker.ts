/**
 * Context Phase Tracker Service
 *
 * Tracks context window phases across a session by:
 * 1. Accumulating input tokens across frames
 * 2. Detecting context compaction events (summaries)
 * 3. Incrementing phase numbers at compaction boundaries
 *
 * Context phases help visualize how the context window evolves over time,
 * especially during long sessions where compaction occurs.
 *
 * @module context-phase-tracker
 */

import type { PlaybackFrame, CompactionInfo } from '../types/transcript';

/**
 * Represents a detected compaction event from raw JSONL entries
 */
export interface CompactionFrame {
  /** Unique identifier for the compaction frame */
  id: string;
  /** Timestamp of the compaction event */
  timestamp: number;
  /** Context size before compaction (input_tokens) */
  tokensBefore: number;
  /** Context size after compaction */
  tokensAfter: number;
  /** Number of frames that were summarized/compacted */
  summarizedFrames?: number;
  /** Index in the original entries array where compaction occurred */
  entryIndex: number;
}

/**
 * Raw entry structure for compaction detection
 * Based on Claude's JSONL format
 */
interface RawEntry {
  uuid?: string;
  timestamp?: string;
  type?: string;
  message?: {
    role?: string;
    content?: any[];
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
    };
  };
  [key: string]: any;
}

/**
 * Track context phases across playback frames
 *
 * Iterates through frames, accumulating input tokens and incrementing
 * the phase number when a context_compaction frame is encountered.
 *
 * @param frames - Array of playback frames to process
 * @returns New array of frames with phaseNumber and accumulatedContext set
 *
 * @example
 * const frames = parseTranscript(jsonl);
 * const trackedFrames = trackContextPhases(frames);
 * // Each frame now has phaseNumber (1-based) and accumulatedContext
 */
export function trackContextPhases(frames: PlaybackFrame[]): PlaybackFrame[] {
  let currentPhase = 1;
  let accumulatedTokens = 0;

  return frames.map((frame) => {
    // Accumulate input tokens if available
    const inputTokens = frame.tokenUsage?.input_tokens ?? 0;
    accumulatedTokens += inputTokens;

    // Create a new frame with tracking fields set
    const trackedFrame: PlaybackFrame = {
      ...frame,
      phaseNumber: currentPhase,
      accumulatedContext: accumulatedTokens,
    };

    // Check if this is a compaction event - increment phase AFTER this frame
    if (frame.type === 'context_compaction') {
      currentPhase++;

      // If compaction has tokensAfter, reset accumulated to that value
      // This represents the new context size after summarization
      if (frame.compaction?.tokensAfter !== undefined) {
        accumulatedTokens = frame.compaction.tokensAfter;
      }
    }

    return trackedFrame;
  });
}

/**
 * Detect context compaction events from raw JSONL entries
 *
 * Looks for entries with type: "summary" which indicate Claude has
 * performed context compaction. Creates context_compaction frames
 * at those boundaries with token information.
 *
 * @param entries - Array of raw JSONL entries
 * @returns Array of detected compaction frames
 *
 * @example
 * const lines = fs.readFileSync('session.jsonl', 'utf-8').split('\n');
 * const entries = lines.filter(l => l.trim()).map(l => JSON.parse(l));
 * const compactionEvents = detectCompactionEvents(entries);
 */
export function detectCompactionEvents(entries: RawEntry[]): CompactionFrame[] {
  const compactionFrames: CompactionFrame[] = [];

  // Track token usage to calculate before/after
  let lastKnownInputTokens = 0;
  let framesSinceLastCompaction = 0;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (!entry) continue;

    // Track input tokens from assistant responses
    if (entry.message?.usage?.input_tokens) {
      lastKnownInputTokens = entry.message.usage.input_tokens;
    }

    // Count frames for summarizedFrames calculation
    if (entry.type === 'assistant' || entry.type === 'user') {
      framesSinceLastCompaction++;
    }

    // Detect summary type entries (context compaction)
    if (entry.type === 'summary') {
      const timestamp = entry.timestamp ? new Date(entry.timestamp).getTime() : Date.now();

      // Try to extract token information from the summary entry
      const tokensBefore = lastKnownInputTokens;

      // Look ahead for the next entry with token usage to get tokensAfter
      let tokensAfter = 0;
      for (let j = i + 1; j < entries.length; j++) {
        const nextEntry = entries[j];
        if (nextEntry?.message?.usage?.input_tokens) {
          tokensAfter = nextEntry.message.usage.input_tokens;
          break;
        }
      }

      // If we couldn't find tokensAfter, estimate based on typical compaction ratio
      // Context compaction typically reduces to ~20-30% of original
      if (tokensAfter === 0 && tokensBefore > 0) {
        tokensAfter = Math.floor(tokensBefore * 0.25);
      }

      const compactionFrame: CompactionFrame = {
        id: entry.uuid ?? `compaction-${i}`,
        timestamp,
        tokensBefore,
        tokensAfter,
        summarizedFrames: framesSinceLastCompaction,
        entryIndex: i,
      };

      compactionFrames.push(compactionFrame);

      // Reset counter for next phase
      framesSinceLastCompaction = 0;
    }
  }

  return compactionFrames;
}

/**
 * Convert a CompactionFrame to a PlaybackFrame
 *
 * Creates a context_compaction type PlaybackFrame that can be
 * inserted into the session timeline.
 *
 * @param compactionFrame - Detected compaction event
 * @param cwd - Current working directory for frame context
 * @returns PlaybackFrame ready for insertion into timeline
 */
export function compactionToPlaybackFrame(
  compactionFrame: CompactionFrame,
  cwd: string = ''
): PlaybackFrame {
  const compactionInfo: CompactionInfo = {
    tokensBefore: compactionFrame.tokensBefore,
    tokensAfter: compactionFrame.tokensAfter,
    summarizedFrames: compactionFrame.summarizedFrames,
  };

  return {
    id: compactionFrame.id,
    type: 'context_compaction',
    timestamp: compactionFrame.timestamp,
    agent: 'claude',
    compaction: compactionInfo,
    context: { cwd },
  };
}

/**
 * Insert compaction frames into a timeline at the correct positions
 *
 * Takes existing playback frames and compaction events, merging them
 * into a single timeline sorted by timestamp.
 *
 * @param frames - Existing playback frames
 * @param compactionFrames - Detected compaction events
 * @param cwd - Current working directory
 * @returns Merged and sorted timeline with compaction events
 */
export function mergeCompactionFrames(
  frames: PlaybackFrame[],
  compactionFrames: CompactionFrame[],
  cwd: string = ''
): PlaybackFrame[] {
  // Convert compaction events to playback frames
  const compactionPlaybackFrames = compactionFrames.map((cf) => compactionToPlaybackFrame(cf, cwd));

  // Merge both arrays
  const merged = [...frames, ...compactionPlaybackFrames];

  // Sort by timestamp
  merged.sort((a, b) => a.timestamp - b.timestamp);

  return merged;
}

/**
 * Calculate context phase statistics for a session
 *
 * Provides summary statistics about context phases including
 * total phases, compaction events, and token savings.
 *
 * @param frames - Playback frames with phase tracking applied
 * @returns Statistics object with phase information
 */
export function getPhaseStatistics(frames: PlaybackFrame[]): {
  totalPhases: number;
  compactionCount: number;
  totalTokensSaved: number;
  phaseBreakdown: Array<{
    phase: number;
    frameCount: number;
    startTimestamp: number;
    endTimestamp: number;
    peakContext: number;
  }>;
} {
  const compactionFrames = frames.filter((f) => f.type === 'context_compaction');
  const totalPhases = compactionFrames.length + 1;

  // Calculate total tokens saved across all compactions
  const totalTokensSaved = compactionFrames.reduce((sum, f) => {
    if (f.compaction) {
      return sum + (f.compaction.tokensBefore - f.compaction.tokensAfter);
    }
    return sum;
  }, 0);

  // Build phase breakdown
  const phaseBreakdown: Array<{
    phase: number;
    frameCount: number;
    startTimestamp: number;
    endTimestamp: number;
    peakContext: number;
  }> = [];

  let currentPhase = 1;
  let phaseStart = frames[0]?.timestamp ?? 0;
  let phaseFrameCount = 0;
  let phasePeakContext = 0;

  for (const frame of frames) {
    const framePhase = frame.phaseNumber ?? 1;

    if (framePhase !== currentPhase) {
      // Save previous phase stats
      phaseBreakdown.push({
        phase: currentPhase,
        frameCount: phaseFrameCount,
        startTimestamp: phaseStart,
        endTimestamp: frame.timestamp,
        peakContext: phasePeakContext,
      });

      // Reset for new phase
      currentPhase = framePhase;
      phaseStart = frame.timestamp;
      phaseFrameCount = 0;
      phasePeakContext = 0;
    }

    phaseFrameCount++;
    phasePeakContext = Math.max(phasePeakContext, frame.accumulatedContext ?? 0);
  }

  // Add final phase
  if (phaseFrameCount > 0) {
    phaseBreakdown.push({
      phase: currentPhase,
      frameCount: phaseFrameCount,
      startTimestamp: phaseStart,
      endTimestamp: frames[frames.length - 1]?.timestamp ?? phaseStart,
      peakContext: phasePeakContext,
    });
  }

  return {
    totalPhases,
    compactionCount: compactionFrames.length,
    totalTokensSaved,
    phaseBreakdown,
  };
}
