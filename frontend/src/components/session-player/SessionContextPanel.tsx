/**
 * SessionContextPanel Component
 *
 * Displays context attribution breakdown from all frames.
 * Shows token counts by category with percentage of total.
 * Collapsible sections for each category with navigation to first frame of that type.
 *
 * Forensic terminal aesthetic with collapsible sections.
 */

import React, { useState, useMemo } from 'react';
import {
  ChevronDown,
  ChevronRight,
  FileText,
  Terminal,
  Brain,
  User,
  MessageSquare,
  Database,
  X,
} from 'lucide-react';
import type { PlaybackFrame, TokenAttribution } from '../../types/transcript';

interface SessionContextPanelProps {
  frames: PlaybackFrame[];
  onNavigateToFrame: (index: number) => void;
  onClose?: () => void;
}

interface CategoryConfig {
  key: keyof TokenAttribution;
  label: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  description: string;
}

const CATEGORIES: CategoryConfig[] = [
  {
    key: 'claudeMd',
    label: 'CLAUDE.md Files',
    icon: <FileText className="w-4 h-4" />,
    color: 'text-accent-cyan',
    bgColor: 'bg-accent-cyan/10',
    description: 'Project context from CLAUDE.md files',
  },
  {
    key: 'toolOutput',
    label: 'Tool Outputs',
    icon: <Terminal className="w-4 h-4" />,
    color: 'text-accent-amber',
    bgColor: 'bg-accent-amber/10',
    description: 'Results from tool executions (Bash, Read, etc.)',
  },
  {
    key: 'thinking',
    label: 'Thinking',
    icon: <Brain className="w-4 h-4" />,
    color: 'text-accent-purple',
    bgColor: 'bg-accent-purple/10',
    description: 'Claude reasoning and thinking blocks',
  },
  {
    key: 'userInput',
    label: 'User Messages',
    icon: <User className="w-4 h-4" />,
    color: 'text-accent-green',
    bgColor: 'bg-accent-green/10',
    description: 'Messages from the user',
  },
  {
    key: 'response',
    label: 'Responses',
    icon: <MessageSquare className="w-4 h-4" />,
    color: 'text-forensic-text-primary',
    bgColor: 'bg-forensic-bg-tertiary',
    description: 'Assistant responses to user',
  },
  {
    key: 'cache',
    label: 'Cache Hits',
    icon: <Database className="w-4 h-4" />,
    color: 'text-accent-blue',
    bgColor: 'bg-accent-blue/10',
    description: 'Tokens read from cache',
  },
];

/**
 * Format token count with K/M suffix for large numbers
 */
function formatTokenCount(count: number): string {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return count.toLocaleString();
}

