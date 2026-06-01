// Rider dispatch routes.
// All routes require: valid JWT → RIDER role → active+approved Rider row.
//
// GET  /api/v1/rider/me                         → rider profile + isOnline status
// POST /api/v1/rider/me/online                  → toggle isOnline { isOnline: boolean }
// GET  /api/v1/rider/orders/available           → zone-scoped queue of READY_FOR_PICKUP orders
// POST /api/v1/rider/orders/:id/accept          → assigns riderId only (status stays READY_FOR_PICKUP)
// POST /api/v1/rider/orders/:id/picked-up       → READY_FOR_PICKUP → PICKED_UP
// POST /api/v1/rider/orders/:id/delivered       → PICKED_UP → DELIVERED
// GET  /api/v1/rider/me/orders                  → paginated history of own assigned orders
//
// FSM:  READY_FOR_PICKUP ──accept──▶ READY_FOR_PICKUP ──picked-up──▶ PICKED_UP ──delivered──▶ DELIVERED
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
const {
  emitRiderAssigned,
  emitOrderPickedUp,
  emitOrderDelivered,
} = require('../socket');

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

// ─── GET /me — rider profile ──────────────────────────────────────────────────
//
// Returns { rider } with profile fields + isOnline status.

router.get('/me', asyncH(async (req, res) => {
  const rider = await prisma.rider.findUnique({
    where:  { userId: req.user.id },
    select: {
      id:            true,
      fullName:      true,
      vehicleType:   true,
      vehicleNumber: true,
      zoneCode:      true,
      isOnline:      true,
      isActive:      true,
      kycStatus:     true,
      createdAt:     true,
    },
  });
  res.json({ rider });
}));

// ─── POST /me/online — toggle online status ────────────────────────────────────
//
// Body: { isOnline: boolean }
// Sets the rider's isOnline flag. Offline riders do not appear in the dispatch queue.

router.post('/me/online', asyncH(async (req, res) => {
  const { isOnline } = req.body || {};
  if (typeof isOnline !== 'boolean') {
    throw BadRequest('isOnline must be a boolean');
  }

  const rider = await prisma.rider.update({
    where:  { userId: req.user.id },
    data:   { isOnline, lastPingAt: new Date() },
    select: {
      id:          true,
      fullName:    true,
      vehicleType: true,
      zoneCode:    true,
      isOnline:    true,
    },
  });
  res.json({ rider });
}));

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

// ─── POST /orders/:id/accept — assign rider (status stays READY_FOR_PICKUP) ───
//
// Assigns this rider to the order WITHOUT advancing the FSM status.
// Status advances to OUT_FOR_DELIVERY only after the rider verifies the tamper
// seal (/verify-seal), keeping the physical chain intact.
//
// Race-safe: atomic update().where({ status: READY_FOR_PICKUP, riderId: null })
// so only one rider can claim the order. P2025 → clear 400.

router.post('/orders/:id/accept', asyncH(async (req, res) => {
  if (!req.rider.isOnline) {
    throw BadRequest('You must be online to accept deliveries');
  }

  // Confirm order exists in this zone (prevents cross-zone guessing).
  const exists = await prisma.order.findFirst({
    where:  { id: req.params.id, zoneCode: req.rider.zoneCode },
    select: { id: true, status: true, riderId: true },
  });
  if (!exists) throw NotFound('Order not found');

  if (exists.status !== 'READY_FOR_PICKUP') {
    throw BadRequest(
      `Order is "${exists.status}" — only READY_FOR_PICKUP orders can be accepted`,
    );
  }
  if (exists.riderId !== null) {
    throw BadRequest('Order has already been accepted by another rider');
  }

  // Atomic claim — assigns riderId only, status stays READY_FOR_PICKUP.
  // The loser of the race gets P2025 → graceful 400.
  let accepted;
  try {
    accepted = await prisma.order.update({
      where:  { id: req.params.id, status: 'READY_FOR_PICKUP', riderId: null },
      data:   { riderId: req.rider.id },   // ← status NOT changed here
      select: { id: true },
    });
  } catch (err) {
    if (err.code === 'P2025') {
      throw BadRequest('Order was just accepted by another rider — please try the next one');
    }
    throw err;
  }

  await prisma.$transaction([
    prisma.orderEvent.create({
      data: {
        orderId:     accepted.id,
        fromStatus:  'READY_FOR_PICKUP',
        toStatus:    'READY_FOR_PICKUP',   // status unchanged — rider assigned, not yet verified
        actorUserId: req.user.id,
        actorRole:   'RIDER',
        note:        `Accepted by rider ${req.rider.fullName} — awaiting pickup code verification`,
      },
    }),
  ], { timeout: 15000 });

  const order = await fetchFullOrder(accepted.id);
  emitRiderAssigned(order);
  res.json({ order });
}));

