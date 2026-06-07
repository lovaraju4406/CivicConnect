/**
 * socket.ts — WebSocket client stub.
 * Wire to socket.io after backend is ready.
 * Currently a no-op to prevent import errors.
 */

// TODO: import { io } from "socket.io-client";
// TODO: export const socket = io(import.meta.env.VITE_SOCKET_URL || "http://localhost:3001");

export const socket = {
  on:   (_event: string, _cb: (...args: any[]) => void) => {},
  off:  (_event: string, _cb?: (...args: any[]) => void) => {},
  emit: (_event: string, ..._args: any[]) => {},
  connected: false,
};

export default socket;