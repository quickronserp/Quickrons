// Order routes.
//
// ── Customer (JWT required) ────────────────────────────────────────────────────
// POST  /api/v1/orders               → place order
// GET   /api/v1/orders/:id           → fetch own order (by id or orderNumber)
// POST  /api/v1/orders/:id/cancel    → cancel own PLACED order
//
// ── Admin (no JWT for now — internal dashboard only) ──────────────────────────
// GET   /api/v1/orders               → list by phone/status
// POST  /api/v1/orders/:id/status    → force status transition
// POST  /api/v1/orders/:id/assign-rider → mock rider assign

const express = require('express');
const prisma  = require('../prisma');
const { asyncH, BadRequest, NotFound, Unauthorized } = require('../error');
const { verifyToken } = require('../middleware/auth');
const { generateOrderNumber } = require('../utils/orderNumber');

const router = express.Router();

// ─── Shared select shapes ─────────────────────────────────────────────────────

const ORDER_INCLUDE = {
  items: {
    orderBy: { name: 'asc' },
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

// ─── POST / — place order ─────────────────────────────────────────────────────
//
// Body: {
//   items: [{ menuItemId, qty, notes? }],   ← NO client-supplied price/name
//   addressId?,                             ← uses defaultAddressId if omitted
//   paymentMethod?                          ← 'COD' | 'RAZORPAY' | 'WALLET' (default COD)
// }
//
// Guarantees:
//   • All items from same partner
//   • Partner isActive + kycStatus APPROVED
//   • All items active
//   • dailyQuantityRemaining respected (re-checked inside transaction)
//   • Address belongs to the caller
//   • Prices are DB-authoritative (snapshots into OrderItem)
//   • dailyQuantityRemaining decremented atomically with order creation
//   • OrderEvent created in the same transaction

const VALID_PAYMENT_METHODS = ['COD', 'RAZORPAY', 'WALLET'];

router.post('/', verifyToken, asyncH(async (req, res) => {
  const { items, addressId, paymentMethod = 'COD' } = req.body || {};

  // ── 1. Basic input validation ──────────────────────────────────────────────
  if (!Array.isArray(items) || items.length === 0) {
    throw BadRequest('items must be a non-empty array');
  }
  if (items.length > 20) {
    throw BadRequest('A single order may not have more than 20 line items');
  }
  if (!VALID_PAYMENT_METHODS.includes(paymentMethod)) {
    throw BadRequest(`paymentMethod must be one of: ${VALID_PAYMENT_METHODS.join(', ')}`);
  }

  for (const it of items) {
    if (typeof it.menuItemId !== 'string' || it.menuItemId.trim() === '') {
      throw BadRequest('Each item must have a menuItemId');
    }
    if (!Number.isInteger(it.qty) || it.qty < 1) {
      throw BadRequest(`qty must be a positive integer (got ${it.qty})`);
    }
    if (it.qty > 50) {
      throw BadRequest(`qty ${it.qty} exceeds the per-item maximum of 50`);
    }
  }

  // Guard against duplicate menuItemIds — customer should merge qty instead.
  const reqItemIds = items.map(i => i.menuItemId);
  if (new Set(reqItemIds).size !== reqItemIds.length) {
    throw BadRequest('Duplicate menuItemId detected — combine quantities into one line');
  }

  // ── 2. Load and validate customer ─────────────────────────────────────────
  const customer = await prisma.user.findUnique({
    where:  { id: req.user.id },
    select: { id: true, phone: true, name: true, isActive: true, defaultAddressId: true },
  });
  if (!customer || !customer.isActive) throw Unauthorized('Account not active');

  // ── 3. Resolve delivery address ────────────────────────────────────────────
  const resolvedAddressId = addressId || customer.defaultAddressId;
  if (!resolvedAddressId) {
    throw BadRequest('No delivery address. Add an address via /api/v1/addresses first.');
  }

  const address = await prisma.address.findFirst({
    where: { id: resolvedAddressId, userId: req.user.id, archivedAt: null },
  });
  if (!address) {
    throw BadRequest('Address not found or does not belong to your account');
  }

  // ── 4. Fetch all menu items from DB in one query ───────────────────────────
  const dbItems = await prisma.menuItem.findMany({
    where:  { id: { in: reqItemIds }, active: true },
    select: {
      id:                     true,
      name:                   true,
      pricePaise:             true,
      isVeg:                  true,
      partnerId:              true,
      dailyQuantityLimit:     true,
      dailyQuantityRemaining: true,
    },
  });

  // All requested items must exist and be active.
  if (dbItems.length !== reqItemIds.length) {
    const foundIds = new Set(dbItems.map(i => i.id));
    const missing  = reqItemIds.filter(id => !foundIds.has(id));
    throw BadRequest(`Item(s) not found or unavailable: ${missing.join(', ')}`);
  }

  // ── 5. Enforce single-partner rule ────────────────────────────────────────
  const partnerIds = [...new Set(dbItems.map(i => i.partnerId))];
  if (partnerIds.length > 1) {
    throw BadRequest('All items must be from the same kitchen. Split into separate orders.');
  }
  const partnerId = partnerIds[0];

  // ── 6. Validate partner is open ───────────────────────────────────────────
  const partner = await prisma.partner.findFirst({
    where:  { id: partnerId, isActive: true, kycStatus: 'APPROVED' },
    select: { id: true, zoneCode: true, brand: true },
  });
  if (!partner) {
    throw BadRequest('This kitchen is currently closed or unavailable');
  }

  // ── 7. Check availability and compute totals ──────────────────────────────
  const dbItemMap = Object.fromEntries(dbItems.map(i => [i.id, i]));

  let subtotalPaise = 0;
  let itemCount     = 0;
  const validatedItems = [];

  for (const reqItem of items) {
    const db  = dbItemMap[reqItem.menuItemId];
    const qty = reqItem.qty;

    // dailyQuantityRemaining: null means unlimited.
    if (db.dailyQuantityRemaining !== null && db.dailyQuantityRemaining < qty) {
      const avail = db.dailyQuantityRemaining;
      throw BadRequest(
        avail === 0
          ? `"${db.name}" is sold out for today`
          : `"${db.name}" only has ${avail} portion${avail === 1 ? '' : 's'} left today`,
      );
    }

    subtotalPaise += db.pricePaise * qty;
    itemCount     += qty;
    validatedItems.push({
      menuItemId:   db.id,
      name:         db.name,         // snapshot — DB authoritative
      pricePaise:   db.pricePaise,   // snapshot — DB authoritative
      qty,
      notesPerRow:  typeof reqItem.notes === 'string' ? reqItem.notes.trim() || null : null,
      hasDailyLimit: db.dailyQuantityRemaining !== null,
    });
  }

  // MVP: no delivery fee / tax / discount. total = subtotal.
  const totalPaise = subtotalPaise;

  // ── 8. Generate order number outside transaction (cheap read-only retry) ──
  const orderNumber = await generateOrderNumber();

  // ── 9. Atomic transaction: writes only — no SELECTs, no includes ───────────
  //
  // Root cause of P2028: the previous version ran findUnique re-reads AND
  // relation includes inside the interactive transaction callback. Each await
  // is a separate network round-trip to the cloud DB (~30–80 ms on Railway).
  // 3 limited items × 2 round-trips + include SELECTs easily blew 5 000 ms.
  //
  // Fix: array-form transaction — all operations are resolved PrismaPromises
  // handed to Prisma at once, no JS event-loop hops between them. No includes
  // inside the transaction. Full order fetched outside after commit.
  //
  // The qty pre-check above (step 7) is sufficient for Phase 2 closed-beta
  // concurrency levels. We no longer re-read inside the transaction.

  const txOps = [
    // Decrement dailyQuantityRemaining for each item that has a daily cap.
    // (Items with null dailyQuantityRemaining are unlimited — skip them.)
    ...validatedItems
      .filter(vi => vi.hasDailyLimit)
      .map(vi =>
        prisma.menuItem.update({
          where: { id: vi.menuItemId },
          data:  { dailyQuantityRemaining: { decrement: vi.qty } },
          select: { id: true },                  // minimal projection
        }),
      ),

    // Create order + items + placement event in one write.
    // select: { id: true } — no relation includes here.
    // Full record is fetched outside the transaction (see below).
    prisma.order.create({
      data: {
        orderNumber,
        customerId:    customer.id,
        customerPhone: customer.phone,
        customerName:  customer.name || null,
        partnerId:     partner.id,
        zoneCode:      partner.zoneCode,
        // Delivery address FK + immutable snapshot.
        deliveryAddressId: address.id,
        addrLine1:    address.line1,
        addrLine2:    address.line2    || null,
        addrLandmark: address.landmark || null,
        addrCity:     address.city,
        addrPincode:  address.pincode,
        addrLat:      address.lat      || null,
        addrLng:      address.lng      || null,
        addrNotes:    address.notes    || null,
        // Money — MVP: no fees / tax.
        subtotalPaise,
        deliveryFeePaise:  0,
        packagingFeePaise: 0,
        taxPaise:          0,
        discountPaise:     0,
        totalPaise,
        itemCount,
        // Status.
        status:        'PLACED',
        // Payment.
        paymentMethod,
        paymentStatus: 'PENDING',
        // Line items — price + name snapshots baked in.
        items: {
          create: validatedItems.map(vi => ({
            menuItemId:  vi.menuItemId,
            name:        vi.name,
            pricePaise:  vi.pricePaise,
            qty:         vi.qty,
            notesPerRow: vi.notesPerRow,
          })),
        },
        // Placement event.
        events: {
          create: [{
            fromStatus:  null,
            toStatus:    'PLACED',
            actorUserId: customer.id,
            actorRole:   'CUSTOMER',
            note:        'Order placed',
          }],
        },
      },
      select: { id: true },
    }),
  ];

  // timeout: 15 000 ms safety net — actual DB time should be <500 ms now.
  const txResults = await prisma.$transaction(txOps, { timeout: 15000 });

  // Last result is always from order.create (updates come first in txOps).
  const { id: createdOrderId } = txResults[txResults.length - 1];

  // Fetch full order with relations outside the transaction — no timeout risk.
  const order = await prisma.order.findUnique({
    where:   { id: createdOrderId },
    include: ORDER_INCLUDE,
  });

  res.status(201).json({ order });
}));

// ─── GET /:id — fetch own order ───────────────────────────────────────────────
//
// :id may be the cuid OR the human-readable orderNumber (QR-XXXXX).
// Customer can only fetch their own orders.

router.get('/:id', verifyToken, asyncH(async (req, res) => {
  const { id } = req.params;

  const where = {
    OR: [{ id }, { orderNumber: id }],
    // Customers see only their own orders; ADMINs see any.
    ...(req.user.role !== 'ADMIN' && { customerId: req.user.id }),
  };

  const order = await prisma.order.findFirst({ where, include: ORDER_INCLUDE });
  if (!order) throw NotFound('Order not found');
  res.json({ order });
}));

// ─── POST /:id/cancel — customer cancels a PLACED order ──────────────────────
//
// Only PLACED status is cancellable by the customer.
// Once CONFIRMED the kitchen has accepted — a different support flow is needed.

const CUSTOMER_CANCELLABLE = ['PLACED'];

router.post('/:id/cancel', verifyToken, asyncH(async (req, res) => {
  const { reason } = req.body || {};

  const order = await prisma.order.findFirst({
    where: { OR: [{ id: req.params.id }, { orderNumber: req.params.id }] },
    select: { id: true, status: true, customerId: true },
  });

  if (!order) throw NotFound('Order not found');

  // Customers can only cancel their own orders; admins can cancel any.
  if (req.user.role !== 'ADMIN' && order.customerId !== req.user.id) {
    throw NotFound('Order not found'); // intentional 404 — don't reveal existence
  }

  if (!CUSTOMER_CANCELLABLE.includes(order.status)) {
    throw BadRequest(
      `Order cannot be cancelled at status "${order.status}". ` +
      'Only PLACED orders can be cancelled. Contact support for assistance.',
    );
  }

  const [updated] = await prisma.$transaction([
    prisma.order.update({
      where: { id: order.id },
      data:  {
        status:          'CANCELLED',
        cancelledBy:     'CUSTOMER',
        cancelledReason: typeof reason === 'string' ? reason.trim() || null : null,
      },
      include: ORDER_INCLUDE,
    }),
    prisma.orderEvent.create({
      data: {
        orderId:    order.id,
        fromStatus: order.status,
        toStatus:   'CANCELLED',
        actorUserId: req.user.id,
        actorRole:  'CUSTOMER',
        note:       reason ? `Cancelled: ${String(reason).trim()}` : 'Cancelled by customer',
      },
    }),
  ]);

  res.json({ order: updated });
}));

// ─── POST /:id/verify-delivery-code — customer verifies tamper seal at door ───
//
// Called by the customer when the rider arrives. The rider reads the 6-digit
// code from the bag (or app); the customer confirms it matches what they see
// in their order detail. This closes the tamper seal chain.
//
// Rules:
//   • JWT required — customer must own the order
//   • Order must be PICKED_UP
//   • Supplied code must match order.tamperSealCode
//   • Sets tamperSealStatus → VERIFIED_BY_CUSTOMER, tamperSealCustAt = now
//   • Creates an OrderEvent
//   • After this, the rider can call /delivered

router.post('/:id/verify-delivery-code', verifyToken, asyncH(async (req, res) => {
  const { code } = req.body || {};
  if (typeof code !== 'string' || !/^\d{6}$/.test(code.trim())) {
    throw BadRequest('code must be a 6-digit numeric string');
  }

  const order = await prisma.order.findFirst({
    where: { OR: [{ id: req.params.id }, { orderNumber: req.params.id }] },
    select: {
      id:               true,
      status:           true,
      customerId:       true,
      tamperSealCode:   true,
      tamperSealStatus: true,
    },
  });
  if (!order) throw NotFound('Order not found');

  // Customers see only their own orders; admins can verify any.
  if (req.user.role !== 'ADMIN' && order.customerId !== req.user.id) {
    throw NotFound('Order not found'); // intentional 404 — don't reveal existence
  }

  if (order.status !== 'PICKED_UP') {
    throw BadRequest(
      `Cannot verify delivery code: order is "${order.status}". ` +
      'Code can only be verified when the order is PICKED_UP (rider is at your door).',
    );
  }
  if (!order.tamperSealCode) {
    throw BadRequest('This order has no tamper seal code');
  }
  if (order.tamperSealCode !== code.trim()) {
    throw BadRequest('Code does not match — check with the rider');
  }
  if (order.tamperSealStatus === 'VERIFIED_BY_CUSTOMER') {
    throw BadRequest('Delivery code already verified');
  }

  const now = new Date();
  const [updated] = await prisma.$transaction([
    prisma.order.update({
      where:   { id: order.id },
      data:    { tamperSealStatus: 'VERIFIED_BY_CUSTOMER', tamperSealCustAt: now },
      include: ORDER_INCLUDE,
    }),
    prisma.orderEvent.create({
      data: {
        orderId:     order.id,
        fromStatus:  order.status,
        toStatus:    order.status,  // FSM status unchanged — rider completes the delivery step
        actorUserId: req.user.id,
        actorRole:   'CUSTOMER',
        note:        'Delivery code verified by customer',
      },
    }),
  ]);

  res.json({ order: updated });
}));

// ─── GET / — admin: list orders by phone / status ────────────────────────────
// No JWT for now — used by internal admin dashboard.

router.get('/', asyncH(async (req, res) => {
  const { phone, status, limit } = req.query;
  const take  = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
  const where = {};
  if (phone) {
    if (!/^\d{10}$/.test(String(phone))) throw BadRequest('Invalid phone format');
    where.customerPhone = String(phone);
  }
  if (status) where.status = String(status).toUpperCase();
  const orders = await prisma.order.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take,
    include: ORDER_INCLUDE,
  });
  res.json({ orders });
}));

