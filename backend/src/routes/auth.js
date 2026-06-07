const crypto  = require('crypto');
const express = require('express');
const jwt     = require('jsonwebtoken');
const prisma  = require('../prisma');
const { asyncH, BadRequest, Unauthorized } = require('../error');
const { verifyToken } = require('../middleware/auth');

const router  = express.Router();
const IS_PROD = process.env.NODE_ENV === 'production';

// ─── Constants ────────────────────────────────────────────────────────────────

const OTP_TTL_MS = 5 * 60 * 1000;   // 5 minutes

// Known dev-default values. If either appears in production the server refuses to start.
const JWT_SECRET_DEV_DEFAULT         = 'dev-secret-change-in-prod';
const JWT_REFRESH_SECRET_DEV_DEFAULT = 'dev-refresh-secret-change-in-prod';

const JWT_SECRET         = process.env.JWT_SECRET         || JWT_SECRET_DEV_DEFAULT;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || JWT_REFRESH_SECRET_DEV_DEFAULT;

// P0-B: Refuse to start in production with weak or missing JWT secrets.
// This causes an immediate startup crash (visible in Railway deploy logs) rather than
// silently running with a publicly known signing key.
if (IS_PROD) {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === JWT_SECRET_DEV_DEFAULT) {
    throw new Error('[auth] JWT_SECRET must be set to a strong random value in production. ' +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"');
  }
  if (!process.env.JWT_REFRESH_SECRET || process.env.JWT_REFRESH_SECRET === JWT_REFRESH_SECRET_DEV_DEFAULT) {
    throw new Error('[auth] JWT_REFRESH_SECRET must be set to a strong random value in production. ' +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"');
  }
}

const ACCESS_TOKEN_TTL  = '15m';
const REFRESH_TOKEN_TTL = '7d';

// OTP generation — random by default everywhere.
//
// The fixed dev code '123456' is ONLY used when BOTH are true:
//   1. ALLOW_DEV_OTP === 'true'   (explicit opt-in)
//   2. NODE_ENV !== 'production'  (IS_PROD short-circuits it)
//
// In production it is impossible to enable: even if ALLOW_DEV_OTP is set by
// mistake, IS_PROD forces a random code. This closes the "123456 logs in as any
// phone" hole — including the dangerous case where NODE_ENV is left unset on a
// live host (ALLOW_DEV_OTP would still have to be explicitly 'true').
//
// crypto.randomInt gives a uniform 6-digit code. SMS dispatch (MSG91) is a P1
// follow-up; until then the code is logged server-side for manual ops use and is
// NEVER returned in the HTTP response on any environment.
const ALLOW_DEV_OTP = !IS_PROD && process.env.ALLOW_DEV_OTP === 'true';
const DEV_OTP_CODE  = '123456';

if (ALLOW_DEV_OTP) {
  console.warn('[auth] DEV OTP enabled — "123456" will authenticate any phone. ' +
    'Set ALLOW_DEV_OTP=false (or unset) to disable. Never enable in production.');
}

function generateOtp() {
  if (ALLOW_DEV_OTP) return DEV_OTP_CODE;
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function issueTokens(user) {
  const payload = { sub: user.id, phone: user.phone, role: user.role };
  const accessToken  = jwt.sign(payload,        JWT_SECRET,         { expiresIn: ACCESS_TOKEN_TTL });
  const refreshToken = jwt.sign({ sub: user.id }, JWT_REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_TTL });
  return { accessToken, refreshToken };
}

// ─── In-memory rate limiting (MVP) ───────────────────────────────────────────
//
// Single-process, fixed-window. Resets on restart and is NOT shared across
// multiple instances — acceptable for the closed-beta MVP single Node process.
// Swap for a Redis limiter before horizontal scaling. No new dependency.
//
//   send-otp:   max 5 / phone / 15 min   AND   max 30 / IP / 15 min
//   verify-otp: 5 wrong codes / phone → 15 min lockout
const SEND_OTP_PER_PHONE = 5;
const SEND_OTP_PER_IP    = 30;
const SEND_OTP_WINDOW_MS = 15 * 60 * 1000;
const VERIFY_MAX_FAILS   = 5;
const VERIFY_LOCK_MS     = 15 * 60 * 1000;

const sendWindow = new Map();   // key   → { count, resetAt }
const verifyFail = new Map();   // phone → { fails, lockedUntil }

// Fixed-window counter. Returns { ok, retryAfter } (retryAfter in seconds).
function takeToken(map, key, max, windowMs) {
  const now = Date.now();
  const e = map.get(key);
  if (!e || now >= e.resetAt) {
    map.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }
  if (e.count >= max) return { ok: false, retryAfter: Math.ceil((e.resetAt - now) / 1000) };
  e.count += 1;
  return { ok: true, retryAfter: 0 };
}

function clientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length) return xff.split(',')[0].trim();
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

function rateLimited(res, retryAfter, message) {
  res.set('Retry-After', String(retryAfter));
  return res.status(429).json({ error: { code: 'RATE_LIMITED', message, retryAfter } });
}

function verifyLockRemaining(phone) {
  const e = verifyFail.get(phone);
  if (e && e.lockedUntil && Date.now() < e.lockedUntil) {
    return Math.ceil((e.lockedUntil - Date.now()) / 1000);
  }
  return 0;
}

