

import { todayIso } from '../utils/dates.js';

const API_BASE_URL = (
  import.meta.env.VITE_API_URL ?? ''
).trim().replace(/\/+$/, '');

export class ApiError extends Error {
  constructor(status, message, fields) {
    super(message);

    this.name = 'ApiError';
    this.status = status;
    this.fields = fields ?? {};
  }
}

let onUnauthorized = () => {};

export const setUnauthorizedHandler = (fn) => {
  onUnauthorized =
    typeof fn === 'function' ? fn : () => {};
};

async function request(method, url, body) {
  const controller = new AbortController();

  const timer = setTimeout(
    () => controller.abort(),
    20000
  );

  const path = url.startsWith('/')
    ? url
    : `/${url}`;

  const requestUrl = `${API_BASE_URL}/api${path}`;

  try {
    const res = await fetch(requestUrl, {
      method,

      credentials: 'include',

      signal: controller.signal,

      headers: {
        Accept: 'application/json',

        'X-Requested-With': 'fitcoach',

        'X-Client-Date': todayIso(),

        ...(body !== undefined && {
          'Content-Type': 'application/json',
        }),
      },

      body:
        body !== undefined
          ? JSON.stringify(body)
          : undefined,
    });

    if (res.status === 204) {
      return null;
    }

    const contentType =
      res.headers.get('content-type') ?? '';

    const isJson =
      contentType.includes('application/json') ||
      contentType.includes('+json');

    const data = isJson
      ? await res.json().catch(() => null)
      : null;

    if (!res.ok) {
      if (
        res.status === 401 &&
        !path.startsWith('/auth/')
      ) {
        onUnauthorized();
      }

      throw new ApiError(
        res.status,
        data?.error ??
          data?.message ??
          `Request failed (${res.status})`,
        data?.fields ?? {}
      );
    }

    if (!isJson || data === null) {
      throw new ApiError(
        res.status,
        'Invalid API response. Check the backend URL and routing configuration.'
      );
    }

    return data;
  } catch (err) {
    if (err instanceof ApiError) {
      throw err;
    }

    if (err?.name === 'AbortError') {
      throw new ApiError(
        0,
        'The server took too long to respond.'
      );
    }

    throw new ApiError(
      0,
      'Unable to connect to the server. Please check your connection or API configuration.'
    );
  } finally {
    clearTimeout(timer);
  }
}

export const api = {
  get: (url) => request('GET', url),

  post: (url, body = {}) =>
    request('POST', url, body),

  put: (url, body = {}) =>
    request('PUT', url, body),

  del: (url) => request('DELETE', url),
};
