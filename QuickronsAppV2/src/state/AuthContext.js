import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import * as storage from '../lib/storage';

const KEY = 'quickrons.session';
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [bootstrapping, setBootstrapping] = useState(true);
  const [accessToken,  setAccessToken]    = useState(null);
  const [user,         setUser]           = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const raw = await storage.getItem(KEY);
      if (!cancelled && raw) {
        try {
          const p = JSON.parse(raw);
          setAccessToken(p.accessToken || null);
          setUser(p.user || null);
        } catch {}
      }
      if (!cancelled) setBootstrapping(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const login = async ({ accessToken: a, refreshToken: r, user: u }) => {
    await storage.setItem(KEY, JSON.stringify({ accessToken: a, refreshToken: r, user: u }));
    setAccessToken(a);
    setUser(u);
  };

  const signOut = async () => {
    await storage.removeItem(KEY);
    setAccessToken(null);
    setUser(null);
  };

  const value = useMemo(() => ({
    bootstrapping,
    isAuthenticated: !!accessToken,
    accessToken,
    user,
    login,
    signOut,
  }), [bootstrapping, accessToken, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
