// AreaRiskIndicator.tsx
// Area safety risk gauge with live incident feed

import { useState, useEffect } from "react";

interface AreaAlert {
  id: string;
  title: string;
  type: "flood" | "power" | "accident" | "fire" | "health" | "crime";
  severity: "critical" | "warning" | "info";
  distance: string;
  time: string;
}

const SAMPLE_ALERTS: AreaAlert[] = [
  { id: "a1", title: "Power grid maintenance — sector 4", type: "power", severity: "warning", distance: "1.2 km", time: "30 min ago" },
  { id: "a2", title: "Road flooding near NH-16", type: "flood", severity: "critical", distance: "2.5 km", time: "1 hr ago" },
  { id: "a3", title: "Street light outage — MG Road", type: "power", severity: "info", distance: "0.8 km", time: "2 hr ago" },
];

const TYPE_ICON: Record<string, string> = { flood: "🌊", power: "⚡", accident: "🚗", fire: "🔥", health: "🏥", crime: "🚔" };
const SEV_COLOR: Record<string, string> = { critical: "#ef4444", warning: "#f59e0b", info: "#3b82f6" };

export default function AreaRiskIndicator() {
  const [riskLevel, setRiskLevel] = useState<"LOW" | "MODERATE" | "HIGH" | "CRITICAL">("MODERATE");
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    const hasCritical = SAMPLE_ALERTS.some(a => a.severity === "critical" && !dismissed.includes(a.id));
    const hasWarning = SAMPLE_ALERTS.some(a => a.severity === "warning" && !dismissed.includes(a.id));
    if (hasCritical) setRiskLevel("HIGH");
    else if (hasWarning) setRiskLevel("MODERATE");
    else setRiskLevel("LOW");

    const iv = setInterval(() => setPulse(p => !p), 2000);
    return () => clearInterval(iv);
  }, [dismissed]);

  const active = SAMPLE_ALERTS.filter(a => !dismissed.includes(a.id));

  const riskConfig = {
    LOW:      { color: "#10b981", bg: "rgba(16,185,129,.12)",  label: "LOW RISK",      icon: "✅", bar: 20 },
    MODERATE: { color: "#f59e0b", bg: "rgba(245,158,11,.12)", label: "MODERATE RISK",  icon: "⚠️", bar: 55 },
    HIGH:     { color: "#f97316", bg: "rgba(249,115,22,.12)",  label: "HIGH RISK",     icon: "🚨", bar: 80 },
    CRITICAL: { color: "#ef4444", bg: "rgba(239,68,68,.12)",   label: "CRITICAL RISK", icon: "🔴", bar: 100 },
  };

  const cfg = riskConfig[riskLevel];

  return (
    <div style={{
      background: "linear-gradient(135deg,#0f172a,#1e293b)",
      borderRadius: 16, padding: 18,
      border: `1.5px solid ${cfg.color}30`,
      boxShadow: `0 4px 20px ${cfg.color}15`,
    }}>
      <style>{`@keyframes ari-pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(1.5)}}`}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 16 }}>{cfg.icon}</span>
          <div>
            <div style={{ fontSize: 10, fontWeight: 800, color: cfg.color, letterSpacing: ".12em" }}>
              AREA SAFETY STATUS
            </div>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#f1f5f9", marginTop: 1 }}>
              {cfg.label}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <div style={{
            width: 8, height: 8, borderRadius: "50%", background: cfg.color,
            animation: "ari-pulse 1.5s ease-in-out infinite"
          }} />
          <span style={{ fontSize: 9.5, color: cfg.color, fontWeight: 700 }}>LIVE</span>
        </div>
      </div>

      {/* Risk gauge bar */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
          {["LOW", "MODERATE", "HIGH", "CRITICAL"].map(l => (
            <span key={l} style={{
              fontSize: 9, fontWeight: 700,
              color: l === riskLevel ? cfg.color : "#334155"
            }}>{l}</span>
          ))}
        </div>
        <div style={{ height: 8, background: "rgba(255,255,255,.05)", borderRadius: 4, overflow: "hidden" }}>
          <div style={{
            height: "100%", width: `${cfg.bar}%`,
            background: `linear-gradient(90deg, #10b981, ${cfg.color})`,
            borderRadius: 4, transition: "width 1s ease"
          }} />
        </div>
      </div>

      {/* Active alerts */}
      {active.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          <div style={{ fontSize: 10, color: "#475569", fontWeight: 700, letterSpacing: ".06em" }}>
            NEARBY ALERTS ({active.length})
          </div>
          {active.map(a => (
            <div key={a.id} style={{
              display: "flex", alignItems: "flex-start", gap: 8, padding: "9px 10px",
              borderRadius: 9, background: `${SEV_COLOR[a.severity]}08`,
              border: `1px solid ${SEV_COLOR[a.severity]}20`,
            }}>
              <span style={{ fontSize: 14, flexShrink: 0 }}>{TYPE_ICON[a.type]}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11.5, fontWeight: 600, color: "#e2e8f0", lineHeight: 1.3 }}>{a.title}</div>
                <div style={{ fontSize: 10, color: "#475569", marginTop: 2, display: "flex", gap: 6 }}>
                  <span style={{ color: SEV_COLOR[a.severity], fontWeight: 700 }}>{a.severity.toUpperCase()}</span>
                  <span>· {a.distance} · {a.time}</span>
                </div>
              </div>
              <button onClick={() => setDismissed(d => [...d, a.id])} style={{
                fontSize: 10, color: "#475569", background: "none", border: "none",
                cursor: "pointer", flexShrink: 0, padding: 0
              }}>✕</button>
            </div>
          ))}
        </div>
      )}

      {active.length === 0 && (
        <div style={{ textAlign: "center", padding: "10px 0", color: "#334155" }}>
          <div style={{ fontSize: 22, marginBottom: 4 }}>✅</div>
          <div style={{ fontSize: 11.5, fontWeight: 600, color: "#4ade80" }}>Area is safe</div>
          <div style={{ fontSize: 10, color: "#334155", marginTop: 2 }}>No active alerts in your vicinity</div>
        </div>
      )}
    </div>
  );
}