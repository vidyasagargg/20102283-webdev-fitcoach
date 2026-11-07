/**
 * Thin fetch wrapper for the FitCoach REST API.
 * - sends and receives JSON
 * - includes the session cookie (credentials) and the CSRF header
 * - turns error responses into ApiError with field-level messages
 * - times out after 20 s so the UI never hangs
 */
import { todayIso } from '../utils/dates.js';

export class ApiError extends Error {
  constructor(status, message, fields) {
    super(message);
    this.status = status;
    this.fields = fields ?? {};
  }
}

let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => (onUnauthorized = fn);

async function request(method, url, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  let res;
  try {
    res = await fetch(`/api${url}`, {
      method,
      credentials: 'same-origin',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'X-Requested-With': 'fitcoach',
        'X-Client-Date': todayIso(),
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    throw new ApiError(0, err.name === 'AbortError' ? 'The server took too long to respond.' : 'You appear to be offline.');
  } finally {
    clearTimeout(timer);
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && !url.startsWith('/auth/')) onUnauthorized();
    throw new ApiError(res.status, data.error ?? `Request failed (${res.status})`, data.fields);
  }
  return data;
}

export const api = {
  get: (url) => request('GET', url),
  post: (url, body = {}) => request('POST', url, body),
  put: (url, body = {}) => request('PUT', url, body),
  del: (url) => request('DELETE', url),
};
