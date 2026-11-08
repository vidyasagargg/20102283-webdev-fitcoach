import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, setUnauthorizedHandler } from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setUser(await api.get('/profile'));
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
    refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({
      user,
      loading,
      setUser,
      refresh,
      async login(email, password) {
        await api.post('/auth/login', { email, password });
        await refresh();
      },
      async register(name, email, password) {
        await api.post('/auth/register', { name, email, password });
        await refresh();
      },
      async logout() {
        await api.post('/auth/logout').catch(() => {});
        setUser(null);
      },
      async saveProfile(patch) {
        const updated = await api.put('/profile', patch);
        setUser(updated);
        return updated;
      },
    }),
    [user, loading, refresh],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
