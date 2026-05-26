// Quickrons — Socket.IO client singleton
//
// Usage:
//   import socketClient from '../lib/socket';
//
//   // Connect after login (token optional — backend rooms are currently open)
//   socketClient.connect();
//
//   // Join the room for a specific order
//   socketClient.joinOrder(orderId);
//
//   // Listen for events
//   socketClient.on('ORDER_CONFIRMED', handler);
//   socketClient.off('ORDER_CONFIRMED', handler);
//
//   // Disconnect on logout
//   socketClient.disconnect();

import { io } from 'socket.io-client';
import { API_BASE } from './api';

// Singleton socket reference
let socket = null;

const socketClient = {
  connect() {
    if (socket?.connected) return socket;

    socket = io(API_BASE, {
      // Polling can stall on React Native — WebSocket only.
      transports: ['websocket'],
      // Reconnect automatically if dropped.
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    socket.on('connect', () => {
      if (__DEV__) console.log('[socket] connected', socket.id);
    });

    socket.on('disconnect', (reason) => {
      if (__DEV__) console.log('[socket] disconnected', reason);
    });

    socket.on('connect_error', (err) => {
      if (__DEV__) console.warn('[socket] connect_error', err.message);
    });

    return socket;
  },

  disconnect() {
    if (socket) {
      socket.disconnect();
      socket = null;
    }
  },

  // Join the order-specific room so this client receives order status events.
  joinOrder(orderId) {
    if (!orderId) return;
    this._ensureConnected();
    socket.emit('join:order', { orderId });
  },

  // Join the customer's own channel (reserved for future use).
  joinCustomer(customerId) {
    if (!customerId) return;
    this._ensureConnected();
    socket.emit('join:customer', { customerId });
  },

  on(event, handler) {
    this._ensureConnected();
    socket.on(event, handler);
  },

  off(event, handler) {
    if (!socket) return;
    if (handler) {
      socket.off(event, handler);
    } else {
      socket.off(event);
    }
  },

  get connected() {
    return socket?.connected ?? false;
  },

  _ensureConnected() {
    if (!socket || !socket.connected) {
      this.connect();
    }
  },
};

export default socketClient;
