/**
 * useConfig Hook
 *
 * Provides access to server-side feature configuration.
 * Reads from the /api/health endpoint which returns feature flags.
 *
 * Usage:
 *   const { tokenStatsEnabled, isLoading } = useConfig();
 *   if (tokenStatsEnabled) { ... }
 */

import { useQuery } from '@tanstack/react-query';

interface HealthResponse {
  status: string;
  timestamp: string;
  databases: {
    claude_mem: string;
    transcripts: string;
  };
  security: {
    viewerMode: boolean;
    authDisabled: boolean;
  };
  features?: {
    tokenStats?: boolean;
  };
}

interface Config {
  /** Whether token statistics feature is enabled (default: true) */
  tokenStatsEnabled: boolean;
  /** Whether the config is still loading */
  isLoading: boolean;
  /** Whether viewer mode is enabled */
  viewerMode: boolean;
}

/**
 * Fetch configuration from the health endpoint
 */
export function useConfig(): Config {
  const { data, isLoading } = useQuery<HealthResponse>({
    queryKey: ['config'],
    queryFn: async () => {
      const response = await fetch('/api/health');
      if (!response.ok) {
        throw new Error('Failed to fetch config');
      }
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    refetchOnWindowFocus: false,
  });

  return {
    tokenStatsEnabled: data?.features?.tokenStats ?? true, // Default to true
    viewerMode: data?.security?.viewerMode ?? false,
    isLoading,
  };
}
