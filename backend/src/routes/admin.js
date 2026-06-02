// Admin operational API.
// All routes require: valid JWT → ADMIN role.
//
// ── Orders ────────────────────────────────────────────────────────────────────
// GET  /api/v1/admin/orders                  → list with filters + pagination
// GET  /api/v1/admin/orders/:id              → full order detail
// POST /api/v1/admin/orders/:id/cancel       → cancel any non-terminal order
// POST /api/v1/admin/orders/:id/assign-rider → assign / reassign rider
//
// ── Partners ──────────────────────────────────────────────────────────────────
// GET  /api/v1/admin/partners                → list all partners
// POST /api/v1/admin/partners/:id/suspend    → toggle isActive false
//
// ── Riders ────────────────────────────────────────────────────────────────────
// GET  /api/v1/admin/riders                  → list all riders
// POST /api/v1/admin/riders/:id/suspend      → toggle isActive false
//
// ── Financials ────────────────────────────────────────────────────────────────
// GET  /api/v1/admin/wallets                 → all wallets (BigInt serialized)
//
// ── Analytics ─────────────────────────────────────────────────────────────────
// GET  /api/v1/admin/analytics               → MVP operational metrics

const express = require('express');
const prisma  = require('../prisma');
const { asyncH, BadRequest, NotFound } = require('../error');
const { verifyToken, requireRole }     = require('../middleware/auth');

const router = express.Router();

// ─── Auth — every route in this file requires ADMIN ──────────────────────────

router.use(verifyToken);
router.use(requireRole('ADMIN'));

// ─── Shared helpers ───────────────────────────────────────────────────────────

const DEFAULT_LIMIT = 20;
const MAX_LIMIT     = 100;

function parsePagination(query) {
  const page  = Math.max(1, parseInt(query.page  || '1',  10) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(query.limit || String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT));
  return { page, limit, skip: (page - 1) * limit };
}

const VALID_ORDER_STATUSES = [
  'PLACED', 'CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP',
  'OUT_FOR_DELIVERY', 'PICKED_UP', 'DELIVERED', 'CANCELLED', 'FAILED',
];

// Terminal statuses — cancel is meaningless once here.
const TERMINAL_STATUSES = ['DELIVERED', 'CANCELLED', 'FAILED'];

// Full order shape for detail + cancel + assign responses.
const ADMIN_ORDER_INCLUDE = {
  items: {
    orderBy: { name: 'asc' },
    select: {
      id:          true,
      name:        true,
      pricePaise:  true,
      qty:         true,
      notesPerRow: true,
    },
  },
  partner: {
    select: { id: true, brand: true, zoneCode: true },
  },
  rider: {
    select: { id: true, fullName: true, zoneCode: true, vehicleType: true },
  },
  events: {
    orderBy: { createdAt: 'asc' },
    select: {
      id:         true,
      fromStatus: true,
      toStatus:   true,
      actorRole:  true,
      note:       true,
      createdAt:  true,
    },
  },
};

// ─── GET /orders ──────────────────────────────────────────────────────────────
//
// Query params:
//   status     — OrderStatus filter
//   partnerId  — filter by partner
//   riderId    — filter by rider
//   zoneCode   — filter by zone
//   from       — ISO date, createdAt >=
//   to         — ISO date, createdAt <=
//   page, limit

router.get('/orders', asyncH(async (req, res) => {
  const { status, partnerId, riderId, zoneCode, from, to } = req.query;
  const { page, limit, skip } = parsePagination(req.query);

  if (status && !VALID_ORDER_STATUSES.includes(String(status).toUpperCase())) {
    throw BadRequest(`Invalid status. Use one of: ${VALID_ORDER_STATUSES.join(', ')}`);
  }

  const where = {};
  if (status)    where.status    = String(status).toUpperCase();
  if (partnerId) where.partnerId = String(partnerId);
  if (riderId)   where.riderId   = String(riderId);
  if (zoneCode)  where.zoneCode  = String(zoneCode);

  if (from || to) {
    where.createdAt = {};
    if (from) {
      const d = new Date(from);
      if (isNaN(d.getTime())) throw BadRequest('Invalid "from" date');
      where.createdAt.gte = d;
    }
    if (to) {
      const d = new Date(to);
      if (isNaN(d.getTime())) throw BadRequest('Invalid "to" date');
      where.createdAt.lte = d;
    }
  }

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
        zoneCode:      true,
        customerName:  true,
        customerPhone: true,
        itemCount:     true,
        totalPaise:    true,
        paymentMethod: true,
        paymentStatus: true,
        createdAt:     true,
        deliveredAt:   true,
        cancelledBy:   true,
        partner: { select: { id: true, brand: true } },
        rider:   { select: { id: true, fullName: true } },
      },
    }),
  ]);

  res.json({ orders, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
}));

