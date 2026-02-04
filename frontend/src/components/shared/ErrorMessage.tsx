/**
 * ErrorMessage Component
 *
 * Reusable error message display
 */

import React from 'react';

export interface ErrorMessageProps {
  error: Error | string;
  onRetry?: () => void;
  context?: string;
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({ error, onRetry, context }) => {
  const message = typeof error === 'string' ? error : error.message;
  const isNetworkError = message.toLowerCase().includes('fetch') || message.toLowerCase().includes('network');

  return (
    <div className="flex flex-col items-center justify-center p-8 bg-red-900/10 border border-red-800/30 rounded-lg max-w-2xl mx-auto shadow-xl">
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
      <h3 className="text-xl font-bold text-red-400 mb-2">
        Error {context ? `Loading ${context}` : 'Loading Data'}
      </h3>
      <p className="text-sm text-red-300 mb-6 text-center whitespace-pre-wrap">
        {message}
      </p>

      {isNetworkError && (
        <div className="w-full bg-gray-800/50 rounded-lg p-5 mb-6 text-left border border-gray-700">
          <p className="text-sm font-semibold text-gray-200 mb-3">Troubleshooting Tips:</p>
          <ul className="text-xs text-gray-400 space-y-2 list-disc pl-4">
            <li>Is the backend server running? Run <code className="bg-gray-900 px-1 py-0.5 rounded text-blue-400">npm run dev</code> in the <code className="bg-gray-900 px-1 py-0.5 rounded">backend/</code> folder.</li>
            <li>Default backend port is <code className="bg-gray-900 px-1 py-0.5 rounded text-blue-400">3001</code>. Ensure it's not blocked.</li>
            <li>Check if your browser is blocking the request (CORS or extensions).</li>
          </ul>
        </div>
      )}

      {onRetry && (
        <button
          onClick={onRetry}
          className="px-6 py-2 bg-red-600 text-white font-semibold rounded hover:bg-red-700 transition-all shadow-lg active:scale-95"
        >
          Retry Connection
        </button>
      )}
    </div>
  );
};
