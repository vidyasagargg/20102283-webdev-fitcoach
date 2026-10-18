/**
 * Central error handler: one consistent JSON error shape, and no stack traces
 * or internal messages leak to clients in production (OWASP A05).
 */
import { HttpError } from '../utils/httpError.js';

export const notFoundHandler = (req, res) => res.status(404).json({ error: `No route for ${req.method} ${req.path}` });

export const errorHandler = (config) => (err, req, res, _next) => {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, fields: err.details });
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Request body is not valid JSON' });
  }
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request is too large' });
  }
  if (err?.code === 11000) {
    return res.status(409).json({ error: 'That record already exists' });
  }
  if (err?.name === 'ValidationError' || err?.name === 'CastError') {
    return res.status(400).json({ error: 'Invalid data' });
  }
  if (config.NODE_ENV !== 'test') console.error(err);
  res.status(500).json({ error: config.isProd ? 'Something went wrong on our side' : String(err?.message || err) });
};
