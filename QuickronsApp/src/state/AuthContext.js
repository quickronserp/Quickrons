import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import * as storage from '../lib/storage.js';
import { setUnauthorizedHandler, fetchMe } from '../lib/api';
import socketClient from '../lib/socket';

const STORAGE_KEY = 'quickrons.session';
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [bootstrapping, setBootstrapping] = useState(true);
  const [accessToken,  setAccessToken]    = useState(null);
  const [refreshToken, setRefreshToken]   = useState(null);
  const [user,         setUser]           = useState(null);

  // Restore on cold start, then refresh user from the server so a stale role
  // (e.g. cached as CUSTOMER but promoted to PARTNER server-side) self-heals.
  // A 401 here is handled by setUnauthorizedHandler below → signOut().
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const raw = await storage.getItem(STORAGE_KEY);
      let parsed = null;
      if (raw) {
        try { parsed = JSON.parse(raw); } catch {/* corrupt — ignore */}
      }
      if (cancelled) return;

      if (parsed?.accessToken) {
        setAccessToken(parsed.accessToken);
        setRefreshToken(parsed.refreshToken || null);
        setUser(parsed.user || null);

        // Best-effort refresh: replace cached user with server truth.
        // Network failures (offline cold-start) are non-fatal — keep cached user.
        try {
          const { user: fresh } = await fetchMe(parsed.accessToken);
          if (!cancelled && fresh) {
            const changed =
              fresh.role !== parsed.user?.role ||
              fresh.name !== parsed.user?.name;
            if (changed) {
              const next = { ...parsed, user: fresh };
              await storage.setItem(STORAGE_KEY, JSON.stringify(next));
              setUser(fresh);
              if (__DEV__) console.log('[auth] role refreshed', { was: parsed.user?.role, now: fresh.role });
            }
          }
        } catch (e) {
          // 401 already triggered signOut via _unauthorizedHandler.
          // Any other error: leave cached session alone.
          if (__DEV__) console.log('[auth] /me refresh failed', e?.message);
        }
      }

      if (!cancelled) setBootstrapping(false);
    })();
    return () => { cancelled = true; };
  }, []);

  // Register a global 401 handler so any API call with an expired token
  // automatically signs the user out instead of showing a cryptic error.
  useEffect(() => {
    setUnauthorizedHandler(signOut);
    return () => setUnauthorizedHandler(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // Disconnect socket so a new session starts fresh
    socketClient.disconnect();
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
