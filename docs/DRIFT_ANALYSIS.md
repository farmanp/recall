# Drift Analysis: How It Works

Drift Analysis is a deterministic, offline system that analyzes AI coding sessions to detect repo-norm deviations and measure code impact—without LLMs or network access.

## What It Answers

The Impact panel answers three questions in seconds:

1. **How big was the change?** (files affected, churn, hotspot)
2. **Did it fit the repo?** (drift findings vs baseline)
3. **Is there anything to check before merging?** (review findings)

## Key Constraints

| Constraint               | Reason                                           |
| ------------------------ | ------------------------------------------------ |
| **No LLM calls**         | Deterministic, reproducible results              |
| **Zero network**         | SOC 2 / HIPAA compliant by design                |
| **Repo-local baselines** | Avoid false positives from generic rules         |
| **Framework-aware**      | Skip valid idioms (Airflow `>>`, dbt, terraform) |
| **Neutral language**     | Enforced templates: "Uncommon in this repo..."   |
| **On-demand**            | Don't slow down session import                   |

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER REQUEST                             │
│                                                                   │
│  SessionPlayerPage → Press 'i' or click Impact button            │
│                              ↓                                    │
│                     useAnalysis() hook                           │
│                              ↓                                    │
│              GET /api/sessions/:id/analysis                      │
└─────────────────────────────────────────────────────────────────┘
                               ↓
┌─────────────────────────────────────────────────────────────────┐
│                      BACKEND ANALYSIS                            │
│                                                                   │
│  1. Load session frames (from filesystem or database)            │
│  2. Check cache (drift_analysis table)                           │
│  3. If not cached → Run DriftAnalyzer                            │
│                              ↓                                    │
│            ┌─────────────────────────────────┐                   │
│            │       DRIFT ANALYZER            │                   │
│            │  ┌───────────────────────────┐  │                   │
│            │  │  1. Extract touched files │  │                   │
│            │  │  2. Compute impact metrics│  │                   │
│            │  │  3. Find/build baseline   │  │                   │
│            │  │  4. Run 5 detectors       │  │                   │
│            │  │  5. Aggregate findings    │  │                   │
│            │  └───────────────────────────┘  │                   │
│            └─────────────────────────────────┘                   │
│                              ↓                                    │
│  4. Cache result in drift_analysis table                         │
│  5. Return DriftAnalysisResult                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Impact Metrics

### Files Affected

Counts unique files touched during the session:

- **Created**: New files written
- **Modified**: Existing files edited

### Churn

Total lines changed: `linesAdded + linesRemoved`

This measures the "amount of work" rather than net change. A refactor that moves 100 lines has 200 churn (100 removed + 100 added) even if net change is 0.

### Hotspot Index

Maximum number of times any single file was edited across frames.

High hotspot (8+ edits to one file) may indicate:

- Iterative debugging
- Complex feature in one location
- Potential need to split the file

### Scope

Categorizes change breadth:

| Scope       | Files | Description            |
| ----------- | ----- | ---------------------- |
| `minimal`   | 1-2   | Single-file fix        |
| `moderate`  | 3-5   | Feature addition       |
| `broad`     | 6-10  | Multi-component change |
| `extensive` | 11+   | Large-scale changes    |

### Blast Radius

Shows which directories were affected and how many files in each:

```
src/components/     ████████████  8 files
src/utils/          ████           2 files
src/hooks/          ██             1 file
```

## Detectors

### 1. Duplicate Utility Detector

**What it finds**: Functions that appear similar to existing utilities in the repo.

**How it works** (two-stage):

1. **Stage 1 - Name matching**: Find candidates with similar names (exact match or Levenshtein distance ≤ 2)
2. **Stage 2 - Fingerprint confirmation**: Compare normalized token fingerprints

**Fingerprinting**:

```typescript
// Original code
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

// Tokenized and normalized
// Identifiers → ID, strings → STR, numbers → NUM
// "function ID ( ID : ID ) : ID { return ID . ID ( ) . ID ( STR ) [ NUM ] ; }"

// SHA-256 hash of normalized tokens
// → "a3f2b1c4..."
```

Two functions with >80% fingerprint similarity trigger a finding.

**Confidence levels**:

- `high`: ≥95% similarity
- `medium`: 80-94% similarity

### 2. Complexity Outlier Detector

**What it finds**: Files/functions that exceed the repo's complexity norms.

**How it works**:

1. Baseline computes distribution of function lengths (p50, p75, p90, p99)
2. New functions are compared against these percentiles
3. Functions exceeding p90 trigger a finding

**Example**:

```
Repository norms:
  p50 (median): 15 lines
  p90: 45 lines

New function: 78 lines → "Uncommon complexity for this repository"
```

