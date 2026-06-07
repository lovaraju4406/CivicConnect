import { useState, useRef } from "react";
import type { Complaint } from "../../types/complaint.types";

const DEPARTMENTS = ["Electricity","Water Works","Sanitation","Roads & Infrastructure","Police","Fire Department","General Civic"];
const DEPT_KEYWORDS: Record<string, string[]> = {
  "Electricity": ["power","electricity","light","streetlight","transformer","wire","voltage","outage","blackout"],
  "Water Works": ["water","pipe","leak","flood","drain","sewage","tap","supply","overflow"],
  "Sanitation": ["garbage","waste","trash","litter","smell","dump","sanitation","rubbish","bin"],
  "Roads & Infrastructure": ["road","pothole","bridge","footpath","pavement","traffic","signal","crack","repair"],
  "Police": ["theft","crime","accident","assault","robbery","noise","fight","harassment","vandalism"],
  "Fire Department": ["fire","smoke","burn","flame","explosion","gas","hazard","blaze"],
};
const DEPT_ICON: Record<string, string> = {
  "Electricity":"⚡","Water Works":"💧","Sanitation":"🗑️","Roads & Infrastructure":"🛣️","Police":"👮","Fire Department":"🔥","General Civic":"🏛️"
};

function aiRoute(title: string, desc: string): string {
  const text = `${title} ${desc}`.toLowerCase();
  let best = "General Civic", score = 0;
  for (const [dept, kws] of Object.entries(DEPT_KEYWORDS)) {
    const m = kws.filter(k => text.includes(k)).length;
    if (m > score) { score = m; best = dept; }
  }
  return best;
}

interface Props {
  onSubmit: (data: Partial<Complaint> & { imageFile?: File }) => Promise<void> | void;
  loading?: boolean;
  initialValues?: Partial<Complaint>;
}

