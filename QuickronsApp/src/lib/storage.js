// Web-only persistence wrapper.
// On web: uses window.localStorage. On native: no-op (sessions don't persist).
// AsyncStorage can be added later when native dev begins — no SDK-coupled native
// modules are imported here, so this file is bundle-safe on every Expo platform.
import { Platform } from 'react-native';

const canUseLS =
  Platform.OS === 'web' &&
  typeof window !== 'undefined' &&
  typeof window.localStorage !== 'undefined';

export async function setItem(key, value) {
  if (!canUseLS) return;
  if (value == null) return removeItem(key);
  try { window.localStorage.setItem(key, value); } catch {}
}

export async function getItem(key) {
  if (!canUseLS) return null;
  try { return window.localStorage.getItem(key); } catch { return null; }
}

export async function removeItem(key) {
  if (!canUseLS) return;
  try { window.localStorage.removeItem(key); } catch {}
}
