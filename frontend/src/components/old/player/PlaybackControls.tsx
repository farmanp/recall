/**
 * PlaybackControls
 *
 * Video player-style controls for session playback
 * Play/pause, speed control, navigation
 */

import React from 'react';

export interface PlaybackControlsProps {
  isPlaying: boolean;
  onPlayPause: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onSpeedChange: (speed: number) => void;
  speed: number;
  canGoPrevious: boolean;
  canGoNext: boolean;
  className?: string;
}

const SPEEDS = [0.5, 1, 2, 5, 10];

export const PlaybackControls: React.FC<PlaybackControlsProps> = ({
  isPlaying,
  onPlayPause,
  onPrevious,
  onNext,
  onSpeedChange,
  speed,
  canGoPrevious,
  canGoNext,
  className = ''
}) => {
  const [showSpeedMenu, setShowSpeedMenu] = React.useState(false);

  return (
    <div className={`flex items-center justify-center gap-4 ${className}`}>
      {/* Previous Event */}
      <button
        onClick={onPrevious}
        disabled={!canGoPrevious}
        className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        title="Previous event (←)"
        aria-label="Previous event"
      >
        <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      {/* Play/Pause */}
      <button
        onClick={onPlayPause}
        className="p-3 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
        title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? (
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
          </svg>
        ) : (
          <svg className="w-6 h-6 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>

      {/* Next Event */}
      <button
        onClick={onNext}
        disabled={!canGoNext}
        className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        title="Next event (→)"
        aria-label="Next event"
      >
        <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {/* Speed Control */}
      <div className="relative ml-4">
        <button
          onClick={() => setShowSpeedMenu(!showSpeedMenu)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors text-sm font-medium text-gray-700"
          aria-label="Playback speed"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span>{speed}x</span>
        </button>

        {showSpeedMenu && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setShowSpeedMenu(false)}
            />
            <div className="absolute bottom-full mb-2 left-0 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-20 min-w-[100px]">
              {SPEEDS.map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    onSpeedChange(s);
                    setShowSpeedMenu(false);
                  }}
                  className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 transition-colors ${
                    s === speed ? 'bg-indigo-50 text-indigo-600 font-medium' : 'text-gray-700'
                  }`}
                >
                  {s}x
                  {s === 1 && <span className="text-gray-400 ml-1">(normal)</span>}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Keyboard shortcuts hint */}
      <div className="ml-4 pl-4 border-l border-gray-300 text-xs text-gray-500 hidden lg:block">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-[10px] font-mono">Space</kbd>
            Play/Pause
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-[10px] font-mono">←</kbd>
            <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-[10px] font-mono">→</kbd>
            Navigate
          </span>
        </div>
      </div>
    </div>
  );
};
