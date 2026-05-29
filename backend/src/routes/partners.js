const express = require('express');
const prisma  = require('../prisma');
const { asyncH, BadRequest } = require('../error');
const { verifyToken, requireRole } = require('../middleware/auth');

const router = express.Router();

const CATEGORIES = ['HOME_COOK', 'RESTAURANT', 'CATERING', 'FORRA_SUPPLIER'];

// POST /api/v1/partners/apply
// body: { brand, ownerName, phone, category, location }
router.post('/apply', asyncH(async (req, res) => {
  const { brand, ownerName, phone, category, location } = req.body || {};
  if (typeof brand     !== 'string' || brand.trim().length     < 2) throw BadRequest('Invalid brand');
  if (typeof ownerName !== 'string' || ownerName.trim().length < 2) throw BadRequest('Invalid ownerName');
  if (!/^\d{10}$/.test(String(phone || '')))                       throw BadRequest('Invalid 10-digit phone');
  if (!CATEGORIES.includes(category))                               throw BadRequest('Invalid category');
  if (typeof location  !== 'string' || location.trim().length  < 2) throw BadRequest('Invalid location');

  const app = await prisma.partnerApplication.create({
    data: {
      brand:     brand.trim(),
      ownerName: ownerName.trim(),
      phone,
      category,
      location:  location.trim(),
    },
  });
  res.status(201).json({ application: app });
}));

// GET /api/v1/partners/applications  (admin only)
router.get('/applications', verifyToken, requireRole('ADMIN'), asyncH(async (_req, res) => {
  const applications = await prisma.partnerApplication.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  res.json({ applications });
}));

// POST /api/v1/partners/applications/:id/status  { status: APPROVED | REJECTED | PENDING }
router.post('/applications/:id/status', verifyToken, requireRole('ADMIN'), asyncH(async (req, res) => {
  const { status } = req.body || {};
  if (!['APPROVED', 'REJECTED', 'PENDING'].includes(status)) {
    throw BadRequest('Status must be APPROVED, REJECTED, or PENDING');
  }
  try {
    const application = await prisma.partnerApplication.update({
      where: { id: req.params.id },
      data:  { status },
    });
    res.json({ application });
  } catch (e) {
    if (e.code === 'P2025') throw BadRequest('Partner application not found');
    throw e;
  }
}));

module.exports = router;
