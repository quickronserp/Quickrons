import { Platform } from 'react-native';
import Constants from 'expo-constants';

// ─── API base resolution ───────────────────────────────────────────────────────
//
// The trap that made "images never appear" on demo phones: a hardcoded
// `http://localhost:8080` resolves to the *device* on a physical phone / emulator,
// not the laptop running the backend — so every API call AND every <Image> 404s.
//
// Resolution order:
//   1. An explicit EXPO_PUBLIC_API_URL that is NOT localhost  → always honour it
//      (this is how you point the app at Railway/staging).
//   2. Web                                                    → localhost is correct
//      (browser runs on the same machine as the backend).
//   3. Native (device/emulator)                               → derive the dev
//      machine's LAN IP from the Expo bundler host so a phone on the same Wi-Fi
//      reaches the laptop automatically. Android emulator localhost → 10.0.2.2.
const DEFAULT_PORT = 8080;

function inferDevHost() {
  // Expo SDK 50 exposes the Metro host here, e.g. "192.168.1.7:8081".
  const hostUri =
    Constants.expoConfig?.hostUri ||
    Constants.expoGoConfig?.debuggerHost ||
    Constants.manifest2?.extra?.expoClient?.hostUri ||
    Constants.manifest?.debuggerHost ||
    '';
  const host = String(hostUri).split(':')[0].trim();
  return host || null;
}

function resolveApiBase() {
  const envUrl = (process.env.EXPO_PUBLIC_API_URL || '').trim();
  const envIsLocal = /localhost|127\.0\.0\.1/.test(envUrl);

  // An explicit remote URL always wins.
  if (envUrl && !envIsLocal) return envUrl.replace(/\/+$/, '');

  // Web: the browser shares the host machine, so localhost is right.
  if (Platform.OS === 'web') return (envUrl || `http://localhost:${DEFAULT_PORT}`).replace(/\/+$/, '');

  // Native: localhost would mean the phone itself. Find the laptop.
  const host = inferDevHost();
  if (host && host !== 'localhost' && host !== '127.0.0.1') {
    // Android emulator special-cases the host loopback as 10.0.2.2.
    if (host === '10.0.2.2' || Platform.OS === 'android') return `http://${host}:${DEFAULT_PORT}`;
    return `http://${host}:${DEFAULT_PORT}`;
  }
  return (envUrl || `http://localhost:${DEFAULT_PORT}`).replace(/\/+$/, '');
}

export const API_BASE = resolveApiBase();

// Turn a backend image reference into something <Image source={{uri}}/> can load.
// Backend may return an absolute https URL (Cloudinary) or a server-relative
// "/uploads/…" path (local-disk storage). Relative paths are joined onto API_BASE.
// Centralised so every screen resolves identically (previously duplicated 4×).
export function resolveImageUrl(url) {
  if (!url || typeof url !== 'string') return null;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith('/')) return `${API_BASE}${url}`;
  return url;
}

class ApiError extends Error {
  constructor(message, { status, code, details } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

// Module-level 401 handler — set by AuthProvider on mount.
// When the backend rejects a token (expired/invalid), we auto-signout.
let _unauthorizedHandler = null;
export function setUnauthorizedHandler(fn) {
  _unauthorizedHandler = fn;
}

async function request(path, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('Network error — is the backend running?', { code: 'NETWORK_ERROR' });
  }

  let data = {};
  try { data = await res.json(); } catch {}

  if (!res.ok) {
    const err = data?.error || {};

    // Auto-signout on 401 — expired or invalid token
    if (res.status === 401 && _unauthorizedHandler) {
      _unauthorizedHandler();
    }

    throw new ApiError(err.message || `HTTP ${res.status}`, {
      status: res.status,
      code: err.code,
      details: err.details,
    });
  }

  return data;
}

export const sendOtp = (phone) =>
  request('/api/v1/auth/send-otp', { method: 'POST', body: { phone } });

export const verifyOtp = (phone, otp) =>
  request('/api/v1/auth/verify-otp', { method: 'POST', body: { phone, otp } });

// Returns the *current* server-side user (source of truth for role).
// Used by AuthContext on cold-start to refresh stale cached sessions.
export const fetchMe = (token) =>
  request('/api/v1/auth/me', { token });

export const api = {
  get: (path, opts) => request(path, { ...opts, method: 'GET' }),
  post: (path, body, opts) => request(path, { ...opts, method: 'POST', body }),
};

// ─── Kitchens ─────────────────────────────────────────────────────────────────

export const kitchensApi = {
  list: (token) =>
    request('/api/v1/kitchens', { token }),

  get: (id, token) =>
    request(`/api/v1/kitchens/${id}`, { token }),

  menu: (id, token) =>
    request(`/api/v1/kitchens/${id}/menu`, { token }),
};

// ─── Addresses ────────────────────────────────────────────────────────────────

export const addressesApi = {
  list: (token) =>
    request('/api/v1/addresses', { token }),
};

// ─── Orders ───────────────────────────────────────────────────────────────────

export const ordersApi = {
  place: (body, token) =>
    request('/api/v1/orders', { method: 'POST', body, token }),

  get: (id, token) =>
    request(`/api/v1/orders/${id}`, { token }),

  myList: (token, params = {}) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined))
    ).toString();
    return request(`/api/v1/customers/me/orders${qs ? '?' + qs : ''}`, { token });
  },

  // Submit a rating for a delivered order.
  //   body: { foodRating, deliveryRating, overallRating?, reviewText? }
  submitRating: (id, body, token) =>
    request(`/api/v1/orders/${id}/rating`, { method: 'POST', body, token }),

};

