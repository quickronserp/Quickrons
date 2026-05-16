'use client';
import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (socket) return socket;
  const token = typeof window !== 'undefined' ? localStorage.getItem('quickrons.adminToken') : null;
  socket = io(process.env.NEXT_PUBLIC_WS_BASE || 'http://localhost:4000', {
    auth: { token },
    transports: ['websocket'],
  });
  return socket;
}
