import { Link, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import type { RootState } from "../store";
import { NAV_LINKS } from "./NavLinks";

interface Props { collapsed?: boolean; }

const ROLE_COLOR: Record<string, string> = {
  citizen: "#ea6800", officer: "#3b82f6", worker: "#10b981", admin: "#8b5cf6",
};

export default function Sidebar({ collapsed = false }: Props) {
  const location = useLocation();
  const { user } = useSelector((s: RootState) => s.auth);
  const role = user?.role ?? "citizen";
  const links = NAV_LINKS[role as keyof typeof NAV_LINKS] ?? [];
  const roleColor = ROLE_COLOR[role] ?? "#ea6800";

  return (
    <aside style={{
      width: collapsed ? "60px" : "220px",
      minHeight: "100vh",
      background: "#fff",
      borderRight: "1.5px solid #e2e8f0",
      display: "flex", flexDirection: "column",
      transition: "width .2s",
      flexShrink: 0,
    }}>
      {/* Logo area */}
      <div style={{ padding: "18px 16px 12px", borderBottom: "1.5px solid #f1f5f9", display: "flex", alignItems: "center", gap: "8px" }}>
        <div style={{ width: "34px", height: "34px", background: roleColor, borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "17px", flexShrink: 0 }}>🏛️</div>
        {!collapsed && (
          <div>
            <div style={{ fontSize: "13px", fontWeight: 800, color: "#1e293b", lineHeight: 1 }}>CivicPortal</div>
            <div style={{ fontSize: "10px", color: "#94a3b8", textTransform: "capitalize" }}>{role}</div>
          </div>
        )}
      </div>

      {/* Nav links */}
      <nav style={{ flex: 1, padding: "12px 10px", display: "flex", flexDirection: "column", gap: "4px" }}>
        {links.map(link => {
          const active = location.pathname === link.path;
          return (
            <Link key={link.path + link.label} to={link.path} style={{
              display: "flex", alignItems: "center", gap: "9px",
              padding: "9px 10px", borderRadius: "10px", textDecoration: "none",
              background: active ? `${roleColor}15` : "transparent",
              color: active ? roleColor : "#475569",
              fontWeight: active ? 700 : 500, fontSize: "13px",
              transition: "all .15s", overflow: "hidden", whiteSpace: "nowrap",
            }}
              onMouseEnter={e => { if (!active) (e.currentTarget as HTMLAnchorElement).style.background = "#f8fafc"; }}
              onMouseLeave={e => { if (!active) (e.currentTarget as HTMLAnchorElement).style.background = "transparent"; }}
            >
              <span style={{ fontSize: "16px", flexShrink: 0 }}>{link.icon}</span>
              {!collapsed && link.label}
            </Link>
          );
        })}
      </nav>

      {/* User footer */}
      {!collapsed && user && (
        <div style={{ padding: "12px 14px", borderTop: "1.5px solid #f1f5f9", display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{ width: "30px", height: "30px", borderRadius: "50%", background: roleColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", color: "#fff", fontWeight: 700, flexShrink: 0 }}>
            {user.name?.[0]?.toUpperCase() ?? "U"}
          </div>
          <div style={{ overflow: "hidden" }}>
            <div style={{ fontSize: "12px", fontWeight: 700, color: "#1e293b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.name}</div>
            <div style={{ fontSize: "10.5px", color: "#94a3b8", textTransform: "capitalize" }}>{role}</div>
          </div>
        </div>
      )}
    </aside>
  );
}
