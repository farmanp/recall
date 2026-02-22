/**
 * InsightsConfigModal Component
 *
 * Shows users what analyzers will run before generating insights.
 * Provides transparency into the analysis process.
 * Allows granular control over which analyzers to run.
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  Layers,
  Search,
  FileCode,
  Package,
  TestTube,
  GitBranch,
  Loader2,
  Sparkles,
} from 'lucide-react';

interface AnalyzerConfig {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
}

const ANALYZERS: AnalyzerConfig[] = [
  {
    id: 'duplicate_utility',
    name: 'Duplicate Utilities',
    description: 'Detects functions similar to existing utilities in your repository',
    icon: <Search className="w-4 h-4" />,
  },
  {
    id: 'complexity_outlier',
    name: 'Complexity Outliers',
    description: "Flags files that exceed your repository's typical size norms",
    icon: <FileCode className="w-4 h-4" />,
  },
  {
    id: 'new_dependency',
    name: 'New Dependencies',
    description: 'Reports new packages added to package.json',
    icon: <Package className="w-4 h-4" />,
  },
  {
    id: 'missing_tests',
    name: 'Test Coverage',
    description: 'Checks if production changes include corresponding tests',
    icon: <TestTube className="w-4 h-4" />,
  },
  {
    id: 'uncommon_import',
    name: 'Import Patterns',
    description: 'Identifies import patterns uncommon for this repository',
    icon: <GitBranch className="w-4 h-4" />,
  },
];

const STORAGE_KEY = 'recall-insights-analyzers';

/** Get default enabled state (all enabled) */
function getDefaultEnabled(): Record<string, boolean> {
  return ANALYZERS.reduce((acc, a) => ({ ...acc, [a.id]: true }), {});
}

/** Load enabled analyzers from localStorage */
function loadEnabledAnalyzers(): Record<string, boolean> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Merge with defaults in case new analyzers were added
      return { ...getDefaultEnabled(), ...parsed };
    }
  } catch {
    // Ignore parse errors
  }
  return getDefaultEnabled();
}

/** Save enabled analyzers to localStorage */
function saveEnabledAnalyzers(enabled: Record<string, boolean>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(enabled));
  } catch {
    // Ignore storage errors
  }
}

interface InsightsConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (enabledAnalyzers: string[]) => void;
  isGenerating: boolean;
}

export const InsightsConfigModal: React.FC<InsightsConfigModalProps> = ({
  isOpen,
  onClose,
  onGenerate,
  isGenerating,
}) => {
  const [enabledAnalyzers, setEnabledAnalyzers] =
    useState<Record<string, boolean>>(loadEnabledAnalyzers);

  // Persist changes to localStorage
  useEffect(() => {
    saveEnabledAnalyzers(enabledAnalyzers);
  }, [enabledAnalyzers]);

  const toggleAnalyzer = (id: string) => {
    setEnabledAnalyzers((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const enabledCount = Object.values(enabledAnalyzers).filter(Boolean).length;
  const allEnabled = enabledCount === ANALYZERS.length;
  const noneEnabled = enabledCount === 0;

  const toggleAll = () => {
    if (allEnabled) {
      // Disable all
      setEnabledAnalyzers(ANALYZERS.reduce((acc, a) => ({ ...acc, [a.id]: false }), {}));
    } else {
      // Enable all
      setEnabledAnalyzers(getDefaultEnabled());
    }
  };

  const handleGenerate = () => {
    const enabled = Object.entries(enabledAnalyzers)
      .filter(([, isEnabled]) => isEnabled)
      .map(([id]) => id);
    onGenerate(enabled);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-forensic-bg-secondary border border-forensic-border rounded-lg shadow-2xl max-w-lg w-full mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-forensic-border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-accent-green/10 rounded-lg">
              <Layers className="w-5 h-5 text-accent-green" />
            </div>
            <div>
              <h2 className="font-mono text-sm font-medium text-forensic-text-primary">
                Session Insights
              </h2>
              <p className="font-mono text-xs text-forensic-text-muted">
                Analyze this session for patterns and anomalies
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-forensic-text-muted hover:text-forensic-text-primary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Explanation */}
          <div className="mb-4 p-3 bg-forensic-bg-tertiary border border-forensic-border rounded">
            <p className="font-mono text-xs text-forensic-text-muted leading-relaxed">
              Insights are generated by comparing this session's changes against patterns observed
              in your repository. All analysis is{' '}
              <span className="text-accent-cyan">deterministic</span> and runs{' '}
              <span className="text-accent-cyan">locally</span> — no data leaves your machine.
            </p>
          </div>

          {/* Analyzers List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-mono text-xs text-forensic-text-muted uppercase tracking-wide">
                Analyzers ({enabledCount}/{ANALYZERS.length})
              </h3>
              <button
                onClick={toggleAll}
                className="font-mono text-xs text-accent-cyan hover:text-accent-cyan/80 transition-colors"
              >
                {allEnabled ? 'Disable All' : 'Enable All'}
              </button>
            </div>
            {ANALYZERS.map((analyzer) => {
              const isEnabled = enabledAnalyzers[analyzer.id] ?? true;
              return (
                <button
                  key={analyzer.id}
                  onClick={() => toggleAnalyzer(analyzer.id)}
                  className={`w-full flex items-start gap-3 p-3 border rounded transition-all text-left ${
                    isEnabled
                      ? 'bg-forensic-bg-tertiary border-forensic-border hover:border-accent-cyan/50'
                      : 'bg-forensic-bg-primary border-forensic-border/50 opacity-60 hover:opacity-80'
                  }`}
                >
                  <div
                    className={`p-1.5 rounded transition-colors ${
                      isEnabled
                        ? 'bg-forensic-bg-secondary text-accent-cyan'
                        : 'bg-forensic-bg-tertiary text-forensic-text-muted'
                    }`}
                  >
                    {analyzer.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`font-mono text-sm ${
                          isEnabled ? 'text-forensic-text-primary' : 'text-forensic-text-muted'
                        }`}
                      >
                        {analyzer.name}
                      </span>
                      {isEnabled ? (
                        <span className="font-mono text-xs px-1.5 py-0.5 bg-accent-green/10 text-accent-green rounded">
                          on
                        </span>
                      ) : (
                        <span className="font-mono text-xs px-1.5 py-0.5 bg-forensic-bg-tertiary text-forensic-text-muted rounded">
                          off
                        </span>
                      )}
                    </div>
                    <p className="font-mono text-xs text-forensic-text-muted mt-0.5">
                      {analyzer.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Note about baseline */}
          <div className="mt-4 p-3 border border-dashed border-forensic-border rounded">
            <p className="font-mono text-xs text-forensic-text-muted">
              <span className="text-accent-amber">Note:</span> First-time analysis for a repository
              will compute a baseline from your codebase. This may take a few seconds.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-forensic-border">
          <button
            onClick={onClose}
            className="font-mono text-sm px-4 py-2 text-forensic-text-muted hover:text-forensic-text-primary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleGenerate}
            disabled={isGenerating || noneEnabled}
            className="flex items-center gap-2 font-mono text-sm px-4 py-2 bg-accent-green text-black rounded hover:bg-accent-green/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Generate Insights
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
