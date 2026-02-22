# Extract Code Profiler Package

Extract drift analysis into a standalone `packages/code-profiler` package that can be used for:

- Airflow code profiling
- Spark code profiling
- dbt code profiling
- General TypeScript/Python codebase analysis
- CI/CD integration

## Architecture

```
recall/
├── packages/
│   └── code-profiler/              ← NEW: Standalone package
│       ├── src/
│       │   ├── fingerprint.ts      (Pure - extract as-is)
│       │   ├── baseline/
│       │   │   └── builder.ts      (Refactored - no DB)
│       │   ├── detectors/
│       │   │   ├── index.ts
│       │   │   ├── duplicate-utility.ts
│       │   │   ├── complexity-outlier.ts
│       │   │   ├── missing-tests.ts
│       │   │   └── new-dependency.ts
│       │   ├── types.ts            (Generic interfaces)
│       │   └── index.ts            (Public API)
│       ├── package.json
│       └── tsconfig.json
│
├── backend/
│   └── src/
│       ├── services/
│       │   ├── drift-analyzer.ts   (KEEPS: Orchestrator)
│       │   └── frame-adapter.ts    ← NEW: PlaybackFrame → CodeChange
│       ├── db/
│       │   └── drift-queries.ts    (KEEPS: Database layer)
│       └── routes/
│           └── analysis.ts         (KEEPS: API endpoints)
│
└── frontend/                       (No changes needed)
```

## Key Abstraction: CodeChange Interface

Replace Recall-specific `PlaybackFrame` dependency with generic model:

```typescript
// packages/code-profiler/src/types.ts

export interface CodeChange {
  filePath: string;
  operation: 'created' | 'modified' | 'deleted';
  oldContent?: string;
  newContent?: string;
  language: string;
  linesAdded: number;
  linesRemoved: number;
}

export interface ProfilerContext {
  codeChanges: CodeChange[];
  baseline: RepoBaseline | null;
  projectPath: string;
  tags: string[];
}

export interface Detector {
  category: DriftCategory;
  detect(context: ProfilerContext): DriftFinding[];
}
```

## Extraction Tiers

### Tier 1: Extract As-Is (~740 lines)

| File                             | Lines | Action                    |
| -------------------------------- | ----- | ------------------------- |
| `fingerprint.ts`                 | 515   | Copy directly (zero deps) |
| `new-dependency-detector.ts`     | 94    | Copy directly             |
| `complexity-outlier-detector.ts` | 126   | Minor template adjustment |
| Type definitions                 | ~100  | Extract common types      |

### Tier 2: Refactor for Generic Context (~1,100 lines)

| File                            | Lines | Changes Needed                                     |
| ------------------------------- | ----- | -------------------------------------------------- |
| `baseline-builder.ts`           | 671   | Remove DB calls, return baseline object            |
| `missing-tests-detector.ts`     | 147   | Use `ProfilerContext` instead of `DetectorContext` |
| `duplicate-utility-detector.ts` | 382   | Use `CodeChange[]` instead of `frames`             |

### Tier 3: Keep in Recall (~1,000+ lines)

| File                     | Reason                         |
| ------------------------ | ------------------------------ |
| `drift-analyzer.ts`      | Session orchestration, caching |
| `drift-queries.ts`       | SQLite persistence             |
| `033_drift_analysis.sql` | Recall-specific schema         |

## Files to Create

### packages/code-profiler/package.json

```json
{
  "name": "@anthropic/code-profiler",
  "version": "0.1.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "test": "vitest run"
  },
  "dependencies": {
    "glob": "^10.0.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "vitest": "^1.0.0"
  }
}
```

### packages/code-profiler/src/index.ts

```typescript
// Core
export { computeFingerprint, levenshteinDistance, inferLanguage } from './fingerprint';

// Baseline
export { buildBaseline, detectTags } from './baseline/builder';

// Detectors
export { DuplicateUtilityDetector } from './detectors/duplicate-utility';
export { ComplexityOutlierDetector } from './detectors/complexity-outlier';
export { MissingTestsDetector } from './detectors/missing-tests';
export { NewDependencyDetector } from './detectors/new-dependency';

// Types
export type {
  CodeChange,
  ProfilerContext,
  Detector,
  DriftFinding,
  DriftSeverity,
  DriftConfidence,
  DriftCategory,
  RepoBaseline,
  ImpactSummary,
} from './types';

// Analysis
export { analyzeCodeChanges, computeImpactSummary } from './analyzer';
```

