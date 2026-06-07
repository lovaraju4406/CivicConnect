/**
 * complaintSlice.ts
 * Manages complaints in Redux — now synced from real backend.
 * localStorage kept only as a fast initial-render cache.
 */
import { createSlice, createAsyncThunk, type PayloadAction } from "@reduxjs/toolkit";
import { complaintsAPI } from "../services/api";

export interface Complaint {
  id: string;
  ticket_id?: string; ticketId?: string;
  title?: string; category?: string;
  description: string;
  status: "Pending" | "Assigned" | "In Progress" | "Resolved" | "Rejected";
  priority?: "Low" | "Medium" | "High" | "Critical";
  is_emergency?: boolean; emergency?: boolean;
  user_id?: string; userId?: string;
  user_name?: string; userName?: string;
  department?: string;
  assigned_to?: string; assignedWorker?: string;
  assigned_name?: string; assignedOfficer?: string;
  address?: string; lat?: number; lng?: number;
  image_url?: string; image?: string;
  rating?: number; rating_comment?: string;
  proof_image?: string; resolution_note?: string;
  aiRouted?: boolean; aiRoutingReason?: string;
  escalated?: boolean;
  created_at?: string; createdAt: string;
  updated_at?: string; updatedAt?: string;
  resolved_at?: string;
}

interface ComplaintState {
  complaints: Complaint[];
  loading: boolean;
  error: string | null;
}

const initialState: ComplaintState = {
  complaints: [],
  loading: false,
  error: null,
};

// ── Async thunks ──────────────────────────────────────────────────────────────
export const loadComplaintsForUser = createAsyncThunk(
  "complaints/loadForUser",
  async (_userId: string) => {
    try {
      const data = await complaintsAPI.getMine();
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }
);

export const loadAllComplaints = createAsyncThunk(
  "complaints/loadAll",
  async (filters: Record<string, any> = {}) => {
    try {
      const data = await complaintsAPI.getAll(filters);
      if (Array.isArray(data)) return data;
      return data?.complaints ?? [];
    } catch {
      return [];
    }
  }
);

// ── Slice ─────────────────────────────────────────────────────────────────────
const complaintSlice = createSlice({
  name: "complaints",
  initialState,
  reducers: {
    addComplaint(state, action: PayloadAction<Complaint>) {
      state.complaints.unshift(action.payload);
    },
    updateComplaintStatus(
      state,
      action: PayloadAction<{ id: string; status: Complaint["status"]; extra?: Partial<Complaint> }>
    ) {
      const idx = state.complaints.findIndex(c => c.id === action.payload.id);
      if (idx !== -1) {
        state.complaints[idx] = {
          ...state.complaints[idx],
          status: action.payload.status,
          ...(action.payload.extra ?? {}),
          updatedAt: new Date().toISOString(),
        };
      }
    },
    clearComplaints(state) {
      state.complaints = [];
      state.loading    = false;
      state.error      = null;
    },
  },
  extraReducers: builder => {
    builder
      .addCase(loadComplaintsForUser.pending,   s => { s.loading = true; s.error = null; })
      .addCase(loadComplaintsForUser.fulfilled, (s, a) => { s.loading = false; s.complaints = a.payload; })
      .addCase(loadComplaintsForUser.rejected,  (s, a) => { s.loading = false; s.error = a.error.message ?? "Failed"; })
      .addCase(loadAllComplaints.pending,       s => { s.loading = true; s.error = null; })
      .addCase(loadAllComplaints.fulfilled,     (s, a) => { s.loading = false; s.complaints = a.payload; })
      .addCase(loadAllComplaints.rejected,      (s, a) => { s.loading = false; s.error = a.error.message ?? "Failed"; });
  },
});

export const { addComplaint, updateComplaintStatus, clearComplaints } = complaintSlice.actions;
export default complaintSlice.reducer;