export const SessionContextPanel: React.FC<SessionContextPanelProps> = ({
  frames,
  onNavigateToFrame,
  onClose,
}) => {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(['claudeMd', 'toolOutput'])
  );

  // Calculate total token attribution from all frames
  const totals = useMemo(() => {
    const attribution: TokenAttribution = {
      userInput: 0,
      toolOutput: 0,
      thinking: 0,
      response: 0,
      claudeMd: 0,
      cache: 0,
    };

    for (const frame of frames) {
      if (frame.tokenAttribution) {
        attribution.userInput += frame.tokenAttribution.userInput || 0;
        attribution.toolOutput += frame.tokenAttribution.toolOutput || 0;
        attribution.thinking += frame.tokenAttribution.thinking || 0;
        attribution.response += frame.tokenAttribution.response || 0;
        attribution.claudeMd += frame.tokenAttribution.claudeMd || 0;
        attribution.cache += frame.tokenAttribution.cache || 0;
      }
    }

    const total =
      attribution.userInput +
      attribution.toolOutput +
      attribution.thinking +
      attribution.response +
      attribution.claudeMd;

    return { attribution, total };
  }, [frames]);

  // Find first frame index for each category type
  const firstFrameByCategory = useMemo(() => {
    const result: Record<string, number | null> = {};

    for (const category of CATEGORIES) {
      result[category.key] = null;
    }

    // Map category keys to frame types
    const categoryToFrameType: Record<string, string | string[]> = {
      userInput: 'user_message',
      toolOutput: 'tool_execution',
      thinking: 'claude_thinking',
      response: 'claude_response',
      claudeMd: 'user_message', // CLAUDE.md context appears with user messages
      cache: 'claude_response', // Cache info typically on responses
    };

    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i];

      for (const category of CATEGORIES) {
        if (result[category.key] !== null) continue;

        const frameTypes = categoryToFrameType[category.key];
        const matchesType = Array.isArray(frameTypes)
          ? frameTypes.includes(frame.type)
          : frame.type === frameTypes;

        if (matchesType) {
          // For claudeMd, also check if there's attribution
          if (category.key === 'claudeMd') {
            if (frame.tokenAttribution?.claudeMd && frame.tokenAttribution.claudeMd > 0) {
              result[category.key] = i;
            }
          } else if (category.key === 'cache') {
            if (frame.tokenAttribution?.cache && frame.tokenAttribution.cache > 0) {
              result[category.key] = i;
            }
          } else {
            result[category.key] = i;
          }
        }
      }
    }

    return result;
  }, [frames]);

  const toggleCategory = (key: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleCategoryClick = (category: CategoryConfig) => {
    const frameIndex = firstFrameByCategory[category.key];
    if (frameIndex !== null) {
      onNavigateToFrame(frameIndex);
    }
  };

  // Filter categories to only show those with non-zero values
  const activeCategories = CATEGORIES.filter((cat) => totals.attribution[cat.key] > 0);

  return (
    <div className="bg-forensic-bg-secondary border border-forensic-border">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-forensic-border">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-accent-cyan" />
          <span className="font-mono text-sm font-bold text-forensic-text-primary uppercase tracking-wide">
            Context Attribution
          </span>
          {totals.total > 0 && (
            <span className="text-xs font-mono text-forensic-text-muted">
              ({formatTokenCount(totals.total)} total)
            </span>
          )}
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 text-forensic-text-muted hover:text-forensic-text-primary transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        {totals.total === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Database className="w-10 h-10 text-forensic-text-muted mb-3" />
            <p className="text-forensic-text-secondary font-mono text-sm mb-2">
              No context attribution data
            </p>
            <p className="text-forensic-text-muted font-mono text-xs max-w-[300px]">
              Token attribution is calculated when sessions include detailed usage metrics.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Progress bar showing distribution */}
            <div className="mb-4">
              <div className="h-3 flex overflow-hidden bg-forensic-bg-tertiary border border-forensic-border">
                {activeCategories.map((category) => {
                  const value = totals.attribution[category.key];
                  const percentage = totals.total > 0 ? (value / totals.total) * 100 : 0;
                  if (percentage < 0.5) return null;

                  return (
                    <div
                      key={category.key}
                      className={`${category.bgColor} border-r border-forensic-bg-secondary last:border-r-0`}
                      style={{ width: `${percentage}%` }}
                      title={`${category.label}: ${formatTokenCount(value)} (${percentage.toFixed(1)}%)`}
                    />
                  );
                })}
              </div>
            </div>

            {/* Category sections */}
            {activeCategories.map((category) => {
              const value = totals.attribution[category.key];
              const percentage = totals.total > 0 ? (value / totals.total) * 100 : 0;
              const isExpanded = expandedCategories.has(category.key);
              const firstFrameIndex = firstFrameByCategory[category.key];

              return (
                <div
                  key={category.key}
                  className="bg-forensic-bg-tertiary border border-forensic-border"
                >
                  <button
                    onClick={() => toggleCategory(category.key)}
                    className="w-full flex items-center gap-2 p-3 text-left hover:bg-forensic-bg-primary transition-colors"
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-3 h-3 text-forensic-text-muted" />
                    ) : (
                      <ChevronRight className="w-3 h-3 text-forensic-text-muted" />
                    )}
                    <span className={category.color}>{category.icon}</span>
                    <span className="font-mono text-xs text-forensic-text-muted uppercase tracking-wide flex-1">
                      {category.label}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className={`font-mono text-sm font-bold ${category.color}`}>
                        {formatTokenCount(value)}
                      </span>
                      <span className="font-mono text-xs text-forensic-text-muted">
                        ({percentage.toFixed(1)}%)
                      </span>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-3 pb-3 pt-1 border-t border-forensic-border">
                      <p className="font-mono text-xs text-forensic-text-secondary mb-3">
                        {category.description}
                      </p>

                      {/* Token breakdown bar */}
                      <div className="mb-3">
                        <div className="h-2 bg-forensic-bg-primary border border-forensic-border overflow-hidden">
                          <div className={category.bgColor} style={{ width: `${percentage}%` }} />
                        </div>
                      </div>

                      {/* Navigate to first frame */}
                      {firstFrameIndex !== null && (
                        <button
                          onClick={() => handleCategoryClick(category)}
                          className={`flex items-center gap-2 px-3 py-1.5 text-xs font-mono ${category.color} hover:bg-forensic-bg-primary border border-forensic-border transition-colors`}
                        >
                          <ChevronRight className="w-3 h-3" />
                          Go to first {category.label.toLowerCase()} frame
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Cache info (shown separately if present) */}
            {totals.attribution.cache > 0 && (
              <div className="mt-4 pt-3 border-t border-forensic-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Database className="w-3 h-3 text-accent-blue" />
                    <span className="font-mono text-xs text-forensic-text-muted uppercase tracking-wide">
                      Cache Efficiency
                    </span>
                  </div>
                  <span className="font-mono text-sm text-accent-blue">
                    {formatTokenCount(totals.attribution.cache)} tokens cached
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SessionContextPanel;
