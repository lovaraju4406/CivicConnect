/**
 * useRealtime — Socket.io real-time updates
 */
import { useEffect, useRef } from "react";

const SOCKET_URL = (import.meta as any).env?.VITE_SOCKET_URL ?? "http://localhost:3001";

interface Options {
  onNewComplaint?:  (c: any)    => void;
  onStatusUpdate?:  (id: string, status: string) => void;
  onNotification?:  (n: any)    => void;
}

export function useRealtime({ onNewComplaint, onStatusUpdate, onNotification }: Options = {}) {
  const socketRef = useRef<any>(null);

  useEffect(() => {
    // Dynamically import socket.io-client to avoid SSR issues
    let mounted = true;
    const connect = async () => {
      try {
        const { io } = await import("socket.io-client");
        const token  = JSON.parse(localStorage.getItem("auth") || "{}").token;
        if (!token || !mounted) return;

        const socket = io(SOCKET_URL, { auth: { token }, transports: ["websocket", "polling"] });
        socketRef.current = socket;

        socket.on("connect", () => console.log("🔌 Socket connected"));
        socket.on("disconnect", () => console.log("🔌 Socket disconnected"));

        if (onNewComplaint)  socket.on("complaint:new",    onNewComplaint);
        if (onStatusUpdate)  socket.on("complaint:update", (d: any) => onStatusUpdate(d.id, d.status));
        if (onNotification)  socket.on("notification",     onNotification);
      } catch {
        // socket.io-client not installed — silently skip
      }
    };
    connect();
    return () => {
      mounted = false;
      socketRef.current?.disconnect();
    };
  }, []);

  return { connected: !!socketRef.current?.connected };
}