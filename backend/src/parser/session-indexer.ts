import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { createHash } from 'crypto';
import { SessionMetadata, AgentType, ClaudeMdInfo } from '../types/transcript';

/**
 * Session indexer - scans agent session directories for all available sessions
 * Supports multiple agents: Claude (~/.claude/projects/), Codex (~/.codex/sessions/)
 */
export class SessionIndexer {
  private sessionIndex: Map<string, SessionMetadata> = new Map();
  private sessionFilePaths: Map<string, string> = new Map(); // sessionId -> filePath cache
  private agentDirs: Map<AgentType, string>;

  constructor(claudeProjectsDir?: string) {
    // Initialize agent directories
    // If a custom Claude projects dir is provided, use it; otherwise use default
    const claudeDir = claudeProjectsDir || path.join(os.homedir(), '.claude', 'projects');

    this.agentDirs = new Map<AgentType, string>([
      ['claude', claudeDir],
      ['codex', path.join(os.homedir(), '.codex', 'sessions')],
      ['gemini', path.join(os.homedir(), '.gemini', 'tmp')],
    ]);
  }

  /**
   * Scan all agent directories and build index of all sessions
   */
  async buildIndex(): Promise<SessionMetadata[]> {
    this.sessionIndex.clear();
    this.sessionFilePaths.clear();
    return this.scanAllAgents();
  }

  /**
   * Scan all agent directories for sessions
   */
  async scanAllAgents(): Promise<SessionMetadata[]> {
    const allSessions: SessionMetadata[] = [];

    for (const [agentType, agentDir] of this.agentDirs) {
      try {
        const sessions = await this.scanAgentDirectory(agentType, agentDir);
        allSessions.push(...sessions);
      } catch (error) {
        console.warn(`Failed to scan ${agentType} directory ${agentDir}:`, error);
      }
    }

    return allSessions;
  }

  /**
   * Scan a single agent directory for sessions
   */
  private async scanAgentDirectory(agent: AgentType, agentDir: string): Promise<SessionMetadata[]> {
    const sessions: SessionMetadata[] = [];

    // Check if directory exists
    const dirExists = await this.directoryExists(agentDir);
    if (!dirExists) {
      console.warn(`${agent} directory not found: ${agentDir}`);
      return sessions;
    }

    if (agent === 'codex') {
      // Codex: Mixed structure - *.jsonl files in sessions/ and nested date dirs (2026/01/18/)
      const jsonlFiles = await this.findJsonlFilesRecursively(agentDir);

      for (const sessionPath of jsonlFiles) {
        try {
          const metadata = await this.extractSessionMetadata(sessionPath, agent);
          this.sessionIndex.set(metadata.sessionId, metadata);
          this.sessionFilePaths.set(metadata.sessionId, sessionPath);
          sessions.push(metadata);
        } catch (error) {
          console.warn(`Failed to index session ${sessionPath}:`, error);
        }
      }
    } else if (agent === 'gemini') {
      // Gemini: Structure - tmp/{projectHash}/chats/session-*.json
      const jsonFiles = await this.findGeminiSessionFiles(agentDir);

      for (const sessionPath of jsonFiles) {
        try {
          const metadata = await this.extractSessionMetadata(sessionPath, agent);
          this.sessionIndex.set(metadata.sessionId, metadata);
          this.sessionFilePaths.set(metadata.sessionId, sessionPath);
          sessions.push(metadata);
        } catch (error) {
          console.warn(`Failed to index Gemini session ${sessionPath}:`, error);
        }
      }
    } else {
      // Claude (and others): Nested structure - projects/{project}/*.jsonl
      const projectDirs = await fs.readdir(agentDir);

      for (const projectDir of projectDirs) {
        const projectPath = path.join(agentDir, projectDir);

        // Check if it's a directory
        const stats = await fs.stat(projectPath);
        if (!stats.isDirectory()) {
          continue;
        }

        // Find all .jsonl files in this project
        const files = await fs.readdir(projectPath);
        const jsonlFiles = files.filter((f) => f.endsWith('.jsonl'));

        // Index each session
        for (const jsonlFile of jsonlFiles) {
          const sessionPath = path.join(projectPath, jsonlFile);
          try {
            const metadata = await this.extractSessionMetadata(sessionPath, agent);
            this.sessionIndex.set(metadata.sessionId, metadata);
            this.sessionFilePaths.set(metadata.sessionId, sessionPath);
            sessions.push(metadata);
          } catch (error) {
            console.warn(`Failed to index session ${sessionPath}:`, error);
          }
        }
      }
    }

    return sessions;
  }