### 3. New Dependency Detector

**What it finds**: New packages added to package.json.

**How it works**:

1. Tracks package.json changes in session frames
2. Compares `dependencies` and `devDependencies` before/after
3. Reports any additions

**Confidence**: Always `high` (hard fact)

### 4. Missing Tests Detector

**What it finds**: Production code changes without corresponding test changes.

**How it works**:

1. Baseline computes "test coupling rate" - how often prod changes include tests
2. Session's test coupling is compared to repo baseline
3. If significantly below norm, triggers finding

**Example**:

```
Repository norm: 72% of prod changes include tests
This session: 0% (5 prod files, 0 test files)
→ "Production changes without corresponding tests"
```

### 5. Uncommon Import Detector

**What it finds**: Import patterns rarely seen in the repository.

**How it works**:

1. Baseline builds import edge graph: `"src/ui→src/db": 3` (3 files have this import)
2. New imports are checked against this graph
3. Edges with <5% occurrence trigger finding

**Example**:

```
Import from src/components → src/db
This edge occurs in only 2% of repo files
→ "Uncommon import pattern for this repository"
```

## Baselines

Baselines capture the "norms" of a repository for comparison. They're scoped in 3 dimensions:

### 3D Scoping

| Dimension       | Example             | Purpose                    |
| --------------- | ------------------- | -------------------------- |
| **repoPath**    | `/Users/me/project` | Which repository           |
| **language**    | `typescript`        | Language-specific analysis |
| **topLevelDir** | `src` or `*`        | Directory scope            |

### What's in a Baseline

```typescript
interface RepoBaseline {
  // Identification
  repoPath: string;
  language: string;
  topLevelDir: string;

  // Metadata
  tags: string[]; // ['airflow', 'dbt', 'generated']
  computedAt: string;
  filesAnalyzed: number;

  // Analysis data
  testCouplingStats: {
    avgTestCouplingRate: number; // 0-1
    byScope: Record<string, number>;
  };

  functionLengthDist: {
    p50: number;
    p75: number;
    p90: number;
    p99: number;
  };

  importEdgeFrequency: {
    edges: Record<string, number>; // "src/ui→src/db": 3
    totalEdges: number;
  };

  utilityFingerprints: Array<{
    functionName: string;
    filePath: string;
    fingerprint: string;
    tokenCount: number;
  }>;

  dependencyCatalog: string[]; // Existing deps
}
```

### Framework Tags

Baselines auto-detect framework patterns to avoid false positives:

| Tag         | Detection                       | Effect                      |
| ----------- | ------------------------------- | --------------------------- |
| `airflow`   | `/dags/` path or `from airflow` | Skip `>>` operator warnings |
| `dbt`       | `.sql` with `{{ ref(`           | Skip macro warnings         |
| `terraform` | `.tf` or `.tfvars` files        | Skip HCL patterns           |
| `generated` | `DO NOT EDIT` comment           | Skip all analysis           |

### Building Baselines

Baselines are computed on-demand:

```bash
# Via API
POST /api/analysis/baselines
{
  "repoPath": "/Users/me/project",
  "language": "typescript",
  "topLevelDir": "*"
}

# Or compute for all languages
POST /api/analysis/baselines/all
{
  "repoPath": "/Users/me/project"
}
```

If no baseline exists when analysis runs, one is computed automatically.

## Neutral Language

All findings use templated language to avoid judgment:

```typescript
const FINDING_TEMPLATES = {
  duplicate_utility: {
    title: 'Function similar to existing utility in this repository',
    description:
      'The function "{name}" appears similar to "{existing}" in {file}. ' +
      'This repository typically reuses utility functions.',
  },
  complexity_outlier: {
    title: 'File complexity uncommon for this repository',
    description:
      '{file} has {lines} lines. The repository norm is ' +
      '{p50} lines (median), with {p90} at the 90th percentile.',
  },
  // ... etc
};
```

Note: No "bad", "wrong", or "should" language. Just facts and comparisons.

## Severity Levels

| Severity | Meaning                    | UI          |
| -------- | -------------------------- | ----------- |
| `high`   | Likely worth investigating | Red badge   |
| `review` | Consider reviewing         | Amber badge |
| `info`   | Informational only         | Blue badge  |

## Confidence Levels

| Confidence | Meaning           | Display        |
| ---------- | ----------------- | -------------- |
| `high`     | Strong evidence   | Solid badge    |
| `medium`   | Moderate evidence | Outlined badge |
| `low`      | Weak evidence     | Muted text     |

## Database Schema

