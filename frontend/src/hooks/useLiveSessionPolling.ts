/**
 * Hook for auto-polling live sessions
 *
 * Conditionally polls the session list API every 15 seconds when live sessions
 * are detected (isOngoing=true). Includes a grace period to prevent polling
 * flapping when sessions briefly end and restart.
 */

import { useEffect, useRef } from 'react';
import { useSessions } from './useTranscriptApi';
import type { SessionListQuery } from '../types/transcript';

const LIVE_POLL_INTERVAL = 15000; // 15 seconds
const GRACE_CYCLES = 2; // Keep polling 2 more cycles after live sessions end

export function useLiveSessionPolling(query: SessionListQuery = {}) {
  const result = useSessions(query);
  const graceCyclesRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const hasLiveSessions = result.data?.sessions.some((s) => s.isOngoing) ?? false;

  useEffect(() => {
    // Update grace cycles
    if (hasLiveSessions) {
      graceCyclesRef.current = GRACE_CYCLES;
    }

    const shouldPoll = hasLiveSessions || graceCyclesRef.current > 0;

    if (shouldPoll && !timerRef.current) {
      timerRef.current = setInterval(() => {
        if (graceCyclesRef.current > 0 && !hasLiveSessions) {
          graceCyclesRef.current--;
        }
        if (hasLiveSessions || graceCyclesRef.current > 0) {
          result.refetch();
        } else if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      }, LIVE_POLL_INTERVAL);
    } else if (!shouldPoll && timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [hasLiveSessions, result]);

  return {
    ...result,
    hasLiveSessions,
    isPolling: hasLiveSessions || graceCyclesRef.current > 0,
  };
}
