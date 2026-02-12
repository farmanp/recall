/**
 * Session Export Utilities
 *
 * Functions to export session data to various formats (Markdown, JSON).
 */

import type { SessionTimeline, PlaybackFrame } from '../types/transcript';

/**
 * Converts a session timeline to a clean Markdown summary.
 */
export function sessionToMarkdown(session: SessionTimeline): string {
  const lines: string[] = [];

  // Header
  lines.push(`# ${session.slug || 'Session'}`);
  lines.push('');
  lines.push(`**Project:** ${session.project}`);
  lines.push(`**Date:** ${new Date(session.startedAt).toLocaleString()}`);
  lines.push(`**Frames:** ${session.totalFrames}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // Frames
  for (const frame of session.frames) {
    if (frame.userMessage?.text) {
      lines.push('### User');
      lines.push('');
      lines.push(frame.userMessage.text);
      lines.push('');
    } else if (frame.claudeResponse?.text) {
      lines.push('### Assistant');
      lines.push('');
      lines.push(frame.claudeResponse.text);
      lines.push('');
    } else if (frame.toolExecution) {
      const tool = frame.toolExecution;
      lines.push(`### Tool: ${tool.tool}`);
      lines.push('');
      if (tool.input) {
        lines.push('```');
        lines.push(JSON.stringify(tool.input, null, 2).slice(0, 1000));
        lines.push('```');
        lines.push('');
      }
    }
  }

  // Footer
  lines.push('---');
  lines.push('');
  lines.push('*Exported from [Recall](https://github.com/anthropics/recall)*');

  return lines.join('\n');
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatFrameContent(frame: PlaybackFrame): string {
  // Format based on frame type
  if (frame.userMessage?.text) {
    return escapeHtml(frame.userMessage.text);
  }
  if (frame.claudeResponse?.text) {
    return escapeHtml(frame.claudeResponse.text);
  }
  if (frame.toolExecution) {
    const tool = frame.toolExecution;
    return `<strong>${escapeHtml(tool.tool)}</strong>\n${escapeHtml(JSON.stringify(tool.input, null, 2).slice(0, 500) || '')}`;
  }
  return '';
}

/**
 * Convert full session timeline to HTML
 */
export function sessionToHTML(session: SessionTimeline): string {
  const css = `
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body {
        font-family: 'SF Mono', 'Consolas', monospace;
        background: #0d1117;
        color: #c9d1d9;
        padding: 2rem;
        line-height: 1.6;
      }
      .header {
        border-bottom: 1px solid #30363d;
        padding-bottom: 1rem;
        margin-bottom: 2rem;
      }
      .header h1 { color: #58a6ff; font-size: 1.5rem; }
      .header .meta { color: #8b949e; font-size: 0.875rem; margin-top: 0.5rem; }
      .frame {
        margin-bottom: 1.5rem;
        padding: 1rem;
        border-left: 3px solid #30363d;
        background: #161b22;
      }
      .frame.user { border-left-color: #58a6ff; }
      .frame.assistant { border-left-color: #7ee787; }
      .frame.tool { border-left-color: #d29922; }
      .frame-header {
        font-size: 0.75rem;
        color: #8b949e;
        margin-bottom: 0.5rem;
        text-transform: uppercase;
      }
      .frame-content { white-space: pre-wrap; }
      pre {
        background: #0d1117;
        padding: 1rem;
        overflow-x: auto;
        border: 1px solid #30363d;
        margin: 0.5rem 0;
      }
      code { font-family: inherit; }
      .summary {
        background: #1f2937;
        border: 1px solid #7ee787;
        padding: 1rem;
        margin-bottom: 2rem;
      }
      .summary h2 { color: #7ee787; margin-bottom: 0.5rem; }
      .footer {
        margin-top: 2rem;
        padding-top: 1rem;
        border-top: 1px solid #30363d;
        color: #8b949e;
        font-size: 0.75rem;
      }
    </style>
  `;

  const header = `
    <div class="header">
      <h1>${escapeHtml(session.slug || 'Session')}</h1>
      <div class="meta">
        <span>${session.project}</span> ·
        <span>${new Date(session.startedAt).toLocaleString()}</span> ·
        <span>${session.frames.length} frames</span>
      </div>
    </div>
  `;

  const framesHtml = session.frames
    .map((frame) => {
      const typeClass =
        frame.type === 'user_message'
          ? 'user'
          : frame.type === 'claude_response'
            ? 'assistant'
            : 'tool';
      const typeLabel = frame.type.replace('_', ' ').toUpperCase();

      return `
      <div class="frame ${typeClass}">
        <div class="frame-header">${typeLabel}</div>
        <div class="frame-content">${formatFrameContent(frame)}</div>
      </div>
    `;
    })
    .join('');

  const footer = `
    <div class="footer">
      Exported from <a href="https://github.com/anthropics/recall" style="color: #58a6ff;">Recall</a> ·
      ${new Date().toLocaleString()}
    </div>
  `;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(session.slug || 'Session')} - Recall Export</title>
  ${css}