// ─── Admin: force status transition ──────────────────────────────────────────

const VALID_STATUSES = [
  'PLACED', 'CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP',
  'PICKED_UP', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'FAILED',
];

router.post('/:id/status', asyncH(async (req, res) => {
  const { status, note } = req.body || {};
  if (!VALID_STATUSES.includes(status)) {
    throw BadRequest(`Invalid status. Use one of: ${VALID_STATUSES.join(', ')}`);
  }
  const existing = await prisma.order.findFirst({
    where: { OR: [{ id: req.params.id }, { orderNumber: req.params.id }] },
  });
  if (!existing) throw NotFound('Order not found');

  const [order] = await prisma.$transaction([
    prisma.order.update({
      where:   { id: existing.id },
      data:    { status },
      include: ORDER_INCLUDE,
    }),
    prisma.orderEvent.create({
      data: {
        orderId:    existing.id,
        fromStatus: existing.status,
        toStatus:   status,
        actorRole:  'ADMIN',
        note:       typeof note === 'string' ? note.trim() || null : null,
      },
    }),
  ]);

  res.json({ order });
}));

// ─── Admin: mock rider assign ─────────────────────────────────────────────────

router.post('/:id/assign-rider', asyncH(async (req, res) => {
  const existing = await prisma.order.findFirst({
    where: { OR: [{ id: req.params.id }, { orderNumber: req.params.id }] },
  });
  if (!existing) throw NotFound('Order not found');
  const [order] = await prisma.$transaction([
    prisma.order.update({
      where:   { id: existing.id },
      data:    { status: 'PICKED_UP' },
      include: ORDER_INCLUDE,
    }),
    prisma.orderEvent.create({
      data: {
        orderId:    existing.id,
        fromStatus: existing.status,
        toStatus:   'PICKED_UP',
        actorRole:  'RIDER',
        note:       'Rider assigned (mock)',
      },
    }),
  ]);
  res.json({ order, assignedRider: 'Rajan (mock)' });
}));

module.exports = router;
