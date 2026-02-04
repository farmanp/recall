/**
 * Agent Detection Module
 *
 * Detects which AI coding agent produced a session file
 * based on file path patterns and content signatures.
 */

import path from 'path';
import os from 'os';

/**
 * Supported AI coding agent types
 */
export type AgentType = 'claude' | 'codex' | 'gemini' | 'unknown';

/**
 * Agent detection result with metadata
 */
export interface AgentInfo {
  type: AgentType;
  version?: string;
  sessionPath: string;
}

/**
 * Agent directory configuration
 */
export interface AgentDirConfig {
  type: AgentType;
  baseDir: string;
  sessionSubdir?: string;
  filePattern: RegExp;
}

/**
 * Get default session directories for each agent
 */
export function getAgentSessionDirs(): Map<AgentType, string> {
  const homeDir = os.homedir();

  return new Map<AgentType, string>([
    ['claude', path.join(homeDir, '.claude', 'projects')],
    ['codex', path.join(homeDir, '.codex', 'sessions')],
    ['gemini', path.join(homeDir, '.gemini', 'tmp')],
  ]);
}

/**
 * Get all agent directory configurations
 */
export function getAgentConfigs(): AgentDirConfig[] {
  const homeDir = os.homedir();

  return [
    {
      type: 'claude',
      baseDir: path.join(homeDir, '.claude', 'projects'),
      filePattern: /\.jsonl$/,
    },
    {
      type: 'codex',
      baseDir: path.join(homeDir, '.codex', 'sessions'),
      filePattern: /\.jsonl$/,
    },
    {
      type: 'gemini',
      baseDir: path.join(homeDir, '.gemini', 'tmp'),
      sessionSubdir: 'chats',
      filePattern: /^session-.*\.json$/,
    },
  ];
}

/**
 * Detect agent type from file path
 *
 * Uses path patterns to identify the agent:
 * - `~/.claude/projects/**` → Claude
 * - `~/.codex/sessions/**` → Codex
 * - `~/.gemini/sessions/**` → Gemini
 *
 * @param filePath - Absolute path to session file
 * @returns Detected agent type
 */
export function detectAgentFromPath(filePath: string): AgentType {
  const normalizedPath = path.normalize(filePath);

  // Check for Claude path pattern
  if (
    normalizedPath.includes(`${path.sep}.claude${path.sep}`) ||
    normalizedPath.includes('/.claude/')
  ) {
    return 'claude';
  }

  // Check for Codex path pattern
  if (
    normalizedPath.includes(`${path.sep}.codex${path.sep}`) ||
    normalizedPath.includes('/.codex/')
  ) {
    return 'codex';
  }

  // Check for Gemini path pattern (future)
  if (
    normalizedPath.includes(`${path.sep}.gemini${path.sep}`) ||
    normalizedPath.includes('/.gemini/')
  ) {
    return 'gemini';
  }

  return 'unknown';
}

/**
 * Detect agent type from JSONL content
 *
 * Analyzes the structure and fields of entries to identify the agent:
 * - Claude: Has `thinking` blocks with `signature`, uses Anthropic tool format
 * - Codex: Uses OpenAI function calling format, may have `model: "o1"` or similar
 * - Gemini: Has Gemini-specific model identifiers
 *
 * @param firstEntry - First parsed JSON entry from the file
 * @returns Detected agent type
 */
export function detectAgentFromContent(firstEntry: any): AgentType {
  if (!firstEntry || typeof firstEntry !== 'object') {
    return 'unknown';
  }

  // Claude detection: Look for Anthropic-specific patterns
  // - Has thinking blocks with signatures
  // - Uses tool_use/tool_result format
  // - Has sessionId in Claude's UUID format
  if (hasClaudeSignatures(firstEntry)) {
    return 'claude';
  }

  // Codex detection: Look for OpenAI-specific patterns
  // - Uses function_call or tool_calls format
  // - Model names like "o1", "o3", "gpt-4", etc.
  // - Different message structure
  if (hasCodexSignatures(firstEntry)) {
    return 'codex';
  }

  // Gemini detection: Look for Google-specific patterns
  // - Model names like "gemini-pro", "gemini-ultra"
  // - Google-specific tool format
  if (hasGeminiSignatures(firstEntry)) {
    return 'gemini';
  }

  return 'unknown';
}

