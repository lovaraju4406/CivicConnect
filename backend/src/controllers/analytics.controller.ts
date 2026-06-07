import { Request, Response } from "express";
import pool from "../config/db";
import { success, error } from "../utils/response";

// ── GET /analytics/summary ────────────────────────────────────────────────────
export async function getSummary(_req: Request, res: Response): Promise<void> {
  try {
    const [[counts]] = await pool.execute(`
      SELECT
        COUNT(*)                                                        AS totalComplaints,
        SUM(status = 'Pending')                                         AS pendingComplaints,
        SUM(status = 'Assigned')                                        AS assignedComplaints,
        SUM(status = 'Resolved')                                        AS resolvedComplaints,
        SUM(is_emergency = 1)                                           AS emergencyCount,
        ROUND(
          AVG(CASE WHEN resolved_at IS NOT NULL
              THEN TIMESTAMPDIFF(HOUR, created_at, resolved_at) END), 1
        )                                                               AS avgResolutionHours
      FROM complaints
    `) as any;

    const [[userCounts]] = await pool.execute(`
      SELECT
        COUNT(*)                              AS totalUsers,
        SUM(role = 'worker' AND is_active=1) AS activeWorkers,
        SUM(role = 'citizen')                AS citizens,
        SUM(role = 'officer')                AS officers
      FROM users
    `) as any;

    const total    = Number(counts.totalComplaints)  || 0;
    const resolved = Number(counts.resolvedComplaints) || 0;
    const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0;

    success(res, {
      totalComplaints:    total,
      pendingComplaints:  Number(counts.pendingComplaints)  || 0,
      assignedComplaints: Number(counts.assignedComplaints) || 0,
      resolvedComplaints: resolved,
      emergencyCount:     Number(counts.emergencyCount)     || 0,
      avgResolutionHours: Number(counts.avgResolutionHours) || 0,
      totalUsers:         Number(userCounts.totalUsers)     || 0,
      activeWorkers:      Number(userCounts.activeWorkers)  || 0,
      citizens:           Number(userCounts.citizens)       || 0,
      officers:           Number(userCounts.officers)       || 0,
      resolutionRate,
    });
  } catch (err: any) {
    console.error("getSummary error:", err.message);
    error(res, err.message, 500);
  }
}

// ── GET /analytics/departments ────────────────────────────────────────────────
export async function getDepartmentStats(_req: Request, res: Response): Promise<void> {
  try {
    const [rows] = await pool.execute(`
      SELECT
        department,
        COUNT(*)                                                        AS total,
        SUM(status = 'Pending')                                         AS pending,
        SUM(status = 'Assigned')                                        AS assigned,
        SUM(status = 'Resolved')                                        AS resolved,
        ROUND(
          AVG(CASE WHEN resolved_at IS NOT NULL
              THEN TIMESTAMPDIFF(HOUR, created_at, resolved_at) END), 1
        )                                                               AS avgResolutionHours,
        ROUND(SUM(status = 'Resolved') / COUNT(*) * 100, 1)            AS rate
      FROM complaints
      GROUP BY department
      ORDER BY total DESC
    `) as any;

    success(res, rows);
  } catch (err: any) {
    console.error("getDepartmentStats error:", err.message);
    error(res, err.message, 500);
  }
}

// ── GET /analytics/trend ──────────────────────────────────────────────────────
export async function getTrend(req: Request, res: Response): Promise<void> {
  try {
    const { period = "monthly" } = req.query as { period?: string };

    const isWeekly = period === "weekly";
    const days     = isWeekly ? 30 : 365;
    const groupFmt = isWeekly
      ? "DATE(created_at)"
      : "DATE_FORMAT(created_at, '%Y-%m-01')";

    const [rows] = await pool.execute(`
      SELECT
        ${groupFmt}             AS date,
        COUNT(*)               AS submitted,
        SUM(status='Resolved') AS resolved
      FROM complaints
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL ${days} DAY)
      GROUP BY ${groupFmt}
      ORDER BY date ASC
    `) as any;

    success(res, rows);
  } catch (err: any) {
    console.error("getTrend error:", err.message);
    error(res, err.message, 500);
  }
}

// ── GET /analytics/workers ────────────────────────────────────────────────────
export async function getWorkerPerformance(_req: Request, res: Response): Promise<void> {
  try {
    const [rows] = await pool.execute(`
      SELECT
        u.id                                                                AS workerId,
        u.name                                                              AS workerName,
        u.department,
        COUNT(c.id)                                                         AS assigned,
        SUM(c.status = 'Resolved')                                          AS resolved,
        ROUND(
          AVG(CASE WHEN c.resolved_at IS NOT NULL
              THEN TIMESTAMPDIFF(HOUR, c.created_at, c.resolved_at) END), 1
        )                                                                   AS avgResolutionHours,
        ROUND(AVG(c.rating), 1)                                             AS rating
      FROM users u
      LEFT JOIN complaints c ON c.assigned_to = u.id
      WHERE u.role = 'worker' AND u.is_active = 1
      GROUP BY u.id
      ORDER BY resolved DESC
    `) as any;

    success(res, rows);
  } catch (err: any) {
    console.error("getWorkerPerformance error:", err.message);
    error(res, err.message, 500);
  }
}

// ── GET /analytics/recent-activity ───────────────────────────────────────────
export async function getRecentActivity(_req: Request, res: Response): Promise<void> {
  try {
    const [rows] = await pool.execute(`
      SELECT
        c.id,
        c.ticket_id   AS ticketId,
        c.title,
        c.status,
        c.department,
        u.name        AS citizenName,
        w.name        AS workerName,
        c.updated_at  AS time
      FROM complaints c
      JOIN  users u ON c.user_id    = u.id
      LEFT JOIN users w ON c.assigned_to = w.id
      ORDER BY c.updated_at DESC
      LIMIT 20
    `) as any;

    success(res, rows);
  } catch (err: any) {
    console.error("getRecentActivity error:", err.message);
    error(res, err.message, 500);
  }
}