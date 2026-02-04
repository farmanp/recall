import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

/**
 * Validation error response format
 */
interface ValidationErrorResponse {
  error: string;
  details: Array<{
    path: string;
    message: string;
  }>;
}

/**
 * Creates Express middleware that validates request query parameters
 *
 * Validated data is stored on res.locals.validatedQuery for type-safe access.
 *
 * @param schema - Zod schema to validate against
 * @returns Express middleware function
 *
 * @example
 * router.get('/', validateQuery(sessionListSchema), (req, res) => {
 *   const { offset, limit, agent } = res.locals.validatedQuery;
 *   // Parameters are validated and typed
 * });
 */
export function validateQuery<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const validated = schema.parse(req.query);
      // Store validated data on res.locals for type-safe access
      res.locals.validatedQuery = validated;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const response: ValidationErrorResponse = {
          error: 'Validation failed',
          details: error.issues.map((e) => ({
            path: e.path.join('.'),
            message: e.message,
          })),
        };
        res.status(400).json(response);
        return;
      }
      next(error);
    }
  };
}

/**
 * Creates Express middleware that validates request params (URL parameters)
 *
 * Validated data is stored on res.locals.validatedParams for type-safe access.
 *
 * @param schema - Zod schema to validate against
 * @returns Express middleware function
 *
 * @example
 * router.get('/:id', validateParams(sessionIdSchema), (req, res) => {
 *   const { id } = res.locals.validatedParams;
 *   // id is validated and typed
 * });
 */
export function validateParams<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const validated = schema.parse(req.params);
      // Store validated data on res.locals for type-safe access
      res.locals.validatedParams = validated;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const response: ValidationErrorResponse = {
          error: 'Validation failed',
          details: error.issues.map((e) => ({
            path: e.path.join('.'),
            message: e.message,
          })),
        };
        res.status(400).json(response);
        return;
      }
      next(error);
    }
  };
}

/**
 * Creates Express middleware that validates request body
 *
 * @param schema - Zod schema to validate against
 * @returns Express middleware function
 *
 * @example
 * router.post('/', validateBody(createSessionSchema), (req, res) => {
 *   const { name, project } = req.body;
 *   // Body is validated and typed
 * });
 */
export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const validated = schema.parse(req.body);
      req.body = validated;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const response: ValidationErrorResponse = {
          error: 'Validation failed',
          details: error.issues.map((e) => ({
            path: e.path.join('.'),
            message: e.message,
          })),
        };
        res.status(400).json(response);
        return;
      }
      next(error);
    }
  };
}
