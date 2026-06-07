// EmergencyDispatch.tsx
// Add to OfficerDashboard — "🚨 Emergency" tab
// Shows incoming SOS queue, lets officer dispatch workers, set ETA

import { useState, useEffect, useCallback } from "react";
// ── Inline emergency types (self-contained, no external import) ──────────────
interface EmergencyRequest {
  id: string; ticketId: string; type: string; subType?: string;
  priority: "CRITICAL" | "HIGH" | "MEDIUM";
  status: "SOS_Sent" | "Dispatched" | "Responder_EnRoute" | "Arrived" | "Resolved" | "Cancelled";
  citizenId: string; citizenName: string; citizenPhone?: string;
  lat?: number; lng?: number; address?: string; description?: string;
  victimCount?: number; injurySeverity?: "Minor" | "Moderate" | "Severe" | "Critical";
  isSilentMode?: boolean;
  assignedResponderId?: string; assignedResponderName?: string; assignedResponderPhone?: string;
  etaMinutes?: number; distanceKm?: number;
  dispatchedAt?: string; arrivedAt?: string; resolvedAt?: string;
  createdAt: string; updatedAt?: string;
  timeline?: Array<{ id:string; event:string; note?:string; actor?:string; time:string; icon:string; color:string; }>;
}
const _EM_KEY = "ap_emergency_requests";
function emLoad(): EmergencyRequest[] { try { const r=localStorage.getItem(_EM_KEY); return r?JSON.parse(r):[]; } catch { return []; } }
function emSave(req: EmergencyRequest) { try { const all=emLoad(); const idx=all.findIndex(r=>r.id===req.id); if(idx>=0)all[idx]=req; else all.unshift(req); localStorage.setItem(_EM_KEY,JSON.stringify(all)); window.dispatchEvent(new Event("storage")); } catch {} }
const EM_STATUS_STEPS: EmergencyRequest["status"][] = ["SOS_Sent","Dispatched","Responder_EnRoute","Arrived","Resolved"];
const EM_STATUS_LABELS: Record<string,string> = { SOS_Sent:"SOS Sent", Dispatched:"Dispatched", Responder_EnRoute:"En Route", Arrived:"Arrived at Scene", Resolved:"Resolved", Cancelled:"Cancelled" };
const EM_STATUS_COLORS: Record<string,string> = { SOS_Sent:"#ef4444", Dispatched:"#f97316", Responder_EnRoute:"#3b82f6", Arrived:"#8b5cf6", Resolved:"#10b981", Cancelled:"#64748b" };
const EMERGENCY_TYPES: Record<string,{icon:string;color:string;hotline:string}> = {
  medical:{icon:"🚑",color:"#ef4444",hotline:"108"}, fire:{icon:"🔥",color:"#f97316",hotline:"101"},
  police:{icon:"🚔",color:"#3b82f6",hotline:"100"}, child:{icon:"👶",color:"#a855f7",hotline:"1098"},
  electricity:{icon:"⚡",color:"#eab308",hotline:"1912"}, flood:{icon:"🌊",color:"#06b6d4",hotline:"1070"},
  animal:{icon:"🐾",color:"#78716c",hotline:"1962"}, accident:{icon:"🚗",color:"#dc2626",hotline:"100"},
  collapse:{icon:"🏗️",color:"#92400e",hotline:"101"}, gas:{icon:"☢️",color:"#65a30d",hotline:"101"},
  dv:{icon:"🛡️",color:"#ec4899",hotline:"181"}, missing:{icon:"🔍",color:"#8b5cf6",hotline:"100"},
  water:{icon:"💧",color:"#0ea5e9",hotline:"1916"}, cyber:{icon:"💻",color:"#6366f1",hotline:"1930"},
};
// ─────────────────────────────────────────────────────────────────────────────

