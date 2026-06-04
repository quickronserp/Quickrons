// Kitchen (partner) browse routes — public, no auth required.
//
// GET /api/v1/kitchens                → paginated list of active kitchens
// GET /api/v1/kitchens/:id            → kitchen detail + 8-item menu preview
// GET /api/v1/kitchens/:id/menu       → full active menu, grouped by category
// GET /api/v1/kitchens/:id/featured   → signature dishes for a kitchen
//
// Common query params:
//   q        — search (kitchen name / dish name), contains, case-insensitive
//   zone     — zoneCode slug e.g. 'perinthalmanna'
//   category — PartnerCategory enum (feed) or dish category string (menu)
//   isVeg    — 'true' | 'false'  (menu + featured only)
//   page     — 1-indexed, default 1
//   limit    — default 20, max 50

const express = require('express');
const prisma  = require('../prisma');
const { asyncH, NotFound, BadRequest } = require('../error');

const router = express.Router();

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_LIMIT = 20;
const MAX_LIMIT     = 50;

const VALID_PARTNER_CATEGORIES = ['HOME_MAKER', 'RESTAURANT', 'CATERER', 'FORRA_SUPPLIER'];

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

// Fields exposed publicly for a Partner — never expose financial / internal columns.
const KITCHEN_PUBLIC_SELECT = {
  id:        true,
  brand:     true,
  ownerName: true,
  category:  true,
  isActive:  true,
  zoneCode:  true,
  createdAt: true,
  // Storefront branding (Phase 1 image system) — safe to expose publicly.
  profileImageUrl: true,
  bannerImageUrl:  true,
  galleryUrls:     true,
  tagline:         true,
  zone: {
    select: { code: true, nameEn: true, nameMl: true, district: true },
  },
};

// Fields exposed publicly for a MenuItem.
const ITEM_PUBLIC_SELECT = {
  id:                     true,
  partnerId:              true,
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
};

// Base where-clause that every kitchen query must include.
const KITCHEN_BASE_WHERE = { isActive: true, kycStatus: 'APPROVED' };

// ─── GET / — kitchens feed ────────────────────────────────────────────────────
//
// Filters: q (brand name), zone, category
// Sorted by brand name ascending.

router.get('/', asyncH(async (req, res) => {
  const { q, zone, category } = req.query;
  const { page, limit, skip } = parsePagination(req.query);

  if (category && !VALID_PARTNER_CATEGORIES.includes(category)) {
    throw BadRequest(`category must be one of: ${VALID_PARTNER_CATEGORIES.join(', ')}`);
  }

  const where = {
    ...KITCHEN_BASE_WHERE,
    ...(zone     && { zoneCode: zone }),
    ...(category && { category }),
    ...(q        && { brand: { contains: q.trim(), mode: 'insensitive' } }),
  };

  const [total, kitchens] = await prisma.$transaction([
    prisma.partner.count({ where }),
    prisma.partner.findMany({
      where,
      select:  KITCHEN_PUBLIC_SELECT,
      orderBy: { brand: 'asc' },
      skip,
      take:    limit,
    }),
  ]);

  res.json({
    kitchens,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
}));

// ─── GET /:id — kitchen detail ────────────────────────────────────────────────
//
// Returns kitchen + 8-item menu preview + total active item count.
// Use GET /:id/menu for the full paginated menu.

router.get('/:id', asyncH(async (req, res) => {
  const [kitchen, menuItemCount] = await prisma.$transaction([
    prisma.partner.findFirst({
      where:  { id: req.params.id, ...KITCHEN_BASE_WHERE },
      select: {
        ...KITCHEN_PUBLIC_SELECT,
        menuItems: {
          where:   { active: true },
          select:  ITEM_PUBLIC_SELECT,
          orderBy: [{ signature: 'desc' }, { sortOrder: 'asc' }],
          take:    8,
        },
      },
    }),
    prisma.menuItem.count({
      where: { partnerId: req.params.id, active: true },
    }),
  ]);

  if (!kitchen) throw NotFound('Kitchen not found');

  const { menuItems: menuPreview, ...kitchenFields } = kitchen;
  res.json({
    kitchen: {
      ...kitchenFields,
      menuPreview,
      menuItemCount,
    },
  });
}));

// ─── GET /:id/menu — full paginated menu, grouped by category ─────────────────
//
// Filters: q (dish name), isVeg, category (dish category string)
// Response includes both flat `items` array and `grouped` object for easy rendering.

router.get('/:id/menu', asyncH(async (req, res) => {
  const { q, category, isVeg: isVegRaw } = req.query;
  const { page, limit, skip }            = parsePagination(req.query);
  const isVeg                            = parseBool(isVegRaw);

  // Confirm kitchen exists and is active.
  const kitchen = await prisma.partner.findFirst({
    where:  { id: req.params.id, ...KITCHEN_BASE_WHERE },
    select: { id: true, brand: true, zoneCode: true },
  });
  if (!kitchen) throw NotFound('Kitchen not found');

  const where = {
    partnerId: req.params.id,
    active:    true,
    ...(category            && { category }),
    ...(isVeg !== undefined && { isVeg }),
    ...(q                   && { name: { contains: q.trim(), mode: 'insensitive' } }),
  };

  const [total, items] = await prisma.$transaction([
    prisma.menuItem.count({ where }),
    prisma.menuItem.findMany({
      where,
      select:  ITEM_PUBLIC_SELECT,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      skip,
      take:    limit,
    }),
  ]);

  // Group by dish category for renderer convenience.
  const grouped = {};
  for (const item of items) {
    const key = item.category || 'Other';
    (grouped[key] = grouped[key] || []).push(item);
  }

  res.json({
    kitchen: { id: kitchen.id, brand: kitchen.brand, zoneCode: kitchen.zoneCode },
    items,
    grouped,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
}));

// ─── GET /:id/featured — signature dishes for one kitchen ────────────────────
//
// Filters: isVeg
// No pagination (signature items are few; max ~10 expected per kitchen).

router.get('/:id/featured', asyncH(async (req, res) => {
  const { isVeg: isVegRaw } = req.query;
  const isVeg               = parseBool(isVegRaw);

  const kitchen = await prisma.partner.findFirst({
    where:  { id: req.params.id, ...KITCHEN_BASE_WHERE },
    select: { id: true, brand: true, zoneCode: true },
  });
  if (!kitchen) throw NotFound('Kitchen not found');

  const where = {
    partnerId: req.params.id,
    active:    true,
    signature: true,
    ...(isVeg !== undefined && { isVeg }),
  };

  const items = await prisma.menuItem.findMany({
    where,
    select:  ITEM_PUBLIC_SELECT,
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });

  res.json({
    kitchen: { id: kitchen.id, brand: kitchen.brand, zoneCode: kitchen.zoneCode },
    items,
  });
}));

module.exports = router;
