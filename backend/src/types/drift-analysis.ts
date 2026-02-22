/**
 * TypeScript interfaces for Drift Analysis feature
 *
 * Deterministic, offline analysis of AI coding sessions to detect
 * repo-norm deviations and measure code impact—without LLMs or network access.
 *
 * @module drift-analysis
 */

// ============================================================================
// Severity & Classification Types
// ============================================================================

/**
 * Severity levels for drift findings
 * Using neutral terminology for clear user intuition
 */
export type DriftSeverity = 'info' | 'review' | 'high';

/**
 * Confidence in the finding (deterministic)
 * Based on evidence quality, not probabilistic inference
 */
export type DriftConfidence = 'low' | 'medium' | 'high';

/**
 * Categories of drift detection - v1 scope
 * Each maps to a specific detector implementation
 */
export type DriftCategory =
  | 'missing_tests' // Prod changes without corresponding tests
  | 'duplicate_utility' // Function exists elsewhere (fingerprint-confirmed)
  | 'complexity_outlier' // Unusually complex for this repo
  | 'new_dependency' // New dep added to package.json
  | 'uncommon_import'; // Statistical anomaly in import graph

// ============================================================================
// Evidence & Finding Types
// ============================================================================

/**
 * Evidence supporting a drift finding
 * Each piece of evidence links back to source material
 */
export interface DriftEvidence {
  /** Type of evidence */
  type: 'file_diff' | 'existing_code' | 'pattern_match' | 'metric';

  /** File path where evidence was found */
  filePath: string;

  /** Frame ID where this was detected (for navigation) */
  frameId?: string;

  /** Line range in the file */
  lineRange?: { start: number; end: number };

  /** Human-readable description */
  description: string;
}

/**
 * A single drift finding
 * All text fields use templated neutral language
 */
export interface DriftFinding {
  /** Unique identifier for this finding */
  id: string;

  /** Category of drift */
  category: DriftCategory;

  /** Severity level */
  severity: DriftSeverity;

  /** Confidence in the finding */
  confidence: DriftConfidence;

  /** Human-readable title (templated) */
  title: string;

  /** Detailed description (templated) */
  description: string;

  /** Evidence supporting this finding */
  evidence: DriftEvidence[];

  /** Frame index where detected (for timeline navigation) */
  frameIndex: number;

  /** Files involved in this finding */
  filesAffected: string[];

  /** Suggestion (not prescription) */
  suggestion?: string;

  /** Reference to similar patterns in repo */
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
 * Answers: "How big was the change?"
 */
export interface ImpactSummary {
  /** Scope assessment based on files/dirs affected */
  scope: 'minimal' | 'moderate' | 'broad' | 'extensive';

  /** Total files affected */
  filesAffected: number;

  /** Files created (new) */
  filesCreated: number;

  /** Files modified (existing) */
  filesModified: number;

  /** Lines added across all files */
  linesAdded: number;

  /** Lines removed across all files */
  linesRemoved: number;

  /** Total churn: linesAdded + linesRemoved (not net) */
  churn: number;

  /** Times same file was edited across frames (hotspot indicator) */
  hotspotIndex: number;

  /** Top-level directories affected */
  directoriesAffected: string[];

  /** New dependencies added to package.json */
  newDependencies: string[];

  /** Blast radius by directory */
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
 * Combines impact metrics + drift findings
 */
export interface DriftAnalysisResult {
  /** Session ID */
  sessionId: string;

  /** When analysis was performed (ISO 8601) */
  analyzedAt: string;

  /** Baseline ID used for comparison (null if none available) */
  baselineId: number | null;

  /** Impact summary */
  impact: ImpactSummary;

  /** All findings */
  findings: DriftFinding[];

  /** Findings count by severity */
  findingsBySeverity: Record<DriftSeverity, number>;
}

// ============================================================================
// Baseline Types
// ============================================================================

/**
 * Distribution statistics for outlier detection
 * Computed from repo codebase
 */
export interface DistributionStats {
  p50: number;
  p75: number;
  p90: number;
  p99: number;
  mean: number;
  stdDev: number;
}

/**
 * Utility function fingerprint for duplicate detection
 * Uses normalized token hashing
 */
export interface UtilityFingerprint {
  /** Function name */
  functionName: string;

  /** File path where function is defined */
  filePath: string;

  /** Normalized token hash (16 chars) */
  fingerprint: string;

  /** Token count for size comparison */
  tokenCount: number;

  /** Language of the source file */
  language: string;

  /** Top-level directory for scoping */
  topLevelDir: string;
}

/**
 * Test coupling baseline - behavioral, not stylistic
 * "When X changes, tests change Y% of the time"
 */
export interface TestCouplingBaseline {
  /** Average rate of test changes with prod changes (0-1) */
  avgTestCouplingRate: number;

  /** Coupling rate per top-level directory */
  byScope: Record<string, number>;
}

/**
 * Import edge baseline for anomaly detection
 * Tracks frequency of import patterns
 */
export interface ImportEdgeBaseline {
  /** Edge frequency: "src/ui->src/db": 3 */
  edges: Record<string, number>;

  /** Total edges observed */
  totalEdges: number;
}

/**
 * Repo baseline for comparison - 3D scoped
 * Scoped by: repoPath × language × topLevelDir
 */
export interface RepoBaseline {
  /** Unique identifier */
  id: number;

