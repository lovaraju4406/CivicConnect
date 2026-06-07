import { InputHTMLAttributes, ReactNode, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: ReactNode;
  rightElement?: ReactNode;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, icon, rightElement, style, ...rest }, ref) => {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "5px", width: "100%" }}>
        {label && (
          <label style={{ fontSize: "13px", fontWeight: 600, color: "#334155" }}>
            {label}
          </label>
        )}
        <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
          {icon && (
            <span style={{
              position: "absolute", left: "11px", top: "50%", transform: "translateY(-50%)",
              color: "#94a3b8", display: "flex", pointerEvents: "none",
            }}>
              {icon}
            </span>
          )}
          <input
            ref={ref}
            style={{
              width: "100%", padding: icon ? "10px 12px 10px 36px" : "10px 12px",
              paddingRight: rightElement ? "40px" : "12px",
              border: `1.5px solid ${error ? "#ef4444" : "#e2e8f0"}`,
              borderRadius: "10px", fontSize: "13.5px", color: "#1e293b",
              background: rest.disabled ? "#f8fafc" : "#fff",
              outline: "none", fontFamily: "inherit", transition: "border-color .15s",
              boxSizing: "border-box",
              ...style,
            }}
            onFocus={e => { e.currentTarget.style.borderColor = error ? "#ef4444" : "#ea6800"; }}
            onBlur={e => { e.currentTarget.style.borderColor = error ? "#ef4444" : "#e2e8f0"; }}
            {...rest}
          />
          {rightElement && (
            <span style={{ position: "absolute", right: "11px", top: "50%", transform: "translateY(-50%)", display: "flex" }}>
              {rightElement}
            </span>
          )}
        </div>
        {error && <p style={{ fontSize: "12px", color: "#ef4444", margin: 0 }}>{error}</p>}
        {hint && !error && <p style={{ fontSize: "12px", color: "#94a3b8", margin: 0 }}>{hint}</p>}
      </div>
    );
  }
);

Input.displayName = "Input";
export default Input;