// ─── GET /orders/:id ──────────────────────────────────────────────────────────

router.get('/orders/:id', asyncH(async (req, res) => {
  const order = await prisma.order.findFirst({
    where:   { OR: [{ id: req.params.id }, { orderNumber: req.params.id }] },
    include: ADMIN_ORDER_INCLUDE,
  });
  if (!order) throw NotFound('Order not found');
  res.json({ order });
}));

// ─── POST /orders/:id/cancel ──────────────────────────────────────────────────
//
// Body (optional): { reason?: string }
// Cancels any order that has not yet reached a terminal status.

router.post('/orders/:id/cancel', asyncH(async (req, res) => {
  const { reason } = req.body || {};

  const existing = await prisma.order.findFirst({
    where:  { OR: [{ id: req.params.id }, { orderNumber: req.params.id }] },
    select: { id: true, status: true },
  });
  if (!existing) throw NotFound('Order not found');

  if (TERMINAL_STATUSES.includes(existing.status)) {
    throw BadRequest(
      `Order is already "${existing.status}" and cannot be cancelled`,
    );
  }

  const [updated] = await prisma.$transaction([
    prisma.order.update({
      where:   { id: existing.id },
      data:    {
        status:          'CANCELLED',
        cancelledBy:     'ADMIN',
        cancelledReason: typeof reason === 'string' ? reason.trim() || null : null,
      },
      include: ADMIN_ORDER_INCLUDE,
    }),
    prisma.orderEvent.create({
      data: {
        orderId:    existing.id,
        fromStatus: existing.status,
        toStatus:   'CANCELLED',
        actorRole:  'ADMIN',
        note:       reason ? `Admin cancelled: ${String(reason).trim()}` : 'Cancelled by admin',
      },
    }),
  ]);

  res.json({ order: updated });
}));

// ─── POST /orders/:id/assign-rider ───────────────────────────────────────────
//
// Body: { riderId: string }
// Validates rider is active, KYC-approved, and in the same zone as the order.
// Reassigns riderId on any non-terminal order.
// Does NOT advance the order FSM — admin may need to assign without triggering
// state changes (e.g. ops recovery). Order status is left as-is.

router.post('/orders/:id/assign-rider', asyncH(async (req, res) => {
  const { riderId } = req.body || {};
  if (typeof riderId !== 'string' || riderId.trim() === '') {
    throw BadRequest('riderId is required');
  }

  const existing = await prisma.order.findFirst({
    where:  { OR: [{ id: req.params.id }, { orderNumber: req.params.id }] },
    select: { id: true, status: true, zoneCode: true },
  });
  if (!existing) throw NotFound('Order not found');

  if (TERMINAL_STATUSES.includes(existing.status)) {
    throw BadRequest(`Cannot assign rider to a "${existing.status}" order`);
  }

  const rider = await prisma.rider.findUnique({
    where:  { id: riderId.trim() },
    select: { id: true, fullName: true, isActive: true, kycStatus: true, zoneCode: true },
  });
  if (!rider) throw NotFound('Rider not found');
  if (!rider.isActive)               throw BadRequest(`Rider "${rider.fullName}" is inactive`);
  if (rider.kycStatus !== 'APPROVED') throw BadRequest(`Rider "${rider.fullName}" KYC is "${rider.kycStatus}"`);
  if (rider.zoneCode !== existing.zoneCode) {
    throw BadRequest(
      `Rider zone "${rider.zoneCode}" does not match order zone "${existing.zoneCode}"`,
    );
  }

  const [updated] = await prisma.$transaction([
    prisma.order.update({
      where:   { id: existing.id },
      data:    { riderId: rider.id },
      include: ADMIN_ORDER_INCLUDE,
    }),
    prisma.orderEvent.create({
      data: {
        orderId:    existing.id,
        fromStatus: existing.status,
        toStatus:   existing.status,  // status unchanged
        actorRole:  'ADMIN',
        note:       `Rider assigned by admin: ${rider.fullName}`,
      },
    }),
  ]);

  res.json({ order: updated });
}));

// ─── GET /partners ────────────────────────────────────────────────────────────
//
// Query params: zoneCode, kycStatus, isActive, page, limit