  /** Repository root path */
  repoPath: string;

  /** Programming language */
  language: string;

  /** Top-level directory scope ('src', 'lib', '*' for whole repo) */
  topLevelDir: string;

  /** Framework/tooling tags for skip rules */
  tags: string[];

  /** When baseline was computed (ISO 8601) */
  computedAt: string;

  /** Analyzer version for cache invalidation */
  version: string;

  /** Number of files analyzed */
  filesAnalyzed: number;

  /** Test coupling statistics */
  testCouplingStats: TestCouplingBaseline;

  /** Function length distribution */
  functionLengthDist: DistributionStats;

  /** Import edge frequency */
  importEdgeFrequency: ImportEdgeBaseline;

  /** Utility fingerprints for duplicate detection */
  utilityFingerprints: UtilityFingerprint[];

  /** Existing dependencies in package.json */
  dependencyCatalog: string[];
}

// ============================================================================
// Baseline Data (JSON blob stored in DB)
// ============================================================================

/**
 * Baseline data structure stored as JSON in database
 * Excludes id fields which are database-managed
 */
export interface RepoBaselineData {
  testCouplingStats: TestCouplingBaseline;
  functionLengthDist: DistributionStats;
  importEdgeFrequency: ImportEdgeBaseline;
  dependencyCatalog: string[];
}

// ============================================================================
// Database Row Types
// ============================================================================

/**
 * Row type for repo_baselines table
 */
export interface RepoBaselineRow {
  id: number;
  repo_path: string;
  language: string;
  top_level_dir: string;
  tags: string; // JSON array
  computed_at: string;
  version: string;
  files_analyzed: number;
  baseline_data: string; // JSON: RepoBaselineData
}

/**
 * Row type for drift_analysis table
 */
export interface DriftAnalysisRow {
  id: number;
  session_id: string;
  analyzed_at: string;
  baseline_id: number | null;
  impact_data: string; // JSON: ImpactSummary
  findings_data: string; // JSON: DriftFinding[]
  findings_count: number;
  findings_by_severity: string; // JSON: Record<DriftSeverity, number>
}

/**
 * Row type for utility_index table
 */
export interface UtilityIndexRow {
  id: number;
  baseline_id: number;
  function_name: string;
  file_path: string;
  fingerprint: string;
  token_count: number;
  language: string;
  top_level_dir: string;
}

// ============================================================================
// Finding Templates (Neutral Language)
// ============================================================================

/**
 * Template variables for finding messages
 */
export interface FindingTemplateVars {
  missing_tests: {
    fileCount: number;
    rate: number;
  };
  duplicate_utility: {
    name: string;
    existing: string;
    file: string;
  };
  complexity_outlier: {
    file: string;
    lines: number;
    p50: number;
    p90: number;
  };
  new_dependency: {
    dep: string;
  };
  uncommon_import: {
    source: string;
    target: string;
    percent: number;
  };
}

/**
 * Finding templates for consistent, neutral messaging
 */
export const FINDING_TEMPLATES = {
  missing_tests: {
    title: 'Production changes without corresponding tests',
    description:
      'This session modified {fileCount} production files without ' +
      'test changes. In this repository, {rate}% of similar changes include tests.',
  },
  duplicate_utility: {
    title: 'Function similar to existing utility in this repository',
    description:
      'The function "{name}" appears similar to "{existing}" in ' +
      '{file}. This repository typically reuses utility functions.',
  },
  complexity_outlier: {
    title: 'File complexity uncommon for this repository',
    description:
      '{file} has {lines} lines. The repository norm is ' +
      '{p50} lines (median), with {p90} at the 90th percentile.',
  },
  new_dependency: {
    title: 'New dependency added',
    description: 'This session added "{dep}" to package.json.',
  },
  uncommon_import: {
    title: 'Uncommon import pattern for this repository',
    description:
      'Import from {source} to {target} occurs in only ' + "{percent}% of this repository's files.",
  },
} as const;

// ============================================================================
// Detector Interface
// ============================================================================

/**
 * Interface for drift detectors
 * Each detector implements one category of drift detection
 */
export interface DriftDetector {
  /** Category this detector handles */
  category: DriftCategory;

  /** Run detection on session frames */
  detect(context: DetectorContext): DriftFinding[];
}

/**
 * Context passed to detectors
 */
export interface DetectorContext {
  /** Session ID */
  sessionId: string;

  /** Parsed playback frames */
  frames: import('./transcript').PlaybackFrame[];

  /** Repo baseline (if available) */
  baseline: RepoBaseline | null;

  /** Files touched in session with change info */
  touchedFiles: TouchedFile[];

  /** Working directory of the session */
  cwd: string;

  /** Tags detected for the session (airflow, dbt, etc.) */
  tags: string[];
}

/**
 * File touched during a session with change metrics
 */
export interface TouchedFile {
  /** File path */
  path: string;

  /** Operation type */
  operation: 'created' | 'modified' | 'deleted';

  /** Number of times this file was edited */
  editCount: number;

  /** Lines added */
  linesAdded: number;

  /** Lines removed */
  linesRemoved: number;

  /** Frame indices where file was touched */
  frameIndices: number[];

  /** Language detected */
  language: string;

  /** Top-level directory */
  topLevelDir: string;

  /** Final content (for fingerprinting) */
  finalContent?: string;
}
