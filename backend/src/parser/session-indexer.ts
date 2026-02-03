import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { SessionMetadata } from '../types/transcript';

/**
 * Session indexer - scans ~/.claude/projects/ for all available sessions
 */
export class SessionIndexer {
  private claudeProjectsDir: string;
  private sessionIndex: Map<string, SessionMetadata> = new Map();

  constructor(claudeProjectsDir?: string) {
    // Default to ~/.claude/projects/
    this.claudeProjectsDir =
      claudeProjectsDir || path.join(os.homedir(), '.claude', 'projects');
  }

  /**
   * Scan Claude projects directory and build index of all sessions
   */
  async buildIndex(): Promise<SessionMetadata[]> {
    this.sessionIndex.clear();

    try {
      // Check if directory exists
      const dirExists = await this.directoryExists(this.claudeProjectsDir);
      if (!dirExists) {
        console.warn(`Claude projects directory not found: ${this.claudeProjectsDir}`);
        return [];
      }

      // Read all project directories
      const projectDirs = await fs.readdir(this.claudeProjectsDir);

      for (const projectDir of projectDirs) {
        const projectPath = path.join(this.claudeProjectsDir, projectDir);

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
            const metadata = await this.extractSessionMetadata(sessionPath);
            this.sessionIndex.set(metadata.sessionId, metadata);
          } catch (error) {
            console.warn(`Failed to index session ${sessionPath}:`, error);
          }
        }
      }

      return Array.from(this.sessionIndex.values());
    } catch (error) {
      console.error('Failed to build session index:', error);
      return [];
    }
  }

  /**
   * Extract metadata from a session file without parsing the entire transcript
   * For performance, only reads first and last few entries
   */
  private async extractSessionMetadata(
    filePath: string
  ): Promise<SessionMetadata> {
    const sessionId = path.basename(filePath, '.jsonl');

    // Read the file content
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.trim().split('\n').filter((line) => line.trim());

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

    // Extract project name from file path
    const pathParts = filePath.split(path.sep);
    const projectsIndex = pathParts.indexOf('projects');
    const encodedProjectPath =
      projectsIndex >= 0 ? pathParts[projectsIndex + 1] : undefined;
    const projectName = encodedProjectPath
      ? this.decodeProjectPath(encodedProjectPath)
      : 'Unknown Project';

    // Extract slug - look through first few entries
    let slug = 'unknown-session';
    for (let i = 0; i < Math.min(10, lines.length); i++) {
      const line = lines[i];
      if (!line) continue;
      const entry = JSON.parse(line);
      if (entry.slug) {
        slug = entry.slug;
        break;
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
      if (entry.message?.role === 'user' && entry.message?.content) {
        // Content can be either a string or an array
        if (typeof entry.message.content === 'string') {
          firstUserMessage = entry.message.content.substring(0, 200);
          break;
        } else if (Array.isArray(entry.message.content)) {
          const textBlock = entry.message.content.find(
            (block: any) => block.type === 'text'
          );
          if (textBlock) {
            firstUserMessage = textBlock.text.substring(0, 200);
            break;
          }
        }
      }
    }

    return {
      sessionId,
      slug,
      project: projectName,
      startTime,
      endTime,
      duration,
      eventCount: lines.length,
      cwd: firstEntry.cwd || '',
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
   */
  async findSessionFile(sessionId: string): Promise<string | undefined> {
    try {
      const projectDirs = await fs.readdir(this.claudeProjectsDir);

      for (const projectDir of projectDirs) {
        const projectPath = path.join(this.claudeProjectsDir, projectDir);
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
