const express = require('express');
const prisma  = require('../prisma');
const { asyncH, BadRequest } = require('../error');

const router = express.Router();

const VEHICLE_TYPES = ['BIKE', 'SCOOTER', 'BICYCLE'];

// POST /api/v1/riders/apply
// body: { fullName, phone, vehicleType, location }
router.post('/apply', asyncH(async (req, res) => {
  const { fullName, phone, vehicleType, location } = req.body || {};
  if (typeof fullName !== 'string' || fullName.trim().length < 2) throw BadRequest('Invalid fullName');
  if (!/^\d{10}$/.test(String(phone || '')))                     throw BadRequest('Invalid 10-digit phone');
  if (!VEHICLE_TYPES.includes(vehicleType))                       throw BadRequest('Invalid vehicleType (BIKE|SCOOTER|BICYCLE)');
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

module.exports = router;
