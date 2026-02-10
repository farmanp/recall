/**
 * ErrorMessage Component
 *
 * Terminal-style error display with forensic theme
 */

import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export interface ErrorMessageProps {
  error: Error | string;
  onRetry?: () => void;
  context?: string;
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({ error, onRetry, context }) => {
  const message = typeof error === 'string' ? error : error.message;
  const isNetworkError =
    message.toLowerCase().includes('fetch') || message.toLowerCase().includes('network');

  return (
    <div className="evidence-card max-w-2xl mx-auto" data-id="ERR-001">
      <div className="flex items-start gap-4">
        <div className="p-3 bg-accent-red/10 border border-accent-red/30">
          <AlertTriangle className="w-6 h-6 text-accent-red" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-mono text-lg text-accent-red mb-2 uppercase tracking-wide">
            {context ? `Error: ${context}` : 'Error: Data Retrieval Failed'}
          </h3>
          <p className="font-mono text-sm text-forensic-text-secondary mb-4 whitespace-pre-wrap break-words">
            {message}
          </p>

          {isNetworkError && (
            <div className="bg-forensic-bg-tertiary border border-forensic-border p-4 mb-4">
              <p className="font-mono text-xs text-forensic-text-primary mb-3 uppercase tracking-wide">
                // Troubleshooting
              </p>
              <ul className="space-y-2 text-sm text-forensic-text-secondary font-mono">
                <li className="flex items-start gap-2">
                  <span className="text-accent-amber">01</span>
                  <span>
                    Run <code className="text-accent-green px-1">npm run dev</code> in backend/
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-accent-amber">02</span>
                  <span>
                    Default port is <code className="text-accent-green px-1">3001</code>
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-accent-amber">03</span>
                  <span>Check browser extensions/CORS</span>
                </li>
              </ul>
            </div>
          )}

          {onRetry && (
            <button
              onClick={onRetry}
              className="inline-flex items-center gap-2 px-4 py-2 bg-accent-red text-forensic-bg-primary font-mono text-sm font-semibold uppercase tracking-wider hover:bg-red-600 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Retry
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
