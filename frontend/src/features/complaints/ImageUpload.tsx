import { useRef, useState } from "react";

interface Props {
  value?: string | null;
  onChange: (file: File, preview: string) => void;
  onClear?: () => void;
  label?: string;
  maxSizeMB?: number;
}

export default function ImageUpload({ value, onChange, onClear, label = "Upload Image", maxSizeMB = 5 }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const [error, setError]       = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const processFile = (file: File) => {
    setError("");
    if (!file.type.startsWith("image/")) { setError("Only image files are accepted."); return; }
    if (file.size > maxSizeMB * 1024 * 1024) { setError(`File must be under ${maxSizeMB}MB.`); return; }
    const reader = new FileReader();
    reader.onload = e => onChange(file, e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      {label && <label style={{ fontSize: "13px", fontWeight: 600, color: "#334155" }}>{label}</label>}
      <input ref={inputRef} type="file" accept="image/*" onChange={handleChange} style={{ display: "none" }} />

      {value ? (
        <div style={{ position: "relative" }}>
          <img
            src={value} alt="upload preview"
            style={{ width: "100%", maxHeight: "200px", objectFit: "cover", borderRadius: "10px", border: "1.5px solid #e2e8f0", display: "block" }}
          />
          <div style={{ position: "absolute", top: "8px", right: "8px", display: "flex", gap: "6px" }}>
            <button
              type="button" onClick={() => inputRef.current?.click()}
              style={{ background: "#1e293b", color: "#fff", border: "none", borderRadius: "7px", padding: "4px 10px", fontSize: "11px", cursor: "pointer", fontWeight: 600 }}
            >Change</button>
            {onClear && (
              <button
                type="button" onClick={onClear}
                style={{ background: "#ef4444", color: "#fff", border: "none", borderRadius: "7px", padding: "4px 8px", fontSize: "11px", cursor: "pointer" }}
              >✕</button>
            )}
          </div>
        </div>
      ) : (
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          style={{
            border: `2px dashed ${dragOver ? "#ea6800" : "#cbd5e1"}`,
            borderRadius: "12px", padding: "28px 16px",
            background: dragOver ? "#fff7ed" : "#f8fafc",
            cursor: "pointer", textAlign: "center", transition: "all .15s",
          }}
        >
          <div style={{ fontSize: "28px", marginBottom: "8px" }}>📷</div>
          <p style={{ margin: 0, fontSize: "13px", color: "#475569", fontWeight: 600 }}>
            {dragOver ? "Drop to upload" : "Click or drag & drop an image"}
          </p>
          <p style={{ margin: "4px 0 0", fontSize: "11.5px", color: "#94a3b8" }}>
            JPG, PNG, WEBP — max {maxSizeMB}MB
          </p>
        </div>
      )}

      {error && <p style={{ fontSize: "12px", color: "#ef4444", margin: 0 }}>⚠️ {error}</p>}
    </div>
  );
}
