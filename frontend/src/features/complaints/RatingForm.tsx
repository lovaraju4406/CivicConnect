import { useState } from "react";

interface Props {
  complaintId: string;
  onSubmit: (data: { rating: number; comment: string; complaintId: string }) => Promise<void> | void;
  loading?: boolean;
  submitted?: boolean;
}

export default function RatingForm({ complaintId, onSubmit, loading, submitted }: Props) {
  const [rating, setRating]   = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState("");
  const [error, setError]     = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) { setError("Please select a star rating."); return; }
    setError("");
    await onSubmit({ rating, comment, complaintId });
  };

  if (submitted) {
    return (
      <div style={{ textAlign: "center", padding: "24px 16px", background: "#f0fdf4", borderRadius: "12px", border: "1.5px solid #86efac" }}>
        <div style={{ fontSize: "32px", marginBottom: "8px" }}>🌟</div>
        <p style={{ margin: 0, fontWeight: 700, color: "#065f46", fontSize: "14px" }}>Thank you for your feedback!</p>
        <p style={{ margin: "4px 0 0", color: "#166534", fontSize: "12px" }}>Your rating helps us improve civic services.</p>
      </div>
    );
  }

  const LABELS = ["", "Poor", "Fair", "Good", "Very Good", "Excellent"];

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      <div>
        <p style={{ margin: "0 0 8px", fontSize: "13px", fontWeight: 600, color: "#334155" }}>Rate the resolution</p>
        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
          {[1, 2, 3, 4, 5].map(star => (
            <button
              key={star} type="button"
              onClick={() => setRating(star)}
              onMouseEnter={() => setHovered(star)}
              onMouseLeave={() => setHovered(0)}
              style={{
                fontSize: "28px", background: "none", border: "none", cursor: "pointer", padding: "2px",
                filter: star <= (hovered || rating) ? "none" : "grayscale(1) opacity(.4)",
                transform: star <= (hovered || rating) ? "scale(1.15)" : "scale(1)",
                transition: "transform .1s, filter .1s",
              }}
            >⭐</button>
          ))}
          {(hovered || rating) > 0 && (
            <span style={{ fontSize: "12px", color: "#ea6800", fontWeight: 700, marginLeft: "6px" }}>
              {LABELS[hovered || rating]}
            </span>
          )}
        </div>
        {error && <p style={{ fontSize: "12px", color: "#ef4444", margin: "6px 0 0" }}>{error}</p>}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
        <label style={{ fontSize: "13px", fontWeight: 600, color: "#334155" }}>Comment (optional)</label>
        <textarea
          value={comment} onChange={e => setComment(e.target.value)} rows={3}
          placeholder="Share your experience with the resolution…"
          style={{ padding: "10px 12px", fontSize: "13px", border: "1.5px solid #e2e8f0", borderRadius: "10px", fontFamily: "inherit", resize: "vertical", outline: "none", color: "#1e293b" }}
        />
      </div>

      <button
        type="submit" disabled={loading}
        style={{
          background: "#ea6800", color: "#fff", border: "none", borderRadius: "10px",
          padding: "10px 20px", fontSize: "13.5px", fontWeight: 700,
          cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1, fontFamily: "inherit",
          display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
        }}
      >
        {loading && <span style={{ width: "13px", height: "13px", border: "2px solid rgba(255,255,255,.35)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin .6s linear infinite", display: "inline-block" }} />}
        {loading ? "Submitting…" : "Submit Rating"}
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </button>
    </form>
  );
}
