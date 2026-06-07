import { useState } from "react";
import { useDispatch } from "react-redux";
import { useNavigate, Link } from "react-router-dom";
import { loginSuccess } from "../../store/authSlice";

type Role = "citizen" | "officer" | "worker";

interface FormData {
  name: string; email: string; phone: string;
  password: string; confirmPassword: string; role: Role;
}

const ROLE_INFO: Record<Role, { label: string; icon: string; desc: string }> = {
  citizen: { label: "Citizen",       icon: "👤", desc: "Report civic issues in your area" },
  officer: { label: "Field Officer", icon: "👮", desc: "Manage and assign complaints"      },
  worker:  { label: "Field Worker",  icon: "🔧", desc: "Resolve assigned tasks"            },
};

export default function RegisterForm() {
  const dispatch  = useDispatch();
  const navigate  = useNavigate();
  const [form, setForm]       = useState<FormData>({ name: "", email: "", phone: "", password: "", confirmPassword: "", role: "citizen" });
  const [errors, setErrors]   = useState<Partial<FormData>>({});
  const [loading, setLoading] = useState(false);
  const [showPass, setShowP]  = useState(false);

  const set = (k: keyof FormData, v: string) => setForm(f => ({ ...f, [k]: v }));

  const validate = (): boolean => {
    const e: Partial<FormData> = {};
    if (!form.name.trim() || form.name.trim().length < 2)          e.name = "Name must be at least 2 characters";
    if (!form.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/))           e.email = "Enter a valid email address";
    if (!form.phone.match(/^[6-9]\d{9}$/))                         e.phone = "Enter a valid 10-digit Indian mobile number";
    if (form.password.length < 6)                                  e.password = "Password must be at least 6 characters";
    if (form.password !== form.confirmPassword)                    e.confirmPassword = "Passwords do not match";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    await new Promise(r => setTimeout(r, 900)); // simulate API
    dispatch(loginSuccess({
      token: `demo-token-${Date.now()}`,
      user: { id: Date.now().toString(), name: form.name, email: form.email, phone: form.phone, role: form.role },
    }));
    const routes: Record<Role, string> = { citizen: "/dashboard", officer: "/officer-dashboard", worker: "/worker-dashboard" };
    navigate(routes[form.role]);
  };

  const inputStyle = (field: keyof FormData): React.CSSProperties => ({
    width: "100%", padding: "10px 12px", fontSize: "13.5px",
    border: `1.5px solid ${errors[field] ? "#ef4444" : "#e2e8f0"}`,
    borderRadius: "10px", outline: "none", fontFamily: "inherit",
    background: "#fff", color: "#1e293b", boxSizing: "border-box",
  });

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg,#fff7ed 0%,#fff 60%)", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 16px" }}>
      <div style={{ width: "100%", maxWidth: "440px" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <div style={{ fontSize: "36px", marginBottom: "8px" }}>🏛️</div>
          <h1 style={{ margin: 0, fontSize: "22px", fontWeight: 800, color: "#1e293b" }}>Create Account</h1>
          <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: "13px" }}>Join the Smart Civic Platform</p>
        </div>

        <div style={{ background: "#fff", borderRadius: "20px", padding: "28px 28px", boxShadow: "0 4px 24px rgba(0,0,0,.08)", border: "1.5px solid #f1f5f9" }}>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>

            {/* Role selection */}
            <div>
              <p style={{ margin: "0 0 8px", fontSize: "13px", fontWeight: 600, color: "#334155" }}>Register as</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
                {(Object.entries(ROLE_INFO) as [Role, typeof ROLE_INFO[Role]][]).map(([role, info]) => (
                  <button key={role} type="button" onClick={() => set("role", role)}
                    style={{
                      padding: "10px 4px", borderRadius: "10px", border: `1.5px solid ${form.role === role ? "#ea6800" : "#e2e8f0"}`,
                      background: form.role === role ? "#fff7ed" : "#f8fafc", cursor: "pointer",
                      display: "flex", flexDirection: "column", alignItems: "center", gap: "3px",
                    }}>
                    <span style={{ fontSize: "18px" }}>{info.icon}</span>
                    <span style={{ fontSize: "11px", fontWeight: 700, color: form.role === role ? "#ea6800" : "#475569" }}>{info.label}</span>
                  </button>
                ))}
              </div>
              <p style={{ margin: "6px 0 0", fontSize: "11.5px", color: "#94a3b8" }}>{ROLE_INFO[form.role].desc}</p>
            </div>

            {/* Name */}
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <label style={{ fontSize: "13px", fontWeight: 600, color: "#334155" }}>Full Name *</label>
              <input value={form.name} onChange={e => set("name", e.target.value)} placeholder="Your full name" style={inputStyle("name")} onFocus={e => (e.currentTarget.style.borderColor = "#ea6800")} onBlur={e => (e.currentTarget.style.borderColor = errors.name ? "#ef4444" : "#e2e8f0")} />
              {errors.name && <p style={{ fontSize: "11.5px", color: "#ef4444", margin: 0 }}>{errors.name}</p>}
            </div>

            {/* Email */}
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <label style={{ fontSize: "13px", fontWeight: 600, color: "#334155" }}>Email *</label>
              <input type="email" value={form.email} onChange={e => set("email", e.target.value)} placeholder="you@example.com" style={inputStyle("email")} onFocus={e => (e.currentTarget.style.borderColor = "#ea6800")} onBlur={e => (e.currentTarget.style.borderColor = errors.email ? "#ef4444" : "#e2e8f0")} />
              {errors.email && <p style={{ fontSize: "11.5px", color: "#ef4444", margin: 0 }}>{errors.email}</p>}
            </div>

            {/* Phone */}
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <label style={{ fontSize: "13px", fontWeight: 600, color: "#334155" }}>Mobile Number *</label>
              <input type="tel" value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="10-digit mobile number" maxLength={10} style={inputStyle("phone")} onFocus={e => (e.currentTarget.style.borderColor = "#ea6800")} onBlur={e => (e.currentTarget.style.borderColor = errors.phone ? "#ef4444" : "#e2e8f0")} />
              {errors.phone && <p style={{ fontSize: "11.5px", color: "#ef4444", margin: 0 }}>{errors.phone}</p>}
            </div>

            {/* Password */}
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <label style={{ fontSize: "13px", fontWeight: 600, color: "#334155" }}>Password *</label>
              <div style={{ position: "relative" }}>
                <input type={showPass ? "text" : "password"} value={form.password} onChange={e => set("password", e.target.value)} placeholder="Min 6 characters" style={{ ...inputStyle("password"), paddingRight: "38px" }} onFocus={e => (e.currentTarget.style.borderColor = "#ea6800")} onBlur={e => (e.currentTarget.style.borderColor = errors.password ? "#ef4444" : "#e2e8f0")} />
                <button type="button" onClick={() => setShowP(v => !v)} style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: "14px" }}>
                  {showPass ? "🙈" : "👁️"}
                </button>
              </div>
              {errors.password && <p style={{ fontSize: "11.5px", color: "#ef4444", margin: 0 }}>{errors.password}</p>}
            </div>

            {/* Confirm Password */}
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <label style={{ fontSize: "13px", fontWeight: 600, color: "#334155" }}>Confirm Password *</label>
              <input type="password" value={form.confirmPassword} onChange={e => set("confirmPassword", e.target.value)} placeholder="Re-enter your password" style={inputStyle("confirmPassword")} onFocus={e => (e.currentTarget.style.borderColor = "#ea6800")} onBlur={e => (e.currentTarget.style.borderColor = errors.confirmPassword ? "#ef4444" : "#e2e8f0")} />
              {errors.confirmPassword && <p style={{ fontSize: "11.5px", color: "#ef4444", margin: 0 }}>{errors.confirmPassword}</p>}
            </div>

            {/* Submit */}
            <button type="submit" disabled={loading} style={{ background: "#ea6800", color: "#fff", border: "none", borderRadius: "10px", padding: "12px", fontSize: "14px", fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1, fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", marginTop: "4px" }}>
              {loading && <span style={{ width: "14px", height: "14px", border: "2px solid rgba(255,255,255,.35)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin .6s linear infinite", display: "inline-block" }} />}
              {loading ? "Creating account…" : "Create Account"}
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </button>
          </form>

          <p style={{ textAlign: "center", marginTop: "18px", fontSize: "13px", color: "#64748b" }}>
            Already have an account?{" "}
            <Link to="/login" style={{ color: "#ea6800", fontWeight: 700, textDecoration: "none" }}>Sign In</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
