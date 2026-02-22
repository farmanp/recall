/**
 * Baseline Builder Service
 *
 * Computes repo-local baselines by analyzing existing codebase.
 * Completely offline and deterministic.
 *
 * Features:
 * - 3D scoped baselines: repoPath × language × topLevelDir
 * - Framework tag detection (airflow, dbt, terraform, generated)
 * - .gitignore respect
 * - Utility fingerprint indexing
 * - Test coupling analysis
 * - Complexity distribution computation
 *
 * @module baseline-builder
 */

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';
import { computeFingerprint, countTokens, extractFunctionBody } from './fingerprint';
import { getOrCreateBaseline, insertUtilityIndexRows, getBaselineByKey } from '../db/drift-queries';
import type {
  RepoBaseline,
  RepoBaselineData,
  UtilityFingerprint,
  DistributionStats,
  TestCouplingBaseline,
  ImportEdgeBaseline,
} from '../types/drift-analysis';

// ============================================================================
// Constants
// ============================================================================

/** Current analyzer version - change to invalidate cached baselines */
export const ANALYZER_VERSION = '1.0.0';

/** Directories to always skip */
const SKIP_DIRS = [
  'node_modules',
  'dist',
  'build',
  '.git',
  'coverage',
  '__pycache__',
  '.next',
  '.nuxt',
  '.cache',
  '.venv',
  'venv',
  'vendor',
  '.tox',
  'target',
];

/** Language extensions */
const LANGUAGE_EXTENSIONS: Record<string, string[]> = {
  typescript: ['.ts', '.tsx'],
  javascript: ['.js', '.jsx', '.mjs', '.cjs'],
  python: ['.py'],
};

/** Supported languages for baseline computation */
const SUPPORTED_LANGUAGES = ['typescript', 'javascript', 'python'];

// ============================================================================
// Tag Detection
// ============================================================================

/**
 * Detect framework/tooling tags from file content and path
 *
 * Tags are used to skip detectors that would produce false positives
 * for valid framework idioms.
 *
 * @param filePath - File path
 * @param content - File content
 * @returns Array of detected tags
 */
export function detectTags(filePath: string, content: string): string[] {
  const tags: string[] = [];

  // Airflow
  if (filePath.includes('/dags/') || content.includes('from airflow')) {
    tags.push('airflow');
  }

  // dbt
  if (filePath.endsWith('.sql') && content.includes('{{ ref(')) {
    tags.push('dbt');
  }

  // Terraform
  if (filePath.endsWith('.tf') || filePath.endsWith('.tfvars')) {
    tags.push('terraform');
  }

  // Generated code
  if (
    content.includes('DO NOT EDIT') ||
    content.includes('auto-generated') ||
    content.includes('AUTO GENERATED') ||
    content.includes('@generated') ||
    content.includes('// Code generated')
  ) {
    tags.push('generated');
  }

  // Protobuf
  if (content.includes('pb2') || filePath.endsWith('.pb.ts') || filePath.endsWith('.pb.js')) {
    tags.push('generated');
  }

  return [...new Set(tags)];
}

/**
 * Check if detector should be skipped for given tags
 *
 * @param detector - Detector category
 * @param tags - File tags
 * @returns true if detector should be skipped
 */
export function shouldSkipDetector(detector: string, tags: string[]): boolean {
  // Don't analyze generated code
  if (tags.includes('generated')) {
    return true;
  }

  // Don't flag Airflow >> operators as "uncommon"
  if (detector === 'uncommon_import' && tags.includes('airflow')) {
    return true;
  }

  return false;
}

// ============================================================================
// File Discovery
// ============================================================================

/**
 * Discover source files in a directory
 *
 * Respects .gitignore and skips common non-source directories.
 *
 * @param targetPath - Directory to scan
 * @param language - Language to filter for (optional)
 * @returns Array of file paths
 */
