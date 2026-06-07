import { createContext, useContext, useState, useCallback, ReactNode } from "react";

type ToastType = "success" | "error" | "warning" | "info";

interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType, duration?: number) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const ICONS: Record<ToastType, string> = {
  success: "✅", error: "❌", warning: "⚠️", info: "ℹ️",
};
const COLORS: Record<ToastType, { bg: string; border: string; color: string }> = {
  success: { bg: "#f0fdf4", border: "#86efac", color: "#166534" },
  error:   { bg: "#fef2f2", border: "#fca5a5", color: "#991b1b" },
  warning: { bg: "#fffbeb", border: "#fcd34d", color: "#92400e" },
  info:    { bg: "#eff6ff", border: "#93c5fd", color: "#1e40af" },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const toast = useCallback((message: string, type: ToastType = "info", duration = 3500) => {
    const id = Date.now().toString();
    setToasts(prev => [...prev.slice(-4), { id, message, type, duration }]);
    setTimeout(() => dismiss(id), duration);
  }, [dismiss]);

  const success = useCallback((m: string) => toast(m, "success"), [toast]);
  const error   = useCallback((m: string) => toast(m, "error"),   [toast]);
  const warning = useCallback((m: string) => toast(m, "warning"), [toast]);
  const info    = useCallback((m: string) => toast(m, "info"),    [toast]);

  return (
    <ToastContext.Provider value={{ toast, success, error, warning, info }}>
      {children}
      <div style={{
        position: "fixed", bottom: "24px", right: "24px",
        zIndex: 99999, display: "flex", flexDirection: "column", gap: "10px",
        maxWidth: "360px", width: "100%",
      }}>
        {toasts.map(t => {
          const c = COLORS[t.type];
          return (
            <div key={t.id} style={{
              background: c.bg, border: `1.5px solid ${c.border}`, borderRadius: "12px",
              padding: "12px 16px", display: "flex", alignItems: "flex-start", gap: "10px",
              boxShadow: "0 4px 18px rgba(0,0,0,.09)",
              animation: "toast-in .25s ease",
              color: c.color, fontSize: "13.5px", fontWeight: 500,
            }}>
              <span style={{ fontSize: "16px", flexShrink: 0 }}>{ICONS[t.type]}</span>
              <span style={{ flex: 1, lineHeight: 1.45 }}>{t.message}</span>
              <button onClick={() => dismiss(t.id)} style={{
                background: "none", border: "none", cursor: "pointer",
                color: c.color, padding: "0", opacity: 0.6, display: "flex",
              }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          );
        })}
      </div>
      <style>{`@keyframes toast-in{from{transform:translateX(40px);opacity:0}to{transform:translateX(0);opacity:1}}`}</style>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

export default ToastProvider;