  /**
   * Get available agents and their session counts
   */
  async getAvailableAgents(): Promise<{
    agents: AgentType[];
    counts: Record<AgentType, number>;
  }> {
    const agents: AgentType[] = [];
    const counts: Record<AgentType, number> = {
      claude: 0,
      codex: 0,
      gemini: 0,
      unknown: 0,
    };

    for (const [agentType, agentDir] of this.agentDirs) {
      const dirExists = await this.directoryExists(agentDir);
      if (!dirExists) {
        continue;
      }

      let sessionCount = 0;

      if (agentType === 'codex') {
        // Codex: Count .jsonl files in directory and nested date subdirectories
        try {
          const allFiles = await this.findJsonlFilesRecursively(agentDir);
          sessionCount = allFiles.length;
        } catch {
          sessionCount = 0;
        }
      } else if (agentType === 'gemini') {
        // Gemini: Count session-*.json files in tmp/{hash}/chats/ subdirectories
        try {
          const allFiles = await this.findGeminiSessionFiles(agentDir);
          sessionCount = allFiles.length;
        } catch {
          sessionCount = 0;
        }
      } else {
        // Claude: Count .jsonl files across all project subdirectories
        try {
          const projectDirs = await fs.readdir(agentDir);
          for (const projectDir of projectDirs) {
            const projectPath = path.join(agentDir, projectDir);
            try {
              const stats = await fs.stat(projectPath);
              if (stats.isDirectory()) {
                const files = await fs.readdir(projectPath);
                sessionCount += files.filter((f) => f.endsWith('.jsonl')).length;
              }
            } catch {
              // Skip this project directory
            }
          }
        } catch {
          sessionCount = 0;
        }
      }

      if (sessionCount > 0) {
        agents.push(agentType);
        counts[agentType] = sessionCount;
      }
    }

    return { agents, counts };
  }

