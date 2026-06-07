import { Request, Response } from "express";
import pool from "../config/db";
import { success, error } from "../utils/response";

// ── GET /users  (admin only) ──────────────────────────────────────────────────
export async function getAllUsers(req: Request, res: Response): Promise<void> {
  try {
    const {
      role, search,
      page  = "1",
      limit = "30",
    } = req.query as Record<string, string>;

    let where = "WHERE 1=1";
    const params: any[] = [];

    if (role)   { where += " AND role = ?";                                              params.push(role); }
    if (search) { where += " AND (name LIKE ? OR email LIKE ? OR phone LIKE ?)";
                  const q = `%${search}%`;                                                params.push(q, q, q); }

    const pageNum  = Math.max(1, parseInt(page)  || 1);
    const limitNum = Math.min(100, parseInt(limit) || 30);
    const offset   = (pageNum - 1) * limitNum;

    const [rows] = await pool.execute(
      `SELECT id, name, email, phone, role, district, department,
              badge_number, employee_id, designation, is_active, created_at
       FROM users
       ${where}
       ORDER BY created_at DESC
       LIMIT ${limitNum} OFFSET ${offset}`,
      params
    ) as any;

    const [countRow] = await pool.execute(
      `SELECT COUNT(*) AS total FROM users ${where}`,
      params
    ) as any;

    success(res, { users: rows, total: countRow[0].total, page: pageNum, limit: limitNum });
  } catch (err: any) {
    console.error("getAllUsers error:", err.message);
    error(res, err.message, 500);
  }
}

// ── GET /users/workers  (officer/admin) ───────────────────────────────────────
export async function getWorkers(req: Request, res: Response): Promise<void> {
  try {
    const { department } = req.query as Record<string, string>;

    let where = "WHERE u.role = 'worker' AND u.is_active = 1";
    const params: any[] = [];

    if (department) { where += " AND u.department = ?"; params.push(department); }

    const [rows] = await pool.execute(
      `SELECT
         u.id, u.name, u.email, u.phone,
         u.department, u.district, u.employee_id,
         COUNT(c.id) AS active_assignments
       FROM users u
       LEFT JOIN complaints c
         ON c.assigned_to = u.id AND c.status = 'Assigned'
       ${where}
       GROUP BY u.id
       ORDER BY active_assignments ASC, u.name ASC`,
      params
    ) as any;

    success(res, rows);
  } catch (err: any) {
    console.error("getWorkers error:", err.message);
    error(res, err.message, 500);
  }
}

// ── GET /users/:id ────────────────────────────────────────────────────────────
export async function getUserById(req: Request, res: Response): Promise<void> {
  try {
    const [rows] = await pool.execute(
      `SELECT id, name, email, phone, role, district, department,
              badge_number, employee_id, designation, is_active, created_at
       FROM users WHERE id = ?`,
      [req.params.id]
    ) as any;

    if (rows.length === 0) { error(res, "User not found", 404); return; }
    success(res, rows[0]);
  } catch (err: any) {
    console.error("getUserById error:", err.message);
    error(res, err.message, 500);
  }
}

// ── PATCH /users/:id  (admin only) ───────────────────────────────────────────
export async function updateUser(req: Request, res: Response): Promise<void> {
  try {
    const {
      name, phone, role, district, department,
      badge_number, employee_id, designation, is_active,
    } = req.body;

    await pool.execute(
      `UPDATE users SET
         name        = COALESCE(?, name),
         phone       = COALESCE(?, phone),
         role        = COALESCE(?, role),
         district    = COALESCE(?, district),
         department  = COALESCE(?, department),
         badge_number= COALESCE(?, badge_number),
         employee_id = COALESCE(?, employee_id),
         designation = COALESCE(?, designation),
         is_active   = COALESCE(?, is_active)
       WHERE id = ?`,
      [
        name        ?? null,
        phone       ?? null,
        role        ?? null,
        district    ?? null,
        department  ?? null,
        badge_number?? null,
        employee_id ?? null,
        designation ?? null,
        is_active   !== undefined ? (is_active ? 1 : 0) : null,
        req.params.id,
      ]
    );

    success(res, null, "User updated");
  } catch (err: any) {
    console.error("updateUser error:", err.message);
    error(res, err.message, 500);
  }
}

// ── DELETE /users/:id  (admin only — soft delete) ────────────────────────────
export async function deleteUser(req: Request, res: Response): Promise<void> {
  try {
    if (req.params.id === req.user!.id) {
      error(res, "You cannot deactivate your own account"); return;
    }
    await pool.execute(`UPDATE users SET is_active = 0 WHERE id = ?`, [req.params.id]);
    success(res, null, "User deactivated");
  } catch (err: any) {
    console.error("deleteUser error:", err.message);
    error(res, err.message, 500);
  }
}