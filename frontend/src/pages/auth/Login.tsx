import { useState } from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { loginSuccess } from "../../store/authSlice";

type Role = "citizen" | "admin" | "officer" | "worker";

const API = (import.meta as any).env?.VITE_API_URL ?? "http://localhost:3001/api";

const ROLES: { id: Role; label: string; icon: string; path: string }[] = [
  { id: "citizen", label: "Citizen",  icon: "👤", path: "/dashboard"          },
  { id: "officer", label: "Officer",  icon: "⚖️", path: "/officer-dashboard"  },
  { id: "worker",  label: "Worker",   icon: "🔧", path: "/worker-dashboard"   },
  { id: "admin",   label: "Admin",    icon: "🛡️", path: "/admin-dashboard"    },
];

export default function Login() {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const [role,     setRole]     = useState<Role>("citizen");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPwd,  setShowPwd]  = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) { setError("Please fill in all fields."); return; }

    setLoading(true);
    setError("");

    try {
      const res  = await fetch(`${API}/auth/login`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      const data = await res.json();

      if (!data.success) {
        setError(data.message || "Invalid email or password.");
        setLoading(false);
        return;
      }

      const { token, user } = data.data;

      // Make sure selected role tab matches the account's real role
      if (user.role !== role) {
        setError(
          `This account is registered as "${user.role}". ` +
          `Please select the "${user.role.charAt(0).toUpperCase() + user.role.slice(1)}" tab and try again.`
        );
        setLoading(false);
        return;
      }

      // Persist session
      localStorage.setItem("auth", JSON.stringify({ token, user }));
      dispatch(loginSuccess({ token, user }));

      // Redirect to correct dashboard
      const found = ROLES.find(r => r.id === user.role);
      navigate(found?.path ?? "/dashboard", { replace: true });

    } catch {
      setError("Cannot connect to server. Please make sure the backend is running on port 3001.");
    }

    setLoading(false);
  };

  /* ── Styles ── */
  const inputBase: React.CSSProperties = {
    width: "100%", padding: "11px 12px 11px 40px",
    border: "2px solid #e5e7eb", borderRadius: "11px",
    fontSize: "14px", fontFamily: "inherit",
    background: "#f9fafb", color: "#111827",
    outline: "none", transition: "border-color .18s, box-shadow .18s",
    boxSizing: "border-box",
  };

  const focus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = "#16a34a";
    e.currentTarget.style.boxShadow   = "0 0 0 3px rgba(22,163,74,.1)";
    e.currentTarget.style.background  = "#fff";
  };
  const blur = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = "#e5e7eb";
    e.currentTarget.style.boxShadow   = "none";
    e.currentTarget.style.background  = "#f9fafb";
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=Outfit:wght@700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body, #root { height: 100%; }
        body { font-family: 'DM Sans', sans-serif; }
        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes fadeUp  { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        @keyframes float   { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-10px); } }
        .auth-page { display:grid; grid-template-columns:1fr 1fr; min-height:100vh; }
        .auth-left {
          background: linear-gradient(160deg,#f0fdf4 0%,#dcfce7 100%);
          display:flex; flex-direction:column; align-items:center; justify-content:center;
          padding:3rem 2.5rem; position:relative; overflow:hidden;
        }
        .auth-left::before {
          content:''; position:absolute; inset:0; pointer-events:none;
          background: radial-gradient(circle at 30% 70%,rgba(74,222,128,.22) 0%,transparent 55%),
                      radial-gradient(circle at 80% 15%,rgba(22,163,74,.14) 0%,transparent 50%);
        }
        .auth-illus { width:min(300px,80%); animation:float 4s ease-in-out infinite; z-index:1; }
        .auth-brand { text-align:center; z-index:1; margin-top:1.6rem; }
        .auth-brand h2 { font-family:'Outfit',sans-serif; font-size:clamp(1.4rem,2.2vw,1.9rem); font-weight:800; color:#14532d; letter-spacing:-.02em; line-height:1.15; }
        .auth-brand h2 span { color:#16a34a; }
        .auth-brand p { font-size:.87rem; color:#6b7280; margin:.55rem auto 0; line-height:1.55; max-width:270px; }
        .auth-dots { display:flex; gap:6px; justify-content:center; margin-top:1.4rem; }
        .auth-dot  { width:8px; height:8px; border-radius:50%; background:#d1fae5; }
        .auth-dot.on { width:22px; border-radius:4px; background:#16a34a; }
        .auth-right { background:#fff; display:flex; align-items:center; justify-content:center; padding:2.5rem 2rem; overflow-y:auto; }
        .auth-box { width:100%; max-width:420px; animation:fadeUp .45s ease both; }
        @media (max-width:900px) { .auth-page{grid-template-columns:1fr} .auth-left{display:none} .auth-right{padding:2rem 1.2rem} }
        @media (max-width:480px) { .role-grid{grid-template-columns:repeat(2,1fr)!important} }
      `}</style>

      <div className="auth-page">
        {/* ── LEFT ── */}
        <div className="auth-left">
          <div className="auth-illus">
            <svg viewBox="0 0 400 400" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="200" cy="200" r="170" fill="#d1fae5" opacity=".6"/>
              <circle cx="200" cy="200" r="130" fill="#bbf7d0" opacity=".5"/>
              <rect x="120" y="210" width="160" height="110" rx="4" fill="#15803d"/>
              <rect x="130" y="220" width="140" height="100" rx="3" fill="#166534"/>
              {[138,162,186,210,234,258].map((x,i)=><rect key={i} x={x} y="230" width="14" height="80" rx="3" fill="#4ade80"/>)}
              <polygon points="110,215 200,155 290,215" fill="#14532d"/>
              <polygon points="120,215 200,162 280,215" fill="#15803d"/>
              <ellipse cx="200" cy="162" rx="30" ry="18" fill="#16a34a"/>
              <ellipse cx="200" cy="155" rx="20" ry="12" fill="#4ade80"/>
              <rect x="198" y="120" width="4" height="38" rx="2" fill="#6b7280"/>
              <path d="M202 122 L228 128 L202 136 Z" fill="#f97316"/>
              <rect x="183" y="278" width="34" height="42" rx="4" fill="#052e16"/>
              <circle cx="200" cy="300" r="3" fill="#4ade80"/>
              <rect x="140" y="245" width="20" height="18" rx="3" fill="#052e16"/>
              <rect x="238" y="245" width="20" height="18" rx="3" fill="#052e16"/>
              <rect x="105" y="318" width="190" height="8" rx="2" fill="#14532d"/>
              <rect x="100" y="324" width="200" height="6" rx="2" fill="#166534"/>
              <circle cx="90"  cy="250" r="14" fill="#fbbf24"/>
              <rect x="82" y="264" width="16" height="28" rx="4" fill="#3b82f6"/>
              <circle cx="312" cy="248" r="14" fill="#fbbf24"/>
              <rect x="304" y="262" width="16" height="28" rx="4" fill="#15803d"/>
              <ellipse cx="312" cy="236" rx="17" ry="5" fill="#14532d"/>
              <path d="M60 170 L75 164 L90 170 L90 183 Q75 192 60 183 Z" fill="#4ade80" opacity=".8"/>
              <path d="M68 176 L73 181 L82 172" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              <polygon points="335,165 338,174 347,174 340,180 343,189 335,183 327,189 330,180 323,174 332,174" fill="#fbbf24" opacity=".85"/>
              <circle cx="310" cy="135" r="18" stroke="#4ade80" strokeWidth="2.5" fill="white" opacity=".85"/>
              <line x1="310" y1="122" x2="310" y2="135" stroke="#15803d" strokeWidth="2" strokeLinecap="round"/>
              <line x1="310" y1="135" x2="320" y2="135" stroke="#15803d" strokeWidth="2" strokeLinecap="round"/>
              <circle cx="310" cy="135" r="2.5" fill="#15803d"/>
              <circle cx="185" cy="370" r="5" fill="#9ca3af"/>
              <circle cx="200" cy="370" r="6" fill="#15803d"/>
              <circle cx="215" cy="370" r="5" fill="#9ca3af"/>
              <circle cx="229" cy="370" r="5" fill="#9ca3af"/>
            </svg>
          </div>
          <div className="auth-brand">
            <h2>Civic<span>Connect</span></h2>
            <p>Your trusted gateway to government services, complaint management & civic welfare.</p>
          </div>
          <div className="auth-dots">
            <div className="auth-dot"/><div className="auth-dot on"/><div className="auth-dot"/><div className="auth-dot"/>
          </div>
        </div>

        {/* ── RIGHT ── */}
        <div className="auth-right">
          <div className="auth-box">

            {/* Logo */}
            <div style={{display:"flex",alignItems:"center",gap:"12px",marginBottom:"28px"}}>
              <img src="/ap-bg.png" alt="AP" style={{width:"44px",height:"44px",objectFit:"contain",flexShrink:0}}/>
              <div>
                <div style={{fontFamily:"'Outfit',sans-serif",fontWeight:800,fontSize:"15px",color:"#111827",letterSpacing:"-.01em",lineHeight:1.2}}>
                  CivicConnect
                </div>
                <div style={{fontSize:"11px",fontWeight:500,color:"#6b7280"}}>Smart Governance & Citizen Services</div>
              </div>
            </div>

            <h1 style={{fontFamily:"'Outfit',sans-serif",fontSize:"clamp(1.5rem,3vw,2rem)",fontWeight:800,color:"#111827",letterSpacing:"-.03em",lineHeight:1.15,marginBottom:"4px"}}>
              Welcome Back 👋
            </h1>
            <p style={{fontSize:"14px",color:"#6b7280",marginBottom:"24px"}}>
              Sign in to your account
            </p>

            {/* Role tabs */}
            <div style={{fontSize:"11px",fontWeight:700,color:"#9ca3af",textTransform:"uppercase",letterSpacing:".08em",marginBottom:"10px"}}>
              I am a…
            </div>
            <div className="role-grid" style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"8px",marginBottom:"24px"}}>
              {ROLES.map(r => (
                <button key={r.id} type="button"
                  onClick={() => { setRole(r.id); setError(""); }}
                  style={{
                    display:"flex",flexDirection:"column",alignItems:"center",gap:"5px",
                    padding:"12px 6px",
                    border:`2px solid ${role===r.id ? "#16a34a" : "#e5e7eb"}`,
                    borderRadius:"13px",
                    background: role===r.id ? "linear-gradient(135deg,#f0fdf4,#dcfce7)" : "#fafafa",
                    cursor:"pointer",fontFamily:"inherit",
                    boxShadow: role===r.id ? "0 4px 14px rgba(22,163,74,.18)" : "none",
                    transition:"all .18s",
                  }}>
                  <span style={{fontSize:"22px"}}>{r.icon}</span>
                  <span style={{fontSize:"11.5px",fontWeight:700,color: role===r.id ? "#14532d" : "#6b7280"}}>{r.label}</span>
                </button>
              ))}
            </div>

            {/* Error */}
            {error && (
              <div style={{background:"#fef2f2",border:"1.5px solid #fca5a5",color:"#dc2626",fontSize:"13px",padding:"11px 14px",borderRadius:"10px",marginBottom:"16px",lineHeight:1.5}}>
                ⚠️ {error}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit}>
              {/* Email */}
              <div style={{marginBottom:"14px"}}>
                <label style={{display:"block",fontSize:"13px",fontWeight:700,color:"#374151",marginBottom:"6px"}}>
                  Email Address
                </label>
                <div style={{position:"relative"}}>
                  <span style={{position:"absolute",left:"12px",top:"50%",transform:"translateY(-50%)",color:"#9ca3af",pointerEvents:"none",display:"flex"}}>
                    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                      <polyline points="22,6 12,13 2,6"/>
                    </svg>
                  </span>
                  <input
                    type="email" value={email} onChange={e => { setEmail(e.target.value); setError(""); }}
                    placeholder="you@example.com" required autoComplete="email"
                    style={inputBase} onFocus={focus} onBlur={blur}
                  />
                </div>
              </div>

              {/* Password */}
              <div style={{marginBottom:"10px"}}>
                <label style={{display:"block",fontSize:"13px",fontWeight:700,color:"#374151",marginBottom:"6px"}}>
                  Password
                </label>
                <div style={{position:"relative"}}>
                  <span style={{position:"absolute",left:"12px",top:"50%",transform:"translateY(-50%)",color:"#9ca3af",pointerEvents:"none",display:"flex"}}>
                    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                  </span>
                  <input
                    type={showPwd ? "text" : "password"} value={password}
                    onChange={e => { setPassword(e.target.value); setError(""); }}
                    placeholder="••••••••" required autoComplete="current-password"
                    style={{...inputBase, paddingRight:"44px"}} onFocus={focus} onBlur={blur}
                  />
                  <button type="button" onClick={() => setShowPwd(v => !v)} tabIndex={-1}
                    style={{position:"absolute",right:"12px",top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:"#9ca3af",display:"flex",alignItems:"center",padding:"2px"}}>
                    {showPwd
                      ? <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                      : <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    }
                  </button>
                </div>
              </div>

              {/* Forgot */}
              <div style={{textAlign:"right",marginBottom:"22px"}}>
                <button type="button" onClick={() => navigate("/forgot-password")}
                  style={{fontSize:"13px",color:"#16a34a",fontWeight:600,background:"none",border:"none",cursor:"pointer",fontFamily:"inherit"}}>
                  Forgot password?
                </button>
              </div>

              {/* Submit */}
              <button type="submit" disabled={loading}
                style={{
                  width:"100%",padding:"13px",
                  background: loading ? "#d1d5db" : "linear-gradient(135deg,#14532d,#16a34a)",
                  color:"#fff",border:"none",borderRadius:"12px",
                  fontSize:"15px",fontWeight:700,cursor: loading ? "not-allowed" : "pointer",
                  fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:"10px",
                  boxShadow: loading ? "none" : "0 4px 16px rgba(22,163,74,.35)",
                  transition:"all .2s",
                }}>
                {loading && (
                  <span style={{width:"18px",height:"18px",border:"2.5px solid rgba(255,255,255,.35)",borderTopColor:"#fff",borderRadius:"50%",animation:"spin .7s linear infinite",display:"inline-block"}}/>
                )}
                {loading ? "Signing in…" : `Sign in as ${ROLES.find(r=>r.id===role)?.label}`}
              </button>
            </form>

            <p style={{textAlign:"center",fontSize:"13.5px",color:"#6b7280",marginTop:"20px"}}>
              Don't have an account?{" "}
              <a href="/register" style={{color:"#16a34a",fontWeight:700,textDecoration:"none"}}>Create one here</a>
            </p>

          </div>
        </div>
      </div>
    </>
  );
}