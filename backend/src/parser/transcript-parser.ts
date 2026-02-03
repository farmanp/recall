import fs from 'fs';
import readline from 'readline';
import path from 'path';
import {
  TranscriptEntry,
  ParsedTranscript,
  TranscriptMetadata,
} from '../types/transcript';

/**
 * Parse a .jsonl transcript file from Claude Code session
 * @param filePath Absolute path to .jsonl file
 * @returns Parsed transcript with all entries and metadata
 */
export async function parseTranscriptFile(
  filePath: string
): Promise<ParsedTranscript> {
  const entries: TranscriptEntry[] = [];

  // Create read stream for line-by-line processing
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  // Parse each line as JSON
  for await (const line of rl) {
    if (line.trim()) {
      try {
        const entry = JSON.parse(line) as TranscriptEntry;
        entries.push(entry);
      } catch (error) {
        console.warn(`Failed to parse line in ${filePath}:`, error);
        // Continue parsing other lines
      }
    }
  }

  // Sort by timestamp for chronological order
  entries.sort((a, b) => {
    const timeA = new Date(a.timestamp).getTime();
    const timeB = new Date(b.timestamp).getTime();
    return timeA - timeB;
  });

  // Extract metadata from entries
  const metadata = extractMetadata(entries, filePath);

  // Session ID from first entry or filename
  const sessionId = entries[0]?.sessionId || path.basename(filePath, '.jsonl');

  return {
    sessionId,
    entries,
    metadata,
  };
}

/**
 * Extract metadata from parsed transcript entries
 */
function extractMetadata(
  entries: TranscriptEntry[],
  filePath: string
): TranscriptMetadata {
  const firstEntry = entries[0];
  const lastEntry = entries[entries.length - 1];

  // Extract project name from file path
  // Path format: ~/.claude/projects/{encoded-project-path}/{session-uuid}.jsonl
  const pathParts = filePath.split(path.sep);
  const projectsIndex = pathParts.indexOf('projects');
  const encodedProjectPath =
    projectsIndex >= 0 ? pathParts[projectsIndex + 1] : undefined;

  // Decode project path (e.g., "-Users-fpirzada-Documents-cc-mem-video-player")
  const projectName = encodedProjectPath
    ? decodeProjectPath(encodedProjectPath)
    : undefined;

  // Extract slug from first entry if available
  const slug = extractSlug(entries);

  return {
    startTime: firstEntry?.timestamp || new Date().toISOString(),
    endTime: lastEntry?.timestamp,
    totalEntries: entries.length,
    cwd: firstEntry?.cwd,
    slug,
    projectName,
  };
}

/**
 * Decode encoded project path from .claude/projects/ directory
 * Example: "-Users-fpirzada-Documents-cc-mem-video-player" → "/Users/fpirzada/Documents/cc_mem_video_player"
 */
function decodeProjectPath(encoded: string): string {
  // Replace leading dash with slash, then replace dashes with slashes
  return encoded.replace(/^-/, '/').replace(/-/g, '/');
}

/**
 * Extract human-readable slug from transcript entries
 * Looks for session metadata entries that contain slug
 */
function extractSlug(entries: TranscriptEntry[]): string | undefined {
  // Look for entries that might contain slug information
  for (const entry of entries) {
    if (entry.type === 'session_metadata' && (entry as any).slug) {
      return (entry as any).slug;
    }
  }

  // If no slug found, return undefined
  return undefined;
}

/**
 * Build dependency graph from parentUuid relationships
 * @returns Map of uuid -> list of child uuids
 */
export function buildDependencyGraph(
  entries: TranscriptEntry[]
): Map<string, string[]> {
  const graph = new Map<string, string[]>();

  for (const entry of entries) {
    if (entry.parentUuid) {
      const children = graph.get(entry.parentUuid) || [];
      children.push(entry.uuid);
      graph.set(entry.parentUuid, children);
    }
  }

  return graph;
}

/**
 * Get all entries of a specific type
 */
export function getEntriesByType(
  entries: TranscriptEntry[],
  type: string
): TranscriptEntry[] {
  return entries.filter((entry) => entry.type === type);
}

/**
 * Find entry by UUID
 */
export function findEntryByUuid(
  entries: TranscriptEntry[],
  uuid: string
): TranscriptEntry | undefined {
  return entries.find((entry) => entry.uuid === uuid);
}

/**
 * Get child entries for a given UUID
 */
export function getChildEntries(
  entries: TranscriptEntry[],
  parentUuid: string
): TranscriptEntry[] {
  return entries.filter((entry) => entry.parentUuid === parentUuid);
}
