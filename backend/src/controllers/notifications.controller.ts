import { Request, Response } from "express";
import pool from "../config/db";
import { success, error } from "../utils/response";

// ── GET /notifications ─────────────────────────────────────────────────────
export async function getNotifications(req: Request, res: Response): Promise<void> {
  try {
    const [rows] = await pool.execute(
      `SELECT id, message, type, related_id, is_read, created_at
       FROM notifications
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 50`,
      [req.user!.id]
    ) as any;
    success(res, rows);
  } catch (err: any) {
    error(res, err.message, 500);
  }
}

// ── PATCH /notifications/:id/read ─────────────────────────────────────────
export async function markRead(req: Request, res: Response): Promise<void> {
  try {
    await pool.execute(
      `UPDATE notifications SET is_read=1 WHERE id=? AND user_id=?`,
      [req.params.id, req.user!.id]
    );
    success(res, null, "Marked as read");
  } catch (err: any) {
    error(res, err.message, 500);
  }
}

// ── PATCH /notifications/read-all ─────────────────────────────────────────
export async function markAllRead(req: Request, res: Response): Promise<void> {
  try {
    await pool.execute(
      `UPDATE notifications SET is_read=1 WHERE user_id=?`,
      [req.user!.id]
    );
    success(res, null, "All notifications marked as read");
  } catch (err: any) {
    error(res, err.message, 500);
  }
}

// ── DELETE /notifications/:id ─────────────────────────────────────────────
export async function deleteNotification(req: Request, res: Response): Promise<void> {
  try {
    await pool.execute(`DELETE FROM notifications WHERE id=? AND user_id=?`, [req.params.id, req.user!.id]);
    success(res, null, "Notification deleted");
  } catch (err: any) {
    error(res, err.message, 500);
  }
}
