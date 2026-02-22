-- Migration 033: Drift Analysis
-- Best Practice Drift & Impact Analysis feature
--
-- Deterministic, offline analysis of AI coding sessions to detect
-- repo-norm deviations and measure code impact—without LLMs or network access.
--
-- Tables:
-- - repo_baselines: Computed baseline norms for repositories (3D scoped)
-- - drift_analysis: Cached analysis results per session
-- - utility_index: Indexed utility functions for duplicate detection

-- ============================================================================
-- Table: repo_baselines
-- Stores computed baseline norms for repositories
-- Scoped by: repo_path × language × top_level_dir
-- ============================================================================

CREATE TABLE IF NOT EXISTS repo_baselines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    repo_path TEXT NOT NULL,              -- Repository root path
    language TEXT NOT NULL,               -- 'typescript', 'python', etc.
    top_level_dir TEXT NOT NULL,          -- 'src', 'lib', '*' for whole repo
    tags TEXT NOT NULL DEFAULT '[]',      -- JSON array: ['airflow', 'dbt', 'terraform', 'generated']
    computed_at TEXT NOT NULL,            -- ISO 8601 timestamp
    version TEXT NOT NULL,                -- Analyzer version for cache invalidation
    files_analyzed INTEGER NOT NULL,      -- Number of files in baseline
    baseline_data TEXT NOT NULL,          -- JSON: test coupling, distributions, etc.
    UNIQUE(repo_path, language, top_level_dir)
);

-- Index for fast baseline lookup by repo
CREATE INDEX IF NOT EXISTS idx_baseline_repo
    ON repo_baselines(repo_path);

-- Index for finding stale baselines
CREATE INDEX IF NOT EXISTS idx_baseline_computed
    ON repo_baselines(computed_at DESC);

-- ============================================================================
-- Table: drift_analysis
-- Stores analysis results per session (cached on-demand)
-- ============================================================================

CREATE TABLE IF NOT EXISTS drift_analysis (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL UNIQUE,      -- Session UUID
    analyzed_at TEXT NOT NULL,            -- ISO 8601 timestamp
    baseline_id INTEGER,                  -- FK to repo_baselines (nullable if no baseline)
    impact_data TEXT NOT NULL,            -- JSON: ImpactSummary
    findings_data TEXT NOT NULL,          -- JSON: DriftFinding[]
    findings_count INTEGER NOT NULL,      -- Total findings for quick filtering
    findings_by_severity TEXT NOT NULL,   -- JSON: { info: N, review: N, high: N }
    FOREIGN KEY (session_id) REFERENCES session_metadata(session_id) ON DELETE CASCADE,
    FOREIGN KEY (baseline_id) REFERENCES repo_baselines(id) ON DELETE SET NULL
);

-- Index for fast session lookup
CREATE INDEX IF NOT EXISTS idx_drift_session
    ON drift_analysis(session_id);

-- Index for finding sessions with findings
CREATE INDEX IF NOT EXISTS idx_drift_findings_count
    ON drift_analysis(findings_count DESC);

-- Index for sorting by analysis time
CREATE INDEX IF NOT EXISTS idx_drift_analyzed
    ON drift_analysis(analyzed_at DESC);

-- ============================================================================
-- Table: utility_index
-- Indexed utility functions for duplicate detection
-- Uses fingerprints (normalized token hash) for fast matching
-- ============================================================================

CREATE TABLE IF NOT EXISTS utility_index (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    baseline_id INTEGER NOT NULL,         -- FK to repo_baselines
    function_name TEXT NOT NULL,          -- Function/method name
    file_path TEXT NOT NULL,              -- File where function is defined
    fingerprint TEXT NOT NULL,            -- Normalized token hash (16 chars)
    token_count INTEGER NOT NULL,         -- Token count for size comparison
    language TEXT NOT NULL,               -- Language of source file
    top_level_dir TEXT NOT NULL,          -- Top-level directory
    FOREIGN KEY (baseline_id) REFERENCES repo_baselines(id) ON DELETE CASCADE
);

-- Index for name-based candidate search (stage 1)
CREATE INDEX IF NOT EXISTS idx_utility_name
    ON utility_index(function_name);

-- Index for fingerprint confirmation (stage 2)
CREATE INDEX IF NOT EXISTS idx_utility_fingerprint
    ON utility_index(fingerprint);

-- Index for baseline cleanup
CREATE INDEX IF NOT EXISTS idx_utility_baseline
    ON utility_index(baseline_id);

-- Composite index for efficient baseline + name lookup
CREATE INDEX IF NOT EXISTS idx_utility_baseline_name
    ON utility_index(baseline_id, function_name);
