// Partner order-management routes.
// All routes require: valid JWT → PARTNER role → active+approved Partner row.
//
// GET  /api/v1/partner/orders                  → list own incoming orders
// GET  /api/v1/partner/orders/:id              → fetch one order
// POST /api/v1/partner/orders/:id/accept       → PLACED → CONFIRMED
// POST /api/v1/partner/orders/:id/reject       → PLACED → CANCELLED  (restores qty)
// POST /api/v1/partner/orders/:id/preparing    → CONFIRMED → PREPARING
// POST /api/v1/partner/orders/:id/ready        → PREPARING → READY_FOR_PICKUP (generates tamperSealCode)
// POST /api/v1/partner/orders/:id/seal         → tamperSealStatus NONE/SEALED → SEALED
//
// FSM enforced: every handler asserts the required fromStatus before writing.
// OrderEvent created on every transition (array-form $transaction, no timeout risk).

const express      = require('express');
const prisma       = require('../prisma');
const { asyncH, BadRequest, NotFound, Unauthorized } = require('../error');
const { verifyToken, requireRole } = require('../middleware/auth');

// ─── Tamper seal helpers ──────────────────────────────────────────────────────

// Generates a random 6-digit numeric code, zero-padded.
// Cryptographic quality not required — the code is short-lived and only
// shared in-person between partner and rider. Math.random is fine for MVP.
function generateSealCode() {
  return String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0');
}

const router = express.Router();

// ─── Auth chain — applied to every route in this file ────────────────────────

router.use(verifyToken);
router.use(requireRole('PARTNER'));

// loadPartner: resolves the Partner row for the authenticated user, validates
// it is active + KYC-approved, and attaches req.partner = { id, brand, zoneCode }.
const loadPartner = asyncH(async (req, _res, next) => {
  const partner = await prisma.partner.findUnique({
    where:  { userId: req.user.id },
    select: { id: true, brand: true, zoneCode: true, isActive: true, kycStatus: true },
  });
  if (!partner) {
    throw Unauthorized('No partner profile is linked to this account');
  }
  if (partner.kycStatus !== 'APPROVED') {
    throw Unauthorized(`Partner KYC status is "${partner.kycStatus}" — must be APPROVED to manage orders`);
  }
  if (!partner.isActive) {
    throw Unauthorized('Your kitchen is currently marked inactive — contact support');
  }
  req.partner = { id: partner.id, brand: partner.brand, zoneCode: partner.zoneCode };
  next();
});

router.use(loadPartner);

// ─── Shared helpers ───────────────────────────────────────────────────────────

const DEFAULT_LIMIT = 20;
const MAX_LIMIT     = 50;

function parsePagination(query) {
  const page  = Math.max(1, parseInt(query.page  || '1',  10) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(query.limit || String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT));
  return { page, limit, skip: (page - 1) * limit };
}

// What the partner sees for each order — includes items and a light event log.
// Does NOT include full customer PII beyond what is already on the Order row.
const PARTNER_ORDER_INCLUDE = {
  items: {
    orderBy: { name: 'asc' },
    select: {
      id:         true,
      name:       true,
      pricePaise: true,
      qty:        true,
      notesPerRow: true,
    },
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

// Load an order that belongs to this partner. Throws 404 if not found or
// belongs to a different partner (ownership enforced at query level).
async function getOwnOrder(partnerId, orderId) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, partnerId },
    select: { id: true, status: true, partnerId: true },
  });
  if (!order) throw NotFound('Order not found');
  return order;
}

// Assert the FSM transition is valid. Throws 400 with a clear message.
function assertTransition(current, allowedFrom, toStatus) {
  if (!allowedFrom.includes(current)) {
    throw BadRequest(
      `Cannot move to ${toStatus}: order is "${current}". ` +
      `Allowed from: ${allowedFrom.join(', ')}.`,
    );
  }
}

