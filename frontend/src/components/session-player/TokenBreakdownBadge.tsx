/**
 * TokenBreakdownBadge Component
 *
 * A compact badge showing total tokens with an expandable breakdown popover.
 * Displays token attribution by category (user input, tool output, thinking, response, cache)
 * and estimated cost.
 *
 * Uses click-to-expand pattern with click-outside-to-close behavior.
 * Forensic terminal aesthetic.
 */

import React, { useState, useRef, useEffect } from 'react';
import { Zap, User, Wrench, Brain, MessageSquare, Database, DollarSign } from 'lucide-react';
import type { TokenUsage, TokenAttribution } from '../../types/transcript';

interface TokenBreakdownBadgeProps {
  tokenUsage?: TokenUsage;
  tokenAttribution?: TokenAttribution;
  estimatedCostCents?: number;
}

/**
 * Format token count with K/M suffix
 */
function formatTokens(count: number): string {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1)}M`;
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1)}K`;
  }
  return count.toString();
}

/**
 * Format cost in cents/dollars
 */
function formatCost(cents: number): string {
  if (cents >= 100) {
    return `$${(cents / 100).toFixed(2)}`;
  }
  if (cents >= 1) {
    return `${cents.toFixed(1)}c`;
  }
  if (cents > 0) {
    return `${cents.toFixed(2)}c`;
  }
  return '0c';
}

/**
 * Category configuration for breakdown display
 */
const categories: {
  key: keyof TokenAttribution;
  label: string;
  icon: React.ElementType;
  colorClass: string;
}[] = [
  { key: 'userInput', label: 'User Input', icon: User, colorClass: 'text-accent-cyan' },
  { key: 'toolOutput', label: 'Tool Output', icon: Wrench, colorClass: 'text-accent-amber' },
  { key: 'thinking', label: 'Thinking', icon: Brain, colorClass: 'text-accent-purple' },
  { key: 'response', label: 'Response', icon: MessageSquare, colorClass: 'text-accent-green' },
  { key: 'cache', label: 'Cache', icon: Database, colorClass: 'text-blue-400' },
];

export const TokenBreakdownBadge: React.FC<TokenBreakdownBadgeProps> = ({
  tokenUsage,
  tokenAttribution,
  estimatedCostCents,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Calculate total tokens
  const totalTokens = (tokenUsage?.input_tokens ?? 0) + (tokenUsage?.output_tokens ?? 0);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  // Don't render if no token data
  if (!tokenUsage && !tokenAttribution) {
    return null;
  }

  const hasAttribution = tokenAttribution && Object.values(tokenAttribution).some((v) => v > 0);

  return (
    <div ref={containerRef} className="relative inline-block">
      {/* Badge Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          flex items-center gap-1 px-1.5 py-0.5
          bg-forensic-bg-tertiary border border-forensic-border
          text-forensic-text-secondary text-[10px] font-mono
          hover:bg-forensic-border hover:text-forensic-text-primary
          transition-colors cursor-pointer
          ${isOpen ? 'bg-forensic-border text-forensic-text-primary' : ''}
        `}
        title="Click to view token breakdown"
      >
        <Zap className="w-3 h-3 text-accent-amber" />
        <span>{formatTokens(totalTokens)}</span>
      </button>

      {/* Expanded Breakdown Popover */}
      {isOpen && (
        <div
          className="
            absolute top-full left-0 mt-1 z-50
            w-56 bg-forensic-bg-secondary border border-forensic-border
            shadow-lg
          "
        >
          {/* Header */}
          <div className="px-3 py-2 border-b border-forensic-border">
            <div className="flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-accent-amber" />
              <span className="text-xs font-mono font-semibold text-forensic-text-primary uppercase tracking-wide">
                Token Breakdown
              </span>
            </div>
            <div className="mt-1 text-[10px] font-mono text-forensic-text-muted">
              {totalTokens.toLocaleString()} total tokens
            </div>
          </div>

          {/* Input/Output Summary */}
          {tokenUsage && (
            <div className="px-3 py-2 border-b border-forensic-border space-y-1">
              <div className="flex items-center justify-between text-[10px] font-mono">
                <span className="text-forensic-text-muted">Input</span>
                <span className="text-forensic-text-secondary">
                  {(tokenUsage.input_tokens ?? 0).toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between text-[10px] font-mono">
                <span className="text-forensic-text-muted">Output</span>
                <span className="text-forensic-text-secondary">
                  {(tokenUsage.output_tokens ?? 0).toLocaleString()}
                </span>
              </div>
              {(tokenUsage.cache_read_input_tokens ?? 0) > 0 && (
                <div className="flex items-center justify-between text-[10px] font-mono">
                  <span className="text-forensic-text-muted">Cache Read</span>
                  <span className="text-blue-400">
                    {(tokenUsage.cache_read_input_tokens ?? 0).toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Category Breakdown */}
          {hasAttribution && (
            <div className="px-3 py-2 border-b border-forensic-border space-y-1.5">
              <div className="text-[10px] font-mono text-forensic-text-muted uppercase tracking-wide mb-2">
                By Category
              </div>
              {categories.map(({ key, label, icon: Icon, colorClass }) => {
                const value = tokenAttribution[key] ?? 0;
                if (value === 0) return null;

                return (
                  <div
                    key={key}
                    className="flex items-center justify-between text-[10px] font-mono"
                  >
                    <div className="flex items-center gap-1.5">
                      <Icon className={`w-3 h-3 ${colorClass}`} />
                      <span className="text-forensic-text-secondary">{label}</span>
                    </div>
                    <span className={colorClass}>{formatTokens(value)}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Estimated Cost */}
          {estimatedCostCents !== undefined && estimatedCostCents > 0 && (
            <div className="px-3 py-2">
              <div className="flex items-center justify-between text-[10px] font-mono">
                <div className="flex items-center gap-1.5">
                  <DollarSign className="w-3 h-3 text-accent-green" />
                  <span className="text-forensic-text-muted">Est. Cost</span>
                </div>
                <span className="text-accent-green font-semibold">
                  {formatCost(estimatedCostCents)}
                </span>
              </div>
            </div>
          )}

          {/* No attribution data message */}
          {!hasAttribution && !tokenUsage && (
            <div className="px-3 py-2 text-[10px] font-mono text-forensic-text-muted italic">
              No detailed breakdown available
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TokenBreakdownBadge;
