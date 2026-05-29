// Cross-platform key-value persistence.
// Web   : window.localStorage (unchanged behaviour)
// Native: expo-secure-store  → iOS Keychain / Android Keystore (hardware-backed)
//
// Public API: getItem / setItem / removeItem — all async.
// AuthContext and I18nProvider already await every call; no call-site changes needed.
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const IS_WEB =
  Platform.OS === 'web' &&
  typeof window !== 'undefined' &&
  typeof window.localStorage !== 'undefined';

export async function setItem(key, value) {
  if (value == null) return removeItem(key);
  if (IS_WEB) {
    try { window.localStorage.setItem(key, value); } catch {}
  } else {
    await SecureStore.setItemAsync(key, value);
  }
}

export async function getItem(key) {
  if (IS_WEB) {
    try { return window.localStorage.getItem(key); } catch { return null; }
  }
  return SecureStore.getItemAsync(key);
}

export async function removeItem(key) {
  if (IS_WEB) {
    try { window.localStorage.removeItem(key); } catch {}
  } else {
    await SecureStore.deleteItemAsync(key);
  }
}
