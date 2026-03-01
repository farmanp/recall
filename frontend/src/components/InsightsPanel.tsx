/**
 * Insights Panel Component
 *
 * Displays session insights with graceful upgrade prompts for
 * users who don't have insights configured.
 */

import React, { useEffect, useState } from 'react';
import './InsightsPanel.css';

interface InsightsPanelProps {
  sessionId: string;
}

interface InsightsData {
  sessionId: string;
  behavior: {
    decisiveness: number;
    toolRetries: number;
    errorRecoveryRate: number;
    patternScore: number;
  };
  complexity: {
    avgCyclomatic: number;
    avgCognitive: number;
    maxNesting: number;
    complexityDelta: number;
  };
  cost: {
    totalTokens: number;
    estimatedCostUSD: number;
    tokensByFile: { file: string; tokens: number }[];
    tokensByTool: { tool: string; tokens: number }[];
  };
  quality: {
    antipatterns: Array<{
      type: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      file: string;
      line: number;
      message: string;
    }>;
    clSizeScore: number;
    testCoverageRatio: number;
    changeCoherence: number;
  };
  recommendations: string[];
  tier: 'free' | 'pro';
  analysisTimeMs: number;
}

interface UpgradeOption {
  tier: string;
  description: string;
  cta: string;
  url: string;
}

