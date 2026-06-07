import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { v4 as uuid } from "uuid";
import pool from "../config/db";
import { signToken } from "../utils/jwt";
import { success, error } from "../utils/response";

// ── POST /auth/register ────────────────────────────────────────────────────
export async function register(req: Request, res: Response): Promise<void> {
  try {
    const { name, email, phone, password, role = "citizen", district, department, badge_number, employee_id } = req.body;

    if (!name || !email || !password) { error(res, "Name, email and password are required"); return; }
    if (password.length < 6)          { error(res, "Password must be at least 6 characters"); return; }

    const allowed = ["citizen", "officer", "worker", "admin"];
    if (!allowed.includes(role)) { error(res, "Invalid role"); return; }

    const [existing] = await pool.execute(`SELECT id FROM users WHERE email = ?`, [email]) as any;
    if (existing.length > 0) { error(res, "Email already registered", 409); return; }

    const id   = uuid();
    const hash = await bcrypt.hash(password, 10);

    await pool.execute(
      `INSERT INTO users (id,name,email,phone,password_hash,role,district,department,badge_number,employee_id)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [id, name, email, phone ?? null, hash, role, district ?? null, department ?? null, badge_number ?? null, employee_id ?? null]
    );

    const token = signToken({ id, role, email });
    success(res, { token, user: { id, name, email, phone, role, district, department } }, "Registration successful", 201);
  } catch (err: any) {
    error(res, err.message, 500);
  }
}

// ── POST /auth/login ───────────────────────────────────────────────────────
export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body;
    if (!email || !password) { error(res, "Email and password are required"); return; }

    const [rows] = await pool.execute(
      `SELECT id,name,email,phone,password_hash,role,district,department,badge_number,employee_id,designation,is_active
       FROM users WHERE email = ?`, [email]
    ) as any;

    if (rows.length === 0) { error(res, "Invalid email or password", 401); return; }

    const user = rows[0];
    if (!user.is_active) { error(res, "Your account has been deactivated. Contact admin.", 403); return; }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) { error(res, "Invalid email or password", 401); return; }

    const token = signToken({ id: user.id, role: user.role, email: user.email });

    delete user.password_hash;
    success(res, { token, user }, "Login successful");
  } catch (err: any) {
    error(res, err.message, 500);
  }
}

// ── GET /auth/me ───────────────────────────────────────────────────────────
export async function getMe(req: Request, res: Response): Promise<void> {
  try {
    const [rows] = await pool.execute(
      `SELECT id,name,email,phone,role,district,department,badge_number,employee_id,designation,is_active,created_at
       FROM users WHERE id = ?`, [req.user!.id]
    ) as any;

    if (rows.length === 0) { error(res, "User not found", 404); return; }
    success(res, rows[0]);
  } catch (err: any) {
    error(res, err.message, 500);
  }
}

// ── PATCH /auth/profile ────────────────────────────────────────────────────
export async function updateProfile(req: Request, res: Response): Promise<void> {
  try {
    const { name, phone, district, designation } = req.body;
    await pool.execute(
      `UPDATE users SET name=?, phone=?, district=?, designation=? WHERE id=?`,
      [name, phone ?? null, district ?? null, designation ?? null, req.user!.id]
    );
    success(res, null, "Profile updated");
  } catch (err: any) {
    error(res, err.message, 500);
  }
}

// ── POST /auth/change-password ─────────────────────────────────────────────
export async function changePassword(req: Request, res: Response): Promise<void> {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) { error(res, "Both old and new password required"); return; }
    if (newPassword.length < 6)       { error(res, "New password must be at least 6 characters"); return; }

    const [rows] = await pool.execute(`SELECT password_hash FROM users WHERE id=?`, [req.user!.id]) as any;
    const match  = await bcrypt.compare(oldPassword, rows[0].password_hash);
    if (!match) { error(res, "Current password is incorrect", 401); return; }

    const hash = await bcrypt.hash(newPassword, 10);
    await pool.execute(`UPDATE users SET password_hash=? WHERE id=?`, [hash, req.user!.id]);
    success(res, null, "Password changed successfully");
  } catch (err: any) {
    error(res, err.message, 500);
  }
}
