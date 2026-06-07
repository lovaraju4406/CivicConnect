/**
 * ProtectedRoute.tsx
 * Handles both isAuthenticated and isLoggedIn field names in authSlice.
 *
 * USAGE:
 *   <ProtectedRoute allowedRoles={["officer"]}><OfficerDashboard /></ProtectedRoute>
 *   <ProtectedRoute allowedRoles={["citizen"]}><CitizenDashboard /></ProtectedRoute>
 */

import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";

type Role = "citizen" | "admin" | "officer" | "worker";

interface Props {
  children: ReactNode;
  allowedRoles?: Role[];
}

const DASHBOARD_BY_ROLE: Record<Role, string> = {
  citizen: "/dashboard",
  admin:   "/admin-dashboard",
  officer: "/officer-dashboard",
  worker:  "/worker-dashboard",
};

function readLocalSession(): { token: string; user: { id: string; role: Role } } | null {
  try {
    const raw = localStorage.getItem("auth");
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (p?.token && p?.user?.id && p?.user?.role) return p;
    return null;
  } catch { return null; }
}

export default function ProtectedRoute({ children, allowedRoles }: Props) {
  const location = useLocation();

  const auth = useSelector((state: any) => state.auth);

  // ── Support both isAuthenticated and isLoggedIn ───────────────────────
  const isLoggedIn: boolean =
    auth?.isAuthenticated === true ||
    auth?.isLoggedIn === true ||
    false;

  const userRole: Role | null = (auth?.user?.role as Role) ?? null;

  // ── Fallback: read directly from localStorage if Redux not hydrated ───
  const localSession = !isLoggedIn ? readLocalSession() : null;
  const effectivelyLoggedIn = isLoggedIn || !!localSession;
  const effectiveRole: Role | null = userRole ?? (localSession?.user?.role as Role) ?? null;

  // Not logged in → go to login
  if (!effectivelyLoggedIn) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Wrong role → redirect to their correct dashboard
  if (allowedRoles && effectiveRole && !allowedRoles.includes(effectiveRole)) {
    const dest = DASHBOARD_BY_ROLE[effectiveRole] ?? "/login";
    return <Navigate to={dest} replace />;
  }

  return <>{children}</>;
}