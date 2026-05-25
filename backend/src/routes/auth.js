const express = require('express');
const prisma  = require('../prisma');
const { asyncH, BadRequest, Unauthorized } = require('../error');

const router = express.Router();

const DEV_OTP = '123456';
const OTP_TTL_MS = 5 * 60 * 1000;

// POST /api/v1/auth/send-otp  { phone, role? }
router.post('/send-otp', asyncH(async (req, res) => {
  const { phone, role = 'CUSTOMER' } = req.body || {};
  if (!/^\d{10}$/.test(String(phone || ''))) throw BadRequest('Invalid 10-digit phone');

  const code = DEV_OTP; // dev mode — fixed code; in prod, generate + dispatch via MSG91
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

  // Look up most-recent unconsumed unexpired OTP for this phone.
  const record = await prisma.oTP.findFirst({
    where: { phone, consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  });
  if (!record || record.code !== otp) {
    return res.status(400).json({ error: { code: 'OTP_INCORRECT', message: 'Incorrect OTP.' } });
  }
  await prisma.oTP.update({ where: { id: record.id }, data: { consumedAt: new Date() } });

  // Upsert user.
  const user = await prisma.user.upsert({
    where:  { phone },
    update: { role },
    create: { phone, role },
  });

  // Dev tokens — replace with JWT in Phase 3.
  res.json({
    accessToken:  `dev-access-${user.id}`,
    refreshToken: `dev-refresh-${user.id}`,
    user: { id: user.id, phone: user.phone, role: user.role },
  });
}));

module.exports = router;
