import { useRef, useState } from "react";

interface Props {
  onUpload: (file: File, preview: string, note: string) => Promise<void> | void;
  loading?: boolean;
  label?: string;
}

export default function UploadProof({ onUpload, loading, label = "Upload Resolution Proof" }: Props) {
  const [file, setFile]       = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [note, setNote]       = useState("");
  const [error, setError]     = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File) => {
    setError("");
    if (!f.type.startsWith("image/") && f.type !== "application/pdf") {
      setError("Only images or PDFs are accepted."); return;
    }
    if (f.size > 8 * 1024 * 1024) { setError("File must be under 8MB."); return; }
    setFile(f);
    if (f.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = e => setPreview(e.target?.result as string);
      reader.readAsDataURL(f);
    } else {
      setPreview(null);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) { setError("Please select a file to upload."); return; }
    await onUpload(file, preview ?? "", note);
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      <p style={{ margin: 0, fontSize: "13px", fontWeight: 700, color: "#334155" }}>{label}</p>
      <input ref={inputRef} type="file" accept="image/*,application/pdf" onChange={handleChange} style={{ display: "none" }} />

      {!file ? (
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={handleDrop}
          style={{
            border: "2px dashed #cbd5e1", borderRadius: "12px", padding: "30px 16px",
            background: "#f8fafc", cursor: "pointer", textAlign: "center",
          }}
        >
          <div style={{ fontSize: "28px", marginBottom: "8px" }}>📎</div>
          <p style={{ margin: 0, fontSize: "13px", color: "#475569", fontWeight: 600 }}>Click or drag file here</p>
          <p style={{ margin: "4px 0 0", fontSize: "11.5px", color: "#94a3b8" }}>Image or PDF, max 8MB</p>
        </div>
      ) : (
        <div style={{ border: "1.5px solid #e2e8f0", borderRadius: "12px", overflow: "hidden" }}>
          {preview ? (
            <img src={preview} alt="proof preview" style={{ width: "100%", maxHeight: "180px", objectFit: "cover", display: "block" }} />
          ) : (
            <div style={{ padding: "16px", background: "#f8fafc", display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "24px" }}>📄</span>
              <span style={{ fontSize: "13px", color: "#334155", fontWeight: 600 }}>{file.name}</span>
            </div>
          )}
          <div style={{ padding: "10px 12px", display: "flex", justifyContent: "flex-end" }}>
            <button type="button" onClick={() => { setFile(null); setPreview(null); if (inputRef.current) inputRef.current.value = ""; }}
              style={{ fontSize: "12px", color: "#ef4444", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
              ✕ Remove
            </button>
          </div>
        </div>
      )}

      {error && <p style={{ fontSize: "12px", color: "#ef4444", margin: 0 }}>⚠️ {error}</p>}

      <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
        <label style={{ fontSize: "13px", fontWeight: 600, color: "#334155" }}>Resolution Note (optional)</label>
        <textarea
          value={note} onChange={e => setNote(e.target.value)} rows={2}
          placeholder="Describe what was done to resolve this issue…"
          style={{ padding: "9px 12px", fontSize: "13px", border: "1.5px solid #e2e8f0", borderRadius: "10px", fontFamily: "inherit", resize: "vertical", outline: "none" }}
        />
      </div>

      <button
        type="submit" disabled={loading || !file}
        style={{
          background: "#10b981", color: "#fff", border: "none", borderRadius: "10px",
          padding: "10px 20px", fontSize: "13.5px", fontWeight: 700,
          cursor: loading || !file ? "not-allowed" : "pointer",
          opacity: loading || !file ? 0.65 : 1, fontFamily: "inherit",
          display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
        }}
      >
        {loading && <span style={{ width: "13px", height: "13px", border: "2px solid rgba(255,255,255,.35)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin .6s linear infinite", display: "inline-block" }} />}
        {loading ? "Uploading…" : "✅ Submit Proof"}
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </button>
    </form>
  );
}
