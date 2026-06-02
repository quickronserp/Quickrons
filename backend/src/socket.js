// Quickrons — Socket.IO realtime layer
//
// Architecture
// ────────────
// • Single module: initSocket(httpServer) creates the io instance.
// • All routes import named emit helpers from this file — they never
//   import `io` directly, keeping the socket dependency contained.
// • Rooms:
//     order:{orderId}     → customer, partner, rider, admin watching that order
//     partner:{partnerId} → partner's own dashboard
//     rider:{riderId}     → rider's own app
//
// Client join protocol (after connecting):
//     socket.emit('join:order',   { orderId })
//     socket.emit('join:partner', { partnerId })
//     socket.emit('join:rider',   { riderId })
//
// Events emitted (server → client):
//     ORDER_PLACED         payload: { orderId, orderNumber, partnerId, zoneCode, totalPaise, createdAt }
//     ORDER_CONFIRMED      payload: { orderId, orderNumber, estimatedReadyAt }
//     ORDER_PREPARING      payload: { orderId, orderNumber }
//     ORDER_READY          payload: { orderId, orderNumber }
//     RIDER_ASSIGNED       payload: { orderId, orderNumber, riderId, riderName }
//     ORDER_PICKED_UP      payload: { orderId, orderNumber, pickedUpAt }
//     ORDER_DELIVERED      payload: { orderId, orderNumber, deliveredAt }
//     ORDER_CANCELLED      payload: { orderId, orderNumber, cancelledBy, reason }

const { Server } = require('socket.io');

// Module-level singleton — initialised once by initSocket(), read by emit helpers.
let io = null;

// ─── Init ─────────────────────────────────────────────────────────────────────

/**
 * Attach a Socket.IO server to the existing Node http.Server.
 * Call once, immediately after app.listen().
 *
 * @param {import('http').Server} httpServer
 */
function initSocket(httpServer) {
  io = new Server(httpServer, {
    // Allow all origins in dev. Lock down via CORS_ORIGIN env in production.
    cors: {
      origin:  process.env.CORS_ORIGIN || '*',
      methods: ['GET', 'POST'],
    },
    // Prefer WebSocket; fall back to polling if the client needs it.
    transports: ['websocket', 'polling'],
  });

  io.on('connection', (socket) => {
    console.log(`[socket] connected   id=${socket.id} transport=${socket.conn.transport.name}`);

    // ── Room join handlers ─────────────────────────────────────────────────

    socket.on('join:order', ({ orderId } = {}) => {
      if (!orderId) return;
      const room = `order:${orderId}`;
      socket.join(room);
      console.log(`[socket] join         id=${socket.id} room=${room}`);
    });

    socket.on('join:partner', ({ partnerId } = {}) => {
      if (!partnerId) return;
      const room = `partner:${partnerId}`;
      socket.join(room);
      console.log(`[socket] join         id=${socket.id} room=${room}`);
    });

    socket.on('join:rider', ({ riderId } = {}) => {
      if (!riderId) return;
      const room = `rider:${riderId}`;
      socket.join(room);
      console.log(`[socket] join         id=${socket.id} room=${room}`);
    });

    socket.on('disconnect', (reason) => {
      console.log(`[socket] disconnected id=${socket.id} reason=${reason}`);
    });
  });

  console.log('[socket] Socket.IO attached to HTTP server');
  return io;
}

// ─── Internal broadcast helper ────────────────────────────────────────────────
//
// Emits to every room in the list. If io is not yet initialised (e.g. unit
// tests that don't call initSocket), the call is silently skipped rather than
// crashing the process.

function broadcast(rooms, event, payload) {
  if (!io) return;
  for (const room of rooms) {
    io.to(room).emit(event, payload);
  }
}

// ─── Emit helpers (called from route handlers) ────────────────────────────────
//
// Each helper targets the rooms that need to know about the event:
//   • order:{id}   — anyone watching this specific order (customer, ops)
//   • partner:{id} — the kitchen's dashboard
//   • rider:{id}   — the rider's app (only when a rider is involved)

function emitOrderPlaced(order) {
  broadcast(
    [`order:${order.id}`, `partner:${order.partnerId}`],
    'ORDER_PLACED',
    {
      orderId:     order.id,
      orderNumber: order.orderNumber,
      partnerId:   order.partnerId,
      zoneCode:    order.zoneCode,
      totalPaise:  order.totalPaise,
      itemCount:   order.itemCount,
      createdAt:   order.createdAt,
    },
  );
}

function emitOrderConfirmed(order) {
  broadcast(
    [`order:${order.id}`, `partner:${order.partnerId}`],
    'ORDER_CONFIRMED',
    {
      orderId:          order.id,
      orderNumber:      order.orderNumber,
      estimatedReadyAt: order.estimatedReadyAt ?? null,
    },
  );
}

function emitOrderPreparing(order) {
  broadcast(
    [`order:${order.id}`, `partner:${order.partnerId}`],
    'ORDER_PREPARING',
    {
      orderId:     order.id,
      orderNumber: order.orderNumber,
    },
  );
}

function emitOrderReady(order) {
  broadcast(
    [
      `order:${order.id}`,
      `partner:${order.partnerId}`,
      ...(order.riderId ? [`rider:${order.riderId}`] : []),
    ],
    'ORDER_READY',
    {
      orderId:     order.id,
      orderNumber: order.orderNumber,
    },
  );
}

function emitRiderAssigned(order) {
  broadcast(
    [
      `order:${order.id}`,
      `partner:${order.partnerId}`,
      `rider:${order.riderId}`,
    ],
    'RIDER_ASSIGNED',
    {
      orderId:     order.id,
      orderNumber: order.orderNumber,
      riderId:     order.riderId,
      riderName:   order.rider?.fullName ?? null,
    },
  );
}

function emitOrderPickedUp(order) {
  broadcast(
    [
      `order:${order.id}`,
      `partner:${order.partnerId}`,
      `rider:${order.riderId}`,
    ],
    'ORDER_PICKED_UP',
    {
      orderId:     order.id,
      orderNumber: order.orderNumber,
      pickedUpAt:  order.pickedUpAt ?? null,
    },
  );
}

function emitOrderDelivered(order) {
  broadcast(
    [
      `order:${order.id}`,
      `partner:${order.partnerId}`,
      `rider:${order.riderId}`,
    ],
    'ORDER_DELIVERED',
    {
      orderId:     order.id,
      orderNumber: order.orderNumber,
      deliveredAt: order.deliveredAt ?? null,
    },
  );
}

function emitOrderCancelled(order) {
  broadcast(
    [
      `order:${order.id}`,
      `partner:${order.partnerId}`,
      ...(order.riderId ? [`rider:${order.riderId}`] : []),
    ],
    'ORDER_CANCELLED',
    {
      orderId:     order.id,
      orderNumber: order.orderNumber,
      cancelledBy: order.cancelledBy  ?? null,
      reason:      order.cancelledReason ?? null,
    },
  );
}

module.exports = {
  initSocket,
  emitOrderPlaced,
  emitOrderConfirmed,
  emitOrderPreparing,
  emitOrderReady,
  emitRiderAssigned,
  emitOrderPickedUp,
  emitOrderDelivered,
  emitOrderCancelled,
};
