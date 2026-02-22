/**
 * Drift Analyzer Orchestrator
 *
 * Main entry point for drift analysis. Coordinates:
 * - Impact computation (always runs)
 * - Baseline loading/building
 * - Detector execution
 * - Result caching
 *
 * Analysis is on-demand, not post-import, to keep session imports fast.
 *
 * @module drift-analyzer
 */

import path from 'path';
import { getCachedAnalysis, saveAnalysis, initializeDriftSchema } from '../db/drift-queries';
import { getOrBuildBaseline, detectTags, shouldSkipDetector } from './baseline-builder';
import { inferLanguage } from './fingerprint';
import type { PlaybackFrame, FileDiff } from '../types/transcript';
import type {
  DriftAnalysisResult,
  ImpactSummary,
  DriftFinding,
  DriftSeverity,
  RepoBaseline,
  DetectorContext,
  TouchedFile,
  DriftDetector,
} from '../types/drift-analysis';

// Import detectors
import { NewDependencyDetector } from './drift-detectors/new-dependency-detector';
import { MissingTestsDetector } from './drift-detectors/missing-tests-detector';
import { ComplexityOutlierDetector } from './drift-detectors/complexity-outlier-detector';
import { DuplicateUtilityDetector } from './drift-detectors/duplicate-utility-detector';

// ============================================================================
// Schema Initialization
// ============================================================================

let schemaInitialized = false;

/**
 * Ensure drift analysis schema is initialized
 */
function ensureSchema(): void {
  if (!schemaInitialized) {
    initializeDriftSchema();
    schemaInitialized = true;
  }
}

// ============================================================================
// Impact Computation
// ============================================================================

/**
 * Compute impact summary from session frames
 *
 * This always runs regardless of baseline availability.
 * Answers: "How big was the change?"
 *
 * @param frames - Session playback frames
 * @param cwd - Working directory
 * @returns ImpactSummary
 */
function computeImpactSummary(frames: PlaybackFrame[], cwd: string): ImpactSummary {
  const touchedFiles = extractTouchedFiles(frames, cwd);

  // Count files by operation
  const created = touchedFiles.filter((f) => f.operation === 'created');
  const modified = touchedFiles.filter((f) => f.operation === 'modified');

  // Total lines
  const linesAdded = touchedFiles.reduce((sum, f) => sum + f.linesAdded, 0);
  const linesRemoved = touchedFiles.reduce((sum, f) => sum + f.linesRemoved, 0);
  const churn = linesAdded + linesRemoved;

  // Hotspot: max edits to any single file
  const hotspotIndex = Math.max(0, ...touchedFiles.map((f) => f.editCount));

  // Directories affected (unique top-level dirs)
  const directoriesAffected = [
    ...new Set(touchedFiles.map((f) => f.topLevelDir).filter((d) => d !== '*')),
  ];

  // Blast radius by directory
  const dirCounts: Record<string, number> = {};
  for (const file of touchedFiles) {
    const dir = file.topLevelDir || '*';
    dirCounts[dir] = (dirCounts[dir] || 0) + 1;
  }
  const blastRadius = Object.entries(dirCounts)
    .map(([directory, fileCount]) => ({ directory, fileCount }))
    .sort((a, b) => b.fileCount - a.fileCount);

  // Detect new dependencies (from package.json changes)
  const newDependencies = extractNewDependencies(frames);

  // Determine scope
  let scope: ImpactSummary['scope'];
  const totalFiles = touchedFiles.length;
  const totalDirs = directoriesAffected.length;

  if (totalFiles <= 2 && totalDirs <= 1) {
    scope = 'minimal';
  } else if (totalFiles <= 5 && totalDirs <= 2) {
    scope = 'moderate';
  } else if (totalFiles <= 10 && totalDirs <= 4) {
    scope = 'broad';
  } else {
    scope = 'extensive';
  }

  return {
    scope,
    filesAffected: touchedFiles.length,
    filesCreated: created.length,
    filesModified: modified.length,
    linesAdded,
    linesRemoved,
    churn,
    hotspotIndex,
    directoriesAffected,
    newDependencies,
    blastRadius,
  };
}

/**
 * Extract touched files from session frames
 *
 * Aggregates all file operations across frames.
 */
