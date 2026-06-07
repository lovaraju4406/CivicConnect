/**
 * notificationSlice.ts
 * Notifications synced from real backend + local additions.
 */
import { createSlice, createAsyncThunk, type PayloadAction } from "@reduxjs/toolkit";
import { notificationsAPI } from "../services/api";

export interface AppNotification {
  id: string;
  message: string;
  type: "info" | "success" | "warning" | "error" | "status" | "resolved" | "officer" | "note" | "escalated";
  read: boolean;
  is_read?: boolean;       // backend field name
  time: string;
  related_id?: string;
  complaintId?: string;
  ticketId?: string;
  urgent?: boolean;
  created_at?: string;
  createdAt?: string;
}

interface NotificationState {
  list: AppNotification[];
}

// ── Async thunk — load from backend ──────────────────────────────────────────
export const loadNotifications = createAsyncThunk(
  "notifications/load",
  async () => {
    try {
      const data = await notificationsAPI.getAll();
      const list = Array.isArray(data) ? data : [];
      // normalise backend shape → app shape
      return list.map((n: any): AppNotification => ({
        id:          n.id,
        message:     n.message,
        type:        n.type ?? "info",
        read:        n.is_read === 1 || n.is_read === true,
        is_read:     n.is_read === 1 || n.is_read === true,
        time:        n.created_at ?? new Date().toISOString(),
        related_id:  n.related_id,
        complaintId: n.related_id,
        created_at:  n.created_at,
      }));
    } catch {
      return [];
    }
  }
);

const initialState: NotificationState = { list: [] };

const notificationSlice = createSlice({
  name: "notifications",
  initialState,
  reducers: {
    addNotification(state, action: PayloadAction<AppNotification>) {
      if (!state.list.find(n => n.id === action.payload.id)) {
        state.list.unshift(action.payload);
        state.list = state.list.slice(0, 50);
      }
    },
    markRead(state, action: PayloadAction<string>) {
      const n = state.list.find(n => n.id === action.payload);
      if (n) { n.read = true; n.is_read = true; }
    },
    markAllRead(state) {
      state.list.forEach(n => { n.read = true; n.is_read = true; });
    },
    removeNotification(state, action: PayloadAction<string>) {
      state.list = state.list.filter(n => n.id !== action.payload);
    },
    clearNotifications(state) {
      state.list = [];
    },
  },
  extraReducers: builder => {
    builder.addCase(loadNotifications.fulfilled, (state, action) => {
      state.list = action.payload;
    });
  },
});

export const {
  addNotification, markRead, markAllRead,
  removeNotification, clearNotifications,
} = notificationSlice.actions;

export default notificationSlice.reducer;