/**
 * CommentaryBubble Component
 *
 * Pop Up Video-style commentary bubbles that appear on the timeline
 * and can be expanded to show full observation details from claude-mem
 */

import React, { useState } from 'react';

export interface CommentaryData {
  id: number;
  timestamp: number;
  frameIndex?: number;
  type: string;
  title: string;
  content: string;
  metadata?: Record<string, any>;
}

interface CommentaryBubbleProps {
  commentary: CommentaryData;
  position: number; // percentage (0-100) on timeline
  onClick?: () => void;
  isExpanded?: boolean;
}

/**
 * Small bubble icon on timeline
 */
export const TimelineBubbleIcon: React.FC<CommentaryBubbleProps> = ({
  commentary,
  position,
  onClick,
}) => {
  const [showPreview, setShowPreview] = useState(false);

  const typeColors: Record<string, string> = {
    decision: 'bg-purple-500 hover:bg-purple-600',
    feature: 'bg-blue-500 hover:bg-blue-600',
    bugfix: 'bg-red-500 hover:bg-red-600',
    observation: 'bg-green-500 hover:bg-green-600',
    insight: 'bg-yellow-500 hover:bg-yellow-600',
    default: 'bg-gray-500 hover:bg-gray-600',
  };

  const bgColor = typeColors[commentary.type] || typeColors.default;

  return (
    <div
      className="absolute"
      style={{
        left: `${position}%`,
        top: '-8px',
        transform: 'translateX(-50%)',
      }}
      onMouseEnter={() => setShowPreview(true)}
      onMouseLeave={() => setShowPreview(false)}
      onClick={onClick}
    >
      {/* Bubble Icon */}
      <button
        className={`${bgColor} rounded-full w-4 h-4 border-2 border-white shadow-lg cursor-pointer transition-all hover:scale-125`}
        aria-label={`Commentary: ${commentary.title}`}
      />

      {/* Hover Preview */}
      {showPreview && (
        <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-50 pointer-events-none">
          <div className="bg-gray-800 text-white text-xs px-3 py-2 rounded shadow-lg whitespace-nowrap max-w-xs">
            <div className="font-semibold">{commentary.title}</div>
            <div className="text-gray-400 text-xs mt-1">
              {commentary.type} • {new Date(commentary.timestamp).toLocaleTimeString()}
            </div>
          </div>
          {/* Arrow pointing down */}
          <div className="absolute left-1/2 transform -translate-x-1/2 top-full">
            <div className="border-8 border-transparent border-t-gray-800" />
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Expanded commentary card overlay
 */
export const CommentaryCard: React.FC<{
  commentary: CommentaryData;
  onClose: () => void;
}> = ({ commentary, onClose }) => {
  const typeColors: Record<string, { bg: string; border: string; text: string }> = {
    decision: { bg: 'bg-purple-900', border: 'border-purple-500', text: 'text-purple-300' },
    feature: { bg: 'bg-blue-900', border: 'border-blue-500', text: 'text-blue-300' },
    bugfix: { bg: 'bg-red-900', border: 'border-red-500', text: 'text-red-300' },
    observation: { bg: 'bg-green-900', border: 'border-green-500', text: 'text-green-300' },
    insight: { bg: 'bg-yellow-900', border: 'border-yellow-500', text: 'text-yellow-300' },
    default: { bg: 'bg-gray-900', border: 'border-gray-500', text: 'text-gray-300' },
  };

  const colors = typeColors[commentary.type] || typeColors.default;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div
        className={`${colors.bg} ${colors.border} border-2 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto shadow-2xl`}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-gray-700">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <span
                className={`px-3 py-1 ${colors.text} bg-opacity-20 rounded-full text-xs font-semibold uppercase`}
              >
                {commentary.type}
              </span>
              <span className="text-xs text-gray-400">
                {new Date(commentary.timestamp).toLocaleString()}
              </span>
            </div>
            <h2 className="text-xl font-bold text-white">{commentary.title}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white ml-4 text-2xl font-bold"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="prose prose-invert max-w-none">
            <p className="whitespace-pre-wrap text-gray-200">{commentary.content}</p>
          </div>

          {/* Metadata */}
          {commentary.metadata && Object.keys(commentary.metadata).length > 0 && (
            <div className="mt-6 pt-6 border-t border-gray-700">
              <h3 className="text-sm font-semibold text-gray-400 mb-3">Metadata</h3>
              <div className="bg-gray-950 rounded p-4">
                <pre className="text-xs text-gray-300 overflow-x-auto">
                  {JSON.stringify(commentary.metadata, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * Timeline overlay with all commentary bubbles
 */
export const CommentaryTimeline: React.FC<{
  commentary: CommentaryData[];
  totalFrames: number;
  frames: { timestamp: number }[];
  onBubbleClick: (commentary: CommentaryData) => void;
}> = ({ commentary, totalFrames, frames, onBubbleClick }) => {
  // Map commentary timestamps to timeline positions
  const getBubblePosition = (timestamp: number): number => {
    if (frames.length === 0) return 0;

    const firstTimestamp = frames[0].timestamp;
    const lastTimestamp = frames[frames.length - 1].timestamp;
    const totalDuration = lastTimestamp - firstTimestamp;

    if (totalDuration === 0) return 0;

    const position = ((timestamp - firstTimestamp) / totalDuration) * 100;
    return Math.max(0, Math.min(100, position));
  };

  return (
    <div className="absolute inset-0 pointer-events-none">
      <div className="relative h-full pointer-events-auto">
        {commentary.map((item) => (
          <TimelineBubbleIcon
            key={item.id}
            commentary={item}
            position={getBubblePosition(item.timestamp)}
            onClick={() => onBubbleClick(item)}
          />
        ))}
      </div>
    </div>
  );
};
