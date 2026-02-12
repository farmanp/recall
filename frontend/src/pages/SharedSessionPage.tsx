import React from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Eye, Lock, Clock, AlertTriangle } from 'lucide-react';
import {
  getSharedSession,
  type SharedSessionData,
  type SharedSessionFrame,
} from '../api/transcriptClient';

const frameStyles: Record<string, string> = {
  user_message: 'border-accent-cyan bg-accent-cyan/5',
  claude_response: 'border-accent-green bg-accent-green/5',
  tool_execution: 'border-accent-amber bg-accent-amber/5',
};

const getFrameStyle = (type: string): string => {
  return frameStyles[type] ?? 'border-forensic-border bg-forensic-bg-secondary';
};

const formatFrameType = (type: string): string => {
  return type.replace(/_/g, ' ');
};

const renderFrameContent = (frame: SharedSessionFrame): string => {
  return typeof frame.content === 'string' ? frame.content : JSON.stringify(frame.content, null, 2);
};

export const SharedSessionPage: React.FC = () => {
  const { shareId } = useParams<{ shareId: string }>();
  const location = useLocation();
  const shareToken = React.useMemo(() => {
    const hash = location.hash.startsWith('#') ? location.hash.slice(1) : location.hash;
    const hashToken = new URLSearchParams(hash).get('token');
    if (hashToken) {
      return hashToken;
    }

    // Backwards compatibility for older links that put token in query params.
    const params = new URLSearchParams(location.search);
    return params.get('token') || undefined;
  }, [location.hash, location.search]);

  const { data, isLoading, error } = useQuery<SharedSessionData>({
    queryKey: ['shared-session', shareId, shareToken ?? 'no-token'],
    queryFn: () => {
      if (!shareId) {
        throw new Error('Share link is missing');
      }

      return getSharedSession(shareId, shareToken);
    },
    enabled: Boolean(shareId),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-forensic-bg-primary flex items-center justify-center">
        <div className="text-forensic-text-secondary font-mono">Loading shared session...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-forensic-bg-primary flex items-center justify-center">
        <div className="text-center px-4">
          <AlertTriangle className="w-12 h-12 text-accent-red mx-auto mb-4" />
          <h1 className="text-xl font-mono text-forensic-text-primary mb-2">Link Invalid</h1>
          <p className="text-forensic-text-secondary font-mono">
            This share link has expired or does not exist.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-forensic-bg-primary">
      <div className="bg-accent-cyan/10 border-b border-accent-cyan/30 px-4 py-2">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 text-accent-cyan font-mono text-sm">
            <Eye className="w-4 h-4" />
            <span>Viewing shared session (read-only)</span>
          </div>
          <div className="flex items-center gap-4 text-forensic-text-secondary font-mono text-xs">
            <span className="flex items-center gap-1">
              <Lock className="w-3 h-3" />
              {data.redactionEnabled === false ? 'Secrets may be visible' : 'Secrets redacted'}
            </span>
            {data.expiresAt && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Expires {new Date(data.expiresAt).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-6">
        <h1 className="text-2xl font-mono font-bold text-forensic-text-primary mb-2">
          {data.session.slug}
        </h1>
        <div className="text-forensic-text-secondary font-mono text-sm mb-6">
          {data.session.project} · {new Date(data.session.startedAt).toLocaleDateString()}
        </div>

        <div className="space-y-4">
          {data.frames.map((frame, index) => (
            <div
              key={`${frame.type}-${index}`}
              className={`p-4 border-l-4 ${getFrameStyle(frame.type)}`}
            >
              <div className="text-xs font-mono text-forensic-text-muted uppercase mb-2">
                {formatFrameType(frame.type)}
              </div>
              <div className="font-mono text-sm text-forensic-text-primary whitespace-pre-wrap break-words">
                {renderFrameContent(frame)}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 pt-4 border-t border-forensic-border text-center">
          <a
            href="https://github.com/anthropics/recall"
            className="text-forensic-text-muted font-mono text-xs hover:text-accent-cyan"
            target="_blank"
            rel="noreferrer"
          >
            Shared via Recall - AI Session Replay
          </a>
        </div>
      </div>
    </div>
  );
};

export default SharedSessionPage;
