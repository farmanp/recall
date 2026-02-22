/**
 * Complexity Outlier Detector
 *
 * Detects files that exceed repository complexity norms.
 * Uses function length distribution from baseline to identify outliers.
 *
 * @module complexity-outlier-detector
 */

import type {
  DriftFinding,
  DriftDetector,
  DetectorContext,
  DriftEvidence,
} from '../../types/drift-analysis';
import { FINDING_TEMPLATES } from '../../types/drift-analysis';

/**
 * Minimum file size (lines) to consider for complexity analysis
 */
const MIN_FILE_LINES = 50;

/**
 * Test file patterns
 */
const TEST_FILE_PATTERNS = [
  /\.test\.[jt]sx?$/,
  /\.spec\.[jt]sx?$/,
  /_test\.[jt]sx?$/,
  /_spec\.[jt]sx?$/,
  /\.test\.py$/,
  /_test\.py$/,
  /test_.*\.py$/,
  /__tests__\//,
  /\/tests?\//,
];

/**
 * Check if a file is a test file
 */
function isTestFile(filePath: string): boolean {
  return TEST_FILE_PATTERNS.some((pattern) => pattern.test(filePath));
}

/**
 * Count lines in content
 */
function countLines(content: string): number {
  return content.split('\n').length;
}

/**
 * Format ratio for display (e.g., "1.8×")
 */
function formatRatio(value: number, baseline: number): string {
  const ratio = value / baseline;
  return `${ratio.toFixed(1)}×`;
}

/**
 * Detector for files with unusual complexity
 */
export class ComplexityOutlierDetector implements DriftDetector {
  category = 'complexity_outlier' as const;

  detect(context: DetectorContext): DriftFinding[] {
    const findings: DriftFinding[] = [];

    // Need baseline for comparison
    if (!context.baseline) {
      return [];
    }

    const { p50, p90 } = context.baseline.functionLengthDist;

    // Skip if baseline has no meaningful data
    if (p90 === 0) {
      return [];
    }

    // Check each touched file
    for (const file of context.touchedFiles) {
      // Skip files without content
      if (!file.finalContent) continue;

      // Skip small files
      const lines = countLines(file.finalContent);
      if (lines < MIN_FILE_LINES) continue;

      // Check if file exceeds p90
      // Token count could be used for finer-grained complexity analysis in the future
      // const tokens = countTokens(file.finalContent, file.language);

      // Use token count as proxy for complexity
      // Scale by comparing to baseline token distribution
      // If no token baseline, use lines as fallback
      const effectiveP90 = p90 * 1.5; // Some buffer for file-level vs function-level

      if (lines > effectiveP90) {
        findings.push(
          this.createFinding(
            file.path,
            lines,
            p50,
            p90,
            context,
            file.frameIndices,
            file.linesAdded
          )
        );
      }
    }

    return findings;
  }

  private createFinding(
    filePath: string,
    lines: number,
    p50: number,
    p90: number,
    context: DetectorContext,
    frameIndices: number[],
    linesAddedInSession: number
  ): DriftFinding {
    const fileName = filePath.split('/').pop() || filePath;
    const isTest = isTestFile(filePath);
    const ratio = formatRatio(lines, p90);

    const evidence: DriftEvidence[] = [
      {
        type: 'metric',
        filePath,
        description: `File has ${lines} lines (${ratio} larger than p90 of ${p90})`,
      },
    ];

    // Add session attribution if significant lines were added
    if (linesAddedInSession > 0) {
      evidence.push({
        type: 'metric',
        filePath,
        description: `This session added +${linesAddedInSession} lines`,
      });
    }

    const firstFrameIndex = frameIndices[0];
    if (firstFrameIndex !== undefined) {
      const frame = context.frames[firstFrameIndex];
      evidence.push({
        type: 'file_diff',
        filePath,
        frameId: frame?.id,
        description: `Modified in frame ${firstFrameIndex}`,
      });
    }

    // Softer language for test files
    const suggestion = isTest
      ? 'Large test files can become harder to reason about over time. ' +
        'Consider organizing tests into smaller, focused modules if this continues to grow.'
      : 'Consider breaking this file into smaller modules if it continues to grow. ' +
        'Large files can be harder to maintain.';

    // Adjust title for test files
    const title = isTest
      ? 'Test file size uncommon for this repository'
      : FINDING_TEMPLATES.complexity_outlier.title;

    return {
      id: `complexity-${context.sessionId}-${fileName}`,
      category: this.category,
      severity: lines > p90 * 2 ? 'review' : 'info',
      confidence: 'medium',
      title,
      description: FINDING_TEMPLATES.complexity_outlier.description
        .replace('{file}', fileName)
        .replace('{lines}', lines.toString())
        .replace('{p50}', p50.toString())
        .replace('{p90}', p90.toString()),
      evidence,
      frameIndex: frameIndices[0] ?? 0,
      filesAffected: [filePath],
      suggestion,
    };
  }
}