## Files to Modify

### Root package.json

Add `packages/code-profiler` to workspaces:

```json
{
  "workspaces": ["backend", "frontend", "packages/*"]
}
```

### backend/package.json

Add workspace dependency:

```json
{
  "dependencies": {
    "@anthropic/code-profiler": "*"
  }
}
```

### backend/src/services/drift-analyzer.ts

Replace direct detector imports with package imports:

```typescript
import {
  analyzeCodeChanges,
  DuplicateUtilityDetector,
  computeImpactSummary,
} from '@anthropic/code-profiler';

import { framesToCodeChanges } from './frame-adapter';
```

## New File: frame-adapter.ts

```typescript
// backend/src/services/frame-adapter.ts

import type { PlaybackFrame, FileDiff } from '../types/transcript';
import type { CodeChange } from '@anthropic/code-profiler';

/**
 * Convert Recall's PlaybackFrame[] to generic CodeChange[]
 */
export function framesToCodeChanges(frames: PlaybackFrame[], cwd: string): CodeChange[] {
  const changes: CodeChange[] = [];

  for (const frame of frames) {
    if (frame.toolExecution?.fileDiff) {
      const diff = frame.toolExecution.fileDiff;
      changes.push({
        filePath: diff.path,
        operation: diff.operation,
        oldContent: diff.before,
        newContent: diff.after,
        language: inferLanguage(diff.path),
        linesAdded: diff.linesAdded ?? 0,
        linesRemoved: diff.linesRemoved ?? 0,
      });
    }
  }

  return changes;
}
```

## Implementation Steps

### Phase 1: Create Package Structure

1. Create `packages/code-profiler/` directory
2. Create `package.json`, `tsconfig.json`
3. Update root `package.json` workspaces
4. Run `npm install` to link workspace

### Phase 2: Extract Pure Code (Tier 1)

1. Copy `fingerprint.ts` → `packages/code-profiler/src/fingerprint.ts`
2. Copy detector files (new-dependency, complexity-outlier)
3. Create `types.ts` with generic interfaces
4. Create `index.ts` exports
5. Verify: `npm run build -w packages/code-profiler`

### Phase 3: Refactor for Generic Context (Tier 2)

1. Create `ProfilerContext` interface (replaces `DetectorContext`)
2. Refactor `baseline-builder.ts`:
   - Remove `saveBaseline()` calls
   - Return baseline object instead of ID
   - Add `StorageAdapter` interface for optional persistence
3. Refactor `duplicate-utility-detector.ts`:
   - Use `ProfilerContext.codeChanges` instead of `frames`
   - Remove `frameIndices` from findings
4. Refactor `missing-tests-detector.ts`:
   - Same pattern

### Phase 4: Create Adapter Layer in Recall

1. Create `backend/src/services/frame-adapter.ts`
2. Update `drift-analyzer.ts` to:
   - Import from `@anthropic/code-profiler`
   - Convert frames → CodeChange using adapter
   - Keep database caching logic
3. Keep `drift-queries.ts` unchanged (Recall-specific)

### Phase 5: Tests

1. Add tests for code-profiler package
2. Update backend tests to mock the package
3. Verify end-to-end: build → start → test Impact panel

## Verification

```bash
# 1. Build the package
npm run build -w packages/code-profiler

# 2. Build backend (should use workspace link)
npm run build -w backend

# 3. Run all tests
npm test

# 4. Start dev servers
npm run dev

# 5. Test Impact panel in browser
# - Open any session
# - Press 'i' to open Impact panel
# - Verify analysis still works
```

## Future: Framework Plugins

Once extracted, can add framework-specific plugins:

```
packages/
├── code-profiler/           (core)
├── code-profiler-airflow/   (DAG patterns, operators)
├── code-profiler-spark/     (DataFrame patterns, UDFs)
├── code-profiler-dbt/       (ref patterns, macros)
└── code-profiler-terraform/ (resource patterns)
```

Each plugin would:

1. Extend `Detector` interface
2. Add framework-specific tag detection
3. Provide specialized fingerprinting

## Estimated Effort

| Component               | Hours |
| ----------------------- | ----- |
| Package structure setup | 1h    |
| Tier 1 extraction       | 2h    |
| Tier 2 refactoring      | 6h    |
| Adapter layer           | 2h    |
| Tests                   | 3h    |
| **Total**               | ~14h  |