router.get('/partners', asyncH(async (req, res) => {
  const { zoneCode, kycStatus, isActive } = req.query;
  const { page, limit, skip } = parsePagination(req.query);

  const where = {};
  if (zoneCode)  where.zoneCode  = String(zoneCode);
  if (kycStatus) where.kycStatus = String(kycStatus).toUpperCase();
  if (isActive !== undefined) where.isActive = isActive === 'true';

  const [total, partners] = await prisma.$transaction([
    prisma.partner.count({ where }),
    prisma.partner.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      select: {
        id:           true,
        brand:        true,
        ownerName:    true,
        category:     true,
        kycStatus:    true,
        isActive:     true,
        zoneCode:     true,
        commissionBps: true,
        createdAt:    true,
        user: { select: { id: true, phone: true, name: true } },
      },
    }),
  ]);

  res.json({ partners, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
}));

// ─── POST /partners/:id/suspend ───────────────────────────────────────────────
//
// Sets isActive = false. Idempotent — suspending an already-suspended partner is a no-op.
// Body (optional): { reason?: string }  (stored in payoutNotes for audit trail)

router.post('/partners/:id/suspend', asyncH(async (req, res) => {
  const { reason } = req.body || {};

  const partner = await prisma.partner.findUnique({
    where:  { id: req.params.id },
    select: { id: true, brand: true, isActive: true },
  });
  if (!partner) throw NotFound('Partner not found');

  const note = reason ? String(reason).trim() : null;
  const updated = await prisma.partner.update({
    where:  { id: partner.id },
    data:   {
      isActive:    false,
      payoutNotes: note
        ? `[SUSPENDED by admin] ${note}`
        : '[SUSPENDED by admin]',
    },
    select: {
      id: true, brand: true, ownerName: true, kycStatus: true,
      isActive: true, zoneCode: true, updatedAt: true,
    },
  });

  res.json({ partner: updated });
}));

// ─── GET /riders ──────────────────────────────────────────────────────────────
//
// Query params: zoneCode, kycStatus, isActive, isOnline, page, limit

router.get('/riders', asyncH(async (req, res) => {
  const { zoneCode, kycStatus, isActive, isOnline } = req.query;
  const { page, limit, skip } = parsePagination(req.query);

  const where = {};
  if (zoneCode)  where.zoneCode  = String(zoneCode);
  if (kycStatus) where.kycStatus = String(kycStatus).toUpperCase();
  if (isActive  !== undefined) where.isActive  = isActive  === 'true';
  if (isOnline  !== undefined) where.isOnline  = isOnline  === 'true';

  const [total, riders] = await prisma.$transaction([
    prisma.rider.count({ where }),
    prisma.rider.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      select: {
        id:            true,
        fullName:      true,
        vehicleType:   true,
        vehicleNumber: true,
        kycStatus:     true,
        isActive:      true,
        isOnline:      true,
        zoneCode:      true,
        lastPingAt:    true,
        createdAt:     true,
        user: { select: { id: true, phone: true } },
      },
    }),
  ]);

  res.json({ riders, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
}));

// ─── POST /riders/:id/suspend ─────────────────────────────────────────────────
//
// Sets isActive = false and isOnline = false (takes rider off the dispatch queue).
// Idempotent.

router.post('/riders/:id/suspend', asyncH(async (req, res) => {
  const rider = await prisma.rider.findUnique({
    where:  { id: req.params.id },
    select: { id: true, fullName: true },
  });
  if (!rider) throw NotFound('Rider not found');

  const updated = await prisma.rider.update({
    where: { id: rider.id },
    data:  { isActive: false, isOnline: false },
    select: {
      id: true, fullName: true, kycStatus: true,
      isActive: true, isOnline: true, zoneCode: true, updatedAt: true,
    },
  });

  res.json({ rider: updated });
}));

// ─── GET /wallets ─────────────────────────────────────────────────────────────
//
// Returns all wallets with BigInt fields serialized as strings.
// Query params: ownerType (PARTNER | RIDER), page, limit

function serializeWallet(w) {
  return {
    ...w,
    balancePaise:        String(w.balancePaise),
    holdPaise:           String(w.holdPaise),
    lifetimeCreditPaise: String(w.lifetimeCreditPaise),
    lifetimeDebitPaise:  String(w.lifetimeDebitPaise),
  };
}

