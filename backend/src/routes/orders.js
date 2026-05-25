const express = require('express');
const prisma  = require('../prisma');
const { asyncH, BadRequest, NotFound } = require('../error');
const { generateOrderNumber } = require('../utils/orderNumber');

const router = express.Router();

// POST /api/v1/orders
// body: { customerPhone, items: [{ menuItemId?, name, pricePaise, qty }] }
router.post('/', asyncH(async (req, res) => {
  const { customerPhone, items } = req.body || {};
  if (!/^\d{10}$/.test(String(customerPhone || ''))) throw BadRequest('Invalid customerPhone');
  if (!Array.isArray(items) || items.length === 0)   throw BadRequest('Order must have at least one item');

  // Server-side validate items + compute totals (never trust client total).
  let totalPaise = 0;
  let itemCount  = 0;
  const itemRows = [];
  for (const it of items) {
    if (!it.name || typeof it.name !== 'string')         throw BadRequest('Item missing name');
    if (!Number.isInteger(it.pricePaise) || it.pricePaise <= 0) throw BadRequest(`Bad price for "${it.name}"`);
    if (!Number.isInteger(it.qty) || it.qty <= 0)        throw BadRequest(`Bad qty for "${it.name}"`);
    const line = it.pricePaise * it.qty;
    totalPaise += line;
    itemCount  += it.qty;
    itemRows.push({
      menuItemId: typeof it.menuItemId === 'string' ? it.menuItemId : null,
      name:       it.name,
      pricePaise: it.pricePaise,
      qty:        it.qty,
    });
  }

  // Resolve optional customer.
  const customer = await prisma.user.findUnique({ where: { phone: customerPhone } });
  const orderNumber = await generateOrderNumber();

  const order = await prisma.order.create({
    data: {
      orderNumber,
      customerId:    customer ? customer.id : null,
      customerPhone,
      status:        'PLACED',
      totalPaise,
      itemCount,
      items: { create: itemRows },
    },
    include: { items: true },
  });

  res.status(201).json({ order });
}));

// GET /api/v1/orders/:id  → fetch by id OR by orderNumber
router.get('/:id', asyncH(async (req, res) => {
  const { id } = req.params;
  const order = await prisma.order.findFirst({
    where: { OR: [{ id }, { orderNumber: id }] },
    include: { items: true },
  });
  if (!order) throw NotFound('Order not found');
  res.json({ order });
}));

// GET /api/v1/orders?phone=9876543210  → recent orders for a phone
router.get('/', asyncH(async (req, res) => {
  const { phone } = req.query;
  if (!/^\d{10}$/.test(String(phone || ''))) throw BadRequest('phone query param required');
  const orders = await prisma.order.findMany({
    where: { customerPhone: String(phone) },
    orderBy: { createdAt: 'desc' },
    take: 20,
    include: { items: true },
  });
  res.json({ orders });
}));

module.exports = router;
