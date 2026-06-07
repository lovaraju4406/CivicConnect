// ResponderAlert.tsx
// Drop into WorkerDashboard — polls for assignments where assignedResponderId matches worker
// Shows full-screen siren alert + one-tap "On My Way" button

import { useState, useEffect, useRef, useCallback } from "react";
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

interface Props {
  workerId: string;
  workerName: string;
  onShowToast: (msg: string, type?: "success" | "error" | "info") => void;
}

export default function ResponderAlert({ workerId, workerName, onShowToast }: Props) {
  const [myRequests, setMyRequests] = useState<EmergencyRequest[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<string | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const prevIdsRef = useRef<Set<string>>(new Set());

  const load = useCallback(() => {
    const all = emLoad();
    const mine = all.filter(r =>
      (r.assignedResponderId === workerId || r.assignedResponderName === workerName) &&
      !["Resolved", "Cancelled"].includes(r.status)
    );
    // New dispatch? trigger alert
    mine.forEach(r => {
      if (r.status === "Responder_EnRoute" && !prevIdsRef.current.has(r.id)) {
        playAlertSound();
      }
    });
    prevIdsRef.current = new Set(mine.map(r => r.id));
    setMyRequests(mine);
  }, [workerId, workerName]);

  useEffect(() => {
    load();
    const iv = setInterval(load, 3000);
    window.addEventListener("storage", load);
    return () => { clearInterval(iv); window.removeEventListener("storage", load); };
  }, [load]);

  const playAlertSound = () => {
    try {
      if (!audioRef.current) audioRef.current = new AudioContext();
      const ctx = audioRef.current;
      // Siren pattern: two tones alternating
      const playTone = (freq: number, start: number, dur: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.value = freq;
        osc.type = "sawtooth";
        gain.gain.setValueAtTime(0.3, ctx.currentTime + start);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
        osc.start(ctx.currentTime + start);
        osc.stop(ctx.currentTime + start + dur);
      };
      [0, 0.3, 0.6, 0.9].forEach((t, i) => playTone(i % 2 === 0 ? 880 : 660, t, 0.28));
    } catch {}
  };

  const updateStatus = (req: EmergencyRequest, status: EmergencyRequest["status"]) => {
    const now = new Date().toISOString();
    const updated: EmergencyRequest = {
      ...req, status, updatedAt: now,
      ...(status === "Arrived" ? { arrivedAt: now } : {}),
      ...(status === "Resolved" ? { resolvedAt: now } : {}),
      timeline: [
        ...(req.timeline || []),
        {
          id: `tl-resp-${Date.now()}`,
          event: status === "Arrived" ? "Responder arrived at scene" : status === "Resolved" ? "Emergency resolved" : "En route",
          actor: workerName,
          time: now,
          icon: status === "Arrived" ? "✅" : status === "Resolved" ? "🏁" : "🚀",
          color: EM_STATUS_COLORS[status] || "#10b981"
        }
      ]
    };
    emSave(updated);
    setMyRequests(prev => prev.map(r => r.id === updated.id ? updated : r));
    onShowToast(`Status → ${status}`, "success");
    if (status === "Resolved") {
      setTimeout(() => setMyRequests(prev => prev.filter(r => r.id !== req.id)), 2000);
    }
  };

  const active = myRequests.filter(r => !dismissed.has(r.id));
  if (active.length === 0) return null;

  return (
    <div style={{ marginBottom: 20 }}>
      <style>{`
        @keyframes ra-pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        @keyframes ra-siren { 0%{box-shadow:0 0 0 0 rgba(239,68,68,.6)} 70%{box-shadow:0 0 0 16px rgba(239,68,68,0)} 100%{box-shadow:0 0 0 0 rgba(239,68,68,0)} }
        @keyframes ra-slide { from{opacity:0;transform:translateY(-10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes ra-flash { 0%,100%{background:rgba(239,68,68,.12)} 50%{background:rgba(239,68,68,.05)} }
        @keyframes ra-beacon { 0%{transform:scale(1);opacity:.8} 100%{transform:scale(2.8);opacity:0} }
      `}</style>

      {active.map((req) => {
        const emType = EMERGENCY_TYPES[req.type] || { icon: "🚨", color: "#ef4444", hotline: "112" };
        const isNew = req.status === "Responder_EnRoute";
        const isExpanded = expanded === req.id;

        return (
          <div key={req.id} style={{
            borderRadius: 18, overflow: "hidden",
            border: `2px solid ${isNew ? "#ef4444" : emType.color}`,
            animation: `ra-slide .3s ease, ${isNew ? "ra-flash 2s ease-in-out infinite" : "none"}`,
            marginBottom: 12, background: "linear-gradient(135deg,#0a0f1a,#111827)",
          }}>
            {/* Red top bar — NEW DISPATCH */}
            {isNew && (
              <div style={{
                background: "linear-gradient(90deg,#7f1d1d,#991b1b)",
                padding: "10px 16px",
                display: "flex", alignItems: "center", justifyContent: "space-between"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {/* Beacon */}
                  <div style={{ position: "relative", width: 18, height: 18, flexShrink: 0 }}>
                    <div style={{
                      position: "absolute", inset: 0, borderRadius: "50%",
                      background: "#ef4444", animation: "ra-beacon 1.2s ease-out infinite"
                    }} />
                    <div style={{
                      position: "absolute", inset: 2, borderRadius: "50%",
                      background: "#fff", animation: "ra-pulse 1s infinite"
                    }} />
                  </div>
                  <span style={{ fontSize: 11.5, fontWeight: 800, color: "#fca5a5", letterSpacing: ".06em" }}>
                    🚨 YOU HAVE BEEN DISPATCHED
                  </span>
                </div>
                <span style={{
                  fontSize: 10, color: "rgba(252,165,165,.7)", fontFamily: "monospace",
                  padding: "2px 8px", borderRadius: 6, background: "rgba(255,255,255,.1)"
                }}>
                  {req.ticketId}
                </span>
              </div>
            )}

            {/* Main card */}
            <div style={{ padding: "16px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                {/* Type icon with animation */}
                <div style={{ position: "relative", flexShrink: 0 }}>
                  {isNew && (
                    <div style={{
                      position: "absolute", inset: -6, borderRadius: "50%",
                      border: `2px solid ${emType.color}`,
                      animation: "ra-siren 1.5s ease-out infinite"
                    }} />
                  )}
                  <div style={{
                    width: 52, height: 52, borderRadius: 14,
                    background: `${emType.color}20`, border: `2px solid ${emType.color}40`,
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26
                  }}>
                    {emType.icon}
                  </div>
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 900, color: "#f1f5f9", marginBottom: 4 }}>
                    {req.subType || req.type.charAt(0).toUpperCase() + req.type.slice(1)} Emergency
                  </div>
                  <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 6 }}>
                    👤 {req.citizenName}
                    {req.victimCount && req.victimCount > 1 && (
                      <span style={{ color: "#f97316", marginLeft: 8, fontWeight: 700 }}>
                        👥 {req.victimCount} affected
                      </span>
                    )}
                  </div>
                  {req.address && (
                    <div style={{
                      display: "flex", alignItems: "center", gap: 6, padding: "7px 10px",
                      borderRadius: 8, background: "rgba(255,255,255,.04)",
                      border: "1px solid rgba(255,255,255,.06)", marginBottom: 8
                    }}>
                      <span style={{ fontSize: 13 }}>📍</span>
                      <span style={{ fontSize: 12, color: "#94a3b8" }}>{req.address}</span>
                      {req.lat && req.lng && (
                        <a href={`https://www.google.com/maps/dir/?api=1&destination=${req.lat},${req.lng}&travelmode=driving`}
                          target="_blank" rel="noreferrer"
                          style={{
                            marginLeft: "auto", fontSize: 11, fontWeight: 700,
                            color: "#60a5fa", textDecoration: "none", flexShrink: 0
                          }}>
                          🗺️ Navigate
                        </a>
                      )}
                    </div>
                  )}
                  {req.etaMinutes && (
                    <div style={{ fontSize: 12, color: "#60a5fa" }}>
                      ⏱️ ETA set: <strong>{req.etaMinutes} min</strong>
                    </div>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                {req.status === "Responder_EnRoute" && (
                  <button onClick={() => updateStatus(req, "Arrived")} style={{
                    flex: 2, padding: "12px", borderRadius: 11,
                    background: "linear-gradient(135deg,#7c3aed,#8b5cf6)",
                    border: "none", color: "#fff", fontSize: 13, fontWeight: 800,
                    cursor: "pointer", fontFamily: "inherit",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    boxShadow: "0 4px 14px rgba(139,92,246,.4)"
                  }}>
                    ✅ I've Arrived
                  </button>
                )}
                {req.status === "Arrived" && (
                  <button onClick={() => updateStatus(req, "Resolved")} style={{
                    flex: 2, padding: "12px", borderRadius: 11,
                    background: "linear-gradient(135deg,#059669,#10b981)",
                    border: "none", color: "#fff", fontSize: 13, fontWeight: 800,
                    cursor: "pointer", fontFamily: "inherit",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    boxShadow: "0 4px 14px rgba(16,185,129,.4)"
                  }}>
                    🏁 Mark Resolved
                  </button>
                )}
                <a href={`tel:${emType.hotline}`} style={{
                  flex: 1, padding: "12px", borderRadius: 11,
                  background: "rgba(239,68,68,.12)", border: "1px solid rgba(239,68,68,.3)",
                  color: "#fca5a5", fontSize: 13, fontWeight: 700, textDecoration: "none",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 5
                }}>
                  📞 {emType.hotline}
                </a>
                <button onClick={() => setExpanded(isExpanded ? null : req.id)} style={{
                  width: 44, borderRadius: 11, background: "rgba(255,255,255,.05)",
                  border: "1px solid rgba(255,255,255,.08)", cursor: "pointer", fontSize: 14,
                  color: "#94a3b8", display: "flex", alignItems: "center", justifyContent: "center"
                }}>
                  {isExpanded ? "▲" : "▼"}
                </button>
              </div>

              {/* Expanded: description + severity */}
              {isExpanded && (
                <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                  {req.injurySeverity && (
                    <div style={{
                      padding: "9px 12px", borderRadius: 9,
                      background: req.injurySeverity === "Critical" ? "rgba(239,68,68,.1)" : "rgba(245,158,11,.08)",
                      border: `1px solid ${req.injurySeverity === "Critical" ? "rgba(239,68,68,.25)" : "rgba(245,158,11,.2)"}`,
                      display: "flex", alignItems: "center", gap: 8
                    }}>
                      <span style={{ fontSize: 16 }}>🩺</span>
                      <div>
                        <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 700 }}>INJURY SEVERITY</div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: req.injurySeverity === "Critical" ? "#fca5a5" : "#fbbf24" }}>
                          {req.injurySeverity}
                        </div>
                      </div>
                    </div>
                  )}
                  {req.description && (
                    <div style={{
                      padding: "9px 12px", borderRadius: 9,
                      background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.06)"
                    }}>
                      <div style={{ fontSize: 9.5, color: "#475569", fontWeight: 700, marginBottom: 4 }}>CITIZEN NOTE</div>
                      <div style={{ fontSize: 12.5, color: "#94a3b8", lineHeight: 1.6 }}>{req.description}</div>
                    </div>
                  )}
                  {req.isSilentMode && (
                    <div style={{
                      padding: "9px 12px", borderRadius: 9,
                      background: "rgba(139,92,246,.08)", border: "1px solid rgba(139,92,246,.2)",
                      display: "flex", alignItems: "center", gap: 8
                    }}>
                      <span style={{ fontSize: 16 }}>🤫</span>
                      <div style={{ fontSize: 12, color: "#c4b5fd", fontWeight: 700 }}>
                        SILENT MODE — Approach discreetly
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}