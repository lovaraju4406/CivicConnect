import { useState } from "react";

interface Props {
  onCapture: (coords: { lat: number; lng: number; address?: string }) => void;
}

export default function GPSCapture({ onCapture }: Props) {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [error, setError]   = useState<string>("");

  const capture = () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      setStatus("error");
      return;
    }
    setStatus("loading");
    setError("");
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setCoords({ lat, lng });
        setStatus("done");
        // Reverse geocode
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
          const data = await res.json();
          onCapture({ lat, lng, address: data.display_name });
        } catch {
          onCapture({ lat, lng });
        }
      },
      err => {
        setStatus("error");
        if (err.code === 1) setError("Location permission denied. Please allow access.");
        else if (err.code === 2) setError("Position unavailable. Try again.");
        else setError("Location request timed out.");
      },
      { timeout: 12000, enableHighAccuracy: true }
    );
  };

  return (
    <div>
      <button
        type="button" onClick={capture} disabled={status === "loading"}
        style={{
          display: "flex", alignItems: "center", gap: "8px",
          padding: "9px 16px", borderRadius: "10px",
          border: "1.5px solid #e2e8f0", background: "#f8fafc",
          fontSize: "13px", fontWeight: 600, cursor: status === "loading" ? "not-allowed" : "pointer",
          color: "#334155", fontFamily: "inherit", opacity: status === "loading" ? 0.7 : 1,
        }}
      >
        {status === "loading" ? (
          <span style={{ width: "14px", height: "14px", border: "2px solid #cbd5e1", borderTopColor: "#ea6800", borderRadius: "50%", animation: "gps-spin .7s linear infinite", display: "inline-block" }} />
        ) : (
          <span style={{ fontSize: "16px" }}>📍</span>
        )}
        {status === "loading" ? "Getting location…" : status === "done" ? "📍 Location captured" : "Use my GPS location"}
        <style>{`@keyframes gps-spin{to{transform:rotate(360deg)}}`}</style>
      </button>

      {status === "done" && coords && (
        <div style={{ marginTop: "8px", padding: "8px 12px", background: "#f0fdf4", borderRadius: "9px", border: "1.5px solid #86efac", fontSize: "12px", color: "#166534" }}>
          ✅ Lat: {coords.lat.toFixed(5)}, Lng: {coords.lng.toFixed(5)}
        </div>
      )}
      {status === "error" && (
        <div style={{ marginTop: "8px", padding: "8px 12px", background: "#fef2f2", borderRadius: "9px", border: "1.5px solid #fca5a5", fontSize: "12px", color: "#991b1b" }}>
          ⚠️ {error}
        </div>
      )}
    </div>
  );
}
