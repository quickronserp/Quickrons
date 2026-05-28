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

  verifyDeliveryCode: (id, code, token) =>
    request(`/api/v1/orders/${id}/verify-delivery-code`, { method: 'POST', body: { code }, token }),
};

// ─── Partner Ops ──────────────────────────────────────────────────────────────

export const partnerApi = {
  me: (token) =>
    request('/api/v1/partner/me', { token }),
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
  seal:      (id, token) =>
    request(`/api/v1/partner/orders/${id}/seal`,      { method: 'POST', token }),
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
  verifySeal: (id, code, token) =>
    request(`/api/v1/rider/orders/${id}/verify-seal`, { method: 'POST', body: { code }, token }),
  pickedUp:   (id, token) =>
    request(`/api/v1/rider/orders/${id}/picked-up`,   { method: 'POST', token }),
  delivered:  (id, token) =>
    request(`/api/v1/rider/orders/${id}/delivered`,   { method: 'POST', token }),
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
};
