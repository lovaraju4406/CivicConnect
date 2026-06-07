// LiveResponderTracker.tsx
// Swiggy-style real-time responder tracker with:
// - ETA countdown
// - Worker GPS simulation
// - Hospital directions
// - First aid tips in-tracker
// - Post-resolution rating (Step 10)

import { useState, useEffect, useRef } from "react";

interface EmergencyRequest {
  id: string;
  ticketId: string;
  type: string;
  subType?: string;
  priority: "CRITICAL" | "HIGH" | "MEDIUM";
  status:
    | "SOS_Sent"
    | "Matching"
    | "Dispatched"
    | "Responder_EnRoute"
    | "Arrived"
    | "Resolved"
    | "Cancelled";
  citizenId: string;
  citizenName: string;
  lat?: number;
  lng?: number;
  address?: string;
  description?: string;
  photoUrl?: string;
  aiSeverityScore?: number;
  aiSeverityLabel?: string;
  victimCount?: number;
  injurySeverity?: string;
  isSilentMode?: boolean;
  assignedResponderName?: string;
  assignedResponderPhone?: string;
  etaMinutes?: number;
  distanceKm?: number;
  dispatchedAt?: string;
  nearestHospital?: { name: string; distance: string; phone: string; type: string };
  firstAidTips?: string[];
  smsAlertSent?: boolean;
  citizenRating?: number;
  citizenFeedback?: string;
  createdAt: string;
  updatedAt?: string;
  timeline?: Array<{
    id: string;
    event: string;
    note?: string;
    actor?: string;
    time: string;
    icon: string;
    color: string;
  }>;
}

const EM_KEY = "ap_emergency_requests";

function emLoad(): EmergencyRequest[] {
  try {
    const r = localStorage.getItem(EM_KEY);
    return r ? JSON.parse(r) : [];
  } catch {
    return [];
  }
}

function emSave(req: EmergencyRequest) {
  try {
    const all = emLoad();
    const idx = all.findIndex((r) => r.id === req.id);
    if (idx >= 0) all[idx] = req;
    else all.unshift(req);
    localStorage.setItem(EM_KEY, JSON.stringify(all));
    window.dispatchEvent(new Event("storage"));
  } catch {}
}

const EM_STATUS_STEPS: EmergencyRequest["status"][] = [
  "SOS_Sent",
  "Dispatched",
  "Responder_EnRoute",
  "Arrived",
  "Resolved",
];

const EM_STATUS_LABELS: Record<string, string> = {
  SOS_Sent: "SOS Sent",
  Matching: "Matching",
  Dispatched: "Dispatched",
  Responder_EnRoute: "En Route",
  Arrived: "Arrived",
  Resolved: "Resolved",
  Cancelled: "Cancelled",
};

const EM_STATUS_COLORS: Record<string, string> = {
  SOS_Sent: "#ef4444",
  Matching: "#f97316",
  Dispatched: "#f97316",
  Responder_EnRoute: "#3b82f6",
  Arrived: "#8b5cf6",
  Resolved: "#10b981",
  Cancelled: "#64748b",
};

const EM_STATUS_ICONS: Record<string, string> = {
  SOS_Sent: "📡",
  Dispatched: "📋",
  Responder_EnRoute: "🚀",
  Arrived: "✅",
  Resolved: "🏁",
  Cancelled: "❌",
};

const EMERGENCY_TYPE_MAP: Record<string, { icon: string; color: string; hotline: string }> = {
  medical:     { icon: "🚑", color: "#ef4444", hotline: "108" },
  fire:        { icon: "🔥", color: "#f97316", hotline: "101" },
  police:      { icon: "🚔", color: "#3b82f6", hotline: "100" },
  child:       { icon: "👶", color: "#a855f7", hotline: "1098" },
  electricity: { icon: "⚡", color: "#eab308", hotline: "1912" },
  flood:       { icon: "🌊", color: "#06b6d4", hotline: "1070" },
  accident:    { icon: "🚗", color: "#dc2626", hotline: "100" },
  collapse:    { icon: "🏗️", color: "#92400e", hotline: "101" },
  dv:          { icon: "🛡️", color: "#ec4899", hotline: "181" },
  missing:     { icon: "🔍", color: "#8b5cf6", hotline: "100" },
  other:       { icon: "🚨", color: "#ef4444", hotline: "112" },
};

