import { ReactNode, useEffect } from "react";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
  closable?: boolean;
}

export default function Dialog({
  open, onClose, title, children, footer, width = "480px", closable = true,
}: DialogProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape" && closable) onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [closable, onClose]);

  if (!open) return null;

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget && closable) onClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 9000,
        background: "rgba(15,23,42,.45)", backdropFilter: "blur(3px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "16px",
        animation: "dlg-fade-in .18s ease",
      }}
    >
      <div style={{
        background: "#fff", borderRadius: "18px",
        width: "100%", maxWidth: width, maxHeight: "90vh",
        display: "flex", flexDirection: "column",
        boxShadow: "0 20px 60px rgba(0,0,0,.18)",
        animation: "dlg-slide-up .2s ease",
        overflow: "hidden",
      }}>
        {/* Header */}
        {(title || closable) && (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "18px 22px 14px",
            borderBottom: "1.5px solid #f1f5f9",
          }}>
            {title && <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#1e293b" }}>{title}</h2>}
            {closable && (
              <button
                onClick={onClose}
                style={{
                  background: "#f1f5f9", border: "none", borderRadius: "8px",
                  width: "30px", height: "30px", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#64748b", marginLeft: "auto",
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>
        )}

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "18px 22px" }}>
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div style={{
            padding: "14px 22px 18px",
            borderTop: "1.5px solid #f1f5f9",
            display: "flex", gap: "10px", justifyContent: "flex-end",
          }}>
            {footer}
          </div>
        )}
      </div>
      <style>{`
        @keyframes dlg-fade-in { from { opacity:0 } to { opacity:1 } }
        @keyframes dlg-slide-up { from { transform:translateY(18px);opacity:0 } to { transform:translateY(0);opacity:1 } }
      `}</style>
    </div>
  );
}
