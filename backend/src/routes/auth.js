const express = require('express');
const jwt     = require('jsonwebtoken');
const prisma  = require('../prisma');
const { asyncH, BadRequest, Unauthorized } = require('../error');

const router = express.Router();

// ─── Constants ────────────────────────────────────────────────────────────────

const DEV_OTP          = '123456';
const OTP_TTL_MS       = 5 * 60 * 1000;           // 5 minutes

const JWT_SECRET         = process.env.JWT_SECRET         || 'dev-secret-change-in-prod';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-in-prod';
const ACCESS_TOKEN_TTL   = '15m';
const REFRESH_TOKEN_TTL  = '7d';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function issueTokens(user) {
  const payload = { sub: user.id, phone: user.phone, role: user.role };
  const accessToken  = jwt.sign(payload,        JWT_SECRET,         { expiresIn: ACCESS_TOKEN_TTL });
  const refreshToken = jwt.sign({ sub: user.id }, JWT_REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_TTL });
  return { accessToken, refreshToken };
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// POST /api/v1/auth/send-otp   { phone, role? }
router.post('/send-otp', asyncH(async (req, res) => {
  const { phone, role = 'CUSTOMER' } = req.body || {};
  if (!/^\d{10}$/.test(String(phone || ''))) throw BadRequest('Invalid 10-digit phone');

  const code      = DEV_OTP;                       // dev: fixed; prod: generate + dispatch via MSG91
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);
  await prisma.oTP.create({ data: { phone, code, expiresAt } });

  console.log(`[DEV OTP] phone=${phone} role=${role} code=${code}`);
  res.json({ ok: true, expiresIn: Math.floor(OTP_TTL_MS / 1000), resendIn: 60 });
}));

// POST /api/v1/auth/verify-otp  { phone, otp, role? }
router.post('/verify-otp', asyncH(async (req, res) => {
  const { phone, otp, role = 'CUSTOMER' } = req.body || {};
  if (!/^\d{10}$/.test(String(phone || ''))) throw BadRequest('Invalid 10-digit phone');
  if (typeof otp !== 'string' || otp.length !== 6) throw BadRequest('Invalid OTP');

  // Most-recent unconsumed unexpired OTP for this phone.
  const record = await prisma.oTP.findFirst({
    where:   { phone, consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  });
  if (!record || record.code !== otp) {
    return res.status(400).json({ error: { code: 'OTP_INCORRECT', message: 'Incorrect OTP.' } });
  }
  await prisma.oTP.update({ where: { id: record.id }, data: { consumedAt: new Date() } });

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
