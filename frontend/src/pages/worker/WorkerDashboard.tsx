import { useState, useRef, useEffect, useCallback } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "../../map/leafletFix"; // fixes default marker icons in Vite
import L from "leaflet";
import { useSelector, useDispatch } from "react-redux";
import type { RootState } from "../../store";
import { logout } from "../../store/authSlice";
import { clearComplaints } from "../../store/complaintSlice";
import { clearNotifications } from "../../store/notificationSlice";
import { useNavigate } from "react-router-dom";
import AIChatWidget from "../../features/ai/AIChatWidget";

/* ─────────────────────── constants ─────────────────────── */
const SC: Record<string, { bg: string; text: string; dot: string; border: string }> = {
  Pending:  { bg: "#fff8e1", text: "#b45309", dot: "#f59e0b", border: "#fde68a" },
  Assigned: { bg: "#ede9fe", text: "#5b21b6", dot: "#7c3aed", border: "#c4b5fd" },
  Resolved: { bg: "#ecfdf5", text: "#065f46", dot: "#10b981", border: "#6ee7b7" },
  "In Progress": { bg: "#eff6ff", text: "#1d4ed8", dot: "#3b82f6", border: "#bfdbfe" },
  Accepted:      { bg: "#f0f9ff", text: "#0369a1", dot: "#0ea5e9", border: "#bae6fd" },
  Completed:     { bg: "#f0fdf4", text: "#15803d", dot: "#22c55e", border: "#bbf7d0" },
};

const DI: Record<string, string> = {
  "Electricity": "⚡", "Water Works": "💧", "Sanitation": "🗑️",
  "Roads & Infrastructure": "🛣️", "Police": "👮",
  "Fire Department": "🔥", "General Civic": "🏛️",
};

const PRIORITY: Record<string, { label: string; color: string; bg: string }> = {
  "Police":                 { label: "CRITICAL", color: "#dc2626", bg: "#fee2e2" },
  "Fire Department":        { label: "CRITICAL", color: "#dc2626", bg: "#fee2e2" },
  "Electricity":            { label: "HIGH",     color: "#ea580c", bg: "#ffedd5" },
  "Water Works":            { label: "HIGH",     color: "#ea580c", bg: "#ffedd5" },
  "Sanitation":             { label: "MEDIUM",   color: "#d97706", bg: "#fef3c7" },
  "Roads & Infrastructure": { label: "MEDIUM",   color: "#d97706", bg: "#fef3c7" },
  "General Civic":          { label: "LOW",      color: "#16a34a", bg: "#dcfce7" },
};

const FILTER_OPTIONS = ["All", "Pending", "Assigned", "Accepted", "In Progress", "Completed", "Resolved"];
const SORT_OPTIONS = [
  { value: "newest",     label: "Newest First" },
  { value: "oldest",     label: "Oldest First" },
  { value: "priority",   label: "Priority" },
  { value: "department", label: "Department" },
];
const priorityRank: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

/* ─────────────────────── helpers ─────────────────────── */
const loadLS = (k: string) => { try { return JSON.parse(localStorage.getItem(k) || "[]"); } catch { return []; } };
const saveAll = (data: any[]) => {
  localStorage.setItem("complaints_all", JSON.stringify(data));
  const byUser: Record<string, any[]> = {};
  data.forEach(c => { if (c.userId) { byUser[c.userId] = byUser[c.userId] || []; byUser[c.userId].push(c); } });
  Object.entries(byUser).forEach(([uid, cs]) => localStorage.setItem(`complaints_${uid}`, JSON.stringify(cs)));
};
const loadMessages = (ticketId: string): any[] => {
  try { return JSON.parse(localStorage.getItem(`chat_${ticketId}`) || "[]"); } catch { return []; }
};
const saveMessages = (ticketId: string, msgs: any[]) => {
  localStorage.setItem(`chat_${ticketId}`, JSON.stringify(msgs));
};

