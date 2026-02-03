/**
 * PlaybackControls Component (Phase 2)
 *
 * Video-style playback controls
 * Play/pause, speed controls, navigation buttons
 */

import React from 'react';

export interface PlaybackControlsProps {
  isPlaying: boolean;
  speed: 0.5 | 1 | 2 | 5;
  currentEventIndex: number;
  totalEvents: number;
  onPlayPause: () => void;
  onSpeedChange: (speed: 0.5 | 1 | 2 | 5) => void;
  onPrevious: () => void;
  onNext: () => void;
  onJumpToStart: () => void;
}

export const PlaybackControls: React.FC<PlaybackControlsProps> = ({
  isPlaying,
  speed,
  currentEventIndex,
  totalEvents,
  onPlayPause,
  onSpeedChange,
  onPrevious,
  onNext,
  onJumpToStart,
}) => {
  const speeds: Array<0.5 | 1 | 2 | 5> = [0.5, 1, 2, 5];

  return (
    <div className="flex items-center justify-between p-4 bg-white border-b">
      {/* Transport Controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={onJumpToStart}
          className="p-2 rounded hover:bg-gray-100"
          aria-label="Jump to start"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M8.445 14.832A1 1 0 0010 14v-2.798l5.445 3.63A1 1 0 0017 14V6a1 1 0 00-1.555-.832L10 8.798V6a1 1 0 00-1.555-.832l-6 4a1 1 0 000 1.664l6 4z" />
          </svg>
        </button>

        <button
          onClick={onPrevious}
          className="p-2 rounded hover:bg-gray-100"
          aria-label="Previous event"
          disabled={currentEventIndex === 0}
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" />
          </svg>
        </button>

        <button
          onClick={onPlayPause}
          className="p-3 rounded-full bg-blue-600 text-white hover:bg-blue-700"
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path d="M5 4a2 2 0 012-2h2a2 2 0 012 2v12a2 2 0 01-2 2H7a2 2 0 01-2-2V4zm8 0a2 2 0 012-2h2a2 2 0 012 2v12a2 2 0 01-2 2h-2a2 2 0 01-2-2V4z" />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
            </svg>
          )}
        </button>

        <button
          onClick={onNext}
          className="p-2 rounded hover:bg-gray-100"
          aria-label="Next event"
          disabled={currentEventIndex >= totalEvents - 1}
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" />
          </svg>
        </button>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <span>
          {currentEventIndex + 1} / {totalEvents}
        </span>
      </div>

      {/* Speed Control */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-600">Speed:</span>
        {speeds.map((s) => (
          <button
            key={s}
            onClick={() => onSpeedChange(s)}
            className={`
              px-2 py-1 rounded text-sm
              ${speed === s ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}
            `}
          >
            {s}x
          </button>
        ))}
      </div>
    </div>
  );
};
