// persistMiddleware.ts — only persists auth session, not complaints/notifications
// (those now come from the real backend)
import type { Middleware } from "@reduxjs/toolkit";
import type { RootState } from "./index";

// ── Auth persistence ──────────────────────────────────────────────────────────
export function loadAuthState(): { auth: RootState["auth"] } | undefined {
  try {
    // Primary source: "auth" key (set by Login/Register pages)
    const raw = localStorage.getItem("auth");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.token && parsed?.user?.id) {
        return {
          auth: {
            isAuthenticated: true,
            isLoggedIn:      true,
            token:           parsed.token,
            user:            parsed.user,
          },
        };
      }
    }
    // Fallback: legacy key
    const legacy = localStorage.getItem("ap_portal_auth");
    return legacy ? { auth: JSON.parse(legacy) } : undefined;
  } catch { return undefined; }
}

export function saveAuthState(auth: RootState["auth"]) {
  try {
    if (auth.token && auth.user) {
      localStorage.setItem("auth", JSON.stringify({ token: auth.token, user: auth.user }));
    }
  } catch {}
}

export function clearAuthState() {
  try {
    localStorage.removeItem("auth");
    localStorage.removeItem("ap_portal_auth");
  } catch {}
}

// Kept for API compatibility — no-ops now (data comes from backend)
export function loadUserData(_userId: string) { return undefined; }
export function saveUserData(_userId: string, _state: RootState) {}
export function wipeUserData(_userId: string) {}

// ── Middleware — only saves auth ──────────────────────────────────────────────
export const persistMiddleware: Middleware = (store) => (next) => (action) => {
  const result = next(action);
  const state  = store.getState() as RootState;
  saveAuthState(state.auth);
  return result;
};