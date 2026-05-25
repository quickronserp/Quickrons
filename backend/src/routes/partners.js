const express = require('express');
const prisma  = require('../prisma');
const { asyncH, BadRequest } = require('../error');

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

// GET /api/v1/partners/applications
router.get('/applications', asyncH(async (_req, res) => {
  const applications = await prisma.partnerApplication.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  res.json({ applications });
}));

module.exports = router;
