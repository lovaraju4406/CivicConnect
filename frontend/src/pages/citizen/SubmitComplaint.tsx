import { useState, useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { RootState } from "../../store";
import { addComplaint } from "../../store/complaintSlice";
import { addNotification } from "../../store/notificationSlice";
import { nanoid } from "@reduxjs/toolkit";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { MapContainer, TileLayer, Marker } from "react-leaflet";
import "leaflet/dist/leaflet.css";

export default function SubmitComplaint() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ✅ FIX: get the logged-in user so we can tag complaints with their id
  const user = useSelector((state: RootState) => state.auth.user);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [address, setAddress] = useState<string>("Detecting your location...");
  const [loadingLocation, setLoadingLocation] = useState(true);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageData, setImageData] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleImageUpload = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
      setImageData(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImagePreview(null);
    setImageData(null);
  };

  const reverseGeocode = async (latitude: number, longitude: number) => {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
      const data = await res.json();
      setAddress(data?.display_name || "Address not found");
    } catch {
      setAddress("Unable to fetch address");
    }
  };

  const getLocation = () => {
    setLoadingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const latitude = Number(pos.coords.latitude.toFixed(5));
        const longitude = Number(pos.coords.longitude.toFixed(5));
        setLat(latitude);
        setLng(longitude);
        reverseGeocode(latitude, longitude);
        setLoadingLocation(false);
      },
      () => {
        setAddress("Location permission denied");
        setLoadingLocation(false);
      }
    );
  };

  useEffect(() => { getLocation(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !description) return toast.error("Please fill in all fields");
    if (lat === null || lng === null) return toast.error("Location not available");
    if (!user?.id) return toast.error("You must be logged in to submit a complaint");

    setSubmitting(true);
    await new Promise(r => setTimeout(r, 600));

    const id = nanoid();

    // ✅ FIX: include userId and userName so complaint saves to the right
    //         localStorage key and can be reloaded on next login
    dispatch(addComplaint({
      id,
      title,
      description,
      lat,
      lng,
      address,
      image: imageData ?? undefined,
      status: "Pending",
      createdAt: Date.now(),
      userId: user.id,
      userName: user.name ?? "Unknown",
    }));

    // Build ticketId for the notification (slice generates the real one,
    // but we need something for the toast — use a temp id)
    const tempTicket = `AP-CIV-${new Date().getFullYear()}-${id.slice(0, 5).toUpperCase()}`;
    dispatch(addNotification(`Complaint submitted successfully. Ticket: ${tempTicket}`));
    toast.success(`Complaint submitted! 🎉`);

    setTitle("");
    setDescription("");
    removeImage();
    setSubmitting(false);
    setTimeout(() => navigate("/dashboard"), 1200);
  };

  const detectDept = (t: string) => {
    const v = t.toLowerCase();
    if (v.includes("light") || v.includes("electric")) return "⚡ Electricity";
    if (v.includes("water")) return "💧 Water Works";
    if (v.includes("garbage") || v.includes("waste")) return "🗑️ Sanitation";
    if (v.includes("road") || v.includes("pothole")) return "🛣️ Roads & Infrastructure";
    if (v.includes("fire")) return "🔥 Fire Department";
    return "🏛️ General Civic";
  };

  return (
    <div className="min-h-screen bg-[#f0f2f7]">

      {/* Page Header */}
      <div className="bg-[#1a2a4a] px-6 md:px-10 py-6">
        <div className="max-w-3xl mx-auto flex items-center gap-4">
          <Link to="/dashboard" className="text-white/50 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-lg">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <p className="text-[#ff9c00] text-[10px] font-bold tracking-widest uppercase">Submit Issue</p>
            <h1 className="text-white text-xl font-black">Report a Civic Problem</h1>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8">
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Title */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              Issue Title *
            </label>
            <input
              className="w-full text-slate-800 text-base font-medium outline-none placeholder:text-slate-300 border-b-2 border-slate-100 focus:border-[#ff6b00] pb-2 transition-colors bg-transparent"
              placeholder="e.g. Broken streetlight on MG Road"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
            {title && (
              <p className="mt-2 text-xs text-slate-400">
                Detected Department: <span className="font-semibold text-slate-600">{detectDept(title)}</span>
              </p>
            )}
          </div>

          {/* Description */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              Description *
            </label>
            <textarea
              className="w-full text-slate-700 text-sm outline-none placeholder:text-slate-300 resize-none h-28 bg-transparent"
              placeholder="Describe the problem in detail — location details, duration, impact on residents..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
            <div className="mt-1 flex justify-end">
              <span className="text-xs text-slate-300">{description.length} chars</span>
            </div>
          </div>

          {/* Photo Upload */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
              Photo Evidence (optional)
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              hidden
              onChange={(e) => e.target.files && handleImageUpload(e.target.files[0])}
            />
            {!imagePreview ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-slate-200 hover:border-[#ff6b00] rounded-xl py-8 flex flex-col items-center gap-2 transition-colors group"
              >
                <div className="w-12 h-12 rounded-full bg-slate-100 group-hover:bg-orange-50 flex items-center justify-center transition-colors">
                  <svg className="w-6 h-6 text-slate-400 group-hover:text-[#ff6b00] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <span className="text-sm font-semibold text-slate-500 group-hover:text-[#ff6b00] transition-colors">
                  Tap to take / upload photo
                </span>
                <span className="text-xs text-slate-300">JPG, PNG up to 10MB</span>
              </button>
            ) : (
              <div className="relative">
                <img src={imagePreview} className="w-full max-h-56 object-cover rounded-xl shadow" />
                <button
                  type="button"
                  onClick={removeImage}
                  className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white text-xs px-3 py-1.5 rounded-lg shadow-lg font-semibold transition-colors"
                >
                  Remove
                </button>
              </div>
            )}
          </div>

          {/* Location */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Location
                </label>
                {loadingLocation ? (
                  <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
                    <span className="w-3 h-3 border-2 border-slate-300 border-t-[#ff6b00] rounded-full animate-spin inline-block" />
                    Detecting your location...
                  </p>
                ) : (
                  <p className="text-xs text-slate-500 mt-1 line-clamp-1 max-w-sm">{address}</p>
                )}
              </div>
              <button
                type="button"
                onClick={getLocation}
                className="text-[#ff6b00] hover:text-[#e55f00] text-xs font-semibold flex items-center gap-1 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh
              </button>
            </div>
            {lat && lng && (
              <div className="h-48 rounded-xl overflow-hidden border border-slate-100 shadow-sm">
                <MapContainer center={[lat, lng]} zoom={16} className="h-full w-full" zoomControl={false}>
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <Marker position={[lat, lng]} />
                </MapContainer>
              </div>
            )}
            {lat && lng && (
              <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
                <span>📍</span>
                <span className="font-mono">{lat}, {lng}</span>
              </p>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            className={`w-full py-4 rounded-2xl font-bold text-base transition-all shadow-lg flex items-center justify-center gap-3
              ${submitting
                ? "bg-slate-300 text-slate-500 cursor-not-allowed"
                : "bg-[#1a2a4a] hover:bg-[#243756] text-white hover:shadow-xl hover:-translate-y-0.5"
              }`}
          >
            {submitting ? (
              <>
                <span className="w-5 h-5 border-2 border-slate-400 border-t-white rounded-full animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Submit Complaint
              </>
            )}
          </button>

        </form>
      </div>
    </div>
  );
}