// ─── POST /orders/:id/picked-up — READY_FOR_PICKUP → PICKED_UP ──────────────
//
// Body: { code: '5831' }  ← 4-digit Pickup Code shown on the partner screen
//
// Rider enters the Pickup Code the partner reads from their app.
// Backend validates, then generates the Delivery OTP (shown to customer).
// Flow: READY_FOR_PICKUP → PICKED_UP + deliveryOtp set on order.

router.post('/orders/:id/picked-up', asyncH(async (req, res) => {
  const { code } = req.body || {};
  if (typeof code !== 'string' || !/^\d{4}$/.test(code.trim())) {
    throw BadRequest('code must be the 4-digit pickup code shown on the partner screen');
  }

  const order = await prisma.order.findFirst({
    where:  { id: req.params.id, riderId: req.rider.id },
    select: { id: true, status: true, tamperSealCode: true },
  });
  if (!order) throw NotFound('Order not found');
  assertTransition(order.status, ['READY_FOR_PICKUP'], 'PICKED_UP');

  if (!order.tamperSealCode || order.tamperSealCode !== code.trim()) {
    throw BadRequest('Pickup code does not match — check with the partner');
  }

  // Generate delivery OTP now — only created after pickup is verified.
  const deliveryOtp = String(Math.floor(Math.random() * 10_000)).padStart(4, '0');

  const now = new Date();
  await prisma.$transaction([
    prisma.order.update({
      where:  { id: order.id },
      data:   { status: 'PICKED_UP', pickedUpAt: now, deliveryOtp },
      select: { id: true },
    }),
    prisma.orderEvent.create({
      data: {
        orderId:     order.id,
        fromStatus:  'READY_FOR_PICKUP',
        toStatus:    'PICKED_UP',
        actorUserId: req.user.id,
        actorRole:   'RIDER',
        note:        'Pickup code verified — order collected from kitchen',
      },
    }),
  ], { timeout: 15000 });

  const updated = await fetchFullOrder(order.id);
  emitOrderPickedUp(updated);
  res.json({ order: updated });
}));

// ─── POST /orders/:id/delivered — PICKED_UP → DELIVERED ──────────────────────
//
// Body: { code: '0073' }  ← 4-digit Delivery OTP the customer reads from their app
//
// Rider enters the OTP the customer sees on their TrackingScreen.
// Backend validates it matches the deliveryOtp generated at PICKED_UP.
// On success: marks DELIVERED + wallet settlement.
//
// Wallet settlement (atomic, idempotent):
//   • Partner receives: totalPaise - commission (commission = totalPaise × commissionBps / 10000)
//   • Rider receives:   3000 paise fixed (MVP flat rate)
//   • Idempotency keys prevent double-credit on retry
//   • Wallets are upserted (get-or-create) so first delivery auto-creates wallet

const RIDER_FLAT_PAISE = 3000n; // flat delivery fee until earnings model is finalised

