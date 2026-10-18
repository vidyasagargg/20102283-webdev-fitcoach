/**
 * Validation middleware factory: parses req[source] with a Zod schema and
 * replaces it with the clean, typed result. Invalid input gets a 400 with
 * field-level messages the UI can show next to each input.
 */
import { badRequest } from '../utils/httpError.js';

export const validate =
  (schema, source = 'body') =>
  (req, _res, next) => {
    const result = schema.safeParse(req[source] ?? {});
    if (!result.success) {
      const fields = {};
      for (const issue of result.error.issues) {
        const key = issue.path.join('.') || '_';
        fields[key] ??= issue.message;
      }
      return next(badRequest('Some fields need attention', fields));
    }
    req.valid ??= {};
    req.valid[source] = result.data;
    next();
  };
