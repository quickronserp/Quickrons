export const API_BASE = 'http://localhost:8080';

class ApiError extends Error {
  constructor(message, { status, code, details } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
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
