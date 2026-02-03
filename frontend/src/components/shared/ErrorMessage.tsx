/**
 * ErrorMessage Component
 *
 * Reusable error message display
 */

import React from 'react';

export interface ErrorMessageProps {
  error: Error | string;
  onRetry?: () => void;
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({ error, onRetry }) => {
  const message = typeof error === 'string' ? error : error.message;

  return (
    <div className="flex flex-col items-center justify-center p-8 bg-red-50 border border-red-200 rounded-lg">
      <svg
        className="w-12 h-12 text-red-500 mb-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <h3 className="text-lg font-semibold text-red-900 mb-2">
        Error Loading Data
      </h3>
      <p className="text-sm text-red-700 mb-4 text-center max-w-md">
        {message}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
        >
          Try Again
        </button>
      )}
    </div>
  );
};
