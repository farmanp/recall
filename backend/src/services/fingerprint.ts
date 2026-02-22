/**
 * Fingerprint Service
 *
 * Provides token normalization and fingerprinting for duplicate detection.
 * Deterministic: same code always produces same fingerprint.
 *
 * Algorithm:
 * 1. Tokenize code using language-aware regex
 * 2. Normalize: identifiers → 'ID', strings → 'STR', numbers → 'NUM'
 * 3. Remove whitespace and comments
 * 4. SHA-256 hash the normalized token stream
 * 5. Return first 16 characters
 *
 * @module fingerprint
 */

import crypto from 'crypto';

// ============================================================================
// Token Types
// ============================================================================

type TokenType =
  | 'identifier'
  | 'keyword'
  | 'string'
  | 'number'
  | 'operator'
  | 'punctuation'
  | 'comment'
  | 'whitespace';

interface Token {
  type: TokenType;
  value: string;
}

// ============================================================================
// Language Keywords
// ============================================================================

const TYPESCRIPT_KEYWORDS = new Set([
  'abstract',
  'any',
  'as',
  'async',
  'await',
  'boolean',
  'break',
  'case',
  'catch',
  'class',
  'const',
  'constructor',
  'continue',
  'debugger',
  'declare',
  'default',
  'delete',
  'do',
  'else',
  'enum',
  'export',
  'extends',
  'false',
  'finally',
  'for',
  'from',
  'function',
  'get',
  'if',
  'implements',
  'import',
  'in',
  'instanceof',
  'interface',
  'let',
  'module',
  'namespace',
  'never',
  'new',
  'null',
  'number',
  'object',
  'of',
  'package',
  'private',
  'protected',
  'public',
  'readonly',
  'require',
  'return',
  'set',
  'static',
  'string',
  'super',
  'switch',
  'symbol',
  'this',
  'throw',
  'true',
  'try',
  'type',
  'typeof',
  'undefined',
  'unknown',
  'var',
  'void',
  'while',
  'with',
  'yield',
]);

const PYTHON_KEYWORDS = new Set([
  'False',
  'None',
  'True',
  'and',
  'as',
  'assert',
  'async',
  'await',
  'break',
  'class',
  'continue',
  'def',
  'del',
  'elif',
  'else',
  'except',
  'finally',
  'for',
  'from',
  'global',
  'if',
  'import',
  'in',
  'is',
  'lambda',
  'nonlocal',
  'not',
  'or',
  'pass',
  'raise',
  'return',
  'try',
  'while',
  'with',
  'yield',
]);

// ============================================================================
// Tokenization
// ============================================================================

/**
 * Tokenize code into tokens
 *
 * Simple regex-based tokenizer that handles common patterns.
 * Not a full parser, but sufficient for fingerprinting.
 *
 * @param code - Source code
 * @param language - Programming language
 * @returns Array of tokens
 */