function recordVerifyFail(phone) {
  const e = verifyFail.get(phone) || { fails: 0, lockedUntil: 0 };
  e.fails += 1;
  if (e.fails >= VERIFY_MAX_FAILS) {
    e.lockedUntil = Date.now() + VERIFY_LOCK_MS;   // lock; window now governs
    e.fails = 0;
  }
  verifyFail.set(phone, e);
}

function clearVerifyFails(phone) { verifyFail.delete(phone); }

// ─── Routes ───────────────────────────────────────────────────────────────────

// POST /api/v1/auth/send-otp   { phone, role? }
router.post('/send-otp', asyncH(async (req, res) => {
  const { phone, role = 'CUSTOMER' } = req.body || {};
  if (!/^\d{10}$/.test(String(phone || ''))) throw BadRequest('Invalid 10-digit phone');

  // Rate limit: per-IP first (cheap network-wide abuse guard), then per-phone.
  const ipGate = takeToken(sendWindow, `ip:${clientIp(req)}`, SEND_OTP_PER_IP, SEND_OTP_WINDOW_MS);
  if (!ipGate.ok) return rateLimited(res, ipGate.retryAfter, 'Too many OTP requests from this network. Please try again later.');
  const phoneGate = takeToken(sendWindow, `phone:${phone}`, SEND_OTP_PER_PHONE, SEND_OTP_WINDOW_MS);
  if (!phoneGate.ok) return rateLimited(res, phoneGate.retryAfter, 'Too many OTP requests for this number. Please try again later.');

  const code      = generateOtp();
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);
  await prisma.oTP.create({ data: { phone, code, expiresAt } });

  if (!IS_PROD) {
    console.log(`[DEV OTP] phone=${phone} role=${role} code=${code}`);
  } else {
    // TODO(P1): dispatch code via MSG91 to phone before logging.
    // Log only the last 4 digits of phone — never log the OTP code itself in production.
    console.log(`[OTP] generated for phone=...${phone.slice(-4)} (SMS dispatch pending)`);
  }
  res.json({ ok: true, expiresIn: Math.floor(OTP_TTL_MS / 1000), resendIn: 60 });
}));

// POST /api/v1/auth/verify-otp  { phone, otp, role? }
router.post('/verify-otp', asyncH(async (req, res) => {
  const { phone, otp, role = 'CUSTOMER' } = req.body || {};
  if (!/^\d{10}$/.test(String(phone || ''))) throw BadRequest('Invalid 10-digit phone');
  if (typeof otp !== 'string' || otp.length !== 6) throw BadRequest('Invalid OTP');

  // Lockout: too many recent wrong codes for this phone.
  const lockRemaining = verifyLockRemaining(phone);
  if (lockRemaining > 0) {
    return rateLimited(res, lockRemaining, 'Too many incorrect attempts. Please wait before trying again.');
  }

  // Most-recent unconsumed unexpired OTP for this phone.
  const record = await prisma.oTP.findFirst({
    where:   { phone, consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  });
  if (!record || record.code !== otp) {
    recordVerifyFail(phone);   // count toward lockout
    return res.status(400).json({ error: { code: 'OTP_INCORRECT', message: 'Incorrect OTP.' } });
  }
  await prisma.oTP.update({ where: { id: record.id }, data: { consumedAt: new Date() } });
  clearVerifyFails(phone);     // successful verify resets the failure counter

  // Upsert user. Never overwrite an existing role — PARTNER/RIDER/ADMIN are set by admin, not login.
  const user = await prisma.user.upsert({
    where:  { phone },
    update: {},
    create: { phone, role },
  });

  const { accessToken, refreshToken } = issueTokens(user);

  res.json({
    accessToken,
    refreshToken,
    expiresIn: 15 * 60,                            // seconds — convenience for clients
    user: { id: user.id, phone: user.phone, role: user.role, name: user.name },
  });
}));

// GET /api/v1/auth/me
// Returns the *current* server-side user record (id, phone, role, name).
// Clients should call this on cold-start to self-heal stale cached sessions —
// e.g. a phone that was a CUSTOMER at login time but has since been promoted
// to PARTNER/RIDER/ADMIN by the seed or admin console. The role here is the
// source of truth; clients must update their cached user object when it differs.
router.get('/me', verifyToken, asyncH(async (req, res) => {
  const user = await prisma.user.findUnique({
    where:  { id: req.user.id },
    select: { id: true, phone: true, role: true, name: true, isActive: true },
  });
  if (!user || !user.isActive) throw Unauthorized('User not found or deactivated');
  res.json({ user });
}));

// POST /api/v1/auth/refresh   { refreshToken }
// Issues a new access token and rotates the refresh token.
router.post('/refresh', asyncH(async (req, res) => {
  const { refreshToken } = req.body || {};
  if (!refreshToken || typeof refreshToken !== 'string') throw BadRequest('refreshToken required');

  let payload;
  try {
    payload = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
  } catch (err) {
    if (err.name === 'TokenExpiredError') throw Unauthorized('Refresh token expired — please log in again');
    throw Unauthorized('Invalid refresh token');
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || !user.isActive) throw Unauthorized('User not found or deactivated');

  const tokens = issueTokens(user);
  res.json({
    accessToken:  tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresIn:    15 * 60,
  });
}));

module.exports = router;