router.post('/orders/:id/delivered', asyncH(async (req, res) => {
  const { code } = req.body || {};
  if (typeof code !== 'string' || !/^\d{4}$/.test(code.trim())) {
    throw BadRequest('code must be the 4-digit delivery OTP shown to the customer');
  }

  // Load the order plus partner commission rate — needed for settlement math.
  const order = await prisma.order.findFirst({
    where:  { id: req.params.id, riderId: req.rider.id },
    select: {
      id:            true,
      status:        true,
      paymentMethod: true,
      totalPaise:    true,
      partnerId:     true,
      deliveryOtp:   true,
      partner: { select: { commissionBps: true } },
    },
  });
  if (!order) throw NotFound('Order not found');
  assertTransition(order.status, ['PICKED_UP'], 'DELIVERED');

  if (!order.deliveryOtp || order.deliveryOtp !== code.trim()) {
    throw BadRequest('Delivery OTP does not match — ask the customer to re-read the code');
  }

  const now = new Date();

  // ── Settlement math ────────────────────────────────────────────────────────
  const totalPaise      = BigInt(order.totalPaise);
  const commissionBps   = BigInt(order.partner.commissionBps);
  const commissionPaise = totalPaise * commissionBps / 10000n;
  const partnerPayout   = totalPaise - commissionPaise;
  const riderPayout     = RIDER_FLAT_PAISE;

  // Idempotency keys — unique per order so retries are no-ops.
  const partnerIdemKey = `settlement:partner:${order.id}`;
  const riderIdemKey   = `settlement:rider:${order.id}`;

  // COD: mark payment as captured (cash received at door).
  const paymentUpdate = order.paymentMethod === 'COD'
    ? { paymentStatus: 'CAPTURED' }
    : {};

  // ── Upsert wallets outside the transaction (get-or-create) ────────────────
  // Using upsert here is safe: if wallets already exist the update: {} is a no-op.
  // We do this outside the transaction to keep the tx short (no SELECT + INSERT
  // branching logic inside an open tx).
  const [partnerWallet, riderWallet] = await Promise.all([
    prisma.wallet.upsert({
      where:  { partnerId: order.partnerId },
      create: {
        ownerType:           'PARTNER',
        partnerId:           order.partnerId,
        balancePaise:        0n,
        holdPaise:           0n,
        lifetimeCreditPaise: 0n,
        lifetimeDebitPaise:  0n,
      },
      update: {},
      select: { id: true, balancePaise: true },
    }),
    prisma.wallet.upsert({
      where:  { riderId: req.rider.id },
      create: {
        ownerType:           'RIDER',
        riderId:             req.rider.id,
        balancePaise:        0n,
        holdPaise:           0n,
        lifetimeCreditPaise: 0n,
        lifetimeDebitPaise:  0n,
      },
      update: {},
      select: { id: true, balancePaise: true },
    }),
  ]);

  // Compute balance-after for the ledger snapshots.
  const partnerBalanceAfter = partnerWallet.balancePaise + partnerPayout;
  const riderBalanceAfter   = riderWallet.balancePaise   + riderPayout;

  // ── Atomic 6-op transaction ────────────────────────────────────────────────
  // Op 1: mark order delivered
  // Op 2: order event
  // Op 3: partner WalletTransaction ledger entry
  // Op 4: partner Wallet balance increment
  // Op 5: rider  WalletTransaction ledger entry
  // Op 6: rider  Wallet balance increment
  //
  // If idempotencyKey P2002 fires (duplicate key), we catch it and return the
  // already-settled order — the delivery happened, just the wallet write was
  // already done on a prior call.
  try {
    await prisma.$transaction([
      // 1. Order status
      prisma.order.update({
        where:  { id: order.id },
        data:   { status: 'DELIVERED', deliveredAt: now, ...paymentUpdate },
        select: { id: true },
      }),
      // 2. Order event
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
      // 3. Partner ledger entry
      prisma.walletTransaction.create({
        data: {
          walletId:         partnerWallet.id,
          direction:        'CREDIT',
          kind:             'ORDER_PAYOUT',
          amountPaise:      partnerPayout,
          balanceAfterPaise: partnerBalanceAfter,
          idempotencyKey:   partnerIdemKey,
          orderId:          order.id,
          note:             `Order payout (commission ${order.partner.commissionBps}bps deducted)`,
        },
        select: { id: true },
      }),
      // 4. Partner wallet balance
      prisma.wallet.update({
        where: { id: partnerWallet.id },
        data:  {
          balancePaise:        { increment: partnerPayout },
          lifetimeCreditPaise: { increment: partnerPayout },
        },
        select: { id: true },
      }),
      // 5. Rider ledger entry
      prisma.walletTransaction.create({
        data: {
          walletId:         riderWallet.id,
          direction:        'CREDIT',
          kind:             'ORDER_PAYOUT',
          amountPaise:      riderPayout,
          balanceAfterPaise: riderBalanceAfter,
          idempotencyKey:   riderIdemKey,
          orderId:          order.id,
          note:             'Delivery fee',
        },
        select: { id: true },
      }),
      // 6. Rider wallet balance
      prisma.wallet.update({
        where: { id: riderWallet.id },
        data:  {
          balancePaise:        { increment: riderPayout },
          lifetimeCreditPaise: { increment: riderPayout },
        },
        select: { id: true },
      }),
    ], { timeout: 15000 });
  } catch (err) {
    // P2002 = unique constraint violation on idempotencyKey.
    // Settlement already ran on a previous call — safe to continue and return
    // the current order state (delivery succeeded, no double-credit).
    if (err.code !== 'P2002') throw err;
  }

  const updated = await fetchFullOrder(order.id);
  emitOrderDelivered(updated);
  res.json({ order: updated });
}));

// ─── GET /wallet — rider's own wallet + last 20 transactions ─────────────────
//
// Returns { wallet: null } if the rider has never had a delivery settled yet.
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
    where: { riderId: req.rider.id },
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
        id:              true,
        orderNumber:     true,
        status:          true,
        customerName:    true,
        itemCount:       true,
        totalPaise:      true,
        paymentMethod:   true,
        paymentStatus:   true,
        addrLine1:       true,
        addrCity:        true,
        addrPincode:     true,
        tamperSealCode:  true,   // pickup code (not shown to rider in UI)
        deliveryOtp:     true,   // delivery OTP (not shown to rider in UI — rider enters, doesn't see)
        pickedUpAt:      true,
        deliveredAt:     true,
        createdAt:       true,
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
