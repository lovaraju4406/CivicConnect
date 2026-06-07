import { useState } from "react";
import { useDispatch } from "react-redux";
import { useNavigate, Link } from "react-router-dom";
import { loginSuccess } from "../../store/authSlice";

type Role = "citizen" | "officer" | "worker" | "admin";

const API = (import.meta as any).env?.VITE_API_URL ?? "http://localhost:3001/api";

const ROLES: { id: Role; label: string; icon: string; desc: string; path: string }[] = [
  { id: "citizen", label: "Citizen",  icon: "👤", desc: "Report civic issues & track complaints",    path: "/dashboard"          },
  { id: "officer", label: "Officer",  icon: "⚖️", desc: "Review, assign & resolve complaints",       path: "/officer-dashboard"  },
  { id: "worker",  label: "Worker",   icon: "🔧", desc: "Execute fieldwork & update status",         path: "/worker-dashboard"   },
  { id: "admin",   label: "Admin",    icon: "🛡️", desc: "Manage users & system operations",         path: "/admin-dashboard"    },
];

const DEPARTMENTS = [
  "Roads & Infrastructure","Water Works","Electricity","Sanitation",
  "Police","Fire Department","General Civic","Health","Revenue","Municipal",
];
const DISTRICTS = [
  "Visakhapatnam","Krishna","Guntur","East Godavari","West Godavari",
  "Kurnool","Kadapa","Nellore","Chittoor","Anantapur","Srikakulam",
  "Vizianagaram","Prakasam","Vijayawada",
];

