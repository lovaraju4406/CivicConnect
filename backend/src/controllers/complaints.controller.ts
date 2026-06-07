import { Request, Response } from "express";
import { v4 as uuid } from "uuid";
import pool from "../config/db";
import { success, error } from "../utils/response";
import { generateTicketId } from "../utils/ticketId";
import { createNotification } from "../utils/notify";

// ── GET /complaints ────────────────────────────────────────────────────────────
export async function getComplaints(req: Request, res: Response): Promise<void> {
  try {
    const { role, id: userId } = req.user!;
    const {
      status, department, search,
      page = "1", limit = "20", emergency,
    } = req.query as Record<string, string>;

    let where = "WHERE 1=1";
    const filterParams: any[] = [];   // params for WHERE only
    const countParams: any[] = [];    // same, for COUNT query

    if (role === "citizen") {
      where += " AND c.user_id = ?";
      filterParams.push(userId);
      countParams.push(userId);
    }
    if (role === "worker") {
      where += " AND c.assigned_to = ?";
      filterParams.push(userId);
      countParams.push(userId);
    }
    if (status) {
      where += " AND c.status = ?";
      filterParams.push(status);
      countParams.push(status);
    }
    if (department) {
      where += " AND c.department = ?";
      filterParams.push(department);
      countParams.push(department);
    }
    if (emergency) {
      where += " AND c.is_emergency = ?";
      filterParams.push(emergency === "true" ? 1 : 0);
      countParams.push(emergency === "true" ? 1 : 0);
    }
    if (search) {
      where += " AND (c.title LIKE ? OR c.ticket_id LIKE ? OR c.address LIKE ?)";
      const q = `%${search}%`;
      filterParams.push(q, q, q);
      countParams.push(q, q, q);
    }

    const pageNum   = Math.max(1, parseInt(page) || 1);
    const limitNum  = Math.min(100, parseInt(limit) || 20);
    const offset    = (pageNum - 1) * limitNum;

    // Main query — embed LIMIT/OFFSET directly (avoids MySQL prepared stmt type issues)
    const [rows] = await pool.execute(
      `SELECT c.*,
              u.name  AS user_name,
              u.phone AS user_phone,
              w.name  AS assigned_name
       FROM complaints c
       JOIN  users u ON c.user_id    = u.id
       LEFT JOIN users w ON c.assigned_to = w.id
       ${where}
       ORDER BY c.created_at DESC
       LIMIT ${limitNum} OFFSET ${offset}`,
      filterParams
    ) as any;

    // Count query — countParams only (no LIMIT/OFFSET)
    const [countRow] = await pool.execute(
      `SELECT COUNT(*) AS total FROM complaints c ${where}`,
      countParams
    ) as any;

    success(res, {
      complaints: rows,
      total:      countRow[0].total,
      page:       pageNum,
      limit:      limitNum,
    });
  } catch (err: any) {
    console.error("getComplaints error:", err.message);
    error(res, err.message, 500);
  }
}

// ── GET /complaints/mine ───────────────────────────────────────────────────────
export async function getMyComplaints(req: Request, res: Response): Promise<void> {
  try {
    const [rows] = await pool.execute(
      `SELECT c.*, w.name AS assigned_name
       FROM complaints c
       LEFT JOIN users w ON c.assigned_to = w.id
       WHERE c.user_id = ?
       ORDER BY c.created_at DESC`,
      [req.user!.id]
    ) as any;
    success(res, rows);
  } catch (err: any) {
    console.error("getMyComplaints error:", err.message);
    error(res, err.message, 500);
  }
}

// ── GET /complaints/:id ────────────────────────────────────────────────────────
export async function getComplaintById(req: Request, res: Response): Promise<void> {
  try {
    const [rows] = await pool.execute(
      `SELECT c.*,
              u.name  AS user_name,
              u.phone AS user_phone,
              u.email AS user_email,
              w.name  AS assigned_name,
              w.phone AS worker_phone,
              r.name  AS resolved_by_name
       FROM complaints c
       JOIN  users u ON c.user_id    = u.id
       LEFT JOIN users w ON c.assigned_to = w.id
       LEFT JOIN users r ON c.resolved_by = r.id
       WHERE c.id = ?`,
      [req.params.id]
    ) as any;

    if (rows.length === 0) { error(res, "Complaint not found", 404); return; }

    const c = rows[0];
    if (req.user!.role === "citizen" && c.user_id !== req.user!.id) {
      error(res, "Access denied", 403); return;
    }

    const [assignments] = await pool.execute(
      `SELECT a.*, u.name AS worker_name, o.name AS officer_name
       FROM assignments a
       JOIN users u ON a.assigned_to = u.id
       JOIN users o ON a.assigned_by = o.id
       WHERE a.complaint_id = ?
       ORDER BY a.assigned_at DESC`,
      [req.params.id]
    ) as any;

    success(res, { ...c, assignments });
  } catch (err: any) {
    console.error("getComplaintById error:", err.message);
    error(res, err.message, 500);
  }
}

