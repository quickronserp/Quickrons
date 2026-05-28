require('dotenv/config');

const path    = require('path');
const express = require('express');
const cors    = require('cors');

const prisma  = require('./prisma');
const { notFoundHandler, errorHandler } = require('./error');

const authRoutes      = require('./routes/auth');
const menuRoutes      = require('./routes/menu');
const orderRoutes     = require('./routes/orders');
const riderRoutes     = require('./routes/riders');
const partnerRoutes   = require('./routes/partners');
const customerRoutes  = require('./routes/customers');
const addressRoutes   = require('./routes/addresses');
const kitchenRoutes   = require('./routes/kitchens');
const partnerPortal   = require('./routes/partner');
const riderPortal     = require('./routes/rider');
const adminRoutes     = require('./routes/admin');
const { initSocket }  = require('./socket');

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json({ limit: '256kb' }));

// Health.
app.get('/health', async (_req, res) => {
  let db = 'down';
  try { await prisma.$queryRaw`SELECT 1`; db = 'up'; } catch {}
  res.json({ status: 'Quickrons backend live', db });
});

// API v1.
app.use('/api/v1/auth',      authRoutes);
app.use('/api/v1/menu',      menuRoutes);
app.use('/api/v1/orders',    orderRoutes);
app.use('/api/v1/riders',    riderRoutes);
app.use('/api/v1/partners',  partnerRoutes);
app.use('/api/v1/customers', customerRoutes);
app.use('/api/v1/addresses', addressRoutes);
app.use('/api/v1/kitchens',  kitchenRoutes);
app.use('/api/v1/partner',   partnerPortal);
app.use('/api/v1/rider',     riderPortal);
app.use('/api/v1/admin',     adminRoutes);

// Admin dashboard (single static HTML file served from backend/admin/).
app.use('/admin', express.static(path.join(__dirname, '..', 'admin')));

// Local-disk uploads (partner menu photos when CLOUDINARY_URL is not set).
// Served with permissive caching — these files are content-addressed by random
// filename, so they're effectively immutable. On Cloudinary deployments this
// static mount is harmless (no files land in ./uploads).
app.use(
  '/uploads',
  express.static(path.join(__dirname, '..', 'uploads'), {
    maxAge: '7d',
    fallthrough: true,
  }),
);

// 404 + central error handler — always last.
app.use(notFoundHandler);
app.use(errorHandler);

const PORT = process.env.PORT || 8080;

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`[quickrons] backend on :${PORT}`);
});

// Attach Socket.IO to the same HTTP server — no extra port needed.
initSocket(server);

// Graceful shutdown so Prisma drains.
const shutdown = async () => {
  console.log('[quickrons] shutting down…');
  server.close(() => process.exit(0));
  try { await prisma.$disconnect(); } catch {}
  setTimeout(() => process.exit(1), 10_000).unref();
};
process.on('SIGINT',  shutdown);
process.on('SIGTERM', shutdown);