function tokenize(code: string, language: string): Token[] {
  const tokens: Token[] = [];
  const keywords = language === 'python' ? PYTHON_KEYWORDS : TYPESCRIPT_KEYWORDS;

  // Combined regex for tokenization
  // Order matters: more specific patterns first
  const patterns: Array<{ type: TokenType; regex: RegExp }> = [
    // Comments
    { type: 'comment', regex: /^\/\/[^\n]*/m },
    { type: 'comment', regex: /^\/\*[\s\S]*?\*\//m },
    { type: 'comment', regex: /^#[^\n]*/m }, // Python comments

    // Strings (single, double, template)
    { type: 'string', regex: /^"(?:[^"\\]|\\.)*"/m },
    { type: 'string', regex: /^'(?:[^'\\]|\\.)*'/m },
    { type: 'string', regex: /^`(?:[^`\\]|\\.)*`/m },
    { type: 'string', regex: /^"""[\s\S]*?"""/m }, // Python docstrings
    { type: 'string', regex: /^'''[\s\S]*?'''/m },

    // Numbers
    { type: 'number', regex: /^0x[0-9a-fA-F]+/m }, // Hex
    { type: 'number', regex: /^0b[01]+/m }, // Binary
    { type: 'number', regex: /^0o[0-7]+/m }, // Octal
    { type: 'number', regex: /^\d+\.?\d*(?:[eE][+-]?\d+)?/m }, // Decimal/float

    // Identifiers (must come after numbers)
    { type: 'identifier', regex: /^[a-zA-Z_$][a-zA-Z0-9_$]*/m },

    // Operators (multi-char first)
    { type: 'operator', regex: /^(?:===|!==|==|!=|<=|>=|&&|\|\||<<|>>|>>>|\+\+|--|=>|\.\.\.)/m },
    { type: 'operator', regex: /^[+\-*/%=<>!&|^~?:]/m },

    // Punctuation
    { type: 'punctuation', regex: /^[()[\]{};,.:@]/m },

    // Whitespace
    { type: 'whitespace', regex: /^\s+/m },
  ];

  let remaining = code;

  while (remaining.length > 0) {
    let matched = false;

    for (const { type, regex } of patterns) {
      const match = remaining.match(regex);
      if (match && match.index === 0) {
        const value = match[0];

        // Check if identifier is a keyword
        let tokenType = type;
        if (type === 'identifier' && keywords.has(value)) {
          tokenType = 'keyword';
        }

        tokens.push({ type: tokenType, value });
        remaining = remaining.slice(value.length);
        matched = true;
        break;
      }
    }

    // Skip unrecognized character
    if (!matched) {
      remaining = remaining.slice(1);
    }
  }

  return tokens;
}

/**
 * Normalize a token for fingerprinting
 *
 * - Identifiers → 'ID'
 * - Strings → 'STR'
 * - Numbers → 'NUM'
 * - Keywords, operators, punctuation → kept as-is (lowercase)
 * - Comments, whitespace → removed
 *
 * @param token - Token to normalize
 * @returns Normalized string or empty for skipped tokens
 */
function normalizeToken(token: Token): string {
  switch (token.type) {
    case 'identifier':
      return 'ID';
    case 'string':
      return 'STR';
    case 'number':
      return 'NUM';
    case 'keyword':
    case 'operator':
    case 'punctuation':
      return token.value.toLowerCase();
    case 'comment':
    case 'whitespace':
      return '';
    default:
      return '';
  }
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Compute fingerprint for code
 *
 * Deterministic: same code always produces same fingerprint.
 *
 * @param code - Source code
 * @param language - Programming language ('typescript', 'javascript', 'python')
 * @returns 16-character hex fingerprint
 *
 * @example
 * const fp = computeFingerprint('function add(a, b) { return a + b; }', 'typescript');
 * // Returns something like 'a1b2c3d4e5f6g7h8'
 */
export function computeFingerprint(code: string, language: string): string {
  const tokens = tokenize(code, language);
  const normalized = tokens.map(normalizeToken).filter((t) => t.length > 0);
  const joined = normalized.join('');

  return crypto.createHash('sha256').update(joined).digest('hex').slice(0, 16);
}

/**
 * Count tokens in code (for size comparison)
 *
 * @param code - Source code
 * @param language - Programming language
 * @returns Number of non-whitespace, non-comment tokens
 */
export function countTokens(code: string, language: string): number {
  const tokens = tokenize(code, language);
  return tokens.filter((t) => t.type !== 'whitespace' && t.type !== 'comment').length;
}

/**
 * Extract function body from code
 *
 * Simple extraction that finds the function and its body.
 * Works for common patterns but not all edge cases.
 *
 * @param code - Full file content
 * @param functionName - Name of function to extract
 * @param language - Programming language
 * @returns Function body or null if not found
 */
export function extractFunctionBody(
  code: string,
  functionName: string,
  language: string
): string | null {
  if (language === 'python') {
    return extractPythonFunction(code, functionName);
  }
  return extractTSFunction(code, functionName);
}

/**
 * Extract TypeScript/JavaScript function
 */
function extractTSFunction(code: string, functionName: string): string | null {
  // Match function declarations, arrow functions, methods
  const patterns = [
    // function name(...) { ... }
    new RegExp(
      `(?:export\\s+)?(?:async\\s+)?function\\s+${functionName}\\s*\\([^)]*\\)\\s*(?::\\s*[^{]+)?\\s*\\{`,
      'm'
    ),
    // const name = (...) => { ... }
    new RegExp(
      `(?:export\\s+)?(?:const|let|var)\\s+${functionName}\\s*=\\s*(?:async\\s*)?\\([^)]*\\)\\s*(?::\\s*[^=]+)?\\s*=>\\s*\\{`,
      'm'
    ),
    // name(...) { ... } (method)
    new RegExp(`(?:async\\s+)?${functionName}\\s*\\([^)]*\\)\\s*(?::\\s*[^{]+)?\\s*\\{`, 'm'),
  ];

  for (const pattern of patterns) {
    const match = code.match(pattern);
    if (match && match.index !== undefined) {
      const start = match.index;
      const bodyStart = code.indexOf('{', start);
      if (bodyStart === -1) continue;

      // Find matching closing brace
      let depth = 1;
      let pos = bodyStart + 1;
      while (pos < code.length && depth > 0) {
        const char = code[pos];
        if (char === '{') depth++;
        else if (char === '}') depth--;
        pos++;
      }

      if (depth === 0) {
        return code.slice(start, pos);
      }
    }
  }

  return null;
}

/**
 * Extract Python function
 */
function extractPythonFunction(code: string, functionName: string): string | null {
  const pattern = new RegExp(`^([ \\t]*)(?:async\\s+)?def\\s+${functionName}\\s*\\(`, 'm');
  const match = code.match(pattern);

  if (!match || match.index === undefined) {
    return null;
  }

  const start = match.index;
  const indent = (match[1] ?? '').length;

  // Find the end by looking for a line with less or equal indentation
  const lines = code.slice(start).split('\n');
  let endLineIndex = lines.length;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;
    // Skip empty lines and comments
    if (line.trim() === '' || line.trim().startsWith('#')) {
      continue;
    }

    // Check indentation
    const lineIndent = line.match(/^[ \t]*/)?.[0]?.length ?? 0;
    if (lineIndent <= indent && line.trim().length > 0) {
      endLineIndex = i;
      break;
    }
  }

  return lines.slice(0, endLineIndex).join('\n');
}

/**
 * Calculate Levenshtein distance between two strings
 *
 * Used for fuzzy name matching in duplicate detection.
 *
 * @param a - First string
 * @param b - Second string
 * @returns Edit distance
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  // Initialize matrix
  const matrix: number[][] = Array.from({ length: b.length + 1 }, (_, i) =>
    Array.from({ length: a.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const prevRow = matrix[i - 1];
      const currRow = matrix[i];
      if (!prevRow || !currRow) continue;

      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        currRow[j] = prevRow[j - 1] ?? 0;
      } else {
        currRow[j] = Math.min(
          (prevRow[j - 1] ?? 0) + 1, // substitution
          (currRow[j - 1] ?? 0) + 1, // insertion
          (prevRow[j] ?? 0) + 1 // deletion
        );
      }
    }
  }

  return matrix[b.length]?.[a.length] ?? Math.max(a.length, b.length);
}

/**
 * Check if two function names are similar
 *
 * @param a - First name
 * @param b - Second name
 * @param maxDistance - Maximum edit distance (default 2)
 * @returns true if names are similar
 */
export function areNamesSimilar(a: string, b: string, maxDistance = 2): boolean {
  const lowerA = a.toLowerCase();
  const lowerB = b.toLowerCase();

  if (lowerA === lowerB) return true;

  const distance = levenshteinDistance(lowerA, lowerB);
  const maxLen = Math.max(lowerA.length, lowerB.length);

  // Allow maxDistance edits, but not more than 30% of the longer name
  return distance <= maxDistance && distance / maxLen < 0.3;
}

/**
 * Infer language from file path
 *
 * @param filePath - Path to file
 * @returns Language identifier or 'unknown'
 */
export function inferLanguage(filePath: string): string {
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
    case 'pyw':
      return 'python';
    case 'go':
      return 'go';
    case 'rs':
      return 'rust';
    case 'java':
      return 'java';
    case 'rb':
      return 'ruby';
    case 'php':
      return 'php';
    case 'cs':
      return 'csharp';
    case 'cpp':
    case 'cc':
    case 'cxx':
    case 'c':
    case 'h':
    case 'hpp':
      return 'cpp';
    default:
      return 'unknown';
  }
}