async function discoverFiles(targetPath: string, language?: string): Promise<string[]> {
  const extensions = language
    ? LANGUAGE_EXTENSIONS[language] || []
    : Object.values(LANGUAGE_EXTENSIONS).flat();

  if (extensions.length === 0) {
    return [];
  }

  const patterns = extensions.map((ext) => `**/*${ext}`);
  const ignorePatterns = SKIP_DIRS.map((d) => `**/${d}/**`);

  const files: string[] = [];

  for (const pattern of patterns) {
    try {
      const matches = await glob(pattern, {
        cwd: targetPath,
        ignore: ignorePatterns,
        absolute: true,
        nodir: true,
      });
      files.push(...matches);
    } catch {
      // Glob error, skip
    }
  }

  return [...new Set(files)];
}

/**
 * Get top-level directory from file path relative to repo root
 *
 * @param filePath - Absolute file path
 * @param repoPath - Repo root path
 * @returns Top-level directory name or '*' for root files
 */
function getTopLevelDir(filePath: string, repoPath: string): string {
  const relative = path.relative(repoPath, filePath);
  const parts = relative.split(path.sep);
  return parts.length > 1 && parts[0] ? parts[0] : '*';
}

// ============================================================================
// Analysis Functions
// ============================================================================

/**
 * Count lines in code
 */
function countLines(content: string): number {
  return content.split('\n').length;
}

/**
 * Extract function definitions from TypeScript/JavaScript
 */
function extractTSFunctions(
  content: string,
  filePath: string,
  language: string,
  topLevelDir: string
): UtilityFingerprint[] {
  const fingerprints: UtilityFingerprint[] = [];

  // Match function declarations, arrow functions, methods
  const patterns = [
    // function name(...) { ... }
    /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\([^)]*\)/g,
    // const name = (...) => ...
    /(?:export\s+)?(?:const|let)\s+(\w+)\s*=\s*(?:async\s*)?\([^)]*\)\s*(?::\s*[^=]+)?\s*=>/g,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const functionName = match[1];
      if (!functionName) continue;

      // Skip common non-utility names
      if (isSkippableFunctionName(functionName)) continue;

      // Extract function body
      const body = extractFunctionBody(content, functionName, language);
      if (!body || body.length < 20) continue; // Skip tiny functions

      const fingerprint = computeFingerprint(body, language);
      const tokenCount = countTokens(body, language);

      // Only index functions with meaningful size
      if (tokenCount >= 10) {
        fingerprints.push({
          functionName,
          filePath,
          fingerprint,
          tokenCount,
          language,
          topLevelDir,
        });
      }
    }
  }

  return fingerprints;
}

/**
 * Extract function definitions from Python
 */
