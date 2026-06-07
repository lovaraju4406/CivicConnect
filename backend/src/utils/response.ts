import { Response } from "express";

export function success(res: Response, data: unknown, message = "Success", statusCode = 200) {
  return res.status(statusCode).json({ success: true, message, data });
}

export function error(res: Response, message: string, statusCode = 400, details?: unknown) {
  return res.status(statusCode).json({ success: false, message, ...(details ? { details } : {}) });
}
