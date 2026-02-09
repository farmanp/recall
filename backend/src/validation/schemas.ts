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
  source: z.enum(['filesystem', 'db']).default('db'),
  project: z.string().optional(),
  agent: z.enum(['claude', 'codex', 'gemini', 'unknown']).optional(),
  hasClaudeMd: z.coerce.boolean().optional(),
  showAll: z
    .preprocess((val) => val === 'true' || val === '1' || val === true, z.boolean())
    .optional()
    .default(false),
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
  source: z.enum(['filesystem', 'db']).default('db'),
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

/**
 * Import start body parameters
 */
export const importStartBodySchema = z.object({
  sourcePath: z.string().min(1).optional(),
  parallel: z.coerce.number().int().min(1).max(64).default(10),
  skipExisting: z.coerce.boolean().default(true),
});

/**
 * Single import body parameters
 */
export const importSingleBodySchema = z.object({
  filePath: z.string().min(1),
  agent: z.enum(['claude', 'codex', 'gemini', 'unknown']).optional(),
});

// Export types
export type PaginationParams = z.infer<typeof paginationSchema>;
export type SessionListParams = z.infer<typeof sessionListSchema>;
export type SessionIdParams = z.infer<typeof sessionIdSchema>;
export type FrameListParams = z.infer<typeof frameListSchema>;
export type SearchQueryParams = z.infer<typeof searchQuerySchema>;
export type ClaudeMdCompareParams = z.infer<typeof claudeMdCompareSchema>;
export type ClaudeMdPathParams = z.infer<typeof claudeMdPathSchema>;
export type ImportStartBodyParams = z.infer<typeof importStartBodySchema>;
export type ImportSingleBodyParams = z.infer<typeof importSingleBodySchema>;
