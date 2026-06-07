import { useState } from "react";

interface Alert {
  id: string;
  title: string;
  type: "flood" | "power" | "accident" | "fire" | "health" | "road";
  severity: "critical" | "warning" | "info";
  distance: string;
  time: string;
  address?: string;
}

interface Props {
  alerts?: Alert[];
  loading?: boolean;
}

const TYPE_ICON: Record<Alert["type"], string> = {
  flood: "🌊", power: "⚡", accident: "🚗", fire: "🔥", health: "🏥", road: "🛣️",
};
const SEV_COLOR: Record<Alert["severity"], { bg: string; border: string; text: string; dot: string }> = {
  critical: { bg: "#fef2f2", border: "#fca5a5", text: "#991b1b", dot: "#ef4444" },
  warning:  { bg: "#fffbeb", border: "#fcd34d", text: "#92400e", dot: "#f59e0b" },
  info:     { bg: "#eff6ff", border: "#93c5fd", text: "#1e40af", dot: "#3b82f6" },
};

const DEMO_ALERTS: Alert[] = [
  { id: "1", title: "Road closure on Main Street", type: "road",     severity: "warning",  distance: "0.3 km", time: "10 min ago", address: "Main St & 5th Ave" },
  { id: "2", title: "Power outage reported",        type: "power",    severity: "critical", distance: "0.7 km", time: "25 min ago", address: "Sector 4, Block B" },
  { id: "3", title: "Flooding in low-lying area",   type: "flood",    severity: "critical", distance: "1.2 km", time: "1 hr ago",   address: "River Road" },
  { id: "4", title: "Health camp set up",           type: "health",   severity: "info",     distance: "2.0 km", time: "2 hrs ago",  address: "Community Hall" },
];

export default function NearbyAlerts({ alerts = DEMO_ALERTS, loading = false }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {[1,2,3].map(i => (
          <div key={i} style={{ height: "62px", borderRadius: "12px", background: "#f1f5f9", animation: "pulse 1.5s ease infinite" }} />
        ))}
        <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.45}}`}</style>
      </div>
    );
  }

  if (alerts.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "32px 16px", color: "#94a3b8" }}>
        <div style={{ fontSize: "32px", marginBottom: "8px" }}>✅</div>
        <p style={{ margin: 0, fontSize: "13px", fontWeight: 600 }}>No nearby alerts</p>
        <p style={{ margin: "3px 0 0", fontSize: "12px" }}>Your area looks all clear</p>
      </div>
    );
  }

  const criticalCount = alerts.filter(a => a.severity === "critical").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {/* Header badge */}
      {criticalCount > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "7px 12px", background: "#fef2f2", borderRadius: "10px", border: "1.5px solid #fca5a5" }}>
          <span style={{ fontSize: "14px" }}>🚨</span>
          <span style={{ fontSize: "12.5px", fontWeight: 700, color: "#991b1b" }}>
            {criticalCount} critical alert{criticalCount > 1 ? "s" : ""} in your area
          </span>
        </div>
      )}

      {alerts.map(alert => {
        const s = SEV_COLOR[alert.severity];
        const isOpen = expanded === alert.id;
        return (
          <div
            key={alert.id}
            onClick={() => setExpanded(isOpen ? null : alert.id)}
            style={{
              background: s.bg, border: `1.5px solid ${s.border}`,
              borderRadius: "12px", padding: "10px 14px", cursor: "pointer",
              transition: "box-shadow .15s",
            }}
            onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.boxShadow = "0 2px 10px rgba(0,0,0,.07)"}
            onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.boxShadow = "none"}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "20px", flexShrink: 0 }}>{TYPE_ICON[alert.type]}</span>
              <div style={{ flex: 1, overflow: "hidden" }}>
                <div style={{ fontSize: "13px", fontWeight: 700, color: s.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {alert.title}
                </div>
                <div style={{ fontSize: "11.5px", color: "#64748b", display: "flex", gap: "10px", marginTop: "2px" }}>
                  <span>📍 {alert.distance}</span>
                  <span>🕐 {alert.time}</span>
                </div>
              </div>
              <span style={{ fontSize: "10px", color: s.text, background: "rgba(255,255,255,.7)", padding: "3px 8px", borderRadius: "20px", fontWeight: 700, textTransform: "uppercase", flexShrink: 0 }}>
                {alert.severity}
              </span>
            </div>

            {isOpen && alert.address && (
              <div style={{ marginTop: "8px", paddingTop: "8px", borderTop: `1px solid ${s.border}`, fontSize: "12px", color: s.text }}>
                📍 {alert.address}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