// Run the standard transition: update order + create event in one tx.
// Returns the id of the updated order (fetch full record outside tx).
async function commitTransition(order, toStatus, updateData, eventNote, actorUserId) {
  const txOps = [
    prisma.order.update({
      where: { id: order.id },
      data:  { status: toStatus, ...updateData },
      select: { id: true },
    }),
    prisma.orderEvent.create({
      data: {
        orderId:     order.id,
        fromStatus:  order.status,
        toStatus,
        actorUserId,
        actorRole:   'PARTNER',
        note:        eventNote || null,
      },
    }),
  ];
  await prisma.$transaction(txOps, { timeout: 15000 });
}

// Fetch full order for the response (outside any transaction).
async function fetchFullOrder(orderId) {
  return prisma.order.findUnique({
    where:   { id: orderId },
    include: PARTNER_ORDER_INCLUDE,
  });
}

// ─── GET /orders — list incoming orders ──────────────────────────────────────
//
// Query params:
//   status   — filter by OrderStatus (optional)
//   page     — 1-indexed, default 1
//   limit    — default 20, max 50

const VALID_STATUSES = [
  'PLACED', 'CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP',
  'PICKED_UP', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'FAILED',
];

router.get('/orders', asyncH(async (req, res) => {
  const { status } = req.query;
  const { page, limit, skip } = parsePagination(req.query);

  if (status && !VALID_STATUSES.includes(String(status).toUpperCase())) {
    throw BadRequest(`Invalid status. Use one of: ${VALID_STATUSES.join(', ')}`);
  }

  const where = {
    partnerId: req.partner.id,
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
        id:              true,
        orderNumber:     true,
        status:          true,
        customerName:    true,
        customerPhone:   true,
        subtotalPaise:   true,
        totalPaise:      true,
        itemCount:       true,
        paymentMethod:   true,
        paymentStatus:   true,
        estimatedReadyAt: true,
        addrLine1:       true,
        addrCity:        true,
        addrPincode:     true,
        addrNotes:       true,
        createdAt:       true,
        items: {
          orderBy: { name: 'asc' },
          select: { id: true, name: true, qty: true, pricePaise: true, notesPerRow: true },
        },
      },
    }),
  ]);

  res.json({
    orders,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
}));

// ─── GET /orders/:id — fetch one order ───────────────────────────────────────

router.get('/orders/:id', asyncH(async (req, res) => {
  // getOwnOrder asserts partnerId ownership — returns 404 for foreign orders.
  await getOwnOrder(req.partner.id, req.params.id);

  const order = await fetchFullOrder(req.params.id);
  res.json({ order });
}));

// ─── POST /orders/:id/accept — PLACED → CONFIRMED ────────────────────────────
//
// Body (optional): { estimatedReadyAt?: ISO-8601 datetime, note?: string }
//
// estimatedReadyAt must be a valid future datetime if provided.

router.post('/orders/:id/accept', asyncH(async (req, res) => {
  const order = await getOwnOrder(req.partner.id, req.params.id);
  assertTransition(order.status, ['PLACED'], 'CONFIRMED');

  const { estimatedReadyAt: rawETA, note } = req.body || {};
  const updateData = {};

  if (rawETA !== undefined && rawETA !== null && rawETA !== '') {
    const eta = new Date(rawETA);
    if (isNaN(eta.getTime())) throw BadRequest('estimatedReadyAt is not a valid datetime');
    if (eta <= new Date())    throw BadRequest('estimatedReadyAt must be in the future');
    updateData.estimatedReadyAt = eta;
  }

  const eventNote = note
    ? String(note).trim() || 'Order accepted'
    : updateData.estimatedReadyAt
      ? `Accepted — ready by ${updateData.estimatedReadyAt.toISOString()}`
      : 'Order accepted';

  await commitTransition(order, 'CONFIRMED', updateData, eventNote, req.user.id);

  const updated = await fetchFullOrder(order.id);
  res.json({ order: updated });
}));