```sql
-- Baselines
CREATE TABLE repo_baselines (
    id INTEGER PRIMARY KEY,
    repo_path TEXT NOT NULL,
    language TEXT NOT NULL,
    top_level_dir TEXT NOT NULL,
    tags TEXT NOT NULL DEFAULT '[]',
    computed_at TEXT NOT NULL,
    version TEXT NOT NULL,
    files_analyzed INTEGER NOT NULL,
    baseline_data TEXT NOT NULL,  -- JSON
    UNIQUE(repo_path, language, top_level_dir)
);

-- Analysis results (cached)
CREATE TABLE drift_analysis (
    id INTEGER PRIMARY KEY,
    session_id TEXT NOT NULL UNIQUE,
    analyzed_at TEXT NOT NULL,
    baseline_id INTEGER,
    impact_data TEXT NOT NULL,     -- JSON: ImpactSummary
    findings_data TEXT NOT NULL,   -- JSON: DriftFinding[]
    findings_count INTEGER NOT NULL,
    findings_by_severity TEXT NOT NULL,
    FOREIGN KEY (session_id) REFERENCES session_metadata(session_id),
    FOREIGN KEY (baseline_id) REFERENCES repo_baselines(id)
);

-- Utility fingerprints for duplicate detection
CREATE TABLE utility_index (
    id INTEGER PRIMARY KEY,
    baseline_id INTEGER NOT NULL,
    function_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    fingerprint TEXT NOT NULL,
    token_count INTEGER NOT NULL,
    language TEXT NOT NULL,
    top_level_dir TEXT NOT NULL,
    FOREIGN KEY (baseline_id) REFERENCES repo_baselines(id)
);
```

## API Endpoints

### Session Analysis

```bash
# Get analysis (cached or computed)
GET /api/sessions/:id/analysis
GET /api/sessions/:id/analysis?source=filesystem
GET /api/sessions/:id/analysis?refresh=true  # Force recompute

# Get just impact metrics
GET /api/sessions/:id/analysis/impact

# Delete cached analysis
DELETE /api/sessions/:id/analysis
```

### Baselines

```bash
# List all baselines
GET /api/analysis/baselines

# Compute baseline
POST /api/analysis/baselines
{ "repoPath": "/path/to/repo", "language": "typescript" }

# Compute all language baselines
POST /api/analysis/baselines/all
{ "repoPath": "/path/to/repo" }

# Get/delete baseline
GET /api/analysis/baselines/:id
DELETE /api/analysis/baselines/:id
```

### Statistics

```bash
GET /api/analysis/stats
```

## Frontend Components

### ImpactPanel

Main panel showing all analysis results. Opens with `i` key or Impact button.

### FindingCard

Individual finding with expandable details, evidence, and "Jump to Frame" action.

### BlastRadiusChart

Horizontal bar chart showing directory impact distribution.

## File Structure

```
backend/
├── src/
│   ├── types/
│   │   └── drift-analysis.ts        # TypeScript interfaces
│   ├── db/
│   │   ├── migrations/
│   │   │   └── 033_drift_analysis.sql
│   │   └── drift-queries.ts         # Database operations
│   ├── services/
│   │   ├── drift-analyzer.ts        # Main orchestrator
│   │   ├── baseline-builder.ts      # Baseline computation
│   │   ├── fingerprint.ts           # Token normalization
│   │   └── drift-detectors/
│   │       ├── index.ts
│   │       ├── duplicate-utility-detector.ts
│   │       ├── complexity-detector.ts
│   │       ├── dependency-detector.ts
│   │       ├── missing-tests-detector.ts
│   │       └── import-anomaly-detector.ts
│   └── routes/
│       └── analysis.ts              # API endpoints

frontend/
├── src/
│   ├── types/
│   │   └── analysis.ts              # Frontend types + helpers
│   ├── api/
│   │   └── analysisClient.ts        # API client
│   ├── hooks/
│   │   └── useAnalysis.ts           # React Query hooks
│   └── components/session-player/
│       ├── ImpactPanel.tsx          # Main panel
│       ├── FindingCard.tsx          # Finding display
│       └── BlastRadiusChart.tsx     # Visual chart
```

## Performance

- **Baseline computation**: ~2-5 seconds for typical repo (1000 files)
- **Session analysis**: ~500ms-2s depending on session size
- **Cached retrieval**: <50ms

Analysis results are cached in SQLite. Use `?refresh=true` to force recomputation.

## Future Enhancements

Potential additions (not in v1):

- SimHash/shingling for partial fingerprint matches
- Layer policy configuration
- Test style detection (`.test.ts` vs `.spec.ts`)
- Integration with CI/CD for automated analysis
- Historical drift tracking across sessions