/**
 * Check for Claude-specific content signatures
 */
function hasClaudeSignatures(entry: any): boolean {
  // Check for Claude's sessionId format (UUID-like)
  if (entry.sessionId && /^[a-f0-9-]{36}$/i.test(entry.sessionId)) {
    return true;
  }

  // Check for thinking blocks with signature
  const content = entry.message?.content;
  if (Array.isArray(content)) {
    for (const block of content) {
      if (block.type === 'thinking' && block.signature) {
        return true;
      }
      // Claude-specific tool_use format with id
      if (block.type === 'tool_use' && block.id && block.name) {
        return true;
      }
    }
  }

  // Check for Claude-specific fields
  if (entry.cwd !== undefined && entry.uuid !== undefined) {
    return true;
  }

  return false;
}

/**
 * Check for Codex/OpenAI-specific content signatures
 */
function hasCodexSignatures(entry: any): boolean {
  // Check for OpenAI model names
  const model = entry.model || entry.metadata?.model;
  if (model && /^(o1|o3|gpt-4|gpt-3\.5|davinci|codex)/i.test(model)) {
    return true;
  }

  // Check for OpenAI function calling format
  if (entry.function_call || entry.tool_calls) {
    return true;
  }

  // Check for choices array (OpenAI response format)
  if (entry.choices && Array.isArray(entry.choices)) {
    return true;
  }

  // Check for OpenAI-specific message format
  const message = entry.message || entry;
  if (message.role && message.tool_calls && Array.isArray(message.tool_calls)) {
    for (const tc of message.tool_calls) {
      if (tc.type === 'function' && tc.function?.name) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Check for Gemini-specific content signatures
 */
function hasGeminiSignatures(entry: any): boolean {
  // Check for Gemini model names
  const model = entry.model || entry.metadata?.model;
  if (model && /^gemini/i.test(model)) {
    return true;
  }

  // Check for Google-specific structures
  if (entry.candidates && Array.isArray(entry.candidates)) {
    return true;
  }

  // Check for Gemini tool format
  if (entry.functionCalls || entry.toolConfig) {
    return true;
  }

  return false;
}

/**
 * Get full agent info from file path and optional content
 *
 * @param filePath - Path to session file
 * @param firstEntry - Optional first entry for content-based detection
 * @returns AgentInfo with type, version, and path
 */
export function getAgentInfo(filePath: string, firstEntry?: any): AgentInfo {
  // Try path-based detection first (faster)
  let type = detectAgentFromPath(filePath);

  // Fall back to content-based detection if path is ambiguous
  if (type === 'unknown' && firstEntry) {
    type = detectAgentFromContent(firstEntry);
  }

  // Extract version if available
  let version: string | undefined;
  if (firstEntry) {
    version = extractAgentVersion(firstEntry, type);
  }

  return {
    type,
    version,
    sessionPath: filePath,
  };
}

/**
 * Extract agent/model version from entry
 */
function extractAgentVersion(entry: any, agentType: AgentType): string | undefined {
  // Look for model field in various locations
  const model =
    entry.model || entry.metadata?.model || entry.claudeVersion || entry.metadata?.claudeVersion;

  if (model) {
    return String(model);
  }

  // Agent-specific version extraction
  switch (agentType) {
    case 'claude':
      // Claude may have version in different places
      if (entry.metadata?.claudeVersion) {
        return entry.metadata.claudeVersion;
      }
      break;

    case 'codex':
      // OpenAI model from response
      if (entry.model) {
        return entry.model;
      }
      break;

    case 'gemini':
      // Gemini model name
      if (entry.model) {
        return entry.model;
      }
      break;
  }

  return undefined;
}

/**
 * Get display name for agent type
 */
export function getAgentDisplayName(type: AgentType): string {
  const names: Record<AgentType, string> = {
    claude: 'Claude',
    codex: 'Codex',
    gemini: 'Gemini',
    unknown: 'Unknown',
  };
  return names[type];
}

/**
 * Get agent badge color for UI
 */
export function getAgentBadgeColor(type: AgentType): string {
  const colors: Record<AgentType, string> = {
    claude: '#D97706', // Orange/amber for Claude
    codex: '#059669', // Green for Codex/OpenAI
    gemini: '#2563EB', // Blue for Gemini
    unknown: '#6B7280', // Gray for unknown
  };
  return colors[type];
}
