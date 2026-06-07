

const BASE = (import.meta as any).env?.VITE_API_URL ?? "http://localhost:3001/api";

// ── Token helper ──────────────────────────────────────────────────────────────
function getToken(): string | null {
  try {
    return JSON.parse(localStorage.getItem("auth") || "{}").token ?? null;
  } catch {
    return null;
  }
}

// ── Core request helper ───────────────────────────────────────────────────────
async function req<T = any>(
  path: string,
  opts: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(opts.headers as Record<string, string> ?? {}),
  };

  const res = await fetch(`${BASE}${path}`, { ...opts, headers });
  const json = await res.json().catch(() => ({ success: false, message: "Invalid response" }));

  if (!res.ok || !json.success) {
    throw new Error(json.message || `Request failed: ${res.status}`);
  }

  return json.data as T;
}

// ── Multipart (file upload) ───────────────────────────────────────────────────
async function upload<T = any>(path: string, formData: FormData): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  const json = await res.json().catch(() => ({ success: false, message: "Upload failed" }));
  if (!res.ok || !json.success) throw new Error(json.message || "Upload failed");
  return json.data as T;
}

// ═════════════════════════════════════════════════════════════════════════════
// AUTH API
// ═════════════════════════════════════════════════════════════════════════════
export const authAPI = {
  login: (email: string, password: string) =>
    req("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),

  register: (data: Record<string, any>) =>
    req("/auth/register", { method: "POST", body: JSON.stringify(data) }),

  me: () => req("/auth/me"),

  updateProfile: (data: { name?: string; phone?: string; district?: string; designation?: string }) =>
    req("/auth/profile", { method: "PATCH", body: JSON.stringify(data) }),

  changePassword: (oldPassword: string, newPassword: string) =>
    req("/auth/change-password", { method: "POST", body: JSON.stringify({ oldPassword, newPassword }) }),
};

// ═════════════════════════════════════════════════════════════════════════════
// COMPLAINTS API
// ═════════════════════════════════════════════════════════════════════════════
export interface ComplaintFilters {
  status?: string;
  department?: string;
  search?: string;
  emergency?: boolean;
  page?: number;
  limit?: number;
}

export const complaintsAPI = {
  // Get complaints (role-aware: citizen=own, officer=all, worker=assigned)
  getAll: (filters: ComplaintFilters = {}) => {
    const params = new URLSearchParams();
    if (filters.status)     params.set("status",     filters.status);
    if (filters.department) params.set("department", filters.department);
    if (filters.search)     params.set("search",     filters.search);
    if (filters.emergency)  params.set("emergency",  "true");
    if (filters.page)       params.set("page",       String(filters.page));
    if (filters.limit)      params.set("limit",      String(filters.limit));
    const qs = params.toString();
    return req(`/complaints${qs ? `?${qs}` : ""}`);
  },

  // Citizen's own complaints
  getMine: () => req("/complaints/mine"),

  // Single complaint with full timeline + assignments
  getById: (id: string) => req(`/complaints/${id}`),

  // Submit new complaint (with optional image)
  create: (data: {
    title: string; description: string; department: string;
    address: string; lat?: number; lng?: number;
    is_emergency?: boolean; emergency_reason?: string;
  }, imageFile?: File) => {
    if (imageFile) {
      const fd = new FormData();
      Object.entries(data).forEach(([k, v]) => {
        if (v !== undefined) fd.append(k, String(v));
      });
      fd.append("image", imageFile);
      return upload("/complaints", fd);
    }
    return req("/complaints", { method: "POST", body: JSON.stringify(data) });
  },

  // Edit complaint (citizen can edit pending ones)
  update: (id: string, data: Partial<{ title: string; description: string; address: string; department: string }>) =>
    req(`/complaints/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

  // Officer/admin: update status
  updateStatus: (id: string, status: "Pending" | "Assigned" | "Resolved") =>
    req(`/complaints/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),

  // Officer/admin: assign to worker
  assign: (id: string, worker_id: string, notes?: string) =>
    req(`/complaints/${id}/assign`, { method: "POST", body: JSON.stringify({ worker_id, notes }) }),

  // Worker: upload proof of resolution
  uploadProof: (id: string, proofFile: File, resolution_note?: string) => {
    const fd = new FormData();
    fd.append("proof", proofFile);
    if (resolution_note) fd.append("resolution_note", resolution_note);
    return upload(`/complaints/${id}/proof`, fd);
  },

  // Citizen: rate resolved complaint
  rate: (id: string, rating: number, comment?: string) =>
    req(`/complaints/${id}/rate`, { method: "POST", body: JSON.stringify({ rating, comment }) }),
};

// ═════════════════════════════════════════════════════════════════════════════
// USERS API
// ═════════════════════════════════════════════════════════════════════════════
export const usersAPI = {
  // Admin: get all users
  getAll: (filters: { role?: string; search?: string; page?: number; limit?: number } = {}) => {
    const params = new URLSearchParams();
    if (filters.role)   params.set("role",   filters.role);
    if (filters.search) params.set("search", filters.search);
    if (filters.page)   params.set("page",   String(filters.page));
    if (filters.limit)  params.set("limit",  String(filters.limit));
    const qs = params.toString();
    return req(`/users${qs ? `?${qs}` : ""}`);
  },

  // Officer/admin: get workers (optionally filtered by department)
  getWorkers: (department?: string) => {
    const qs = department ? `?department=${encodeURIComponent(department)}` : "";
    return req(`/users/workers${qs}`);
  },

  // Get single user
  getById: (id: string) => req(`/users/${id}`),

  // Admin: update user
  update: (id: string, data: Record<string, any>) =>
    req(`/users/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

  // Admin: deactivate user
  deactivate: (id: string) =>
    req(`/users/${id}`, { method: "DELETE" }),
};

// ═════════════════════════════════════════════════════════════════════════════
// ANALYTICS API
// ═════════════════════════════════════════════════════════════════════════════
export const analyticsAPI = {
  getSummary:        () => req("/analytics/summary"),
  getDepartments:    () => req("/analytics/departments"),
  getTrend:          (period: "weekly" | "monthly" = "monthly") => req(`/analytics/trend?period=${period}`),
  getWorkerPerf:     () => req("/analytics/workers"),
  getRecentActivity: () => req("/analytics/recent-activity"),
};

// ═════════════════════════════════════════════════════════════════════════════
// NOTIFICATIONS API
// ═════════════════════════════════════════════════════════════════════════════
export const notificationsAPI = {
  getAll:     () => req("/notifications"),
  markRead:   (id: string) => req(`/notifications/${id}/read`, { method: "PATCH" }),
  markAllRead:() => req("/notifications/read-all", { method: "PATCH" }),
  delete:     (id: string) => req(`/notifications/${id}`, { method: "DELETE" }),
};

// ═════════════════════════════════════════════════════════════════════════════
// HEALTH CHECK
// ═════════════════════════════════════════════════════════════════════════════
export const healthCheck = () =>
  fetch(`${BASE.replace("/api", "")}/api/health`).then(r => r.json());