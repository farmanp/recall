/**
 * TranscriptFrame Component
 *
 * Wrapper component that dispatches rendering to the appropriate component
 * based on frame type. Handles current frame highlighting and common styling.
 */

import React from 'react';
import ReactMarkdown from 'react-markdown';
import { User, MessageSquare, Clock } from 'lucide-react';
import type { PlaybackFrame } from '../../../types/transcript';
import { ThinkingBlock } from './ThinkingBlock';
import { ToolCard } from './ToolCard';
import { highlightText } from '../../../lib/frameSearch';

interface TranscriptFrameProps {
  frame: PlaybackFrame;
  frameIndex: number;
  isCurrent: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onNavigateToFrame: (index: number) => void;
  searchQuery?: string;
}

export const TranscriptFrame: React.FC<TranscriptFrameProps> = ({
  frame,
  frameIndex,
  isCurrent,
  isExpanded,
  onToggleExpand,
  onNavigateToFrame,
  searchQuery = '',
}) => {
  const timestamp = new Date(frame.timestamp).toLocaleTimeString();
  const agentName = frame.agent ? frame.agent.charAt(0).toUpperCase() + frame.agent.slice(1) : 'AI';

  // Current frame indicator styling
  const currentFrameClass = isCurrent ? 'border-l-4 border-l-accent-green bg-accent-green/5' : '';

  // User Message
  if (frame.type === 'user_message' && frame.userMessage) {
    return (
      <div className={`mb-4 transition-all ${currentFrameClass}`}>
        <div className="flex items-start gap-4 p-4">
          {/* Avatar */}
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-accent-cyan/20 border border-accent-cyan/30 flex items-center justify-center">
            <User className="w-5 h-5 text-accent-cyan" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <span className="font-mono text-sm font-semibold text-accent-cyan">You</span>
              <span className="font-mono text-xs text-forensic-text-muted flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {timestamp}
              </span>
              <span className="font-mono text-xs text-forensic-text-muted">#{frameIndex}</span>
            </div>

            <div className="bg-forensic-bg-secondary border border-forensic-border rounded-lg p-4 prose prose-invert prose-sm max-w-none">
              {searchQuery ? (
                <div className="whitespace-pre-wrap">
                  {highlightText(frame.userMessage.text, searchQuery)}
                </div>
              ) : (
                <ReactMarkdown>{frame.userMessage.text}</ReactMarkdown>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Claude Thinking
  if (frame.type === 'claude_thinking' && frame.thinking) {
    return (
      <div className={`mb-4 transition-all ${currentFrameClass}`}>
        <ThinkingBlock
          text={frame.thinking.text}
          timestamp={timestamp}
          frameIndex={frameIndex}
          agentName={agentName}
          isExpanded={isExpanded}
          onToggleExpand={onToggleExpand}
          searchQuery={searchQuery}
        />
      </div>
    );
  }

  // Claude Response
  if (frame.type === 'claude_response' && frame.claudeResponse) {
    return (
      <div className={`mb-4 transition-all ${currentFrameClass}`}>
        <div className="flex items-start gap-4 p-4">
          {/* Avatar */}
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-accent-green/20 border border-accent-green/30 flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-accent-green" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <span className="font-mono text-sm font-semibold text-accent-green">{agentName}</span>
              <span className="font-mono text-xs text-forensic-text-muted flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {timestamp}
              </span>
              <span className="font-mono text-xs text-forensic-text-muted">#{frameIndex}</span>
            </div>

            <div className="bg-forensic-bg-secondary border border-forensic-border rounded-lg p-4 prose prose-invert prose-sm max-w-none">
              {searchQuery ? (
                <div className="whitespace-pre-wrap">
                  {highlightText(frame.claudeResponse.text, searchQuery)}
                </div>
              ) : (
                <ReactMarkdown>{frame.claudeResponse.text}</ReactMarkdown>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Tool Execution
  if (frame.type === 'tool_execution' && frame.toolExecution) {
    return (
      <div className={`mb-4 transition-all ${currentFrameClass}`}>
        <ToolCard
          toolExecution={frame.toolExecution}
          timestamp={timestamp}
          frameIndex={frameIndex}
          isExpanded={isExpanded}
          onToggleExpand={onToggleExpand}
          onNavigateToFrame={onNavigateToFrame}
          searchQuery={searchQuery}
        />
      </div>
    );
  }

  // Unknown frame type
  return (
    <div
      className={`mb-4 p-4 bg-forensic-bg-secondary border border-forensic-border rounded-lg ${currentFrameClass}`}
    >
      <span className="font-mono text-xs text-forensic-text-muted">
        Unknown frame type: {frame.type}
      </span>
    </div>
  );
};
