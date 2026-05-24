import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import * as storage from '../lib/storage.js';

const STORAGE_KEY = 'quickrons.session';
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [bootstrapping, setBootstrapping] = useState(true);
  const [accessToken,  setAccessToken]    = useState(null);
  const [refreshToken, setRefreshToken]   = useState(null);
  const [user,         setUser]           = useState(null);

  // Restore on cold start.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const raw = await storage.getItem(STORAGE_KEY);
      if (!cancelled && raw) {
        try {
          const parsed = JSON.parse(raw);
          setAccessToken(parsed.accessToken || null);
          setRefreshToken(parsed.refreshToken || null);
          setUser(parsed.user || null);
        } catch {/* corrupt session — ignore */}
      }
      if (!cancelled) setBootstrapping(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const login = async ({ accessToken: a, refreshToken: r, user: u }) => {
    await storage.setItem(STORAGE_KEY, JSON.stringify({ accessToken: a, refreshToken: r, user: u }));
    setAccessToken(a);
    setRefreshToken(r);
    setUser(u);
  };

  const signOut = async () => {
    await storage.removeItem(STORAGE_KEY);
    setAccessToken(null);
    setRefreshToken(null);
    setUser(null);
  };

  const value = useMemo(() => ({
    bootstrapping,
    isAuthenticated: !!accessToken,
    accessToken,
    refreshToken,
    user,
    login,
    signOut,
  }), [bootstrapping, accessToken, refreshToken, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
