import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from "react-leaflet";
import { useSelector } from "react-redux";
import type { RootState } from "../../store";
import { Link } from "react-router-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useState, useEffect } from "react";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const statusColors: Record<string, string> = {
  Pending: "bg-amber-100 text-amber-700",
  Assigned: "bg-blue-100 text-blue-700",
  Resolved: "bg-emerald-100 text-emerald-700",
};

// Radius in km within which to show issues
const NEARBY_RADIUS_KM = 5;

/** Haversine distance between two lat/lng points in km */
function getDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Custom blue "you are here" icon */
const youAreHereIcon = L.divIcon({
  className: "",
  html: `
    <div style="position:relative;width:24px;height:24px;display:flex;align-items:center;justify-content:center;">
      <div style="position:absolute;width:24px;height:24px;border-radius:50%;background:#3b82f6;opacity:0.25;animation:citizen-pulse 2s ease-in-out infinite;"></div>
      <div style="position:absolute;width:14px;height:14px;border-radius:50%;background:#1d4ed8;border:2.5px solid white;box-shadow:0 2px 8px rgba(29,78,216,0.5);"></div>
    </div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
  popupAnchor: [0, -16],
});

/** Recenter map when citizen location changes */
function RecenterMap({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], 14, { animate: true });
  }, [lat, lng, map]);
  return null;
}

export default function MapView() {
  const complaints = useSelector((state: RootState) => state.complaints.complaints);

  const [citizenLocation, setCitizenLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locating, setLocating] = useState(true);

  // Fallback center (Vijayawada)
  const FALLBACK: [number, number] = [16.3067, 80.4365];

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by your browser.");
      setLocating(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCitizenLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      (err) => {
        setLocationError("Could not get your location. Showing all complaints.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  const validComplaints = complaints.filter(
    (c) => typeof c.lat === "number" && typeof c.lng === "number" && !isNaN(c.lat) && !isNaN(c.lng) && c.lat !== 0
  );

  // Filter to nearby complaints when citizen location is known
  const nearbyComplaints = citizenLocation
    ? validComplaints.filter(
        (c) =>
          getDistanceKm(citizenLocation.lat, citizenLocation.lng, c.lat, c.lng) <= NEARBY_RADIUS_KM
      )
    : validComplaints;

  const mapCenter: [number, number] = citizenLocation
    ? [citizenLocation.lat, citizenLocation.lng]
    : nearbyComplaints.length > 0
    ? [nearbyComplaints[0].lat, nearbyComplaints[0].lng]
    : FALLBACK;

  return (
    <div className="h-screen flex flex-col bg-[#f0f2f7]">
      <style>{`
        @keyframes citizen-pulse {
          0%, 100% { transform: scale(1); opacity: 0.25; }
          50% { transform: scale(2); opacity: 0.08; }
        }
      `}</style>

      {/* Header */}
      <div className="bg-[#1a2a4a] flex items-center gap-4 px-6 py-3 z-10 flex-shrink-0">
        <Link
          to="/dashboard"
          className="text-white/50 hover:text-white transition-colors p-1.5 hover:bg-white/10 rounded-lg"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>

        <div className="flex items-center gap-2 flex-1">
          <span className="text-[#ff9c00] text-xs font-bold tracking-widest uppercase hidden sm:block">City Map</span>
          <span className="text-white/30 hidden sm:block">•</span>
          <span className="text-white font-bold text-sm">Live Complaint Map</span>
          {citizenLocation && (
            <>
              <span className="text-white/30 hidden sm:block">•</span>
              <span className="text-white/50 text-xs hidden sm:block">Within {NEARBY_RADIUS_KM} km of you</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-3 text-xs text-white/50">
          {/* Location status */}
          {locating && (
            <span className="flex items-center gap-1.5 text-blue-300">
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" /> Locating…
            </span>
          )}
          {locationError && !locating && (
            <span className="flex items-center gap-1.5 text-amber-300" title={locationError}>
              <span className="w-2 h-2 rounded-full bg-amber-400" /> Location unavailable
            </span>
          )}
          {citizenLocation && !locating && (
            <span className="flex items-center gap-1.5 text-blue-300">
              <span className="w-2 h-2 rounded-full bg-blue-400" /> Your location
            </span>
          )}

          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400" /> Pending
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-400" /> Assigned
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400" /> Resolved
          </span>
          <span className="bg-white/10 text-white/60 px-2.5 py-1 rounded-lg font-mono">
            {nearbyComplaints.length} {citizenLocation ? "nearby" : ""} pins
          </span>
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        <MapContainer center={mapCenter} zoom={14} scrollWheelZoom={true} className="h-full w-full">
          <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* Recenter when citizen location resolves */}
          {citizenLocation && <RecenterMap lat={citizenLocation.lat} lng={citizenLocation.lng} />}

          {/* Citizen's location marker + radius circle */}
          {citizenLocation && (
            <>
              <Circle
                center={[citizenLocation.lat, citizenLocation.lng]}
                radius={NEARBY_RADIUS_KM * 1000}
                pathOptions={{
                  color: "#3b82f6",
                  fillColor: "#3b82f6",
                  fillOpacity: 0.06,
                  weight: 1.5,
                  dashArray: "6 4",
                }}
              />
              <Marker position={[citizenLocation.lat, citizenLocation.lng]} icon={youAreHereIcon}>
                <Popup maxWidth={180}>
                  <div className="p-1 text-center">
                    <strong className="text-slate-800 text-sm">📍 You are here</strong>
                    <p className="text-xs text-slate-500 mt-1">
                      Showing issues within {NEARBY_RADIUS_KM} km of your location.
                    </p>
                  </div>
                </Popup>
              </Marker>
            </>
          )}

          {/* Nearby complaint markers */}
          {nearbyComplaints.map((c) => (
            <Marker key={c.id} position={[c.lat, c.lng]}>
              <Popup maxWidth={260}>
                <div className="space-y-2 p-1">
                  <div className="flex items-start justify-between gap-2">
                    <strong className="text-slate-800 text-sm leading-snug">{c.title}</strong>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${
                        statusColors[c.status] || ""
                      }`}
                    >
                      {c.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 line-clamp-2">{c.description}</p>
                  <div className="pt-1 border-t border-slate-100 space-y-1">
                    <p className="text-[10px] text-slate-400">
                      <b className="text-slate-500">Ticket:</b> {c.ticketId}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      <b className="text-slate-500">Dept:</b> {c.department}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      <b className="text-slate-500">Time:</b> {new Date(c.createdAt).toLocaleString()}
                    </p>
                    {citizenLocation && (
                      <p className="text-[10px] text-blue-400">
                        <b className="text-blue-500">Distance:</b>{" "}
                        {getDistanceKm(citizenLocation.lat, citizenLocation.lng, c.lat, c.lng).toFixed(2)} km
                      </p>
                    )}
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        {/* No nearby complaints overlay */}
        {nearbyComplaints.length === 0 && !locating && (
          <div className="absolute inset-0 bg-black/20 flex items-center justify-center z-[1000]">
            <div className="bg-white rounded-2xl p-8 shadow-2xl text-center max-w-xs mx-4">
              <div className="text-4xl mb-3">🗺️</div>
              <h3 className="font-bold text-slate-700">
                {citizenLocation ? `No complaints within ${NEARBY_RADIUS_KM} km` : "No complaints on map"}
              </h3>
              <p className="text-slate-400 text-sm mt-1">
                {citizenLocation
                  ? "There are no reported issues near your current location."
                  : "Submit complaints with location to see them pinned here."}
              </p>
              <Link
                to="/submit-complaint"
                className="mt-4 inline-block bg-[#1a2a4a] text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#243756] transition-colors"
              >
                Report an Issue
              </Link>
            </div>
          </div>
        )}

        {/* Locating spinner overlay */}
        {locating && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000]">
            <div className="bg-white/90 backdrop-blur-sm rounded-xl px-4 py-2 shadow-lg flex items-center gap-2 text-sm text-slate-600 font-medium">
              <svg className="w-4 h-4 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Detecting your location…
            </div>
          </div>
        )}
      </div>
    </div>
  );
}