router.get('/wallets', asyncH(async (req, res) => {
  const { ownerType } = req.query;
  const { page, limit, skip } = parsePagination(req.query);

  const where = {};
  if (ownerType) {
    const t = String(ownerType).toUpperCase();
    if (!['PARTNER', 'RIDER'].includes(t)) {
      throw BadRequest('ownerType must be PARTNER or RIDER');
    }
    where.ownerType = t;
  }

  const [total, wallets] = await prisma.$transaction([
    prisma.wallet.count({ where }),
    prisma.wallet.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      skip,
      take: limit,
      select: {
        id:                  true,
        ownerType:           true,
        balancePaise:        true,
        holdPaise:           true,
        lifetimeCreditPaise: true,
        lifetimeDebitPaise:  true,
        currency:            true,
        updatedAt:           true,
        partner: { select: { id: true, brand: true, zoneCode: true } },
        rider:   { select: { id: true, fullName: true, zoneCode: true } },
      },
    }),
  ]);

  res.json({
    wallets:    wallets.map(serializeWallet),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
}));

// ─── GET /analytics ───────────────────────────────────────────────────────────
//
// MVP operational metrics. All figures computed in a single parallel batch.
// Query params:
//   from  — ISO date, createdAt >= (optional)
//   to    — ISO date, createdAt <= (optional)
//
// Response:
//   orders.total, orders.delivered, orders.cancelled, orders.active
//   gmv.totalPaise           — sum of totalPaise across all non-cancelled/failed orders
//   gmv.deliveredPaise       — sum of totalPaise across DELIVERED orders only
//   wallets.partnerTotalPaise — sum of lifetimeCreditPaise across all PARTNER wallets
//   wallets.riderTotalPaise   — sum of lifetimeCreditPaise across all RIDER wallets

router.get('/analytics', asyncH(async (req, res) => {
  const { from, to } = req.query;

  const dateFilter = {};
  if (from) {
    const d = new Date(from);
    if (isNaN(d.getTime())) throw BadRequest('Invalid "from" date');
    dateFilter.gte = d;
  }
  if (to) {
    const d = new Date(to);
    if (isNaN(d.getTime())) throw BadRequest('Invalid "to" date');
    dateFilter.lte = d;
  }
  const createdAt = Object.keys(dateFilter).length ? dateFilter : undefined;

  const baseWhere     = createdAt ? { createdAt } : {};
  const deliveredWhere  = { ...baseWhere, status: 'DELIVERED' };
  const cancelledWhere  = { ...baseWhere, status: 'CANCELLED' };
  const activeWhere     = {
    ...baseWhere,
    status: { notIn: ['DELIVERED', 'CANCELLED', 'FAILED'] },
  };
  const gmvWhere        = {
    ...baseWhere,
    status: { notIn: ['CANCELLED', 'FAILED'] },
  };

  const [
    totalOrders,
    deliveredOrders,
    cancelledOrders,
    activeOrders,
    gmvAggregate,
    deliveredGmvAggregate,
    partnerWallets,
    riderWallets,
  ] = await Promise.all([
    prisma.order.count({ where: baseWhere }),
    prisma.order.count({ where: deliveredWhere }),
    prisma.order.count({ where: cancelledWhere }),
    prisma.order.count({ where: activeWhere }),
    prisma.order.aggregate({ where: gmvWhere,       _sum: { totalPaise: true } }),
    prisma.order.aggregate({ where: deliveredWhere, _sum: { totalPaise: true } }),
    prisma.wallet.aggregate({ where: { ownerType: 'PARTNER' }, _sum: { lifetimeCreditPaise: true } }),
    prisma.wallet.aggregate({ where: { ownerType: 'RIDER' },   _sum: { lifetimeCreditPaise: true } }),
  ]);

  res.json({
    orders: {
      total:     totalOrders,
      delivered: deliveredOrders,
      cancelled: cancelledOrders,
      active:    activeOrders,
    },
    gmv: {
      // Int paise — safe to stringify for consistency with wallet BigInt fields
      totalPaise:     String(gmvAggregate._sum.totalPaise        ?? 0),
      deliveredPaise: String(deliveredGmvAggregate._sum.totalPaise ?? 0),
    },
    wallets: {
      partnerTotalCreditPaise: String(partnerWallets._sum.lifetimeCreditPaise ?? 0n),
      riderTotalCreditPaise:   String(riderWallets._sum.lifetimeCreditPaise   ?? 0n),
    },
    ...(createdAt && {
      period: {
        from: dateFilter.gte?.toISOString() ?? null,
        to:   dateFilter.lte?.toISOString() ?? null,
      },
    }),
  });
}));

