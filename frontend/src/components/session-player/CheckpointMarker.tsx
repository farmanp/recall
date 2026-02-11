/**
 * CheckpointMarker Component
 *
 * Small marker shown on TimelineScrubber for each checkpoint.
 * Shows checkpoint name on hover.
 * Click navigates to that frame.
 */

import React, { useState } from 'react';
import { Bookmark } from 'lucide-react';
import type { Checkpoint } from '../../types/competitive';

interface CheckpointMarkerProps {
  checkpoint: Checkpoint;
  totalFrames: number;
  onClick: (frameIndex: number) => void;
}

export const CheckpointMarker: React.FC<CheckpointMarkerProps> = ({
  checkpoint,
  totalFrames,
  onClick,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const position = totalFrames > 1 ? (checkpoint.frameIndex / (totalFrames - 1)) * 100 : 0;

  return (
    <div
      className="absolute z-10"
      style={{
        left: `${position}%`,
        top: '-20px',
        transform: 'translateX(-50%)',
      }}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClick(checkpoint.frameIndex);
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="relative flex items-center justify-center w-5 h-5 bg-accent-cyan border border-accent-cyan/50 hover:bg-accent-cyan/80 transition-colors cursor-pointer"
        title={checkpoint.name}
      >
        <Bookmark className="w-3 h-3 text-forensic-bg-primary" />

        {/* Connector line to timeline */}
        <div
          className="absolute bg-accent-cyan/50"
          style={{
            width: '1px',
            height: '12px',
            top: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
          }}
        />
      </button>

      {/* Hover Tooltip */}
      {isHovered && (
        <div
          className="absolute bg-forensic-bg-secondary border border-forensic-border px-2 py-1.5 z-20 pointer-events-none whitespace-nowrap"
          style={{
            top: '-2.5rem',
            left: '50%',
            transform: 'translateX(-50%)',
          }}
        >
          <div className="font-mono text-xs text-forensic-text-primary">{checkpoint.name}</div>
          <div className="font-mono text-[10px] text-forensic-text-muted">
            Frame {checkpoint.frameIndex + 1}
          </div>
          {/* Arrow pointing down */}
          <div
            className="absolute w-2 h-2 bg-forensic-bg-secondary border-r border-b border-forensic-border"
            style={{
              bottom: '-5px',
              left: '50%',
              transform: 'translateX(-50%) rotate(45deg)',
            }}
          />
        </div>
      )}
    </div>
  );
};

/**
 * CheckpointMarkers Component
 *
 * Container for rendering multiple checkpoint markers on the timeline.
 * Designed to be placed as an overlay on TimelineScrubber.
 */
interface CheckpointMarkersProps {
  checkpoints: Checkpoint[];
  totalFrames: number;
  onNavigateToFrame: (frameIndex: number) => void;
}

export const CheckpointMarkers: React.FC<CheckpointMarkersProps> = ({
  checkpoints,
  totalFrames,
  onNavigateToFrame,
}) => {
  if (checkpoints.length === 0) return null;

  return (
    <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
      {checkpoints.map((checkpoint) => (
        <div key={checkpoint.id} className="pointer-events-auto">
          <CheckpointMarker
            checkpoint={checkpoint}
            totalFrames={totalFrames}
            onClick={onNavigateToFrame}
          />
        </div>
      ))}
    </div>
  );
};

export default CheckpointMarker;