export default function Register() {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const [role,    setRole]    = useState<Role>("citizen");
  const [step,    setStep]    = useState<1|2>(1);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const [success, setSuccess] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [agreed,  setAgreed]  = useState(false);

  const [form, setForm] = useState({
    name:         "",
    email:        "",
    phone:        "",
    password:     "",
    confirm:      "",
    district:     "",
    department:   "",
    designation:  "",
    badge_number: "",
    employee_id:  "",
  });

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setForm(p => ({ ...p, [k]: e.target.value }));
      setError("");
    };

  /* ── Password strength ── */
  const strength = () => {
    const p = form.password;
    return [p.length >= 8, /[A-Z]/.test(p), /[0-9]/.test(p), /[^a-zA-Z0-9]/.test(p)].filter(Boolean).length;
  };
  const STR_LBL = ["", "Weak", "Fair", "Good", "Strong"];
  const STR_CLR = ["", "#ef4444", "#f59e0b", "#3b82f6", "#22c55e"];

  /* ── Step 1 validation ── */
  const goStep2 = () => {
    if (!form.name.trim())                  { setError("Full name is required."); return; }
    if (!form.email.includes("@"))          { setError("Enter a valid email address."); return; }
    if (!form.phone.match(/^\d{10}$/))      { setError("Enter a valid 10-digit mobile number."); return; }
    if (form.password.length < 6)           { setError("Password must be at least 6 characters."); return; }
    if (form.password !== form.confirm)     { setError("Passwords do not match."); return; }
    setError("");
    setStep(2);
  };

  /* ── Final submit — calls real backend ── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreed) { setError("Please agree to the Terms & Conditions."); return; }

    // Role-specific required fields
    if ((role === "officer" || role === "worker" || role === "admin") && !form.department) {
      setError("Please select your department."); return;
    }
    if (!form.district) { setError("Please select your district."); return; }

    setLoading(true);
    setError("");

    const payload: Record<string, string | undefined> = {
      name:         form.name.trim(),
      email:        form.email.trim().toLowerCase(),
      phone:        form.phone.trim(),
      password:     form.password,
      role,
      district:     form.district     || undefined,
      department:   form.department   || undefined,
      designation:  form.designation  || undefined,
      badge_number: form.badge_number || undefined,
      employee_id:  form.employee_id  || undefined,
    };
    // Remove undefined keys
    Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);

    try {
      const res  = await fetch(`${API}/auth/register`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      });
      const data = await res.json();

      if (!data.success) {
        setError(data.message || "Registration failed. Please try again.");
        setLoading(false);
        return;
      }

      // Auto-login after successful registration
      const { token, user } = data.data;
      localStorage.setItem("auth", JSON.stringify({ token, user }));
      dispatch(loginSuccess({ token, user }));

      setSuccess("Account created successfully! Redirecting…");
      await new Promise(r => setTimeout(r, 900));

      const found = ROLES.find(r => r.id === user.role);
      navigate(found?.path ?? "/dashboard", { replace: true });

    } catch {
      setError("Cannot connect to server. Please make sure the backend is running on port 3001.");
    }

    setLoading(false);
  };

  /* ── Shared input styles ── */
  const inp: React.CSSProperties = {
    width: "100%", padding: "11px 12px 11px 40px",
    border: "2px solid #e5e7eb", borderRadius: "11px",
    fontSize: "14px", fontFamily: "inherit",
    background: "#f9fafb", color: "#111827",
    outline: "none", transition: "border-color .18s, box-shadow .18s",
    boxSizing: "border-box",
  };
  const sel: React.CSSProperties = { ...inp, paddingLeft: "12px", cursor: "pointer", appearance: "none" as any };
  const lbl: React.CSSProperties = { display: "block", fontSize: "13px", fontWeight: 700, color: "#374151", marginBottom: "6px" };

  const onFocus = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    e.currentTarget.style.borderColor = "#16a34a";
    e.currentTarget.style.boxShadow   = "0 0 0 3px rgba(22,163,74,.1)";
    e.currentTarget.style.background  = "#fff";
  };
  const onBlur = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    e.currentTarget.style.borderColor = "#e5e7eb";
    e.currentTarget.style.boxShadow   = "none";
    e.currentTarget.style.background  = "#f9fafb";
  };

  const roleCfg = ROLES.find(r => r.id === role)!;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=Outfit:wght@700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body, #root { height: 100%; }
        body { font-family: 'DM Sans', sans-serif; }
        @keyframes spin   { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        @keyframes float  { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-10px); } }
        .rg-page  { display:grid; grid-template-columns:1fr 1fr; min-height:100vh; }
        .rg-left  {
          background: linear-gradient(160deg,#f0fdf4 0%,#dcfce7 100%);
          display:flex; flex-direction:column; align-items:center; justify-content:center;
          padding:3rem 2.5rem; position:relative; overflow:hidden;
        }
        .rg-left::before {
          content:''; position:absolute; inset:0; pointer-events:none;
          background: radial-gradient(circle at 30% 70%,rgba(74,222,128,.22) 0%,transparent 55%),
                      radial-gradient(circle at 80% 15%,rgba(22,163,74,.14) 0%,transparent 50%);
        }
        .rg-illus { width:min(290px,78%); animation:float 4s ease-in-out infinite; z-index:1; }
        .rg-brand { text-align:center; z-index:1; margin-top:1.5rem; }
        .rg-brand h2 { font-family:'Outfit',sans-serif; font-size:clamp(1.35rem,2.1vw,1.85rem); font-weight:800; color:#14532d; letter-spacing:-.02em; line-height:1.15; }
        .rg-brand h2 span { color:#16a34a; }
        .rg-brand p { font-size:.86rem; color:#6b7280; margin:.5rem auto 0; line-height:1.55; max-width:270px; }
        .rg-dots { display:flex; gap:6px; justify-content:center; margin-top:1.3rem; }
        .rg-dot   { width:8px; height:8px; border-radius:50%; background:#d1fae5; }
        .rg-dot.on { width:22px; border-radius:4px; background:#16a34a; }
        .rg-right { background:#fff; display:flex; align-items:flex-start; justify-content:center; padding:2rem; overflow-y:auto; }
        .rg-box   { width:100%; max-width:430px; padding:.5rem 0 2rem; animation:fadeUp .45s ease both; }
        .role-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; }
        @media (max-width:900px) { .rg-page{grid-template-columns:1fr} .rg-left{display:none} .rg-right{padding:1.5rem 1rem} }
        @media (max-width:480px) { .role-grid{grid-template-columns:repeat(2,1fr)!important} }
      `}</style>

      <div className="rg-page">
        {/* ── LEFT ── */}
        <div className="rg-left">
          <div className="rg-illus">
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
          <div className="rg-brand">
            <h2>Civic<span>Connect</span></h2>
            <p>Join thousands of citizens making National Civic Network a better place to live.</p>
          </div>
          <div className="rg-dots">
            <div className="rg-dot"/><div className="rg-dot on"/><div className="rg-dot"/><div className="rg-dot"/>
          </div>
        </div>

        {/* ── RIGHT ── */}
        <div className="rg-right">
          <div className="rg-box">

            {/* Logo */}
            <div style={{display:"flex",alignItems:"center",gap:"12px",marginBottom:"22px"}}>
              <img src="/ap-bg.png" alt="AP" style={{width:"44px",height:"44px",objectFit:"contain",flexShrink:0}}/>
              <div>
                <div style={{fontFamily:"'Outfit',sans-serif",fontWeight:800,fontSize:"15px",color:"#111827",letterSpacing:"-.01em",lineHeight:1.2}}>CivicConnect</div>
                <div style={{fontSize:"11px",fontWeight:500,color:"#6b7280"}}>Smart Governance & Citizen Services</div>
              </div>
            </div>

            <h1 style={{fontFamily:"'Outfit',sans-serif",fontSize:"clamp(1.45rem,2.8vw,1.9rem)",fontWeight:800,color:"#111827",letterSpacing:"-.03em",lineHeight:1.15,marginBottom:"4px"}}>
              Create Account ✨
            </h1>
            <p style={{fontSize:"14px",color:"#6b7280",marginBottom:"20px"}}>
              Already registered?{" "}
              <Link to="/login" style={{color:"#16a34a",fontWeight:700,textDecoration:"none"}}>Sign in here</Link>
            </p>

            {/* Role selector */}
            <div style={{fontSize:"11px",fontWeight:700,color:"#9ca3af",textTransform:"uppercase",letterSpacing:".08em",marginBottom:"8px"}}>
              I am registering as…
            </div>
            <div className="role-grid" style={{marginBottom:"10px"}}>
              {ROLES.map(r => (
                <button key={r.id} type="button"
                  onClick={() => { setRole(r.id); setStep(1); setError(""); }}
                  style={{
                    display:"flex",flexDirection:"column",alignItems:"center",gap:"5px",
                    padding:"11px 4px",
                    border:`2px solid ${role===r.id ? "#16a34a" : "#e5e7eb"}`,
                    borderRadius:"12px",
                    background: role===r.id ? "linear-gradient(135deg,#f0fdf4,#dcfce7)" : "#fafafa",
                    cursor:"pointer",fontFamily:"inherit",transition:"all .18s",
                    boxShadow: role===r.id ? "0 3px 12px rgba(22,163,74,.18)" : "none",
                  }}>
                  <span style={{fontSize:"20px"}}>{r.icon}</span>
                  <span style={{fontSize:"11px",fontWeight:700,color: role===r.id ? "#14532d" : "#6b7280"}}>{r.label}</span>
                </button>
              ))}
            </div>
            <div style={{fontSize:"12px",color:"#6b7280",marginBottom:"18px",padding:"8px 12px",background:"#f0fdf4",borderRadius:"8px",border:"1px solid #bbf7d0"}}>
              ℹ️ {roleCfg.desc}
            </div>

            {/* Step progress */}
            <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"20px"}}>
              {[1,2].map(s => (
                <div key={s} style={{display:"flex",alignItems:"center",gap:"6px"}}>
                  <div style={{
                    width:"26px",height:"26px",borderRadius:"50%",
                    display:"flex",alignItems:"center",justifyContent:"center",
                    fontSize:"12px",fontWeight:700,flexShrink:0,transition:"all .3s",
                    background: step >= s ? "linear-gradient(135deg,#14532d,#16a34a)" : "#f1f5f9",
                    color:      step >= s ? "#fff" : "#9ca3af",
                    border:     step >= s ? "none" : "2px solid #e5e7eb",
                    boxShadow:  step === s ? "0 2px 8px rgba(22,163,74,.3)" : "none",
                  }}>
                    {step > s ? "✓" : s}
                  </div>
                  <span style={{fontSize:"12.5px",fontWeight:600,color: step >= s ? "#111827" : "#9ca3af"}}>
                    {s === 1 ? "Personal Info" : "Role Details"}
                  </span>
                  {s < 2 && (
                    <div style={{height:"2px",width:"30px",borderRadius:"2px",background: step > 1 ? "#16a34a" : "#e5e7eb",transition:"background .3s"}}/>
                  )}
                </div>
              ))}
              <span style={{marginLeft:"auto",fontSize:"11px",color:"#9ca3af",background:"#f9fafb",border:"1px solid #e5e7eb",padding:"2px 10px",borderRadius:"20px"}}>
                {step}/2
              </span>
            </div>

            {/* Alerts */}
            {success && (
              <div style={{background:"#f0fdf4",border:"1.5px solid #86efac",color:"#15803d",fontSize:"13px",padding:"11px 14px",borderRadius:"10px",marginBottom:"14px",fontWeight:600}}>
                ✅ {success}
              </div>
            )}
            {error && (
              <div style={{background:"#fef2f2",border:"1.5px solid #fca5a5",color:"#dc2626",fontSize:"13px",padding:"11px 14px",borderRadius:"10px",marginBottom:"14px",lineHeight:1.5}}>
                ⚠️ {error}
              </div>
            )}

            {/* ══════════ STEP 1 ══════════ */}
            {step === 1 && (
              <div>
                {/* Full Name */}
                <div style={{marginBottom:"13px"}}>
                  <label style={lbl}>Full Name *</label>
                  <div style={{position:"relative"}}>
                    <span style={{position:"absolute",left:"12px",top:"50%",transform:"translateY(-50%)",color:"#9ca3af",pointerEvents:"none"}}>👤</span>
                    <input value={form.name} onChange={set("name")} placeholder="Your full name" style={inp} onFocus={onFocus} onBlur={onBlur}/>
                  </div>
                </div>

                {/* Email */}
                <div style={{marginBottom:"13px"}}>
                  <label style={lbl}>Email Address *</label>
                  <div style={{position:"relative"}}>
                    <span style={{position:"absolute",left:"12px",top:"50%",transform:"translateY(-50%)",color:"#9ca3af",pointerEvents:"none"}}>
                      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                    </span>
                    <input type="email" value={form.email} onChange={set("email")} placeholder="you@example.com" style={inp} onFocus={onFocus} onBlur={onBlur}/>
                  </div>
                </div>

                {/* Phone */}
                <div style={{marginBottom:"13px"}}>
                  <label style={lbl}>Mobile Number * (10 digits)</label>
                  <div style={{position:"relative"}}>
                    <span style={{position:"absolute",left:"12px",top:"50%",transform:"translateY(-50%)",color:"#9ca3af",pointerEvents:"none"}}>📱</span>
                    <input type="tel" value={form.phone} onChange={set("phone")} placeholder="9XXXXXXXXX" maxLength={10} style={inp} onFocus={onFocus} onBlur={onBlur}/>
                  </div>
                </div>

                {/* Password */}
                <div style={{marginBottom:"6px"}}>
                  <label style={lbl}>Password *</label>
                  <div style={{position:"relative"}}>
                    <span style={{position:"absolute",left:"12px",top:"50%",transform:"translateY(-50%)",color:"#9ca3af",pointerEvents:"none"}}>
                      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    </span>
                    <input type={showPwd?"text":"password"} value={form.password} onChange={set("password")} placeholder="Min 6 characters" style={{...inp,paddingRight:"44px"}} onFocus={onFocus} onBlur={onBlur}/>
                    <button type="button" onClick={() => setShowPwd(v=>!v)} tabIndex={-1}
                      style={{position:"absolute",right:"12px",top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:"#9ca3af",display:"flex",alignItems:"center",padding:"2px",fontSize:"16px"}}>
                      {showPwd ? "🙈" : "👁️"}
                    </button>
                  </div>
                </div>

                {/* Strength bar */}
                {form.password && (
                  <div style={{display:"flex",alignItems:"center",gap:"4px",marginBottom:"12px"}}>
                    {[1,2,3,4].map(i => (
                      <div key={i} style={{height:"3px",flex:1,borderRadius:"3px",background: i<=strength() ? STR_CLR[strength()] : "#e5e7eb",transition:"background .3s"}}/>
                    ))}
                    <span style={{fontSize:"11px",fontWeight:700,color:STR_CLR[strength()],marginLeft:"6px",minWidth:"32px"}}>{STR_LBL[strength()]}</span>
                  </div>
                )}

                {/* Confirm */}
                <div style={{marginBottom:"20px"}}>
                  <label style={lbl}>Confirm Password *</label>
                  <div style={{position:"relative"}}>
                    <span style={{position:"absolute",left:"12px",top:"50%",transform:"translateY(-50%)",color:"#9ca3af",pointerEvents:"none"}}>
                      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    </span>
                    <input type="password" value={form.confirm} onChange={set("confirm")} placeholder="Re-enter password" style={inp} onFocus={onFocus} onBlur={onBlur}/>
                  </div>
                  {form.confirm && form.password !== form.confirm && (
                    <p style={{fontSize:"12px",color:"#ef4444",marginTop:"5px"}}>⚠️ Passwords do not match</p>
                  )}
                </div>

                <button type="button" onClick={goStep2}
                  style={{width:"100%",padding:"13px",background:"linear-gradient(135deg,#14532d,#16a34a)",color:"#fff",border:"none",borderRadius:"12px",fontSize:"14.5px",fontWeight:700,cursor:"pointer",fontFamily:"inherit",boxShadow:"0 4px 16px rgba(22,163,74,.35)"}}>
                  Continue to Role Details →
                </button>
              </div>
            )}

            {/* ══════════ STEP 2 ══════════ */}
            {step === 2 && (
              <form onSubmit={handleSubmit}>

                {/* District — all roles */}
                <div style={{marginBottom:"13px"}}>
                  <label style={lbl}>District *</label>
                  <select value={form.district} onChange={set("district")} style={sel} onFocus={onFocus} onBlur={onBlur} required>
                    <option value="">Select your district</option>
                    {DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>

                {/* Department — officer, worker, admin */}
                {(role === "officer" || role === "worker" || role === "admin") && (
                  <div style={{marginBottom:"13px"}}>
                    <label style={lbl}>Department *</label>
                    <select value={form.department} onChange={set("department")} style={sel} onFocus={onFocus} onBlur={onBlur} required>
                      <option value="">Select department</option>
                      {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                )}

                {/* Designation — admin */}
                {role === "admin" && (
                  <div style={{marginBottom:"13px"}}>
                    <label style={lbl}>Designation</label>
                    <div style={{position:"relative"}}>
                      <span style={{position:"absolute",left:"12px",top:"50%",transform:"translateY(-50%)",color:"#9ca3af",pointerEvents:"none"}}>💼</span>
                      <input value={form.designation} onChange={set("designation")} placeholder="e.g. System Administrator" style={inp} onFocus={onFocus} onBlur={onBlur}/>
                    </div>
                  </div>
                )}

                {/* Badge number — officer */}
                {role === "officer" && (
                  <div style={{marginBottom:"13px"}}>
                    <label style={lbl}>Badge / Service Number</label>
                    <div style={{position:"relative"}}>
                      <span style={{position:"absolute",left:"12px",top:"50%",transform:"translateY(-50%)",color:"#9ca3af",pointerEvents:"none"}}>🪪</span>
                      <input value={form.badge_number} onChange={set("badge_number")} placeholder="AP-OFC-XXXX" style={inp} onFocus={onFocus} onBlur={onBlur}/>
                    </div>
                  </div>
                )}

                {/* Employee ID — worker / admin */}
                {(role === "worker" || role === "admin") && (
                  <div style={{marginBottom:"13px"}}>
                    <label style={lbl}>Employee ID</label>
                    <div style={{position:"relative"}}>
                      <span style={{position:"absolute",left:"12px",top:"50%",transform:"translateY(-50%)",color:"#9ca3af",pointerEvents:"none"}}>🪪</span>
                      <input value={form.employee_id} onChange={set("employee_id")} placeholder="AP-WRK-XXXX" style={inp} onFocus={onFocus} onBlur={onBlur}/>
                    </div>
                  </div>
                )}

                {/* Info note per role */}
                <div style={{padding:"10px 14px",background:"#f0fdf4",border:"1.5px solid #bbf7d0",borderRadius:"10px",marginBottom:"16px",fontSize:"12.5px",color:"#166534",lineHeight:1.6}}>
                  ℹ️{" "}
                  {role === "citizen"
                    ? "Your information is used only for identity verification and will not be shared with third parties."
                    : role === "officer"
                    ? "Officer accounts are linked to government records. Your badge number is used for verification."
                    : role === "worker"
                    ? "Your account will be activated after your supervisor verifies your Employee ID."
                    : "Admin accounts require verification against official records before full access is granted."}
                </div>

                {/* Terms checkbox */}
                <label style={{display:"flex",alignItems:"flex-start",gap:"10px",cursor:"pointer",marginBottom:"18px",userSelect:"none"}}>
                  <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} style={{display:"none"}}/>
                  <div style={{
                    width:"18px",height:"18px",borderRadius:"5px",flexShrink:0,marginTop:"1px",
                    border:`2px solid ${agreed ? "#16a34a" : "#e5e7eb"}`,
                    background: agreed ? "#16a34a" : "#f9fafb",
                    display:"flex",alignItems:"center",justifyContent:"center",transition:"all .2s",
                  }}>
                    {agreed && (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5">
                        <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                  <span style={{fontSize:"13px",color:"#6b7280",lineHeight:1.6}}>
                    I agree to the{" "}
                    <a href="#" onClick={e=>e.preventDefault()} style={{color:"#16a34a",fontWeight:700,textDecoration:"none"}}>Terms & Conditions</a>
                    {" "}and{" "}
                    <a href="#" onClick={e=>e.preventDefault()} style={{color:"#16a34a",fontWeight:700,textDecoration:"none"}}>Privacy Policy</a>
                  </span>
                </label>

                {/* Actions */}
                <div style={{display:"flex",gap:"10px"}}>
                  <button type="button" onClick={() => { setStep(1); setError(""); }}
                    style={{padding:"12px 18px",borderRadius:"11px",background:"#f1f5f9",border:"2px solid #e5e7eb",color:"#6b7280",fontSize:"14px",fontWeight:600,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:"6px"}}>
                    ← Back
                  </button>
                  <button type="submit" disabled={!agreed || loading}
                    style={{
                      flex:1,padding:"13px",
                      background: agreed && !loading ? "linear-gradient(135deg,#14532d,#16a34a)" : "#e5e7eb",
                      color:      agreed && !loading ? "#fff" : "#9ca3af",
                      border:"none",borderRadius:"11px",
                      fontSize:"14.5px",fontWeight:700,
                      cursor: agreed && !loading ? "pointer" : "not-allowed",
                      fontFamily:"inherit",
                      display:"flex",alignItems:"center",justifyContent:"center",gap:"8px",
                      boxShadow: agreed && !loading ? "0 4px 16px rgba(22,163,74,.35)" : "none",
                      transition:"all .2s",
                    }}>
                    {loading && (
                      <span style={{width:"16px",height:"16px",border:"2.5px solid rgba(255,255,255,.35)",borderTopColor:"#fff",borderRadius:"50%",animation:"spin .7s linear infinite",display:"inline-block"}}/>
                    )}
                    {loading ? "Creating account…" : `Register as ${roleCfg.label}`}
                  </button>
                </div>
              </form>
            )}

            <p style={{textAlign:"center",fontSize:"13.5px",color:"#6b7280",marginTop:"18px"}}>
              Already have an account?{" "}
              <Link to="/login" style={{color:"#16a34a",fontWeight:700,textDecoration:"none"}}>Sign In</Link>
            </p>

          </div>
        </div>
      </div>
    </>
  );
}