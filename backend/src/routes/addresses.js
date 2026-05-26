// Address routes — all require a valid JWT.
//
// GET    /api/v1/addresses                  → list active addresses for the caller
// POST   /api/v1/addresses                  → create a new address
// PATCH  /api/v1/addresses/:id              → update any field(s) of an owned address
// DELETE /api/v1/addresses/:id              → soft-delete (sets archivedAt)
// POST   /api/v1/addresses/:id/set-default  → make this address the user's default

const express = require('express');
const prisma  = require('../prisma');
const { asyncH, BadRequest, NotFound, Unauthorized } = require('../error');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// All routes in this file require auth.
router.use(verifyToken);

// ─── Helpers ──────────────────────────────────────────────────────────────────

const VALID_LABELS = ['HOME', 'WORK', 'OTHER'];

function validateAddressBody(body, { requireAll = false } = {}) {
  const {
    label, recipient, phone,
    line1, line2, landmark,
    city, district, pincode,
    zoneCode, lat, lng, notes,
  } = body || {};

  const data = {};
  const errors = [];

  // Required on create, optional on patch.
  if (requireAll || recipient !== undefined) {
    if (!recipient || typeof recipient !== 'string' || recipient.trim().length === 0) errors.push('recipient required');
    else data.recipient = recipient.trim();
  }
  if (requireAll || phone !== undefined) {
    if (!/^\d{10}$/.test(String(phone || ''))) errors.push('phone must be a 10-digit number');
    else data.phone = String(phone);
  }
  if (requireAll || line1 !== undefined) {
    if (!line1 || typeof line1 !== 'string' || line1.trim().length === 0) errors.push('line1 required');
    else data.line1 = line1.trim();
  }
  if (requireAll || city !== undefined) {
    if (!city || typeof city !== 'string' || city.trim().length === 0) errors.push('city required');
    else data.city = city.trim();
  }
  if (requireAll || district !== undefined) {
    if (!district || typeof district !== 'string' || district.trim().length === 0) errors.push('district required');
    else data.district = district.trim();
  }
  if (requireAll || pincode !== undefined) {
    if (!/^\d{6}$/.test(String(pincode || ''))) errors.push('pincode must be 6 digits');
    else data.pincode = String(pincode);
  }

  // Optional fields — accept whatever is sent.
  if (label !== undefined) {
    if (!VALID_LABELS.includes(label)) errors.push(`label must be one of: ${VALID_LABELS.join(', ')}`);
    else data.label = label;
  }
  if (line2    !== undefined) data.line2    = line2    ? String(line2).trim()    : null;
  if (landmark !== undefined) data.landmark = landmark ? String(landmark).trim() : null;
  if (zoneCode !== undefined) data.zoneCode = zoneCode ? String(zoneCode).trim() : null;
  if (notes    !== undefined) data.notes    = notes    ? String(notes).trim()    : null;

  if (lat !== undefined && lat !== null) {
    const n = parseFloat(lat);
    if (isNaN(n) || n < -90 || n > 90) errors.push('lat must be a valid latitude');
    else data.lat = n;
  }
  if (lng !== undefined && lng !== null) {
    const n = parseFloat(lng);
    if (isNaN(n) || n < -180 || n > 180) errors.push('lng must be a valid longitude');
    else data.lng = n;
  }

  if (errors.length > 0) throw BadRequest('Validation failed', errors);
  return data;
}

// Own-address guard — throws 404 if address not found or doesn't belong to caller.
async function ownAddress(userId, addressId) {
  const addr = await prisma.address.findFirst({
    where: { id: addressId, userId, archivedAt: null },
  });
  if (!addr) throw NotFound('Address not found');
  return addr;
}

// ─── GET / ────────────────────────────────────────────────────────────────────

router.get('/', asyncH(async (req, res) => {
  const addresses = await prisma.address.findMany({
    where:   { userId: req.user.id, archivedAt: null },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    select: {
      id:        true,
      label:     true,
      recipient: true,
      phone:     true,
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
      isDefault: true,
      createdAt: true,
    },
  });
  res.json({ addresses });
}));

// ─── POST / ───────────────────────────────────────────────────────────────────

router.post('/', asyncH(async (req, res) => {
  const data = validateAddressBody(req.body, { requireAll: true });

  // If this is the user's first address, make it default automatically.
  const existingCount = await prisma.address.count({
    where: { userId: req.user.id, archivedAt: null },
  });
  const makeDefault = existingCount === 0;

  const address = await prisma.address.create({
    data: {
      ...data,
      userId:    req.user.id,
      isDefault: makeDefault,
    },
  });

  // If making default, sync User.defaultAddressId.
  if (makeDefault) {
    await prisma.user.update({
      where: { id: req.user.id },
      data:  { defaultAddressId: address.id },
    });
  }

  res.status(201).json({ address });
}));

// ─── PATCH /:id ───────────────────────────────────────────────────────────────

router.patch('/:id', asyncH(async (req, res) => {
  await ownAddress(req.user.id, req.params.id);

  const data = validateAddressBody(req.body, { requireAll: false });
  if (Object.keys(data).length === 0) throw BadRequest('Nothing to update');

  const updated = await prisma.address.update({
    where: { id: req.params.id },
    data,
  });
  res.json({ address: updated });
}));

// ─── DELETE /:id ──────────────────────────────────────────────────────────────

router.delete('/:id', asyncH(async (req, res) => {
  const addr = await ownAddress(req.user.id, req.params.id);

  await prisma.address.update({
    where: { id: addr.id },
    data:  { archivedAt: new Date(), isDefault: false },
  });

  // If this was the default, clear User.defaultAddressId.
  if (addr.isDefault) {
    await prisma.user.update({
      where: { id: req.user.id },
      data:  { defaultAddressId: null },
    });
  }

  res.json({ ok: true });
}));

// ─── POST /:id/set-default ────────────────────────────────────────────────────

router.post('/:id/set-default', asyncH(async (req, res) => {
  await ownAddress(req.user.id, req.params.id);

  // Use a transaction: clear old default, set new one, update User pointer.
  await prisma.$transaction([
    // Clear all defaults for this user first.
    prisma.address.updateMany({
      where: { userId: req.user.id, isDefault: true },
      data:  { isDefault: false },
    }),
    // Set the new default.
    prisma.address.update({
      where: { id: req.params.id },
      data:  { isDefault: true },
    }),
    // Sync the User.defaultAddressId pointer.
    prisma.user.update({
      where: { id: req.user.id },
      data:  { defaultAddressId: req.params.id },
    }),
  ]);

  res.json({ ok: true, defaultAddressId: req.params.id });
}));

module.exports = router;
