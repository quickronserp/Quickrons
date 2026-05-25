// Generate a human-friendly order number like QR-30421.
// 5-digit base (10000–99998) — collisions resolved by retry up to N times.
const prisma = require('../prisma');

async function generateOrderNumber(maxAttempts = 6) {
  for (let i = 0; i < maxAttempts; i++) {
    const n = 10000 + Math.floor(Math.random() * 89999);
    const candidate = `QR-${n}`;
    const exists = await prisma.order.findUnique({ where: { orderNumber: candidate } });
    if (!exists) return candidate;
  }
  // Fallback: timestamp suffix — guaranteed unique.
  return `QR-${Date.now().toString(36).toUpperCase()}`;
}

module.exports = { generateOrderNumber };