// ── POST /complaints ───────────────────────────────────────────────────────────
export async function createComplaint(req: Request, res: Response): Promise<void> {
  try {
    const {
      title, description, department,
      lat = 0, lng = 0, address,
      is_emergency = false, emergency_reason,
    } = req.body;

    if (!title || !description || !department || !address) {
      error(res, "Title, description, department and address are required");
      return;
    }

    const id       = uuid();
    const ticketId = generateTicketId();
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;
    const isEmerg  = is_emergency === true || is_emergency === "true" || is_emergency === 1;

    await pool.execute(
      `INSERT INTO complaints
         (id, ticket_id, title, description, department, lat, lng, address,
          image_url, status, is_emergency, emergency_reason, user_id)
       VALUES (?,?,?,?,?,?,?,?,?,'Pending',?,?,?)`,
      [
        id, ticketId, title, description, department,
        parseFloat(lat) || 0, parseFloat(lng) || 0, address,
        imageUrl, isEmerg ? 1 : 0, emergency_reason ?? null, req.user!.id,
      ]
    );

    // Notify officers and admins
    const [officers] = await pool.execute(
      `SELECT id FROM users WHERE role IN ('officer','admin') AND is_active = 1`
    ) as any;

    for (const o of officers) {
      await createNotification(
        o.id,
        `New complaint: "${title}" (${department}) — Ticket: ${ticketId}`,
        isEmerg ? "error" : "info",
        id
      );
    }

    const [newRow] = await pool.execute(
      `SELECT * FROM complaints WHERE id = ?`, [id]
    ) as any;

    success(res, newRow[0], "Complaint submitted successfully", 201);
  } catch (err: any) {
    console.error("createComplaint error:", err.message);
    error(res, err.message, 500);
  }
}

// ── PATCH /complaints/:id ──────────────────────────────────────────────────────
export async function updateComplaint(req: Request, res: Response): Promise<void> {
  try {
    const [rows] = await pool.execute(
      `SELECT * FROM complaints WHERE id = ?`, [req.params.id]
    ) as any;
    if (rows.length === 0) { error(res, "Complaint not found", 404); return; }

    const c = rows[0];
    if (req.user!.role === "citizen") {
      if (c.user_id !== req.user!.id)  { error(res, "Access denied", 403); return; }
      if (c.status  !== "Pending")     { error(res, "Cannot edit an assigned or resolved complaint", 400); return; }
    }

    const { title, description, address, department } = req.body;
    await pool.execute(
      `UPDATE complaints
       SET title       = COALESCE(?, title),
           description = COALESCE(?, description),
           address     = COALESCE(?, address),
           department  = COALESCE(?, department)
       WHERE id = ?`,
      [title ?? null, description ?? null, address ?? null, department ?? null, req.params.id]
    );

    success(res, null, "Complaint updated");
  } catch (err: any) {
    console.error("updateComplaint error:", err.message);
    error(res, err.message, 500);
  }
}

// ── PATCH /complaints/:id/status ──────────────────────────────────────────────
export async function updateStatus(req: Request, res: Response): Promise<void> {
  try {
    const { status } = req.body;
    if (!["Pending", "Assigned", "Resolved"].includes(status)) {
      error(res, "Invalid status value"); return;
    }

    const [rows] = await pool.execute(
      `SELECT * FROM complaints WHERE id = ?`, [req.params.id]
    ) as any;
    if (rows.length === 0) { error(res, "Complaint not found", 404); return; }

    const resolvedAt = status === "Resolved" ? new Date() : null;
    const resolvedBy = status === "Resolved" ? req.user!.id : null;

    await pool.execute(
      `UPDATE complaints SET status = ?, resolved_at = ?, resolved_by = ? WHERE id = ?`,
      [status, resolvedAt, resolvedBy, req.params.id]
    );

    const c = rows[0];
    await createNotification(
      c.user_id,
      `Your complaint "${c.title}" status updated to: ${status}`,
      status === "Resolved" ? "success" : "info",
      req.params.id
    );

    success(res, null, `Status updated to ${status}`);
  } catch (err: any) {
    console.error("updateStatus error:", err.message);
    error(res, err.message, 500);
  }
}

