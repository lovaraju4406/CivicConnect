// CitizenEmergencySection.tsx
// Complete 10-step citizen emergency flow:
// SOS → GPS → Photo/Voice → AI Severity → Submit → Worker Matching →
// Live Tracking → SMS Contacts → First Aid AI → Hospital → Completion/Rating

import { useState, useEffect, useCallback, useRef } from "react";
import EmergencyButtons from "./EmergencyButtons";
import LiveResponderTracker from "./LiveResponderTracker";
import AreaRiskIndicator from "./AreaRiskIndicator";

// ── TYPES ──────────────────────────────────────────────────────────────────────
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
  voiceNote?: string;
  aiSeverityScore?: number;
  aiSeverityLabel?: string;
  victimCount?: number;
  injurySeverity?: "Minor" | "Moderate" | "Severe" | "Critical";
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

function genId() {
  return `ems-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
}
function genTicket() {
  return `EMS-${new Date().getFullYear()}-${Math.random()
    .toString(36)
    .substr(2, 6)
    .toUpperCase()}`;
}

// ── SOS TYPES ──────────────────────────────────────────────────────────────────
const SOS_TYPES = [
  {
    id: "medical",
    label: "Medical",
    icon: "🚑",
    color: "#ef4444",
    desc: "Heart attack, injury, unconscious",
    firstAid: [
      "Keep the patient calm and still",
      "Do NOT give water or food",
      "If unconscious, check breathing — start CPR if needed",
      "Stop any bleeding with firm pressure",
      "Keep them warm with a blanket",
    ],
    hospital: "Trauma / Emergency",
  },
  {
    id: "accident",
    label: "Road Accident",
    icon: "🚗",
    color: "#f97316",
    desc: "Road accident, crash",
    firstAid: [
      "Turn off vehicle ignition — fire risk",
      "Do NOT move injured persons unless fire risk",
      "Apply pressure to bleeding wounds",
      "Keep airways clear — tilt head gently",
      "Note vehicle numbers for police",
    ],
    hospital: "Trauma Center",
  },
  {
    id: "fire",
    label: "Fire",
    icon: "🔥",
    color: "#dc2626",
    desc: "House fire, gas leak, explosion",
    firstAid: [
      "Evacuate immediately — do NOT use lift",
      "Cover mouth with wet cloth, stay low",
      "Close doors to slow fire spread",
      "Meet at building assembly point",
      "Do NOT re-enter the building",
    ],
    hospital: "Burns Unit",
  },
  {
    id: "flood",
    label: "Flood",
    icon: "🌊",
    color: "#0ea5e9",
    desc: "Flooding, water emergency",
    firstAid: [
      "Move immediately to higher ground",
      "Do NOT walk in moving water",
      "Stay away from drains and manholes",
      "Disconnect electrical appliances",
      "Signal for help from a high point",
    ],
    hospital: "General Hospital",
  },
  {
    id: "collapse",
    label: "Collapse",
    icon: "🏗️",
    color: "#92400e",
    desc: "Building collapse, structural",
    firstAid: [
      "Move 50m away from the structure",
      "Call out to locate survivors",
      "Do NOT use heavy machinery — hand removal only",
      "Watch for gas leaks or fire",
      "Mark the collapse area with barriers",
    ],
    hospital: "Trauma / Ortho",
  },
  {
    id: "dv",
    label: "Violence",
    icon: "🛡️",
    color: "#ec4899",
    desc: "Domestic violence, assault",
    firstAid: [
      "Move to a safe location immediately",
      "Preserve evidence — do not disturb the scene",
      "Document injuries with photos",
      "Contact trusted person for support",
      "Request police escort if needed",
    ],
    hospital: "General Hospital",
  },
  {
    id: "missing",
    label: "Missing Person",
    icon: "🔍",
    color: "#8b5cf6",
    desc: "Missing person, child",
    firstAid: [
      "Note last known location and time",
      "Collect recent photo and description",
      "Check nearby places they frequent",
      "Inform school/workplace immediately",
      "Do NOT post on social media yet",
    ],
    hospital: "—",
  },
  {
    id: "other",
    label: "Other",
    icon: "🚨",
    color: "#64748b",
    desc: "Any other emergency",
    firstAid: [
      "Stay calm and assess the situation",
      "Ensure your own safety first",
      "Keep bystanders at a safe distance",
      "Document what you see",
      "Cooperate with responding officers",
    ],
    hospital: "Nearest Hospital",
  },
];

// Nearest hospitals mock (in real app — Google Places API by category)
const HOSPITAL_DB: Record<string, { name: string; distance: string; phone: string; type: string }> = {
  medical:  { name: "GGH Rajamahendravaram", distance: "1.8 km", phone: "0883-2459061", type: "Trauma / Emergency" },
  accident: { name: "Govt. Trauma Centre, Eluru", distance: "2.3 km", phone: "08812-222222", type: "Trauma Center" },
  fire:     { name: "King George Hospital Burns Unit", distance: "3.1 km", phone: "0891-2564590", type: "Burns Unit" },
  flood:    { name: "GGH Rajamahendravaram", distance: "1.8 km", phone: "0883-2459061", type: "General" },
  collapse: { name: "Govt. Orthopaedic Hospital", distance: "2.6 km", phone: "0883-2470987", type: "Ortho / Trauma" },
  dv:       { name: "Women's Hospital, AP", distance: "2.0 km", phone: "0883-2458123", type: "General" },
  default:  { name: "GGH Rajamahendravaram", distance: "1.8 km", phone: "0883-2459061", type: "General" },
};

// AI severity classifier mock (in real — CNN on uploaded image)
function classifySeverity(type: string, victimCount: number): { score: number; label: string } {
  const base: Record<string, number> = {
    medical: 85, accident: 78, fire: 90, flood: 65, collapse: 92, dv: 70, missing: 50, other: 45,
  };
  const score = Math.min(99, (base[type] || 60) + victimCount * 3);
  const label =
    score >= 85 ? "CRITICAL" : score >= 70 ? "SEVERE" : score >= 50 ? "MODERATE" : "MINOR";
  return { score, label };
}

// Props
interface Props {
  userId: string;
  userName: string;
  onReportEmergency?: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP INDICATOR
// ─────────────────────────────────────────────────────────────────────────────
function StepBadge({ step, total, label }: { step: number; total: number; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
      <div style={{
        width: 28, height: 28, borderRadius: "50%",
        background: "linear-gradient(135deg,#dc2626,#ef4444)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 12, fontWeight: 900, color: "#fff", flexShrink: 0,
        boxShadow: "0 2px 8px rgba(239,68,68,.4)",
      }}>{step}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 10, color: "#ef4444", fontWeight: 700, letterSpacing: ".1em" }}>
          STEP {step} OF {total}
        </div>
        <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a" }}>{label}</div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SOS SENDER — full 4-step flow
// ─────────────────────────────────────────────────────────────────────────────
function SOSSender({ userId, userName }: { userId: string; userName: string }) {
  const [step, setStep] = useState<"idle" | "select" | "details" | "ai" | "sent">("idle");
  const [selectedType, setSelectedType] = useState<(typeof SOS_TYPES)[0] | null>(null);
  const [description, setDescription] = useState("");
  const [silentMode, setSilentMode] = useState(false);
  const [victimCount, setVictimCount] = useState(1);
  const [severity, setSeverity] = useState<"Minor" | "Moderate" | "Severe" | "Critical">("Moderate");
  const [image, setImage] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [locating, setLocating] = useState(false);
  const [loc, setLoc] = useState<{ lat: number; lng: number; address: string } | null>(null);
  const [sending, setSending] = useState(false);
  const [sentRequest, setSentRequest] = useState<EmergencyRequest | null>(null);
  const [aiResult, setAiResult] = useState<{ score: number; label: string } | null>(null);
  const [matchingWorkers, setMatchingWorkers] = useState(false);
  const [smsAlertSent, setSmsAlertSent] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const holdRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const holdStart = useRef(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const HOLD_MS = 2000;

  // Step 1 → 2: GPS capture
  useEffect(() => {
    if (step !== "details") return;
    setLocating(true);
    navigator.geolocation?.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        try {
          const r = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`
          );
          const d = await r.json();
          setLoc({
            lat,
            lng,
            address:
              d.display_name?.split(",").slice(0, 3).join(", ") ||
              `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
          });
        } catch {
          setLoc({ lat, lng, address: `${lat.toFixed(4)}, ${lng.toFixed(4)}` });
        }
        setLocating(false);
      },
      () => {
        setLoc({ lat: 16.5062, lng: 80.648, address: "Rajamahendravaram, AP" });
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [step]);

  // Step 3 → AI severity when going to ai step
  useEffect(() => {
    if (step !== "ai" || !selectedType) return;
    const r = classifySeverity(selectedType.id, victimCount);
    setAiResult(r);
  }, [step, selectedType, victimCount]);

  const handleImage = (file: File) => {
    if (file.size > 5 * 1024 * 1024) { alert("Image must be < 5MB"); return; }
    const reader = new FileReader();
    reader.onload = (e) => setImage(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const startHold = () => {
    holdStart.current = Date.now();
    holdRef.current = setInterval(() => {
      const pct = Math.min(((Date.now() - holdStart.current) / HOLD_MS) * 100, 100);
      setHoldProgress(pct);
      if (pct >= 100) {
        clearInterval(holdRef.current!);
        sendSOS();
      }
    }, 16);
  };

  const cancelHold = () => {
    if (holdRef.current) clearInterval(holdRef.current);
    setHoldProgress(0);
  };

  const sendSOS = async () => {
    setSending(true);

    // Step 4: Matching engine simulation
    setMatchingWorkers(true);
    await new Promise((r) => setTimeout(r, 1500));
    setMatchingWorkers(false);

    // Step 5: SMS alert simulation
    setSmsAlertSent(true);
    await new Promise((r) => setTimeout(r, 600));

    const now = new Date().toISOString();
    const ticket = genTicket();
    const ai = aiResult || classifySeverity(selectedType?.id || "other", victimCount);
    const hospital =
      HOSPITAL_DB[selectedType?.id || "default"] || HOSPITAL_DB["default"];

    const req: EmergencyRequest = {
      id: genId(),
      ticketId: ticket,
      type: selectedType?.id || "other",
      subType: selectedType?.label,
      priority: ai.label === "CRITICAL" ? "CRITICAL" : ai.label === "SEVERE" ? "HIGH" : "MEDIUM",
      status: "SOS_Sent",
      citizenId: userId,
      citizenName: userName,
      lat: loc?.lat,
      lng: loc?.lng,
      address: loc?.address,
      description,
      photoUrl: image || undefined,
      aiSeverityScore: ai.score,
      aiSeverityLabel: ai.label,
      victimCount,
      injurySeverity: severity,
      isSilentMode: silentMode,
      nearestHospital: hospital,
      firstAidTips: selectedType?.firstAid,
      smsAlertSent: true,
      createdAt: now,
      updatedAt: now,
      timeline: [
        {
          id: "tl-sos",
          event: "SOS submitted by citizen",
          note: `${selectedType?.label} · AI severity: ${ai.label} (${ai.score}%) · ${victimCount} person(s)${silentMode ? " · 🤫 Silent" : ""}`,
          actor: userName,
          time: now,
          icon: "📡",
          color: "#ef4444",
        },
        {
          id: "tl-gps",
          event: "GPS location captured",
          note: loc?.address || "Location not available",
          actor: "System",
          time: now,
          icon: "📍",
          color: "#3b82f6",
        },
        {
          id: "tl-ai",
          event: `AI severity classified: ${ai.label}`,
          note: `Score: ${ai.score}/100 — Priority: ${ai.label === "CRITICAL" ? "CRITICAL" : ai.label === "SEVERE" ? "HIGH" : "MEDIUM"}`,
          actor: "AI Engine",
          time: now,
          icon: "🤖",
          color: "#8b5cf6",
        },
        {
          id: "tl-match",
          event: "Worker matching engine fired",
          note: "Top 3 nearest available workers notified via Socket.io",
          actor: "System",
          time: now,
          icon: "🔍",
          color: "#f97316",
        },
        {
          id: "tl-sms",
          event: "Emergency contacts alerted via SMS",
          note: "Twilio SMS with GPS location link sent to pre-saved contacts",
          actor: "System",
          time: now,
          icon: "📱",
          color: "#10b981",
        },
      ],
    };

    emSave(req);
    setSentRequest(req);
    setSending(false);
    setHoldProgress(0);
    setStep("sent");
  };

  const reset = () => {
    setStep("idle");
    setSelectedType(null);
    setDescription("");
    setSilentMode(false);
    setVictimCount(1);
    setSeverity("Moderate");
    setLoc(null);
    setImage(null);
    setAiResult(null);
    setSentRequest(null);
    setSmsAlertSent(false);
    setHoldProgress(0);
  };

  // ── IDLE ────────────────────────────────────────────────────────────────────
  if (step === "idle")
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20, padding: "20px 16px" }}>
        <style>{`
          @keyframes sos-ring{0%{transform:scale(1);opacity:.5}100%{transform:scale(2.4);opacity:0}}
          @keyframes sos-pulse{0%,100%{opacity:1}50%{opacity:.55}}
        `}</style>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 11.5, fontWeight: 800, color: "#ef4444", letterSpacing: ".14em", marginBottom: 6 }}>
            CITIZEN SOS — 10-STEP RESPONSE SYSTEM
          </div>
          <div style={{ fontSize: 12.5, color: "#64748b", lineHeight: 1.6 }}>
            One tap sends your live GPS to nearest responder<br />
            AI classifies severity · SMS alerts your contacts
          </div>
        </div>

        {/* Big SOS */}
        <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", margin: "8px 0" }}>
          {[1, 2, 3].map((i) => (
            <div key={i} style={{
              position: "absolute",
              width: 100 + i * 48, height: 100 + i * 48,
              borderRadius: "50%",
              border: `${4 - i}px solid rgba(239,68,68,${0.22 - i * 0.06})`,
              animation: `sos-pulse ${1.4 + i * 0.4}s ease-in-out infinite`,
            }} />
          ))}
          <button
            onClick={() => setStep("select")}
            style={{
              width: 136, height: 136, borderRadius: "50%",
              background: "linear-gradient(145deg,#b91c1c,#ef4444)",
              border: "4px solid rgba(255,255,255,.2)",
              boxShadow: "0 0 0 8px rgba(239,68,68,.2),0 14px 44px rgba(239,68,68,.55)",
              cursor: "pointer", display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", gap: 4,
              position: "relative", zIndex: 2, transition: "transform .15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.05)")}
            onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
          >
            <span style={{ fontSize: 38, lineHeight: 1 }}>🆘</span>
            <span style={{ fontSize: 16, fontWeight: 900, color: "#fff", letterSpacing: ".06em" }}>SOS</span>
            <span style={{ fontSize: 9.5, color: "rgba(255,255,255,.75)", fontWeight: 600 }}>TAP TO START</span>
          </button>
        </div>

        {/* 10-step mini flow */}
        <div style={{
          width: "100%", padding: "14px 16px", borderRadius: 12,
          background: "rgba(239,68,68,.04)", border: "1px solid rgba(239,68,68,.12)",
        }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: "#ef4444", letterSpacing: ".1em", marginBottom: 10 }}>
            WHAT HAPPENS AFTER YOU TAP
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 12px" }}>
            {[
              ["📡", "SOS sent with GPS"],
              ["🤖", "AI classifies severity"],
              ["🔍", "Nearest worker matched"],
              ["📱", "SMS to emergency contacts"],
              ["🗺️", "Worker tracked live"],
              ["🏥", "Hospital suggested"],
              ["💊", "First aid guide shown"],
              ["✅", "Resolved + you rate"],
            ].map(([icon, label]) => (
              <div key={label as string} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 12 }}>{icon}</span>
                <span style={{ fontSize: 10.5, color: "#64748b" }}>{label as string}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );

  // ── SELECT TYPE ────────────────────────────────────────────────────────────
  if (step === "select")
    return (
      <div>
        <StepBadge step={1} total={4} label="Select Emergency Type" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
          {SOS_TYPES.map((t) => (
            <button
              key={t.id}
              onClick={() => { setSelectedType(t); setStep("details"); }}
              style={{
                display: "flex", alignItems: "center", gap: 10, padding: "12px 14px",
                borderRadius: 12, background: "#fff", border: `1.5px solid ${t.color}25`,
                cursor: "pointer", fontFamily: "inherit", transition: "all .15s", textAlign: "left",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = `${t.color}10`; e.currentTarget.style.borderColor = `${t.color}55`; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.borderColor = `${t.color}25`; }}
            >
              <div style={{
                width: 40, height: 40, borderRadius: 11, flexShrink: 0,
                background: `${t.color}15`, display: "flex", alignItems: "center",
                justifyContent: "center", fontSize: 20,
              }}>{t.icon}</div>
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: "#0f172a" }}>{t.label}</div>
                <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 1, lineHeight: 1.3 }}>{t.desc}</div>
              </div>
            </button>
          ))}
        </div>
        <button onClick={reset} style={{ fontSize: 12, color: "#94a3b8", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>← Cancel</button>
      </div>
    );

  // ── DETAILS: GPS + Photo + Voice ────────────────────────────────────────────
  if (step === "details" && selectedType)
    return (
      <div>
        <StepBadge step={2} total={4} label={`${selectedType.icon} ${selectedType.label} — Location & Evidence`} />

        {/* GPS Status */}
        <div style={{
          padding: "11px 13px", borderRadius: 11, marginBottom: 12,
          background: loc ? "#f0fdf4" : locating ? "#fffbeb" : "#f8fafc",
          border: `1.5px solid ${loc ? "#bbf7d0" : locating ? "#fde68a" : "#e2e8f0"}`,
          display: "flex", alignItems: "center", gap: 9,
        }}>
          <span style={{ fontSize: 16 }}>{locating ? "⏳" : loc ? "📍" : "⚠️"}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: loc ? "#15803d" : "#d97706" }}>
              {locating ? "Step 2: Capturing GPS location…" : loc ? "✓ GPS Location Captured" : "Location not found"}
            </div>
            {loc && <div style={{ fontSize: 10.5, color: "#16a34a", marginTop: 1 }}>{loc.address}</div>}
            {loc && (
              <div style={{ fontSize: 9.5, color: "#64748b", fontFamily: "monospace", marginTop: 1 }}>
                {loc.lat.toFixed(6)}, {loc.lng.toFixed(6)}
              </div>
            )}
          </div>
        </div>

        {/* Photo Upload */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: "#374151", marginBottom: 7, letterSpacing: ".06em" }}>
            📷 PHOTO EVIDENCE{" "}
            <span style={{ color: "#94a3b8", fontWeight: 400 }}>(optional · AI reads this to assess severity)</span>
          </div>
          {image ? (
            <div style={{ position: "relative", borderRadius: 11, overflow: "hidden", border: "2px solid #e2e8f0" }}>
              <img src={image} alt="Evidence" style={{ width: "100%", height: 160, objectFit: "cover" }} />
              <button
                onClick={() => setImage(null)}
                style={{ position: "absolute", top: 7, right: 7, width: 26, height: 26, borderRadius: "50%", background: "rgba(0,0,0,.6)", border: "none", color: "#fff", cursor: "pointer", fontSize: 11 }}
              >✕</button>
              <div style={{ position: "absolute", bottom: 8, left: 8, background: "rgba(0,0,0,.6)", borderRadius: 6, padding: "3px 8px", fontSize: 10, color: "#fff" }}>
                ✓ Photo attached — AI will classify severity
              </div>
            </div>
          ) : (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f && f.type.startsWith("image/")) handleImage(f); }}
              onClick={() => fileRef.current?.click()}
              style={{
                border: `2px dashed ${dragOver ? "#ef4444" : "#e2e8f0"}`,
                borderRadius: 11, padding: "20px", textAlign: "center",
                cursor: "pointer", background: dragOver ? "rgba(239,68,68,.04)" : "#fafafa", transition: "all .2s",
              }}
            >
              <div style={{ fontSize: 26, marginBottom: 6 }}>📷</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>Drop photo or tap to upload</div>
              <div style={{ fontSize: 10.5, color: "#94a3b8", marginTop: 3 }}>AI CNN model classifies severity · JPG/PNG · Max 5MB</div>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImage(f); }} />
            </div>
          )}
        </div>

        {/* Victim count + silent */}
        <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: "#374151", marginBottom: 6, letterSpacing: ".06em" }}>👥 PEOPLE AFFECTED</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button onClick={() => setVictimCount(Math.max(1, victimCount - 1))} style={{ width: 32, height: 32, borderRadius: 8, border: "1.5px solid #e2e8f0", background: "#f8fafc", cursor: "pointer", fontSize: 16, fontWeight: 700, color: "#374151" }}>−</button>
              <span style={{ fontSize: 20, fontWeight: 900, color: "#0f172a", minWidth: 28, textAlign: "center" }}>{victimCount}</span>
              <button onClick={() => setVictimCount(victimCount + 1)} style={{ width: 32, height: 32, borderRadius: 8, border: "1.5px solid #e2e8f0", background: "#f8fafc", cursor: "pointer", fontSize: 16, fontWeight: 700, color: "#374151" }}>+</button>
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: "#374151", marginBottom: 6, letterSpacing: ".06em" }}>🩺 SEVERITY</div>
            <div style={{ display: "flex", gap: 5 }}>
              {(["Minor", "Moderate", "Severe", "Critical"] as const).map((s) => {
                const cols = { Minor: "#22c55e", Moderate: "#f59e0b", Severe: "#f97316", Critical: "#ef4444" };
                const isA = severity === s;
                return (
                  <button key={s} onClick={() => setSeverity(s)} style={{
                    padding: "5px 7px", borderRadius: 7, fontSize: 9.5, fontWeight: 700,
                    border: `1.5px solid ${isA ? cols[s] : "#e2e8f0"}`,
                    background: isA ? `${cols[s]}15` : "#f8fafc",
                    color: isA ? cols[s] : "#94a3b8",
                    cursor: "pointer", fontFamily: "inherit",
                  }}>{s}</button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Description */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: "#374151", marginBottom: 6, letterSpacing: ".06em" }}>📝 DESCRIBE (OPTIONAL)</div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Any details the responder should know…"
            rows={2}
            style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #e2e8f0", borderRadius: 10, fontSize: 12.5, fontFamily: "inherit", resize: "none", outline: "none", color: "#0f172a", background: "#f9fafb", lineHeight: 1.5 }}
            onFocus={(e) => (e.target.style.borderColor = "#ef4444")}
            onBlur={(e) => (e.target.style.borderColor = "#e2e8f0")}
          />
        </div>

        {/* Silent mode */}
        <div
          onClick={() => setSilentMode(!silentMode)}
          style={{
            display: "flex", alignItems: "center", gap: 10, padding: "10px 13px", borderRadius: 10,
            background: silentMode ? "#f5f3ff" : "#f8fafc",
            border: `1.5px solid ${silentMode ? "#8b5cf6" : "#e2e8f0"}`,
            cursor: "pointer", marginBottom: 16, transition: "all .15s",
          }}
        >
          <span style={{ fontSize: 18 }}>🤫</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: silentMode ? "#7c3aed" : "#374151" }}>Silent Mode</div>
            <div style={{ fontSize: 10.5, color: "#94a3b8" }}>Alert authorities without sound — for dangerous situations</div>
          </div>
          <div style={{ width: 40, height: 22, borderRadius: 11, background: silentMode ? "#8b5cf6" : "#e2e8f0", position: "relative", transition: "background .2s" }}>
            <div style={{ position: "absolute", top: 2, left: silentMode ? 20 : 2, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left .2s", boxShadow: "0 1px 4px rgba(0,0,0,.2)" }} />
          </div>
        </div>

        <div style={{ display: "flex", gap: 9 }}>
          <button onClick={() => setStep("select")} style={{ padding: "10px 18px", borderRadius: 10, background: "#f8fafc", border: "1.5px solid #e2e8f0", color: "#94a3b8", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>← Back</button>
          <button onClick={() => setStep("ai")} style={{ flex: 1, padding: "10px", borderRadius: 10, background: "linear-gradient(135deg,#dc2626,#ef4444)", border: "none", color: "#fff", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 4px 14px rgba(239,68,68,.35)" }}>
            Next → AI Analysis
          </button>
        </div>
      </div>
    );

  // ── AI ANALYSIS + REVIEW ────────────────────────────────────────────────────
  if (step === "ai" && selectedType)
    return (
      <div>
        <StepBadge step={3} total={4} label="AI Severity Analysis & Review" />

        {/* AI severity card */}
        {aiResult && (
          <div style={{
            padding: "16px 18px", borderRadius: 14, marginBottom: 14,
            background: "linear-gradient(135deg,#1e1b4b,#2e1065)",
            border: "1px solid rgba(139,92,246,.3)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(139,92,246,.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🤖</div>
              <div>
                <div style={{ fontSize: 10, color: "rgba(196,181,253,.6)", fontWeight: 700, letterSpacing: ".1em" }}>AI SEVERITY CLASSIFIER (CNN MODEL)</div>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#fff" }}>
                  {selectedType.icon} {aiResult.label} — {aiResult.score}/100
                </div>
              </div>
            </div>
            <div style={{ height: 8, background: "rgba(255,255,255,.08)", borderRadius: 4, overflow: "hidden", marginBottom: 8 }}>
              <div style={{
                height: "100%",
                width: `${aiResult.score}%`,
                background: aiResult.score >= 85 ? "#ef4444" : aiResult.score >= 70 ? "#f97316" : "#f59e0b",
                borderRadius: 4,
              }} />
            </div>
            <div style={{ fontSize: 11, color: "rgba(196,181,253,.6)" }}>
              Priority assigned:{" "}
              <strong style={{ color: aiResult.label === "CRITICAL" ? "#f87171" : aiResult.label === "SEVERE" ? "#fb923c" : "#fbbf24" }}>
                {aiResult.label === "CRITICAL" ? "CRITICAL" : aiResult.label === "SEVERE" ? "HIGH" : "MEDIUM"}
              </strong>{" "}
              · {victimCount} person(s) affected
            </div>
          </div>
        )}

        {/* Hospital suggestion (Step 6 preview) */}
        {(() => {
          const h = HOSPITAL_DB[selectedType.id] || HOSPITAL_DB["default"];
          return (
            <div style={{
              padding: "12px 14px", borderRadius: 12, marginBottom: 12,
              background: "#f0fdf4", border: "1px solid #bbf7d0",
              display: "flex", alignItems: "center", gap: 10,
            }}>
              <span style={{ fontSize: 22, flexShrink: 0 }}>🏥</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#15803d", letterSpacing: ".06em", marginBottom: 2 }}>
                  NEAREST HOSPITAL FOR {selectedType.label.toUpperCase()}
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{h.name}</div>
                <div style={{ fontSize: 11, color: "#16a34a", marginTop: 2 }}>
                  {h.type} · {h.distance} · 📞 {h.phone}
                </div>
              </div>
              <a href={`tel:${h.phone}`} style={{
                padding: "6px 12px", borderRadius: 8,
                background: "#16a34a", color: "#fff",
                fontSize: 11, fontWeight: 700, textDecoration: "none",
              }}>Call</a>
            </div>
          );
        })()}

        {/* First aid tips preview (Step 7) */}
        <div style={{
          padding: "12px 14px", borderRadius: 12, marginBottom: 14,
          background: "rgba(59,130,246,.06)", border: "1px solid rgba(59,130,246,.2)",
        }}>
          <div style={{ fontSize: 10.5, fontWeight: 800, color: "#1d4ed8", letterSpacing: ".06em", marginBottom: 8 }}>
            💊 FIRST AID GUIDE — {selectedType.label.toUpperCase()}
          </div>
          {selectedType.firstAid.map((tip, i) => (
            <div key={i} style={{ display: "flex", gap: 8, marginBottom: i < selectedType.firstAid.length - 1 ? 6 : 0 }}>
              <span style={{ fontSize: 11, color: "#3b82f6", fontWeight: 700, flexShrink: 0, marginTop: 1 }}>{i + 1}.</span>
              <span style={{ fontSize: 11.5, color: "#1e40af", lineHeight: 1.5 }}>{tip}</span>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div style={{ background: "#f8fafc", borderRadius: 11, padding: "12px 14px", marginBottom: 16, border: "1px solid #e2e8f0" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", letterSpacing: ".08em", marginBottom: 8 }}>REVIEW BEFORE SENDING</div>
          {[
            ["Type", `${selectedType.icon} ${selectedType.label}`],
            ["Location", loc?.address || "Not captured"],
            ["Severity", `${severity} · AI: ${aiResult?.label || "—"} (${aiResult?.score || 0}%)`],
            ["Victims", `${victimCount} person(s)`],
            ["Photo", image ? "✓ Attached" : "Not attached"],
            ["Silent Mode", silentMode ? "🤫 Yes" : "No"],
          ].map(([k, v]) => (
            <div key={k as string} style={{ display: "flex", gap: 12, marginBottom: 5 }}>
              <span style={{ fontSize: 11, color: "#94a3b8", minWidth: 80, flexShrink: 0 }}>{k as string}</span>
              <span style={{ fontSize: 11.5, color: "#0f172a", fontWeight: 500 }}>{v as string}</span>
            </div>
          ))}
        </div>

        {/* Hold to send */}
        <div style={{ position: "relative", marginBottom: 10, borderRadius: 13, overflow: "hidden" }}>
          <div style={{
            position: "absolute", inset: 0, background: selectedType.color,
            width: `${holdProgress}%`, zIndex: 0, borderRadius: 13,
          }} />
          <button
            onMouseDown={startHold}
            onMouseUp={cancelHold}
            onMouseLeave={cancelHold}
            onTouchStart={(e) => { e.preventDefault(); startHold(); }}
            onTouchEnd={cancelHold}
            disabled={sending}
            style={{
              position: "relative", zIndex: 1, width: "100%", padding: "15px",
              borderRadius: 13, fontSize: 14, fontWeight: 900,
              cursor: sending ? "default" : "pointer",
              background: holdProgress > 0 ? "transparent" : `${selectedType.color}15`,
              border: `2px solid ${selectedType.color}`,
              color: holdProgress > 50 ? "#fff" : selectedType.color,
              fontFamily: "inherit", transition: "color .15s",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            }}
          >
            {sending
              ? matchingWorkers
                ? "🔍 Matching nearest workers…"
                : smsAlertSent
                ? "📱 Alerting emergency contacts…"
                : "⟳ Sending SOS…"
              : holdProgress > 0
              ? `${selectedType.icon} Hold… ${Math.round(holdProgress)}%`
              : `${selectedType.icon} Hold 2s to Send SOS`}
          </button>
        </div>
        <div style={{ fontSize: 10.5, color: "#94a3b8", textAlign: "center", marginBottom: 12 }}>
          Holding triggers: GPS share → AI severity → worker match → SMS alerts
        </div>
        <button onClick={() => setStep("details")} style={{ fontSize: 12, color: "#94a3b8", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>← Back</button>
      </div>
    );

  // ── SENT: full response view ─────────────────────────────────────────────────
  if (step === "sent" && sentRequest) {
    const hospital = sentRequest.nearestHospital;
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <style>{`@keyframes sent-pop{0%{transform:scale(.5);opacity:0}60%{transform:scale(1.1)}100%{transform:scale(1);opacity:1}}`}</style>

        {/* Success */}
        <div style={{ textAlign: "center", padding: "12px 0 6px" }}>
          <div style={{
            width: 72, height: 72, borderRadius: "50%", margin: "0 auto 12px",
            background: "linear-gradient(135deg,#dc2626,#ef4444)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 32, animation: "sent-pop .5s ease",
            boxShadow: "0 0 0 12px rgba(239,68,68,.12),0 8px 32px rgba(239,68,68,.4)",
          }}>📡</div>
          <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a", marginBottom: 5 }}>SOS Sent!</div>
          <div style={{ fontSize: 12, color: "#64748b" }}>
            Ticket: <strong style={{ fontFamily: "monospace", color: "#ef4444" }}>{sentRequest.ticketId}</strong>
          </div>
        </div>

        {/* 10-step status */}
        <div style={{ background: "#0f172a", borderRadius: 14, padding: "14px 16px" }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: "#475569", letterSpacing: ".1em", marginBottom: 12 }}>
            RESPONSE PIPELINE STATUS
          </div>
          {[
            { icon: "📡", label: "SOS submitted", done: true, color: "#ef4444" },
            { icon: "📍", label: "GPS location captured", done: !!loc, color: "#3b82f6" },
            { icon: "📷", label: "Photo evidence attached", done: !!image, color: "#8b5cf6" },
            { icon: "🤖", label: `AI severity: ${sentRequest.aiSeverityLabel} (${sentRequest.aiSeverityScore}%)`, done: true, color: "#a855f7" },
            { icon: "🔍", label: "Nearest workers matched", done: true, color: "#f97316" },
            { icon: "📱", label: "Emergency contacts SMS'd", done: true, color: "#10b981" },
            { icon: "🗺️", label: "Live tracker active below", done: true, color: "#22c55e" },
            { icon: "🏥", label: "Hospital suggested", done: !!hospital, color: "#06b6d4" },
            { icon: "💊", label: "First aid guide ready", done: true, color: "#3b82f6" },
            { icon: "⭐", label: "Rate after resolution", done: false, color: "#f59e0b" },
          ].map((s, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: i < 9 ? 7 : 0 }}>
              <div style={{
                width: 26, height: 26, borderRadius: "50%",
                background: s.done ? `${s.color}20` : "rgba(255,255,255,.03)",
                border: `1.5px solid ${s.done ? s.color : "rgba(255,255,255,.08)"}`,
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, flexShrink: 0,
              }}>
                {s.done ? <span style={{ color: s.color, fontSize: 10 }}>✓</span> : <span style={{ fontSize: 11 }}>{s.icon}</span>}
              </div>
              <span style={{ fontSize: 11.5, color: s.done ? "#e2e8f0" : "#334155", fontWeight: s.done ? 600 : 400 }}>{s.label}</span>
            </div>
          ))}
        </div>

        {/* Hospital */}
        {hospital && (
          <div style={{ padding: "12px 14px", borderRadius: 12, background: "#f0fdf4", border: "1px solid #bbf7d0", display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 22 }}>🏥</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10.5, fontWeight: 800, color: "#15803d", marginBottom: 2 }}>NEAREST {hospital.type.toUpperCase()}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{hospital.name}</div>
              <div style={{ fontSize: 11, color: "#16a34a" }}>{hospital.distance} · 📞 {hospital.phone}</div>
            </div>
            <a href={`tel:${hospital.phone}`} style={{ padding: "7px 14px", borderRadius: 9, background: "#16a34a", color: "#fff", fontSize: 12, fontWeight: 700, textDecoration: "none" }}>Call</a>
          </div>
        )}

        {/* First aid */}
        {selectedType && (
          <div style={{ padding: "12px 14px", borderRadius: 12, background: "rgba(59,130,246,.06)", border: "1px solid rgba(59,130,246,.2)" }}>
            <div style={{ fontSize: 10.5, fontWeight: 800, color: "#1d4ed8", marginBottom: 8 }}>💊 FIRST AID — {selectedType.label.toUpperCase()}</div>
            {selectedType.firstAid.map((tip, i) => (
              <div key={i} style={{ display: "flex", gap: 7, marginBottom: i < selectedType.firstAid.length - 1 ? 5 : 0 }}>
                <span style={{ fontSize: 11, color: "#3b82f6", fontWeight: 700, flexShrink: 0 }}>{i + 1}.</span>
                <span style={{ fontSize: 11.5, color: "#1e40af", lineHeight: 1.5 }}>{tip}</span>
              </div>
            ))}
          </div>
        )}

        <button onClick={reset} style={{ padding: "10px 24px", borderRadius: 10, background: "#fef2f2", border: "1.5px solid rgba(239,68,68,.3)", color: "#ef4444", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
          Send Another SOS
        </button>
      </div>
    );
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// RESPONSE BENCHMARK
// ─────────────────────────────────────────────────────────────────────────────
function ResponseBenchmark() {
  const items = [
    { label: "Food delivery (avg)", time: "10 min", bar: 100, color: "#22c55e", icon: "🍕" },
    { label: "AP target (ambulance)", time: "10 min", bar: 100, color: "#3b82f6", icon: "🎯" },
    { label: "Current avg response", time: "14 min", bar: 140, color: "#f97316", icon: "🚑" },
    { label: "Officers' best", time: "6 min", bar: 60, color: "#10b981", icon: "⭐" },
  ];
  return (
    <div style={{ background: "linear-gradient(135deg,#1e1b4b,#2e1065)", borderRadius: 16, padding: 18, border: "1px solid rgba(139,92,246,.2)" }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: "#c4b5fd", letterSpacing: ".08em", marginBottom: 4 }}>
        ⏱️ RESPONSE TIME BENCHMARK
      </div>
      <div style={{ fontSize: 10.5, color: "rgba(196,181,253,.5)", marginBottom: 12, lineHeight: 1.5 }}>
        MP Swati Maliwal in Parliament: <em style={{ color: "rgba(196,181,253,.8)" }}>"If food can reach in 10 min, why not ambulances?"</em>
      </div>
      {items.map((item) => (
        <div key={item.label} style={{ marginBottom: 9 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,.7)" }}>{item.icon} {item.label}</span>
            <span style={{ fontSize: 11, fontWeight: 800, color: item.color }}>{item.time}</span>
          </div>
          <div style={{ height: 5, background: "rgba(255,255,255,.07)", borderRadius: 4, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${Math.min(item.bar, 100)}%`, background: item.color, borderRadius: 4 }} />
          </div>
        </div>
      ))}
      <div style={{ marginTop: 12, padding: "9px 12px", borderRadius: 9, background: "rgba(239,68,68,.1)", border: "1px solid rgba(239,68,68,.2)", fontSize: 10.5, color: "#fca5a5", lineHeight: 1.5 }}>
        🎯 This portal tracks your responder ETA in real-time — same as Swiggy tracks your food.
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SAFETY TIPS
// ─────────────────────────────────────────────────────────────────────────────
function SafetyTips() {
  const tips = [
    { icon: "🚗", title: "Road accidents", tip: "Stay away from fuel tanks. Turn off ignition. Call 108 + 100." },
    { icon: "🔥", title: "Fire emergency", tip: "Don't use lift. Cover mouth. Stay low. Meet at assembly point." },
    { icon: "🌊", title: "Flooding", tip: "Move to higher ground. Don't walk in moving water. Call 1070." },
    { icon: "🚑", title: "Medical emergency", tip: "Keep patient warm & still. Don't give water. Call 108." },
    { icon: "⚡", title: "Electrical", tip: "Don't touch. Cut main power. Use rubber gloves. Call 1912." },
    { icon: "🏗️", title: "Building collapse", tip: "Move 50m away. Don't re-enter. Shout to locate survivors." },
  ];
  return (
    <div style={{ background: "linear-gradient(135deg,#0f172a,#1a2a3a)", borderRadius: 16, padding: 18, border: "1px solid rgba(255,255,255,.07)" }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: "#94a3b8", letterSpacing: ".1em", marginBottom: 12 }}>🛡️ EMERGENCY SAFETY TIPS</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {tips.map((t) => (
          <div key={t.title} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <span style={{ fontSize: 16, flexShrink: 0, lineHeight: 1.4 }}>{t.icon}</span>
            <div>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: "#e2e8f0", marginBottom: 2 }}>{t.title}</div>
              <div style={{ fontSize: 10.5, color: "#64748b", lineHeight: 1.5 }}>{t.tip}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────────────────────────────────────
export default function CitizenEmergencySection({ userId, userName, onReportEmergency }: Props) {
  const [tab, setTab] = useState<"sos" | "tracker" | "calls">("sos");
  const [activeCount, setActiveCount] = useState(0);

  useEffect(() => {
    const count = () => {
      const mine = emLoad().filter(
        (r) =>
          (r.citizenId === userId || r.citizenName === userName) &&
          !["Resolved", "Cancelled"].includes(r.status)
      );
      setActiveCount(mine.length);
    };
    count();
    const iv = setInterval(count, 4000);
    window.addEventListener("storage", count);
    return () => { clearInterval(iv); window.removeEventListener("storage", count); };
  }, [userId, userName]);

  return (
    <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <style>{`
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes em-fadein{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes em-pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(1.4)}}
      `}</style>

      {/* PAGE HEADER */}
      <div style={{
        background: "linear-gradient(135deg,#7f1d1d 0%,#991b1b 40%,#b91c1c 70%,#dc2626 100%)",
        borderRadius: 20, padding: "22px 26px", marginBottom: 20,
        position: "relative", overflow: "hidden",
        boxShadow: "0 8px 32px rgba(239,68,68,.25)",
      }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle at 1px 1px,rgba(255,255,255,.07) 1px,transparent 0)", backgroundSize: "22px 22px" }} />
        <div style={{ position: "absolute", top: -50, right: -50, width: 220, height: 220, borderRadius: "50%", background: "rgba(255,255,255,.06)", filter: "blur(50px)" }} />
        <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 14 }}>
          <div>
            <div style={{ fontSize: 9.5, color: "rgba(255,255,255,.65)", fontWeight: 700, letterSpacing: ".15em", marginBottom: 5, textTransform: "uppercase" }}>
              AP Citizen Portal · Emergency Response
            </div>
            <h2 style={{ fontSize: 24, fontWeight: 900, color: "#fff", lineHeight: 1.1, fontFamily: "'DM Serif Display', Georgia, serif", marginBottom: 6 }}>
              🚨 Emergency Centre
            </h2>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,.7)", lineHeight: 1.5 }}>
              GPS → AI Severity → Worker Match → Live Track → Hospital → First Aid
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, flexShrink: 0 }}>
            <a href="tel:112" style={{
              display: "flex", alignItems: "center", gap: 8, padding: "10px 18px",
              borderRadius: 12, background: "rgba(255,255,255,.15)",
              border: "1.5px solid rgba(255,255,255,.3)", color: "#fff",
              fontSize: 13, fontWeight: 800, textDecoration: "none",
              backdropFilter: "blur(8px)",
            }}>📞 AP Emergency — 112</a>
            {activeCount > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 20, background: "rgba(16,185,129,.2)", border: "1px solid rgba(16,185,129,.4)" }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#10b981", animation: "em-pulse 1.5s ease-in-out infinite" }} />
                <span style={{ fontSize: 10.5, color: "#6ee7b7", fontWeight: 700 }}>{activeCount} SOS ACTIVE — tracking live</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* TAB BAR */}
      <div style={{ display: "flex", gap: 6, marginBottom: 18 }}>
        {([
          { id: "sos" as const, label: "Send SOS", icon: "🆘" },
          { id: "tracker" as const, label: "Live Tracker", icon: "📡", badge: activeCount > 0 ? activeCount : undefined },
          { id: "calls" as const, label: "Quick Calls", icon: "📞" },
        ]).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: "8px 18px", borderRadius: 10, fontSize: 12.5, fontWeight: 700, fontFamily: "inherit",
              border: `1.5px solid ${tab === t.id ? "#ef4444" : "#e2e8f0"}`,
              background: tab === t.id ? "linear-gradient(135deg,#7f1d1d,#ef4444)" : "#fff",
              color: tab === t.id ? "#fff" : "#64748b",
              cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
              position: "relative", transition: "all .15s",
            }}
          >
            {t.icon} {t.label}
            {t.badge && (
              <span style={{
                position: "absolute", top: -6, right: -6,
                background: "#ef4444", color: "#fff", fontSize: 9, fontWeight: 800,
                minWidth: 16, height: 16, borderRadius: 8,
                display: "flex", alignItems: "center", justifyContent: "center",
                border: "2px solid #fff",
              }}>{t.badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* MAIN GRID */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 18 }}>

        {/* LEFT — tab content */}
        <div>
          {/* SOS TAB */}
          {tab === "sos" && (
            <div style={{ animation: "em-fadein .3s ease" }}>
              <div style={{
                background: "#fff", borderRadius: 18, padding: 20, marginBottom: 16,
                boxShadow: "0 2px 8px rgba(0,0,0,.06)", border: "1.5px solid rgba(239,68,68,.12)",
              }}>
                <SOSSender userId={userId} userName={userName} />
              </div>

              {/* Live tracker shown below SOS */}
              <div style={{ background: "#fff", borderRadius: 18, padding: 20, boxShadow: "0 2px 8px rgba(0,0,0,.06)" }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#64748b", letterSpacing: ".1em", marginBottom: 12 }}>
                  📡 YOUR ACTIVE SOS — SWIGGY-STYLE LIVE TRACKER
                </div>
                <LiveResponderTracker citizenId={userId} citizenName={userName} />
                {activeCount === 0 && (
                  <div style={{ textAlign: "center", padding: "20px 0", color: "#94a3b8" }}>
                    <div style={{ fontSize: 28, marginBottom: 6 }}>✅</div>
                    <div style={{ fontSize: 12.5, fontWeight: 600 }}>No active emergencies</div>
                    <div style={{ fontSize: 11, marginTop: 3 }}>Send an SOS above to see live tracking</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TRACKER TAB */}
          {tab === "tracker" && (
            <div style={{ animation: "em-fadein .3s ease" }}>
              <div style={{ background: "#fff", borderRadius: 18, padding: 20, boxShadow: "0 2px 8px rgba(0,0,0,.06)", marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#ef4444", letterSpacing: ".1em", marginBottom: 14 }}>
                  📡 LIVE RESPONDER TRACKER — SWIGGY-STYLE ETA
                </div>
                <LiveResponderTracker citizenId={userId} citizenName={userName} />
                {activeCount === 0 && (
                  <div style={{ textAlign: "center", padding: "32px 0", color: "#94a3b8" }}>
                    <div style={{ fontSize: 40, marginBottom: 10 }}>📡</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#334155" }}>No active SOS</div>
                    <div style={{ fontSize: 12, marginTop: 4 }}>Your tracker appears here once you send an SOS</div>
                    <button onClick={() => setTab("sos")} style={{
                      marginTop: 16, padding: "9px 20px", borderRadius: 10,
                      background: "linear-gradient(135deg,#dc2626,#ef4444)",
                      border: "none", color: "#fff", fontSize: 12.5, fontWeight: 700,
                      cursor: "pointer", fontFamily: "inherit",
                    }}>🆘 Send SOS now</button>
                  </div>
                )}
              </div>
              <ResponseBenchmark />
            </div>
          )}

          {/* CALLS TAB */}
          {tab === "calls" && (
            <div style={{ animation: "em-fadein .3s ease" }}>
              <div style={{ background: "#fff", borderRadius: 18, padding: 20, boxShadow: "0 2px 8px rgba(0,0,0,.06)", marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#64748b", letterSpacing: ".1em", marginBottom: 14 }}>
                  📞 HOLD TO CALL — EMERGENCY SERVICES
                </div>
                <EmergencyButtons />
              </div>
              <SafetyTips />
            </div>
          )}
        </div>

        {/* RIGHT — always visible */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Area Risk */}
          <div style={{ animation: "em-fadein .3s ease .05s both" }}>
            <AreaRiskIndicator />
          </div>

          {/* Quick call shortcuts */}
          <div style={{ background: "linear-gradient(135deg,#0f172a,#1e293b)", borderRadius: 16, padding: 18, border: "1px solid rgba(255,255,255,.07)" }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: "#94a3b8", letterSpacing: ".1em", marginBottom: 12 }}>
              ⚡ ONE-TAP EMERGENCY CALLS
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                { num: "112", label: "AP Emergency", icon: "🚨", color: "#ef4444" },
                { num: "108", label: "Ambulance", icon: "🚑", color: "#10b981" },
                { num: "100", label: "Police", icon: "🚔", color: "#3b82f6" },
                { num: "101", label: "Fire", icon: "🔥", color: "#f97316" },
                { num: "1091", label: "Women Safety", icon: "🛡️", color: "#a855f7" },
                { num: "1098", label: "Child Help", icon: "👶", color: "#f59e0b" },
              ].map((s) => (
                <a key={s.num} href={`tel:${s.num}`} style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
                  borderRadius: 10, background: `${s.color}10`,
                  border: `1px solid ${s.color}25`, textDecoration: "none", transition: "all .15s",
                }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = `${s.color}20`; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = `${s.color}10`; }}
                >
                  <span style={{ fontSize: 18, flexShrink: 0 }}>{s.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#e2e8f0" }}>{s.label}</div>
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 900, color: s.color, fontFamily: "monospace" }}>{s.num}</span>
                </a>
              ))}
            </div>
          </div>

          {/* Report civic emergency */}
          {onReportEmergency && (
            <div style={{ background: "#fff", borderRadius: 16, padding: 18, border: "1.5px solid rgba(239,68,68,.15)", boxShadow: "0 2px 8px rgba(0,0,0,.04)" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#0f172a", marginBottom: 6 }}>🏗️ Report civic emergency</div>
              <div style={{ fontSize: 11.5, color: "#64748b", marginBottom: 14, lineHeight: 1.5 }}>
                Downed power lines, road damage, sewage overflow — urgent civic issues.
              </div>
              <button onClick={onReportEmergency} style={{
                width: "100%", padding: "11px", borderRadius: 11,
                background: "linear-gradient(135deg,#7f1d1d,#dc2626)",
                border: "none", color: "#fff", fontSize: 12.5, fontWeight: 800,
                cursor: "pointer", fontFamily: "inherit",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                boxShadow: "0 4px 14px rgba(239,68,68,.3)",
              }}>
                🚨 Report Emergency Civic Issue
              </button>
            </div>
          )}

          
        </div>
      </div>
    </div>
  );
}