/**
 * Tool Name Normalization Utility
 *
 * Centralizes mapping of agent-specific tool names (Claude, Gemini, Codex)
 * to canonical categories (read, write, edit, shell, other).
 *
 * This enables artifact detection to work consistently across all supported agents.
 */

export type ToolCategory = 'read' | 'write' | 'edit' | 'shell' | 'other';

/**
 * Mapping of tool names to their canonical categories.
 * Includes all known tool names from Claude Code, Gemini CLI, and Codex CLI.
 */
const TOOL_CATEGORY_MAP: Record<string, ToolCategory> = {
  // Claude Code tools
  Read: 'read',
  Glob: 'read',
  Grep: 'read',
  NotebookRead: 'read',
  Write: 'write',
  NotebookEdit: 'write',
  Edit: 'edit',
  Bash: 'shell',

  // Gemini CLI tools
  read_file: 'read',
  glob: 'read',
  list_directory: 'read',
  write_file: 'write',
  create_file: 'write',
  replace: 'edit',
  shell: 'shell',
  run_shell_command: 'shell',

  // Codex CLI tools (OpenAI function calling)
  shell_command: 'shell',
};

/**
 * Normalize a tool name to its canonical category.
 *
 * @param toolName - The agent-specific tool name (e.g., "Read", "read_file", "replace")
 * @returns The canonical category (read, write, edit, shell, or other)
 */
export function normalizeToolCategory(toolName: string): ToolCategory {
  return TOOL_CATEGORY_MAP[toolName] ?? 'other';
}

/**
 * Check if a tool is a read operation.
 */
export function isReadTool(toolName: string): boolean {
  return normalizeToolCategory(toolName) === 'read';
}

/**
 * Check if a tool is a write operation.
 */
export function isWriteTool(toolName: string): boolean {
  return normalizeToolCategory(toolName) === 'write';
}

/**
 * Check if a tool is an edit operation.
 */
export function isEditTool(toolName: string): boolean {
  return normalizeToolCategory(toolName) === 'edit';
}

/**
 * Check if a tool is a shell/bash operation.
 */
export function isShellTool(toolName: string): boolean {
  return normalizeToolCategory(toolName) === 'shell';
}

/**
 * Get all known tool names for a given category.
 * Useful for UI filtering or debugging.
 */
export function getToolsForCategory(category: ToolCategory): string[] {
  return Object.entries(TOOL_CATEGORY_MAP)
    .filter(([, cat]) => cat === category)
    .map(([name]) => name);
}
