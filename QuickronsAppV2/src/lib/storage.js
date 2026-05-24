// localStorage-only persistence. No native modules. No expo-secure-store.
// On native (iOS/Android) this is a no-op for now — sessions don't persist there.
// When you start native dev later, swap to @react-native-async-storage/async-storage.
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
