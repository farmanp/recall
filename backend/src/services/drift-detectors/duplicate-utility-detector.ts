/**
 * Duplicate Utility Detector
 *
 * Detects when a session creates functions that closely match
 * existing utilities in the repository.
 *
 * Uses a two-stage detection:
 * 1. Fast candidate search by function name similarity
 * 2. Fingerprint confirmation for high-confidence matches
 *
 * @module duplicate-utility-detector
 */

import {
  computeFingerprint,
  countTokens,
  areNamesSimilar,
  extractFunctionBody,
} from '../fingerprint';
import {
  findUtilityCandidatesByName,
  getUtilityFingerprintsForBaseline,
} from '../../db/drift-queries';
import type {
  DriftFinding,
  DriftDetector,
  DetectorContext,
  DriftEvidence,
  UtilityFingerprint,
} from '../../types/drift-analysis';
import { FINDING_TEMPLATES } from '../../types/drift-analysis';

/**
 * Function names to skip (lifecycle, hooks, test functions)
 */
const SKIP_FUNCTION_NAMES = new Set([
  'constructor',
  'render',
  'componentDidMount',
  'componentWillUnmount',
  'componentDidUpdate',
  'shouldComponentUpdate',
  'useEffect',
  'useState',
  'useMemo',
  'useCallback',
  'useRef',
  'useContext',
  'init',
  'main',
  'test',
  'it',
  'describe',
  'beforeEach',
  'afterEach',
  'beforeAll',
  'afterAll',
  'setup',
  'teardown',
  'setUp',
  'tearDown',
]);

/**
 * Minimum token count for a function to be considered
 */
const MIN_FUNCTION_TOKENS = 15;

/**
 * Extracted function from session
 */
interface NewFunction {
  name: string;
  filePath: string;
  frameId: string;
  frameIndex: number;
  body: string;
  language: string;
  fingerprint: string;
  tokenCount: number;
}

/**
 * Detector for functions similar to existing utilities
 */
export class DuplicateUtilityDetector implements DriftDetector {
  category = 'duplicate_utility' as const;

  detect(context: DetectorContext): DriftFinding[] {
    const findings: DriftFinding[] = [];

    // Need baseline for comparison
    if (!context.baseline) {
      return [];
    }

    // Extract new functions from session
    const newFunctions = this.extractNewFunctions(context);

    // Load utility fingerprints for baseline
    const existingFingerprints = getUtilityFingerprintsForBaseline(context.baseline.id);
    const fingerprintMap = new Map<string, UtilityFingerprint[]>();

    for (const fp of existingFingerprints) {
      const existing = fingerprintMap.get(fp.fingerprint) || [];
      existing.push(fp);
      fingerprintMap.set(fp.fingerprint, existing);
    }

    // Check each new function
    for (const func of newFunctions) {
      const matches = this.findMatches(func, fingerprintMap, context.baseline.id);

      const firstMatch = matches[0];
      if (firstMatch) {
        findings.push(this.createFinding(func, firstMatch));
      }
    }

    return findings;
  }

  /**
   * Extract new functions from session frames
   */
  private extractNewFunctions(context: DetectorContext): NewFunction[] {
    const functions: NewFunction[] = [];

    for (let i = 0; i < context.frames.length; i++) {
      const frame = context.frames[i];
      if (!frame) continue;

      if (frame.type !== 'tool_execution') continue;

      const tool = frame.toolExecution?.tool;
      if (tool !== 'Write' && tool !== 'Edit') continue;

      const diff = frame.toolExecution?.fileDiff;
      if (!diff || !diff.newContent) continue;

      // Get language from file
      const language = this.inferLanguage(diff.filePath);
      if (language === 'unknown') continue;

      // Extract functions from new content
      const extracted = this.extractFunctionsFromContent(
        diff.newContent,
        diff.oldContent,
        diff.filePath,
        frame.id ?? `frame-${i}`,
        i,
        language
      );

      functions.push(...extracted);
    }

    return functions;
  }

  /**
   * Extract functions from content
   */
  private extractFunctionsFromContent(
    newContent: string,
    oldContent: string | undefined,
    filePath: string,
    frameId: string,
    frameIndex: number,
    language: string
  ): NewFunction[] {
    const functions: NewFunction[] = [];

    // Get existing function names if this is an edit
    const existingNames = oldContent
      ? this.extractFunctionNames(oldContent, language)
      : new Set<string>();

    // Extract function definitions
    const newNames = this.extractFunctionNames(newContent, language);

    for (const name of newNames) {
      // Skip if function already existed (not new)
      if (existingNames.has(name)) continue;

      // Skip common lifecycle/hook names
      if (SKIP_FUNCTION_NAMES.has(name)) continue;

      // Extract function body
      const body = extractFunctionBody(newContent, name, language);
      if (!body) continue;

      const tokenCount = countTokens(body, language);
      if (tokenCount < MIN_FUNCTION_TOKENS) continue;

      const fingerprint = computeFingerprint(body, language);

      functions.push({
        name,
        filePath,
        frameId,
        frameIndex,
        body,
        language,
        fingerprint,
        tokenCount,
      });
    }

    return functions;
  }

