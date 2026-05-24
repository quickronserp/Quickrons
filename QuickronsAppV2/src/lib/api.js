import Constants from 'expo-constants';

export const API_BASE =
  Constants?.expoConfig?.extra?.apiBase ||
  'http://localhost:8080';

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
  } catch (e) {
    throw new ApiError('Network error — is the backend running on ' + API_BASE + '?', { code: 'NETWORK_ERROR' });
  }
  let data = {};
  try { data = await res.json(); } catch {}
  if (!res.ok) {
    const err = data?.error || {};
    throw new ApiError(err.message || `HTTP ${res.status}`, {
      status: res.status, code: err.code, details: err.details,
    });
  }
  return data;
}

// Backend (backend/src/index.js) reads req.body.otp (not "code") and accepts role.
// Always send role explicitly so the contract is unambiguous.
export const sendOtp = (phone, role = 'CUSTOMER') =>
  request('/api/v1/auth/send-otp', { method: 'POST', body: { phone, role } });

export const verifyOtp = (phone, otp, role = 'CUSTOMER') =>
  request('/api/v1/auth/verify-otp', { method: 'POST', body: { phone, otp, role } });

export { ApiError };
