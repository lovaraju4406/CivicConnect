import { SelectHTMLAttributes, forwardRef, ReactNode } from "react";

interface SelectOption { value: string; label: string; }

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  options: SelectOption[];
  placeholder?: string;
  icon?: ReactNode;
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, hint, options, placeholder, icon, style, ...rest }, ref) => {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "5px", width: "100%" }}>
        {label && (
          <label style={{ fontSize: "13px", fontWeight: 600, color: "#334155" }}>{label}</label>
        )}
        <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
          {icon && (
            <span style={{
              position: "absolute", left: "11px", top: "50%", transform: "translateY(-50%)",
              color: "#94a3b8", display: "flex", pointerEvents: "none", zIndex: 1,
            }}>
              {icon}
            </span>
          )}
          <select
            ref={ref}
            style={{
              width: "100%", padding: icon ? "10px 36px 10px 36px" : "10px 36px 10px 12px",
              border: `1.5px solid ${error ? "#ef4444" : "#e2e8f0"}`,
              borderRadius: "10px", fontSize: "13.5px", color: "#1e293b",
              background: rest.disabled ? "#f8fafc" : "#fff",
              outline: "none", fontFamily: "inherit", cursor: "pointer",
              appearance: "none", transition: "border-color .15s",
              boxSizing: "border-box",
              ...style,
            }}
            onFocus={e => { e.currentTarget.style.borderColor = error ? "#ef4444" : "#ea6800"; }}
            onBlur={e => { e.currentTarget.style.borderColor = error ? "#ef4444" : "#e2e8f0"; }}
            {...rest}
          >
            {placeholder && <option value="">{placeholder}</option>}
            {options.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          {/* Chevron arrow */}
          <span style={{
            position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)",
            pointerEvents: "none", color: "#94a3b8",
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </span>
        </div>
        {error && <p style={{ fontSize: "12px", color: "#ef4444", margin: 0 }}>{error}</p>}
        {hint && !error && <p style={{ fontSize: "12px", color: "#94a3b8", margin: 0 }}>{hint}</p>}
      </div>
    );
  }
);

Select.displayName = "Select";
export default Select;
