/**
 * LoadingSpinner Component
 *
 * Terminal-style loading spinner with forensic theme
 */

import React from 'react';

export interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  label?: string;
}

const sizeClasses = {
  sm: 'h-4 w-4 border-2',
  md: 'h-8 w-8 border-2',
  lg: 'h-12 w-12 border-3',
};

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  className = '',
  label,
}) => {
  return (
    <div className={`flex flex-col items-center gap-3 ${className}`}>
      <div
        className={`animate-spin rounded-full border-accent-green border-t-transparent ${sizeClasses[size]}`}
        role="status"
        aria-label="Loading"
      >
        <span className="sr-only">Loading...</span>
      </div>
      {label && <span className="text-forensic-text-secondary font-mono text-sm">{label}</span>}
    </div>
  );
};

/**
 * Full page loading state with terminal aesthetic
 */
export const LoadingPage: React.FC<{ message?: string }> = ({
  message = 'Scanning sessions...',
}) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-forensic-bg-primary">
      <div className="terminal max-w-md w-full mx-4">
        <div className="terminal-header">
          <div className="terminal-dot terminal-dot-red"></div>
          <div className="terminal-dot terminal-dot-amber"></div>
          <div className="terminal-dot terminal-dot-green"></div>
        </div>
        <div className="terminal-body">
          <div className="flex items-center gap-3">
            <span className="text-accent-green">$</span>
            <span className="text-forensic-text-primary">recall</span>
            <div className="cursor-blink"></div>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <LoadingSpinner size="sm" />
            <span className="text-forensic-text-secondary">{message}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