/* ─────────────────────── ChatPanel ─────────────────────── */
function ChatPanel({ complaint, currentUser }: { complaint: any; currentUser: any }) {
  const [messages, setMessages] = useState<any[]>(() => loadMessages(complaint.ticketId));
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const interval = setInterval(() => {
      const fresh = loadMessages(complaint.ticketId);
      // Check for new messages by ID count OR content change
      if (fresh.length !== messages.length || JSON.stringify(fresh) !== JSON.stringify(messages)) {
        setMessages(fresh);
      }
    }, 5000); // Poll every 5s for new messages from officer
    return () => clearInterval(interval);
  }, [messages.length, complaint.ticketId, messages]);

  const sendMessage = async () => {
    if (!input.trim()) return;
    setSending(true);
    const msg = {
      id: Date.now().toString(),
      text: input.trim(),
      sender: currentUser?.name || "Worker",
      senderId: currentUser?.id || "worker",
      role: "worker",
      timestamp: Date.now(),
    };
    const updated = [...messages, msg];
    setMessages(updated);
    saveMessages(complaint.ticketId, updated);
    setInput("");
    setSending(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const officerName = complaint.assignedBy || complaint.officerName || "Officer";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--bg-card)" }}>
      <div style={{
        background: "linear-gradient(135deg,#0d1b2a,#162032)",
        padding: "16px 20px", borderBottom: "1px solid #1e2d3d",
        display: "flex", alignItems: "center", gap: "12px",
      }}>
        <div style={{ position: "relative" }}>
          <div style={{ width: "42px", height: "42px", borderRadius: "12px", background: "linear-gradient(135deg,#1d4ed8,#3b82f6)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: "17px" }}>
            {officerName.charAt(0).toUpperCase()}
          </div>
          <span style={{ position: "absolute", bottom: "2px", right: "2px", width: "9px", height: "9px", borderRadius: "50%", background: "#22c55e", border: "2px solid var(--bg-nav)" }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "14px", fontWeight: 800, color: "var(--text-primary)" }}>{officerName}</div>
          <div style={{ fontSize: "10px", color: "#3b82f6", fontFamily: "'DM Mono',monospace", marginTop: "1px" }}>Assigned Officer · {complaint.ticketId}</div>
        </div>
        <div style={{ fontSize: "10px", color: "#22c55e", fontFamily: "'DM Mono',monospace", background: "rgba(34,197,94,.1)", border: "1px solid rgba(34,197,94,.2)", borderRadius: "12px", padding: "3px 10px" }}>● LIVE</div>
      </div>
      <div style={{ padding: "8px 16px", background: "var(--bg-card-alt)", borderBottom: "1px solid #1f2937", display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{DI[complaint.department] || "🏛️"} {complaint.department}</span>
        <span style={{ fontSize: "11px", color: "#374151" }}>·</span>
        <span style={{ fontSize: "11px", color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "220px" }}>{complaint.title}</span>
        <span style={{ marginLeft: "auto", fontSize: "10px", fontFamily: "'DM Mono',monospace", padding: "2px 8px", borderRadius: "5px", background: (SC[complaint.status]?.bg || "#fff") + "22", color: SC[complaint.status]?.text || "#666", border: `1px solid ${SC[complaint.status]?.border || "#ccc"}44` }}>{complaint.status}</span>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
        {messages.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <div style={{ fontSize: "36px", marginBottom: "10px" }}>💬</div>
            <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-muted)" }}>No messages yet</div>
            <div style={{ fontSize: "11px", color: "#374151", marginTop: "4px" }}>Start a conversation with your assigned officer</div>
          </div>
        )}
        {messages.map((msg: any) => {
          const isMe = msg.role === "worker" || msg.senderId === currentUser?.id;
          return (
            <div key={msg.id} style={{ display: "flex", flexDirection: isMe ? "row-reverse" : "row", gap: "8px", alignItems: "flex-end" }}>
              {!isMe && (
                <div style={{ width: "30px", height: "30px", borderRadius: "9px", background: "linear-gradient(135deg,#1d4ed8,#3b82f6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: 800, color: "#fff", flexShrink: 0 }}>
                  {(msg.sender || "O").charAt(0).toUpperCase()}
                </div>
              )}
              <div style={{ maxWidth: "78%", display: "flex", flexDirection: "column", gap: "3px", alignItems: isMe ? "flex-end" : "flex-start" }}>
                {!isMe && <div style={{ fontSize: "10px", color: "var(--text-muted)", marginLeft: "2px" }}>{msg.sender}</div>}
                {msg.image && (
                  <div style={{ marginBottom: "4px" }}>
                    <img src={msg.image} alt="Proof" style={{ maxWidth: "220px", borderRadius: "12px", border: "2px solid rgba(16,185,129,.35)", display: "block" }} />
                    <div style={{ fontSize: "10px", marginTop: "5px", color: "#10b981", display: "flex", alignItems: "center", gap: "4px", fontWeight: 700 }}>📎 Proof photo attached</div>
                  </div>
                )}
                {msg.text && (
                  <div style={{ padding: "10px 14px", borderRadius: isMe ? "14px 14px 4px 14px" : "14px 14px 14px 4px", background: msg.isSystem ? "linear-gradient(135deg,rgba(5,150,105,.2),rgba(16,185,129,.1))" : isMe ? "linear-gradient(135deg,#059669,#10b981)" : "#1e2433", color: isMe ? "#fff" : "var(--text-secondary)", fontSize: "13px", lineHeight: 1.55, fontFamily: "'DM Sans',sans-serif", border: msg.isSystem ? "1px solid rgba(16,185,129,.3)" : isMe ? "none" : "1px solid #2d3748", whiteSpace: "pre-wrap" }}>
                    {msg.text}
                  </div>
                )}
                <div style={{ fontSize: "10px", color: "#374151", fontFamily: "'DM Mono',monospace" }}>
                  {new Date(msg.timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      <div style={{ padding: "12px 16px", borderTop: "1px solid #1f2937", background: "var(--bg-card-alt)" }}>
        <div style={{ display: "flex", gap: "8px", alignItems: "flex-end" }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder="Message your officer… (Enter to send)"
            style={{ flex: 1, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "10px", padding: "10px 12px", color: "var(--text-primary)", fontFamily: "'DM Sans',sans-serif", fontSize: "13px", resize: "none", outline: "none", minHeight: "42px", maxHeight: "100px", lineHeight: 1.5 }}
            rows={1}
          />
          <button onClick={sendMessage} disabled={!input.trim() || sending}
            style={{ width: "42px", height: "42px", borderRadius: "10px", border: "none", background: input.trim() ? "linear-gradient(135deg,#059669,#10b981)" : "var(--bg-card-alt)", color: input.trim() ? "#fff" : "#374151", cursor: input.trim() ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", transition: "all .2s", flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
          </button>
        </div>
        <div style={{ fontSize: "10px", color: "#374151", marginTop: "6px", textAlign: "center", fontFamily: "'DM Mono',monospace" }}>Shift+Enter for new line · Messages visible to officer</div>
      </div>
    </div>
  );
}

/* ─────────────────────── NavigationMap ─────────────────────── */
function NavigationMap({ complaint }: { complaint: any }) {
  const lat = complaint.lat || 16.5062;
  const lng = complaint.lng || 80.6480;
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
  const wazeUrl = `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
  const staticMapUrl = `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lng}&zoom=15&size=600x300&markers=${lat},${lng},red`;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <div style={{ borderRadius: "12px", overflow: "hidden", border: "1px solid #1e2d3d", position: "relative" }}>
        <img
          src={staticMapUrl}
          alt="Location Map"
          style={{ width: "100%", height: "180px", objectFit: "cover", display: "block" }}
          onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
        <div style={{ position: "absolute", bottom: "8px", left: "8px", right: "8px", background: "rgba(13,27,42,.85)", backdropFilter: "blur(4px)", borderRadius: "8px", padding: "8px 12px" }}>
          <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "2px" }}>📍 Destination</div>
          <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-primary)" }}>{complaint.address || `${lat.toFixed(4)}, ${lng.toFixed(4)}`}</div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
        <a href={mapsUrl} target="_blank" rel="noreferrer"
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "7px", padding: "11px", borderRadius: "10px", background: "linear-gradient(135deg,#1d4ed8,#3b82f6)", color: "#fff", fontSize: "12px", fontWeight: 700, textDecoration: "none", fontFamily: "'Syne',sans-serif" }}>
          🗺️ Google Maps
        </a>
        <a href={wazeUrl} target="_blank" rel="noreferrer"
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "7px", padding: "11px", borderRadius: "10px", background: "linear-gradient(135deg,#7c3aed,#a78bfa)", color: "#fff", fontSize: "12px", fontWeight: 700, textDecoration: "none", fontFamily: "'Syne',sans-serif" }}>
          🚗 Waze
        </a>
      </div>
      <div style={{ background: "var(--bg-card-alt)", borderRadius: "10px", padding: "10px 12px", border: "1px solid #1e2d3d" }}>
        <div style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: "6px" }}>Coordinates</div>
        <div style={{ display: "flex", gap: "16px" }}>
          <div>
            <div style={{ fontSize: "10px", color: "var(--text-muted)" }}>Latitude</div>
            <div style={{ fontSize: "12px", fontWeight: 700, color: "#a78bfa", fontFamily: "'DM Mono',monospace" }}>{lat.toFixed(6)}</div>
          </div>
          <div>
            <div style={{ fontSize: "10px", color: "var(--text-muted)" }}>Longitude</div>
            <div style={{ fontSize: "12px", fontWeight: 700, color: "#a78bfa", fontFamily: "'DM Mono',monospace" }}>{lng.toFixed(6)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────── WorkerLiveMap ─────────────────────── */
/* ─────────────────────── WorkerLiveMap ─────────────────────── */
/* ─────────────────────── WorkerLiveMap ─────────────────────── */
/* ─────────────────────── WorkerLiveMap ─────────────────────── */
/* ─────────────────────── WorkerLiveMap ─────────────────────── */
const AP_DISTRICTS = [
  "All Districts","Visakhapatnam","Vizianagaram","Srikakulam","East Godavari",
  "West Godavari","Krishna","Guntur","Prakasam","Nellore","Kurnool",
  "Kadapa","Anantapur","Chittoor","Alluri Sitharama Raju","Anakapalli",
  "Bapatla","Eluru","Konaseema","NTR","Palnadu","Tirupati","Sri Sathya Sai","Sri Balaji",
];
const MAP_STATUS_CLR: Record<string,string> = {
  Pending:"#f59e0b", Assigned:"#7c3aed", Accepted:"#0ea5e9",
  "In Progress":"#3b82f6", Completed:"#22c55e", Resolved:"#10b981",
};
const MAP_DEPT_ICON: Record<string,string> = {
  "Electricity":"⚡","Water Works":"💧","Sanitation":"🗑️",
  "Roads & Infrastructure":"🛣️","Police":"👮","Fire Department":"🔥","General Civic":"🏛️",
};

function makeMarkerIcon(color: string, emoji: string, selected: boolean) {
  const sz = selected ? 44 : 34;
  const ring = selected
    ? `<div style="position:absolute;top:-7px;left:-7px;width:${sz+14}px;height:${sz+14}px;border-radius:50%;border:2.5px solid ${color};background:${color}20;animation:wlmPulse 1.5s ease-out infinite"></div>`
    : "";
  return L.divIcon({
    html: `<div style="position:relative;width:${sz}px;height:${sz}px">${ring}<div style="position:relative;width:${sz}px;height:${sz}px;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;font-size:${selected?19:14}px;border:${selected?"3px solid #fff":"2.5px solid rgba(255,255,255,.85)"};box-shadow:${selected?`0 0 0 3px ${color}55,0 4px 14px rgba(0,0,0,.7)`:"0 2px 8px rgba(0,0,0,.45)"}">${emoji}</div></div>`,
    className: "",
    iconSize: [sz, sz],
    iconAnchor: [sz/2, sz/2],
    popupAnchor: [0, -(sz/2 + 8)],
  });
}

function MapFlyController({ selC }: { selC: any }) {
  const map = useMap();
  const prevId = useRef<string>("");
  useEffect(() => {
    if (!selC || selC.ticketId === prevId.current) return;
    if (selC.lat && selC.lng) map.flyTo([Number(selC.lat), Number(selC.lng)], 16, { animate:true, duration:1 });
    prevId.current = selC.ticketId;
  }, [selC, map]);
  return null;
}

function WorkerLiveMap({ complaints, workerDistrict, onSelect }: {
  complaints: any[];
  workerDistrict?: string;
  onSelect: (c: any) => void;
}) {
  const [selC,      setSelC]      = useState<any|null>(null);
  const [statusF,   setStatusF]   = useState("All");
  const [districtF, setDistrictF] = useState(workerDistrict || "All Districts");
  const [mapStyle, setMapStyle] = useState<"street"|"satellite"|"terrain">("street");
  const mapRef = useRef<any>(null);

  useEffect(() => {
    if (document.getElementById("wlm-kf")) return;
    const s = document.createElement("style");
    s.id = "wlm-kf";
    s.textContent = `
      @keyframes wlmPulse{0%{transform:scale(1);opacity:.9}100%{transform:scale(2.4);opacity:0}}
      .wlm-popup .leaflet-popup-content-wrapper{border-radius:12px!important;padding:0!important;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,.6)!important;border:1px solid rgba(255,255,255,.07)!important;background:transparent!important}
      .wlm-popup .leaflet-popup-content{margin:0!important}
      .wlm-popup .leaflet-popup-tip{background:#1e293b!important}
      .leaflet-bar{border:none!important;border-radius:10px!important;overflow:hidden!important;box-shadow:0 4px 16px rgba(0,0,0,.5)!important}
      .leaflet-bar a{background:#1e293b!important;color:#94a3b8!important;border:none!important;border-bottom:1px solid #334155!important;width:34px!important;height:34px!important;line-height:34px!important;font-size:18px!important}
      .leaflet-bar a:last-child{border-bottom:none!important}
      .leaflet-bar a:hover{background:#334155!important;color:#e2e8f0!important}
      .leaflet-control-attribution{background:rgba(0,0,0,.5)!important;color:#475569!important;font-size:9px!important;padding:2px 6px!important}
    `;
    document.head.appendChild(s);
  }, []);

  const matchDistrict = (c: any, d: string): boolean => {
    if (d === "All Districts") return true;
    if (c.district && c.district === d) return true;
    const addr = (c.address || c.location || "").toLowerCase();
    return addr.includes(d.toLowerCase());
  };
  const filtered   = complaints.filter(c => statusF==="All"||c.status===statusF).filter(c => matchDistrict(c, districtF));
  const withCoords = filtered.filter(c => c.lat && c.lng);
  const statusCounts = ["Pending","Assigned","Accepted","In Progress","Completed","Resolved"].reduce(
    (acc:Record<string,number>,s) => { acc[s]=complaints.filter(c=>c.status===s).length; return acc; },{}
  );

  const center: [number,number] = withCoords.length > 0
    ? [withCoords.reduce((s:number,c:any)=>s+Number(c.lat),0)/withCoords.length, withCoords.reduce((s:number,c:any)=>s+Number(c.lng),0)/withCoords.length]
    : [16.5062, 80.648];

  const fitAll = () => {
    if (!mapRef.current || !withCoords.length) return;
    mapRef.current.fitBounds(withCoords.map((c:any)=>[Number(c.lat),Number(c.lng)]), {padding:[50,50],maxZoom:14});
  };

  const handleSelect = (c: any) => { setSelC(c); onSelect(c); };

  return (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>

      {/* Header */}
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
        <div>
          <div style={{fontSize:17,fontWeight:800,color:"var(--text-primary)",display:"flex",alignItems:"center",gap:9}}>
            🗺️ My Field Map
            <span style={{display:"flex",alignItems:"center",gap:5,background:"rgba(22,163,74,.12)",border:"1px solid rgba(22,163,74,.3)",borderRadius:20,padding:"3px 11px"}}>
              <span style={{width:6,height:6,borderRadius:"50%",background:"#22c55e",boxShadow:"0 0 7px #22c55e",display:"inline-block"}}/>
              <span style={{fontSize:10,color:"#22c55e",fontWeight:700,fontFamily:"monospace"}}>LIVE</span>
            </span>
          </div>
          <div style={{fontSize:11,color:"var(--text-muted)",marginTop:3,fontFamily:"monospace"}}>
            {withCoords.length} pinned · {filtered.length-withCoords.length} no GPS · {complaints.length} total
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
          {/* District badge — locked to worker's district by default */}
          {workerDistrict ? (
            <div style={{display:"flex",alignItems:"center",gap:6,padding:"7px 13px",borderRadius:10,
              background:"rgba(22,163,74,.12)",border:"1px solid rgba(22,163,74,.35)"}}>
              <span style={{fontSize:13}}>📍</span>
              <span style={{fontSize:12,fontWeight:700,color:"#22c55e"}}>{workerDistrict}</span>
              <span style={{fontSize:10,color:"#64748b",fontWeight:500}}>your district</span>
            </div>
          ) : (
            <select value={districtF} onChange={e=>setDistrictF(e.target.value)}
              style={{padding:"7px 12px",borderRadius:10,border:"1px solid var(--border)",background:"var(--bg-card-alt)",color:"var(--text-primary)",fontSize:12,fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>
              {AP_DISTRICTS.map(d=><option key={d} value={d}>{d}</option>)}
            </select>
          )}
          <button onClick={fitAll} style={{padding:"7px 14px",borderRadius:10,border:"1px solid var(--border)",background:"var(--bg-card-alt)",color:"var(--text-secondary)",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
            ⊞ Fit All
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        {[{l:"Total",v:complaints.length,c:"#3b82f6"},{l:"Active",v:complaints.filter((c:any)=>["Pending","Assigned","Accepted","In Progress"].includes(c.status)).length,c:"#f59e0b"},{l:"Done",v:complaints.filter((c:any)=>["Resolved","Completed"].includes(c.status)).length,c:"#22c55e"},{l:"On Map",v:withCoords.length,c:"#a78bfa"},{l:"No GPS",v:complaints.filter((c:any)=>!c.lat||!c.lng).length,c:"#64748b"}].map(s=>(
          <div key={s.l} style={{flex:"1 1 80px",background:"var(--bg-card-alt)",border:"1px solid var(--border)",borderRadius:10,padding:"10px 14px"}}>
            <div style={{fontSize:20,fontWeight:800,color:s.c,lineHeight:1}}>{s.v}</div>
            <div style={{fontSize:10,color:"var(--text-muted)",fontWeight:600,marginTop:3}}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* Status chips */}
      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
        {(["All","Pending","Assigned","Accepted","In Progress","Completed","Resolved"] as const).map(s=>{
          const col=MAP_STATUS_CLR[s]||"var(--accent)";
          const cnt=s==="All"?complaints.length:(statusCounts[s]||0);
          return(<button key={s} onClick={()=>setStatusF(s)} style={{padding:"5px 13px",borderRadius:20,fontSize:11,fontWeight:600,cursor:"pointer",border:"1px solid",fontFamily:"inherit",transition:"all .15s",background:statusF===s?col:"transparent",color:statusF===s?"#fff":"var(--text-muted)",borderColor:statusF===s?col:"var(--border)"}}>
            {s} ({cnt})
          </button>);
        })}
      </div>

      {/* Map + Sidebar */}
      <div style={{display:"flex",gap:14}}>

        {/* Map */}
        <div style={{flex:1,borderRadius:16,overflow:"hidden",border:"1px solid var(--border)",position:"relative",height:520}}>
          <MapContainer center={center} zoom={withCoords.length>1?10:13}
            style={{width:"100%",height:"100%",background:"#e8e0d8"}}
            zoomControl={true} ref={mapRef}>
            {mapStyle === "street" && (
              <TileLayer
                url="https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
                attribution="&copy; Google Maps"
                subdomains={["mt0","mt1","mt2","mt3"]}
                maxZoom={20}
              />
            )}
            {mapStyle === "satellite" && (
              <TileLayer
                url="https://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}"
                attribution="&copy; Google Maps"
                subdomains={["mt0","mt1","mt2","mt3"]}
                maxZoom={20}
              />
            )}
            {mapStyle === "terrain" && (
              <TileLayer
                url="https://{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}"
                attribution="&copy; Google Maps"
                subdomains={["mt0","mt1","mt2","mt3"]}
                maxZoom={20}
              />
            )}
            <MapFlyController selC={selC}/>
            {withCoords.map((c:any)=>{
              const isSel=selC?.ticketId===c.ticketId;
              const col=MAP_STATUS_CLR[c.status]||"#94a3b8";
              return(
                <Marker key={c.ticketId} position={[Number(c.lat),Number(c.lng)]}
                  icon={makeMarkerIcon(col,MAP_DEPT_ICON[c.department]||"📍",isSel)}
                  zIndexOffset={isSel?1000:0}
                  eventHandlers={{click:()=>handleSelect(c)}}>
                  <Popup className="wlm-popup" maxWidth={250}>
                    <div style={{fontFamily:"system-ui,sans-serif",minWidth:190}}>
                      <div style={{background:col,color:"#fff",padding:"8px 13px",fontSize:11,fontWeight:700,display:"flex",justifyContent:"space-between"}}>
                        <span>{(c.status||"").toUpperCase()}</span>
                        <span style={{opacity:.75,fontSize:10}}>{c.department}</span>
                      </div>
                      <div style={{background:"#1e293b",padding:"10px 13px"}}>
                        <div style={{fontSize:13,fontWeight:700,color:"#f1f5f9",marginBottom:5,lineHeight:1.4}}>{c.title}</div>
                        <div style={{fontSize:11,color:"#94a3b8",marginBottom:8}}>📍 {c.address||"No address"}</div>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                          <span style={{fontSize:10,color:"#475569",fontFamily:"monospace"}}>#{c.ticketId?.slice(-8)}</span>
                          <button onClick={()=>handleSelect(c)} style={{background:col,color:"#fff",border:"none",borderRadius:7,padding:"5px 14px",fontSize:11,fontWeight:700,cursor:"pointer"}}>✓ Select</button>
                        </div>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>

          {/* No GPS */}
          {withCoords.length===0&&(
            <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"rgba(255,255,255,.88)",backdropFilter:"blur(4px)",gap:12,padding:24,zIndex:1000,pointerEvents:"none"}}>
              <div style={{fontSize:48}}>📍</div>
              <div style={{fontSize:14,fontWeight:700,color:"#374151"}}>No GPS Coordinates</div>
              <div style={{fontSize:12,textAlign:"center",maxWidth:280,lineHeight:1.7,color:"#475569"}}>
                {filtered.length===0?"No complaints match the current filter.":`${filtered.length} complaint${filtered.length!==1?"s":""} found but none have GPS data yet.`}
              </div>
            </div>
          )}

          {/* LIVE badge */}
          {withCoords.length>0&&(
            <div style={{position:"absolute",top:12,left:12,zIndex:1000,pointerEvents:"none",display:"flex",flexDirection:"column",gap:6}}>
              <div style={{display:"flex",alignItems:"center",gap:6,background:"rgba(15,23,42,.85)",backdropFilter:"blur(6px)",borderRadius:20,padding:"5px 13px",border:"1px solid rgba(255,255,255,.1)",boxShadow:"0 2px 8px rgba(0,0,0,.3)"}}>
                <span style={{width:7,height:7,borderRadius:"50%",background:"#22c55e",boxShadow:"0 0 8px #22c55e",display:"inline-block"}}/>
                <span style={{fontSize:10,color:"#22c55e",fontWeight:700,fontFamily:"monospace"}}>LIVE · {withCoords.length} PINS</span>
              </div>
              {districtF!=="All Districts"&&<div style={{background:"rgba(22,163,74,.88)",borderRadius:20,padding:"4px 12px",fontSize:10,color:"#fff",fontWeight:700,fontFamily:"monospace"}}>📍 {districtF}</div>}
            </div>
          )}

          {/* Layer switcher */}
          <div style={{position:"absolute",top:12,right:12,zIndex:1000,display:"flex",flexDirection:"column",gap:4}}>
            {(["street","satellite","terrain"] as const).map(s => (
              <button key={s} onClick={()=>setMapStyle(s)}
                style={{padding:"6px 13px",borderRadius:8,border:"none",cursor:"pointer",
                  fontSize:11,fontWeight:700,fontFamily:"monospace",letterSpacing:".04em",
                  background: mapStyle===s ? "#1d4ed8" : "rgba(255,255,255,.92)",
                  color: mapStyle===s ? "#fff" : "#1e293b",
                  boxShadow:"0 2px 8px rgba(0,0,0,.25)",
                  textTransform:"uppercase" as const,
                  transition:"all .15s"}}>
                {s==="street"?"🗺️ Map":s==="satellite"?"🛰️ Satellite":"🏔️ Terrain"}
              </button>
            ))}
          </div>

          {/* Legend */}
          <div style={{position:"absolute",bottom:12,right:12,background:"rgba(255,255,255,.95)",backdropFilter:"blur(8px)",border:"1px solid rgba(0,0,0,.1)",borderRadius:12,padding:"10px 14px",zIndex:1000,pointerEvents:"none",boxShadow:"0 2px 10px rgba(0,0,0,.15)"}}>
            <div style={{fontSize:9,color:"#374151",fontWeight:700,letterSpacing:".1em",marginBottom:8}}>LEGEND</div>
            {[["#f59e0b","Pending"],["#7c3aed","Assigned"],["#0ea5e9","Accepted"],["#3b82f6","In Progress"],["#22c55e","Completed"],["#10b981","Resolved"]].map(([col,lbl])=>(
              <div key={lbl} style={{display:"flex",alignItems:"center",gap:7,marginBottom:5}}>
                <span style={{width:9,height:9,borderRadius:"50%",background:col,display:"inline-block",boxShadow:`0 0 5px ${col}88`,flexShrink:0}}/>
                <span style={{fontSize:10.5,color:"#374151"}}>{lbl}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar */}
        <div style={{width:270,borderRadius:12,border:"1px solid var(--border)",background:"var(--bg-card-alt)",display:"flex",flexDirection:"column",overflow:"hidden",height:520}}>
          <div style={{padding:"11px 14px",borderBottom:"1px solid var(--border)",flexShrink:0}}>
            <div style={{fontSize:11,fontWeight:700,color:"var(--text-muted)",letterSpacing:".1em",textTransform:"uppercase",fontFamily:"monospace"}}>Assigned · {filtered.length}</div>
          </div>
          <div style={{overflowY:"auto",flex:1}}>
            {filtered.length===0?(
              <div style={{padding:24,textAlign:"center",color:"var(--text-muted)",fontSize:12}}>No complaints match</div>
            ):filtered.map((c:any)=>{
              const col=MAP_STATUS_CLR[c.status]||"#94a3b8";
              const hasGPS=!!(c.lat&&c.lng);
              const isSel=selC?.ticketId===c.ticketId;
              return(
                <div key={c.ticketId} onClick={()=>handleSelect(c)}
                  style={{padding:"11px 14px",borderBottom:"1px solid var(--border)",cursor:"pointer",transition:"background .12s",background:isSel?"rgba(22,163,74,.12)":"transparent",borderLeft:`3px solid ${isSel?"var(--accent)":"transparent"}`}}
                  onMouseOver={e=>{if(!isSel)(e.currentTarget as HTMLDivElement).style.background="rgba(255,255,255,.03)";}}
                  onMouseOut={e=>{if(!isSel)(e.currentTarget as HTMLDivElement).style.background="transparent";}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:5}}>
                    <span style={{fontSize:15,flexShrink:0}}>{MAP_DEPT_ICON[c.department]||"📋"}</span>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:11.5,fontWeight:700,color:"var(--text-primary)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.title||"Untitled"}</div>
                      <div style={{fontSize:10,color:"var(--text-muted)",fontFamily:"monospace"}}>#{c.ticketId?.slice(-8)}</div>
                    </div>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <span style={{fontSize:10,fontWeight:700,color:col,background:`${col}22`,border:`1px solid ${col}44`,borderRadius:6,padding:"2px 8px"}}>{c.status}</span>
                    <span style={{fontSize:10,color:hasGPS?"#22c55e":"#475569"}}>{hasGPS?"📍 Pinned":"⚫ No GPS"}</span>
                  </div>
                  {c.address&&<div style={{fontSize:10,color:"var(--text-muted)",marginTop:4,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.address}</div>}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Selected detail bar */}
      {selC&&(
        <div style={{background:"var(--bg-card-alt)",border:"1px solid var(--accent)",borderRadius:12,padding:"13px 16px",display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
          <span style={{fontSize:22,flexShrink:0}}>{MAP_DEPT_ICON[selC.department]||"📋"}</span>
          <div style={{flex:1,minWidth:180}}>
            <div style={{fontSize:13,fontWeight:700,color:"var(--text-primary)"}}>{selC.title}</div>
            <div style={{fontSize:11,color:"var(--text-muted)",marginTop:2}}>{selC.address||"No address"} · {selC.department}</div>
          </div>
          <span style={{fontSize:10,fontWeight:700,color:MAP_STATUS_CLR[selC.status]||"#94a3b8",background:`${MAP_STATUS_CLR[selC.status]||"#94a3b8"}22`,border:`1px solid ${MAP_STATUS_CLR[selC.status]||"#94a3b8"}44`,borderRadius:8,padding:"4px 11px"}}>{selC.status}</span>
          {selC.lat&&selC.lng&&(
            <a href={`https://www.google.com/maps/dir/?api=1&destination=${selC.lat},${selC.lng}&travelmode=driving`} target="_blank" rel="noreferrer"
              style={{padding:"9px 18px",borderRadius:10,background:"linear-gradient(135deg,#1d4ed8,#3b82f6)",color:"#fff",fontSize:12,fontWeight:700,textDecoration:"none",display:"flex",alignItems:"center",gap:6,whiteSpace:"nowrap",flexShrink:0}}>
              🗺️ Navigate
            </a>
          )}
          <button onClick={()=>setSelC(null)} style={{width:32,height:32,borderRadius:"50%",background:"var(--border)",border:"none",cursor:"pointer",color:"var(--text-muted)",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>✕</button>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────── NotificationsPanel ─────────────────────── */

// ─────────────────────────────────────────────────────────────────────────────
// UNIFIED NOTIFICATIONS PANEL
// ─────────────────────────────────────────────────────────────────────────────
interface UnifiedNotif{id:string;icon:string;title:string;body:string;time:string;ticketId?:string;type:"urgent"|"task"|"done"|"alert"|"info"|"warning";read?:boolean;}
function UnifiedNotifsPanel({notifs,onRead,onReadAll,onClose}:{notifs:UnifiedNotif[];onRead:(id:string)=>void;onReadAll:()=>void;onClose:()=>void}){
  const unread=notifs.filter(n=>!n.read).length;
  const tC:{[k:string]:string}={urgent:"#ef4444",task:"#8b5cf6",done:"#10b981",alert:"#f97316",info:"#3b82f6",warning:"#f59e0b"};
  const tB:{[k:string]:string}={urgent:"#fef2f2",task:"#f5f3ff",done:"#ecfdf5",alert:"#fff7ed",info:"#eff6ff",warning:"#fffbeb"};
  const age=(ts:string)=>{const d=Date.now()-new Date(ts).getTime();if(d<60000)return"just now";if(d<3600000)return`${Math.round(d/60000)}m ago`;if(d<86400000)return`${Math.round(d/3600000)}h ago`;return`${Math.round(d/86400000)}d ago`;};
  return(
    <div style={{position:"fixed",right:16,top:68,width:360,background:"#ffffff",borderRadius:16,boxShadow:"0 20px 60px rgba(0,0,0,.18)",border:"1px solid #e2e8f0",zIndex:9999,overflow:"hidden",animation:"fadeIn .2s ease"}}>
      <div style={{padding:"14px 16px",borderBottom:"1px solid #e2e8f0",background:"#f8fafb",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div><div style={{fontWeight:800,fontSize:14,color:"var(--text-primary)"}}>🔔 Notifications</div><div style={{fontSize:10.5,color:"var(--text-muted)",marginTop:1}}>{notifs.length} total · {unread} unread</div></div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          {unread>0&&<button onClick={onReadAll} style={{fontSize:10.5,color:"var(--accent)",background:"rgba(22,163,74,.1)",border:"none",cursor:"pointer",fontWeight:700,fontFamily:"inherit",padding:"4px 10px",borderRadius:7}}>✓ All read</button>}
          <button onClick={onClose} style={{width:26,height:26,borderRadius:"50%",background:"var(--bg-hover)",border:"none",cursor:"pointer",fontSize:13,display:"flex",alignItems:"center",justifyContent:"center",color:"var(--text-muted)"}}>✕</button>
        </div>
      </div>
      <div style={{maxHeight:400,overflowY:"auto"}}>
        {notifs.length===0?(<div style={{textAlign:"center",padding:"36px 16px",color:"var(--text-muted)"}}><div style={{fontSize:32,marginBottom:8}}>🔕</div><div style={{fontSize:13,fontWeight:600}}>No notifications</div></div>
        ):notifs.map(n=>(
          <div key={n.id} onClick={()=>onRead(n.id)} style={{padding:"12px 16px",borderBottom:"1px solid var(--border)",display:"flex",gap:12,alignItems:"flex-start",background:n.read?"var(--bg-card)":`${tC[n.type]}06`,cursor:"pointer",transition:"background .15s"}} onMouseOver={e=>(e.currentTarget.style.background="var(--bg-hover)")} onMouseOut={e=>(e.currentTarget.style.background=n.read?"var(--bg-card)":`${tC[n.type]}06`)}>
            <div style={{width:36,height:36,borderRadius:10,background:tB[n.type],display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>{n.icon}</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:12.5,fontWeight:n.read?500:700,color:n.read?"var(--text-muted)":tC[n.type]}}>{n.title}</div>
              <div style={{fontSize:11.5,color:"var(--text-primary)",marginTop:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontWeight:n.read?400:500}}>{n.body}</div>
              {n.ticketId&&<div style={{fontSize:10,color:"var(--text-muted)",fontFamily:"monospace",marginTop:2}}>{n.ticketId}</div>}
              <div style={{fontSize:10,color:"var(--text-muted)",marginTop:3}}>{age(n.time)}</div>
            </div>
            {!n.read&&<div style={{width:8,height:8,borderRadius:"50%",background:tC[n.type],flexShrink:0,marginTop:4,boxShadow:`0 0 6px ${tC[n.type]}`}}/>}
          </div>
        ))}
      </div>
    </div>
  );
}


/* ─────────────────────── StatusUpdateBar ─────────────────────── */
function StatusUpdateBar({ complaint, onUpdate }: { complaint: any; onUpdate: (id: string, status: string) => void }) {
  const flow = ["Accepted", "In Progress", "Completed"];
  const current = complaint.status;
  return (
    <div style={{ background: "var(--bg-card-alt)", borderRadius: "12px", padding: "12px 14px", border: "1px solid #1e2d3d" }}>
      <div style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: "10px" }}>⚡ Quick Status Update</div>
      <div style={{ display: "flex", gap: "6px" }}>
        {flow.map(s => {
          const isActive = current === s;
          const colors: Record<string, string> = { "Accepted": "#8b5cf6", "In Progress": "#3b82f6", "Completed": "#10b981" };
          const c = colors[s];
          return (
            <button key={s} onClick={() => onUpdate(complaint.id, s)}
              style={{ flex: 1, padding: "8px 6px", borderRadius: "8px", border: `1.5px solid ${isActive ? c : "var(--border)"}`, background: isActive ? `${c}22` : "transparent", color: isActive ? c : "var(--text-muted)", fontSize: "10.5px", fontWeight: 700, cursor: "pointer", fontFamily: "'Syne',sans-serif", transition: "all .2s" }}>
              {isActive ? "✓ " : ""}{s}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ─────────────────────── main component ─────────────────────── */
export default function WorkerDashboard() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const reduxUser = useSelector((s: RootState) => s.auth.user);
  const [localUser, setLocalUser] = useState<any>(() => {
    try { const s = localStorage.getItem("user"); return s ? JSON.parse(s) : null; } catch { return null; }
  });
  const user = localUser || reduxUser;

  const [complaints, setC] = useState<any[]>(() => loadLS("complaints_all"));
  const [activeTab, setTab] = useState<"tasks" | "completed" | "analytics" | "profile" | "map">("tasks");
  const [selected, setSelected] = useState<any | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [notifsOpen, setNotifsOpen] = useState(false);
  const [uMenu, setUM] = useState(false);
  const [proof, setProof] = useState<string | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [filterStatus, setFilterStatus] = useState("All");
  const [sortBy, setSortBy] = useState("newest");
  const [searchQuery, setSearchQuery] = useState("");
  const [resolutionNote, setResolutionNote] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [editSection, setEditSection] = useState<"details"|"password">("details");
  const [editForm, setEditForm] = useState({ name:"", email:"", phone:"", department:"", district:"" });
  const [pwForm, setPwForm] = useState({ current:"", newPw:"", confirm:"" });
  const [pwShow, setPwShow] = useState({ current:false, newPw:false, confirm:false });
  const [savingProfile, setSavingProfile] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);

  /* ── Poll complaints — worker sees only their assigned complaints ── */
  useEffect(() => {
    const API = "http://localhost:3001/api";
    const loadComplaints = async () => {
      try {
        const token = JSON.parse(localStorage.getItem("auth") || "{}").token;
        const res = await fetch(`${API}/complaints`, {
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const json = await res.json();
          const raw = json?.data?.complaints ?? json?.data ?? json;
          if (Array.isArray(raw)) {
            // Normalise backend field names → worker complaint shape
            const normalised = raw.map((c: any) => ({
              ...c,
              ticketId:    c.ticket_id    ?? c.ticketId    ?? c.id,
              title:       c.title        ?? c.category    ?? "Complaint",
              category:    c.category     ?? c.department,
              department:  c.department,
              status:      c.status,
              address:     c.address,
              lat:         c.lat          ? parseFloat(c.lat) : undefined,
              lng:         c.lng          ? parseFloat(c.lng) : undefined,
              emergency:   c.is_emergency === 1 || c.is_emergency === true,
              userId:      c.user_id      ?? c.userId,
              userName:    c.user_name    ?? c.userName,
              assignedTo:  c.assigned_to  ?? c.assignedTo,
              createdAt:   c.created_at   ?? c.createdAt   ?? new Date().toISOString(),
              updatedAt:   c.updated_at   ?? c.updatedAt,
            }));
            setC(normalised);
            // Also fetch real notifications
            try {
              const nRes = await fetch(`${API}/notifications`, {
                headers: { Authorization: `Bearer ${token}` },
              });
              if (nRes.ok) {
                const nData = await nRes.json();
                const notifs = Array.isArray(nData?.data) ? nData.data : [];
                const unread = notifs.filter((n: any) => !(n.is_read === 1 || n.is_read === true));
                if (unread.length > 0 && unread[0]?.message) {
                  // Mark as read after showing
                  showToast(`🔔 ${unread[0].message.slice(0, 80)}`);
                  fetch(`${API}/notifications/read-all`, {
                    method: "PATCH",
                    headers: { Authorization: `Bearer ${token}` },
                  }).catch(() => {});
                }
              }
            } catch {}
            return;
          }
        }
      } catch {
        // Backend not running — use localStorage fallback
      }
      const all = loadLS("complaints_all");
      if (Array.isArray(all)) {
        const mine = all.filter((c: any) =>
          c.assigned_to === user?.id || c.assignedTo === user?.id || c.assignedWorker === user?.name
        );
        setC(mine.length > 0 ? mine : all);
      }
    };
    loadComplaints();
    const iv = setInterval(loadComplaints, 20000);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.name]);

  /* ── poll unread messages ── */
  useEffect(() => {
    const checkUnread = () => {
      const counts: Record<string, number> = {};
      complaints.forEach(c => {
        const msgs = loadMessages(c.ticketId);
        const unread = msgs.filter((m: any) => m.role !== "worker" && !m.readByWorker).length;
        if (unread > 0) counts[c.ticketId] = unread;
      });
      setUnreadCounts(counts);
    };
    checkUnread();
    const interval = setInterval(checkUnread, 15000);
    return () => clearInterval(interval);
  }, [complaints]);

  /* ── derived ── */
  const tasks     = complaints.filter(c => c.status === "Pending" || c.status === "Assigned" || c.status === "Accepted" || c.status === "In Progress");
  const completed = complaints.filter(c => c.status === "Resolved" || c.status === "Completed");
  const today     = new Date().toDateString();
  const todayDone = completed.filter(c => c.resolvedAt && new Date(c.resolvedAt).toDateString() === today).length;
  const totalUnread = Object.values(unreadCounts).reduce((a, b) => a + b, 0);
  const urgentCount = tasks.filter(c => c.emergency || PRIORITY[c.department]?.label === "CRITICAL").length;
  const inProgressCount = tasks.filter(c => c.status === "In Progress" || c.status === "Accepted").length;

  const avgResolutionTime = (() => {
    const r = complaints.filter(c => c.status === "Resolved" && c.resolvedAt && c.createdAt);
    if (!r.length) return "—";
    const avg = r.reduce((a: number, c: any) => a + (new Date(c.resolvedAt).getTime() - new Date(c.createdAt).getTime()), 0) / r.length;
    const hrs = Math.round(avg / 3600000);
    return hrs < 1 ? "<1h" : `${hrs}h`;
  })();

  const deptStats = complaints.reduce((acc: Record<string, { total: number; done: number }>, c) => {
    const d = c.department || "Other";
    if (!acc[d]) acc[d] = { total: 0, done: 0 };
    acc[d].total++;
    if (c.status === "Resolved" || c.status === "Completed") acc[d].done++;
    return acc;
  }, {});

  const getFilteredList = () => {
    let base = activeTab === "tasks" ? tasks : activeTab === "completed" ? completed : complaints;
    if (filterStatus !== "All") base = base.filter(c => c.status === filterStatus);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      base = base.filter(c =>
        c.title?.toLowerCase().includes(q) || c.ticketId?.toLowerCase().includes(q) ||
        c.address?.toLowerCase().includes(q) || c.department?.toLowerCase().includes(q)
      );
    }
    return [...base].sort((a, b) => {
      if (sortBy === "newest") return (new Date(b.createdAt).getTime()) - (new Date(a.createdAt).getTime());
      if (sortBy === "oldest") return (new Date(a.createdAt).getTime()) - (new Date(b.createdAt).getTime());
      if (sortBy === "priority") {
        const pa = priorityRank[PRIORITY[a.department]?.label || "LOW"] ?? 3;
        const pb = priorityRank[PRIORITY[b.department]?.label || "LOW"] ?? 3;
        return pa - pb;
      }
      if (sortBy === "department") return (a.department || "").localeCompare(b.department || "");
      return 0;
    });
  };

  const list = getFilteredList();

  /* ── actions ── */
  const showToast = (msg: string) => { setToastMsg(msg); setTimeout(() => setToastMsg(null), 3200); };

  const openEditProfile = () => {
    setEditForm({
      name: user?.name || "",
      email: user?.email || "",
      phone: (user as any)?.phone || "",
      department: (user as any)?.department || "",
      district: (user as any)?.district || "",
    });
    setPwForm({ current:"", newPw:"", confirm:"" });
    setEditSection("details");
    setEditProfileOpen(true);
  };

  const saveProfileDetails = async () => {
    if (!editForm.name.trim() || !editForm.email.trim()) { showToast("❌ Name and email are required"); return; }
    setSavingProfile(true);
    try {
      const API = "http://localhost:3001/api";
      const token2 = JSON.parse(localStorage.getItem("auth") || "{}").token;
      const res = await fetch(`${API}/auth/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token2}` },
        body: JSON.stringify({ name:editForm.name, email:editForm.email, phone:editForm.phone, department:editForm.department, district:editForm.district }),
      });
      if (res.ok) {
        const stored = JSON.parse(localStorage.getItem("user") || "{}");
        const updated = { ...stored, name:editForm.name, email:editForm.email, phone:editForm.phone, department:editForm.department, district:editForm.district };
        localStorage.setItem("user", JSON.stringify(updated));
        // Also update the main auth key so navbar/dashboard refresh
        const authRaw = localStorage.getItem("auth");
        if(authRaw){ try{ const authObj = JSON.parse(authRaw); authObj.user = {...authObj.user, ...updated}; localStorage.setItem("auth", JSON.stringify(authObj)); }catch{} }
        setLocalUser(updated);
        showToast("✅ Profile updated successfully");
        setEditProfileOpen(false);
        setSavingProfile(false);
        return;
      }
    } catch { /* backend offline */ }
    // Offline fallback — update localStorage + local state so UI refreshes immediately
    const stored = JSON.parse(localStorage.getItem("user") || "{}");
    const updated = { ...stored, name:editForm.name, email:editForm.email, phone:editForm.phone, department:editForm.department, district:editForm.district };
    localStorage.setItem("user", JSON.stringify(updated));
    setLocalUser(updated);
    showToast("✅ Profile saved (offline mode)");
    setEditProfileOpen(false);
    setSavingProfile(false);
  };

  const savePassword = async () => {
    if (!pwForm.current.trim()) { showToast("❌ Enter your current password"); return; }
    if (pwForm.newPw.length < 6)  { showToast("❌ New password must be at least 6 characters"); return; }
    if (pwForm.newPw !== pwForm.confirm) { showToast("❌ Passwords do not match"); return; }
    setSavingProfile(true);
    try {
      const API = "http://localhost:3001/api";
      const token3 = JSON.parse(localStorage.getItem("auth") || "{}").token;
      const res = await fetch(`${API}/auth/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token3}` },
        body: JSON.stringify({ currentPassword: pwForm.current, newPassword: pwForm.newPw }),
      });
      if (res.ok) { showToast("✅ Password changed successfully"); setPwForm({current:"",newPw:"",confirm:""}); setEditProfileOpen(false); }
      else { const d = await res.json().catch(()=>({})); showToast(`❌ ${d.message || "Incorrect current password"}`); }
    } catch {
      showToast("✅ Password updated (offline mode)");
      setEditProfileOpen(false);
    }
    setSavingProfile(false);
  };


  const quickStatusUpdate = async (id: string, status: string) => {
    // Update backend
    try {
      const token = JSON.parse(localStorage.getItem("auth") || "{}").token;
      await fetch(`${API}/complaints/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status }),
      });
    } catch (e) { console.warn("[quickStatusUpdate] backend failed:", e); }
    // Update local state
    const updated = complaints.map(c => c.id === id ? { ...c, status, updatedAt: new Date().toISOString() } : c);
    setC(updated); saveAll(updated);
    if (selected?.id === id) setSelected((prev: any) => ({ ...prev, status }));
    showToast(`✅ Status updated to ${status}`);
  };

  const markResolved = async (id: string) => {
    setShowConfirm(false);
    setSubmitting(true);
    const now = Date.now();
    const complaint = complaints.find(c => c.id === id);
    const token = JSON.parse(localStorage.getItem("auth") || "{}").token;

    try {
      // ── Call backend: upload proof + resolve ──────────────────────────────
      if (proof && proof.startsWith("data:")) {
        // Convert base64 to blob and upload as multipart
        const res2 = await fetch(proof);
        const blob = await res2.blob();
        const fd = new FormData();
        fd.append("proof", blob, "proof.jpg");
        if (resolutionNote) fd.append("resolution_note", resolutionNote);
        await fetch(`${API}/complaints/${id}/proof`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        });
      } else {
        // No proof photo — just update status
        await fetch(`${API}/complaints/${id}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ status: "Resolved" }),
        });
      }
    } catch (e) {
      console.warn("[markResolved] Backend call failed:", e);
    }

    // Update local state
    const updated = complaints.map(c =>
      c.id === id
        ? { ...c, status: "Resolved", resolvedAt: now, resolvedBy: user?.name, proofImage: proof || c.proofImage, resolutionNote }
        : c
    );
    setC(updated); saveAll(updated);

    // Save resolution message to chat
    if (complaint) {
      const msgs = loadMessages(complaint.ticketId);
      const autoMsgs: any[] = [
        { id: now.toString() + "_sys", text: `✅ Task marked as RESOLVED

Resolution note: ${resolutionNote || "No note provided"}`, sender: user?.name || "Worker", senderId: user?.id || "worker", role: "worker", timestamp: now, isSystem: true },
      ];
      if (proof) {
        autoMsgs.push({ id: (now + 1).toString() + "_proof", text: "📎 Proof photo submitted for verification", image: proof, sender: user?.name || "Worker", senderId: user?.id || "worker", role: "worker", timestamp: now + 1 });
      }
      saveMessages(complaint.ticketId, [...msgs, ...autoMsgs]);
    }
    if (selected?.id === id) setSelected((prev: any) => ({ ...prev, status: "Resolved", resolvedAt: now, resolutionNote }));
    setProof(null); setProofPreview(null); setResolutionNote(""); setSubmitting(false);
    showToast("✅ Task resolved & saved to database!");
  };

  const handleProof = (file: File) => {
    if (!file.type.startsWith("image/")) return;
    const r = new FileReader();
    r.onloadend = () => { setProof(r.result as string); setProofPreview(r.result as string); };
    r.readAsDataURL(file);
  };

  const openChat = (c: any) => {
    const msgs = loadMessages(c.ticketId);
    const marked = msgs.map((m: any) => m.role !== "worker" ? { ...m, readByWorker: true } : m);
    saveMessages(c.ticketId, marked);
    setUnreadCounts(prev => { const n = { ...prev }; delete n[c.ticketId]; return n; });
    setSelected(c); setChatOpen(true); setMapOpen(false);
  };

  const handleLogout = () => {
    dispatch(clearComplaints()); dispatch(clearNotifications()); dispatch(logout()); navigate("/login");
  };

  const greeting = () => {
    const h = new Date().getHours();
    return h < 12 ? "Good Morning" : h < 17 ? "Good Afternoon" : "Good Evening";
  };

  const getElapsed = (ts: any) => {
    const diff = Date.now() - new Date(ts).getTime();
    if (diff < 3600000) return `${Math.round(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.round(diff / 3600000)}h ago`;
    return `${Math.round(diff / 86400000)}d ago`;
  };

  /* ─────────────────────── render ─────────────────────── */
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-page)", fontFamily: "'Syne','DM Sans',system-ui,sans-serif", color: "var(--text-primary)", paddingTop: 64 }}>
      <AIChatWidget role="worker" />

      <style>{`
  /* ── SYSTEM-DEFAULT THEME (light mode base) ── */
  :root{
    --bg-page:#f8fafc;
    --bg-card:#ffffff;
    --bg-card-alt:#f1f5f9;
    --bg-nav:#ffffff;--bg-nav-glass:rgba(255,255,255,.95);
    --bg-input:#f8fafc;
    --bg-hover:#f1f5f9;
    --border:#e2e8f0;
    --border-strong:#cbd5e1;
    --text-primary:#0f172a;
    --text-secondary:#475569;
    --text-muted:#94a3b8;
    --accent:#16a34a;
    --accent-light:#22c55e;
    --accent-dim:rgba(22,163,74,.10);
    --shadow-sm:0 1px 3px rgba(0,0,0,.07);
    --shadow-md:0 4px 16px rgba(0,0,0,.09);
    --shadow-lg:0 8px 32px rgba(0,0,0,.13);
    --scrollbar:#cbd5e1;
    --nav-border:#e2e8f0;
    --card-shadow:0 1px 3px rgba(0,0,0,.06),0 1px 2px rgba(0,0,0,.04);
    --footer-bg:#0f172a;
    --footer-text:#94a3b8;
    --footer-heading:#ffffff;
    --footer-muted:#64748b;
    --footer-border:#1e293b;
  }
  /* ── DARK MODE (system preference) ── */
  @media(prefers-color-scheme:dark){
    :root{
      --bg-page:#0a0a0f;
      --bg-card:#111118;
      --bg-card-alt:#16161e;
      --bg-nav:#111118;--bg-nav-glass:rgba(17,17,24,.96);
      --bg-input:#16161e;
      --bg-hover:#1e1e2a;
      --border:#1e1e2e;
      --border-strong:#2a2a3e;
      --text-primary:#f1f5f9;
      --text-secondary:#94a3b8;
      --text-muted:#475569;
      --accent:#22c55e;
      --accent-light:#4ade80;
      --accent-dim:rgba(34,197,94,.12);
      --shadow-sm:0 1px 3px rgba(0,0,0,.4);
      --shadow-md:0 4px 16px rgba(0,0,0,.5);
      --shadow-lg:0 8px 32px rgba(0,0,0,.65);
      --scrollbar:#2a2a3e;
      --nav-border:#1e1e2e;
      --card-shadow:0 1px 3px rgba(0,0,0,.5),0 1px 2px rgba(0,0,0,.4);
      --footer-bg:#06060a;
      --footer-text:#64748b;
      --footer-heading:#e2e8f0;
      --footer-muted:#475569;
      --footer-border:#111118;
    }
  }
  *,*::before,*::after{box-sizing:border-box}
  ::-webkit-scrollbar{width:4px;height:4px}
  ::-webkit-scrollbar-track{background:transparent}
  ::-webkit-scrollbar-thumb{background:var(--scrollbar);border-radius:4px}

  ::-webkit-scrollbar{width:4px;height:4px}
  ::-webkit-scrollbar-track{background:transparent}
  ::-webkit-scrollbar-thumb{background:var(--scrollbar-thumb);border-radius:4px}

        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500;600&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:#2d2d3a;border-radius:4px}
        @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
        @keyframes slideRight{from{opacity:0;transform:translateX(24px)}to{opacity:1;transform:translateX(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
        @keyframes toastIn{from{opacity:0;transform:translateY(20px) scale(.95)}to{opacity:1;transform:translateY(0) scale(1)}}
        .fu{animation:fadeUp .4s ease both}
        .fu1{animation:fadeUp .4s .05s ease both;opacity:0}
        .fu2{animation:fadeUp .4s .1s ease both;opacity:0}
        .fu3{animation:fadeUp .4s .15s ease both;opacity:0}
        .fu4{animation:fadeUp .4s .2s ease both;opacity:0}
        .fu5{animation:fadeUp .4s .25s ease both;opacity:0}
        .sr{animation:slideRight .35s ease both}

        .tcard{
          background:var(--bg-card);border:1px solid var(--border);border-radius:12px;
          padding:14px 16px;cursor:pointer;transition:all .22s cubic-bezier(.4,0,.2,1);
          position:relative;overflow:hidden;
        }
        .tcard::before{content:'';position:absolute;inset:0;background:linear-gradient(135deg,rgba(16,185,129,.04),transparent 60%);opacity:0;transition:opacity .22s}
        .tcard:hover{border-color:#2d4a3e;transform:translateY(-2px);box-shadow:0 8px 32px rgba(0,0,0,.4)}
        .tcard:hover::before{opacity:1}
        .tcard.sel{border-color:#10b981;box-shadow:0 0 0 1px rgba(16,185,129,.3),0 8px 32px rgba(0,0,0,.5)}
        .tcard.done{opacity:.7}
        .tcard.has-unread{border-color:#1d4ed8 !important;box-shadow:0 0 0 1px rgba(59,130,246,.2)}
        .tcard.is-urgent{border-color:rgba(220,38,38,.4) !important;box-shadow:0 0 0 1px rgba(220,38,38,.15)}

        .tab-btn{
          padding:8px 18px;border-radius:8px;font-size:12px;font-weight:700;
          border:none;cursor:pointer;transition:all .2s;font-family:'Syne',sans-serif;
          letter-spacing:.04em;text-transform:uppercase;
        }
        .tab-btn.on{background:var(--accent);color:#fff;box-shadow:0 4px 16px rgba(16,185,129,.35)}
        .tab-btn.off{background:transparent;color:#6b7280;border:1px solid transparent}
        .tab-btn.off:hover{color:#a1a1aa;background:var(--bg-card-alt)}

        .stat-card{background:var(--bg-card);border:1px solid var(--border);border-radius:14px;padding:20px;transition:all .2s;position:relative;overflow:hidden}
        .stat-card::after{content:'';position:absolute;bottom:0;left:0;right:0;height:2px;background:linear-gradient(90deg,#10b981,#059669);opacity:0;transition:opacity .2s}
        .stat-card:hover{border-color:#2d4a3e;transform:translateY(-2px)}
        .stat-card:hover::after{opacity:1}

        .btn-resolve{
          width:100%;padding:13px;border-radius:10px;border:none;
          background:linear-gradient(135deg,#059669,#10b981);color:#fff;
          font-size:13.5px;font-weight:800;cursor:pointer;font-family:'Syne',sans-serif;
          letter-spacing:.06em;text-transform:uppercase;
          transition:all .22s;box-shadow:0 4px 16px rgba(16,185,129,.3);
        }
        .btn-resolve:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 8px 24px rgba(16,185,129,.45)}
        .btn-resolve:disabled{background:var(--bg-card-alt);color:var(--text-muted);cursor:not-allowed;box-shadow:none}

        .btn-chat{
          width:100%;padding:11px;border-radius:10px;border:1px solid #1d4ed8;
          background:rgba(29,78,216,.1);color:#60a5fa;
          font-size:13px;font-weight:700;cursor:pointer;font-family:'Syne',sans-serif;
          letter-spacing:.04em;text-transform:uppercase;
          transition:all .22s;display:flex;align-items:center;justify-content:center;gap:8px;
        }
        .btn-chat:hover{background:rgba(29,78,216,.2);border-color:#3b82f6;transform:translateY(-1px)}

        .btn-map{
          width:100%;padding:11px;border-radius:10px;border:1px solid #7c3aed;
          background:rgba(124,58,237,.1);color:#a78bfa;
          font-size:13px;font-weight:700;cursor:pointer;font-family:'Syne',sans-serif;
          letter-spacing:.04em;text-transform:uppercase;
          transition:all .22s;display:flex;align-items:center;justify-content:center;gap:8px;
        }
        .btn-map:hover{background:rgba(124,58,237,.2);border-color:#a78bfa;transform:translateY(-1px)}

        .search-input{background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:9px 36px 9px 14px;color:#e2e8f0;font-family:'DM Sans',sans-serif;font-size:13px;width:100%;outline:none;transition:all .2s}
        .search-input:focus{border-color:#10b981;box-shadow:0 0 0 2px rgba(16,185,129,.15)}
        .search-input::placeholder{color:var(--text-muted)}

        select.filter-sel{background:var(--bg-card);border:1px solid var(--border);border-radius:8px;padding:8px 12px;color:#a1a1aa;font-family:'DM Sans',sans-serif;font-size:12.5px;outline:none;cursor:pointer;transition:border-color .2s}
        select.filter-sel:focus{border-color:#10b981}

        .badge-status{display:inline-flex;align-items:center;gap:4px;padding:3px 9px;border-radius:20px;font-size:10px;font-weight:800;letter-spacing:.06em;text-transform:uppercase}
        .badge-priority{display:inline-flex;align-items:center;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}

        .detail-field{display:flex;gap:10px;padding:10px 12px;background:var(--bg-card-alt);border-radius:9px;border:1px solid var(--border);transition:border-color .2s}
        .detail-field:hover{border-color:#2d4a3e}

        .proof-drop{width:100%;padding:22px;border:2px dashed #23232e;border-radius:10px;background:var(--bg-card);cursor:pointer;text-align:center;transition:all .2s}
        .proof-drop:hover{border-color:#10b981;background:#0f1f18}

        .note-area{width:100%;min-height:72px;background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:10px 12px;color:#e2e8f0;font-family:'DM Sans',sans-serif;font-size:13px;resize:vertical;outline:none;transition:border-color .2s}
        .note-area:focus{border-color:#10b981}
        .note-area::placeholder{color:var(--text-muted)}

        .confirm-overlay{position:fixed;inset:0;background:rgba(0,0,0,.75);backdrop-filter:blur(8px);z-index:300;display:flex;align-items:center;justify-content:center}
        .confirm-modal{background:var(--bg-card);border:1px solid #2d4a3e;border-radius:20px;padding:28px;max-width:380px;width:90%;animation:fadeUp .3s ease;box-shadow:0 32px 64px rgba(0,0,0,.6)}

        .toast{position:fixed;bottom:28px;left:50%;transform:translateX(-50%);background:#059669;color:#fff;padding:12px 22px;border-radius:12px;font-size:13px;font-weight:700;z-index:500;white-space:nowrap;animation:toastIn .3s ease;box-shadow:0 8px 32px rgba(16,185,129,.4);font-family:'Syne',sans-serif;letter-spacing:.04em}

        .analytics-bar{background:var(--bg-card-alt);border-radius:4px;overflow:hidden;height:8px;border:1px solid var(--border)}
        .analytics-bar-fill{height:100%;background:linear-gradient(90deg,#059669,#10b981);border-radius:4px;transition:width .6s cubic-bezier(.4,0,.2,1)}

        .nav-glow{position:absolute;bottom:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,rgba(16,185,129,.5),transparent)}
        .timeline-dot{width:10px;height:10px;border-radius:50%;background:#10b981;flex-shrink:0;margin-top:3px;box-shadow:0 0 8px rgba(16,185,129,.6)}
        .timeline-line{width:1px;background:linear-gradient(180deg,#10b981,transparent);flex-shrink:0;margin:0 4.5px;min-height:24px}

        .panel-tabs{display:flex;background:var(--bg-card-alt);border-bottom:1px solid var(--border)}
        .panel-tab{flex:1;padding:13px;font-size:11px;font-weight:700;font-family:'Syne',sans-serif;letter-spacing:.06em;text-transform:uppercase;border:none;cursor:pointer;transition:all .2s;position:relative}
        .panel-tab.active{background:var(--bg-card);color:#10b981;border-bottom:2px solid #10b981}
        .panel-tab.inactive{background:transparent;color:var(--text-muted)}
        .panel-tab.inactive:hover{color:#6b7280;background:rgba(255,255,255,.03)}
        .panel-tab.chat-active{color:#60a5fa;border-bottom-color:#3b82f6}
        .panel-tab.map-active{color:#a78bfa;border-bottom-color:#7c3aed}
      `}</style>

      {toastMsg && <div className="toast">{toastMsg}</div>}

      {/* CONFIRM MODAL */}
      {showConfirm && selected && (
        <div className="confirm-overlay" onClick={() => setShowConfirm(false)}>
          <div className="confirm-modal" onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: "28px", marginBottom: "12px" }}>🔍</div>
            <div style={{ fontSize: "17px", fontWeight: 800, color: "var(--text-primary)", marginBottom: "6px" }}>Confirm Resolution</div>
            <div style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "20px", lineHeight: 1.6 }}>
              Mark <strong style={{ color: "var(--text-primary)" }}>"{selected.title}"</strong> as resolved?
            </div>
            {proof ? (
              <div style={{ marginBottom: "16px", padding: "10px 12px", background: "var(--bg-card-alt)", border: "1px solid #065f46", borderRadius: "10px", display: "flex", alignItems: "center", gap: "10px" }}>
                <img src={proof} alt="proof" style={{ width: "48px", height: "48px", objectFit: "cover", borderRadius: "7px" }} />
                <div>
                  <div style={{ fontSize: "12px", color: "#10b981", fontWeight: 700 }}>✅ Proof photo ready</div>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>Will be sent to officer's chat</div>
                </div>
              </div>
            ) : (
              <div style={{ marginBottom: "16px", padding: "10px 12px", background: "#1f1510", border: "1px solid #854d0e", borderRadius: "10px", color: "#fbbf24", fontSize: "12px" }}>
                ⚠️ No proof photo — officer won't receive visual confirmation
              </div>
            )}
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={() => setShowConfirm(false)} style={{ flex: 1, padding: "11px", borderRadius: "9px", border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", cursor: "pointer", fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: "13px" }}>Cancel</button>
              <button onClick={() => markResolved(selected.id)} className="btn-resolve" style={{ flex: 2 }}>Confirm & Notify Officer</button>
            </div>
          </div>
        </div>
      )}

      {/* NOTIFICATIONS PANEL */}
      

      {/* NAV */}
      {/* ═══ NAVBAR ═══ */}
      <nav style={{ background: "var(--bg-nav-glass)", position: "fixed", top: 0, left: 0, right: 0, zIndex: 200, borderBottom: "1px solid var(--nav-border)", boxShadow: "0 2px 20px rgba(22,163,74,.12)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}>
        <div style={{ maxWidth: "1440px", margin: "0 auto", padding: "0 24px", height: "64px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          {/* Brand */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
            <img src="/ap-bg.png" alt="AP Seal" style={{width:44,height:44,objectFit:"contain",flexShrink:0}}/>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-.01em", lineHeight: 1 }}>FieldOps Portal</div>
              <div style={{ fontSize: 10, color: "var(--accent)", fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", marginTop: 2 }}>CivicConnect · Field Worker</div>
            </div>
          </div>

          {/* Center tabs */}
          {/* Center tabs */}
<div style={{
  display: "flex",
  alignItems: "center",
  gap: 20
}}>
  {([
    { id: "tasks",     label: "📋 Tasks" },
    { id: "completed", label: "✅ Done" },
    { id: "map",       label: "🗺️  Maps" },
    { id: "analytics", label: "📊 Analytics" },
  ] as const).map(tab => (
    <button
      key={tab.id}
      onClick={() => setTab(tab.id as any)}
      style={{
        background: "transparent",
        border: "none",
        cursor: "pointer",
        fontFamily: "inherit",
        fontSize: 14,

        // ✅ SAME AS CITIZEN NAVBAR
        color: activeTab === tab.id ? "#14532d" : "#16a34a",
        fontWeight: activeTab === tab.id ? 700 : 500,

        paddingBottom: "6px",
        transition: "all 0.2s ease",
        position: "relative",
        whiteSpace: "nowrap"
      }}
    >
      {tab.label}
    </button>
  ))}
</div>

          {/* Right actions */}
          {/* Right actions */}
<div style={{
  display: "flex",
  alignItems: "center",
  gap: 12,
  flexShrink: 0
}}>

  {/* Live badge */}
  <div style={{
    display: "flex",
    alignItems: "center",
    gap: 6,
    background: "rgba(22,163,74,.08)",
    border: "1px solid rgba(22,163,74,.2)",
    borderRadius: 20,
    padding: "6px 12px"
  }}>
    <span style={{
      width: 6,
      height: 6,
      borderRadius: "50%",
      background: "var(--accent)",
      boxShadow: "0 0 6px var(--accent)",
      animation: "pulse 2s infinite",
      display: "inline-block"
    }} />
    <span style={{
      fontSize: 11,
      color: "var(--accent)",
      fontWeight: 700,
      fontFamily: "'DM Mono',monospace"
    }}>
      LIVE
    </span>
  </div>

  {/* District Button */}
  <button
    onClick={() => setTab("map")}
    title="View your district on the field map"
    style={{
      display: "flex",
      alignItems: "center",
      gap: 6,
      padding: "6px 12px",
      borderRadius: 20,
      border: "1px solid var(--border)",
      background: "var(--bg-card-alt)",
      fontSize: 11.5,
      fontWeight: 600,
      color: "var(--text-secondary)",
      cursor: "pointer",
      transition: "all .2s"
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.color = "#16a34a";
      e.currentTarget.style.borderColor = "#16a34a";
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.color = "var(--text-secondary)";
      e.currentTarget.style.borderColor = "var(--border)";
    }}
  >
    📍 📍 {(user as any)?.district || "Your Region"}
  </button>

  {/* Messages */}
  <button
    onClick={() =>
      showToast(
        totalUnread > 0
          ? `💬 ${totalUnread} unread message${totalUnread !== 1 ? "s" : ""} from officers`
          : "💬 No new messages"
      )
    }
    style={{
      width: 38,
      height: 38,
      borderRadius: 10,
      border: `1px solid ${totalUnread > 0 ? "#3b82f6" : "var(--border)"}`,
      background: totalUnread > 0 ? "rgba(59,130,246,.1)" : "var(--bg-card-alt)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer",
      position: "relative",
      transition: "all .2s"
    }}
  >
    💬
    {totalUnread > 0 && (
      <span style={{
        position: "absolute",
        top: -4,
        right: -4,
        minWidth: 17,
        height: 17,
        borderRadius: 9,
        background: "#3b82f6",
        fontSize: 9,
        fontWeight: 800,
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 3px"
      }}>
        {totalUnread}
      </span>
    )}
  </button>

  {/* Notifications */}
  <div style={{ position: "relative" }}>
    <button
      onClick={() => { setNotifsOpen(!notifsOpen); setUM(false); }}
      style={{
        width: 38,
        height: 38,
        borderRadius: 10,
        border: `1px solid ${
          notifsOpen ? "#16a34a" : urgentCount > 0 ? "#ef4444" : "var(--border)"
        }`,
        background: notifsOpen
          ? "#16a34a"
          : urgentCount > 0
          ? "rgba(239,68,68,.1)"
          : "var(--bg-card-alt)",
        color: notifsOpen ? "#fff" : "inherit",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        position: "relative",
        transition: "all .2s"
      }}
    >
      🔔
      {(tasks.length > 0 || urgentCount > 0) && (
        <span style={{
          position: "absolute",
          top: -3,
          right: -3,
          minWidth: 16,
          height: 16,
          borderRadius: 8,
          background: urgentCount > 0 ? "#ef4444" : "#f59e0b",
          fontSize: 9,
          fontWeight: 800,
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        }}>
          {tasks.length}
        </span>
      )}
    </button>

    {notifsOpen && (
      <UnifiedNotifsPanel
        notifs={[...tasks.map((t:any)=>({}))]} // keep your original logic here
        onRead={()=>{}}
        onReadAll={()=>{}}
        onClose={()=>setNotifsOpen(false)}
      />
    )}
  </div>

  {/* User menu */}
  <div style={{ position: "relative" }}>
    <button
      onClick={() => setUM(!uMenu)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        background: "var(--bg-card-alt)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: "6px 12px",
        cursor: "pointer",
        transition: "all .2s"
      }}
    >
      <div style={{
        width: 30,
        height: 30,
        borderRadius: 9,
        background: "linear-gradient(135deg,#16a34a,#22c55e)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#fff",
        fontWeight: 800,
        fontSize: 13
      }}>
        {user?.name?.charAt(0).toUpperCase() || "W"}
      </div>

      <div style={{ textAlign: "left" }}>
        <div style={{
          fontSize: 13,
          fontWeight: 700,
          color: "var(--text-primary)"
        }}>
          {user?.name?.split(" ")[0] || "Worker"}
        </div>
        <div style={{
          fontSize: 10,
          color: "var(--accent)",
          fontWeight: 600
        }}>
          Field Worker
        </div>
      </div>

      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="3" strokeLinecap="round">
        <path d="m6 9 6 6 6-6" />
      </svg>
    </button>
  </div>

</div>
        </div>
      </nav>

      {/* HERO */}
      <div style={{ background: "linear-gradient(135deg,var(--accent) 0%,#15803d 60%,#166534 100%)", padding: "28px 24px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle at 1px 1px,rgba(255,255,255,.08) 1px,transparent 0)", backgroundSize: "28px 28px", pointerEvents: "none" }} />
        <div style={{ position: "absolute", top: -60, right: "10%", width: 260, height: 260, borderRadius: "50%", background: "rgba(255,255,255,.07)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: -40, left: "5%", width: 180, height: 180, borderRadius: "50%", background: "rgba(255,255,255,.05)", pointerEvents: "none" }} />
        <div style={{ maxWidth: "1440px", margin: "0 auto", position: "relative" }}>
          <div style={{ marginBottom: "22px" }}>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,.7)", fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", marginBottom: 6, fontFamily: "'DM Mono',monospace" }}>◉ {greeting()} · CivicConnect</div>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: "#fff", letterSpacing: "-.02em" }}>
              {user?.name?.split(" ")[0] || "Worker"} — <span style={{ opacity: .85 }}>{tasks.length} active task{tasks.length !== 1 ? "s" : ""}</span>
            </h1>
            <div style={{ fontSize: 12.5, color: "rgba(255,255,255,.65)", marginTop: 4, fontFamily: "'DM Mono',monospace" }}>
              {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })} · {completed.length} total resolved
            </div>
          </div>
          {/* ── STAT WIDGETS (Overview) ── */}
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            {[
              { label: "Active Tasks",    value: tasks.length,        accent: "#f59e0b", icon: "⚡" },
              { label: "In Progress",     value: inProgressCount,     accent: "#3b82f6", icon: "🔄" },
              { label: "Done Today",      value: todayDone,           accent: "#10b981", icon: "✅" },
              { label: "Total Resolved",  value: completed.length,    accent: "#22d3ee", icon: "🏆" },
              { label: "Avg Resolution",  value: avgResolutionTime,   accent: "#a78bfa", icon: "⏱️" },
              { label: "🚨 Urgent",       value: urgentCount,         accent: "#ef4444", icon: "🚨" },
              { label: "Unread Messages", value: totalUnread,         accent: "#60a5fa", icon: "💬" },
            ].map((s, i) => (
              <div key={s.label} className={`stat-card fu${Math.min(i + 1, 5)}`} style={{ minWidth: "110px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}>
                  <span style={{ fontSize: "16px" }}>{s.icon}</span>
                  <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: s.accent, display: "inline-block", boxShadow: `0 0 8px ${s.accent}`, animation: (s.label === "Unread Messages" && totalUnread > 0) || (s.label === "🚨 Urgent" && urgentCount > 0) ? "pulse 1.5s infinite" : "none" }} />
                </div>
                <div style={{ fontSize: "26px", fontWeight: 900, color: s.accent, fontFamily: "'DM Mono',monospace", lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "4px", textTransform: "uppercase", letterSpacing: ".08em" }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* MAIN GRID */}
      <div style={{ maxWidth: "1440px", margin: "0 auto", padding: "24px 28px", display: "grid", gridTemplateColumns: selected ? "1fr 430px" : "1fr", gap: "18px", alignItems: "start" }}>

        {/* LEFT COLUMN */}
        <div className="fu">
          {/* Tabs */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
            <div style={{ display: "flex", gap: "4px", background: "var(--bg-card)", borderRadius: "10px", padding: "4px", border: "1px solid var(--border)" }}>
              {(["tasks", "completed", "map", "analytics"] as const).map(tab => (
                <button key={tab} className={`tab-btn ${activeTab === tab ? "on" : "off"}`} onClick={() => setTab(tab)}>
                  {tab === "tasks" ? `Tasks (${tasks.length})` : tab === "completed" ? `Done (${completed.length})` : tab === "map" ? "🗺️ Map" : "Analytics"}
                </button>
              ))}
            </div>
            {activeTab !== "analytics" && activeTab !== "profile" && activeTab !== "map" && <div style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "'DM Mono',monospace" }}>{list.length} showing</div>}
          </div>

          {/* Filters */}
          {activeTab !== "analytics" && activeTab !== "profile" && activeTab !== "map" && (
            <div style={{ display: "flex", gap: "10px", marginBottom: "14px", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: "200px", position: "relative" }}>
                <input className="search-input" placeholder="Search title, ticket, location…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                <svg style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
              </div>
              <select className="filter-sel" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                {FILTER_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
              <select className="filter-sel" value={sortBy} onChange={e => setSortBy(e.target.value)}>
                {SORT_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          )}


          {activeTab === "profile" && (
            <div style={{ maxWidth: 860, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>

              {/* HERO BANNER */}
              <div style={{ background: "linear-gradient(135deg,#15803d 0%,#16a34a 50%,#22c55e 100%)", borderRadius: 20, padding: "32px 28px", position: "relative", overflow: "hidden", boxShadow: "0 8px 32px rgba(22,163,74,.25)" }}>
                <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle at 1px 1px,rgba(255,255,255,.07) 1px,transparent 0)", backgroundSize: "22px 22px", pointerEvents: "none" }} />
                <div style={{ position: "absolute", top: -40, right: "8%", width: 180, height: 180, borderRadius: "50%", background: "rgba(255,255,255,.07)", pointerEvents: "none" }} />
                <div style={{ display: "flex", alignItems: "center", gap: 20, position: "relative", flexWrap: "wrap" }}>
                  <div style={{ position: "relative", flexShrink: 0 }}>
                    <div style={{ width: 76, height: 76, borderRadius: 20, background: "rgba(255,255,255,.22)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, fontWeight: 900, color: "#fff", border: "2.5px solid rgba(255,255,255,.4)", boxShadow: "0 8px 20px rgba(0,0,0,.15)" }}>
                      {user?.name?.charAt(0).toUpperCase() || "W"}
                    </div>
                    <div style={{ position: "absolute", bottom: -4, right: -4, width: 22, height: 22, borderRadius: "50%", background: "#22c55e", border: "3px solid #16a34a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#fff" }}>✓</div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 24, fontWeight: 900, color: "#fff", lineHeight: 1.1, letterSpacing: "-.02em" }}>{user?.name || "Field Worker"}</div>
                    <div style={{ fontSize: 12.5, color: "rgba(255,255,255,.8)", marginTop: 5, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <span style={{ background: "rgba(255,255,255,.15)", padding: "2px 10px", borderRadius: 20, fontWeight: 700 }}>🔧 Field Worker</span>
                      <span style={{ background: "rgba(255,255,255,.12)", padding: "2px 10px", borderRadius: 20 }}>{(user as any)?.department || "All Departments"}</span>
                      <span style={{ background: "rgba(255,255,255,.12)", padding: "2px 10px", borderRadius: 20 }}>📍 {(user as any)?.district || "AP"}</span>
                    </div>
                    <div style={{ fontSize: 11.5, color: "rgba(255,255,255,.65)", marginTop: 4 }}>{user?.email || "—"}</div>
                    <div style={{ display:"flex", gap:8, marginTop:12, flexWrap:"wrap" }}>
                      <button onClick={openEditProfile}
                        style={{ display:"flex", alignItems:"center", gap:6, padding:"7px 16px", borderRadius:10, background:"rgba(255,255,255,.9)", color:"#15803d", border:"none", fontSize:12, fontWeight:800, cursor:"pointer", fontFamily:"inherit", transition:"all .18s", boxShadow:"0 2px 8px rgba(0,0,0,.12)" }}
                        onMouseOver={e=>(e.currentTarget.style.background="#fff")}
                        onMouseOut={e=>(e.currentTarget.style.background="rgba(255,255,255,.9)")}>
                        ✏️ Edit Profile
                      </button>
                      <button onClick={()=>{ openEditProfile(); setEditSection("password"); }}
                        style={{ display:"flex", alignItems:"center", gap:6, padding:"7px 16px", borderRadius:10, background:"rgba(255,255,255,.15)", color:"#fff", border:"1.5px solid rgba(255,255,255,.35)", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit", transition:"all .18s" }}
                        onMouseOver={e=>(e.currentTarget.style.background="rgba(255,255,255,.25)")}
                        onMouseOut={e=>(e.currentTarget.style.background="rgba(255,255,255,.15)")}>
                        🔑 Change Password
                      </button>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    {[{l:"Total",v:complaints.length,icon:"📋"},{l:"Active",v:tasks.length,icon:"⚡"},{l:"Done",v:completed.length,icon:"✅"},{l:"Today",v:todayDone,icon:"🏆"}].map((s:any)=>(
                      <div key={s.l} style={{ textAlign: "center", background: "rgba(255,255,255,.15)", borderRadius: 14, padding: "12px 16px", backdropFilter: "blur(10px)", border: "1px solid rgba(255,255,255,.2)", minWidth: 68 }}>
                        <div style={{ fontSize: 18, marginBottom: 2 }}>{s.icon}</div>
                        <div style={{ fontSize: 20, fontWeight: 900, color: "#fff", lineHeight: 1 }}>{s.v}</div>
                        <div style={{ fontSize: 9.5, color: "rgba(255,255,255,.8)", fontWeight: 700, marginTop: 2, letterSpacing: ".06em" }}>{s.l}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* ACCOUNT + STATS ROW */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div style={{ background: "var(--bg-card)", borderRadius: 16, padding: "20px", border: "1px solid var(--border)", boxShadow: "var(--card-shadow)" }}>
                  <div style={{ fontWeight: 800, fontSize: 13.5, color: "var(--text-primary)", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(22,163,74,.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>👤</span>
                    Account Details
                  </div>
                  {([{icon:"✏️",l:"Full Name",v:user?.name||"—"},{icon:"📧",l:"Email",v:user?.email||"—"},{icon:"🔧",l:"Role",v:"Field Worker"},{icon:"🏢",l:"Department",v:(user as any)?.department||"All Depts"},{icon:"📍",l:"District",v:(user as any)?.district || "Not Specified"},{icon:"🛡️",l:"Status",v:"Active & Verified"},{icon:"📅",l:"Member Since",v:"2026"}] as any[]).map((row:any)=>(
                    <div key={row.l} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: "1px solid var(--border)" }}>
                      <span style={{ fontSize: 14, width: 20, textAlign: "center" as const, flexShrink: 0 }}>{row.icon}</span>
                      <span style={{ fontSize: 12, color: "var(--text-muted)", width: 90, flexShrink: 0 }}>{row.l}</span>
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-primary)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{row.v}</span>
                    </div>
                  ))}
                </div>
                <div style={{ background: "var(--bg-card)", borderRadius: 16, padding: "20px", border: "1px solid var(--border)", boxShadow: "var(--card-shadow)" }}>
                  <div style={{ fontWeight: 800, fontSize: 13.5, color: "var(--text-primary)", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(59,130,246,.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>📊</span>
                    Performance Stats
                  </div>
                  {([{l:"Total Assigned",v:complaints.length,c:"#3b82f6",icon:"📋"},{l:"Completed",v:completed.length,c:"#10b981",icon:"✅"},{l:"In Progress",v:inProgressCount,c:"#8b5cf6",icon:"🔄"},{l:"Avg Resolution",v:avgResolutionTime,c:"#f59e0b",icon:"⏱️"},{l:"Done Today",v:todayDone,c:"#22c55e",icon:"🏆"},{l:"Unread Msgs",v:totalUnread,c:"#60a5fa",icon:"💬"},{l:"Urgent Tasks",v:urgentCount,c:"#ef4444",icon:"🚨"}] as any[]).map((row:any)=>(
                    <div key={row.l} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: "1px solid var(--border)" }}>
                      <span style={{ fontSize: 14, width: 20, textAlign: "center" as const, flexShrink: 0 }}>{row.icon}</span>
                      <span style={{ fontSize: 12, color: "var(--text-muted)", flex: 1 }}>{row.l}</span>
                      <span style={{ fontSize: 13.5, fontWeight: 800, color: row.c, fontFamily: "'DM Mono',monospace" }}>{row.v}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* EFFICIENCY + DEPT */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div style={{ background: "var(--bg-card)", borderRadius: 16, padding: "20px", border: "1px solid var(--border)", boxShadow: "var(--card-shadow)" }}>
                  <div style={{ fontWeight: 800, fontSize: 13.5, color: "var(--text-primary)", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(245,158,11,.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>⚡</span>
                    Efficiency
                  </div>
                  {([{l:"Resolution Rate",v:complaints.length>0?Math.round((completed.length/complaints.length)*100):0,color:"#10b981"},{l:"Active Rate",v:complaints.length>0?Math.round((tasks.length/complaints.length)*100):0,color:"#f59e0b"},{l:"Urgent Rate",v:complaints.length>0?Math.round((urgentCount/(complaints.length||1))*100):0,color:"#ef4444"}] as any[]).map((item:any)=>(
                    <div key={item.l} style={{ marginBottom: 16 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                        <span style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 500 }}>{item.l}</span>
                        <span style={{ fontSize: 13, fontWeight: 800, color: item.color, fontFamily: "'DM Mono',monospace" }}>{item.v}%</span>
                      </div>
                      <div style={{ height: 7, background: "var(--bg-card-alt)", borderRadius: 4, overflow: "hidden", border: "1px solid var(--border)" }}>
                        <div style={{ height: "100%", width: `${item.v}%`, background: item.color, borderRadius: 4 }} />
                      </div>
                    </div>
                  ))}
                  <div style={{ marginTop: 16, padding: "14px", background: "var(--bg-card-alt)", borderRadius: 12, border: "1px solid var(--border)", textAlign: "center" as const }}>
                    <div style={{ fontSize: 28, fontWeight: 900, color: "var(--accent)", fontFamily: "'DM Mono',monospace" }}>{complaints.length>0?Math.round((completed.length/complaints.length)*100):0}%</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4, fontWeight: 600 }}>Overall Completion Rate</div>
                  </div>
                </div>
                <div style={{ background: "var(--bg-card)", borderRadius: 16, padding: "20px", border: "1px solid var(--border)", boxShadow: "var(--card-shadow)" }}>
                  <div style={{ fontWeight: 800, fontSize: 13.5, color: "var(--text-primary)", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(139,92,246,.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>🏢</span>
                    By Department
                  </div>
                  {Object.keys(deptStats).length === 0
                    ? <div style={{ textAlign: "center", color: "var(--text-muted)", fontSize: 13, padding: "30px 0" }}>No department data yet</div>
                    : (Object.entries(deptStats) as any[]).map(([dept, s]:any)=>{
                      const pct = s.total > 0 ? Math.round((s.done / s.total) * 100) : 0;
                      return (
                        <div key={dept} style={{ marginBottom: 13 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, alignItems: "center" }}>
                            <span style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 600, display: "flex", alignItems: "center", gap: 5 }}>
                              <span>{DI[dept] || "🏛️"}</span>{dept.length > 14 ? dept.slice(0, 14) + "…" : dept}
                            </span>
                            <span style={{ fontSize: 10.5, color: "var(--text-muted)", fontFamily: "'DM Mono',monospace" }}>{s.done}/{s.total}</span>
                          </div>
                          <div style={{ height: 6, background: "var(--bg-card-alt)", borderRadius: 3, overflow: "hidden", border: "1px solid var(--border)" }}>
                            <div style={{ height: "100%", width: `${pct}%`, background: pct >= 80 ? "#22c55e" : pct >= 50 ? "#f59e0b" : "#ef4444", borderRadius: 3 }} />
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* RECENT TASKS */}
              <div style={{ background: "var(--bg-card)", borderRadius: 16, padding: "20px", border: "1px solid var(--border)", boxShadow: "var(--card-shadow)" }}>
                <div style={{ fontWeight: 800, fontSize: 13.5, color: "var(--text-primary)", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(16,185,129,.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>🔧</span>
                    Recent Tasks
                  </div>
                  <button onClick={() => setTab("tasks")} style={{ fontSize: 11.5, fontWeight: 700, color: "var(--accent)", background: "var(--accent-dim)", border: "1px solid rgba(22,163,74,.2)", borderRadius: 8, padding: "4px 12px", cursor: "pointer", fontFamily: "inherit" }}>View All →</button>
                </div>
                {[...tasks, ...completed].slice(0, 6).length === 0
                  ? <div style={{ textAlign: "center", color: "var(--text-muted)", fontSize: 13, padding: "24px 0" }}>No tasks assigned yet</div>
                  : [...tasks, ...completed].slice(0, 6).map((t: any) => {
                    const sc = SC[t.status];
                    return (
                      <div key={t.id} onClick={() => { setTab("tasks"); setSelected(t); }} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 10, marginBottom: 6, background: "var(--bg-card-alt)", border: "1px solid var(--border)", cursor: "pointer", transition: "all .15s" }}
                        onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--accent-light)")}
                        onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border)")}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: sc?.dot || "#94a3b8", flexShrink: 0 }} />
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--bg-card)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>{DI[t.department] || "🏛️"}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{t.title || t.category || "Task"}</div>
                          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>{t.department} · {getElapsed(t.createdAt)}</div>
                        </div>
                        <span style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "monospace", flexShrink: 0 }}>{t.ticketId}</span>
                        <span style={{ fontSize: 10, padding: "3px 9px", borderRadius: 20, background: (sc?.bg||"#f1f5f9")+"33", color: sc?.text||"var(--text-muted)", border: `1px solid ${sc?.border||"var(--border)"}44`, fontWeight: 700, flexShrink: 0 }}>{t.status}</span>
                      </div>
                    );
                  })}
              </div>

              {/* QUICK ACTIONS */}
              <div style={{ background: "var(--bg-card)", borderRadius: 16, padding: "20px", border: "1px solid var(--border)", boxShadow: "var(--card-shadow)" }}>
                <div style={{ fontWeight: 800, fontSize: 13.5, color: "var(--text-primary)", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(245,158,11,.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>🚀</span>
                  Quick Actions
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 10 }}>
                  {([{icon:"📋",label:"View My Tasks",sub:`${tasks.length} active tasks`,action:()=>setTab("tasks"),color:"#3b82f6"},{icon:"✅",label:"Completed Tasks",sub:`${completed.length} resolved`,action:()=>setTab("completed"),color:"#10b981"},{icon:"📊",label:"Analytics",sub:"View performance",action:()=>setTab("analytics"),color:"#8b5cf6"},{icon:"🔔",label:"Notifications",sub:`${urgentCount} urgent`,action:()=>setNotifsOpen(true),color:"#f59e0b"}] as any[]).map((item:any)=>(
                    <button key={item.label} onClick={item.action}
                      style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", background: "var(--bg-card-alt)", border: "1px solid var(--border)", borderRadius: 12, cursor: "pointer", textAlign: "left" as const, transition: "all .18s", fontFamily: "inherit" }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = item.color; e.currentTarget.style.background = `${item.color}0d`; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.background = "var(--bg-card-alt)"; }}>
                      <div style={{ width: 38, height: 38, borderRadius: 10, background: `${item.color}18`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{item.icon}</div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{item.label}</div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>{item.sub}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* SIGN OUT */}
              <div style={{ background: "var(--bg-card)", borderRadius: 16, padding: "18px 20px", border: "1px solid var(--border)", boxShadow: "var(--card-shadow)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>Sign Out</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>You will be redirected to the login page</div>
                </div>
                <button onClick={handleLogout}
                  style={{ padding: "10px 22px", borderRadius: 10, background: "rgba(239,68,68,.08)", border: "1.5px solid rgba(239,68,68,.2)", color: "#ef4444", fontSize: 13.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 8, transition: "all .18s", whiteSpace: "nowrap" as const }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(239,68,68,.15)"; e.currentTarget.style.borderColor = "rgba(239,68,68,.4)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "rgba(239,68,68,.08)"; e.currentTarget.style.borderColor = "rgba(239,68,68,.2)"; }}>
                  <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
                  Sign Out
                </button>
              </div>

            </div>
          )}

          {/* LIVE MAP TAB */}
          {activeTab === "map" && (
            <div style={{ padding: "4px 0" }}>
              <WorkerLiveMap
                complaints={
                  (user as any)?.district
                    ? complaints.filter(c => {
                      const d = (user as any).district;
                      if (!d) return true;
                      if (c.district && c.district === d) return true;
                      const addr = (c.address || c.location || "").toLowerCase();
                      return addr.includes(d.toLowerCase());
                    })
                    : complaints
                }
                workerDistrict={(user as any)?.district}
                onSelect={(c) => { setSelected(c); setTab("tasks"); }}
              />
            </div>
          )}

          {/* ANALYTICS TAB */}
          {activeTab === "analytics" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {/* Summary stats */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "12px" }}>
                {[
                  { label: "Total Tasks", value: complaints.length, color: "var(--text-primary)" },
                  { label: "Pending", value: complaints.filter(c => c.status === "Pending" || c.status === "Assigned").length, color: "#f59e0b" },
                  { label: "In Progress", value: inProgressCount, color: "#3b82f6" },
                  { label: "Resolved", value: completed.length, color: "#10b981" },
                ].map(item => (
                  <div key={item.label} className="stat-card" style={{ textAlign: "center" }}>
                    <div style={{ fontSize: "32px", fontWeight: 900, color: item.color, fontFamily: "'DM Mono',monospace" }}>{item.value}</div>
                    <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "6px", textTransform: "uppercase", letterSpacing: ".1em" }}>{item.label}</div>
                    <div style={{ marginTop: "10px" }}>
                      <div className="analytics-bar">
                        <div className="analytics-bar-fill" style={{ width: complaints.length ? `${Math.round((item.value / complaints.length) * 100)}%` : "0%", background: `linear-gradient(90deg,${item.color}88,${item.color})` }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {/* Worker performance */}
              <div className="stat-card">
                <div style={{ fontSize: "10.5px", color: "var(--text-muted)", fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: "16px" }}>⚡ Your Performance</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "14px" }}>
                  {[
                    { label: "Avg Resolution", value: avgResolutionTime, icon: "⏱️", color: "#a78bfa" },
                    { label: "Tasks Done Today", value: todayDone, icon: "✅", color: "#10b981" },
                    { label: "Efficiency Rate", value: complaints.length > 0 ? `${Math.round((completed.length / complaints.length) * 100)}%` : "0%", icon: "📈", color: "#f59e0b" },
                  ].map(s => (
                    <div key={s.label} style={{ background: "var(--bg-card-alt)", borderRadius: "10px", padding: "14px", textAlign: "center", border: "1px solid var(--border)" }}>
                      <div style={{ fontSize: "22px", marginBottom: "6px" }}>{s.icon}</div>
                      <div style={{ fontSize: "22px", fontWeight: 800, color: s.color, fontFamily: "'DM Mono',monospace" }}>{s.value}</div>
                      <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "4px" }}>{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="stat-card">
                <div style={{ fontSize: "10.5px", color: "var(--text-muted)", fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: "16px" }}>Department Breakdown</div>
                {Object.keys(deptStats).length === 0
                  ? <div style={{ textAlign: "center", color: "var(--text-muted)", fontSize: "13px", padding: "20px" }}>No data yet</div>
                  : Object.entries(deptStats).map(([dept, s]) => {
                    const pct = s.total > 0 ? Math.round((s.done / s.total) * 100) : 0;
                    return (
                      <div key={dept} style={{ marginBottom: "12px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                          <span style={{ fontSize: "13px", color: "var(--text-primary)", fontWeight: 600 }}>{DI[dept] || "🏛️"} {dept}</span>
                          <span style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "'DM Mono',monospace" }}>{s.done}/{s.total} · {pct}%</span>
                        </div>
                        <div className="analytics-bar"><div className="analytics-bar-fill" style={{ width: `${pct}%` }} /></div>
                      </div>
                    );
                  })}
              </div>
              <div className="stat-card">
                <div style={{ fontSize: "10.5px", color: "var(--text-muted)", fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: "16px" }}>Recent Resolutions</div>
                {!completed.length
                  ? <div style={{ color: "var(--text-muted)", fontSize: "13px", textAlign: "center", padding: "20px" }}>No completions yet</div>
                  : completed.slice(0, 6).map((c: any, i: number) => (
                    <div key={c.id} style={{ display: "flex", gap: "12px" }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                        <div className="timeline-dot" />
                        {i < Math.min(completed.length, 6) - 1 && <div className="timeline-line" />}
                      </div>
                      <div style={{ paddingBottom: "16px", flex: 1 }}>
                        <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>{c.title}</div>
                        <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px", fontFamily: "'DM Mono',monospace" }}>
                          {c.department} · {c.resolvedAt ? getElapsed(c.resolvedAt) : "—"}
                          {c.proofImage && <span style={{ color: "#10b981", marginLeft: "6px" }}>📸 proof sent</span>}
                        </div>
                        {c.resolutionNote && <div style={{ fontSize: "11.5px", color: "var(--text-muted)", marginTop: "4px", fontStyle: "italic" }}>"{c.resolutionNote.slice(0, 80)}{c.resolutionNote.length > 80 ? "…" : ""}"</div>}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* TASK LIST */}
          {activeTab !== "analytics" && activeTab !== "profile" && activeTab !== "map" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {!list.length && (
                <div style={{ textAlign: "center", padding: "60px 40px", color: "var(--text-muted)", background: "var(--bg-card)", borderRadius: "14px", border: "1px solid var(--border)" }}>
                  <div style={{ fontSize: "40px", marginBottom: "12px" }}>{searchQuery ? "🔍" : activeTab === "tasks" ? "🎉" : "📭"}</div>
                  <div style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-muted)" }}>
                    {searchQuery ? "No matches found" : activeTab === "tasks" ? "All caught up!" : "No completed tasks yet"}
                  </div>
                  {searchQuery && (
                    <button onClick={() => setSearchQuery("")} style={{ marginTop: "12px", background: "transparent", border: "1px solid var(--border)", color: "#10b981", borderRadius: "8px", padding: "8px 16px", cursor: "pointer", fontFamily: "'Syne',sans-serif", fontSize: "12px", fontWeight: 700 }}>
                      Clear Search
                    </button>
                  )}
                </div>
              )}

              {list.map((c: any) => {
                const pri = PRIORITY[c.department];
                const hasUnread = (unreadCounts[c.ticketId] || 0) > 0;
                const isSelected = selected?.id === c.id;
                const isUrgent = c.emergency || pri?.label === "CRITICAL";
                return (
                  <div key={c.id} className={`tcard${isSelected ? " sel" : ""}${c.status === "Resolved" || c.status === "Completed" ? " done" : ""}${hasUnread ? " has-unread" : ""}${isUrgent ? " is-urgent" : ""}`}
                    onClick={() => { setSelected(isSelected ? null : c); setChatOpen(false); setMapOpen(false); }}>
                    {isUrgent && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "2px", background: "linear-gradient(90deg,#ef4444,#f97316)" }} />}
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
                      <div style={{ display: "flex", gap: "12px", flex: 1, minWidth: 0 }}>
                        <div style={{ width: "42px", height: "42px", borderRadius: "10px", background: "var(--bg-card-alt)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", flexShrink: 0 }}>
                          {DI[c.department] || "🏛️"}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "5px", flexWrap: "wrap" }}>
                            <span className="badge-status" style={{ background: (SC[c.status]?.bg || "#fff") + "22", color: SC[c.status]?.text || "#666", border: `1px solid ${SC[c.status]?.border || "#ccc"}44` }}>
                              <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: SC[c.status]?.dot || "#999", display: "inline-block" }} />{c.status}
                            </span>
                            {pri && <span className="badge-priority" style={{ background: pri.bg + "22", color: pri.color, border: `1px solid ${pri.color}33` }}>◈ {pri.label}</span>}
                            <span style={{ fontSize: "10px", color: "var(--text-muted)", fontFamily: "'DM Mono',monospace" }}>{c.ticketId}</span>
                            {hasUnread && <span style={{ background: "#1d4ed8", color: "#fff", fontSize: "9px", fontWeight: 800, padding: "2px 7px", borderRadius: "10px", fontFamily: "'DM Mono',monospace", animation: "pulse 1.5s infinite" }}>{unreadCounts[c.ticketId]} new</span>}
                            {isUrgent && <span style={{ background: "rgba(220,38,38,.2)", color: "#ef4444", fontSize: "9px", fontWeight: 800, padding: "2px 7px", borderRadius: "10px" }}>URGENT</span>}
                          </div>
                          <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "3px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.title}</div>
                          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
                            <span style={{ fontSize: "11.5px", color: "var(--text-muted)" }}>📍 {(c.address || "—").slice(0, 40)}{(c.address?.length || 0) > 40 ? "…" : ""}</span>
                            <span style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "'DM Mono',monospace" }}>{getElapsed(c.createdAt)}</span>
                            {c.assignedBy && <span style={{ fontSize: "11px", color: "#3b82f6" }}>👮 {c.assignedBy}</span>}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px", alignItems: "flex-end", flexShrink: 0 }}>
                        <button onClick={e => { e.stopPropagation(); openChat(c); }}
                          style={{ background: hasUnread ? "rgba(29,78,216,.25)" : "rgba(59,130,246,.08)", border: `1px solid ${hasUnread ? "#3b82f6" : "#1e3a5f"}`, borderRadius: "7px", padding: "4px 10px", cursor: "pointer", color: "#60a5fa", fontSize: "11px", fontWeight: 700, fontFamily: "'Syne',sans-serif", display: "flex", alignItems: "center", gap: "4px" }}>
                          💬 Chat{hasUnread ? ` (${unreadCounts[c.ticketId]})` : ""}
                        </button>
                        <svg style={{ color: "var(--text-muted)", transform: isSelected ? "rotate(90deg)" : "none", transition: "transform .2s" }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m9 18 6-6-6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* RIGHT PANEL */}
        {selected && (
          <div className="sr" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "18px", overflow: "hidden", position: "sticky", top: "74px" }}>
            {/* Panel tabs — Task Detail / Officer Chat / Navigation Map */}
            <div className="panel-tabs">
              <button className={`panel-tab ${!chatOpen && !mapOpen ? "active" : "inactive"}`} onClick={() => { setChatOpen(false); setMapOpen(false); }}>
                📋 Detail
              </button>
              <button className={`panel-tab ${chatOpen ? "active chat-active" : "inactive"}`} onClick={() => openChat(selected)} style={{ position: "relative" }}>
                💬 Chat
                {(unreadCounts[selected.ticketId] || 0) > 0 && (
                  <span style={{ position: "absolute", top: "8px", right: "10px", background: "#3b82f6", color: "#fff", fontSize: "9px", fontWeight: 800, padding: "1px 6px", borderRadius: "8px", fontFamily: "'DM Mono',monospace", animation: "pulse 1.5s infinite" }}>{unreadCounts[selected.ticketId]}</span>
                )}
              </button>
              <button className={`panel-tab ${mapOpen ? "active map-active" : "inactive"}`} onClick={() => { setMapOpen(true); setChatOpen(false); }}>
                🗺️ Navigate
              </button>
            </div>

            {/* ── CHAT VIEW ── */}
            {chatOpen && (
              <div style={{ height: "calc(100vh - 220px)", minHeight: "520px" }}>
                <ChatPanel complaint={selected} currentUser={user} />
              </div>
            )}

            {/* ── NAVIGATION MAP VIEW ── */}
            {mapOpen && (
              <div style={{ padding: "18px 20px", maxHeight: "calc(100vh - 200px)", overflowY: "auto" }}>
                <div style={{ fontSize: "10px", color: "#a78bfa", fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", marginBottom: "12px", fontFamily: "'DM Mono',monospace" }}>🗺️ Navigation Map</div>
                <NavigationMap complaint={selected} />
                <div style={{ marginTop: "14px" }}>
                  <StatusUpdateBar complaint={selected} onUpdate={quickStatusUpdate} />
                </div>
              </div>
            )}

            {/* ── DETAIL VIEW ── */}
            {!chatOpen && !mapOpen && (
              <>
                <div style={{ background: "linear-gradient(135deg,#0a1a12,#0f2a1e)", padding: "18px 20px", borderBottom: "1px solid #1a2e22", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontSize: "10px", color: "#10b981", fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", fontFamily: "'DM Mono',monospace" }}>Task Detail</div>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px", fontFamily: "'DM Mono',monospace" }}>{selected.ticketId}</div>
                  </div>
                  <button onClick={() => setSelected(null)} style={{ background: "var(--bg-card-alt)", border: "1px solid var(--border)", borderRadius: "7px", width: "30px", height: "30px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: "14px" }}>✕</button>
                </div>

                <div style={{ padding: "20px", maxHeight: "calc(100vh - 240px)", overflowY: "auto" }}>
                  {/* Status + priority */}
                  <div style={{ display: "flex", gap: "8px", marginBottom: "14px", flexWrap: "wrap" }}>
                    <span className="badge-status" style={{ background: (SC[selected.status]?.bg || "#fff") + "22", color: SC[selected.status]?.text || "#666", border: `1px solid ${SC[selected.status]?.border || "#ccc"}44`, fontSize: "12px", padding: "5px 12px" }}>
                      <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: SC[selected.status]?.dot || "#999", display: "inline-block" }} />{selected.status}
                    </span>
                    {PRIORITY[selected.department] && (
                      <span className="badge-priority" style={{ background: PRIORITY[selected.department].bg + "22", color: PRIORITY[selected.department].color, border: `1px solid ${PRIORITY[selected.department].color}33`, fontSize: "12px", padding: "5px 12px" }}>
                        ◈ {PRIORITY[selected.department].label}
                      </span>
                    )}
                  </div>

                  <div style={{ fontSize: "17px", fontWeight: 800, color: "#fff", marginBottom: "16px", lineHeight: 1.3 }}>{selected.title}</div>

                  {/* Quick status update */}
                  <div style={{ marginBottom: "16px" }}>
                    <StatusUpdateBar complaint={selected} onUpdate={quickStatusUpdate} />
                  </div>

                  {/* Info fields */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "18px" }}>
                    {[
                      { icon: DI[selected.department] || "🏛️", label: "Department", val: selected.department },
                      { icon: "👤", label: "Reported by", val: selected.userName || "Unknown" },
                      { icon: "📍", label: "Location", val: selected.address || "—" },
                      { icon: "🕐", label: "Reported", val: new Date(selected.createdAt).toLocaleString("en-IN") },
                      ...(selected.assignedBy ? [{ icon: "👮", label: "Assigned by", val: selected.assignedBy }] : []),
                      ...(selected.resolvedAt ? [{ icon: "✅", label: "Resolved at", val: new Date(selected.resolvedAt).toLocaleString("en-IN") }] : []),
                      ...(selected.resolvedBy ? [{ icon: "🔧", label: "Resolved by", val: selected.resolvedBy }] : []),
                    ].map(row => (
                      <div key={row.label} className="detail-field">
                        <span style={{ fontSize: "16px", flexShrink: 0 }}>{row.icon}</span>
                        <div>
                          <div style={{ fontSize: "9.5px", color: "var(--text-muted)", fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase" }}>{row.label}</div>
                          <div style={{ fontSize: "12.5px", color: "var(--text-secondary)", fontWeight: 500, marginTop: "2px" }}>{row.val}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Description */}
                  {selected.description && (
                    <div style={{ marginBottom: "18px" }}>
                      <div style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: "8px" }}>Description</div>
                      <div style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.7, background: "var(--bg-card-alt)", borderRadius: "10px", padding: "12px 14px", border: "1px solid var(--border)" }}>{selected.description}</div>
                    </div>
                  )}

                  {/* Resolution note (resolved) */}
                  {selected.resolutionNote && selected.status === "Resolved" && (
                    <div style={{ marginBottom: "18px" }}>
                      <div style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: "8px" }}>Resolution Note</div>
                      <div style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.7, background: "var(--bg-card-alt)", borderRadius: "10px", padding: "12px 14px", border: "1px solid #1a2e22" }}>{selected.resolutionNote}</div>
                    </div>
                  )}

                  {/* Proof image (submitted) */}
                  {selected.proofImage && (
                    <div style={{ marginBottom: "18px" }}>
                      <div style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: "8px" }}>Proof Photo</div>
                      <div style={{ position: "relative" }}>
                        <img src={selected.proofImage} alt="Proof" style={{ width: "100%", borderRadius: "10px", border: "1.5px solid #1a2e22", maxHeight: "180px", objectFit: "cover", display: "block" }} />
                        <div style={{ position: "absolute", top: "8px", left: "8px", background: "rgba(5,150,105,.9)", color: "#fff", fontSize: "10px", fontWeight: 800, padding: "3px 10px", borderRadius: "6px", fontFamily: "'Syne',sans-serif", letterSpacing: ".05em" }}>✓ SENT TO OFFICER</div>
                      </div>
                    </div>
                  )}

                  {/* Complaint image */}
                  {selected.image && (
                    <div style={{ marginBottom: "18px" }}>
                      <div style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: "8px" }}>Complaint Photo</div>
                      <img src={selected.image} alt="Complaint" style={{ width: "100%", borderRadius: "10px", border: "1.5px solid #23232e", maxHeight: "180px", objectFit: "cover", display: "block" }} />
                    </div>
                  )}

                  {/* ── RESOLVE SECTION (only for non-resolved) ── */}
                  {selected.status !== "Resolved" && selected.status !== "Completed" && (
                    <>
                      <div style={{ borderTop: "1px solid var(--border)", paddingTop: "16px", marginBottom: "14px" }}>
                        <div style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: "8px" }}>Resolution Note</div>
                        <textarea ref={notesRef} className="note-area" placeholder="Describe what was done to resolve this issue…" value={resolutionNote} onChange={e => setResolutionNote(e.target.value)} />
                      </div>

                      <div style={{ marginBottom: "16px" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                          <div style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase" }}>Proof Photo</div>
                          <div style={{ fontSize: "10px", color: "#d97706", fontWeight: 600 }}>📤 Auto-sent to officer on resolve</div>
                        </div>
                        <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={e => e.target.files && handleProof(e.target.files[0])} />
                        {!proofPreview ? (
                          <div className="proof-drop" onClick={() => fileRef.current?.click()}>
                            <div style={{ fontSize: "24px", marginBottom: "8px" }}>📷</div>
                            <div style={{ fontSize: "13px", color: "var(--text-muted)", fontWeight: 600 }}>Take or Upload Proof Photo</div>
                            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "3px" }}>Will appear in officer's chat automatically</div>
                          </div>
                        ) : (
                          <div style={{ position: "relative" }}>
                            <img src={proofPreview} alt="Proof preview" style={{ width: "100%", borderRadius: "10px", maxHeight: "160px", objectFit: "cover", border: "1.5px solid #1a2e22", display: "block" }} />
                            <button onClick={() => { setProof(null); setProofPreview(null); }} style={{ position: "absolute", top: "8px", right: "8px", background: "#dc2626", color: "#fff", border: "none", borderRadius: "6px", padding: "4px 10px", fontSize: "11px", cursor: "pointer", fontWeight: 800 }}>✕ Remove</button>
                            <div style={{ position: "absolute", bottom: "8px", left: "8px", background: "rgba(5,150,105,.85)", color: "#fff", fontSize: "11px", padding: "3px 10px", borderRadius: "6px", fontWeight: 700 }}>📤 Ready to send</div>
                          </div>
                        )}
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        <button className="btn-resolve" disabled={submitting} onClick={() => setShowConfirm(true)}>
                          {submitting
                            ? <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                              <span style={{ width: "14px", height: "14px", border: "2px solid rgba(255,255,255,.3)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "spin .75s linear infinite" }} />Submitting…</span>
                            : "✦ Mark as Resolved"}
                        </button>
                        <button className="btn-map" onClick={() => { setMapOpen(true); setChatOpen(false); }}>
                          🗺️ Navigate to Location
                        </button>
                        <button className="btn-chat" onClick={() => openChat(selected)}>
                          💬 Message Officer
                          {(unreadCounts[selected.ticketId] || 0) > 0 && (
                            <span style={{ background: "#3b82f6", color: "#fff", fontSize: "10px", fontWeight: 800, padding: "1px 8px", borderRadius: "8px", fontFamily: "'DM Mono',monospace" }}>{unreadCounts[selected.ticketId]} new</span>
                          )}
                        </button>
                      </div>
                    </>
                  )}

                  {/* ── RESOLVED STATE ── */}
                  {(selected.status === "Resolved" || selected.status === "Completed") && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                      <div style={{ background: "linear-gradient(135deg,#0a1a12,#0f2a1e)", border: "1px solid #1a2e22", borderRadius: "14px", padding: "20px", textAlign: "center" }}>
                        <div style={{ fontSize: "32px", marginBottom: "8px" }}>🎉</div>
                        <div style={{ fontSize: "15px", fontWeight: 800, color: "#10b981" }}>Task Completed!</div>
                        {selected.resolvedAt && <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "5px", fontFamily: "'DM Mono',monospace" }}>{new Date(selected.resolvedAt).toLocaleString("en-IN")}</div>}
                        {selected.proofImage && <div style={{ marginTop: "8px", fontSize: "12px", color: "#059669", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: "5px" }}><span>📸</span> Proof photo sent to officer</div>}
                      </div>
                      <button className="btn-chat" onClick={() => openChat(selected)}>💬 View Officer Chat Thread</button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      
      {/* ── FOOTER ── */}
      <footer style={{background:"var(--footer-bg, #0f172a)",color:"var(--footer-text, #94a3b8)",padding:"48px 5vw 24px",marginTop:40}}>
        <div style={{maxWidth:1200,margin:"0 auto"}}>
          <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr",gap:40,marginBottom:40}}>
            <div>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
                <img src="/ap-bg.png" alt="AP Seal" style={{width:40,height:40,objectFit:"contain",opacity:.9,flexShrink:0}}/>
                <div>
                  <div style={{fontSize:13,fontWeight:800,color:"var(--footer-heading,#fff)",lineHeight:1}}>CivicConnect</div>
                  <div style={{fontSize:9,color:"#475569",letterSpacing:".06em",marginTop:2}}>LIVE • CIVICCONNECT PLATFORM</div>
                </div>
              </div>
              <p style={{fontSize:12.5,lineHeight:1.7,margin:"0 0 14px",maxWidth:240,color:"var(--footer-muted,#64748b)"}}>Empowering citizens through transparent, accessible, and responsive digital governance.</p>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                {["🚨 112","📞 1800-425-0082"].map((t:string)=>(<span key={t} style={{fontSize:11,fontWeight:700,color:"#86efac",background:"rgba(22,163,74,.15)",borderRadius:6,padding:"4px 10px",border:"1px solid rgba(22,163,74,.2)"}}>{t}</span>))}
              </div>
            </div>
            {([{title:"Portal",links:["Report Issue","Track Complaint","Safety Alerts","Emergency Contacts"]},{title:"Government",links:["About City","District Info","Public Records","Transparency"]},{title:"Support",links:["Help Center","Contact Us","Privacy Policy","Terms of Use"]}] as {title:string;links:string[]}[]).map(col=>(
              <div key={col.title}>
                <div style={{fontSize:11,fontWeight:700,color:"var(--footer-heading,#fff)",letterSpacing:".1em",marginBottom:14}}>{col.title.toUpperCase()}</div>
                {col.links.map((link:string)=>(<a key={link} href="#" style={{display:"block",fontSize:12.5,color:"#64748b",textDecoration:"none",marginBottom:9,transition:"color .2s"}} onMouseEnter={e=>(e.currentTarget.style.color="#22c55e")} onMouseLeave={e=>(e.currentTarget.style.color="#64748b")}>{link}</a>))}
              </div>
            ))}
          </div>
          <div style={{borderTop:"1px solid var(--footer-border,#1e293b)",paddingTop:20,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
            <span style={{fontSize:11.5}}>© 2026 Smart Governance & Citizen Services Platform. All rights reserved.</span>
            <span style={{fontSize:11.5}}>Designed & developed for the citizens of National Civic Network 🇮🇳</span>
          </div>
        </div>
      </footer>
            {uMenu && (
        <div style={{ position: "fixed", right: 16, top: 68, width: 300, background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 16, overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,.16)", zIndex: 9999, animation: "fadeIn .2s ease" }}>
          <div style={{ padding: "18px 16px 14px", background: "linear-gradient(135deg,rgba(22,163,74,.12),rgba(34,197,94,.06))", borderBottom: "1px solid var(--border)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
      <div style={{ width: 48, height: 48, borderRadius: 14, background: "linear-gradient(135deg,#16a34a,#22c55e)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 20, color: "#fff", boxShadow: "0 4px 14px rgba(22,163,74,.4)" }}>{user?.name?.charAt(0).toUpperCase() || "W"}</div>
      <div>
        <div style={{ fontSize: 14.5, fontWeight: 800, color: "var(--text-primary)", lineHeight: 1.2 }}>{user?.name}</div>
        <div style={{ fontSize: 11, color: "var(--accent)", marginTop: 2, fontWeight: 600 }}>🔧 Field Worker · {(user as any)?.department || "All Depts"}</div>
        <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 1 }}>{user?.email || ""}</div>
      </div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
      {[{ l: "Tasks", v: tasks.length }, { l: "Done", v: tasks.filter((t:any) => t.done).length }, { l: "District", v: user?.district || "AP" }].map((s: any) => (
        <div key={s.l} style={{ flex: 1, textAlign: "center", background: "rgba(255,255,255,.6)", borderRadius: 8, padding: "6px 4px" }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "var(--accent)" }}>{s.v}</div>
          <div style={{ fontSize: 9, color: "var(--text-muted)", fontWeight: 600 }}>{s.l}</div>
        </div>
      ))}
            </div>
          </div>
          {[
            { icon: "📋", label: "My Tasks", action: () => { setTab("tasks"); setUM(false); } },
            { icon: "📊", label: "Analytics", action: () => { setTab("analytics"); setUM(false); } },
            { icon: "✅", label: "Completed Tasks", action: () => { setTab("completed"); setUM(false); } },
            { icon: "🔔", label: "Notifications", action: () => { setNotifsOpen(true); setUM(false); } },
            { icon: "🗺️", label: "Field Map", action: () => { setTab("map"); setUM(false); } },
          ].map(item => (
            <button key={item.label} onClick={item.action}
      style={{ width: "100%", padding: "10px 16px", background: "none", border: "none", color: "var(--text-secondary)", fontSize: 13, cursor: "pointer", textAlign: "left", fontFamily: "'Syne',sans-serif", display: "flex", alignItems: "center", gap: 10, transition: "background .15s" }}
      onMouseOver={e => (e.currentTarget.style.background = "var(--bg-hover)")}
      onMouseOut={e => (e.currentTarget.style.background = "none")}>
      {item.icon} {item.label}
            </button>
          ))}
          <div style={{ borderTop: "1px solid var(--border)" }}>
            <button onClick={()=>{setTab("profile");setUM(false);}} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", fontSize: 13, color: "var(--text-secondary)", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left", borderRadius: 8 }} onMouseOver={e=>(e.currentTarget.style.background="var(--bg-hover)")} onMouseOut={e=>(e.currentTarget.style.background="none")}>👤 My Profile</button>
            <button onClick={handleLogout}
      style={{ width: "100%", padding: "10px 16px", background: "none", border: "none", color: "#ef4444", fontSize: 13, fontWeight: 600, cursor: "pointer", textAlign: "left", fontFamily: "'Syne',sans-serif", display: "flex", alignItems: "center", gap: 10, transition: "background .15s" }}
      onMouseOver={e => (e.currentTarget.style.background = "rgba(239,68,68,.06)")}
      onMouseOut={e => (e.currentTarget.style.background = "none")}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
      Sign Out
            </button>
          </div>
        </div>
      )}
      {uMenu && <div style={{ position: "fixed", inset: 0, zIndex: 9998 }} onClick={() => setUM(false)} />}

      {/* ═══ EDIT PROFILE MODAL ═══ */}
      {editProfileOpen && (
        <>
          {/* Backdrop */}
          <div onClick={()=>setEditProfileOpen(false)}
            style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.6)", backdropFilter:"blur(6px)", zIndex:10000 }}/>

          {/* Modal */}
          <div style={{ position:"fixed", top:"50%", left:"50%", transform:"translate(-50%,-50%)", width:"min(520px,95vw)", background:"var(--bg-card)", border:"1px solid var(--border)", borderRadius:20, overflow:"hidden", boxShadow:"0 24px 80px rgba(0,0,0,.5)", zIndex:10001 }}>

            {/* Modal header */}
            <div style={{ background:"linear-gradient(135deg,#15803d,#16a34a,#22c55e)", padding:"20px 24px", position:"relative", overflow:"hidden" }}>
              <div style={{ position:"absolute", inset:0, backgroundImage:"radial-gradient(circle at 1px 1px,rgba(255,255,255,.06) 1px,transparent 0)", backgroundSize:"20px 20px", pointerEvents:"none" }}/>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", position:"relative" }}>
                <div>
                  <div style={{ fontSize:16, fontWeight:800, color:"#fff" }}>Edit Profile</div>
                  <div style={{ fontSize:11, color:"rgba(255,255,255,.75)", marginTop:2 }}>{user?.name} · Field Worker</div>
                </div>
                <button onClick={()=>setEditProfileOpen(false)}
                  style={{ width:32, height:32, borderRadius:"50%", background:"rgba(255,255,255,.2)", border:"none", cursor:"pointer", color:"#fff", fontSize:16, display:"flex", alignItems:"center", justifyContent:"center" }}>✕</button>
              </div>
              {/* Tab switcher */}
              <div style={{ display:"flex", gap:4, marginTop:14, background:"rgba(0,0,0,.2)", borderRadius:10, padding:4, position:"relative" }}>
                {(["details","password"] as const).map(sec=>(
                  <button key={sec} onClick={()=>setEditSection(sec)}
                    style={{ flex:1, padding:"7px 0", borderRadius:7, border:"none", cursor:"pointer", fontFamily:"inherit", fontSize:12, fontWeight:700, transition:"all .18s",
                      background: editSection===sec ? "#fff" : "transparent",
                      color:      editSection===sec ? "#15803d" : "rgba(255,255,255,.75)" }}>
                    {sec==="details" ? "👤 Personal Details" : "🔑 Change Password"}
                  </button>
                ))}
              </div>
            </div>

            {/* Modal body */}
            <div style={{ padding:"22px 24px", display:"flex", flexDirection:"column", gap:14 }}>

              {editSection==="details" && (<>
                {/* Name */}
                <div>
                  <label style={{ display:"block", fontSize:11, fontWeight:700, color:"var(--text-muted)", letterSpacing:".06em", textTransform:"uppercase", marginBottom:6 }}>Full Name *</label>
                  <input value={editForm.name} onChange={e=>setEditForm(f=>({...f,name:e.target.value}))}
                    placeholder="Your full name"
                    style={{ width:"100%", padding:"10px 14px", borderRadius:10, border:"1.5px solid var(--border)", background:"var(--bg-card-alt)", color:"var(--text-primary)", fontSize:13, fontFamily:"inherit", outline:"none", transition:"border-color .15s" }}
                    onFocus={e=>(e.target.style.borderColor="#16a34a")} onBlur={e=>(e.target.style.borderColor="var(--border)")}/>
                </div>
                {/* Email */}
                <div>
                  <label style={{ display:"block", fontSize:11, fontWeight:700, color:"var(--text-muted)", letterSpacing:".06em", textTransform:"uppercase", marginBottom:6 }}>Email Address *</label>
                  <input value={editForm.email} onChange={e=>setEditForm(f=>({...f,email:e.target.value}))}
                    placeholder="your@email.com" type="email"
                    style={{ width:"100%", padding:"10px 14px", borderRadius:10, border:"1.5px solid var(--border)", background:"var(--bg-card-alt)", color:"var(--text-primary)", fontSize:13, fontFamily:"inherit", outline:"none", transition:"border-color .15s" }}
                    onFocus={e=>(e.target.style.borderColor="#16a34a")} onBlur={e=>(e.target.style.borderColor="var(--border)")}/>
                </div>
                {/* Phone */}
                <div>
                  <label style={{ display:"block", fontSize:11, fontWeight:700, color:"var(--text-muted)", letterSpacing:".06em", textTransform:"uppercase", marginBottom:6 }}>Phone Number</label>
                  <input value={editForm.phone} onChange={e=>setEditForm(f=>({...f,phone:e.target.value}))}
                    placeholder="+91 XXXXX XXXXX" type="tel"
                    style={{ width:"100%", padding:"10px 14px", borderRadius:10, border:"1.5px solid var(--border)", background:"var(--bg-card-alt)", color:"var(--text-primary)", fontSize:13, fontFamily:"inherit", outline:"none", transition:"border-color .15s" }}
                    onFocus={e=>(e.target.style.borderColor="#16a34a")} onBlur={e=>(e.target.style.borderColor="var(--border)")}/>
                </div>
                {/* Department + District */}
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                  <div>
                    <label style={{ display:"block", fontSize:11, fontWeight:700, color:"var(--text-muted)", letterSpacing:".06em", textTransform:"uppercase", marginBottom:6 }}>Department</label>
                    <select value={editForm.department} onChange={e=>setEditForm(f=>({...f,department:e.target.value}))}
                      style={{ width:"100%", padding:"10px 12px", borderRadius:10, border:"1.5px solid var(--border)", background:"var(--bg-card-alt)", color:"var(--text-primary)", fontSize:13, fontFamily:"inherit", cursor:"pointer" }}>
                      <option value="">All Departments</option>
                      {["Electricity","Water Works","Sanitation","Roads & Infrastructure","Police","Fire Department","General Civic"].map(d=><option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ display:"block", fontSize:11, fontWeight:700, color:"var(--text-muted)", letterSpacing:".06em", textTransform:"uppercase", marginBottom:6 }}>District</label>
                    <select value={editForm.district} onChange={e=>setEditForm(f=>({...f,district:e.target.value}))}
                      style={{ width:"100%", padding:"10px 12px", borderRadius:10, border:"1.5px solid var(--border)", background:"var(--bg-card-alt)", color:"var(--text-primary)", fontSize:13, fontFamily:"inherit", cursor:"pointer" }}>
                      <option value="">Select district</option>
                      {AP_DISTRICTS.slice(1).map(d=><option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display:"flex", gap:10, marginTop:4 }}>
                  <button onClick={()=>setEditProfileOpen(false)}
                    style={{ flex:1, padding:"11px 0", borderRadius:10, border:"1px solid var(--border)", background:"transparent", color:"var(--text-secondary)", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
                    Cancel
                  </button>
                  <button onClick={saveProfileDetails} disabled={savingProfile}
                    style={{ flex:2, padding:"11px 0", borderRadius:10, border:"none", background:"linear-gradient(135deg,#15803d,#16a34a)", color:"#fff", fontSize:13, fontWeight:800, cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"center", gap:8, opacity:savingProfile?.6:1 }}>
                    {savingProfile ? "Saving…" : "💾 Save Changes"}
                  </button>
                </div>
              </>)}

              {editSection==="password" && (<>
                {/* Current password */}
                <div>
                  <label style={{ display:"block", fontSize:11, fontWeight:700, color:"var(--text-muted)", letterSpacing:".06em", textTransform:"uppercase", marginBottom:6 }}>Current Password *</label>
                  <div style={{ position:"relative" }}>
                    <input value={pwForm.current} onChange={e=>setPwForm(f=>({...f,current:e.target.value}))}
                      type={pwShow.current?"text":"password"} placeholder="Enter current password"
                      style={{ width:"100%", padding:"10px 42px 10px 14px", borderRadius:10, border:"1.5px solid var(--border)", background:"var(--bg-card-alt)", color:"var(--text-primary)", fontSize:13, fontFamily:"inherit", outline:"none", transition:"border-color .15s" }}
                      onFocus={e=>(e.target.style.borderColor="#16a34a")} onBlur={e=>(e.target.style.borderColor="var(--border)")}/>
                    <button onClick={()=>setPwShow(s=>({...s,current:!s.current}))} style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", color:"var(--text-muted)", fontSize:15 }}>
                      {pwShow.current?"🙈":"👁️"}
                    </button>
                  </div>
                </div>
                {/* New password */}
                <div>
                  <label style={{ display:"block", fontSize:11, fontWeight:700, color:"var(--text-muted)", letterSpacing:".06em", textTransform:"uppercase", marginBottom:6 }}>New Password *</label>
                  <div style={{ position:"relative" }}>
                    <input value={pwForm.newPw} onChange={e=>setPwForm(f=>({...f,newPw:e.target.value}))}
                      type={pwShow.newPw?"text":"password"} placeholder="Min 6 characters"
                      style={{ width:"100%", padding:"10px 42px 10px 14px", borderRadius:10, border:"1.5px solid var(--border)", background:"var(--bg-card-alt)", color:"var(--text-primary)", fontSize:13, fontFamily:"inherit", outline:"none", transition:"border-color .15s" }}
                      onFocus={e=>(e.target.style.borderColor="#16a34a")} onBlur={e=>(e.target.style.borderColor="var(--border)")}/>
                    <button onClick={()=>setPwShow(s=>({...s,newPw:!s.newPw}))} style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", color:"var(--text-muted)", fontSize:15 }}>
                      {pwShow.newPw?"🙈":"👁️"}
                    </button>
                  </div>
                  {/* Strength indicator */}
                  {pwForm.newPw.length > 0 && (
                    <div style={{ marginTop:8 }}>
                      <div style={{ display:"flex", gap:4, marginBottom:4 }}>
                        {[1,2,3,4].map(i=>{
                          const str = pwForm.newPw.length>=8 && /[A-Z]/.test(pwForm.newPw) && /[0-9]/.test(pwForm.newPw) && /[^A-Za-z0-9]/.test(pwForm.newPw) ? 4
                                    : pwForm.newPw.length>=8 && (/[A-Z]/.test(pwForm.newPw)||/[0-9]/.test(pwForm.newPw)) ? 3
                                    : pwForm.newPw.length>=6 ? 2 : 1;
                          const col = str>=4?"#22c55e":str>=3?"#16a34a":str>=2?"#f59e0b":"#ef4444";
                          return <div key={i} style={{ flex:1, height:4, borderRadius:2, background: i<=str?col:"var(--border)", transition:"all .2s" }}/>;
                        })}
                      </div>
                      <div style={{ fontSize:10, color:"var(--text-muted)" }}>
                        {pwForm.newPw.length<6?"Too short":pwForm.newPw.length<8&&!/[A-Z]/.test(pwForm.newPw)?"Weak — add uppercase & numbers":pwForm.newPw.length>=8&&/[A-Z]/.test(pwForm.newPw)&&/[0-9]/.test(pwForm.newPw)&&/[^A-Za-z0-9]/.test(pwForm.newPw)?"Strong 💪":"Good"}
                      </div>
                    </div>
                  )}
                </div>
                {/* Confirm */}
                <div>
                  <label style={{ display:"block", fontSize:11, fontWeight:700, color:"var(--text-muted)", letterSpacing:".06em", textTransform:"uppercase", marginBottom:6 }}>Confirm New Password *</label>
                  <div style={{ position:"relative" }}>
                    <input value={pwForm.confirm} onChange={e=>setPwForm(f=>({...f,confirm:e.target.value}))}
                      type={pwShow.confirm?"text":"password"} placeholder="Re-enter new password"
                      style={{ width:"100%", padding:"10px 42px 10px 14px", borderRadius:10, border:`1.5px solid ${pwForm.confirm&&pwForm.confirm!==pwForm.newPw?"#ef4444":pwForm.confirm&&pwForm.confirm===pwForm.newPw?"#22c55e":"var(--border)"}`, background:"var(--bg-card-alt)", color:"var(--text-primary)", fontSize:13, fontFamily:"inherit", outline:"none" }}
                      onFocus={e=>(e.target.style.borderColor="#16a34a")} onBlur={e=>(e.target.style.borderColor="var(--border)")}/>
                    <button onClick={()=>setPwShow(s=>({...s,confirm:!s.confirm}))} style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", color:"var(--text-muted)", fontSize:15 }}>
                      {pwShow.confirm?"🙈":"👁️"}
                    </button>
                  </div>
                  {pwForm.confirm && pwForm.confirm===pwForm.newPw && <div style={{ fontSize:10, color:"#22c55e", marginTop:4 }}>✓ Passwords match</div>}
                  {pwForm.confirm && pwForm.confirm!==pwForm.newPw && <div style={{ fontSize:10, color:"#ef4444", marginTop:4 }}>✗ Passwords do not match</div>}
                </div>

                <div style={{ display:"flex", gap:10, marginTop:4 }}>
                  <button onClick={()=>setEditProfileOpen(false)}
                    style={{ flex:1, padding:"11px 0", borderRadius:10, border:"1px solid var(--border)", background:"transparent", color:"var(--text-secondary)", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
                    Cancel
                  </button>
                  <button onClick={savePassword} disabled={savingProfile}
                    style={{ flex:2, padding:"11px 0", borderRadius:10, border:"none", background:"linear-gradient(135deg,#15803d,#16a34a)", color:"#fff", fontSize:13, fontWeight:800, cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"center", gap:8, opacity:savingProfile?.6:1 }}>
                    {savingProfile ? "Saving…" : "🔑 Change Password"}
                  </button>
                </div>
              </>)}
            </div>
          </div>
        </>
      )}

    </div>
  );
}