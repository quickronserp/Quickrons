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
const { verifyToken, requireRole } = require('../middleware/auth');
const { generateOrderNumber } = require('../utils/orderNumber');
const { resolveContact } = require('../lib/calling');
const {
  emitOrderPlaced,
  emitOrderCancelled,
} = require('../socket');

const router = express.Router();

// ─── Shared select shapes ─────────────────────────────────────────────────────

const ORDER_INCLUDE = {
  items: {
    orderBy: { name: 'asc' },
  },
  rider: {
    select: {
      id:            true,
      fullName:      true,
      vehicleType:   true,
      vehicleNumber: true,
      // NOTE: the rider's real phone is deliberately NOT included. The customer
      // reaches the rider via POST /orders/:id/contact (privacy-first calling),
      // never by reading the raw number from the order payload.
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
  // Present once the customer has rated — lets the app avoid re-prompting.
  rating: {
    select: {
      id:             true,
      foodRating:     true,
      deliveryRating: true,
      overallRating:  true,
      reviewText:     true,
      createdAt:      true,
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

// UPI is the MVP-safe online method: the customer pays out-of-band to the
// Quickrons UPI handle and enters the 12-digit UPI reference. We store the
// method + reference and leave paymentStatus PENDING until an operator (or, in
// a later sprint, a PSP webhook) confirms — we NEVER auto-mark UPI as paid.
const VALID_PAYMENT_METHODS = ['COD', 'UPI', 'RAZORPAY', 'WALLET'];

// ─── Fee schedule — SERVER-AUTHORITATIVE (paise) ─────────────────────────────
//
// The client computes the same numbers for display only (CartContext); the
// values persisted here are the single source of truth that partner, rider,
// admin and the customer's COD amount all read back from the Order row.
//
//   delivery  ₹39  flat
//   packaging ₹9   flat   (shown as "Platform fee" in the cart UI)
//   tax       5%   of subtotal (GST)
//
// total = subtotal + delivery + packaging + tax
const DELIVERY_FEE_PAISE  = 3900;
const PACKAGING_FEE_PAISE = 900;
const GST_RATE            = 0.05;

function computeFees(subtotalPaise) {
  const deliveryFeePaise  = DELIVERY_FEE_PAISE;
  const packagingFeePaise = PACKAGING_FEE_PAISE;
  const taxPaise          = Math.round(subtotalPaise * GST_RATE);
  const totalPaise        = subtotalPaise + deliveryFeePaise + packagingFeePaise + taxPaise;
  return { deliveryFeePaise, packagingFeePaise, taxPaise, totalPaise };
}

router.post('/', verifyToken, asyncH(async (req, res) => {
  const { items, addressId, paymentMethod = 'COD', paymentRef } = req.body || {};

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

  // UPI requires the customer to supply the reference shown by their UPI app.
  let cleanPaymentRef = null;
  if (paymentMethod === 'UPI') {
    if (typeof paymentRef !== 'string' || paymentRef.trim().length < 6) {
      throw BadRequest('For UPI, enter the payment reference / UTR shown in your UPI app (at least 6 characters)');
    }
    cleanPaymentRef = paymentRef.trim().slice(0, 40);
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

  // Server-authoritative fee + total computation (never trust client totals).
  const { deliveryFeePaise, packagingFeePaise, taxPaise, totalPaise } = computeFees(subtotalPaise);

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
        // Money — server-computed fees (see computeFees).
        subtotalPaise,
        deliveryFeePaise,
        packagingFeePaise,
        taxPaise,
        discountPaise:     0,
        totalPaise,
        itemCount,
        // Status.
        status:        'PLACED',
        // Payment. UPI/RAZORPAY stay PENDING until confirmed out-of-band —
        // we never trust the client to declare a payment captured.
        paymentMethod,
        paymentStatus: 'PENDING',
        paymentRefId:  cleanPaymentRef,
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

  emitOrderPlaced(order);
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

  emitOrderCancelled(updated);
  res.json({ order: updated });
}));

// ─── POST /:id/contact — privacy-safe rider ⇄ customer calling ───────────────
//
// Either party (the order's customer or its assigned rider) asks the server for
// a dialable target instead of reading the counterparty's raw number from any
// payload. The actual number is resolved server-side through lib/calling
// (provider-swappable: app-contact today, Twilio/Exotel masking later).
//
// Returns: { contact: { mode, dial, display, masked, expiresAt, notice } }
//
// Contactable only while the delivery is live (CONFIRMED … PICKED_UP). Once the
// order is DELIVERED/CANCELLED/FAILED the relationship is over → 400.

const CONTACTABLE_STATUSES = [
  'CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP', 'PICKED_UP', 'OUT_FOR_DELIVERY',
];

router.post('/:id/contact', verifyToken, asyncH(async (req, res) => {
  const order = await prisma.order.findFirst({
    where:  { OR: [{ id: req.params.id }, { orderNumber: req.params.id }] },
    select: {
      id: true, status: true, customerId: true, customerPhone: true, customerName: true,
      riderId: true,
      rider: { select: { fullName: true, user: { select: { phone: true } } } },
    },
  });
  if (!order) throw NotFound('Order not found');

  if (!CONTACTABLE_STATUSES.includes(order.status)) {
    throw BadRequest('Calling is only available while the delivery is in progress');
  }

  const role = req.user.role;
  let callerRole, peerRealPhone, peerName;

  if (role === 'CUSTOMER' || role === 'ADMIN') {
    // Customer (or admin acting on their behalf) calling the rider.
    if (role === 'CUSTOMER' && order.customerId !== req.user.id) {
      throw NotFound('Order not found');
    }
    if (!order.riderId || !order.rider) throw BadRequest('No rider is assigned to this order yet');
    callerRole    = 'CUSTOMER';
    peerRealPhone = order.rider.user?.phone || null;
    peerName      = order.rider.fullName || 'Rider';
  } else if (role === 'RIDER') {
    // Rider calling the customer. Authorisation: must be the assigned rider.
    const rider = await prisma.rider.findUnique({
      where: { userId: req.user.id }, select: { id: true },
    });
    if (!rider || rider.id !== order.riderId) throw NotFound('Order not found');
    callerRole    = 'RIDER';
    peerRealPhone = order.customerPhone || null;
    peerName      = order.customerName || 'Customer';
  } else {
    throw Unauthorized('Not allowed to contact on this order');
  }

  if (!peerRealPhone) throw BadRequest('No contact number is available for this party');

  const contact = await resolveContact({ order, callerRole, peerRealPhone, peerName });
  res.json({ contact });
}));

// ─── POST /:id/rating — customer rates a delivered order ─────────────────────
//
// Body: { foodRating, deliveryRating, overallRating?, reviewText? }   (1-5 ints)
//   overallRating defaults to round((food + delivery) / 2) when omitted.
//
// Rules:
//   • order must be DELIVERED
//   • caller must own the order (customerId === user, or phone match for guests)
//   • one rating per order (orderId is @unique → P2002 → 409)
//
// On success: creates the Rating and recomputes the denormalised aggregates —
// Partner.averageRating (avg foodRating) and Rider.averageRating (avg
// deliveryRating) + reviewCount — atomically in one interactive transaction.

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

function clampRating(v, field) {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1 || n > 5) {
    throw BadRequest(`${field} must be an integer from 1 to 5`);
  }
  return n;
}

router.post('/:id/rating', verifyToken, asyncH(async (req, res) => {
  const b = req.body || {};
  const foodRating     = clampRating(b.foodRating,     'foodRating');
  const deliveryRating = clampRating(b.deliveryRating, 'deliveryRating');
  const overallRating  = b.overallRating === undefined || b.overallRating === null
    ? Math.round((foodRating + deliveryRating) / 2)
    : clampRating(b.overallRating, 'overallRating');

  let reviewText = null;
  if (b.reviewText !== undefined && b.reviewText !== null && b.reviewText !== '') {
    if (typeof b.reviewText !== 'string') throw BadRequest('reviewText must be a string');
    reviewText = b.reviewText.trim().slice(0, 1000) || null;
  }

  const order = await prisma.order.findFirst({
    where:  { OR: [{ id: req.params.id }, { orderNumber: req.params.id }] },
    select: {
      id: true, status: true, customerId: true, customerPhone: true,
      partnerId: true, riderId: true,
    },
  });
  if (!order) throw NotFound('Order not found');

  // Ownership — customerId match, or phone match for guest-placed orders.
  const ownsById    = order.customerId && order.customerId === req.user.id;
  const ownsByPhone = !order.customerId && order.customerPhone === req.user.phone;
  if (!ownsById && !ownsByPhone) {
    throw NotFound('Order not found'); // don't reveal existence
  }

  if (order.status !== 'DELIVERED') {
    throw BadRequest('Only delivered orders can be rated');
  }

  // Friendly pre-check (the @unique index is the real guard against races).
  const existing = await prisma.rating.findUnique({
    where:  { orderId: order.id },
    select: { id: true },
  });
  if (existing) throw BadRequest('This order has already been rated');

  let created;
  try {
    created = await prisma.$transaction(async (tx) => {
      const rating = await tx.rating.create({
        data: {
          orderId:        order.id,
          customerId:     order.customerId,
          partnerId:      order.partnerId,
          riderId:        order.riderId,
          foodRating, deliveryRating, overallRating, reviewText,
        },
        select: {
          id: true, foodRating: true, deliveryRating: true,
          overallRating: true, reviewText: true, createdAt: true,
        },
      });

      // Partner aggregate ← avg foodRating.
      const pAgg = await tx.rating.aggregate({
        where: { partnerId: order.partnerId },
        _avg:  { foodRating: true },
        _count: { _all: true },
      });
      await tx.partner.update({
        where: { id: order.partnerId },
        data:  {
          averageRating: round2(pAgg._avg.foodRating),
          reviewCount:   pAgg._count._all,
        },
        select: { id: true },
      });

      // Rider aggregate ← avg deliveryRating (only when a rider delivered).
      if (order.riderId) {
        const rAgg = await tx.rating.aggregate({
          where: { riderId: order.riderId },
          _avg:  { deliveryRating: true },
          _count: { _all: true },
        });
        await tx.rider.update({
          where: { id: order.riderId },
          data:  {
            averageRating: round2(rAgg._avg.deliveryRating),
            reviewCount:   rAgg._count._all,
          },
          select: { id: true },
        });
      }

      return rating;
    }, { timeout: 15000 });
  } catch (err) {
    if (err.code === 'P2002') throw BadRequest('This order has already been rated');
    throw err;
  }

  res.status(201).json({ rating: created });
}));

// ─── GET / — admin: list orders by phone / status ────────────────────────────

router.get('/', verifyToken, requireRole('ADMIN'), asyncH(async (req, res) => {
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

router.post('/:id/status', verifyToken, requireRole('ADMIN'), asyncH(async (req, res) => {
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

module.exports = router;
