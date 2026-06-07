// ─────────────────────────────────────────────────────────────────────────────
// EMERGENCY RESPONDER TRACKER — Shared types & storage
// ─────────────────────────────────────────────────────────────────────────────

export interface EmergencyRequest {
  id: string;
  ticketId: string;
  type: string;
  subType?: string;
  priority: "CRITICAL" | "HIGH" | "MEDIUM";
  status: "SOS_Sent" | "Dispatched" | "Responder_EnRoute" | "Arrived" | "Resolved" | "Cancelled";
  citizenId: string;
  citizenName: string;
  citizenPhone?: string;
  lat?: number;
  lng?: number;
  address?: string;
  description?: string;
  victimCount?: number;
  injurySeverity?: "Minor" | "Moderate" | "Severe" | "Critical";
  isSilentMode?: boolean;
  assignedResponderId?: string;
  assignedResponderName?: string;
  assignedResponderPhone?: string;
  responderLat?: number;
  responderLng?: number;
  etaMinutes?: number;
  distanceKm?: number;
  dispatchedAt?: string;
  arrivedAt?: string;
  resolvedAt?: string;
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

export const EM_KEY = "ap_emergency_requests";

export function emLoad(): EmergencyRequest[] {
  try {
    const raw = localStorage.getItem(EM_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function emSave(req: EmergencyRequest) {
  try {
    const all = emLoad();
    const idx = all.findIndex(r => r.id === req.id);
    if (idx >= 0) all[idx] = req; else all.unshift(req);
    localStorage.setItem(EM_KEY, JSON.stringify(all));
    window.dispatchEvent(new Event("storage"));
  } catch {}
}

export function emLoadMine(citizenId: string, citizenName: string): EmergencyRequest[] {
  return emLoad().filter(r => r.citizenId === citizenId || r.citizenName === citizenName);
}

export function emLoadActive(): EmergencyRequest[] {
  return emLoad().filter(r => !["Resolved", "Cancelled"].includes(r.status));
}

export const EM_STATUS_STEPS: EmergencyRequest["status"][] = [
  "SOS_Sent", "Dispatched", "Responder_EnRoute", "Arrived", "Resolved"
];

export const EM_STATUS_LABELS: Record<string, string> = {
  SOS_Sent: "SOS Sent",
  Dispatched: "Dispatched",
  Responder_EnRoute: "En Route",
  Arrived: "Arrived at Scene",
  Resolved: "Resolved",
  Cancelled: "Cancelled",
};

export const EM_STATUS_COLORS: Record<string, string> = {
  SOS_Sent: "#ef4444",
  Dispatched: "#f97316",
  Responder_EnRoute: "#3b82f6",
  Arrived: "#8b5cf6",
  Resolved: "#10b981",
  Cancelled: "#64748b",
};

export const EM_STATUS_ICONS: Record<string, string> = {
  SOS_Sent: "📡",
  Dispatched: "📋",
  Responder_EnRoute: "🚀",
  Arrived: "✅",
  Resolved: "🏁",
  Cancelled: "❌",
};

export const EMERGENCY_TYPES: Record<string, { icon: string; color: string; hotline: string }> = {
  medical:     { icon: "🚑", color: "#ef4444", hotline: "108" },
  fire:        { icon: "🔥", color: "#f97316", hotline: "101" },
  police:      { icon: "🚔", color: "#3b82f6", hotline: "100" },
  child:       { icon: "👶", color: "#a855f7", hotline: "1098" },
  electricity: { icon: "⚡", color: "#eab308", hotline: "1912" },
  flood:       { icon: "🌊", color: "#06b6d4", hotline: "1070" },
  animal:      { icon: "🐾", color: "#78716c", hotline: "1962" },
  accident:    { icon: "🚗", color: "#dc2626", hotline: "100" },
  collapse:    { icon: "🏗️", color: "#92400e", hotline: "101" },
  gas:         { icon: "☢️", color: "#65a30d", hotline: "101" },
  dv:          { icon: "🛡️", color: "#ec4899", hotline: "181" },
  missing:     { icon: "🔍", color: "#8b5cf6", hotline: "100" },
  water:       { icon: "💧", color: "#0ea5e9", hotline: "1916" },
  cyber:       { icon: "💻", color: "#6366f1", hotline: "1930" },
};

export function genEmId(): string {
  return `ems-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
}

export function genEmTicket(): string {
  return `EMS-${new Date().getFullYear()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
}