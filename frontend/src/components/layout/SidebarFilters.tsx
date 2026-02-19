/**
 * SidebarFilters Component
 *
 * Collapsible filter panel for the sidebar
 * Uses URL params for filter state (shareable/bookmarkable)
 */

import React, { useState } from 'react';
import { useSearchParams, useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronRight, Filter, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { AgentType } from '../../types/transcript';

interface SidebarFiltersProps {
  collapsed: boolean;
}

type DateRange = 'all' | 'today' | 'week' | 'month';

const AGENT_OPTIONS: { value: AgentType | 'all'; label: string; color: string }[] = [
  { value: 'all', label: 'All Agents', color: 'bg-forensic-text-muted' },
  { value: 'claude', label: 'Claude', color: 'bg-agent-claude' },
  { value: 'codex', label: 'Codex', color: 'bg-agent-codex' },
  { value: 'gemini', label: 'Gemini', color: 'bg-agent-gemini' },
];

const DATE_OPTIONS: { value: DateRange; label: string }[] = [
  { value: 'all', label: 'All Time' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'Last 7 Days' },
  { value: 'month', label: 'Last 30 Days' },
];

const DURATION_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: 'Any Duration' },
  { value: 1, label: '1+ min' },
  { value: 5, label: '5+ min' },
  { value: 10, label: '10+ min' },
  { value: 30, label: '30+ min' },
];

export const SidebarFilters: React.FC<SidebarFiltersProps> = ({ collapsed }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(true);

  // Only show filters on sessions page
  const isSessionsPage = location.pathname === '/sessions';

  // Read current filter values from URL
  const currentAgent = (searchParams.get('agent') as AgentType | 'all') || 'all';
  const currentDateRange = (searchParams.get('date') as DateRange) || 'all';
  const currentDuration = parseInt(searchParams.get('duration') || '0', 10);

  const hasActiveFilters =
    currentAgent !== 'all' || currentDateRange !== 'all' || currentDuration > 0;

  const updateFilter = (key: string, value: string) => {
    const newParams = new URLSearchParams(searchParams);

    if (value === 'all' || value === '0') {
      newParams.delete(key);
    } else {
      newParams.set(key, value);
    }

    // If not on sessions page, navigate there with filters
    if (!isSessionsPage) {
      navigate(`/sessions?${newParams.toString()}`);
    } else {
      setSearchParams(newParams);
    }
  };

  const clearAllFilters = () => {
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('agent');
    newParams.delete('date');
    newParams.delete('duration');
    setSearchParams(newParams);
  };

  if (collapsed) {
    return (
      <div className="px-2 py-1">
        <button
          onClick={() => navigate('/sessions')}
          className={`w-full p-2 rounded transition-colors ${
            hasActiveFilters
              ? 'bg-accent-green/20 text-accent-green'
              : 'text-forensic-text-muted hover:text-forensic-text-primary hover:bg-forensic-bg-tertiary/50'
          }`}
          title="Filters"
        >
          <Filter className="w-5 h-5 mx-auto" />
        </button>
      </div>
    );
  }

  return (
    <div className="border-t border-forensic-border">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-3 py-2.5 text-forensic-text-secondary hover:text-forensic-text-primary transition-colors"
      >
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4" />
          <span className="font-mono text-xs uppercase tracking-wider">Filters</span>
          {hasActiveFilters && (
            <span className="w-2 h-2 rounded-full bg-accent-green animate-pulse" />
          )}
        </div>
        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-4">
              {/* Agent Filter */}
              <div>
                <label className="block text-[10px] font-mono text-forensic-text-muted uppercase tracking-wider mb-2">
                  Agent
                </label>
                <div className="space-y-1">
                  {AGENT_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => updateFilter('agent', option.value)}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs font-mono transition-colors ${
                        currentAgent === option.value
                          ? 'bg-forensic-bg-tertiary text-forensic-text-primary'
                          : 'text-forensic-text-muted hover:text-forensic-text-secondary hover:bg-forensic-bg-tertiary/50'
                      }`}
                    >
                      <div className={`w-2 h-2 rounded-full ${option.color}`} />
                      <span>{option.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Date Range Filter */}
              <div>
                <label className="block text-[10px] font-mono text-forensic-text-muted uppercase tracking-wider mb-2">
                  Date Range
                </label>
                <div className="space-y-1">
                  {DATE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => updateFilter('date', option.value)}
                      className={`w-full text-left px-2 py-1.5 rounded text-xs font-mono transition-colors ${
                        currentDateRange === option.value
                          ? 'bg-forensic-bg-tertiary text-forensic-text-primary'
                          : 'text-forensic-text-muted hover:text-forensic-text-secondary hover:bg-forensic-bg-tertiary/50'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Duration Filter */}
              <div>
                <label className="block text-[10px] font-mono text-forensic-text-muted uppercase tracking-wider mb-2">
                  Min Duration
                </label>
                <div className="space-y-1">
                  {DURATION_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => updateFilter('duration', String(option.value))}
                      className={`w-full text-left px-2 py-1.5 rounded text-xs font-mono transition-colors ${
                        currentDuration === option.value
                          ? 'bg-forensic-bg-tertiary text-forensic-text-primary'
                          : 'text-forensic-text-muted hover:text-forensic-text-secondary hover:bg-forensic-bg-tertiary/50'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Clear Filters */}
              {hasActiveFilters && (
                <button
                  onClick={clearAllFilters}
                  className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-mono text-accent-red hover:bg-accent-red/10 rounded transition-colors"
                >
                  <X className="w-3 h-3" />
                  Clear Filters
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SidebarFilters;