// Re-use worker type from OfficerDashboard (inline simplified version)
interface Worker {
  id: string;
  name: string;
  dept: string;
  phone: string;
  status: "available" | "busy" | "offline";
  currentLoad: number;
  maxLoad: number;
  location: { lat: number; lng: number; area: string };
  rating: number;
}

interface Props {
  officerName: string;
  workers: Worker[];
  onShowToast: (msg: string, type?: "success" | "error" | "info") => void;
}

function getDistanceKm(a1: number, o1: number, a2: number, o2: number) {
  const R = 6371, dA = ((a2 - a1) * Math.PI) / 180, dO = ((o2 - o1) * Math.PI) / 180;
  const a = Math.sin(dA / 2) ** 2 + Math.cos((a1 * Math.PI) / 180) * Math.cos((a2 * Math.PI) / 180) * Math.sin(dO / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function EmergencyDispatch({ officerName, workers, onShowToast }: Props) {
  const [requests, setRequests] = useState<EmergencyRequest[]>([]);
  const [selected, setSelected] = useState<EmergencyRequest | null>(null);
  const [dispatchOpen, setDispatchOpen] = useState(false);
  const [etaInput, setEtaInput] = useState("5");
  const [noteInput, setNoteInput] = useState("");
  const [tab, setTab] = useState<"active" | "resolved">("active");

  const reload = useCallback(() => {
    const all = emLoad();
    all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    setRequests(all);
  }, []);

  useEffect(() => {
    reload();
    const iv = setInterval(reload, 3000);
    window.addEventListener("storage", reload);
    return () => { clearInterval(iv); window.removeEventListener("storage", reload); };
  }, [reload]);

  const active = requests.filter(r => !["Resolved", "Cancelled"].includes(r.status));
  const resolved = requests.filter(r => r.status === "Resolved");
  const shown = tab === "active" ? active : resolved;

  const updateStatus = (req: EmergencyRequest, status: EmergencyRequest["status"], extra?: Partial<EmergencyRequest>) => {
    const now = new Date().toISOString();
    const updated: EmergencyRequest = {
      ...req, ...extra, status, updatedAt: now,
      timeline: [
        ...(req.timeline || []),
        {
          id: `tl-${Date.now()}`,
          event: `Status → ${EM_STATUS_LABELS[status]}`,
          actor: officerName,
          time: now,
          icon: "🔄",
          color: EM_STATUS_COLORS[status] || "#3b82f6"
        }
      ]
    };
    emSave(updated);
    setSelected(updated);
    setRequests(prev => prev.map(r => r.id === updated.id ? updated : r));
    onShowToast(`Emergency ${req.ticketId} → ${EM_STATUS_LABELS[status]}`, "success");
  };

  const dispatchWorker = (req: EmergencyRequest, worker: Worker) => {
    const now = new Date().toISOString();
    const eta = parseInt(etaInput) || 5;
    const dist = req.lat && req.lng && worker.location.lat
      ? getDistanceKm(req.lat, req.lng, worker.location.lat, worker.location.lng)
      : undefined;

    const updated: EmergencyRequest = {
      ...req,
      status: "Responder_EnRoute",
      assignedResponderId: worker.id,
      assignedResponderName: worker.name,
      assignedResponderPhone: worker.phone,
      etaMinutes: eta,
      distanceKm: dist,
      dispatchedAt: now,
      updatedAt: now,
      timeline: [
        ...(req.timeline || []),
        {
          id: `tl-dispatch-${Date.now()}`,
          event: `Dispatched: ${worker.name}`,
          note: `ETA ${eta} min${dist ? ` · ${dist.toFixed(1)}km away` : ""}${noteInput ? ` · ${noteInput}` : ""}`,
          actor: officerName,
          time: now,
          icon: "🚀",
          color: "#3b82f6"
        }
      ]
    };
    emSave(updated);
    setSelected(updated);
    setRequests(prev => prev.map(r => r.id === updated.id ? updated : r));
    setDispatchOpen(false);
    setNoteInput("");
    onShowToast(`🚨 ${worker.name} dispatched! ETA ${eta} min`, "success");
  };

  // Sort workers by proximity to incident
  const sortedWorkers = [...workers.filter(w => w.status !== "offline")].sort((a, b) => {
    if (!selected?.lat || !selected?.lng) return 0;
    const da = getDistanceKm(selected.lat, selected.lng, a.location.lat, a.location.lng);
    const db = getDistanceKm(selected.lat, selected.lng, b.location.lat, b.location.lng);
    return da - db;
  });

  return (
    <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 380px" : "1fr", gap: 18 }}>
      <style>{`
        @keyframes ed-pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(1.4)} }
        @keyframes ed-slide { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }
        @keyframes ed-siren { 0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,.4)} 50%{box-shadow:0 0 0 12px rgba(239,68,68,0)} }
      `}</style>

      {/* ── LEFT: SOS Queue ── */}
      <div>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
          <div>
            <div style={{ fontSize: 10.5, color: "#94a3b8", fontWeight: 700, letterSpacing: ".08em", marginBottom: 2 }}>
              EMERGENCY COMMAND CENTER
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>
              🚨 SOS Dispatch Queue
            </div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "5px 12px", borderRadius: 20,
              background: active.length > 0 ? "rgba(239,68,68,.1)" : "rgba(16,185,129,.1)",
              border: `1px solid ${active.length > 0 ? "rgba(239,68,68,.3)" : "rgba(16,185,129,.3)"}`,
            }}>
              <div style={{
                width: 7, height: 7, borderRadius: "50%",
                background: active.length > 0 ? "#ef4444" : "#10b981",
                animation: active.length > 0 ? "ed-pulse 1s infinite" : "none"
              }} />
              <span style={{
                fontSize: 11, fontWeight: 700,
                color: active.length > 0 ? "#ef4444" : "#10b981"
              }}>
                {active.length > 0 ? `${active.length} ACTIVE SOS` : "ALL CLEAR"}
              </span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
          {(["active", "resolved"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: "7px 16px", borderRadius: 9, fontSize: 12, fontWeight: 600,
              border: `1.5px solid ${tab === t ? (t === "active" ? "#ef4444" : "#10b981") : "#e2e8f0"}`,
              background: tab === t ? (t === "active" ? "#fef2f2" : "#f0fdf4") : "#fff",
              color: tab === t ? (t === "active" ? "#dc2626" : "#15803d") : "#94a3b8",
              cursor: "pointer", fontFamily: "inherit"
            }}>
              {t === "active" ? `🚨 Active (${active.length})` : `✅ Resolved (${resolved.length})`}
            </button>
          ))}
        </div>

        {/* Request cards */}
        {shown.length === 0 ? (
          <div style={{
            textAlign: "center", padding: "60px 0",
            background: "#ffffff", borderRadius: 16, border: "1.5px solid #e2e8f0"
          }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>{tab === "active" ? "✅" : "📭"}</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#94a3b8" }}>
              {tab === "active" ? "No active emergencies" : "No resolved emergencies yet"}
            </div>
          </div>
        ) : shown.map(req => {
          const emType = EMERGENCY_TYPES[req.type] || { icon: "🚨", color: "#ef4444" };
          const sc = EM_STATUS_COLORS[req.status] || "#ef4444";
          const isSel = selected?.id === req.id;
          const isCritical = req.priority === "CRITICAL" && req.status === "SOS_Sent";
          return (
            <div key={req.id} onClick={() => setSelected(isSel ? null : req)}
              style={{
                background: "#ffffff", borderRadius: 14, padding: "14px 16px",
                border: `1.5px solid ${isSel ? sc : isCritical ? "rgba(239,68,68,.4)" : "#e2e8f0"}`,
                boxShadow: isCritical ? `0 0 0 0 rgba(239,68,68,.4)` : "0 1px 6px rgba(0,0,0,.04)",
                cursor: "pointer", marginBottom: 10, transition: "all .15s",
                animation: isCritical && !isSel ? "ed-siren 2s ease-in-out infinite" : "none"
              }}>
              {isCritical && <div style={{ height: 3, background: "linear-gradient(90deg,#ef4444,#f97316)", borderRadius: "12px 12px 0 0", margin: "-14px -16px 10px" }} />}
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <div style={{
                  width: 42, height: 42, borderRadius: 11,
                  background: `${emType.color}15`, border: `1.5px solid ${emType.color}30`,
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0
                }}>
                  {emType.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", gap: 6, marginBottom: 5, flexWrap: "wrap", alignItems: "center" }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: "2px 9px", borderRadius: 20,
                      background: `${sc}15`, color: sc, border: `1px solid ${sc}30`
                    }}>
                      {EM_STATUS_LABELS[req.status]}
                    </span>
                    <span style={{
                      fontSize: 9.5, fontWeight: 700, padding: "1px 7px", borderRadius: 5,
                      background: req.priority === "CRITICAL" ? "#fef2f2" : "#fff7ed",
                      color: req.priority === "CRITICAL" ? "#dc2626" : "#d97706"
                    }}>
                      {req.priority}
                    </span>
                    {req.isSilentMode && (
                      <span style={{ fontSize: 9.5, color: "#7c3aed", background: "#f5f3ff", border: "1px solid #ddd6fe", borderRadius: 5, padding: "1px 7px", fontWeight: 700 }}>
                        🤫 Silent
                      </span>
                    )}
                    <span style={{ fontSize: 9.5, color: "#94a3b8", fontFamily: "monospace" }}>{req.ticketId}</span>
                  </div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: "#0f172a", marginBottom: 3 }}>
                    {req.subType || req.type.charAt(0).toUpperCase() + req.type.slice(1)} Emergency
                  </div>
                  <div style={{ fontSize: 11, color: "#94a3b8", display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <span>👤 {req.citizenName}</span>
                    {req.address && <span>📍 {req.address.slice(0, 35)}{req.address.length > 35 ? "…" : ""}</span>}
                    <span>🕐 {new Date(req.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                  {req.assignedResponderName && (
                    <div style={{ marginTop: 5, display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 11, color: "#3b82f6", fontWeight: 700 }}>
                        🚀 {req.assignedResponderName}
                      </span>
                      {req.etaMinutes && (
                        <span style={{ fontSize: 10, color: "#60a5fa" }}>· ETA {req.etaMinutes}m</span>
                      )}
                    </div>
                  )}
                </div>
                {/* Quick dispatch button for new SOS */}
                {req.status === "SOS_Sent" && (
                  <button onClick={e => { e.stopPropagation(); setSelected(req); setDispatchOpen(true); }} style={{
                    padding: "7px 14px", borderRadius: 9,
                    background: "linear-gradient(135deg,#dc2626,#ef4444)",
                    border: "none", color: "#fff", fontSize: 11.5, fontWeight: 700,
                    cursor: "pointer", fontFamily: "inherit", flexShrink: 0,
                    boxShadow: "0 4px 12px rgba(239,68,68,.4)"
                  }}>
                    🚀 Dispatch
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── RIGHT: Selected detail + dispatch ── */}
      {selected && (
        <div style={{
          background: "#ffffff", borderRadius: 16, overflow: "hidden",
          border: "1.5px solid #e2e8f0", boxShadow: "0 4px 20px rgba(0,0,0,.08)",
          height: "fit-content", position: "sticky", top: 74
        }}>
          {/* Detail header */}
          {(() => {
            const emType = EMERGENCY_TYPES[selected.type] || { icon: "🚨", color: "#ef4444" };
            const sc = EM_STATUS_COLORS[selected.status] || "#ef4444";
            return (
              <>
                <div style={{
                  background: `linear-gradient(135deg,${emType.color}18,${emType.color}08)`,
                  borderBottom: `2px solid ${emType.color}25`, padding: "18px 20px"
                }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 24 }}>{emType.icon}</span>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a" }}>
                          {selected.subType || selected.type} Emergency
                        </div>
                        <div style={{ fontSize: 10, color: "#94a3b8", fontFamily: "monospace" }}>{selected.ticketId}</div>
                      </div>
                    </div>
                    <button onClick={() => setSelected(null)} style={{
                      width: 28, height: 28, borderRadius: "50%", background: "rgba(0,0,0,.06)",
                      border: "none", cursor: "pointer", fontSize: 12, color: "#94a3b8"
                    }}>✕</button>
                  </div>
                  {/* Info rows */}
                  {[
                    ["👤 Citizen", selected.citizenName],
                    ["📍 Location", selected.address || "No location"],
                    ["👥 Victims", `${selected.victimCount || 1} person(s)`],
                    ["🩺 Severity", selected.injurySeverity || "—"],
                    selected.description ? ["📝 Note", selected.description.slice(0, 60) + (selected.description.length > 60 ? "…" : "")] : null,
                  ].filter(Boolean).map(([k, v]) => (
                    <div key={k as string} style={{ display: "flex", gap: 10, marginBottom: 5 }}>
                      <span style={{ fontSize: 11, color: "#94a3b8", minWidth: 90, flexShrink: 0 }}>{k as string}</span>
                      <span style={{ fontSize: 11.5, color: "#334155", fontWeight: 500 }}>{v as string}</span>
                    </div>
                  ))}
                </div>

                {/* Status update bar */}
                <div style={{ padding: "14px 18px", borderBottom: "1px solid #f1f5f9" }}>
                  <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 700, letterSpacing: ".08em", marginBottom: 8 }}>
                    UPDATE STATUS
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {EM_STATUS_STEPS.filter(s => s !== "SOS_Sent" && s !== "Cancelled").map(s => {
                      const c = EM_STATUS_COLORS[s];
                      const isActive = selected.status === s;
                      return (
                        <button key={s} onClick={() => updateStatus(selected, s)} style={{
                          padding: "6px 12px", borderRadius: 8, fontSize: 11, fontWeight: 600,
                          border: `1.5px solid ${isActive ? c : "#e2e8f0"}`,
                          background: isActive ? `${c}15` : "#f8fafc",
                          color: isActive ? c : "#94a3b8",
                          cursor: "pointer", fontFamily: "inherit", transition: "all .15s"
                        }}>
                          {EM_STATUS_LABELS[s]}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Dispatch section */}
                <div style={{ padding: "14px 18px" }}>
                  {!dispatchOpen ? (
                    <button onClick={() => setDispatchOpen(true)} style={{
                      width: "100%", padding: "12px", borderRadius: 11,
                      background: "linear-gradient(135deg,#dc2626,#ef4444)",
                      border: "none", color: "#fff", fontSize: 13, fontWeight: 800,
                      cursor: "pointer", fontFamily: "inherit",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                      boxShadow: "0 4px 16px rgba(239,68,68,.35)"
                    }}>
                      🚀 Dispatch Responder
                    </button>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#374151", marginBottom: 4 }}>
                        🤖 Nearby Workers — sorted by distance
                      </div>
                      <div style={{ maxHeight: 240, overflowY: "auto", display: "flex", flexDirection: "column", gap: 7 }}>
                        {sortedWorkers.slice(0, 6).map((w, i) => {
                          const dist = selected.lat && selected.lng && w.location.lat
                            ? getDistanceKm(selected.lat, selected.lng, w.location.lat, w.location.lng)
                            : null;
                          const statusColor = w.status === "available" ? "#10b981" : "#f59e0b";
                          return (
                            <div key={w.id} onClick={() => dispatchWorker(selected, w)} style={{
                              display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
                              borderRadius: 10, border: "1.5px solid #f1f5f9",
                              background: i === 0 ? "linear-gradient(135deg,rgba(22,163,74,.06),rgba(16,185,129,.04))" : "#f8fafc",
                              cursor: "pointer", transition: "all .15s"
                            }}
                              onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.borderColor = "#16a34a"}
                              onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.borderColor = "#f1f5f9"}>
                              <div style={{ fontSize: 14, flexShrink: 0 }}>
                                {i === 0 ? "🥇" : i === 1 ? "🥈" : "👷"}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 12.5, fontWeight: 700, color: "#0f172a" }}>
                                  {w.name}
                                  <span style={{ fontSize: 10, color: statusColor, marginLeft: 6, fontWeight: 600 }}>
                                    ● {w.status}
                                  </span>
                                </div>
                                <div style={{ fontSize: 10.5, color: "#94a3b8" }}>
                                  {w.location.area}{dist !== null ? ` · ${dist.toFixed(1)}km` : ""} · ⭐{w.rating}
                                </div>
                              </div>
                              <div style={{
                                padding: "4px 10px", borderRadius: 7,
                                background: "#f0fdf4", border: "1px solid #bbf7d0",
                                fontSize: 11, color: "#15803d", fontWeight: 700
                              }}>
                                Dispatch →
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {/* ETA input */}
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <div>
                          <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 700, marginBottom: 4 }}>ETA (min)</div>
                          <input type="number" min="1" max="60" value={etaInput}
                            onChange={e => setEtaInput(e.target.value)}
                            style={{
                              width: 72, padding: "8px 10px", borderRadius: 9,
                              border: "1.5px solid #e2e8f0", fontSize: 14, fontWeight: 800,
                              outline: "none", textAlign: "center", fontFamily: "inherit"
                            }} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 700, marginBottom: 4 }}>Note (optional)</div>
                          <input value={noteInput} onChange={e => setNoteInput(e.target.value)}
                            placeholder="Dispatch note…"
                            style={{
                              width: "100%", padding: "8px 10px", borderRadius: 9,
                              border: "1.5px solid #e2e8f0", fontSize: 12, outline: "none",
                              fontFamily: "inherit"
                            }} />
                        </div>
                      </div>
                      <button onClick={() => setDispatchOpen(false)} style={{
                        padding: "9px", borderRadius: 9, background: "#f8fafc",
                        border: "1px solid #e2e8f0", color: "#94a3b8",
                        fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit"
                      }}>
                        Cancel
                      </button>
                    </div>
                  )}
                </div>

                {/* Timeline */}
                {selected.timeline && selected.timeline.length > 0 && (
                  <div style={{ padding: "0 18px 16px", borderTop: "1px solid #f1f5f9", paddingTop: 12 }}>
                    <div style={{ fontSize: 9.5, color: "#94a3b8", fontWeight: 700, letterSpacing: ".08em", marginBottom: 8 }}>
                      ACTIVITY TIMELINE
                    </div>
                    {[...selected.timeline].reverse().slice(0, 5).map((ev, i) => (
                      <div key={ev.id} style={{ display: "flex", gap: 10, marginBottom: i < 4 ? 8 : 0 }}>
                        <div style={{
                          width: 24, height: 24, borderRadius: "50%",
                          background: `${ev.color}15`, border: `1.5px solid ${ev.color}`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 10, flexShrink: 0
                        }}>{ev.icon}</div>
                        <div style={{ paddingTop: 2 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: "#0f172a" }}>{ev.event}</div>
                          {ev.note && <div style={{ fontSize: 10.5, color: "#94a3b8" }}>{ev.note}</div>}
                          <div style={{ fontSize: 9.5, color: "#94a3b8" }}>
                            {ev.actor} · {new Date(ev.time).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}