  /**
   * Extract function names from content
   */
  private extractFunctionNames(content: string, language: string): Set<string> {
    const names = new Set<string>();

    if (language === 'python') {
      const pattern = /^[ \t]*(?:async\s+)?def\s+(\w+)\s*\(/gm;
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const name = match[1];
        if (name) names.add(name);
      }
    } else {
      // TypeScript/JavaScript
      const patterns = [
        /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(/g,
        /(?:export\s+)?(?:const|let)\s+(\w+)\s*=\s*(?:async\s*)?\([^)]*\)\s*(?::\s*[^=]+)?\s*=>/g,
      ];

      for (const pattern of patterns) {
        let match;
        while ((match = pattern.exec(content)) !== null) {
          const name = match[1];
          if (name) names.add(name);
        }
      }
    }

    return names;
  }

  /**
   * Find matching utilities for a new function
   *
   * Two-stage detection:
   * 1. Name similarity (fast candidate search)
   * 2. Fingerprint match (confirmation)
   */
  private findMatches(
    func: NewFunction,
    fingerprintMap: Map<string, UtilityFingerprint[]>,
    baselineId: number
  ): Array<{ fingerprint: UtilityFingerprint; similarity: number; reason: string }> {
    const matches: Array<{ fingerprint: UtilityFingerprint; similarity: number; reason: string }> =
      [];

    // Stage 1: Check for exact fingerprint match (strongest signal)
    const exactMatches = fingerprintMap.get(func.fingerprint);
    if (exactMatches) {
      for (const fp of exactMatches) {
        // Don't match against same file
        if (fp.filePath === func.filePath) continue;

        matches.push({
          fingerprint: fp,
          similarity: 1.0,
          reason: 'Exact code match (100% similar)',
        });
      }
    }

    // Stage 2: Check name similarity for candidates
    if (matches.length === 0) {
      // Get candidates by name
      const candidates = findUtilityCandidatesByName(baselineId, func.name);

      for (const candidate of candidates) {
        // Don't match against same file
        if (candidate.filePath === func.filePath) continue;

        // Check name similarity
        if (areNamesSimilar(func.name, candidate.functionName)) {
          // Check fingerprint similarity
          const similarity = this.fingerprintSimilarity(func.fingerprint, candidate.fingerprint);

          // Only include if fingerprints are somewhat similar
          // For v1, we use exact match (1.0) or nothing
          if (similarity >= 0.8) {
            matches.push({
              fingerprint: candidate,
              similarity,
              reason:
                similarity === 1.0
                  ? 'Exact code match'
                  : `Similar code (${Math.round(similarity * 100)}% similar)`,
            });
          }
        }
      }
    }

    // Sort by similarity descending
    return matches.sort((a, b) => b.similarity - a.similarity);
  }

  /**
   * Calculate fingerprint similarity
   *
   * For v1: exact match = 1.0, else 0.0
   * Future: implement shingling + Jaccard for partial matches
   */
  private fingerprintSimilarity(a: string, b: string): number {
    return a === b ? 1.0 : 0.0;
  }

  /**
   * Create a finding for a duplicate match
   */
  private createFinding(
    func: NewFunction,
    match: { fingerprint: UtilityFingerprint; similarity: number; reason: string }
  ): DriftFinding {
    const evidence: DriftEvidence[] = [
      {
        type: 'file_diff',
        filePath: func.filePath,
        frameId: func.frameId,
        description: `New function "${func.name}" (${func.tokenCount} tokens)`,
      },
      {
        type: 'existing_code',
        filePath: match.fingerprint.filePath,
        description: `Existing "${match.fingerprint.functionName}" - ${match.reason}`,
      },
    ];

    const existingFileName =
      match.fingerprint.filePath.split('/').pop() || match.fingerprint.filePath;

    return {
      id: `dup-util-${func.frameId}-${func.name}`,
      category: this.category,
      severity: match.similarity >= 0.95 ? 'high' : 'review',
      confidence: match.similarity >= 0.9 ? 'high' : 'medium',
      title: FINDING_TEMPLATES.duplicate_utility.title,
      description: FINDING_TEMPLATES.duplicate_utility.description
        .replace('{name}', func.name)
        .replace('{existing}', match.fingerprint.functionName)
        .replace('{file}', existingFileName),
      evidence,
      frameIndex: func.frameIndex,
      filesAffected: [func.filePath],
      suggestion: `Consider using "${match.fingerprint.functionName}" from ${existingFileName} instead, or extending it if needed.`,
      repoExamples: [
        {
          filePath: match.fingerprint.filePath,
          description: `${match.fingerprint.functionName}: ${match.reason}`,
        },
      ],
    };
  }

  /**
   * Infer language from file path
   */
  private inferLanguage(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase() || '';

    switch (ext) {
      case 'ts':
      case 'tsx':
        return 'typescript';
      case 'js':
      case 'jsx':
      case 'mjs':
      case 'cjs':
        return 'javascript';
      case 'py':
        return 'python';
      default:
        return 'unknown';
    }
  }
}