  /**
   * Extract metadata from a session file without parsing the entire transcript
   * For performance, only reads first and last few entries
   */
  private async extractSessionMetadata(
    filePath: string,
    agent?: AgentType
  ): Promise<SessionMetadata> {
    // Read the file content
    const content = await fs.readFile(filePath, 'utf-8');

    // Handle Gemini's single JSON format differently
    if (agent === 'gemini') {
      return this.extractGeminiMetadata(filePath, content);
    }

    // Extract session ID from filename
    // Codex format: session-{id}.jsonl → extract "session-{id}"
    // Claude format: {uuid}.jsonl → extract "{uuid}"
    const sessionId = path.basename(filePath, '.jsonl');

    const lines = content
      .trim()
      .split('\n')
      .filter((line) => line.trim());

    if (lines.length === 0) {
      throw new Error('Empty session file');
    }

    // Parse first entry for start time and metadata
    const firstLine = lines[0];
    if (!firstLine) {
      throw new Error('First line is empty');
    }
    const firstEntry = JSON.parse(firstLine);

    const lastLine = lines.length > 1 ? lines[lines.length - 1] : firstLine;
    const lastEntry = lastLine ? JSON.parse(lastLine) : firstEntry;

    // Extract project name based on agent type
    let projectName: string;
    if (agent === 'codex') {
      // Codex: Extract project name from session_meta payload's cwd field
      // Format: { type: "session_meta", payload: { cwd: "/path/to/project", ... } }
      const codexCwd = firstEntry.payload?.cwd || firstEntry.cwd;
      if (codexCwd) {
        // Extract last directory component from cwd as project name
        const cwdParts = codexCwd.split(path.sep).filter(Boolean);
        projectName = cwdParts[cwdParts.length - 1] || 'Codex Session';
      } else {
        projectName = 'Codex Session';
      }
    } else {
      // Claude: Extract project name from file path
      const pathParts = filePath.split(path.sep);
      const projectsIndex = pathParts.indexOf('projects');
      const encodedProjectPath = projectsIndex >= 0 ? pathParts[projectsIndex + 1] : undefined;
      projectName = encodedProjectPath
        ? this.decodeProjectPath(encodedProjectPath)
        : 'Unknown Project';
    }

    // Extract slug - look through first few entries
    let slug: string;
    if (agent === 'codex') {
      // Codex: Check for slug in entry metadata, or default to 'codex-session'
      slug = 'codex-session';
      for (let i = 0; i < Math.min(10, lines.length); i++) {
        const line = lines[i];
        if (!line) continue;
        const entry = JSON.parse(line);
        if (entry.slug) {
          slug = entry.slug;
          break;
        }
        if (entry.metadata?.slug) {
          slug = entry.metadata.slug;
          break;
        }
      }
    } else {
      // Claude: Look for slug in entries
      slug = 'unknown-session';
      for (let i = 0; i < Math.min(10, lines.length); i++) {
        const line = lines[i];
        if (!line) continue;
        const entry = JSON.parse(line);
        if (entry.slug) {
          slug = entry.slug;
          break;
        }
      }
    }

    // Calculate duration
    const startTime = firstEntry.timestamp || new Date().toISOString();
    const endTime = lastEntry.timestamp;
    const duration = endTime
      ? (new Date(endTime).getTime() - new Date(startTime).getTime()) / 1000
      : undefined;

    // Extract first user message
    let firstUserMessage: string | undefined;
    for (let i = 0; i < Math.min(20, lines.length); i++) {
      const line = lines[i];
      if (!line) continue;
      const entry = JSON.parse(line);

      // Claude format: { message: { role: "user", content: ... } }
      if (entry.message?.role === 'user' && entry.message?.content) {
        if (typeof entry.message.content === 'string') {
          firstUserMessage = entry.message.content.substring(0, 200);
          break;
        } else if (Array.isArray(entry.message.content)) {
          const textBlock = entry.message.content.find((block: any) => block.type === 'text');
          if (textBlock) {
            firstUserMessage = textBlock.text.substring(0, 200);
            break;
          }
        }
      }

      // Codex format: { type: "response_item", payload: { role: "user", content: [...] } }
      if (entry.type === 'response_item' && entry.payload?.role === 'user') {
        const content = entry.payload.content;
        if (Array.isArray(content)) {
          const textBlock = content.find(
            (block: any) => block.type === 'input_text' || block.type === 'text'
          );
          if (textBlock?.text) {
            firstUserMessage = textBlock.text.substring(0, 200);
            break;
          }
        }
      }
    }

    // Get cwd from appropriate field (handle both Claude and Codex formats)
    const extractedCwd = firstEntry.payload?.cwd || firstEntry.cwd || '';

    // Extract CLAUDE.md files for Claude sessions
    const claudeMdFiles =
      agent === 'claude' ? this.extractClaudeMdFiles(lines, startTime) : undefined;

    // Extract model from first assistant entry with a model field
    let model: string | undefined;
    for (let i = 0; i < Math.min(30, lines.length); i++) {
      const line = lines[i];
      if (!line) continue;
      try {
        const entry = JSON.parse(line);
        // Claude format: { message: { model: "claude-opus-4-5-20251101", ... } }
        if (entry.message?.model) {
          model = entry.message.model;
          break;
        }
        // Codex format: { model: "..." } at top level
        if (entry.model) {
          model = entry.model;
          break;
        }
        // Codex wrapped format: { type: "...", payload: { model: "..." } }
        if (entry.payload?.model) {
          model = entry.payload.model;
          break;
        }
        if (entry.metadata?.model) {
          model = entry.metadata.model;
          break;
        }
      } catch {
        // Skip malformed JSON lines
      }
    }

    return {
      sessionId,
      slug,
      project: projectName,
      agent,
      model,
      startTime,
      endTime,
      duration,
      eventCount: lines.length,
      cwd: extractedCwd,
      firstUserMessage,
      claudeMdFiles,
    };
  }

  /**
   * Extract metadata from Gemini session file (single JSON format)
   */
  private extractGeminiMetadata(filePath: string, content: string): SessionMetadata {
    const session = JSON.parse(content);

    // Gemini stores sessionId in the file
    const sessionId = session.sessionId || path.basename(filePath, '.json');

    // Extract project name from projectHash directory or file path
    const pathParts = filePath.split(path.sep);
    const tmpIndex = pathParts.indexOf('tmp');
    const projectHash = tmpIndex >= 0 ? pathParts[tmpIndex + 1] : undefined;
    const projectName = projectHash
      ? `Gemini Project (${projectHash.substring(0, 8)})`
      : 'Gemini Session';

    // Timestamps
    const startTime = session.startTime;
    const endTime = session.lastUpdated;
    const duration =
      startTime && endTime
        ? (new Date(endTime).getTime() - new Date(startTime).getTime()) / 1000
        : undefined;

    // Extract first user message
    let firstUserMessage: string | undefined;
    if (session.messages?.length) {
      const userMsg = session.messages.find((m: any) => m.type === 'user');
      if (userMsg?.content) {
        firstUserMessage = userMsg.content.substring(0, 200);
      }
    }

    // Extract model from first gemini message that has a model field
    let model: string | undefined;
    if (session.messages?.length) {
      const geminiMsg = session.messages.find((m: any) => m.type === 'gemini' && m.model);
      if (geminiMsg?.model) {
        model = geminiMsg.model;
      }
    }

    return {
      sessionId,
      slug: 'gemini-session',
      project: projectName,
      agent: 'gemini',
      model,
      startTime,
      endTime,
      duration,
      eventCount: session.messages?.length || 0,
      cwd: '',
      firstUserMessage,
    };
  }

