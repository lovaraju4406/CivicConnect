import { TextareaHTMLAttributes, forwardRef } from "react";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, style, ...rest }, ref) => {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "5px", width: "100%" }}>
        {label && (
          <label style={{ fontSize: "13px", fontWeight: 600, color: "#334155" }}>{label}</label>
        )}
        <textarea
          ref={ref}
          style={{
            width: "100%", padding: "10px 12px",
            border: `1.5px solid ${error ? "#ef4444" : "#e2e8f0"}`,
            borderRadius: "10px", fontSize: "13.5px", color: "#1e293b",
            background: rest.disabled ? "#f8fafc" : "#fff",
            outline: "none", fontFamily: "inherit", resize: "vertical",
            minHeight: "90px", transition: "border-color .15s",
            boxSizing: "border-box",
            ...style,
          }}
          onFocus={e => { e.currentTarget.style.borderColor = error ? "#ef4444" : "#ea6800"; }}
          onBlur={e => { e.currentTarget.style.borderColor = error ? "#ef4444" : "#e2e8f0"; }}
          {...rest}
        />
        {error && <p style={{ fontSize: "12px", color: "#ef4444", margin: 0 }}>{error}</p>}
        {hint && !error && <p style={{ fontSize: "12px", color: "#94a3b8", margin: 0 }}>{hint}</p>}
      </div>
    );
  }
);

Textarea.displayName = "Textarea";
export default Textarea;