// ── POST /complaints/:id/assign ────────────────────────────────────────────────
export async function assignComplaint(req: Request, res: Response): Promise<void> {
  try {
    const { worker_id, notes } = req.body;
    if (!worker_id) { error(res, "worker_id is required"); return; }

    const [compRows] = await pool.execute(
      `SELECT * FROM complaints WHERE id = ?`, [req.params.id]
    ) as any;
    if (compRows.length === 0) { error(res, "Complaint not found", 404); return; }

    const [workerRows] = await pool.execute(
      `SELECT id, name FROM users WHERE id = ? AND role = 'worker'`, [worker_id]
    ) as any;
    if (workerRows.length === 0) { error(res, "Worker not found", 404); return; }

    await pool.execute(
      `UPDATE complaints SET status = 'Assigned', assigned_to = ?, assigned_at = NOW() WHERE id = ?`,
      [worker_id, req.params.id]
    );

    await pool.execute(
      `INSERT INTO assignments (id, complaint_id, assigned_to, assigned_by, notes)
       VALUES (?,?,?,?,?)`,
      [uuid(), req.params.id, worker_id, req.user!.id, notes ?? null]
    );

    const c = compRows[0];
    await createNotification(
      worker_id,
      `You have been assigned complaint: "${c.title}" (${c.ticket_id})`,
      "info",
      req.params.id
    );
    await createNotification(
      c.user_id,
      `Your complaint "${c.title}" has been assigned to a field worker`,
      "success",
      req.params.id
    );

    success(res, null, `Complaint assigned to ${workerRows[0].name}`);
  } catch (err: any) {
    console.error("assignComplaint error:", err.message);
    error(res, err.message, 500);
  }
}

// ── POST /complaints/:id/proof ─────────────────────────────────────────────────
export async function uploadProof(req: Request, res: Response): Promise<void> {
  try {
    const [rows] = await pool.execute(
      `SELECT * FROM complaints WHERE id = ?`, [req.params.id]
    ) as any;
    if (rows.length === 0) { error(res, "Complaint not found", 404); return; }

    const c = rows[0];
    if (req.user!.role === "worker" && c.assigned_to !== req.user!.id) {
      error(res, "You are not assigned to this complaint", 403); return;
    }

    const proofUrl     = req.file ? `/uploads/${req.file.filename}` : null;
    const { resolution_note } = req.body;

    await pool.execute(
      `UPDATE complaints
       SET status = 'Resolved', resolved_at = NOW(), resolved_by = ?,
           proof_image = ?, resolution_note = ?
       WHERE id = ?`,
      [req.user!.id, proofUrl, resolution_note ?? null, req.params.id]
    );

    await pool.execute(
      `UPDATE assignments SET completed_at = NOW()
       WHERE complaint_id = ? AND assigned_to = ?`,
      [req.params.id, req.user!.id]
    );

    await createNotification(
      c.user_id,
      `Your complaint "${c.title}" has been resolved! Please rate the service.`,
      "success",
      req.params.id
    );

    success(res, null, "Proof uploaded and complaint marked as resolved");
  } catch (err: any) {
    console.error("uploadProof error:", err.message);
    error(res, err.message, 500);
  }
}

// ── POST /complaints/:id/rate ──────────────────────────────────────────────────
export async function rateComplaint(req: Request, res: Response): Promise<void> {
  try {
    const { rating, comment } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      error(res, "Rating must be between 1 and 5"); return;
    }

    const [rows] = await pool.execute(
      `SELECT * FROM complaints WHERE id = ?`, [req.params.id]
    ) as any;
    if (rows.length === 0)               { error(res, "Complaint not found", 404); return; }
    if (rows[0].user_id !== req.user!.id){ error(res, "Access denied", 403); return; }
    if (rows[0].status  !== "Resolved")  { error(res, "Can only rate resolved complaints"); return; }
    if (rows[0].rating)                  { error(res, "You have already rated this complaint"); return; }

    await pool.execute(
      `UPDATE complaints SET rating = ?, rating_comment = ?, rated_at = NOW() WHERE id = ?`,
      [rating, comment ?? null, req.params.id]
    );

    success(res, null, "Rating submitted. Thank you!");
  } catch (err: any) {
    console.error("rateComplaint error:", err.message);
    error(res, err.message, 500);
  }
}