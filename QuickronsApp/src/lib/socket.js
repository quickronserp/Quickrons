// Quickrons — Socket.IO client singleton
//
// Usage:
//   import socketClient from '../lib/socket';
//
//   socketClient.connect();
//   socketClient.joinOrder(orderId);
//   socketClient.on('ORDER_CONFIRMED', handler);
//   socketClient.off('ORDER_CONFIRMED', handler);
//   socketClient.disconnect();

import { io } from 'socket.io-client';
import { API_BASE } from './api';

// Singleton socket reference
let socket = null;

// Track joined rooms so we can re-emit them after a reconnect.
// Set<string> — values are the raw room strings ('order:X', 'partner:Y', 'rider:Z')
const joinedRooms = new Set();

const socketClient = {
  connect() {
    if (socket?.connected) return socket;

    // Reuse the existing instance on transient disconnects to avoid leaking
    // event listeners from callers that registered via socketClient.on().
    if (socket && !socket.connected) {
      socket.connect();
      return socket;
    }

    socket = io(API_BASE, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 8,
      reconnectionDelay: 1500,
      reconnectionDelayMax: 10000,
    });

    const isDev = typeof __DEV__ !== 'undefined' && __DEV__;

    socket.on('connect', () => {
      if (isDev) console.log('[socket] connected', socket.id);

      // Re-join every tracked room after a reconnect so server push events
      // keep flowing without the caller having to re-call joinX().
      if (joinedRooms.size > 0) {
        joinedRooms.forEach(room => {
          const [type, id] = room.split(':');
          if (type && id) {
            socket.emit(`join:${type}`, { [`${type}Id`]: id });
            if (isDev) console.log('[socket] re-joined', room);
          }
        });
      }
    });

    socket.on('disconnect', (reason) => {
      if (isDev) console.log('[socket] disconnected', reason);
    });

    socket.on('connect_error', (err) => {
      if (isDev) console.warn('[socket] connect_error', err.message);
    });

    return socket;
  },

  disconnect() {
    if (socket) {
      socket.disconnect();
      socket = null;
    }
    joinedRooms.clear();
  },

  joinOrder(orderId) {
    if (!orderId) return;
    this._ensureConnected();
    const room = `order:${orderId}`;
    joinedRooms.add(room);
    socket.emit('join:order', { orderId });
  },

  joinCustomer(customerId) {
    if (!customerId) return;
    this._ensureConnected();
    const room = `customer:${customerId}`;
    joinedRooms.add(room);
    socket.emit('join:customer', { customerId });
  },

  joinPartner(partnerId) {
    if (!partnerId) return;
    this._ensureConnected();
    const room = `partner:${partnerId}`;
    joinedRooms.add(room);
    socket.emit('join:partner', { partnerId });
  },

  joinRider(riderId) {
    if (!riderId) return;
    this._ensureConnected();
    const room = `rider:${riderId}`;
    joinedRooms.add(room);
    socket.emit('join:rider', { riderId });
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
