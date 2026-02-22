/**
 * TokenUsageCard Component
 *
 * Displays token usage statistics with a polished, professional design.
 * Features visual breakdowns by folder, cache efficiency metrics, and cost estimates.
 */

import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Zap, DollarSign, Database, TrendingUp, ChevronRight, Bot, HelpCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTokenStats } from '../../hooks/useTranscriptApi';
import { LoadingSpinner } from '../shared/LoadingSpinner';

/**
 * Simple tooltip component
 */
const Tooltip: React.FC<{ content: string; children: React.ReactNode }> = ({
  content,
  children,
}) => (
  <span className="relative group cursor-help">
    {children}
    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1.5 bg-forensic-bg-primary border border-forensic-border rounded text-[10px] font-mono text-forensic-text-secondary opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 w-48 text-center leading-relaxed">
      {content}
    </span>
  </span>
);

/**
 * Format large numbers with K/M/B suffixes
 */
function formatNumber(num: number): string {
  if (num >= 1_000_000_000) {
    return `${(num / 1_000_000_000).toFixed(1)}B`;
  }
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1)}M`;
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(1)}K`;
  }
  return num.toLocaleString();
}

/**
 * Format cents as dollars with proper formatting
 */
function formatCost(cents: number): string {
  const dollars = cents / 100;
  if (dollars >= 1000) {
    return `$${(dollars / 1000).toFixed(1)}K`;
  }
  if (dollars >= 100) {
    return `$${Math.round(dollars)}`;
  }
  if (dollars >= 10) {
    return `$${dollars.toFixed(1)}`;
  }
  return `$${dollars.toFixed(2)}`;
}

/**
 * Calculate estimated savings from prompt caching
 * Standard input: $3/MTok, Cached: $0.30/MTok (90% discount)
 * Savings = cacheRead * $2.70/MTok
 */
function calculateCacheSavings(cacheReadTokens: number): number {
  const savingsPerMillion = 2.7; // $3.00 - $0.30
  return (cacheReadTokens / 1_000_000) * savingsPerMillion;
}

function formatSavings(dollars: number): string {
  if (dollars >= 1000) {
    return `$${(dollars / 1000).toFixed(1)}K`;
  }
  if (dollars >= 100) {
    return `$${Math.round(dollars)}`;
  }
  if (dollars >= 1) {
    return `$${dollars.toFixed(0)}`;
  }
  return `$${dollars.toFixed(2)}`;
}

interface StatBoxProps {
  label: string;
  value: string;
  subValue?: string;
  icon: React.ReactNode;
  color?: string;
  tooltip?: string;
}

const StatBox: React.FC<StatBoxProps> = ({
  label,
  value,
  subValue,
  icon,
  color = 'text-accent-green',
  tooltip,
}) => (
  <div className="flex flex-col">
    <div className="flex items-center gap-1.5 mb-1">
      <span className={color}>{icon}</span>
      <span className="text-[10px] font-mono text-forensic-text-muted uppercase tracking-wide">
        {label}
      </span>
      {tooltip && (
        <Tooltip content={tooltip}>
          <HelpCircle className="w-3 h-3 text-forensic-text-muted hover:text-forensic-text-secondary" />
        </Tooltip>
      )}
    </div>
    <div className={`text-xl font-mono font-semibold ${color}`}>{value}</div>
    {subValue && (
      <div className="text-[10px] font-mono text-forensic-text-muted mt-0.5">{subValue}</div>
    )}
  </div>
);

type BreakdownView = 'project' | 'agent';

