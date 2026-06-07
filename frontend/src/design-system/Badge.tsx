import { ReactNode } from "react";

type BadgeVariant = "default" | "success" | "warning" | "danger" | "info" | "purple" | "orange";

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  dot?: boolean;
  size?: "sm" | "md";
}

const STYLES: Record<BadgeVariant, { bg: string; color: string; dot: string }> = {
  default: { bg: "#f1f5f9", color: "#475569",  dot: "#94a3b8" },
  success: { bg: "#d1fae5", color: "#065f46",  dot: "#10b981" },
  warning: { bg: "#fef3c7", color: "#92400e",  dot: "#f59e0b" },
  danger:  { bg: "#fee2e2", color: "#991b1b",  dot: "#ef4444" },
  info:    { bg: "#dbeafe", color: "#1e40af",  dot: "#3b82f6" },
  purple:  { bg: "#ede9fe", color: "#5b21b6",  dot: "#8b5cf6" },
  orange:  { bg: "#ffedd5", color: "#9a3412",  dot: "#ea6800" },
};

export default function Badge({ children, variant = "default", dot = false, size = "md" }: BadgeProps) {
  const s = STYLES[variant];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "5px",
      padding: size === "sm" ? "2px 8px" : "3px 10px",
      borderRadius: "20px", fontSize: size === "sm" ? "10.5px" : "11.5px",
      fontWeight: 700, background: s.bg, color: s.color,
      whiteSpace: "nowrap",
    }}>
      {dot && (
        <span style={{
          width: "5px", height: "5px", borderRadius: "50%",
          background: s.dot, display: "inline-block", flexShrink: 0,
        }} />
      )}
      {children}
    </span>
  );
}
