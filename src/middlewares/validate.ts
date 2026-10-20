import { RequestHandler } from 'express';
import { ZodType } from 'zod';

type Source = 'body' | 'params' | 'query';

/**
 * Validates `req[source]` against a Zod schema and stores the parsed
 * (trimmed / coerced) result in `res.locals[source]` for the controller.
 * ZodErrors are formatted by the central error handler.
 */
export const validate =
  (schema: ZodType, source: Source = 'body'): RequestHandler =>
  (req, res, next) => {
    res.locals[source] = schema.parse(req[source] ?? {});
    next();
  };
