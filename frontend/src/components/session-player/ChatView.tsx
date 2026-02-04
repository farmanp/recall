/**
 * ChatView Component
 *
 * Renders session playback as an animated messaging interface
 */

import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { PlaybackFrame } from '../../types/transcript';
import { CodeBlock } from '../CodeBlock';
import { Clock, Zap, Settings } from 'lucide-react';

interface ChatViewProps {
  frames: PlaybackFrame[];
  currentFrameIndex: number;
  isPlaying: boolean;
  searchQuery?: string;
  activeFrameTypes: Set<string>;
}

export const ChatView: React.FC<ChatViewProps> = ({
  frames,
  currentFrameIndex,
  isPlaying,
  searchQuery = '',
  activeFrameTypes,
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [currentFrameIndex]);

  // Get visible frames up to current index
  const visibleFrames = frames
    .slice(0, currentFrameIndex + 1)
    .filter((frame) => activeFrameTypes.has(frame.type));

  // Show typing indicator if playing and next frame is AI response
  const showTyping =
    isPlaying &&
    currentFrameIndex < frames.length - 1 &&
    (frames[currentFrameIndex + 1]?.type === 'claude_response' ||
      frames[currentFrameIndex + 1]?.type === 'claude_thinking');

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto px-6 py-8 bg-gradient-to-b from-gray-950 to-gray-900"
    >
      <div className="max-w-4xl mx-auto space-y-4 pb-8">
        <AnimatePresence mode="popLayout">
          {visibleFrames.map((frame, index) => (
            <ChatMessage key={frame.id} frame={frame} index={index} searchQuery={searchQuery} />
          ))}
        </AnimatePresence>

        {/* Typing Indicator */}
        {showTyping && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-3"
          >
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center text-white font-bold shadow-lg">
              AI
            </div>
            <div className="bg-gray-800/80 backdrop-blur-sm rounded-3xl px-6 py-4 border border-white/10">
              <div className="flex items-center gap-2">
                <motion.div
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
                  className="flex gap-1"
                >
                  <span className="w-2 h-2 rounded-full bg-gray-400" />
                  <span className="w-2 h-2 rounded-full bg-gray-400" />
                  <span className="w-2 h-2 rounded-full bg-gray-400" />
                </motion.div>
                <span className="text-xs text-gray-400 font-medium">thinking...</span>
              </div>
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>
    </div>
  );
};

const ChatMessage: React.FC<{
  frame: PlaybackFrame;
  index: number;
  searchQuery: string;
}> = ({ frame, index, searchQuery }) => {
  const agentName = frame.agent?.charAt(0).toUpperCase() + (frame.agent?.slice(1) || '') || 'AI';

  // Highlight search matches
  const highlightText = (text: string) => {
    if (!searchQuery) return text;
    const parts = text.split(new RegExp(`(${searchQuery})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === searchQuery.toLowerCase() ? (
        <mark
          key={i}
          className="bg-blue-500 text-white px-1 rounded font-bold shadow-[0_0_10px_rgba(59,130,246,0.5)]"
        >
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  const slideIn = {
    initial: { opacity: 0, y: 20, scale: 0.95 },
    animate: { opacity: 1, y: 0, scale: 1 },
    transition: { duration: 0.3, delay: index * 0.05 },
  };

  // User Message
  if (frame.type === 'user_message' && frame.userMessage) {
    return (
      <motion.div {...slideIn} className="flex items-start gap-3 justify-end">
        <div className="flex flex-col items-end max-w-2xl">
          <div className="bg-blue-600 text-white rounded-3xl rounded-tr-md px-6 py-4 shadow-xl shadow-blue-500/20">
            <p className="whitespace-pre-wrap leading-relaxed font-medium">
              {highlightText(frame.userMessage.text)}
            </p>
          </div>
          <span className="text-[10px] text-gray-500 font-mono mt-1 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {new Date(frame.timestamp).toLocaleTimeString()}
          </span>
        </div>
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-bold shadow-lg flex-shrink-0">
          You
        </div>
      </motion.div>
    );
  }

  // AI Thinking
  if (frame.type === 'claude_thinking' && frame.thinking) {
    return (
      <motion.div {...slideIn} className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold shadow-lg flex-shrink-0">
          <Zap className="w-5 h-5" />
        </div>
        <div className="flex flex-col items-start max-w-2xl">
          <div className="bg-gray-900/60 backdrop-blur-sm text-gray-400 rounded-3xl rounded-tl-md px-6 py-4 border-l-4 border-purple-500/40 shadow-lg italic">
            <p className="text-sm leading-relaxed font-mono">
              {highlightText(frame.thinking.text.substring(0, 500))}
              {frame.thinking.text.length > 500 && '...'}
            </p>
          </div>
          <span className="text-[10px] text-gray-500 font-mono mt-1 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {new Date(frame.timestamp).toLocaleTimeString()}
          </span>
        </div>
      </motion.div>
    );
  }

  // AI Response
  if (frame.type === 'claude_response' && frame.claudeResponse) {
    return (
      <motion.div {...slideIn} className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center text-white font-bold shadow-lg flex-shrink-0">
          AI
        </div>
        <div className="flex flex-col items-start max-w-2xl">
          <div className="bg-gray-800/80 backdrop-blur-sm text-gray-100 rounded-3xl rounded-tl-md px-6 py-4 border border-white/10 shadow-xl">
            <p className="whitespace-pre-wrap leading-relaxed">
              {highlightText(frame.claudeResponse.text)}
            </p>
          </div>
          <span className="text-[10px] text-gray-500 font-mono mt-1 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {new Date(frame.timestamp).toLocaleTimeString()}
          </span>
        </div>
      </motion.div>
    );
  }

  // Tool Execution
  if (frame.type === 'tool_execution' && frame.toolExecution) {
    return (
      <motion.div {...slideIn} className="flex justify-center">
        <div className="w-full max-w-3xl bg-orange-950/30 backdrop-blur-sm rounded-2xl border border-orange-500/20 p-6 shadow-xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-orange-500/10 rounded-lg">
              <Settings className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-widest text-orange-400">
                  Tool Execution
                </span>
                {frame.toolExecution.output.isError && (
                  <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-[10px] font-bold uppercase rounded border border-red-500/30">
                    Failed
                  </span>
                )}
              </div>
              <span className="text-sm font-mono text-gray-400">{frame.toolExecution.tool}</span>
            </div>
            <span className="ml-auto text-[10px] text-gray-500 font-mono flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {new Date(frame.timestamp).toLocaleTimeString()}
            </span>
          </div>

          {frame.toolExecution.output.content && (
            <div className="mt-3">
              <CodeBlock
                code={frame.toolExecution.output.content.substring(0, 1000)}
                language="bash"
                showLineNumbers={false}
                maxHeight="300px"
              />
              {frame.toolExecution.output.content.length > 1000 && (
                <div className="mt-2 text-xs text-gray-500 text-center">
                  Output truncated. View in Timeline mode for full content.
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    );
  }

  return null;
};