  /**
   * Get session metadata by ID
   */
  async getSessionMetadata(sessionId: string): Promise<SessionMetadata | undefined> {
    if (this.sessionIndex.size === 0) {
      await this.buildIndex();
    }
    return this.sessionIndex.get(sessionId);
  }

  /**
   * Get all sessions
   */
  async getAllSessions(): Promise<SessionMetadata[]> {
    if (this.sessionIndex.size === 0) {
      await this.buildIndex();
    }
    return Array.from(this.sessionIndex.values());
  }

  /**
   * Find session file path by ID
   * Uses cached paths first, falls back to filesystem search
   */
  async findSessionFile(sessionId: string): Promise<string | undefined> {
    // Check cache first (populated during buildIndex)
    if (this.sessionFilePaths.has(sessionId)) {
      return this.sessionFilePaths.get(sessionId);
    }

    // If index is empty, build it first
    if (this.sessionIndex.size === 0) {
      await this.buildIndex();
      // Check cache again after building
      if (this.sessionFilePaths.has(sessionId)) {
        return this.sessionFilePaths.get(sessionId);
      }
    }

    // Fall back to filesystem search
    try {
      for (const [agentType, agentDir] of this.agentDirs) {
        const dirExists = await this.directoryExists(agentDir);
        if (!dirExists) {
          continue;
        }

        if (agentType === 'codex') {
          // Codex: Mixed structure - check both flat and nested date directories
          // First check flat structure
          const flatPath = path.join(agentDir, `${sessionId}.jsonl`);
          if (await this.fileExists(flatPath)) {
            return flatPath;
          }
          // Then search recursively in date directories
          const allJsonlFiles = await this.findJsonlFilesRecursively(agentDir);
          const match = allJsonlFiles.find((f) => f.endsWith(`${sessionId}.jsonl`));
          if (match) {
            return match;
          }
        } else if (agentType === 'gemini') {
          // Gemini: Search in tmp/{hash}/chats/session-*.json
          const allGeminiFiles = await this.findGeminiSessionFiles(agentDir);
          // Match by session ID (which is in the filename or file content)
          const match = allGeminiFiles.find((f) => {
            const filename = path.basename(f);
            // Check if filename contains the sessionId
            if (filename.includes(sessionId)) {
              return true;
            }
            // Also check if it's a UUID that might be in the file
            return filename.includes(sessionId.split('-').pop() || '');
          });
          if (match) {
            return match;
          }
        } else {
          // Claude: Nested structure - search in project subdirectories
          const projectDirs = await fs.readdir(agentDir);

          for (const projectDir of projectDirs) {
            const projectPath = path.join(agentDir, projectDir);
            const stats = await fs.stat(projectPath);

            if (!stats.isDirectory()) {
              continue;
            }

            const sessionPath = path.join(projectPath, `${sessionId}.jsonl`);
            const exists = await this.fileExists(sessionPath);

            if (exists) {
              return sessionPath;
            }
          }
        }
      }

      return undefined;
    } catch (error) {
      console.error(`Failed to find session file for ${sessionId}:`, error);
      return undefined;
    }
  }

  /**
   * Decode encoded project path
   */
  private decodeProjectPath(encoded: string): string {
    return encoded.replace(/^-/, '/').replace(/-/g, '/');
  }

