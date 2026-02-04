import { describe, it, expect } from 'vitest';
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('validate_timeline script', () => {
  it('runs successfully against the test database', () => {
    const reportPath = path.join(
      os.tmpdir(),
      `validation-report-${Date.now()}.json`
    );
    const scriptPath = path.resolve(__dirname, '../../../..', 'validate_timeline.js');

    const result = spawnSync('node', [scriptPath], {
      env: {
        ...process.env,
        HOME: process.env.HOME,
        VALIDATION_REPORT_PATH: reportPath,
      },
      encoding: 'utf-8',
    });

    expect(result.status).toBe(0);
    expect(fs.existsSync(reportPath)).toBe(true);

    const report = JSON.parse(fs.readFileSync(reportPath, 'utf-8')) as {
      sessionId: string;
      summary: { failed: number };
    };
    expect(report.sessionId).toBeDefined();
    expect(report.summary.failed).toBe(0);

    fs.unlinkSync(reportPath);
  });
});
