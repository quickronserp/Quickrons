require('dotenv/config');

const express = require('express');
const cors    = require('cors');

const prisma  = require('./prisma');
const { notFoundHandler, errorHandler } = require('./error');

const authRoutes     = require('./routes/auth');
const menuRoutes     = require('./routes/menu');
const orderRoutes    = require('./routes/orders');
const riderRoutes    = require('./routes/riders');
const partnerRoutes  = require('./routes/partners');

const app = express();
app.use(cors());
app.use(express.json({ limit: '256kb' }));

// Health.
app.get('/health', async (_req, res) => {
  let db = 'down';
  try { await prisma.$queryRaw`SELECT 1`; db = 'up'; } catch {}
  res.json({ status: 'Quickrons backend live', db });
});

// API v1.
app.use('/api/v1/auth',     authRoutes);
app.use('/api/v1/menu',     menuRoutes);
app.use('/api/v1/orders',   orderRoutes);
app.use('/api/v1/riders',   riderRoutes);
app.use('/api/v1/partners', partnerRoutes);

// 404 + central error handler — always last.
app.use(notFoundHandler);
app.use(errorHandler);

const PORT = process.env.PORT || 8080;

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`[quickrons] backend on :${PORT}`);
});

// Graceful shutdown so Prisma drains.
const shutdown = async () => {
  console.log('[quickrons] shutting down…');
  server.close(() => process.exit(0));
  try { await prisma.$disconnect(); } catch {}
  setTimeout(() => process.exit(1), 10_000).unref();
};
process.on('SIGINT',  shutdown);
process.on('SIGTERM', shutdown);
