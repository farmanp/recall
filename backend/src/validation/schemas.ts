import { z } from 'zod';

/**
 * Common pagination parameters for list endpoints
 */
export const paginationSchema = z.object({
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(1000).default(20),
});

/**
 * Session list query parameters
 */
export const sessionListSchema = paginationSchema.extend({
  source: z.enum(['filesystem', 'db']).default('filesystem'),
  project: z.string().optional(),
  agent: z.enum(['claude', 'codex', 'gemini', 'unknown']).optional(),
  hasClaudeMd: z.coerce.boolean().optional(),
});

/**
 * Session ID parameter
 */
export const sessionIdSchema = z.object({
  id: z.string().min(1),
});

/**
 * Frame list query parameters
 * Note: Frames endpoint uses limit=100 by default (larger than session list)
 */
export const frameListSchema = z.object({
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(1000).default(100),
  source: z.enum(['filesystem', 'db']).default('filesystem'),
});

/**
 * Search query parameters
 */
export const searchQuerySchema = z.object({
  q: z.string().min(1),
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(1000).default(50),
  agent: z.enum(['claude', 'codex', 'gemini', 'unknown']).optional(),
  project: z.string().optional(),
});

/**
 * CLAUDE.md compare query parameters
 */
export const claudeMdCompareSchema = z.object({
  from: z.coerce.number().int().min(0),
  to: z.coerce.number().int().min(0),
});

/**
 * CLAUDE.md content query parameters
 */
export const claudeMdPathSchema = z.object({
  path: z.string().min(1),
});

// Export types
export type PaginationParams = z.infer<typeof paginationSchema>;
export type SessionListParams = z.infer<typeof sessionListSchema>;
export type SessionIdParams = z.infer<typeof sessionIdSchema>;
export type FrameListParams = z.infer<typeof frameListSchema>;
export type SearchQueryParams = z.infer<typeof searchQuerySchema>;
export type ClaudeMdCompareParams = z.infer<typeof claudeMdCompareSchema>;
export type ClaudeMdPathParams = z.infer<typeof claudeMdPathSchema>;
