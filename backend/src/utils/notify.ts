import { v4 as uuid } from "uuid";
import pool from "../config/db";
import type { Server } from "socket.io";

let io: Server | null = null;

export function setIO(socketServer: Server) { io = socketServer; }

export async function createNotification(
  userId: string,
  message: string,
  type: "info" | "success" | "warning" | "error" = "info",
  relatedId?: string
): Promise<void> {
  const id = uuid();
  await pool.execute(
    `INSERT INTO notifications (id, user_id, message, type, related_id) VALUES (?,?,?,?,?)`,
    [id, userId, message, type, relatedId ?? null]
  );
  // Emit real-time if socket connected
  if (io) {
    io.to(`user:${userId}`).emit("notification", { id, message, type, relatedId, is_read: false, created_at: new Date() });
  }
}
