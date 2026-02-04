import crypto from 'crypto';
import { getDbInstance } from '../db/connection';
import {
  getClaudeMdSnapshotByHash,
  createClaudeMdSnapshot,
  linkSessionToClaudeMd,
} from '../db/claudemd-queries';
import type { ClaudeMdInfo } from '../types/transcript';

/**
 * Service to handle CLAUDE.md content storage with deduplication
 * Uses SHA-256 hashing to avoid storing duplicate content
 */
export class ClaudeMdStorage {
  /**
   * Compute SHA-256 hash of content for deduplication
   */
  static computeHash(content: string): string {
    return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
  }

  /**
   * Store CLAUDE.md files for a session
   * - Deduplicates content via SHA-256 hash
   * - Creates snapshots only for new content
   * - Links session to snapshots via junction table
   *
   * @param sessionId - Claude session UUID
   * @param files - Array of CLAUDE.md file info with content
   */
  static storeClaudeMdFiles(sessionId: string, files: ClaudeMdInfo[]): void {
    if (!files || files.length === 0) {
      return;
    }

    const db = getDbInstance();

    // Use transaction for atomicity
    const storeTransaction = db.transaction((filesToStore: ClaudeMdInfo[]) => {
      for (const file of filesToStore) {
        // Skip if no content
        if (!file.content) {
          console.warn(`CLAUDE.md file has no content: ${file.path}`);
          continue;
        }

        // Compute hash if not provided
        const contentHash = file.contentHash || ClaudeMdStorage.computeHash(file.content);

        // Check if snapshot already exists
        let snapshot = getClaudeMdSnapshotByHash(contentHash);

        if (!snapshot) {
          // Create new snapshot
          snapshot = createClaudeMdSnapshot(contentHash, file.path, file.content, file.loadedAt);
        }

        // Link session to snapshot
        linkSessionToClaudeMd(sessionId, snapshot.id, file.path, file.loadedAt);
      }
    });

    // Execute transaction
    storeTransaction(files);
  }

  /**
   * Store a single CLAUDE.md file (convenience method)
   */
  static storeClaudeMdFile(sessionId: string, file: ClaudeMdInfo): void {
    ClaudeMdStorage.storeClaudeMdFiles(sessionId, [file]);
  }
}