// Simulated worker names for demo
const RESPONDER_NAMES = [
  "Ravi Kumar Singh",
  "Priya Sharma",
  "Venkat Rao",
  "Lakshmi Devi",
  "Suresh Babu",
];

interface Props {
  citizenId: string;
  citizenName: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// RATING MODAL — Step 10
// ─────────────────────────────────────────────────────────────────────────────
function RatingModal({
  request,
  onClose,
  onSubmit,
}: {
  request: EmergencyRequest;
  onClose: () => void;
  onSubmit: (rating: number, feedback: string) => void;
}) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [done, setDone] = useState(false);

  const LABELS = ["", "Very Poor", "Poor", "Average", "Good", "Excellent"];
  const EMOJIS = ["", "😞", "😕", "😐", "🙂", "😄"];

  const handleSubmit = () => {
    if (rating === 0) { alert("Please select a rating"); return; }
    onSubmit(rating, feedback);
    setDone(true);
    setTimeout(onClose, 2000);
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(5,10,25,.85)", zIndex: 2000,
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 16, backdropFilter: "blur(8px)",
    }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        background: "#fff", borderRadius: 20, width: "100%", maxWidth: 420,
        padding: "28px 28px 24px", boxShadow: "0 24px 80px rgba(0,0,0,.4)",
        animation: "em-fadein .3s ease",
      }}>
        {done ? (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>Thank you!</div>
            <div style={{ fontSize: 13, color: "#64748b", marginTop: 6 }}>Your rating helps improve emergency response.</div>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 10.5, color: "#ef4444", fontWeight: 700, letterSpacing: ".1em", marginBottom: 4 }}>STEP 10 — RATE THE RESPONSE</div>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>How was the emergency response?</h3>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                Ticket: <strong style={{ fontFamily: "monospace" }}>{request.ticketId}</strong>
                {request.assignedResponderName && ` · ${request.assignedResponderName}`}
              </div>
            </div>
            <div style={{ textAlign: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 48, marginBottom: 8 }}>{EMOJIS[hover || rating] || "⭐"}</div>
              <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 8 }}>
                {[1, 2, 3, 4, 5].map((s) => (
                  <button key={s}
                    onMouseEnter={() => setHover(s)}
                    onMouseLeave={() => setHover(0)}
                    onClick={() => setRating(s)}
                    style={{ fontSize: 32, background: "none", border: "none", cursor: "pointer", color: s <= (hover || rating) ? "#f59e0b" : "#e2e8f0", transition: "all .15s", transform: s <= (hover || rating) ? "scale(1.15)" : "scale(1)" }}
                  >★</button>
                ))}
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>{LABELS[hover || rating] || "Select a rating"}</div>
            </div>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="How was the response time? Was the responder professional?"
              rows={3}
              style={{ width: "100%", padding: "11px 14px", border: "1.5px solid #e2e8f0", borderRadius: 10, fontSize: 12.5, outline: "none", fontFamily: "inherit", color: "#0f172a", resize: "vertical", lineHeight: 1.6 }}
              onFocus={(e) => (e.target.style.borderColor = "#ef4444")}
              onBlur={(e) => (e.target.style.borderColor = "#e2e8f0")}
            />
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button onClick={onClose} style={{ flex: 1, padding: "10px", borderRadius: 10, background: "#f8fafc", border: "1.5px solid #e2e8f0", color: "#94a3b8", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Skip</button>
              <button onClick={handleSubmit} disabled={rating === 0} style={{ flex: 2, padding: "10px", borderRadius: 10, background: rating > 0 ? "linear-gradient(135deg,#dc2626,#ef4444)" : "#e2e8f0", border: "none", color: rating > 0 ? "#fff" : "#94a3b8", fontSize: 13, fontWeight: 700, cursor: rating > 0 ? "pointer" : "default", fontFamily: "inherit" }}>
                Submit Rating ⭐
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ACTIVE TRACKER CARD
// ─────────────────────────────────────────────────────────────────────────────
function ActiveTrackerCard({
  req,
  expanded,
  onToggle,
  etaCountdown,
  onRate,
}: {
  req: EmergencyRequest;
  expanded: boolean;
  onToggle: () => void;
  etaCountdown?: number;
  onRate?: () => void;
}) {
  const emType = EMERGENCY_TYPE_MAP[req.type] || { icon: "🚨", color: "#ef4444", hotline: "112" };
  const sc = EM_STATUS_COLORS[req.status] || "#ef4444";
  const stepsToShow = EM_STATUS_STEPS.filter((s) => s !== "Matching");
  const activeIdx = stepsToShow.indexOf(req.status as any);

  const shareLocation = () => {
    if (!req.lat || !req.lng) return;
    const url = `https://maps.google.com/?q=${req.lat},${req.lng}`;
    if (navigator.share) {
      navigator.share({ title: `Emergency ${req.ticketId}`, text: "My emergency location", url }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(`🚨 Emergency ${req.ticketId}\nLocation: ${url}`).catch(() => {});
    }
  };

  return (
    <div style={{
      background: "linear-gradient(135deg,#0a0f1a,#111827)",
      border: `1.5px solid ${emType.color}44`,
      borderRadius: 16, overflow: "hidden", marginBottom: 10,
      boxShadow: `0 4px 20px ${emType.color}18`,
      animation: "em-fadein .3s ease",
    }}>
      <div style={{ height: 3, background: `linear-gradient(90deg,${emType.color},${emType.color}44)` }} />

      {/* Header */}
      <div onClick={onToggle} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", cursor: "pointer" }}>
        <div style={{
          width: 42, height: 42, borderRadius: 12,
          background: `${emType.color}18`, border: `1.5px solid ${emType.color}35`,
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0,
        }}>{emType.icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#f1f5f9" }}>
            {req.subType || req.type.charAt(0).toUpperCase() + req.type.slice(1)} Emergency
          </div>
          <div style={{ fontSize: 10, color: "#475569", fontFamily: "monospace", marginTop: 1 }}>{req.ticketId}</div>
        </div>
        <div style={{
          display: "flex", alignItems: "center", gap: 5, padding: "4px 10px",
          borderRadius: 20, background: `${sc}15`, border: `1px solid ${sc}35`,
        }}>
          <div style={{
            width: 6, height: 6, borderRadius: "50%", background: sc,
            animation: req.status !== "Arrived" && req.status !== "Resolved" ? "em-pulse 1.5s infinite" : "none",
          }} />
          <span style={{ fontSize: 10.5, color: sc, fontWeight: 700 }}>{EM_STATUS_LABELS[req.status]}</span>
        </div>
        <svg style={{ color: "#475569", transform: expanded ? "rotate(180deg)" : "none", transition: "transform .2s", flexShrink: 0 }}
          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M6 9l6 6 6-6" strokeLinecap="round" />
        </svg>
      </div>

      {/* Progress steps */}
      <div style={{ padding: "0 16px 12px" }}>
        <div style={{ display: "flex", alignItems: "center" }}>
          {stepsToShow.map((step, i) => {
            const isDone = i <= activeIdx;
            const isActive = i === activeIdx;
            const stepColor = EM_STATUS_COLORS[step];
            return (
              <div key={step} style={{ display: "flex", alignItems: "center", flex: i < stepsToShow.length - 1 ? 1 : "none" }}>
                <div style={{ position: "relative", flexShrink: 0 }}>
                  {isActive && (
                    <div style={{ position: "absolute", inset: -4, borderRadius: "50%", background: stepColor, opacity: 0, animation: "em-pulse 1.5s ease-out infinite" }} />
                  )}
                  <div style={{
                    width: 28, height: 28, borderRadius: "50%",
                    background: isDone ? `${stepColor}20` : "rgba(255,255,255,.03)",
                    border: `2px solid ${isDone ? stepColor : "rgba(255,255,255,.06)"}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 11, flexShrink: 0,
                    boxShadow: isActive ? `0 0 12px ${stepColor}` : "none",
                    transition: "all .3s",
                  }}>
                    {isDone && i < activeIdx
                      ? <span style={{ color: stepColor, fontSize: 10 }}>✓</span>
                      : <span>{EM_STATUS_ICONS[step]}</span>}
                  </div>
                </div>
                {i < stepsToShow.length - 1 && (
                  <div style={{
                    flex: 1, height: 2, margin: "0 4px",
                    background: i < activeIdx
                      ? `linear-gradient(90deg,${EM_STATUS_COLORS[step]},${EM_STATUS_COLORS[stepsToShow[i + 1]]})`
                      : "rgba(255,255,255,.05)",
                    transition: "background .5s",
                  }} />
                )}
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", marginTop: 5 }}>
          {stepsToShow.map((step, i) => (
            <div key={step} style={{
              flex: i < stepsToShow.length - 1 ? 1 : "none",
              fontSize: 8.5,
              color: i <= activeIdx ? EM_STATUS_COLORS[step] : "#334155",
              fontWeight: i === activeIdx ? 800 : 500,
              textAlign: "center" as const,
            }}>
              {EM_STATUS_LABELS[step].split(" ")[0]}
            </div>
          ))}
        </div>
      </div>

      {/* AI severity badge */}
      {req.aiSeverityLabel && (
        <div style={{ padding: "0 16px 10px" }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 10px",
            borderRadius: 20, background: "rgba(139,92,246,.12)", border: "1px solid rgba(139,92,246,.25)",
          }}>
            <span style={{ fontSize: 10 }}>🤖</span>
            <span style={{ fontSize: 10.5, color: "#c4b5fd", fontWeight: 700 }}>
              AI: {req.aiSeverityLabel} · {req.aiSeverityScore}%
            </span>
          </div>
        </div>
      )}

      {/* Expanded */}
      {expanded && (
        <div style={{ padding: "0 16px 16px", display: "flex", flexDirection: "column", gap: 10, borderTop: "1px solid rgba(255,255,255,.04)" }}>

          {/* ETA card — Swiggy style */}
          {req.status === "Responder_EnRoute" && req.assignedResponderName && (
            <div style={{
              padding: "14px", borderRadius: 12, marginTop: 8,
              background: "rgba(59,130,246,.08)", border: "1px solid rgba(59,130,246,.2)",
              display: "flex", alignItems: "center", gap: 12,
            }}>
              <div style={{
                width: 48, height: 48, borderRadius: 12,
                background: "rgba(59,130,246,.15)", border: "1px solid rgba(59,130,246,.3)",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0,
              }}>{emType.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#93c5fd" }}>
                  {req.assignedResponderName} is on the way
                </div>
                {req.assignedResponderPhone && (
                  <div style={{ fontSize: 11, color: "#475569", marginTop: 1 }}>📞 {req.assignedResponderPhone}</div>
                )}
                <div style={{ display: "flex", gap: 14, marginTop: 6 }}>
                  {(etaCountdown !== undefined ? etaCountdown : req.etaMinutes) !== undefined && (
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <span style={{ fontSize: 14 }}>⏱️</span>
                      <div>
                        <div style={{ fontSize: 18, fontWeight: 900, color: "#60a5fa", lineHeight: 1 }}>
                          ~{etaCountdown !== undefined ? etaCountdown : req.etaMinutes}
                        </div>
                        <div style={{ fontSize: 9, color: "#475569" }}>min ETA</div>
                      </div>
                    </div>
                  )}
                  {req.distanceKm && (
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <span style={{ fontSize: 14 }}>📍</span>
                      <div>
                        <div style={{ fontSize: 18, fontWeight: 900, color: "#60a5fa", lineHeight: 1 }}>
                          {req.distanceKm.toFixed(1)}
                        </div>
                        <div style={{ fontSize: 9, color: "#475569" }}>km away</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <a href={`tel:${req.assignedResponderPhone || emType.hotline}`} style={{
                padding: "8px 14px", borderRadius: 10,
                background: "linear-gradient(135deg,#1d4ed8,#3b82f6)",
                color: "#fff", fontSize: 12, fontWeight: 700, textDecoration: "none",
                display: "flex", alignItems: "center", gap: 5, flexShrink: 0,
              }}>📞 Call</a>
            </div>
          )}

          {/* Arrived */}
          {req.status === "Arrived" && (
            <div style={{
              padding: "12px 14px", borderRadius: 12, marginTop: 8,
              background: "rgba(139,92,246,.08)", border: "1px solid rgba(139,92,246,.3)",
              display: "flex", alignItems: "center", gap: 10,
            }}>
              <span style={{ fontSize: 24 }}>🏥</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#c4b5fd" }}>Responder has arrived!</div>
                {req.assignedResponderName && (
                  <div style={{ fontSize: 11, color: "#6d28d9", marginTop: 1 }}>
                    {req.assignedResponderName} is at your location
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Resolved + Rate */}
          {req.status === "Resolved" && !req.citizenRating && onRate && (
            <div style={{ marginTop: 8 }}>
              <div style={{
                padding: "12px 14px", borderRadius: 12,
                background: "rgba(16,185,129,.08)", border: "1px solid rgba(16,185,129,.2)",
                marginBottom: 10, display: "flex", alignItems: "center", gap: 10,
              }}>
                <span style={{ fontSize: 22 }}>✅</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#4ade80" }}>Emergency Resolved!</div>
                  <div style={{ fontSize: 11, color: "#059669" }}>Please rate the response quality</div>
                </div>
              </div>
              <button onClick={onRate} style={{
                width: "100%", padding: "12px", borderRadius: 11,
                background: "linear-gradient(135deg,#d97706,#f59e0b)",
                border: "none", color: "#fff", fontSize: 13, fontWeight: 800,
                cursor: "pointer", fontFamily: "inherit",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                boxShadow: "0 4px 14px rgba(245,158,11,.35)",
              }}>
                ⭐ Rate the Emergency Response (Step 10)
              </button>
            </div>
          )}

          {/* Rating submitted */}
          {req.citizenRating && (
            <div style={{ padding: "10px 12px", borderRadius: 10, background: "rgba(245,158,11,.1)", border: "1px solid rgba(245,158,11,.2)", marginTop: 6 }}>
              <div style={{ fontSize: 10, color: "#d97706", fontWeight: 700, marginBottom: 4 }}>YOUR RATING</div>
              <div style={{ display: "flex", gap: 2, marginBottom: 4 }}>
                {[1, 2, 3, 4, 5].map((s) => (
                  <span key={s} style={{ fontSize: 16, color: s <= req.citizenRating! ? "#f59e0b" : "#1e293b" }}>★</span>
                ))}
              </div>
              {req.citizenFeedback && <div style={{ fontSize: 11, color: "#92400e" }}>{req.citizenFeedback}</div>}
            </div>
          )}

          {/* Hospital */}
          {req.nearestHospital && (
            <div style={{
              display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
              borderRadius: 10, background: "rgba(16,185,129,.06)", border: "1px solid rgba(16,185,129,.15)",
            }}>
              <span style={{ fontSize: 16 }}>🏥</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: "#4ade80" }}>{req.nearestHospital.name}</div>
                <div style={{ fontSize: 10.5, color: "#10b981" }}>{req.nearestHospital.type} · {req.nearestHospital.distance}</div>
              </div>
              <a href={`tel:${req.nearestHospital.phone}`} style={{
                fontSize: 10.5, color: "#4ade80", fontWeight: 700,
                background: "none", border: "1px solid rgba(16,185,129,.3)", borderRadius: 7,
                padding: "4px 10px", textDecoration: "none", flexShrink: 0,
              }}>📞 Call</a>
            </div>
          )}

          {/* First Aid */}
          {req.firstAidTips && req.firstAidTips.length > 0 && (
            <div style={{ padding: "10px 12px", borderRadius: 10, background: "rgba(59,130,246,.06)", border: "1px solid rgba(59,130,246,.12)" }}>
              <div style={{ fontSize: 10, color: "#60a5fa", fontWeight: 700, marginBottom: 6 }}>💊 FIRST AID GUIDE</div>
              {req.firstAidTips.slice(0, 3).map((tip, i) => (
                <div key={i} style={{ display: "flex", gap: 6, marginBottom: i < 2 ? 4 : 0 }}>
                  <span style={{ fontSize: 10.5, color: "#3b82f6", fontWeight: 700, flexShrink: 0 }}>{i + 1}.</span>
                  <span style={{ fontSize: 11, color: "#93c5fd", lineHeight: 1.4 }}>{tip}</span>
                </div>
              ))}
            </div>
          )}

          {/* Location */}
          {req.address && (
            <div style={{
              display: "flex", alignItems: "center", gap: 8, padding: "9px 12px",
              borderRadius: 9, background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.05)",
            }}>
              <span style={{ fontSize: 14 }}>📍</span>
              <span style={{ fontSize: 11, color: "#64748b", flex: 1 }}>{req.address}</span>
              {req.lat && req.lng && (
                <button onClick={shareLocation} style={{
                  fontSize: 10.5, color: "#3b82f6", fontWeight: 700,
                  background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", flexShrink: 0,
                }}>📤 Share</button>
              )}
            </div>
          )}

          {/* SMS Alert */}
          {req.smsAlertSent && (
            <div style={{
              display: "flex", alignItems: "center", gap: 8, padding: "8px 12px",
              borderRadius: 9, background: "rgba(16,185,129,.06)", border: "1px solid rgba(16,185,129,.15)",
            }}>
              <span style={{ fontSize: 14 }}>📱</span>
              <span style={{ fontSize: 11, color: "#10b981" }}>Emergency contacts alerted via SMS (Twilio)</span>
            </div>
          )}

          {/* Timeline */}
          {req.timeline && req.timeline.length > 0 && (
            <div>
              <div style={{ fontSize: 9.5, color: "#475569", fontWeight: 700, letterSpacing: ".08em", marginBottom: 8 }}>ACTIVITY LOG</div>
              {[...req.timeline].reverse().slice(0, 5).map((ev, i) => (
                <div key={ev.id} style={{ display: "flex", gap: 10, marginBottom: i < 4 ? 8 : 0 }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: "50%",
                    background: `${ev.color}15`, border: `1.5px solid ${ev.color}`,
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, flexShrink: 0,
                  }}>{ev.icon}</div>
                  <div style={{ paddingTop: 2 }}>
                    <div style={{ fontSize: 11.5, fontWeight: 600, color: "#e2e8f0" }}>{ev.event}</div>
                    {ev.note && <div style={{ fontSize: 10.5, color: "#475569", marginTop: 1, lineHeight: 1.4 }}>{ev.note}</div>}
                    <div style={{ fontSize: 9.5, color: "#334155", marginTop: 1 }}>
                      {ev.actor && <span>{ev.actor} · </span>}
                      {new Date(ev.time).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <a href="tel:112" style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            padding: "10px", borderRadius: 10,
            background: "linear-gradient(135deg,#7f1d1d,#991b1b)",
            border: "1px solid rgba(239,68,68,.3)", color: "#fca5a5",
            fontSize: 12.5, fontWeight: 700, textDecoration: "none",
            boxShadow: "0 4px 14px rgba(239,68,68,.2)",
          }}>
            📞 Call AP Emergency — 112
          </a>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────
export default function LiveResponderTracker({ citizenId, citizenName }: Props) {
  const [requests, setRequests] = useState<EmergencyRequest[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [etaCountdowns, setEtaCountdowns] = useState<Record<string, number>>({});
  const [ratingReq, setRatingReq] = useState<EmergencyRequest | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const simulateRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = () => {
    const all = emLoad();
    const mine = all.filter((r) => r.citizenId === citizenId || r.citizenName === citizenName);
    setRequests(mine);
    mine.forEach((r) => {
      if (r.etaMinutes && r.status === "Responder_EnRoute") {
        const dispatched = r.dispatchedAt ? new Date(r.dispatchedAt).getTime() : Date.now();
        const elapsed = Math.floor((Date.now() - dispatched) / 60000);
        const remaining = Math.max(0, r.etaMinutes - elapsed);
        setEtaCountdowns((prev) => ({ ...prev, [r.id]: remaining }));
      }
    });
  };

  useEffect(() => {
    load();
    const iv = setInterval(load, 3000);
    window.addEventListener("storage", load);
    return () => { clearInterval(iv); window.removeEventListener("storage", load); };
  }, [citizenId, citizenName]);

  // ETA countdown every 30s
  useEffect(() => {
    countdownRef.current = setInterval(() => {
      setEtaCountdowns((prev) => {
        const next = { ...prev };
        Object.keys(next).forEach((id) => { if (next[id] > 0) next[id]--; });
        return next;
      });
    }, 30000);
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, []);

  // Demo simulation: auto-assign responder to SOS_Sent after 5s
  useEffect(() => {
    simulateRef.current = setInterval(() => {
      const mine = emLoad().filter(
        (r) => (r.citizenId === citizenId || r.citizenName === citizenName)
      );
      mine.forEach((r) => {
        if (r.status === "SOS_Sent") {
          // Simulate worker accepting after 5s
          const age = (Date.now() - new Date(r.createdAt).getTime()) / 1000;
          if (age > 5 && age < 10) {
            const responder = RESPONDER_NAMES[Math.floor(Math.random() * RESPONDER_NAMES.length)];
            const now = new Date().toISOString();
            const updated: EmergencyRequest = {
              ...r,
              status: "Responder_EnRoute",
              assignedResponderName: responder,
              assignedResponderPhone: `98${Math.floor(Math.random() * 100000000).toString().padStart(8, "0")}`,
              etaMinutes: Math.floor(Math.random() * 8) + 4,
              distanceKm: parseFloat((Math.random() * 3 + 0.5).toFixed(1)),
              dispatchedAt: now,
              updatedAt: now,
              timeline: [
                ...(r.timeline || []),
                {
                  id: `tl-dispatch-${Date.now()}`,
                  event: `Responder ${responder} accepted & dispatched`,
                  note: "En route to your location with live GPS tracking",
                  actor: "System",
                  time: now,
                  icon: "🚀",
                  color: "#3b82f6",
                },
              ],
            };
            emSave(updated);
          }
        }
      });
    }, 3000);
    return () => { if (simulateRef.current) clearInterval(simulateRef.current); };
  }, [citizenId, citizenName]);

  const handleRating = (req: EmergencyRequest, rating: number, feedback: string) => {
    const updated: EmergencyRequest = {
      ...req,
      citizenRating: rating,
      citizenFeedback: feedback,
      updatedAt: new Date().toISOString(),
      timeline: [
        ...(req.timeline || []),
        {
          id: `tl-rate-${Date.now()}`,
          event: `Citizen rated: ${rating}/5 stars`,
          note: feedback || "No comment",
          actor: req.citizenName,
          time: new Date().toISOString(),
          icon: "⭐",
          color: "#f59e0b",
        },
      ],
    };
    emSave(updated);
    setRatingReq(null);
    load();
  };

  if (requests.length === 0) return null;

  const active = requests.filter((r) => !["Resolved", "Cancelled"].includes(r.status));
  const resolved = requests.filter((r) => r.status === "Resolved");
  const resolvedUnrated = resolved.filter((r) => !r.citizenRating);

  return (
    <div style={{ marginBottom: 12 }}>
      <style>{`
        @keyframes em-fadein{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes em-pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(1.4)}}
      `}</style>

      {ratingReq && (
        <RatingModal
          request={ratingReq}
          onClose={() => setRatingReq(null)}
          onSubmit={(rating, feedback) => handleRating(ratingReq, rating, feedback)}
        />
      )}

      {active.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#ef4444", animation: "em-pulse 1s ease-in-out infinite" }} />
          <span style={{ fontSize: 11, fontWeight: 800, color: "#ef4444", letterSpacing: ".1em" }}>
            📡 LIVE EMERGENCY TRACKING — {active.length} ACTIVE
          </span>
        </div>
      )}

      {active.map((req) => (
        <ActiveTrackerCard
          key={req.id}
          req={req}
          expanded={expanded === req.id}
          onToggle={() => setExpanded(expanded === req.id ? null : req.id)}
          etaCountdown={etaCountdowns[req.id]}
        />
      ))}

      {/* Resolved + unrated */}
      {resolvedUnrated.map((req) => (
        <div key={req.id} style={{
          padding: "10px 14px", borderRadius: 11, marginBottom: 8,
          background: "rgba(245,158,11,.08)", border: "1px solid rgba(245,158,11,.25)",
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <span style={{ fontSize: 18 }}>✅</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: "#fbbf24" }}>
              {req.subType || req.type} Emergency Resolved
            </div>
            <div style={{ fontSize: 10.5, color: "#475569", fontFamily: "monospace" }}>{req.ticketId}</div>
          </div>
          <button onClick={() => setRatingReq(req)} style={{
            padding: "6px 12px", borderRadius: 9,
            background: "linear-gradient(135deg,#d97706,#f59e0b)",
            border: "none", color: "#fff", fontSize: 11, fontWeight: 700,
            cursor: "pointer", fontFamily: "inherit",
          }}>⭐ Rate</button>
        </div>
      ))}

      {resolved.filter((r) => r.citizenRating).length > 0 && (
        <div style={{
          padding: "8px 14px", borderRadius: 10,
          background: "rgba(16,185,129,.06)", border: "1px solid rgba(16,185,129,.2)",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <span style={{ fontSize: 14 }}>✅</span>
          <span style={{ fontSize: 12, color: "#10b981", fontWeight: 600 }}>
            {resolved.filter((r) => r.citizenRating).length} emergency{resolved.filter((r) => r.citizenRating).length !== 1 ? "s" : ""} resolved & rated
          </span>
        </div>
      )}
    </div>
  );
}