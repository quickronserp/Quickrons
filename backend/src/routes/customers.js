// Customer profile routes — all require a valid JWT (CUSTOMER role).
//
// GET   /api/v1/customers/me          → full profile + default address
// PATCH /api/v1/customers/me          → update name and/or email
// GET   /api/v1/customers/me/orders   → paginated order history

const express = require('express');
const prisma  = require('../prisma');
const { asyncH, BadRequest } = require('../error');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// All routes in this file require auth.
router.use(verifyToken);

// ─── GET /me ──────────────────────────────────────────────────────────────────

router.get('/me', asyncH(async (req, res) => {
  const user = await prisma.user.findUnique({
    where:   { id: req.user.id },
    select: {
      id:             true,
      phone:          true,
      name:           true,
      email:          true,
      role:           true,
      isActive:       true,
      lastSeenAt:     true,
      createdAt:      true,
      defaultAddress: {
        select: {
          id:        true,
          label:     true,
          recipient: true,
          line1:     true,
          line2:     true,
          landmark:  true,
          city:      true,
          district:  true,
          pincode:   true,
          zoneCode:  true,
          lat:       true,
          lng:       true,
          notes:     true,
        },
      },
    },
  });

  if (!user) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found' } });

  // Touch lastSeenAt without blocking the response.
  prisma.user.update({ where: { id: req.user.id }, data: { lastSeenAt: new Date() } }).catch(() => {});

  res.json({ user });
}));

// ─── PATCH /me ────────────────────────────────────────────────────────────────
// Accepts: { name?, email? }
// name  — any non-empty string, trimmed, max 100 chars
// email — basic format check; null clears it

router.patch('/me', asyncH(async (req, res) => {
  const { name, email } = req.body || {};
  const data = {};

  if (name !== undefined) {
    if (typeof name !== 'string' || name.trim().length === 0) throw BadRequest('name must be a non-empty string');
    if (name.trim().length > 100) throw BadRequest('name must be 100 characters or fewer');
    data.name = name.trim();
  }

  if (email !== undefined) {
    if (email === null || email === '') {
      data.email = null;                           // allow clearing email
    } else {
      if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        throw BadRequest('Invalid email address');
      }
      data.email = email.trim().toLowerCase();
    }
  }

  if (Object.keys(data).length === 0) throw BadRequest('Nothing to update — send name or email');

  const updated = await prisma.user.update({
    where:  { id: req.user.id },
    data,
    select: { id: true, phone: true, name: true, email: true, role: true },
  });

  res.json({ user: updated });
}));

// ─── GET /me/orders — paginated order history ─────────────────────────────────
//
// Query params:
//   status  — filter by OrderStatus value
//   page    — 1-indexed, default 1
//   limit   — default 10, max 50

router.get('/me/orders', asyncH(async (req, res) => {
  const { status } = req.query;
  const page  = Math.max(1, parseInt(req.query.page  || '1',  10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit || '10', 10) || 10));
  const skip  = (page - 1) * limit;

  const VALID_STATUSES = [
    'PLACED', 'CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP',
    'PICKED_UP', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'FAILED',
  ];
  if (status && !VALID_STATUSES.includes(String(status).toUpperCase())) {
    throw BadRequest(`Invalid status filter. Use one of: ${VALID_STATUSES.join(', ')}`);
  }

  const where = {
    customerId: req.user.id,
    ...(status && { status: String(status).toUpperCase() }),
  };

  const [total, orders] = await prisma.$transaction([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      select: {
        id:            true,
        orderNumber:   true,
        status:        true,
        paymentMethod: true,
        paymentStatus: true,
        subtotalPaise: true,
        totalPaise:    true,
        itemCount:     true,
        addrCity:      true,
        addrPincode:   true,
        createdAt:     true,
        deliveredAt:   true,
        cancelledReason: true,
        partner: {
          select: { id: true, brand: true },
        },
        items: {
          orderBy: { name: 'asc' },
          select: {
            id:        true,
            name:      true,
            pricePaise: true,
            qty:       true,
            notesPerRow: true,
          },
        },
      },
    }),
  ]);

  res.json({
    orders,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
}));

module.exports = router;