</head>
<body>
  ${header}
  ${framesHtml}
  ${footer}
</body>
</html>`;
}

/**
 * Convert a single frame to standalone HTML
 */
export function frameToHTML(frame: PlaybackFrame, sessionMeta?: Partial<SessionTimeline>): string {
  const session: SessionTimeline = {
    sessionId: sessionMeta?.sessionId || 'frame-export',
    slug: sessionMeta?.slug || 'Frame Export',
    project: sessionMeta?.project || 'Unknown',
    startedAt: frame.timestamp,
    completedAt: frame.timestamp,
    totalFrames: 1,
    frames: [frame],
    metadata: {
      cwd: frame.context?.cwd || '',
    },
    agent: sessionMeta?.agent || frame.agent || 'unknown',
  };

  return sessionToHTML(session);
}

/**
 * Converts a single frame to Markdown format.
 */
export function frameToMarkdown(
  frame: PlaybackFrame,
  sessionMeta?: Partial<SessionTimeline>
): string {
  const lines: string[] = [];

  // Header with session context if available
  if (sessionMeta) {
    lines.push(`# Frame Export: ${sessionMeta.slug || 'Session'}`);
    lines.push(`**Project:** ${sessionMeta.project || 'Unknown'}`);
    lines.push(`**Agent:** ${sessionMeta.agent || 'AI'}`);
    lines.push(`**Frame ID:** \`${frame.id}\``);
    lines.push(`**Timestamp:** ${new Date(frame.timestamp).toLocaleString()}`);
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  // Frame content based on type
  switch (frame.type) {
    case 'user_message':
      lines.push(`## 👤 User Message`);
      lines.push('');
      lines.push(frame.userMessage?.text || '');
      break;

    case 'claude_thinking':
      lines.push(
        `## 💭 ${sessionMeta?.agent ? sessionMeta.agent.charAt(0).toUpperCase() + sessionMeta.agent.slice(1) : 'AI'} Thinking`
      );
      lines.push('');
      lines.push(frame.thinking?.text || '');
      break;

    case 'claude_response':
      lines.push(
        `## 🤖 ${sessionMeta?.agent ? sessionMeta.agent.charAt(0).toUpperCase() + sessionMeta.agent.slice(1) : 'AI'} Response`
      );
      lines.push('');
      lines.push(frame.claudeResponse?.text || '');
      break;

    case 'tool_execution':
      const tool = frame.toolExecution;
      if (!tool) break;

      lines.push(`## 🛠️ Tool Execution: \`${tool.tool}\``);
      lines.push('');

      // Input parameters
      if (tool.input) {
        lines.push('### Input Parameters');
        lines.push('```json');
        lines.push(JSON.stringify(tool.input, null, 2));
        lines.push('```');
        lines.push('');
      }

      // File diff
      if (tool.fileDiff) {
        lines.push(`### Modified File: \`${tool.fileDiff.filePath}\``);
        lines.push('```' + (tool.fileDiff.language || ''));
        lines.push(tool.fileDiff.newContent);
        lines.push('```');
        lines.push('');
      }

      // Output
      if (tool.output) {
        lines.push('### Output Result');
        if (tool.output.isError) {
          lines.push('**❌ Error**');
          lines.push('');
        }
        lines.push('```');
        lines.push(tool.output.content);
        lines.push('```');
      }
      break;
  }

  lines.push('');
  lines.push('---');
  lines.push(
    `*Exported from [Recall](https://github.com/farmanp/recall) on ${new Date().toLocaleString()}*`
  );

  return lines.join('\n');
}

/**
 * Triggers a file download of the given text
 */
export function downloadFile(filename: string, text: string) {
  const element = document.createElement('a');
  element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
  element.setAttribute('download', filename);

  element.style.display = 'none';
  document.body.appendChild(element);

  element.click();

  document.body.removeChild(element);
}
