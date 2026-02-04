import { describe, it, expect } from 'vitest';
import path from 'path';
import {
  detectAgentFromPath,
  detectAgentFromContent,
  getAgentInfo,
  getAgentDisplayName,
  getAgentBadgeColor,
} from '../../parser/agent-detector';

describe('agent-detector', () => {
  it('detects agent from file path', () => {
    const claudePath = path.join('/Users/test', '.claude', 'projects', 'proj', 'session.jsonl');
    const codexPath = path.join('/Users/test', '.codex', 'sessions', '2025-01-01', 'session.jsonl');
    const geminiPath = path.join('/Users/test', '.gemini', 'tmp', 'hash', 'chats', 'session-1.json');

    expect(detectAgentFromPath(claudePath)).toBe('claude');
    expect(detectAgentFromPath(codexPath)).toBe('codex');
    expect(detectAgentFromPath(geminiPath)).toBe('gemini');
    expect(detectAgentFromPath('/tmp/unknown.jsonl')).toBe('unknown');
  });

  it('detects agent from content signatures', () => {
    const claudeEntry = {
      sessionId: 'a0b1c2d3-e4f5-6789-aaaa-bbbbbbbbbbbb',
      message: {
        content: [{ type: 'thinking', signature: 'sig', thinking: '...' }],
      },
    };
    const codexEntry = { model: 'gpt-4.1' };
    const geminiEntry = { model: 'gemini-pro' };

    expect(detectAgentFromContent(claudeEntry)).toBe('claude');
    expect(detectAgentFromContent(codexEntry)).toBe('codex');
    expect(detectAgentFromContent(geminiEntry)).toBe('gemini');
    expect(detectAgentFromContent(null)).toBe('unknown');
  });

  it('builds agent info with version from content', () => {
    const info = getAgentInfo('/tmp/session.jsonl', { model: 'gpt-4' });
    expect(info.type).toBe('codex');
    expect(info.version).toBe('gpt-4');
    expect(info.sessionPath).toBe('/tmp/session.jsonl');
  });

  it('returns display names and badge colors', () => {
    expect(getAgentDisplayName('claude')).toBe('Claude');
    expect(getAgentDisplayName('unknown')).toBe('Unknown');
    expect(getAgentBadgeColor('codex')).toBe('#059669');
    expect(getAgentBadgeColor('unknown')).toBe('#6B7280');
  });
});
