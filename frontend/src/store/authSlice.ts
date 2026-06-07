/**
 * authSlice.ts
 * Sets BOTH isAuthenticated and isLoggedIn so all components work
 * regardless of which field name they reference.
 * Persists session to localStorage("auth").
 */

import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

interface AuthUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: "citizen" | "officer" | "admin" | "worker";
  district?: string;
  rank?: string;
  designation?: string;
}

interface AuthState {
  isAuthenticated: boolean;  // primary field
  isLoggedIn: boolean;       // alias — kept in sync for compatibility
  token: string | null;
  user: AuthUser | null;
}

// ── Rehydrate from localStorage on startup ──────────────────────────────────
function loadAuthState(): AuthState {
  try {
    const raw = localStorage.getItem("auth");
    if (!raw) return { isAuthenticated: false, isLoggedIn: false, token: null, user: null };
    const parsed = JSON.parse(raw);
    if (parsed?.token && parsed?.user?.id) {
      return {
        isAuthenticated: true,
        isLoggedIn: true,
        token: parsed.token,
        user: parsed.user,
      };
    }
  } catch (_) {}
  return { isAuthenticated: false, isLoggedIn: false, token: null, user: null };
}

const initialState: AuthState = loadAuthState();

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    loginSuccess(state, action: PayloadAction<{ token: string; user: AuthUser }>) {
      state.isAuthenticated = true;
      state.isLoggedIn = true;
      state.token = action.payload.token;
      state.user = action.payload.user;
      // Persist to localStorage
      localStorage.setItem(
        "auth",
        JSON.stringify({ token: action.payload.token, user: action.payload.user })
      );
    },
    logout(state) {
      state.isAuthenticated = false;
      state.isLoggedIn = false;
      state.token = null;
      state.user = null;
      localStorage.removeItem("auth");
    },
  },
});

export const { loginSuccess, logout } = authSlice.actions;
export default authSlice.reducer;