export const TokenUsageCard: React.FC = () => {
  const navigate = useNavigate();
  const { data, isLoading, error } = useTokenStats();
  const [breakdownView, setBreakdownView] = useState<BreakdownView>('project');

  // Calculate folder bar widths based on token usage
  const folderBars = useMemo(() => {
    if (!data?.byFolder || data.byFolder.length === 0) return [];

    const maxTokens = Math.max(...data.byFolder.map((f) => f.totalTokens));

    return data.byFolder.slice(0, 5).map((folder) => ({
      ...folder,
      percentage: maxTokens > 0 ? (folder.totalTokens / maxTokens) * 100 : 0,
    }));
  }, [data]);

  // Calculate agent bar widths
  const agentBars = useMemo(() => {
    if (!data?.byAgent || data.byAgent.length === 0) return [];

    const maxTokens = Math.max(...data.byAgent.map((a) => a.totalTokens));

    return data.byAgent.map((agent) => ({
      ...agent,
      percentage: maxTokens > 0 ? (agent.totalTokens / maxTokens) * 100 : 0,
    }));
  }, [data]);

  // Get agent color
  const getAgentColor = (agent: string): string => {
    switch (agent.toLowerCase()) {
      case 'claude':
        return 'bg-agent-claude';
      case 'gemini':
        return 'bg-agent-gemini';
      case 'codex':
        return 'bg-agent-codex';
      default:
        return 'bg-forensic-text-muted';
    }
  };

  // Calculate cache efficiency description
  const cacheDescription = useMemo(() => {
    if (!data?.overall?.cache) return null;

    const { hitRate, read, created } = data.overall.cache;
    if (read === 0 && created === 0) return 'No cache data yet';

    if (hitRate >= 50) return 'Excellent cache efficiency';
    if (hitRate >= 25) return 'Good cache efficiency';
    if (hitRate >= 10) return 'Moderate cache efficiency';
    return 'Low cache efficiency';
  }, [data]);

  if (isLoading) {
    return (
      <div className="bg-forensic-bg-secondary border border-forensic-border rounded-lg p-4 h-[280px] flex items-center justify-center">
        <LoadingSpinner size="md" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-forensic-bg-secondary border border-forensic-border rounded-lg p-4 h-[280px] flex items-center justify-center">
        <p className="text-xs font-mono text-forensic-text-muted">
          Token stats unavailable. Re-import sessions to see usage data.
        </p>
      </div>
    );
  }

  const { overall, byFolder } = data;

  // Check if we have any token data
  const hasTokenData = overall.total.total > 0;

  if (!hasTokenData) {
    return (
      <div className="bg-forensic-bg-secondary border border-forensic-border rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <Zap className="w-4 h-4 text-accent-amber" />
          <h3 className="font-mono text-sm text-forensic-text-primary">Token Usage</h3>
        </div>
        <div className="py-8 text-center">
          <div className="text-forensic-text-muted font-mono text-sm mb-2">No token data yet</div>
          <div className="text-forensic-text-muted font-mono text-xs">
            Re-import sessions to capture token usage metrics
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-forensic-bg-secondary border border-forensic-border rounded-lg p-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-accent-amber" />
          <h3 className="font-mono text-sm text-forensic-text-primary">Token Usage</h3>
        </div>
        <div className="text-[10px] font-mono text-forensic-text-muted">
          {overall.sessionCount.toLocaleString()} sessions
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <StatBox
          label="Total Tokens"
          value={formatNumber(overall.total.total)}
          subValue={`${formatNumber(overall.total.input)} in / ${formatNumber(overall.total.output)} out`}
          icon={<Zap className="w-3.5 h-3.5" />}
          color="text-accent-amber"
          tooltip="Billed tokens across all sessions. Input = new prompts. Output = AI responses. Cache reads are separate."
        />
        <StatBox
          label="Est. Cost"
          value={formatCost(overall.estimatedCostCents)}
          subValue="Based on Sonnet pricing"
          icon={<DollarSign className="w-3.5 h-3.5" />}
          color="text-accent-green"
          tooltip="Estimated API cost based on Claude Sonnet pricing ($3/M input, $15/M output). Actual costs may vary."
        />
      </div>

      {/* Cache Efficiency */}
      {(overall.cache.read > 0 || overall.cache.created > 0) && (
        <div className="mb-4 p-3 bg-forensic-bg-tertiary/50 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Database className="w-3 h-3 text-accent-purple" />
              <span className="text-[10px] font-mono text-forensic-text-muted uppercase tracking-wide">
                Cache Efficiency
              </span>
              <Tooltip content="Prompt caching reduces costs by reusing repeated context (system prompts, CLAUDE.md). Higher % = more savings.">
                <HelpCircle className="w-3 h-3 text-forensic-text-muted hover:text-forensic-text-secondary" />
              </Tooltip>
            </div>
            <span className="text-xs font-mono font-semibold text-accent-purple">
              {overall.cache.hitRate}%
            </span>
          </div>
          <div className="h-1.5 bg-forensic-bg-primary rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, overall.cache.hitRate)}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className="h-full bg-accent-purple rounded-full"
            />
          </div>
          <div className="flex justify-between mt-1.5 text-[10px] font-mono text-forensic-text-muted">
            <Tooltip content="Estimated savings from prompt caching vs re-sending context each time.">
              <span className="cursor-help border-b border-dotted border-forensic-text-muted text-accent-green">
                ~{formatSavings(calculateCacheSavings(overall.cache.read))} saved
              </span>
            </Tooltip>
            <span>{cacheDescription}</span>
          </div>
        </div>
      )}

      {/* Breakdown Section */}
      {(folderBars.length > 0 || agentBars.length > 0) && (
        <div>
          {/* Toggle between Project and Agent view */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setBreakdownView('project')}
                className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono uppercase tracking-wide transition-colors ${
                  breakdownView === 'project'
                    ? 'bg-forensic-bg-tertiary text-forensic-text-primary'
                    : 'text-forensic-text-muted hover:text-forensic-text-primary'
                }`}
              >
                <TrendingUp className="w-3 h-3" />
                Project
              </button>
              <button
                onClick={() => setBreakdownView('agent')}
                className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono uppercase tracking-wide transition-colors ${
                  breakdownView === 'agent'
                    ? 'bg-forensic-bg-tertiary text-forensic-text-primary'
                    : 'text-forensic-text-muted hover:text-forensic-text-primary'
                }`}
              >
                <Bot className="w-3 h-3" />
                Agent
              </button>
            </div>
          </div>

          {/* Project Breakdown */}
          {breakdownView === 'project' && folderBars.length > 0 && (
            <div className="space-y-2">
              {folderBars.map((folder, index) => (
                <motion.button
                  key={folder.folder}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => navigate(`/folders?path=${encodeURIComponent(folder.folder)}`)}
                  className="w-full group"
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-xs font-mono text-forensic-text-primary truncate group-hover:text-accent-green transition-colors">
                        {folder.name}
                      </span>
                      <ChevronRight className="w-3 h-3 text-forensic-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <span className="text-[10px] font-mono text-forensic-text-muted flex-shrink-0 ml-2">
                      {formatNumber(folder.totalTokens)}
                    </span>
                  </div>
                  <div className="h-1 bg-forensic-bg-tertiary rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${folder.percentage}%` }}
                      transition={{ duration: 0.4, delay: index * 0.05 }}
                      className="h-full bg-accent-amber/60 rounded-full group-hover:bg-accent-amber transition-colors"
                    />
                  </div>
                </motion.button>
              ))}

              {byFolder.length > 5 && (
                <button
                  onClick={() => navigate('/folders')}
                  className="mt-1 text-[10px] font-mono text-accent-green hover:text-accent-green/80 transition-colors"
                >
                  View all {byFolder.length} projects →
                </button>
              )}
            </div>
          )}

          {/* Agent Breakdown */}
          {breakdownView === 'agent' && agentBars.length > 0 && (
            <div className="space-y-2">
              {agentBars.map((agent, index) => (
                <motion.div
                  key={agent.agent}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="w-full"
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div className={`w-2 h-2 rounded-full ${getAgentColor(agent.agent)}`} />
                      <span className="text-xs font-mono text-forensic-text-primary capitalize">
                        {agent.agent}
                      </span>
                      <span className="text-[10px] font-mono text-forensic-text-muted">
                        ({agent.sessionCount} sessions)
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-forensic-text-muted flex-shrink-0 ml-2">
                      {formatNumber(agent.totalTokens)}
                    </span>
                  </div>
                  <div className="h-1 bg-forensic-bg-tertiary rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${agent.percentage}%` }}
                      transition={{ duration: 0.4, delay: index * 0.05 }}
                      className={`h-full rounded-full ${getAgentColor(agent.agent)}`}
                    />
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* Empty states */}
          {breakdownView === 'project' && folderBars.length === 0 && (
            <p className="text-[10px] font-mono text-forensic-text-muted text-center py-2">
              No project data
            </p>
          )}
          {breakdownView === 'agent' && agentBars.length === 0 && (
            <p className="text-[10px] font-mono text-forensic-text-muted text-center py-2">
              No agent data
            </p>
          )}
        </div>
      )}
    </motion.div>
  );
};

export default TokenUsageCard;