// ─── POST /orders/:id/reject — PLACED → CANCELLED + restore qty ──────────────
//
// Body (optional): { reason?: string }
//
// For each OrderItem that still has a MenuItem with a daily cap,
// dailyQuantityRemaining is incremented back inside the transaction.

router.post('/orders/:id/reject', asyncH(async (req, res) => {
  const order = await getOwnOrder(req.partner.id, req.params.id);
  assertTransition(order.status, ['PLACED'], 'CANCELLED');

  const { reason } = req.body || {};

  // Load items with their menu item's daily cap info for qty restoration.
  const orderItems = await prisma.orderItem.findMany({
    where:  { orderId: order.id },
    select: {
      qty:        true,
      menuItemId: true,
      menuItem: {
        select: { dailyQuantityLimit: true },
      },
    },
  });

  // Only restore items that: still have a menuItemId (not deleted) AND
  // the MenuItem has a dailyQuantityLimit set (null = unlimited, nothing to restore).
  const toRestore = orderItems.filter(
    oi => oi.menuItemId && oi.menuItem && oi.menuItem.dailyQuantityLimit !== null,
  );

  const eventNote = reason
    ? `Rejected: ${String(reason).trim()}`
    : 'Order rejected by kitchen';

  const txOps = [
    // Restore dailyQuantityRemaining for each limited item.
    ...toRestore.map(oi =>
      prisma.menuItem.update({
        where: { id: oi.menuItemId },
        data:  { dailyQuantityRemaining: { increment: oi.qty } },
        select: { id: true },
      }),
    ),
    // Cancel the order.
    prisma.order.update({
      where: { id: order.id },
      data:  {
        status:          'CANCELLED',
        cancelledBy:     'PARTNER',
        cancelledReason: typeof reason === 'string' ? reason.trim() || null : null,
      },
      select: { id: true },
    }),
    // Record the event.
    prisma.orderEvent.create({
      data: {
        orderId:     order.id,
        fromStatus:  order.status,
        toStatus:    'CANCELLED',
        actorUserId: req.user.id,
        actorRole:   'PARTNER',
        note:        eventNote,
      },
    }),
  ];

  await prisma.$transaction(txOps, { timeout: 15000 });

  const updated = await fetchFullOrder(order.id);
  res.json({ order: updated });
}));

// ─── POST /orders/:id/preparing — CONFIRMED → PREPARING ──────────────────────

router.post('/orders/:id/preparing', asyncH(async (req, res) => {
  const order = await getOwnOrder(req.partner.id, req.params.id);
  assertTransition(order.status, ['CONFIRMED'], 'PREPARING');

  const { note } = req.body || {};
  await commitTransition(
    order, 'PREPARING', {},
    note ? String(note).trim() : 'Kitchen started preparing',
    req.user.id,
  );

  const updated = await fetchFullOrder(order.id);
  res.json({ order: updated });
}));

// ─── POST /orders/:id/ready — PREPARING → READY_FOR_PICKUP ───────────────────
//
// Generates a unique 6-digit tamperSealCode saved on the order.
// The code is displayed to the partner so they can verbally confirm it
// with the rider at pickup (or show it on the kitchen display).

router.post('/orders/:id/ready', asyncH(async (req, res) => {
  const order = await getOwnOrder(req.partner.id, req.params.id);
  assertTransition(order.status, ['PREPARING'], 'READY_FOR_PICKUP');

  const { note } = req.body || {};

  // Generate code. Retry once on the vanishingly rare collision (P2002 on
  // tamperSealCode @unique). In practice a single call is always sufficient.
  let sealCode = generateSealCode();
  let committed = false;
  for (let attempt = 0; attempt < 2 && !committed; attempt++) {
    try {
      await commitTransition(
        order,
        'READY_FOR_PICKUP',
        { tamperSealCode: sealCode },
        note ? String(note).trim() : 'Order is packed and ready for pickup',
        req.user.id,
      );
      committed = true;
    } catch (err) {
      if (err.code === 'P2002' && attempt === 0) {
        sealCode = generateSealCode(); // retry with a new code
      } else {
        throw err;
      }
    }
  }

  const updated = await fetchFullOrder(order.id);
  res.json({ order: updated, tamperSealCode: sealCode });
}));

