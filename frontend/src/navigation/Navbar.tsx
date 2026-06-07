import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import type { RootState } from "../store";
import { logout } from "../store/authSlice";
import { NAV_LINKS } from "./NavLinks";

export default function Navbar() {
  const dispatch   = useDispatch();
  const navigate   = useNavigate();
  const location   = useLocation();
  const { user, isAuthenticated } = useSelector((s: RootState) => s.auth);
  const notifCount = useSelector((s: RootState) =>
    (s.notifications?.items ?? []).filter((n: any) => !n.read).length
  );
  const [menuOpen, setMenuOpen] = useState(false);

  const role = user?.role ?? "citizen";
  const links = NAV_LINKS[role as keyof typeof NAV_LINKS] ?? [];

  const handleLogout = () => {
    dispatch(logout());
    navigate("/login");
  };

  const ROLE_COLOR: Record<string, string> = {
    citizen: "#ea6800", officer: "#3b82f6", worker: "#10b981", admin: "#8b5cf6",
  };
  const roleColor = ROLE_COLOR[role] ?? "#ea6800";

  return (
    <nav style={{
      position: "sticky", top: 0, zIndex: 1000,
      background: "rgba(255,255,255,.95)", backdropFilter: "blur(10px)",
      borderBottom: "1.5px solid #e2e8f0",
      padding: "0 20px",
      display: "flex", alignItems: "center", justifyContent: "space-between",
      height: "60px",
    }}>
      {/* Logo */}
      <Link to="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: "8px" }}>
        <div style={{ width: "34px", height: "34px", background: roleColor, borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "17px" }}>🏛️</div>
        <div>
          <div style={{ fontSize: "14px", fontWeight: 800, color: "#1e293b", lineHeight: 1 }}>CivicPortal</div>
          <div style={{ fontSize: "10px", color: "#94a3b8", textTransform: "capitalize" }}>{role} Panel</div>
        </div>
      </Link>

      {/* Desktop Nav Links */}
      {isAuthenticated && (
        <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
          {links.map(link => {
            const active = location.pathname === link.path;
            return (
              <Link key={link.path + link.label} to={link.path} style={{
                display: "flex", alignItems: "center", gap: "5px",
                padding: "6px 12px", borderRadius: "9px", textDecoration: "none", fontSize: "13px", fontWeight: 600,
                background: active ? `${roleColor}18` : "transparent",
                color: active ? roleColor : "#64748b",
                transition: "all .15s",
              }}>
                <span>{link.icon}</span>{link.label}
              </Link>
            );
          })}
        </div>
      )}

      {/* Right side */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        {isAuthenticated ? (
          <>
            {/* Notifications bell */}
            <button style={{ background: "none", border: "none", cursor: "pointer", position: "relative", fontSize: "18px", display: "flex" }} onClick={() => {}}>
              🔔
              {notifCount > 0 && (
                <span style={{ position: "absolute", top: "-4px", right: "-4px", background: "#ef4444", color: "#fff", fontSize: "9px", fontWeight: 700, borderRadius: "50%", width: "16px", height: "16px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {notifCount > 9 ? "9+" : notifCount}
                </span>
              )}
            </button>

            {/* User avatar + name */}
            <div style={{ position: "relative" }}>
              <button
                onClick={() => setMenuOpen(v => !v)}
                style={{ display: "flex", alignItems: "center", gap: "7px", background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: "20px", padding: "5px 10px 5px 5px", cursor: "pointer" }}
              >
                <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: roleColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", color: "#fff", fontWeight: 700 }}>
                  {user?.name?.[0]?.toUpperCase() ?? "U"}
                </div>
                <span style={{ fontSize: "12.5px", fontWeight: 600, color: "#334155", maxWidth: "90px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {user?.name ?? "User"}
                </span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
              {menuOpen && (
                <>
                  <div onClick={() => setMenuOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 99 }} />
                  <div style={{ position: "absolute", right: 0, top: "calc(100% + 8px)", background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: "14px", minWidth: "180px", boxShadow: "0 8px 24px rgba(0,0,0,.1)", zIndex: 100, overflow: "hidden" }}>
                    <div style={{ padding: "12px 14px", borderBottom: "1px solid #f1f5f9" }}>
                      <div style={{ fontSize: "13px", fontWeight: 700, color: "#1e293b" }}>{user?.name}</div>
                      <div style={{ fontSize: "11px", color: "#94a3b8" }}>{user?.email}</div>
                      <div style={{ marginTop: "4px", display: "inline-block", padding: "2px 8px", borderRadius: "6px", fontSize: "10.5px", fontWeight: 700, background: `${roleColor}20`, color: roleColor, textTransform: "capitalize" }}>{role}</div>
                    </div>
                    <button
                      onClick={handleLogout}
                      style={{ width: "100%", padding: "11px 14px", background: "none", border: "none", textAlign: "left", fontSize: "13px", color: "#ef4444", cursor: "pointer", fontWeight: 600, display: "flex", alignItems: "center", gap: "7px" }}
                    >
                      🚪 Sign Out
                    </button>
                  </div>
                </>
              )}
            </div>
          </>
        ) : (
          <div style={{ display: "flex", gap: "8px" }}>
            <Link to="/login" style={{ padding: "7px 16px", border: "1.5px solid #e2e8f0", borderRadius: "9px", textDecoration: "none", fontSize: "13px", fontWeight: 600, color: "#475569" }}>Login</Link>
            <Link to="/register" style={{ padding: "7px 16px", background: "#ea6800", borderRadius: "9px", textDecoration: "none", fontSize: "13px", fontWeight: 600, color: "#fff" }}>Register</Link>
          </div>
        )}
      </div>
    </nav>
  );
}
