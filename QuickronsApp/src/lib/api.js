export const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8080';

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
};
