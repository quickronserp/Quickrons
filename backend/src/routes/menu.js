// Global menu routes — public, no auth required.
//
// GET /api/v1/menu           → paginated active items across all active kitchens
// GET /api/v1/menu/featured  → signature dishes across all active kitchens
//
// Query params:
//   q          — dish name search (contains, case-insensitive)
//   zone       — filter by kitchen's zoneCode slug
//   category   — dish category string (e.g. 'biryani', 'breakfast')
//   isVeg      — 'true' | 'false'
//   partnerId  — limit results to one kitchen
//   page       — 1-indexed, default 1
//   limit      — default 20, max 50
//
// NOTE: /featured must be declared before the implicit router root to avoid
// any future /:id-style conflicts if this file ever grows.

const express = require('express');
const prisma  = require('../prisma');
const { asyncH } = require('../error');

const router = express.Router();

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_LIMIT = 20;
const MAX_LIMIT     = 50;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parsePagination(query) {
  const page  = Math.max(1, parseInt(query.page  || '1',  10) || 1);
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, parseInt(query.limit || String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT),
  );
  return { page, limit, skip: (page - 1) * limit };
}

function parseBool(val) {
  if (val === 'true')  return true;
  if (val === 'false') return false;
  return undefined;
}

// MenuItem select — includes minimal kitchen context for cross-kitchen views.
const ITEM_SELECT = {
  id:                     true,
  partnerId:              true,
  name:                   true,
  description:            true,
  pricePaise:             true,
  isVeg:                  true,
  signature:              true,
  sortOrder:              true,
  category:               true,
  imageUrl:               true,
  dailyQuantityLimit:     true,
  dailyQuantityRemaining: true,
  servingStartMinutes:    true,
  servingEndMinutes:      true,
  partner: {
    select: { id: true, brand: true, zoneCode: true },
  },
};

// ─── GET /featured — signature dishes across all active kitchens ──────────────
// Declared first so Express doesn't confuse 'featured' with a dynamic segment.

router.get('/featured', asyncH(async (req, res) => {
  const { zone, isVeg: isVegRaw } = req.query;
  const { page, limit, skip }     = parsePagination(req.query);
  const isVeg                     = parseBool(isVegRaw);

  const partnerFilter = {
    isActive:  true,
    kycStatus: 'APPROVED',
    ...(zone && { zoneCode: zone }),
  };

  const where = {
    active:     true,
    archivedAt: null,
    signature:  true,
    partner:    partnerFilter,
    ...(isVeg !== undefined && { isVeg }),
  };

  const [total, items] = await prisma.$transaction([
    prisma.menuItem.count({ where }),
    prisma.menuItem.findMany({
      where,
      select:  ITEM_SELECT,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      skip,
      take:    limit,
    }),
  ]);

  res.json({
    items,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
}));

// ─── GET / — global active menu items ─────────────────────────────────────────

router.get('/', asyncH(async (req, res) => {
  const { q, zone, category, isVeg: isVegRaw, partnerId } = req.query;
  const { page, limit, skip } = parsePagination(req.query);
  const isVeg = parseBool(isVegRaw);

  const partnerFilter = {
    isActive:  true,
    kycStatus: 'APPROVED',
    ...(zone && { zoneCode: zone }),
  };

  const where = {
    active:     true,
    archivedAt: null,
    partner:    partnerFilter,
    ...(partnerId           && { partnerId }),
    ...(category            && { category }),
    ...(isVeg !== undefined && { isVeg }),
    ...(q                   && { name: { contains: q.trim(), mode: 'insensitive' } }),
  };

  const [total, items] = await prisma.$transaction([
    prisma.menuItem.count({ where }),
    prisma.menuItem.findMany({
      where,
      select:  ITEM_SELECT,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      skip,
      take:    limit,
    }),
  ]);

  res.json({
    items,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
}));

module.exports = router;
