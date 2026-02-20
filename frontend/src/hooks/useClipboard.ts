/**
 * useClipboard Hook
 *
 * Simple hook for copying text to clipboard with success/error feedback.
 */

import { useState, useCallback } from 'react';

interface UseClipboardReturn {
  copy: (text: string) => Promise<void>;
  copied: boolean;
  error: string | null;
}

export function useClipboard(): UseClipboardReturn {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const copy = useCallback(async (text: string) => {
    if (!navigator.clipboard) {
      setError('Clipboard unavailable');
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setError(null);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Failed to copy');
      setCopied(false);
    }
  }, []);

  return { copy, copied, error };
}
