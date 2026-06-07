import { ReactNode, useState } from "react";

interface Tab { id: string; label: string; icon?: ReactNode; badge?: number; }

interface TabsProps {
  tabs: Tab[];
  activeTab?: string;
  onChange?: (id: string) => void;
  children?: ReactNode;
  variant?: "line" | "pill";
}

export default function Tabs({ tabs, activeTab, onChange, children, variant = "line" }: TabsProps) {
  const [internal, setInternal] = useState(tabs[0]?.id ?? "");
  const active = activeTab ?? internal;

  const handleClick = (id: string) => {
    setInternal(id);
    onChange?.(id);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
      <div style={{
        display: "flex", gap: variant === "pill" ? "6px" : "0",
        borderBottom: variant === "line" ? "2px solid #e2e8f0" : "none",
        padding: variant === "pill" ? "4px" : "0",
        background: variant === "pill" ? "#f1f5f9" : "transparent",
        borderRadius: variant === "pill" ? "12px" : "0",
        flexWrap: "wrap",
      }}>
        {tabs.map(tab => {
          const isActive = tab.id === active;
          return (
            <button
              key={tab.id}
              onClick={() => handleClick(tab.id)}
              style={{
                display: "inline-flex", alignItems: "center", gap: "6px",
                padding: variant === "pill" ? "7px 14px" : "10px 16px",
                border: "none", cursor: "pointer", fontFamily: "inherit",
                fontSize: "13px", fontWeight: isActive ? 700 : 500,
                color: isActive ? (variant === "pill" ? "#1e293b" : "#ea6800") : "#64748b",
                background: variant === "pill" ? (isActive ? "#fff" : "transparent") : "transparent",
                borderRadius: variant === "pill" ? "9px" : "0",
                borderBottom: variant === "line" ? `2.5px solid ${isActive ? "#ea6800" : "transparent"}` : "none",
                marginBottom: variant === "line" ? "-2px" : "0",
                transition: "all .15s",
                boxShadow: variant === "pill" && isActive ? "0 1px 4px rgba(0,0,0,.1)" : "none",
              }}
            >
              {tab.icon}
              {tab.label}
              {tab.badge !== undefined && tab.badge > 0 && (
                <span style={{
                  background: "#ea6800", color: "#fff", fontSize: "10px", fontWeight: 700,
                  padding: "1px 6px", borderRadius: "10px", minWidth: "18px", textAlign: "center",
                }}>
                  {tab.badge > 99 ? "99+" : tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {children && <div style={{ paddingTop: "16px" }}>{children}</div>}
    </div>
  );
}
