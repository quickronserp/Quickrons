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
const { uploadMw, storeImage, storageProvider } = require('../lib/upload');
const {
  emitOrderConfirmed,
  emitOrderPreparing,
  emitOrderReady,
  emitOrderSealed,
  emitOrderCancelled,
} = require('../socket');

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

// ─── GET /me — partner profile ───────────────────────────────────────────────
//
// Returns the partner profile that loadPartner already resolved.
// Used by the kitchen app to get the partner ID for socket room joins.

router.get('/me', asyncH(async (req, res) => {
  // req.partner is already populated by the loadPartner middleware above.
  // Augment with ownerName and category for a richer profile card.
  const detail = await prisma.partner.findUnique({
    where:  { id: req.partner.id },
    select: {
      id:          true,
      brand:       true,
      ownerName:   true,
      category:    true,
      zoneCode:    true,
      kycStatus:   true,
      isActive:    true,
      commissionBps: true,
    },
  });
  res.json({ partner: detail ?? req.partner });
}));

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
  emitOrderConfirmed(updated);
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
  emitOrderCancelled(updated);
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
  emitOrderPreparing(updated);
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
  emitOrderReady(updated);
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
  emitOrderSealed(updated);
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

// ─── Image upload ────────────────────────────────────────────────────────────
//
// POST /api/v1/partner/menu/upload  (multipart/form-data; field "file")
//
// Auth: PARTNER (already enforced above). Scoping: image is stored under the
// partner's own folder so two partners can never overwrite each other.
//
// Returns:
//   { url, provider, sizeBytes }   — clients save `url` into MenuItem.imageUrl
//
// Errors are explicit:
//   400 "No file uploaded"
//   400 "Unsupported file type"
//   400 "File too large"
//   500 if multer/cloudinary isn't installed (the lib/upload stub fires this)

router.post('/menu/upload', uploadMw, asyncH(async (req, res) => {
  // multer's fileFilter rejects unsupported MIME → fileFilter error surfaces here.
  if (!req.file) throw BadRequest('No file uploaded — send multipart with field "file"');

  const { buffer, mimetype, originalname } = req.file;

  let stored;
  try {
    stored = await storeImage({
      buffer,
      mimeType:   mimetype,
      ownerId:    req.partner.id,
      sourceName: originalname,
    });
  } catch (e) {
    // Convert storage errors into user-actionable 400s.
    throw BadRequest(e.message || 'Upload failed');
  }

  res.status(201).json({
    url:           stored.url,
    provider:      stored.provider,
    sizeBytes:     stored.sizeBytes,
    mimeType:      stored.mimeType,
    storageHint:   storageProvider,                  // 'cloudinary' | 'local'
  });
}));

// ─── Menu management (partner self-serve CRUD) ───────────────────────────────
//
// All routes scoped to req.partner.id via loadPartner middleware above —
// a partner can never see or modify another partner's menu.
//
// GET    /api/v1/partner/menu             → list own items (active + inactive)
// POST   /api/v1/partner/menu             → create
// PATCH  /api/v1/partner/menu/:id         → update (partial)
// DELETE /api/v1/partner/menu/:id         → soft delete (active=false)

const MENU_ITEM_SELECT = {
  id:                     true,
  name:                   true,
  description:            true,
  pricePaise:             true,
  isVeg:                  true,
  signature:              true,
  active:                 true,
  sortOrder:              true,
  category:               true,
  imageUrl:               true,
  dailyQuantityLimit:     true,
  dailyQuantityRemaining: true,
  servingStartMinutes:    true,
  servingEndMinutes:      true,
  createdAt:              true,
  updatedAt:              true,
};

// Field validators — return the cleaned value or throw BadRequest.
// Keep validation conservative; we only accept fields that exist in the schema.
function cleanString(v, field, { max = 200, allowEmpty = false } = {}) {
  if (typeof v !== 'string') throw BadRequest(`${field} must be a string`);
  const trimmed = v.trim();
  if (!allowEmpty && trimmed === '') throw BadRequest(`${field} cannot be empty`);
  if (trimmed.length > max) throw BadRequest(`${field} must be ${max} chars or fewer`);
  return trimmed;
}

function cleanInt(v, field, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const n = Number(v);
  if (!Number.isFinite(n) || !Number.isInteger(n)) throw BadRequest(`${field} must be an integer`);
  if (n < min || n > max) throw BadRequest(`${field} must be between ${min} and ${max}`);
  return n;
}

function cleanOptionalInt(v, field, opts) {
  if (v === null || v === undefined || v === '') return null;
  return cleanInt(v, field, opts);
}

function cleanOptionalString(v, field, opts) {
  if (v === null || v === undefined || v === '') return null;
  return cleanString(v, field, { ...opts, allowEmpty: false });
}

function cleanBool(v, field) {
  if (typeof v !== 'boolean') throw BadRequest(`${field} must be a boolean`);
  return v;
}

// GET /menu — list own items (newest first within active group)
router.get('/menu', asyncH(async (req, res) => {
  const items = await prisma.menuItem.findMany({
    where:   { partnerId: req.partner.id },
    orderBy: [{ active: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'desc' }],
    select:  MENU_ITEM_SELECT,
  });
  res.json({ items });
}));

