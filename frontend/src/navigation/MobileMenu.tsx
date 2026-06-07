import { useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import type { RootState } from "../store";
import { logout } from "../store/authSlice";
import { NAV_LINKS } from "./NavLinks";

interface Props { open: boolean; onClose: () => void; }

const ROLE_COLOR: Record<string, string> = {
  citizen: "#ea6800", officer: "#3b82f6", worker: "#10b981", admin: "#8b5cf6",
};

export default function MobileMenu({ open, onClose }: Props) {
  const dispatch   = useDispatch();
  const navigate   = useNavigate();
  const location   = useLocation();
  const { user }   = useSelector((s: RootState) => s.auth);
  const role       = user?.role ?? "citizen";
  const links      = NAV_LINKS[role as keyof typeof NAV_LINKS] ?? [];
  const roleColor  = ROLE_COLOR[role] ?? "#ea6800";

  // Close on route change
  useEffect(() => { onClose(); }, [location.pathname]);

  // Prevent body scroll when open
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const handleLogout = () => {
    dispatch(logout());
    navigate("/login");
    onClose();
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.45)", zIndex: 2000, backdropFilter: "blur(2px)" }} />

      {/* Drawer */}
      <div style={{
        position: "fixed", top: 0, left: 0, bottom: 0, width: "280px",
        background: "#fff", zIndex: 2001, display: "flex", flexDirection: "column",
        boxShadow: "4px 0 24px rgba(0,0,0,.15)",
        animation: "mob-slide-in .22s ease",
      }}>
        {/* Header */}
        <div style={{ padding: "18px 16px", borderBottom: "1.5px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{ width: "34px", height: "34px", background: roleColor, borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "17px" }}>🏛️</div>
            <div>
              <div style={{ fontSize: "14px", fontWeight: 800, color: "#1e293b" }}>CivicPortal</div>
              <div style={{ fontSize: "10px", color: "#94a3b8", textTransform: "capitalize" }}>{role} Panel</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "#f1f5f9", border: "none", borderRadius: "8px", width: "30px", height: "30px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* User info */}
        {user && (
          <div style={{ padding: "14px 16px", borderBottom: "1.5px solid #f1f5f9", display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "40px", height: "40px", borderRadius: "50%", background: roleColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", color: "#fff", fontWeight: 700, flexShrink: 0 }}>
              {user.name?.[0]?.toUpperCase() ?? "U"}
            </div>
            <div>
              <div style={{ fontSize: "14px", fontWeight: 700, color: "#1e293b" }}>{user.name}</div>
              <div style={{ fontSize: "11.5px", color: "#94a3b8" }}>{user.email}</div>
            </div>
          </div>
        )}

        {/* Nav links */}
        <nav style={{ flex: 1, padding: "12px 10px", display: "flex", flexDirection: "column", gap: "4px", overflowY: "auto" }}>
          {links.map(link => {
            const active = location.pathname === link.path;
            return (
              <Link key={link.path + link.label} to={link.path} style={{
                display: "flex", alignItems: "center", gap: "10px",
                padding: "12px 12px", borderRadius: "11px", textDecoration: "none",
                background: active ? `${roleColor}15` : "transparent",
                color: active ? roleColor : "#334155",
                fontWeight: active ? 700 : 500, fontSize: "14px",
              }}>
                <span style={{ fontSize: "18px" }}>{link.icon}</span>
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Logout */}
        <div style={{ padding: "12px 10px", borderTop: "1.5px solid #f1f5f9" }}>
          <button onClick={handleLogout} style={{
            width: "100%", padding: "12px", background: "#fef2f2", border: "1.5px solid #fecaca",
            borderRadius: "11px", color: "#dc2626", fontWeight: 700, fontSize: "14px",
            cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", justifyContent: "center", fontFamily: "inherit",
          }}>
            🚪 Sign Out
          </button>
        </div>
      </div>
      <style>{`@keyframes mob-slide-in{from{transform:translateX(-100%)}to{transform:translateX(0)}}`}</style>
    </>
  );
}
