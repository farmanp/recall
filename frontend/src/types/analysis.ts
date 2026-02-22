/**
 * TypeScript interfaces for Drift Analysis feature
 *
 * Mirrors the backend types for frontend consumption.
 *
 * @module types/analysis
 */

// ============================================================================
// Severity & Classification Types
// ============================================================================

/**
 * Severity levels for drift findings
 */
export type DriftSeverity = 'info' | 'review' | 'high';

/**
 * Confidence in the finding
 */
export type DriftConfidence = 'low' | 'medium' | 'high';

/**
 * Categories of drift detection
 */
export type DriftCategory =
  | 'missing_tests'
  | 'duplicate_utility'
  | 'complexity_outlier'
  | 'new_dependency'
  | 'uncommon_import';

// ============================================================================
// Evidence & Finding Types
// ============================================================================

/**
 * Evidence supporting a drift finding
 */
export interface DriftEvidence {
  type: 'file_diff' | 'existing_code' | 'pattern_match' | 'metric';
  filePath: string;
  frameId?: string;
  lineRange?: { start: number; end: number };
  description: string;
}

/**
 * A single drift finding
 */
export interface DriftFinding {
  id: string;
  category: DriftCategory;
  severity: DriftSeverity;
  confidence: DriftConfidence;
  title: string;
  description: string;
  evidence: DriftEvidence[];
  frameIndex: number;
  filesAffected: string[];
  suggestion?: string;
  repoExamples?: Array<{
    filePath: string;
    description: string;
  }>;
}

// ============================================================================
// Impact Summary Types
// ============================================================================

/**
 * Aggregated impact metrics for a session
 */
export interface ImpactSummary {
  scope: 'minimal' | 'moderate' | 'broad' | 'extensive';
  filesAffected: number;
  filesCreated: number;
  filesModified: number;
  linesAdded: number;
  linesRemoved: number;
  churn: number;
  hotspotIndex: number;
  directoriesAffected: string[];
  newDependencies: string[];
  blastRadius: Array<{
    directory: string;
    fileCount: number;
  }>;
}

// ============================================================================
// Analysis Result Types
// ============================================================================

/**
 * Complete analysis result for a session
 */
export interface DriftAnalysisResult {
  sessionId: string;
  analyzedAt: string;
  baselineId: number | null;
  impact: ImpactSummary;
  findings: DriftFinding[];
  findingsBySeverity: Record<DriftSeverity, number>;
  cached?: boolean;
}

// ============================================================================
// API Response Types
// ============================================================================

/**
 * Response from GET /api/sessions/:id/analysis/impact
 */
export interface ImpactSummaryResponse {
  impact: ImpactSummary;
  cached: boolean;
}

/**
 * Baseline summary (subset for listing)
 */
export interface BaselineSummary {
  id: number;
  repoPath: string;
  language: string;
  topLevelDir: string;
  tags: string[];
  computedAt: string;
  version: string;
  filesAnalyzed: number;
}

/**
 * Response from GET /api/analysis/baselines
 */
export interface BaselinesListResponse {
  baselines: BaselineSummary[];
}

/**
 * Response from POST /api/analysis/baselines
 */
export interface BaselineComputeResponse {
  baselineId: number;
  status: 'completed' | 'computing';
  filesAnalyzed: number;
  tags: string[];
  computedAt: string;
}

/**
 * Response from GET /api/analysis/stats
 */
export interface DriftStatsResponse {
  totalAnalyses: number;
  totalBaselines: number;
  totalFindings: number;
  findingsByCategory: Record<string, number>;
}

// ============================================================================
// UI Helper Types
// ============================================================================

/**
 * Severity badge configuration
 */
export interface SeverityBadgeConfig {
  color: string;
  bgColor: string;
  borderColor: string;
  icon: string;
}

/**
 * Get severity badge configuration
 */
export function getSeverityBadgeConfig(severity: DriftSeverity): SeverityBadgeConfig {
  switch (severity) {
    case 'high':
      return {
        color: 'text-red-400',
        bgColor: 'bg-red-500/20',
        borderColor: 'border-red-500/30',
        icon: '!!',
      };
    case 'review':
      return {
        color: 'text-amber-400',
        bgColor: 'bg-amber-500/20',
        borderColor: 'border-amber-500/30',
        icon: '!',
      };
    case 'info':
    default:
      return {
        color: 'text-blue-400',
        bgColor: 'bg-blue-500/20',
        borderColor: 'border-blue-500/30',
        icon: 'i',
      };
  }
}

/**
 * Confidence badge configuration
 */
export interface ConfidenceBadgeConfig {
  style: 'solid' | 'outlined' | 'muted';
  label: string;
}

/**
 * Get confidence badge configuration
 */
export function getConfidenceBadgeConfig(confidence: DriftConfidence): ConfidenceBadgeConfig {
  switch (confidence) {
    case 'high':
      return { style: 'solid', label: 'high' };
    case 'medium':
      return { style: 'outlined', label: 'medium' };
    case 'low':
    default:
      return { style: 'muted', label: 'low' };
  }
}

/**
 * Get scope description
 */
export function getScopeDescription(scope: ImpactSummary['scope']): string {
  switch (scope) {
    case 'minimal':
      return 'Very focused change';
    case 'moderate':
      return 'Moderate scope';
    case 'broad':
      return 'Touches multiple areas';
    case 'extensive':
      return 'Large-scale changes';
  }
}

/**
 * Format churn number
 */
export function formatChurn(churn: number): string {
  if (churn >= 1000) {
    return `${(churn / 1000).toFixed(1)}k`;
  }
  return churn.toLocaleString();
}

/**
 * Get category display name
 */
export function getCategoryDisplayName(category: DriftCategory): string {
  switch (category) {
    case 'missing_tests':
      return 'Missing Tests';
    case 'duplicate_utility':
      return 'Duplicate Utility';
    case 'complexity_outlier':
      return 'Complexity Outlier';
    case 'new_dependency':
      return 'New Dependency';
    case 'uncommon_import':
      return 'Uncommon Import';
  }
}
