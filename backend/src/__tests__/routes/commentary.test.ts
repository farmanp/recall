import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import type { Application } from 'express';

const execFileMock = vi.fn();

vi.mock('child_process', () => ({
  execFile: execFileMock,
}));

describe('Commentary Routes', () => {
  let app: Application;

  beforeEach(async () => {
    vi.resetModules();
    execFileMock.mockReset();

    execFileMock.mockImplementation(
      (
        _file: string,
        _args: string[],
        _options: unknown,
        callback: (...cbArgs: unknown[]) => void
      ) => {
        callback(null, {
          stdout: JSON.stringify({
            results: [
              {
                id: 1,
                timestamp: 1730000000000,
                type: 'observation',
                title: 'Test',
                content: 'Safe output',
              },
            ],
          }),
          stderr: '',
        });
      }
    );

    const { createServer } = await import('../../server');
    app = createServer();
  });

  it('executes claude mcp with argument array instead of shell string', async () => {
    const sessionId = "session-1'; echo hacked";
    const response = await request(app)
      .get(`/api/sessions/${encodeURIComponent(sessionId)}/commentary`)
      .expect(200);

    expect(response.body.total).toBe(1);
    expect(execFileMock).toHaveBeenCalledTimes(1);

    const [command, args] = execFileMock.mock.calls[0];
    expect(command).toBe('claude');
    expect(args).toEqual([
      'mcp',
      'call',
      'claude-mem',
      'search',
      JSON.stringify({ session_id: sessionId, limit: 100 }),
    ]);
  });
});
