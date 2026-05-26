// JWT authentication middleware.
// Usage: router.get('/protected', verifyToken, asyncH(async (req, res) => { ... }))
//
// On success, attaches req.user = { id, phone, role } from the token payload.
// On failure, returns 401 { error: { code: 'UNAUTHORIZED', message: '...' } }.

const jwt = require('jsonwebtoken');
const { Unauthorized } = require('../error');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-prod';

/**
 * Express middleware — verifies Bearer token.
 * Throws Unauthorized (which the error handler converts to 401 JSON).
 */
function verifyToken(req, _res, next) {
  const header = req.headers['authorization'] || '';
  if (!header.startsWith('Bearer ')) throw Unauthorized('Missing or malformed Authorization header');

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = { id: payload.sub, phone: payload.phone, role: payload.role };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') throw Unauthorized('Access token expired');
    throw Unauthorized('Invalid access token');
  }
}

/**
 * Role guard factory — use after verifyToken.
 * Example: router.get('/admin', verifyToken, requireRole('ADMIN'), handler)
 */
function requireRole(...roles) {
  return (req, _res, next) => {
    if (!roles.includes(req.user?.role)) throw Unauthorized(`Requires role: ${roles.join(' or ')}`);
    next();
  };
}

module.exports = { verifyToken, requireRole };