function extractPythonFunctions(
  content: string,
  filePath: string,
  topLevelDir: string
): UtilityFingerprint[] {
  const fingerprints: UtilityFingerprint[] = [];
  const language = 'python';

  // Match function definitions
  const pattern = /^[ \t]*(?:async\s+)?def\s+(\w+)\s*\(/gm;

  let match;
  while ((match = pattern.exec(content)) !== null) {
    const functionName = match[1];
    if (!functionName) continue;

    // Skip common non-utility names
    if (isSkippableFunctionName(functionName)) continue;
    // Skip dunder methods
    if (functionName.startsWith('__') && functionName.endsWith('__')) continue;

    // Extract function body
    const body = extractFunctionBody(content, functionName, language);
    if (!body || body.length < 20) continue;

    const fingerprint = computeFingerprint(body, language);
    const tokenCount = countTokens(body, language);

    if (tokenCount >= 10) {
      fingerprints.push({
        functionName,
        filePath,
        fingerprint,
        tokenCount,
        language,
        topLevelDir,
      });
    }
  }

  return fingerprints;
}

/**
 * Check if function name should be skipped (common lifecycle/test names)
 */
function isSkippableFunctionName(name: string): boolean {
  const skipNames = new Set([
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
  return skipNames.has(name);
}

/**
 * Compute distribution statistics from values
 */
function computeDistribution(values: number[]): DistributionStats {
  if (values.length === 0) {
    return { p50: 0, p75: 0, p90: 0, p99: 0, mean: 0, stdDev: 0 };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;

  const percentile = (p: number): number => {
    const index = Math.ceil((p / 100) * n) - 1;
    const clampedIndex = Math.max(0, Math.min(index, n - 1));
    return sorted[clampedIndex] ?? 0;
  };

  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / n;
  const stdDev = Math.sqrt(variance);

  return {
    p50: percentile(50),
    p75: percentile(75),
    p90: percentile(90),
    p99: percentile(99),
    mean: Math.round(mean * 100) / 100,
    stdDev: Math.round(stdDev * 100) / 100,
  };
}

/**
 * Check if file is a test file
 */
function isTestFile(filePath: string): boolean {
  const patterns = [
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

  return patterns.some((p) => p.test(filePath));
}

/**
 * Extract import edges from TypeScript/JavaScript
 */
function extractTSImportEdges(content: string, filePath: string, repoPath: string): string[] {
  const edges: string[] = [];
  const fileDir = getTopLevelDir(filePath, repoPath);

  // Match import statements
  const importPattern = /(?:import|from)\s+['"]([^'"]+)['"]/g;

  let match;
  while ((match = importPattern.exec(content)) !== null) {
    const importPath = match[1];
    if (!importPath) continue;

    // Only track relative imports within the repo
    if (importPath.startsWith('.') || importPath.startsWith('@/')) {
      // Normalize to top-level dir
      let targetDir = '*';
      if (importPath.startsWith('@/')) {
        const parts = importPath.slice(2).split('/');
        targetDir = parts[0] || '*';
      } else {
        // Resolve relative import
        const resolved = path.resolve(path.dirname(filePath), importPath);
        targetDir = getTopLevelDir(resolved, repoPath);
      }

      if (fileDir !== targetDir) {
        edges.push(`${fileDir}->${targetDir}`);
      }
    }
  }

  return edges;
}

/**
 * Extract dependencies from package.json
 */
async function extractDependencies(repoPath: string): Promise<string[]> {
  const packageJsonPath = path.join(repoPath, 'package.json');

  try {
    const content = await fs.promises.readFile(packageJsonPath, 'utf-8');
    const pkg = JSON.parse(content);

    const deps: string[] = [];
    if (pkg.dependencies) {
      deps.push(...Object.keys(pkg.dependencies));
    }
    if (pkg.devDependencies) {
      deps.push(...Object.keys(pkg.devDependencies));
    }

    return [...new Set(deps)].sort();
  } catch {
    return [];
  }
}

// ============================================================================
// Main Builder
// ============================================================================

/**
 * Build baseline for a repository
 *
 * Creates a 3D scoped baseline (repoPath × language × topLevelDir).
 *
 * @param repoPath - Repository root path
 * @param language - Language to analyze (defaults to 'typescript')
 * @param topLevelDir - Top-level dir to scope to (defaults to '*' for whole repo)
 * @param forceRefresh - Force re-computation even if cached
 * @returns RepoBaseline
 */
export async function buildBaseline(
  repoPath: string,
  language: string = 'typescript',
  topLevelDir: string = '*',
  forceRefresh: boolean = false
): Promise<RepoBaseline> {
  // Check cache first
  if (!forceRefresh) {
    const cached = getBaselineByKey(repoPath, language, topLevelDir);
    if (cached && cached.version === ANALYZER_VERSION) {
      return cached;
    }
  }

  // Discover files
  const targetPath = topLevelDir === '*' ? repoPath : path.join(repoPath, topLevelDir);
  const files = await discoverFiles(targetPath, language);

  // Analyze files
  const fingerprints: UtilityFingerprint[] = [];
  const fileLengths: number[] = [];
  const functionLengths: number[] = [];
  const importEdges: Record<string, number> = {};
  const allTags: string[] = [];
  let testFileCount = 0;
  let prodFileCount = 0;

  for (const filePath of files) {
    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      const fileTopDir = getTopLevelDir(filePath, repoPath);

      // Only process files in target scope
      if (topLevelDir !== '*' && fileTopDir !== topLevelDir) {
        continue;
      }

      // Detect tags
      const tags = detectTags(filePath, content);
      allTags.push(...tags);

      // Skip generated files
      if (tags.includes('generated')) {
        continue;
      }

      // Track file metrics
      fileLengths.push(countLines(content));

      // Categorize file
      if (isTestFile(filePath)) {
        testFileCount++;
      } else {
        prodFileCount++;
      }

      // Extract functions
      let fileFps: UtilityFingerprint[];
      if (language === 'python') {
        fileFps = extractPythonFunctions(content, filePath, fileTopDir);
      } else {
        fileFps = extractTSFunctions(content, filePath, language, fileTopDir);
      }

      fingerprints.push(...fileFps);

      // Track function lengths
      for (const fp of fileFps) {
        functionLengths.push(fp.tokenCount);
      }

      // Extract import edges
      if (language === 'typescript' || language === 'javascript') {
        const edges = extractTSImportEdges(content, filePath, repoPath);
        for (const edge of edges) {
          importEdges[edge] = (importEdges[edge] || 0) + 1;
        }
      }
    } catch {
      // Skip unreadable files
    }
  }

  // Compute test coupling (simplified: assume tests are coupled if they exist)
  const testCouplingRate = prodFileCount > 0 ? testFileCount / prodFileCount : 0;
  const testCouplingStats: TestCouplingBaseline = {
    avgTestCouplingRate: Math.min(testCouplingRate, 1),
    byScope: { [topLevelDir]: Math.min(testCouplingRate, 1) },
  };

  // Compute distributions
  const functionLengthDist = computeDistribution(functionLengths);

  // Import edge baseline
  const totalEdges = Object.values(importEdges).reduce((a, b) => a + b, 0);
  const importEdgeFrequency: ImportEdgeBaseline = {
    edges: importEdges,
    totalEdges,
  };

  // Get dependencies
  const dependencyCatalog = await extractDependencies(repoPath);

  // Compute unique tags
  const uniqueTags = [...new Set(allTags)];

  // Build baseline data
  const baselineData: RepoBaselineData = {
    testCouplingStats,
    functionLengthDist,
    importEdgeFrequency,
    dependencyCatalog,
  };

  // Store baseline
  const baselineId = getOrCreateBaseline(
    repoPath,
    language,
    topLevelDir,
    uniqueTags,
    baselineData,
    ANALYZER_VERSION,
    files.length
  );

  // Store utility fingerprints
  insertUtilityIndexRows(baselineId, fingerprints);

  // Return complete baseline
  return {
    id: baselineId,
    repoPath,
    language,
    topLevelDir,
    tags: uniqueTags,
    computedAt: new Date().toISOString(),
    version: ANALYZER_VERSION,
    filesAnalyzed: files.length,
    testCouplingStats,
    functionLengthDist,
    importEdgeFrequency,
    utilityFingerprints: fingerprints,
    dependencyCatalog,
  };
}

/**
 * Build baselines for all supported languages in a repo
 *
 * @param repoPath - Repository root path
 * @param forceRefresh - Force re-computation
 * @returns Array of baselines
 */
export async function buildAllBaselines(
  repoPath: string,
  forceRefresh: boolean = false
): Promise<RepoBaseline[]> {
  const baselines: RepoBaseline[] = [];

  for (const language of SUPPORTED_LANGUAGES) {
    try {
      const baseline = await buildBaseline(repoPath, language, '*', forceRefresh);
      // Only include if files were analyzed
      if (baseline.filesAnalyzed > 0) {
        baselines.push(baseline);
      }
    } catch {
      // Skip on error
    }
  }

  return baselines;
}

/**
 * Get or build baseline for a repo
 *
 * Convenience function that checks cache first.
 *
 * @param repoPath - Repository root path
 * @param language - Language (optional, defaults to 'typescript')
 * @returns Baseline or null if not found and can't build
 */
export async function getOrBuildBaseline(
  repoPath: string,
  language: string = 'typescript'
): Promise<RepoBaseline | null> {
  // Check if repo exists
  if (!fs.existsSync(repoPath)) {
    return null;
  }

  try {
    return await buildBaseline(repoPath, language, '*', false);
  } catch {
    return null;
  }
}
