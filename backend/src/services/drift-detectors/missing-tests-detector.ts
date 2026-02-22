/**
 * Missing Tests Detector
 *
 * Detects when production files are changed without corresponding test changes.
 * Compares against repo baseline to determine if this is unusual.
 *
 * @module missing-tests-detector
 */

import type {
  DriftFinding,
  DriftDetector,
  DetectorContext,
  DriftEvidence,
} from '../../types/drift-analysis';
import { FINDING_TEMPLATES } from '../../types/drift-analysis';

/**
 * Patterns that identify test files
 */
const TEST_FILE_PATTERNS = [
  /\.test\.[jt]sx?$/,
  /\.spec\.[jt]sx?$/,
  /__tests__\//,
  /\/test\//,
  /\/tests\//,
  /_test\.py$/,
  /test_.*\.py$/,
  /_test\.go$/,
  /Test\.java$/,
];

/**
 * Patterns that identify non-production files (should be excluded)
 */
const NON_PROD_PATTERNS = [
  /\.config\.[jt]s$/,
  /\.d\.ts$/,
  /package\.json$/,
  /\.md$/,
  /\.json$/,
  /\.ya?ml$/,
  /\.env/,
  /\.gitignore$/,
  /eslint/,
  /prettier/,
  /tsconfig/,
];

/**
 * Check if a file is a test file
 */
function isTestFile(filePath: string): boolean {
  return TEST_FILE_PATTERNS.some((pattern) => pattern.test(filePath));
}

/**
 * Check if a file is a production source file
 */
function isProdFile(filePath: string): boolean {
  // Must be a source file
  const isSource = /\.[jt]sx?$|\.py$|\.go$|\.java$|\.rs$|\.rb$|\.php$|\.cs$/.test(filePath);
  if (!isSource) return false;

  // Must not be a test file
  if (isTestFile(filePath)) return false;

  // Must not be a config/non-prod file
  if (NON_PROD_PATTERNS.some((pattern) => pattern.test(filePath))) return false;

  return true;
}

/**
 * Detector for production changes without corresponding tests
 */
export class MissingTestsDetector implements DriftDetector {
  category = 'missing_tests' as const;

  detect(context: DetectorContext): DriftFinding[] {
    const findings: DriftFinding[] = [];

    // Separate touched files into prod and test
    const prodFiles = context.touchedFiles.filter((f) => isProdFile(f.path));
    const testFiles = context.touchedFiles.filter((f) => isTestFile(f.path));

    // If no prod files changed, nothing to check
    if (prodFiles.length === 0) {
      return [];
    }

    // If test files were changed, no finding
    if (testFiles.length > 0) {
      return [];
    }

    // Get baseline test coupling rate
    const baselineRate = context.baseline?.testCouplingStats.avgTestCouplingRate ?? 0.5;
    const ratePercent = Math.round(baselineRate * 100);

    // Only flag if baseline suggests tests are usually added with prod changes
    // and at least 2 prod files were changed (single file changes are often small fixes)
    if (baselineRate < 0.3 || prodFiles.length < 2) {
      return [];
    }

    // Create finding
    const evidence: DriftEvidence[] = prodFiles.slice(0, 5).map((f) => {
      const firstFrameIndex = f.frameIndices[0];
      const frame = firstFrameIndex !== undefined ? context.frames[firstFrameIndex] : undefined;
      return {
        type: 'file_diff' as const,
        filePath: f.path,
        frameId: frame?.id,
        description: `Modified ${f.path.split('/').pop()}`,
      };
    });

    if (prodFiles.length > 5) {
      evidence.push({
        type: 'metric' as const,
        filePath: '',
        description: `...and ${prodFiles.length - 5} more production files`,
      });
    }

    findings.push({
      id: `missing-tests-${context.sessionId}`,
      category: this.category,
      severity: 'review',
      confidence: baselineRate >= 0.7 ? 'high' : 'medium',
      title: FINDING_TEMPLATES.missing_tests.title,
      description: FINDING_TEMPLATES.missing_tests.description
        .replace('{fileCount}', prodFiles.length.toString())
        .replace('{rate}', ratePercent.toString()),
      evidence,
      frameIndex: prodFiles[0]?.frameIndices[0] ?? 0,
      filesAffected: prodFiles.map((f) => f.path),
      suggestion:
        'Consider adding or updating tests for the changed production code. ' +
        `This repository typically includes tests with ${ratePercent}% of similar changes.`,
    });

    return findings;
  }
}