// POST /menu — create a new item under this partner
router.post('/menu', asyncH(async (req, res) => {
  const b = req.body || {};

  // Required
  const name        = cleanString(b.name,        'name', { max: 120 });
  const description = cleanString(b.description, 'description', { max: 500 });
  const pricePaise  = cleanInt(b.pricePaise, 'pricePaise', { min: 0, max: 1_000_000_00 }); // ≤ ₹1Cr

  // Optional with sensible defaults
  const isVeg       = b.isVeg     === undefined ? true  : cleanBool(b.isVeg,     'isVeg');
  const signature   = b.signature === undefined ? false : cleanBool(b.signature, 'signature');
  const active      = b.active    === undefined ? true  : cleanBool(b.active,    'active');
  const sortOrder   = b.sortOrder === undefined ? 0     : cleanInt(b.sortOrder,  'sortOrder', { min: 0, max: 9999 });
  const category    = cleanOptionalString(b.category, 'category', { max: 60 });
  const imageUrl    = cleanOptionalString(b.imageUrl, 'imageUrl', { max: 500 });
  const dailyQuantityLimit = cleanOptionalInt(b.dailyQuantityLimit, 'dailyQuantityLimit', { min: 0, max: 10_000 });
  const servingStartMinutes = cleanOptionalInt(b.servingStartMinutes, 'servingStartMinutes', { min: 0, max: 24 * 60 - 1 });
  const servingEndMinutes   = cleanOptionalInt(b.servingEndMinutes,   'servingEndMinutes',   { min: 0, max: 24 * 60 - 1 });
  if (
    servingStartMinutes !== null && servingEndMinutes !== null &&
    servingStartMinutes >= servingEndMinutes
  ) {
    throw BadRequest('servingStartMinutes must be earlier than servingEndMinutes');
  }

  const item = await prisma.menuItem.create({
    data: {
      partnerId: req.partner.id,
      name, description, pricePaise,
      isVeg, signature, active, sortOrder,
      category, imageUrl,
      dailyQuantityLimit,
      dailyQuantityRemaining: dailyQuantityLimit, // start full
      servingStartMinutes, servingEndMinutes,
      lastResetAt: new Date(),
    },
    select: MENU_ITEM_SELECT,
  });
  res.status(201).json({ item });
}));

// PATCH /menu/:id — partial update on an item the partner owns
// Ownership is enforced by including partnerId in the update's where filter.
// Prisma throws P2025 if the row doesn't match → 404.
router.patch('/menu/:id', asyncH(async (req, res) => {
  const b = req.body || {};
  const data = {};

  if (b.name        !== undefined) data.name        = cleanString(b.name,        'name', { max: 120 });
  if (b.description !== undefined) data.description = cleanString(b.description, 'description', { max: 500 });
  if (b.pricePaise  !== undefined) data.pricePaise  = cleanInt(b.pricePaise,  'pricePaise', { min: 0, max: 1_000_000_00 });
  if (b.isVeg       !== undefined) data.isVeg       = cleanBool(b.isVeg,       'isVeg');
  if (b.signature   !== undefined) data.signature   = cleanBool(b.signature,   'signature');
  if (b.active      !== undefined) data.active      = cleanBool(b.active,      'active');
  if (b.sortOrder   !== undefined) data.sortOrder   = cleanInt(b.sortOrder,   'sortOrder', { min: 0, max: 9999 });
  if (b.category    !== undefined) data.category    = cleanOptionalString(b.category, 'category', { max: 60 });
  if (b.imageUrl    !== undefined) data.imageUrl    = cleanOptionalString(b.imageUrl, 'imageUrl', { max: 500 });
  if (b.dailyQuantityLimit !== undefined) {
    data.dailyQuantityLimit = cleanOptionalInt(b.dailyQuantityLimit, 'dailyQuantityLimit', { min: 0, max: 10_000 });
    // When the cap changes, reset "remaining" to the new cap so the kitchen
    // doesn't end up with remaining > limit. Partners adjusting the cap is
    // an explicit reset action by design.
    data.dailyQuantityRemaining = data.dailyQuantityLimit;
  }
  if (b.servingStartMinutes !== undefined) data.servingStartMinutes = cleanOptionalInt(b.servingStartMinutes, 'servingStartMinutes', { min: 0, max: 24 * 60 - 1 });
  if (b.servingEndMinutes   !== undefined) data.servingEndMinutes   = cleanOptionalInt(b.servingEndMinutes,   'servingEndMinutes',   { min: 0, max: 24 * 60 - 1 });

  if (Object.keys(data).length === 0) throw BadRequest('Provide at least one field to update');

  // Cross-field check after merge (load existing values if needed).
  if (data.servingStartMinutes !== undefined || data.servingEndMinutes !== undefined) {
    const cur = await prisma.menuItem.findFirst({
      where:  { id: req.params.id, partnerId: req.partner.id },
      select: { servingStartMinutes: true, servingEndMinutes: true },
    });
    if (!cur) throw NotFound('Menu item not found');
    const start = data.servingStartMinutes ?? cur.servingStartMinutes;
    const end   = data.servingEndMinutes   ?? cur.servingEndMinutes;
    if (start != null && end != null && start >= end) {
      throw BadRequest('servingStartMinutes must be earlier than servingEndMinutes');
    }
  }

  try {
    const item = await prisma.menuItem.update({
      where:  { id: req.params.id, partnerId: req.partner.id },
      data,
      select: MENU_ITEM_SELECT,
    });
    res.json({ item });
  } catch (err) {
    if (err.code === 'P2025') throw NotFound('Menu item not found');
    throw err;
  }
}));

// DELETE /menu/:id — soft delete (active=false). Hard delete is blocked by
// OrderItem foreign keys. Returns 200 with the updated row.
router.delete('/menu/:id', asyncH(async (req, res) => {
  try {
    const item = await prisma.menuItem.update({
      where:  { id: req.params.id, partnerId: req.partner.id },
      data:   { active: false },
      select: MENU_ITEM_SELECT,
    });
    res.json({ item });
  } catch (err) {
    if (err.code === 'P2025') throw NotFound('Menu item not found');
    throw err;
  }
}));

// ─── GET /wallet — partner's own wallet + last 20 transactions ───────────────
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