export default function ComplaintForm({ onSubmit, loading = false, initialValues }: Props) {
  const [title, setTitle]           = useState(initialValues?.title ?? "");
  const [description, setDesc]      = useState(initialValues?.description ?? "");
  const [department, setDepartment] = useState(initialValues?.department ?? "");
  const [address, setAddress]       = useState(initialValues?.address ?? "");
  const [imageFile, setImageFile]   = useState<File | null>(null);
  const [imagePreview, setPreview]  = useState<string | null>(initialValues?.image ?? null);
  const [errors, setErrors]         = useState<Record<string, string>>({});
  const [aiSuggestion, setAISug]    = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleTitleBlur = () => {
    if (title.trim()) {
      const sug = aiRoute(title, description);
      if (!department) { setDepartment(sug); }
      setAISug(sug);
    }
  };

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = ev => setPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!title.trim())       errs.title       = "Title is required";
    if (!description.trim()) errs.description = "Description is required";
    if (!department)         errs.department  = "Please select a department";
    if (!address.trim())     errs.address     = "Address is required";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    await onSubmit({ title, description, department, address, ...(imageFile ? {} : imagePreview ? { image: imagePreview } : {}) , ...(imageFile ? { imageFile } : {}) });
  };

  const inputStyle = (field: string): React.CSSProperties => ({
    width: "100%", padding: "10px 12px", fontSize: "13.5px", color: "#1e293b",
    border: `1.5px solid ${errors[field] ? "#ef4444" : "#e2e8f0"}`,
    borderRadius: "10px", outline: "none", fontFamily: "inherit",
    background: "#fff", boxSizing: "border-box",
  });

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Title */}
      <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
        <label style={{ fontSize: "13px", fontWeight: 600, color: "#334155" }}>Title *</label>
        <input
          value={title} onChange={e => setTitle(e.target.value)} onBlur={handleTitleBlur}
          placeholder="e.g. Broken streetlight near park"
          style={inputStyle("title")}
          onFocus={e => (e.currentTarget.style.borderColor = "#ea6800")}
          onBlur2={undefined as any}
        />
        {errors.title && <p style={{ fontSize: "12px", color: "#ef4444", margin: 0 }}>{errors.title}</p>}
      </div>

      {/* Description */}
      <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
        <label style={{ fontSize: "13px", fontWeight: 600, color: "#334155" }}>Description *</label>
        <textarea
          value={description} onChange={e => setDesc(e.target.value)} rows={4}
          placeholder="Describe the issue in detail..."
          style={{ ...inputStyle("description"), resize: "vertical", minHeight: "90px" }}
          onFocus={e => (e.currentTarget.style.borderColor = "#ea6800")}
        />
        {errors.description && <p style={{ fontSize: "12px", color: "#ef4444", margin: 0 }}>{errors.description}</p>}
      </div>

      {/* Department with AI suggestion */}
      <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <label style={{ fontSize: "13px", fontWeight: 600, color: "#334155" }}>Department *</label>
          {aiSuggestion && (
            <span style={{
              fontSize: "11px", background: "#eff6ff", color: "#1d4ed8",
              border: "1px solid #bfdbfe", borderRadius: "20px", padding: "2px 9px",
            }}>
              🤖 AI suggested: {DEPT_ICON[aiSuggestion]} {aiSuggestion}
            </span>
          )}
        </div>
        <select
          value={department} onChange={e => setDepartment(e.target.value)}
          style={{ ...inputStyle("department"), cursor: "pointer", appearance: "none" }}
        >
          <option value="">Select department</option>
          {DEPARTMENTS.map(d => (
            <option key={d} value={d}>{DEPT_ICON[d]} {d}</option>
          ))}
        </select>
        {errors.department && <p style={{ fontSize: "12px", color: "#ef4444", margin: 0 }}>{errors.department}</p>}
      </div>

      {/* Address */}
      <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
        <label style={{ fontSize: "13px", fontWeight: 600, color: "#334155" }}>Address *</label>
        <input
          value={address} onChange={e => setAddress(e.target.value)}
          placeholder="Full address of the issue location"
          style={inputStyle("address")}
          onFocus={e => (e.currentTarget.style.borderColor = "#ea6800")}
        />
        {errors.address && <p style={{ fontSize: "12px", color: "#ef4444", margin: 0 }}>{errors.address}</p>}
      </div>

      {/* Image Upload */}
      <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
        <label style={{ fontSize: "13px", fontWeight: 600, color: "#334155" }}>Photo (optional)</label>
        <input ref={fileRef} type="file" accept="image/*" onChange={handleImage} style={{ display: "none" }} />
        {imagePreview ? (
          <div style={{ position: "relative", display: "inline-block" }}>
            <img src={imagePreview} alt="preview" style={{ width: "100%", maxHeight: "180px", objectFit: "cover", borderRadius: "10px", border: "1.5px solid #e2e8f0" }} />
            <button
              type="button" onClick={() => { setImageFile(null); setPreview(null); if (fileRef.current) fileRef.current.value = ""; }}
              style={{ position: "absolute", top: "8px", right: "8px", background: "#ef4444", color: "#fff", border: "none", borderRadius: "50%", width: "24px", height: "24px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px" }}
            >✕</button>
          </div>
        ) : (
          <button
            type="button" onClick={() => fileRef.current?.click()}
            style={{ border: "2px dashed #cbd5e1", borderRadius: "10px", padding: "20px", background: "#f8fafc", cursor: "pointer", color: "#64748b", fontSize: "13px", display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}
          >
            <span style={{ fontSize: "22px" }}>📷</span>
            <span>Click to upload photo</span>
            <span style={{ fontSize: "11px", color: "#94a3b8" }}>JPG, PNG up to 5MB</span>
          </button>
        )}
      </div>

      {/* Submit */}
      <button
        type="submit" disabled={loading}
        style={{
          background: "#ea6800", color: "#fff", border: "none", borderRadius: "10px",
          padding: "12px", fontSize: "14px", fontWeight: 700, cursor: loading ? "not-allowed" : "pointer",
          opacity: loading ? 0.7 : 1, fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
        }}
      >
        {loading && <span style={{ width: "14px", height: "14px", border: "2px solid rgba(255,255,255,.35)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin .6s linear infinite", display: "inline-block" }} />}
        {loading ? "Submitting…" : "Submit Complaint"}
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </button>
    </form>
  );
}
