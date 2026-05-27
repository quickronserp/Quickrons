const express = require('express');
const prisma  = require('../prisma');
const { asyncH, BadRequest } = require('../error');

const router = express.Router();

const VEHICLE_TYPES = ['BIKE', 'SCOOTER', 'BICYCLE', 'EV_BIKE', 'AUTO', 'CAR'];

// POST /api/v1/riders/apply
// body: { fullName, phone, vehicleType, location }
router.post('/apply', asyncH(async (req, res) => {
  const { fullName, phone, vehicleType, location } = req.body || {};
  if (typeof fullName !== 'string' || fullName.trim().length < 2) throw BadRequest('Invalid fullName');
  if (!/^\d{10}$/.test(String(phone || '')))                     throw BadRequest('Invalid 10-digit phone');
  if (!VEHICLE_TYPES.includes(vehicleType))                       throw BadRequest('Invalid vehicleType (BIKE|SCOOTER|BICYCLE|EV_BIKE|AUTO|CAR)');
  if (typeof location !== 'string' || location.trim().length < 2) throw BadRequest('Invalid location');

  const app = await prisma.riderApplication.create({
    data: { fullName: fullName.trim(), phone, vehicleType, location: location.trim() },
  });
  res.status(201).json({ application: app });
}));

// GET /api/v1/riders/applications  (lightweight ops list)
router.get('/applications', asyncH(async (_req, res) => {
  const applications = await prisma.riderApplication.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  res.json({ applications });
}));

// POST /api/v1/riders/applications/:id/status  { status: APPROVED | REJECTED | PENDING }
router.post('/applications/:id/status', asyncH(async (req, res) => {
  const { status } = req.body || {};
  if (!['APPROVED', 'REJECTED', 'PENDING'].includes(status)) {
    throw BadRequest('Status must be APPROVED, REJECTED, or PENDING');
  }
  try {
    const application = await prisma.riderApplication.update({
      where: { id: req.params.id },
      data:  { status },
    });
    res.json({ application });
  } catch (e) {
    if (e.code === 'P2025') throw BadRequest('Rider application not found');
    throw e;
  }
}));

module.exports = router;
