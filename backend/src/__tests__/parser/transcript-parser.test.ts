import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  parseTranscriptFile,
  buildDependencyGraph,
  getEntriesByType,
  findEntryByUuid,
  getChildEntries,
} from '../../parser/transcript-parser';

describe('transcript-parser', () => {
  let tempDir: string;
  let filePath: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'recall-transcript-'));
    const projectDir = path.join(tempDir, '.claude', 'projects', '-Users-test-projects-demo');
    fs.mkdirSync(projectDir, { recursive: true });
    filePath = path.join(projectDir, 'session-123.jsonl');

    const lines = [
      JSON.stringify({
        uuid: 'b',
        timestamp: '2024-01-02T00:00:01.000Z',
        type: 'session_metadata',
        slug: 'demo-session',
        cwd: '/Users/test/projects/demo',
      }),
      'not-json',
      JSON.stringify({
        uuid: 'a',
        timestamp: '2024-01-02T00:00:02.000Z',
        type: 'user',
        cwd: '/Users/test/projects/demo',
      }),
      JSON.stringify({
        uuid: 'c',
        parentUuid: 'a',
        timestamp: '2024-01-02T00:00:03.000Z',
        type: 'assistant',
      }),
    ];

    fs.writeFileSync(filePath, lines.join('\n'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('parses transcript file, sorts entries, and extracts metadata', async () => {
    const parsed = await parseTranscriptFile(filePath);

    expect(parsed.sessionId).toBe('session-123');
    expect(parsed.entries.length).toBe(3);
    expect(parsed.entries[0]?.uuid).toBe('b');
    expect(parsed.entries[2]?.uuid).toBe('c');

    expect(parsed.metadata.startTime).toBe('2024-01-02T00:00:01.000Z');
    expect(parsed.metadata.endTime).toBe('2024-01-02T00:00:03.000Z');
    expect(parsed.metadata.slug).toBe('demo-session');
    expect(parsed.metadata.cwd).toBe('/Users/test/projects/demo');
    expect(parsed.metadata.projectName).toBe('/Users/test/projects/demo');
  });

  it('builds dependency graph and lookup helpers', async () => {
    const parsed = await parseTranscriptFile(filePath);
    const graph = buildDependencyGraph(parsed.entries);

    expect(graph.get('a')).toEqual(['c']);
    expect(getEntriesByType(parsed.entries, 'assistant').length).toBe(1);
    expect(findEntryByUuid(parsed.entries, 'b')?.type).toBe('session_metadata');
    expect(getChildEntries(parsed.entries, 'a').map((e) => e.uuid)).toEqual(['c']);
  });
});
