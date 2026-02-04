/**
 * React Query hooks for Work Units API
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { WorkUnitListQuery, WorkUnitOverrideRequest } from '../types/work-unit';
import * as api from '../api/transcriptClient';

/**
 * Fetch all work units with pagination and filtering
 */
export function useWorkUnits(query: WorkUnitListQuery = {}) {
  return useQuery({
    queryKey: ['work-units', query],
    queryFn: () => api.fetchWorkUnits(query),
  });
}

/**
 * Fetch work unit statistics
 */
export function useWorkUnitStats() {
  return useQuery({
    queryKey: ['work-unit-stats'],
    queryFn: () => api.fetchWorkUnitStats(),
  });
}

/**
 * Fetch a single work unit by ID
 */
export function useWorkUnit(workUnitId: string | undefined) {
  return useQuery({
    queryKey: ['work-unit', workUnitId],
    queryFn: () => api.fetchWorkUnit(workUnitId!),
    enabled: !!workUnitId,
  });
}

/**
 * Fetch work unit for a specific session
 */
export function useSessionWorkUnit(sessionId: string | undefined) {
  return useQuery({
    queryKey: ['session-work-unit', sessionId],
    queryFn: () => api.fetchSessionWorkUnit(sessionId!),
    enabled: !!sessionId,
    retry: false, // Session might not have a work unit
  });
}

/**
 * Mutation to recompute work units
 */
export function useRecomputeWorkUnits() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (force: boolean = false) => api.recomputeWorkUnits(force),
    onSuccess: () => {
      // Invalidate all work unit queries
      queryClient.invalidateQueries({ queryKey: ['work-units'] });
      queryClient.invalidateQueries({ queryKey: ['work-unit-stats'] });
      queryClient.invalidateQueries({ queryKey: ['work-unit'] });
      queryClient.invalidateQueries({ queryKey: ['session-work-unit'] });
    },
  });
}

/**
 * Mutation to update a work unit (add/remove session)
 */
export function useUpdateWorkUnit(workUnitId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: WorkUnitOverrideRequest) => api.updateWorkUnit(workUnitId, request),
    onSuccess: () => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['work-units'] });
      queryClient.invalidateQueries({ queryKey: ['work-unit', workUnitId] });
      queryClient.invalidateQueries({ queryKey: ['work-unit-stats'] });
      queryClient.invalidateQueries({ queryKey: ['session-work-unit'] });
    },
  });
}

/**
 * Mutation to delete a work unit
 */
export function useDeleteWorkUnit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (workUnitId: string) => api.deleteWorkUnit(workUnitId),
    onSuccess: () => {
      // Invalidate all work unit queries
      queryClient.invalidateQueries({ queryKey: ['work-units'] });
      queryClient.invalidateQueries({ queryKey: ['work-unit-stats'] });
      queryClient.invalidateQueries({ queryKey: ['work-unit'] });
      queryClient.invalidateQueries({ queryKey: ['session-work-unit'] });
    },
  });
}
