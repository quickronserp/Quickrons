// Rider dispatch routes.
// All routes require: valid JWT → RIDER role → active+approved Rider row.
//
// GET  /api/v1/rider/orders/available      → zone-scoped queue of READY_FOR_PICKUP orders
// POST /api/v1/rider/orders/:id/accept     → READY_FOR_PICKUP → OUT_FOR_DELIVERY (assigns riderId)
// POST /api/v1/rider/orders/:id/picked-up  → OUT_FOR_DELIVERY → PICKED_UP  (sets pickedUpAt)
// POST /api/v1/rider/orders/:id/delivered  → PICKED_UP → DELIVERED         (sets deliveredAt)
// GET  /api/v1/rider/me/orders             → paginated history of own assigned orders
//
// FSM:  READY_FOR_PICKUP → OUT_FOR_DELIVERY → PICKED_UP → DELIVERED
//
// Race-safe accept: uses a single update().where({ id, status, riderId: null })
// so two riders cannot accept the same order — the loser gets P2025 → 409.
//
// COD delivery: paymentStatus set to CAPTURED (cash collected at door).
// Schema has no PAID value; CAPTURED is the correct enum for collected cash.

const express = require('express');
const prisma  = require('../prisma');
const { asyncH, BadRequest, NotFound, Unauthorized } = require('../error');
const { verifyToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// ─── Auth chain — applied to every route in this file ────────────────────────

router.use(verifyToken);
router.use(requireRole('RIDER'));

// loadRider: resolves the Rider row for the authenticated user, validates it
// is active + KYC-approved, and attaches req.rider = { id, fullName, zoneCode }.
const loadRider = asyncH(async (req, _res, next) => {
  const rider = await prisma.rider.findUnique({
    where:  { userId: req.user.id },
    select: { id: true, fullName: true, zoneCode: true, isActive: true, kycStatus: true, isOnline: true },
  });
  if (!rider) {
    throw Unauthorized('No rider profile is linked to this account');
  }
  if (rider.kycStatus !== 'APPROVED') {
    throw Unauthorized(`Rider KYC status is "${rider.kycStatus}" — must be APPROVED to manage deliveries`);
  }
  if (!rider.isActive) {
    throw Unauthorized('Your rider account is currently inactive — contact support');
  }
  req.rider = { id: rider.id, fullName: rider.fullName, zoneCode: rider.zoneCode, isOnline: rider.isOnline };
  next();
});

router.use(loadRider);

// ─── Shared helpers ───────────────────────────────────────────────────────────

const DEFAULT_LIMIT = 20;
const MAX_LIMIT     = 50;

function parsePagination(query) {
  const page  = Math.max(1, parseInt(query.page  || '1',  10) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(query.limit || String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT));
  return { page, limit, skip: (page - 1) * limit };
}

// What the rider sees for each order.
const RIDER_ORDER_INCLUDE = {
  items: {
    orderBy: { name: 'asc' },
    select: { id: true, name: true, qty: true, pricePaise: true, notesPerRow: true },
  },
  partner: {
    select: { id: true, brand: true, zoneCode: true },
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

// Fetch full order after a transaction commits.
function fetchFullOrder(orderId) {
  return prisma.order.findUnique({ where: { id: orderId }, include: RIDER_ORDER_INCLUDE });
}

// Assert the FSM transition is valid. Throws 400 with a clear message if not.
function assertTransition(current, allowedFrom, toStatus) {
  if (!allowedFrom.includes(current)) {
    throw BadRequest(
      `Cannot move to ${toStatus}: order is "${current}". ` +
      `Allowed from: ${allowedFrom.join(', ')}.`,
    );
  }
}

// ─── GET /orders/available — zone-scoped dispatch queue ──────────────────────
//
// Returns READY_FOR_PICKUP orders with no rider yet, scoped to the rider's
// home zone. Riders must be online to see the queue — offline riders get an
// empty list rather than a hard error (app can prompt "go online").
//
// Pagination: newest first (consistent with other list endpoints).

router.get('/orders/available', asyncH(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);

  // Offline riders see an empty queue (soft gate — no hard error).
  if (!req.rider.isOnline) {
    return res.json({
      orders: [],
      pagination: { page, limit, total: 0, pages: 0 },
      hint: 'Go online to see available deliveries',
    });
  }

  const where = {
    status:   'READY_FOR_PICKUP',
    riderId:  null,
    zoneCode: req.rider.zoneCode,
  };

  const [total, orders] = await prisma.$transaction([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take:    limit,
      select: {
        id:            true,
        orderNumber:   true,
        status:        true,
        customerName:  true,
        itemCount:     true,
        totalPaise:    true,
        paymentMethod: true,
        addrLine1:     true,
        addrCity:      true,
        addrPincode:   true,
        addrLat:       true,
        addrLng:       true,
        addrNotes:     true,
        createdAt:     true,
        partner: {
          select: { id: true, brand: true },
        },
        items: {
          orderBy: { name: 'asc' },
          select: { id: true, name: true, qty: true },
        },
      },
    }),
  ]);

  res.json({
    orders,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
}));

// ─── POST /orders/:id/accept — READY_FOR_PICKUP → OUT_FOR_DELIVERY ───────────
//
// Race-safe: update().where includes { status: 'READY_FOR_PICKUP', riderId: null }
// so only one rider can win. If another rider accepted first, Prisma throws
// P2025 which we convert to a 409 "Order no longer available."
//
// Also requires rider to be online at the time of accept.

router.post('/orders/:id/accept', asyncH(async (req, res) => {
  if (!req.rider.isOnline) {
    throw BadRequest('You must be online to accept deliveries');
  }

  // First confirm the order exists in this zone (prevents accepting orders
  // from other zones by guessing an id).
  const exists = await prisma.order.findFirst({
    where: { id: req.params.id, zoneCode: req.rider.zoneCode },
    select: { id: true, status: true, riderId: true },
  });

  if (!exists) throw NotFound('Order not found');

  // Provide clear messages for common non-race scenarios.
  if (exists.status !== 'READY_FOR_PICKUP') {
    throw BadRequest(
      `Order is "${exists.status}" — only READY_FOR_PICKUP orders can be accepted`,
    );
  }
  if (exists.riderId !== null) {
    throw BadRequest('Order has already been accepted by another rider');  // 400 not 409 — clear UX msg
  }

  // Atomic assign: update succeeds only if the row is still unclaimed.
  // Handles the race condition if two riders accept at the exact same moment.
  let accepted;
  try {
    accepted = await prisma.order.update({
      where: { id: req.params.id, status: 'READY_FOR_PICKUP', riderId: null },
      data:  { riderId: req.rider.id, status: 'OUT_FOR_DELIVERY' },
      select: { id: true },
    });
  } catch (err) {
    if (err.code === 'P2025') {
      throw BadRequest('Order was just accepted by another rider — please try the next one');
    }
    throw err;
  }

  // Create the OrderEvent outside the update (array-form tx for safety).
  await prisma.$transaction([
    prisma.orderEvent.create({
      data: {
        orderId:     accepted.id,
        fromStatus:  'READY_FOR_PICKUP',
        toStatus:    'OUT_FOR_DELIVERY',
        actorUserId: req.user.id,
        actorRole:   'RIDER',
        note:        `Accepted by rider ${req.rider.fullName}`,
      },
    }),
  ], { timeout: 15000 });

  const order = await fetchFullOrder(accepted.id);
  res.json({ order });
}));

// ─── POST /orders/:id/picked-up — OUT_FOR_DELIVERY → PICKED_UP ───────────────
//
// Records that the rider has physically collected the order from the kitchen.
// Sets pickedUpAt to now.

router.post('/orders/:id/picked-up', asyncH(async (req, res) => {
  const order = await prisma.order.findFirst({
    where:  { id: req.params.id, riderId: req.rider.id },
    select: { id: true, status: true },
  });
  if (!order) throw NotFound('Order not found');
  assertTransition(order.status, ['OUT_FOR_DELIVERY'], 'PICKED_UP');

  const now = new Date();
  await prisma.$transaction([
    prisma.order.update({
      where:  { id: order.id },
      data:   { status: 'PICKED_UP', pickedUpAt: now },
      select: { id: true },
    }),
    prisma.orderEvent.create({
      data: {
        orderId:     order.id,
        fromStatus:  'OUT_FOR_DELIVERY',
        toStatus:    'PICKED_UP',
        actorUserId: req.user.id,
        actorRole:   'RIDER',
        note:        'Order picked up from kitchen',
      },
    }),
  ], { timeout: 15000 });

  const updated = await fetchFullOrder(order.id);
  res.json({ order: updated });
}));

// ─── POST /orders/:id/delivered — PICKED_UP → DELIVERED ──────────────────────
//
// Records delivery to the customer.
// Sets deliveredAt to now.
// For COD orders: paymentStatus → CAPTURED (cash collected at door).
// For non-COD: paymentStatus unchanged (handled by payment gateway callback).

router.post('/orders/:id/delivered', asyncH(async (req, res) => {
  const order = await prisma.order.findFirst({
    where:  { id: req.params.id, riderId: req.rider.id },
    select: { id: true, status: true, paymentMethod: true },
  });
  if (!order) throw NotFound('Order not found');
  assertTransition(order.status, ['PICKED_UP'], 'DELIVERED');

  const now = new Date();

  // COD: mark payment as captured (cash received). Other methods are handled
  // by payment gateway webhooks — do not touch paymentStatus here.
  const paymentUpdate = order.paymentMethod === 'COD'
    ? { paymentStatus: 'CAPTURED' }
    : {};

  await prisma.$transaction([
    prisma.order.update({
      where:  { id: order.id },
      data:   { status: 'DELIVERED', deliveredAt: now, ...paymentUpdate },
      select: { id: true },
    }),
    prisma.orderEvent.create({
      data: {
        orderId:     order.id,
        fromStatus:  'PICKED_UP',
        toStatus:    'DELIVERED',
        actorUserId: req.user.id,
        actorRole:   'RIDER',
        note:        order.paymentMethod === 'COD'
          ? 'Delivered — COD collected'
          : 'Delivered',
      },
    }),
  ], { timeout: 15000 });

  const updated = await fetchFullOrder(order.id);
  res.json({ order: updated });
}));

// ─── GET /me/orders — rider's assigned order history ─────────────────────────
//
// Query params:
//   status   — filter by OrderStatus value (optional)
//   page     — 1-indexed, default 1
//   limit    — default 20, max 50
//
// Includes only orders where riderId === req.rider.id.
// Newest first.

const VALID_STATUSES = [
  'PLACED', 'CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP',
  'OUT_FOR_DELIVERY', 'PICKED_UP', 'DELIVERED', 'CANCELLED', 'FAILED',
];

router.get('/me/orders', asyncH(async (req, res) => {
  const { status } = req.query;
  const { page, limit, skip } = parsePagination(req.query);

  if (status && !VALID_STATUSES.includes(String(status).toUpperCase())) {
    throw BadRequest(`Invalid status. Use one of: ${VALID_STATUSES.join(', ')}`);
  }

  const where = {
    riderId: req.rider.id,
    ...(status && { status: String(status).toUpperCase() }),
  };

  const [total, orders] = await prisma.$transaction([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take:    limit,
      select: {
        id:            true,
        orderNumber:   true,
        status:        true,
        customerName:  true,
        itemCount:     true,
        totalPaise:    true,
        paymentMethod: true,
        paymentStatus: true,
        addrLine1:     true,
        addrCity:      true,
        addrPincode:   true,
        pickedUpAt:    true,
        deliveredAt:   true,
        createdAt:     true,
        partner: {
          select: { id: true, brand: true },
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