function extractTouchedFiles(frames: PlaybackFrame[], cwd: string): TouchedFile[] {
  const fileMap = new Map<string, TouchedFile>();

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    if (!frame) continue;

    // Get files from context
    const filesModified = frame.context?.filesModified || [];

    // Process modified files
    for (const filePath of filesModified) {
      const existing = fileMap.get(filePath);
      const topLevelDir = getTopLevelDir(filePath, cwd);
      const language = inferLanguage(filePath);

      if (existing) {
        existing.editCount++;
        existing.frameIndices.push(i);
      } else {
        fileMap.set(filePath, {
          path: filePath,
          operation: 'modified',
          editCount: 1,
          linesAdded: 0,
          linesRemoved: 0,
          frameIndices: [i],
          language,
          topLevelDir,
        });
      }
    }

    // Process tool executions for detailed diff info
    if (frame.type === 'tool_execution' && frame.toolExecution) {
      const tool = frame.toolExecution.tool;
      const diff = frame.toolExecution.fileDiff;

      if (diff) {
        const filePath = diff.filePath;
        const existing = fileMap.get(filePath);
        const { added, removed } = countDiffLines(diff);
        const topLevelDir = getTopLevelDir(filePath, cwd);
        const language = inferLanguage(filePath);

        // Determine if file was created or modified
        const isCreate = tool === 'Write' && !diff.oldContent;

        if (existing) {
          existing.linesAdded += added;
          existing.linesRemoved += removed;
          existing.editCount++;
          if (!existing.frameIndices.includes(i)) {
            existing.frameIndices.push(i);
          }
          if (diff.newContent) {
            existing.finalContent = diff.newContent;
          }
        } else {
          fileMap.set(filePath, {
            path: filePath,
            operation: isCreate ? 'created' : 'modified',
            editCount: 1,
            linesAdded: added,
            linesRemoved: removed,
            frameIndices: [i],
            language,
            topLevelDir,
            finalContent: diff.newContent,
          });
        }
      }
    }
  }

  return Array.from(fileMap.values());
}

/**
 * Count added and removed lines in a diff
 */
function countDiffLines(diff: FileDiff): { added: number; removed: number } {
  const oldLines = diff.oldContent ? diff.oldContent.split('\n').length : 0;
  const newLines = diff.newContent ? diff.newContent.split('\n').length : 0;

  // Simple approximation: added = new - old (if positive), removed = old - new (if positive)
  const added = Math.max(0, newLines - oldLines);
  const removed = Math.max(0, oldLines - newLines);

  return { added, removed };
}

/**
 * Get top-level directory from file path
 */
function getTopLevelDir(filePath: string, cwd: string): string {
  try {
    const relative = path.relative(cwd, filePath);
    const parts = relative.split(path.sep);
    return parts.length > 1 && parts[0] ? parts[0] : '*';
  } catch {
    return '*';
  }
}

/**
 * Extract new dependencies from package.json changes
 */
function extractNewDependencies(frames: PlaybackFrame[]): string[] {
  const newDeps: string[] = [];

  for (const frame of frames) {
    if (frame.type !== 'tool_execution') continue;

    const diff = frame.toolExecution?.fileDiff;
    if (!diff || !diff.filePath.endsWith('package.json')) continue;

    // Parse old and new content
    try {
      const oldPkg = diff.oldContent ? JSON.parse(diff.oldContent) : {};
      const newPkg = diff.newContent ? JSON.parse(diff.newContent) : {};

      const oldDeps = new Set([
        ...Object.keys(oldPkg.dependencies || {}),
        ...Object.keys(oldPkg.devDependencies || {}),
      ]);

      const newDepsSet = [
        ...Object.keys(newPkg.dependencies || {}),
        ...Object.keys(newPkg.devDependencies || {}),
      ];

      for (const dep of newDepsSet) {
        if (!oldDeps.has(dep)) {
          newDeps.push(dep);
        }
      }
    } catch {
      // JSON parse error, skip
    }
  }

  return [...new Set(newDeps)];
}

// ============================================================================
// Detector Orchestration
// ============================================================================

/**
 * Get all registered detectors
 */
function getDetectors(): DriftDetector[] {
  return [
    new NewDependencyDetector(),
    new MissingTestsDetector(),
    new ComplexityOutlierDetector(),
    new DuplicateUtilityDetector(),
    // UncommonImportDetector is deferred to Phase 3
  ];
}

/**
 * Run all detectors and collect findings
 *
 * @param context - Detector context
 * @returns Array of findings
 */
