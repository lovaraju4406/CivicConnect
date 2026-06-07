import { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost" | "outline";
type Size    = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  fullWidth?: boolean;
  children: ReactNode;
}

export default function Button({
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  fullWidth = false,
  children,
  disabled,
  style,
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading;

  const VARIANT_STYLES: Record<Variant, React.CSSProperties> = {
    primary:   { background: "#ea6800", color: "#fff", border: "1.5px solid #ea6800" },
    secondary: { background: "#f1f5f9", color: "#334155", border: "1.5px solid #e2e8f0" },
    danger:    { background: "#ef4444", color: "#fff", border: "1.5px solid #ef4444" },
    ghost:     { background: "transparent", color: "#64748b", border: "1.5px solid transparent" },
    outline:   { background: "transparent", color: "#ea6800", border: "1.5px solid #ea6800" },
  };

  const SIZE_STYLES: Record<Size, React.CSSProperties> = {
    sm: { padding: "6px 12px", fontSize: "12px", borderRadius: "8px" },
    md: { padding: "9px 18px", fontSize: "13.5px", borderRadius: "10px" },
    lg: { padding: "12px 24px", fontSize: "15px", borderRadius: "12px" },
  };

  return (
    <button
      disabled={isDisabled}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "7px",
        fontWeight: 600, cursor: isDisabled ? "not-allowed" : "pointer",
        opacity: isDisabled ? 0.55 : 1,
        transition: "filter .15s, transform .1s",
        fontFamily: "inherit",
        ...(fullWidth ? { width: "100%" } : {}),
        ...VARIANT_STYLES[variant],
        ...SIZE_STYLES[size],
        ...style,
      }}
      onMouseEnter={e => { if (!isDisabled) (e.currentTarget as HTMLButtonElement).style.filter = "brightness(0.88)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.filter = "brightness(1)"; }}
      onMouseDown={e => { if (!isDisabled) (e.currentTarget as HTMLButtonElement).style.transform = "scale(0.97)"; }}
      onMouseUp={e => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)"; }}
      {...rest}
    >
      {loading ? (
        <span style={{
          width: "13px", height: "13px",
          border: "2px solid rgba(255,255,255,.35)",
          borderTopColor: "#fff", borderRadius: "50%",
          animation: "btn-spin .6s linear infinite", display: "inline-block", flexShrink: 0,
        }} />
      ) : icon ? <span style={{ display: "inline-flex" }}>{icon}</span> : null}
      {children}
      <style>{`@keyframes btn-spin{to{transform:rotate(360deg)}}`}</style>
    </button>
  );
}