export const InsightsPanel: React.FC<InsightsPanelProps> = ({ sessionId }) => {
  const [insights, setInsights] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [upgradeOptions, setUpgradeOptions] = useState<UpgradeOption[]>([]);

  useEffect(() => {
    const fetchInsights = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/insights/session/${sessionId}`);

        if (response.status === 402) {
          // Payment required - show upgrade prompt
          const data = await response.json();
          setError(data.error || 'Insights not available');
          setUpgradeOptions(data.options || []);
          return;
        }

        if (!response.ok) {
          throw new Error('Failed to load insights');
        }

        const data = await response.json();
        setInsights(data.insights);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchInsights();
  }, [sessionId]);

  if (loading) {
    return (
      <div className="insights-panel loading">
        <div className="spinner" />
        <p>Analyzing session...</p>
      </div>
    );
  }

  if (error && upgradeOptions.length > 0) {
    return (
      <div className="insights-panel upgrade-prompt">
        <div className="upgrade-header">
          <h3>🚀 Unlock Insights</h3>
          <p>{error}</p>
        </div>

        <div className="upgrade-options">
          {upgradeOptions.map((option) => (
            <div
              key={option.tier}
              className={`upgrade-option ${option.tier === 'pro' ? 'recommended' : ''}`}
            >
              <div className="tier-badge">{option.tier.toUpperCase()}</div>
              <p className="tier-description">{option.description}</p>
              <a href={option.url} target="_blank" rel="noopener noreferrer" className="cta-button">
                {option.cta} →
              </a>
            </div>
          ))}
        </div>

        <div className="upgrade-footer">
          <p className="privacy-note">
            Free tier: Uses privacy-first SaaS API (metadata only)
            <br />
            Pro tier: Runs 100% locally, complete privacy
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="insights-panel error">
        <p>Error loading insights: {error}</p>
      </div>
    );
  }

  if (!insights) {
    return null;
  }

  return (
    <div className="insights-panel">
      <div className="insights-header">
        <h3>Session Insights</h3>
        <span className={`tier-badge ${insights.tier}`}>{insights.tier.toUpperCase()}</span>
      </div>

      {/* Behavior Metrics */}
      <section className="insights-section">
        <h4>Behavior</h4>
        <div className="metrics-grid">
          <MetricCard
            label="Decisiveness"
            value={insights.behavior.decisiveness}
            format="percentage"
            description="How quickly decisions were made"
          />
          <MetricCard
            label="Tool Retries"
            value={insights.behavior.toolRetries}
            format="number"
            description="Failed tool executions that were retried"
          />
          <MetricCard
            label="Error Recovery"
            value={insights.behavior.errorRecoveryRate}
            format="percentage"
            description="Errors successfully recovered from"
          />
          <MetricCard
            label="Pattern Score"
            value={insights.behavior.patternScore}
            format="score"
            description="Code quality and consistency"
          />
        </div>
      </section>

      {/* Complexity Metrics */}
      <section className="insights-section">
        <h4>Complexity</h4>
        <div className="metrics-grid">
          <MetricCard
            label="Cyclomatic"
            value={insights.complexity.avgCyclomatic}
            format="number"
            description="Average cyclomatic complexity"
          />
          <MetricCard
            label="Cognitive"
            value={insights.complexity.avgCognitive}
            format="number"
            description="Average cognitive complexity"
          />
          <MetricCard
            label="Max Nesting"
            value={insights.complexity.maxNesting}
            format="number"
            description="Deepest nesting level"
          />
          <MetricCard
            label="Delta"
            value={insights.complexity.complexityDelta}
            format="delta"
            description="Change in complexity"
          />
        </div>
      </section>

      {/* Cost Metrics */}
      <section className="insights-section">
        <h4>Cost</h4>
        <div className="metrics-grid">
          <MetricCard
            label="Total Tokens"
            value={insights.cost.totalTokens}
            format="number"
            description="Total tokens used"
          />
          <MetricCard
            label="Estimated Cost"
            value={insights.cost.estimatedCostUSD}
            format="currency"
            description="Estimated API cost in USD"
          />
        </div>

        {insights.cost.tokensByFile.length > 0 && (
          <div className="cost-breakdown">
            <h5>Top Files by Token Usage</h5>
            <ul>
              {insights.cost.tokensByFile.slice(0, 5).map((item, i) => (
                <li key={i}>
                  <span className="file-name">{item.file}</span>
                  <span className="token-count">{item.tokens.toLocaleString()}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Quality Issues */}
      {insights.quality.antipatterns.length > 0 && (
        <section className="insights-section">
          <h4>Quality Issues</h4>
          <div className="antipatterns-list">
            {insights.quality.antipatterns.slice(0, 10).map((ap, i) => (
              <div key={i} className={`antipattern ${ap.severity}`}>
                <div className="antipattern-header">
                  <span className="severity-badge">{ap.severity}</span>
                  <span className="antipattern-type">{ap.type}</span>
                </div>
                <p className="antipattern-message">{ap.message}</p>
                <p className="antipattern-location">
                  {ap.file}:{ap.line}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recommendations */}
      {insights.recommendations.length > 0 && (
        <section className="insights-section">
          <h4>Recommendations</h4>
          <ul className="recommendations-list">
            {insights.recommendations.map((rec, i) => (
              <li key={i}>{rec}</li>
            ))}
          </ul>
        </section>
      )}

      <div className="insights-footer">
        <p className="analysis-time">Analysis completed in {insights.analysisTimeMs}ms</p>
      </div>
    </div>
  );
};

interface MetricCardProps {
  label: string;
  value: number;
  format: 'number' | 'percentage' | 'currency' | 'score' | 'delta';
  description?: string;
}

const MetricCard: React.FC<MetricCardProps> = ({ label, value, format, description }) => {
  const formatValue = () => {
    switch (format) {
      case 'percentage':
        return `${(value * 100).toFixed(1)}%`;
      case 'currency':
        return `$${value.toFixed(4)}`;
      case 'score':
        return value.toFixed(2);
      case 'delta':
        const sign = value >= 0 ? '+' : '';
        return `${sign}${value.toFixed(1)}`;
      default:
        return value.toFixed(1);
    }
  };

  return (
    <div className="metric-card">
      <div className="metric-value">{formatValue()}</div>
      <div className="metric-label">{label}</div>
      {description && <div className="metric-description">{description}</div>}
    </div>
  );
};
