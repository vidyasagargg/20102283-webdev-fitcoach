import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api/client.js';

/**
 * Loads a GET endpoint and re-loads whenever the URL changes.
 * Returns { data, error, loading, reload, setData }. Stale responses from
 * an earlier URL (e.g. fast date switching) are ignored.
 */
export function useApi(url) {
  const [state, setState] = useState({ data: null, error: null, loading: Boolean(url) });
  const latest = useRef(url);

  const load = useCallback(async () => {
    if (!url) return;
    latest.current = url;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await api.get(url);
      if (latest.current === url) setState({ data, error: null, loading: false });
    } catch (error) {
      if (latest.current === url) setState({ data: null, error, loading: false });
    }
  }, [url]);

  useEffect(() => {
    load();
  }, [load]);

  const setData = useCallback((fn) => setState((s) => ({ ...s, data: typeof fn === 'function' ? fn(s.data) : fn })), []);
  return { ...state, reload: load, setData };
}