function runDetectors(context: DetectorContext): DriftFinding[] {
  const detectors = getDetectors();
  const findings: DriftFinding[] = [];

  for (const detector of detectors) {
    // Check if detector should be skipped for this session's tags
    if (shouldSkipDetector(detector.category, context.tags)) {
      continue;
    }

    try {
      const detectorFindings = detector.detect(context);
      findings.push(...detectorFindings);
    } catch (err) {
      console.error(`[DriftAnalyzer] Detector ${detector.category} failed:`, err);
    }
  }

  return findings;
}

// ============================================================================
// Main Analysis Function
// ============================================================================

/**
 * Analyze a session for drift and impact
 *
 * Main entry point for drift analysis. Returns cached result if available,
 * otherwise computes and caches.
 *
 * @param sessionId - Session UUID
 * @param frames - Session playback frames
 * @param cwd - Working directory
 * @param forceRefresh - Force re-analysis even if cached
 * @param skipCache - Skip caching (used when session isn't in database)
 * @returns DriftAnalysisResult
 */
export async function analyzeSession(
  sessionId: string,
  frames: PlaybackFrame[],
  cwd: string,
  forceRefresh: boolean = false,
  skipCache: boolean = false
): Promise<DriftAnalysisResult> {
  ensureSchema();

  // Check cache first (skip if caching is disabled)
  if (!forceRefresh && !skipCache) {
    const cached = getCachedAnalysis(sessionId);
    if (cached) {
      return cached;
    }
  }

  // Compute impact (always runs)
  const impact = computeImpactSummary(frames, cwd);

  // Try to get baseline
  let baseline: RepoBaseline | null = null;
  try {
    // Determine primary language from touched files
    const touchedFiles = extractTouchedFiles(frames, cwd);
    const languages = touchedFiles.map((f) => f.language).filter((l) => l !== 'unknown');
    const primaryLanguage = getMostCommonLanguage(languages) || 'typescript';

    baseline = await getOrBuildBaseline(cwd, primaryLanguage);
  } catch (err) {
    console.warn('[DriftAnalyzer] Failed to get baseline:', err);
  }

  // Detect session-level tags
  const sessionTags = detectSessionTags(frames);

  // Build detector context
  const touchedFiles = extractTouchedFiles(frames, cwd);
  const context: DetectorContext = {
    sessionId,
    frames,
    baseline,
    touchedFiles,
    cwd,
    tags: sessionTags,
  };

  // Run detectors
  const findings = runDetectors(context);

  // Count findings by severity
  const findingsBySeverity: Record<DriftSeverity, number> = {
    info: 0,
    review: 0,
    high: 0,
  };

  for (const finding of findings) {
    findingsBySeverity[finding.severity]++;
  }

  // Build result
  const result: DriftAnalysisResult = {
    sessionId,
    analyzedAt: new Date().toISOString(),
    baselineId: baseline?.id || null,
    impact,
    findings,
    findingsBySeverity,
  };

  // Cache result (skip if session isn't in database to avoid FK error)
  if (!skipCache) {
    saveAnalysis(result);
  }

  return result;
}

/**
 * Get most common language from array
 */
function getMostCommonLanguage(languages: string[]): string | null {
  if (languages.length === 0) return null;

  const counts: Record<string, number> = {};
  for (const lang of languages) {
    counts[lang] = (counts[lang] || 0) + 1;
  }

  let maxLang: string | null = languages[0] ?? null;
  let maxCount = 0;

  for (const [lang, count] of Object.entries(counts)) {
    if (count > maxCount) {
      maxLang = lang;
      maxCount = count;
    }
  }

  return maxLang;
}

/**
 * Detect tags from session frames
 */
function detectSessionTags(frames: PlaybackFrame[]): string[] {
  const tags: string[] = [];

  for (const frame of frames) {
    if (frame.type !== 'tool_execution') continue;

    const diff = frame.toolExecution?.fileDiff;
    if (!diff) continue;

    const fileTags = detectTags(diff.filePath, diff.newContent || '');
    tags.push(...fileTags);
  }

  return [...new Set(tags)];
}

/**
 * Get cached analysis result (without computing)
 *
 * @param sessionId - Session UUID
 * @returns Cached result or null
 */
export function getCachedAnalysisResult(sessionId: string): DriftAnalysisResult | null {
  ensureSchema();
  return getCachedAnalysis(sessionId);
}

/**
 * Delete cached analysis for a session
 *
 * @param sessionId - Session UUID
 * @returns true if deleted
 */
export { deleteAnalysis } from '../db/drift-queries';
