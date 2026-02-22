/**
 * Drift Detectors Index
 *
 * Registry of all drift detection implementations.
 *
 * V1 Detectors:
 * - NewDependencyDetector: Detects new dependencies added to package.json
 * - MissingTestsDetector: Detects prod changes without corresponding tests
 * - ComplexityOutlierDetector: Detects files exceeding repo complexity norms
 * - DuplicateUtilityDetector: Detects functions similar to existing utilities
 *
 * Future (Phase 3):
 * - UncommonImportDetector: Detects statistically rare import patterns
 *
 * @module drift-detectors
 */

export { NewDependencyDetector } from './new-dependency-detector';
export { MissingTestsDetector } from './missing-tests-detector';
export { ComplexityOutlierDetector } from './complexity-outlier-detector';
export { DuplicateUtilityDetector } from './duplicate-utility-detector';
