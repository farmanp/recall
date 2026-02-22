/**
 * ContextMeter Component
 *
 * Horizontal progress bar showing accumulated context window usage.
 * Displays fill percentage with gradient colors (green -> yellow -> red)
 * and marks phase boundaries with vertical indicators.
 *
 * Forensic terminal aesthetic.
 */

import React, { useMemo } from 'react';
import { Gauge } from 'lucide-react';

interface ContextMeterProps {
  /** Accumulated context tokens used */
  accumulatedContext?: number;
  /** Current phase number (1-indexed) */
  phaseNumber?: number;
  /** Maximum context window size (default 200K) */
  maxContext?: number;
  /** Optional array of phase boundary positions (as token counts) */
  phaseBoundaries?: number[];
}

/**
 * Format token count with K/M suffix
 */
function formatTokens(count: number): string {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1)}M`;
  }
  if (count >= 1_000) {
    return `${Math.round(count / 1_000)}K`;
  }
  return count.toString();
}

/**
 * Get gradient color class based on fill percentage
 */
function getColorForPercentage(percentage: number): {
  bgClass: string;
  textClass: string;
  borderClass: string;
} {
  if (percentage >= 80) {
    return {
      bgClass: 'bg-accent-red',
      textClass: 'text-accent-red',
      borderClass: 'border-accent-red',
    };
  }
  if (percentage >= 50) {
    return {
      bgClass: 'bg-accent-amber',
      textClass: 'text-accent-amber',
      borderClass: 'border-accent-amber',
    };
  }
  return {
    bgClass: 'bg-accent-green',
    textClass: 'text-accent-green',
    borderClass: 'border-accent-green',
  };
}

/**
 * Get inline gradient style for smooth color transitions
 */
function getGradientStyle(percentage: number): React.CSSProperties {
  // Colors matching the accent colors from tailwind config
  const green = '#22c55e'; // accent-green
  const yellow = '#eab308'; // accent-amber/yellow
  const red = '#ef4444'; // accent-red

  if (percentage >= 80) {
    // Red zone
    return { backgroundColor: red };
  }
  if (percentage >= 50) {
    // Yellow zone - gradient from yellow to red
    const t = (percentage - 50) / 30;
    return {
      background: `linear-gradient(to right, ${yellow}, ${interpolateColor(yellow, red, t)})`,
    };
  }
  if (percentage >= 30) {
    // Transition from green to yellow
    const t = (percentage - 30) / 20;
    return {
      background: `linear-gradient(to right, ${green}, ${interpolateColor(green, yellow, t)})`,
    };
  }
  // Green zone
  return { backgroundColor: green };
}

/**
 * Interpolate between two hex colors
 */
function interpolateColor(color1: string, color2: string, t: number): string {
  const r1 = parseInt(color1.slice(1, 3), 16);
  const g1 = parseInt(color1.slice(3, 5), 16);
  const b1 = parseInt(color1.slice(5, 7), 16);

  const r2 = parseInt(color2.slice(1, 3), 16);
  const g2 = parseInt(color2.slice(3, 5), 16);
  const b2 = parseInt(color2.slice(5, 7), 16);

  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

export const ContextMeter: React.FC<ContextMeterProps> = ({
  accumulatedContext = 0,
  phaseNumber,
  maxContext = 200000,
  phaseBoundaries = [],
}) => {
  // Calculate percentage
  const percentage = useMemo(() => {
    if (maxContext <= 0) return 0;
    return Math.min(100, (accumulatedContext / maxContext) * 100);
  }, [accumulatedContext, maxContext]);

  // Get color scheme based on percentage
  const colors = useMemo(() => getColorForPercentage(percentage), [percentage]);

  // Get gradient style for progress bar
  const gradientStyle = useMemo(() => getGradientStyle(percentage), [percentage]);

  // Calculate phase boundary positions as percentages
  const boundaryPositions = useMemo(() => {
    return phaseBoundaries.map((boundary) => ({
      position: Math.min(100, (boundary / maxContext) * 100),
      tokens: boundary,
    }));
  }, [phaseBoundaries, maxContext]);

  // Don't render if no context data
  if (accumulatedContext === 0 && phaseNumber === undefined) {
    return null;
  }

  return (
    <div className="bg-forensic-bg-tertiary border border-forensic-border px-3 py-2">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Gauge className={`w-3.5 h-3.5 ${colors.textClass}`} />
          <span className="font-mono text-[10px] text-forensic-text-muted uppercase tracking-wide">
            Context Window
          </span>
          {phaseNumber !== undefined && phaseNumber > 1 && (
            <span className="font-mono text-[10px] text-accent-purple">Phase {phaseNumber}</span>
          )}
        </div>
        <div className="font-mono text-xs">
          <span className={colors.textClass}>{percentage.toFixed(0)}%</span>
          <span className="text-forensic-text-muted mx-1.5">&bull;</span>
          <span className="text-forensic-text-secondary">
            {formatTokens(accumulatedContext)} tokens
          </span>
        </div>
      </div>

      {/* Progress Bar Container */}
      <div className="relative h-3 bg-forensic-bg-primary border border-forensic-border overflow-visible">
        {/* Progress Fill */}
        <div
          className="absolute top-0 left-0 h-full transition-all duration-300 ease-out"
          style={{
            width: `${percentage}%`,
            ...gradientStyle,
          }}
        />

        {/* Threshold Markers */}
        <div
          className="absolute top-0 h-full w-px bg-accent-amber/40"
          style={{ left: '50%' }}
          title="50% threshold"
        />
        <div
          className="absolute top-0 h-full w-px bg-accent-red/40"
          style={{ left: '80%' }}
          title="80% threshold"
        />

        {/* Phase Boundary Markers */}
        {boundaryPositions.map((boundary, idx) => (
          <div
            key={idx}
            className="absolute top-0 h-full flex flex-col items-center pointer-events-none"
            style={{ left: `${boundary.position}%` }}
          >
            {/* Vertical line */}
            <div
              className="absolute w-0.5 bg-accent-purple/70"
              style={{
                top: '-4px',
                height: 'calc(100% + 8px)',
              }}
            />
            {/* Small tick mark at top */}
            <div
              className="absolute w-1.5 h-0.5 bg-accent-purple/70"
              style={{ top: '-4px', transform: 'translateX(-50%)' }}
            />
          </div>
        ))}

        {/* Current Position Indicator */}
        <div
          className={`absolute top-1/2 w-1 h-4 ${colors.bgClass} border border-forensic-bg-primary shadow-sm transition-all duration-300 z-10`}
          style={{
            left: `${percentage}%`,
            transform: 'translate(-50%, -50%)',
          }}
        />
      </div>

      {/* Scale Labels */}
      <div className="flex items-center justify-between mt-1.5 font-mono text-[9px] text-forensic-text-muted">
        <span>0</span>
        <span className="text-accent-amber/60">50%</span>
        <span className="text-accent-red/60">80%</span>
        <span>{formatTokens(maxContext)}</span>
      </div>
    </div>
  );
};

export default ContextMeter;
