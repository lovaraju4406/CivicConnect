import { useState } from "react";

interface Props {
  value: boolean;
  onChange: (val: boolean) => void;
  reason?: string;
  onReasonChange?: (reason: string) => void;
}

export default function EmergencyToggle({ value, onChange, reason = "", onReasonChange }: Props) {
  const [showReason, setShowReason] = useState(value);

  const handle = (checked: boolean) => {
    onChange(checked);
    setShowReason(checked);
    if (!checked) onReasonChange?.("");
  };

  return (
    <div style={{
      border: `1.5px solid ${value ? "#fca5a5" : "#e2e8f0"}`,
      borderRadius: "12px", padding: "14px 16px",
      background: value ? "#fef2f2" : "#fff",
      transition: "all .2s",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
        <div>
          <p style={{ margin: 0, fontSize: "13.5px", fontWeight: 700, color: value ? "#991b1b" : "#1e293b", display: "flex", alignItems: "center", gap: "6px" }}>
            🚨 Emergency
          </p>
          <p style={{ margin: "2px 0 0", fontSize: "11.5px", color: "#64748b" }}>
            Mark this issue as life-threatening or requiring immediate response
          </p>
        </div>
        {/* Toggle */}
        <button
          type="button"
          onClick={() => handle(!value)}
          style={{
            width: "46px", height: "26px", borderRadius: "13px", border: "none",
            background: value ? "#ef4444" : "#cbd5e1",
            cursor: "pointer", position: "relative", transition: "background .2s", flexShrink: 0,
          }}
        >
          <span style={{
            position: "absolute", top: "3px",
            left: value ? "23px" : "3px",
            width: "20px", height: "20px", borderRadius: "50%",
            background: "#fff", transition: "left .2s",
            boxShadow: "0 1px 4px rgba(0,0,0,.2)",
          }} />
        </button>
      </div>

      {showReason && (
        <div style={{ marginTop: "12px" }}>
          <label style={{ fontSize: "12px", fontWeight: 600, color: "#991b1b", display: "block", marginBottom: "5px" }}>
            Reason for emergency * (required)
          </label>
          <textarea
            value={reason}
            onChange={e => onReasonChange?.(e.target.value)}
            rows={2}
            placeholder="Briefly explain why this is an emergency…"
            style={{
              width: "100%", padding: "8px 10px", fontSize: "12.5px",
              border: "1.5px solid #fca5a5", borderRadius: "8px",
              outline: "none", fontFamily: "inherit", resize: "vertical",
              background: "#fff", color: "#1e293b", boxSizing: "border-box",
            }}
          />
        </div>
      )}
    </div>
  );
}
