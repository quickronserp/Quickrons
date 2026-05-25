const express = require('express');
const prisma  = require('../prisma');
const { asyncH } = require('../error');

const router = express.Router();

// GET /api/v1/menu  → list of active MenuItems for the frontend to render.
router.get('/', asyncH(async (_req, res) => {
  const items = await prisma.menuItem.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });
  res.json({ items });
}));

module.exports = router;
