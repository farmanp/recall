import { describe, it, expect, beforeEach } from 'vitest';
import { ParserFactory } from '../../parser/parser-factory';
import { ClaudeParser } from '../../parser/claude-parser';

describe('ParserFactory', () => {
  beforeEach(() => {
    ParserFactory.clearCache();
  });

  it('lists available agent types', () => {
    const types = ParserFactory.getAvailableAgentTypes();
    expect(types).toContain('claude');
    expect(types).toContain('codex');
    expect(types).toContain('gemini');
  });

  it('reports parser availability', () => {
    expect(ParserFactory.hasParser('claude')).toBe(true);
    expect(ParserFactory.hasParser('unknown')).toBe(true);
  });

  it('falls back to Claude parser for unknown agent', () => {
    const parser = ParserFactory.getParser('unknown');
    expect(parser).toBeInstanceOf(ClaudeParser);
  });
});
