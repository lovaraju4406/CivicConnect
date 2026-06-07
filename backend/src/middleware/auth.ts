import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../utils/jwt";
import { error } from "../utils/response";
import type { UserRole } from "../types";

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    error(res, "No token provided", 401);
    return;
  }
  try {
    const token = authHeader.split(" ")[1];
    const decoded = verifyToken(token);
    req.user = { id: decoded.id, role: decoded.role as UserRole, email: decoded.email };
    next();
  } catch {
    error(res, "Invalid or expired token", 401);
  }
}

export function authorize(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) { error(res, "Unauthorized", 401); return; }
    if (!roles.includes(req.user.role)) {
      error(res, `Access denied. Required role: ${roles.join(" or ")}`, 403);
      return;
    }
    next();
  };
}