// ─── POST /orders/:id/seal — partner confirms bag is physically sealed ────────
//
// Separate from /ready so the kitchen can mark "packed" and then mark "sealed"
// as a distinct physical action. Both are optional flows — the code is generated
// at /ready regardless.
//
// Allowed from: READY_FOR_PICKUP (order must have a sealCode already)
// Effect: tamperSealStatus → SEALED, tamperSealSealedAt = now

router.post('/orders/:id/seal', asyncH(async (req, res) => {
  const order = await prisma.order.findFirst({
    where:  { id: req.params.id, partnerId: req.partner.id },
    select: { id: true, status: true, tamperSealCode: true, tamperSealStatus: true },
  });
  if (!order) throw NotFound('Order not found');

  if (order.status !== 'READY_FOR_PICKUP') {
    throw BadRequest(
      `Cannot seal: order is "${order.status}". Only READY_FOR_PICKUP orders can be sealed.`,
    );
  }
  if (!order.tamperSealCode) {
    throw BadRequest('Order has no tamper seal code — mark the order ready first');
  }
  if (order.tamperSealStatus === 'SEALED') {
    throw BadRequest('Order is already sealed');
  }

  const now = new Date();
  await prisma.$transaction([
    prisma.order.update({
      where:  { id: order.id },
      data:   { tamperSealStatus: 'SEALED', tamperSealSealedAt: now },
      select: { id: true },
    }),
    prisma.orderEvent.create({
      data: {
        orderId:     order.id,
        fromStatus:  order.status,
        toStatus:    order.status,   // status does not change — same FSM node
        actorUserId: req.user.id,
        actorRole:   'PARTNER',
        note:        'Package sealed by kitchen',
      },
    }),
  ], { timeout: 15000 });

  const updated = await fetchFullOrder(order.id);
  res.json({ order: updated });
}));

// ─── GET /wallet — partner's own wallet + last 20 transactions ───────────────
//
// Returns { wallet: null } if no deliveries have been settled yet.
//
// BigInt fields are serialized to strings — JSON.stringify cannot handle BigInt
// natively and will throw "Do not know how to serialize a BigInt".

function serializeWallet(wallet) {
  if (!wallet) return null;
  return {
    ...wallet,
    balancePaise:        String(wallet.balancePaise),
    holdPaise:           String(wallet.holdPaise),
    lifetimeCreditPaise: String(wallet.lifetimeCreditPaise),
    lifetimeDebitPaise:  String(wallet.lifetimeDebitPaise),
    transactions: (wallet.transactions || []).map(t => ({
      ...t,
      amountPaise:       String(t.amountPaise),
      balanceAfterPaise: String(t.balanceAfterPaise),
    })),
  };
}

router.get('/wallet', asyncH(async (req, res) => {
  const wallet = await prisma.wallet.findUnique({
    where: { partnerId: req.partner.id },
    select: {
      id:                  true,
      ownerType:           true,
      balancePaise:        true,
      holdPaise:           true,
      lifetimeCreditPaise: true,
      lifetimeDebitPaise:  true,
      currency:            true,
      updatedAt:           true,
      transactions: {
        orderBy: { createdAt: 'desc' },
        take:    20,
        select: {
          id:                true,
          direction:         true,
          kind:              true,
          amountPaise:       true,
          balanceAfterPaise: true,
          orderId:           true,
          note:              true,
          createdAt:         true,
        },
      },
    },
  });

  res.json({ wallet: serializeWallet(wallet) });
}));

module.exports = router;