// ─── GET /orders/stuck ────────────────────────────────────────────────────────
//
// Surfaces orders that are operationally stuck and need ops attention.
// All thresholds are conservative so this can run every 15-30s on the admin
// dashboard without noise.
//
// A) READY_FOR_PICKUP for > 5 min with no rider     — no one accepted yet
// B) OUT_FOR_DELIVERY for > 15 min                  — rider hasn't picked up
// C) PICKED_UP        for > 10 min                  — customer hasn't verified
// D) paymentStatus PENDING for > 10 min (non-COD)   — payment never captured
// E) PLACED           for > 4 min                   — partner hasn't accepted
//
// Response is bucketed so the UI can render a section per category.

const STUCK_THRESHOLDS_MIN = {
  PLACED:            4,
  READY_FOR_PICKUP:  5,
  OUT_FOR_DELIVERY: 15,
  PICKED_UP:        10,
  PAYMENT_PENDING:  10,
};

router.get('/orders/stuck', asyncH(async (_req, res) => {
  const now = Date.now();
  const cutoff = (mins) => new Date(now - mins * 60 * 1000);

  const baseSelect = {
    id:               true,
    orderNumber:      true,
    status:           true,
    zoneCode:         true,
    customerName:     true,
    customerPhone:    true,
    totalPaise:       true,
    paymentMethod:    true,
    paymentStatus:    true,
    createdAt:        true,
    pickedUpAt:       true,
    partner:          { select: { id: true, brand: true } },
    rider:            { select: { id: true, fullName: true } },
  };

  const [unaccepted, unclaimed, lingeringOnRoad, awaitingCustomer, paymentStuck] = await Promise.all([
    // E) PLACED but partner never accepted
    prisma.order.findMany({
      where: {
        status:    'PLACED',
        createdAt: { lt: cutoff(STUCK_THRESHOLDS_MIN.PLACED) },
      },
      orderBy: { createdAt: 'asc' },
      take:    25,
      select:  baseSelect,
    }),
    // A) READY_FOR_PICKUP with no rider
    prisma.order.findMany({
      where: {
        status:    'READY_FOR_PICKUP',
        riderId:   null,
        createdAt: { lt: cutoff(STUCK_THRESHOLDS_MIN.READY_FOR_PICKUP) },
      },
      orderBy: { createdAt: 'asc' },
      take:    25,
      select:  baseSelect,
    }),
    // B) OUT_FOR_DELIVERY too long (rider has order but not picked up)
    prisma.order.findMany({
      where: {
        status:    'OUT_FOR_DELIVERY',
        createdAt: { lt: cutoff(STUCK_THRESHOLDS_MIN.OUT_FOR_DELIVERY) },
      },
      orderBy: { createdAt: 'asc' },
      take:    25,
      select:  baseSelect,
    }),
    // C) PICKED_UP too long without delivery OTP confirmation
    prisma.order.findMany({
      where: {
        status: 'PICKED_UP',
        OR: [
          { pickedUpAt: { lt: cutoff(STUCK_THRESHOLDS_MIN.PICKED_UP) } },
          { pickedUpAt: null, createdAt: { lt: cutoff(STUCK_THRESHOLDS_MIN.PICKED_UP) } },
        ],
      },
      orderBy: { createdAt: 'asc' },
      take:    25,
      select:  baseSelect,
    }),
    // D) non-COD payment stuck PENDING
    prisma.order.findMany({
      where: {
        paymentStatus: 'PENDING',
        paymentMethod: { not: 'COD' },
        createdAt:     { lt: cutoff(STUCK_THRESHOLDS_MIN.PAYMENT_PENDING) },
        status:        { notIn: ['CANCELLED', 'FAILED'] },
      },
      orderBy: { createdAt: 'asc' },
      take:    25,
      select:  baseSelect,
    }),
  ]);

  const totalCount =
    unaccepted.length + unclaimed.length + lingeringOnRoad.length +
    awaitingCustomer.length + paymentStuck.length;

  res.json({
    totalCount,
    thresholds: STUCK_THRESHOLDS_MIN,
    buckets: {
      unaccepted,                  // partner hasn't accepted PLACED order
      unclaimed:        unclaimed, // READY_FOR_PICKUP, no rider
      lingeringOnRoad,             // OUT_FOR_DELIVERY too long
      awaitingCustomer,            // PICKED_UP, customer hasn't verified
      paymentStuck,                // non-COD PENDING
    },
  });
}));

module.exports = router;