  /**
   * Recursively find all .jsonl files in a directory
   * Used for Codex which stores sessions in nested date directories (2026/01/18/)
   */
  private async findJsonlFilesRecursively(dir: string): Promise<string[]> {
    const results: string[] = [];

    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        // Recurse into subdirectories
        const subResults = await this.findJsonlFilesRecursively(fullPath);
        results.push(...subResults);
      } else if (entry.isFile() && entry.name.endsWith('.jsonl')) {
        results.push(fullPath);
      }
    }

    return results;
  }

  /**
   * Find Gemini session files
   * Structure: tmp/{projectHash}/chats/session-*.json
   */
  private async findGeminiSessionFiles(tmpDir: string): Promise<string[]> {
    const results: string[] = [];

    try {
      const projectHashes = await fs.readdir(tmpDir, { withFileTypes: true });

      for (const hashEntry of projectHashes) {
        if (!hashEntry.isDirectory()) continue;

        const chatsDir = path.join(tmpDir, hashEntry.name, 'chats');

        // Check if chats directory exists
        if (!(await this.directoryExists(chatsDir))) continue;

        const chatFiles = await fs.readdir(chatsDir, { withFileTypes: true });

        for (const file of chatFiles) {
          // Match session-*.json files
          if (file.isFile() && file.name.startsWith('session-') && file.name.endsWith('.json')) {
            results.push(path.join(chatsDir, file.name));
          }
        }
      }
    } catch (error) {
      console.warn(`Error scanning Gemini sessions in ${tmpDir}:`, error);
    }

    return results;
  }

  /**
   * Check if directory exists
   */
  private async directoryExists(dirPath: string): Promise<boolean> {
    try {
      const stats = await fs.stat(dirPath);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * Check if file exists
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Extract CLAUDE.md file references and content from session transcript
   * Phase 2: Now extracts full content and computes SHA-256 hash for deduplication
   *
   * Looks for patterns like:
   * "Contents of /path/to/CLAUDE.md:\n<content>"
   *
   * @param lines - Lines from the .jsonl transcript file
   * @param startTime - Session start time (fallback for timestamps)
   * @returns Array of CLAUDE.md file info with content and hash
   */
  private extractClaudeMdFiles(lines: string[], startTime: string): ClaudeMdInfo[] {
    const claudeMdFiles: ClaudeMdInfo[] = [];
    const seenPaths = new Set<string>();

    for (const line of lines) {
      if (!line) continue;

      try {
        const entry = JSON.parse(line);

        // Get timestamp for this entry
        const entryTimestamp = entry.timestamp || startTime;

        // Check message content for CLAUDE.md references
        if (entry.message?.content) {
          const content = entry.message.content;

          // Handle content as array or string
          // Check 'text', 'tool_result', and 'thinking' blocks since system-reminders can appear in any
          const textContent = Array.isArray(content)
            ? content
                .map((block: any) => {
                  if (block.type === 'text') return block.text;
                  if (block.type === 'thinking') return block.thinking;
                  if (block.type === 'tool_result' && typeof block.content === 'string') {
                    return block.content;
                  }
                  return '';
                })
                .join('\n')
            : typeof content === 'string'
              ? content
              : '';

          // Pattern to match CLAUDE.md paths in "Contents of /path/CLAUDE.md" format
          const claudeMdPathRegex = /Contents of ([^\s:]+CLAUDE\.md)/gi;

          let match;
          while ((match = claudeMdPathRegex.exec(textContent)) !== null) {
            const claudeMdPath = match[1];

            if (!claudeMdPath) continue;

            // Filter out placeholder/example paths that aren't real filesystem paths
            // Real paths start with / or ~ and contain actual directory names
            if (
              (!claudeMdPath.startsWith('/') && !claudeMdPath.startsWith('~')) ||
              claudeMdPath.includes('/path/') ||
              claudeMdPath.includes('/path/to/') ||
              claudeMdPath.startsWith('.../') ||
              claudeMdPath.startsWith('[')
            ) {
              continue;
            }

            // Deduplicate by path (Phase 1 just tracks which files were loaded)
            if (seenPaths.has(claudeMdPath)) {
              continue;
            }

            seenPaths.add(claudeMdPath);

            claudeMdFiles.push({
              path: claudeMdPath,
              loadedAt: entryTimestamp,
            });
          }
        }
      } catch {
        // Skip malformed JSON lines
      }
    }

    return claudeMdFiles;
  }

  /**
   * Compute SHA-256 hash of content for deduplication
   * TODO: Used in Phase 2 for content extraction
   */
  // @ts-expect-error - Reserved for Phase 2 content extraction
  private computeContentHash(content: string): string {
    return createHash('sha256').update(content, 'utf8').digest('hex');
  }
}

/**
 * Global session indexer instance
 */
let globalIndexer: SessionIndexer | undefined;

/**
 * Get or create global session indexer
 */
export function getSessionIndexer(claudeProjectsDir?: string): SessionIndexer {
  if (!globalIndexer) {
    globalIndexer = new SessionIndexer(claudeProjectsDir);
  }
  return globalIndexer;
}