// ─── Partner Ops ──────────────────────────────────────────────────────────────

export const partnerApi = {
  me: (token) =>
    request('/api/v1/partner/me', { token }),
  // Update storefront branding: { tagline?, profileImageUrl?, bannerImageUrl?, galleryUrls? }
  updateProfile: (body, token) =>
    request('/api/v1/partner/me', { method: 'PATCH', body, token }),
  orders: (token, status) => {
    const qs = status ? `?status=${status}&limit=50` : '?limit=50';
    return request(`/api/v1/partner/orders${qs}`, { token });
  },
  accept:    (id, token) =>
    request(`/api/v1/partner/orders/${id}/accept`,    { method: 'POST', token }),
  reject:    (id, reason, token) =>
    request(`/api/v1/partner/orders/${id}/reject`,    { method: 'POST', body: { reason }, token }),
  preparing: (id, token) =>
    request(`/api/v1/partner/orders/${id}/preparing`, { method: 'POST', token }),
  ready:     (id, token) =>
    request(`/api/v1/partner/orders/${id}/ready`,     { method: 'POST', token }),
  wallet:    (token) =>
    request('/api/v1/partner/wallet', { token }),
};

// ─── Partner Menu (self-serve CRUD) ──────────────────────────────────────────
//
// All endpoints are scoped to the authenticated partner on the backend — no
// partnerId argument is needed or accepted from the client.

export const partnerMenuApi = {
  list:   (token) =>
    request('/api/v1/partner/menu', { token }),
  create: (body, token) =>
    request('/api/v1/partner/menu', { method: 'POST', body, token }),
  update: (id, body, token) =>
    request(`/api/v1/partner/menu/${id}`, { method: 'PATCH', body, token }),
  remove: (id, token) =>
    request(`/api/v1/partner/menu/${id}`, { method: 'DELETE', token }),

  // Multipart upload helper.
  //   `file` should be { uri, name, type } as returned by expo-image-picker
  //   (web) or an actual Blob/File object. Returns { url, provider, ... }.
  //
  // Note: we do NOT use the `request()` wrapper here because that helper sets
  // Content-Type to application/json. FormData needs the browser/RN to set
  // multipart/form-data with the correct boundary, so we fetch directly.
  upload: async (file, token) => {
    const form = new FormData();
    // FormData on web wants Blob/File; on RN it wants { uri, name, type }.
    // Both shapes are accepted by the platform's FormData.append.
    form.append('file', file);

    let res;
    try {
      res = await fetch(`${API_BASE}/api/v1/partner/menu/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body:    form,
      });
    } catch (_) {
      throw new ApiError('Network error during upload', { code: 'NETWORK_ERROR' });
    }

    let data = {};
    try { data = await res.json(); } catch (_) {}

    if (!res.ok) {
      const err = data?.error || {};
      throw new ApiError(err.message || `Upload failed (HTTP ${res.status})`, {
        status: res.status,
        code:   err.code,
      });
    }
    return data;
  },
};

// ─── Rider Ops ────────────────────────────────────────────────────────────────

export const riderOpsApi = {
  me:         (token) =>
    request('/api/v1/rider/me', { token }),
  setOnline:  (isOnline, token) =>
    request('/api/v1/rider/me/online', { method: 'POST', body: { isOnline }, token }),
  available:  (token) =>
    request('/api/v1/rider/orders/available', { token }),
  myOrders:   (token, status) => {
    const qs = status ? `?status=${status}` : '';
    return request(`/api/v1/rider/me/orders${qs}`, { token });
  },
  accept:     (id, token) =>
    request(`/api/v1/rider/orders/${id}/accept`,      { method: 'POST', token }),
  pickedUp:   (id, token) =>
    request(`/api/v1/rider/orders/${id}/picked-up`,   { method: 'POST', token }),
  delivered:  (id, code, token) =>
    request(`/api/v1/rider/orders/${id}/delivered`,   { method: 'POST', body: { code }, token }),
  wallet:     (token) =>
    request('/api/v1/rider/wallet', { token }),
};

// ─── Admin Ops ────────────────────────────────────────────────────────────────

export const adminApi = {
  orders: (token, status) => {
    const qs = status ? `?status=${status}&limit=50` : '?limit=50';
    return request(`/api/v1/admin/orders${qs}`, { token });
  },
  analytics: (token) =>
    request('/api/v1/admin/analytics', { token }),
  wallets:   (token) =>
    request('/api/v1/admin/wallets',   { token }),
  partners:  (token) =>
    request('/api/v1/admin/partners',  { token }),
  riders:    (token) =>
    request('/api/v1/admin/riders',    { token }),
  cancelOrder: (id, reason, token) =>
    request(`/api/v1/admin/orders/${id}/cancel`, { method: 'POST', body: { reason }, token }),
  stuckOrders: (token) =>
    request('/api/v1/admin/orders/stuck', { token }),
  ratings: (token) =>
    request('/api/v1/admin/ratings?limit=50', { token }),
};
