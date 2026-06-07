

export default function Footer() {
  return (
    <footer style={{ background: "#0f172a", color: "#94a3b8", padding: "56px 5vw 28px" }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: "40px", marginBottom: "48px" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
                <img
                  src="/ap-bg.png"
                  alt="AP Seal"
                  style={{ width: "40px", height: "40px", objectFit: "contain", flexShrink: 0, opacity: 0.85 }}
                />
                <div>
                  <div style={{ fontSize: "14px", fontWeight: 800, color: "#fff" }}>CivicConnect</div>
                  <div style={{ fontSize: "10px", color: "#475569", letterSpacing: "0.06em" }}>LIVE • CIVICCONNECT PLATFORM</div>
                </div>
              </div>
              <p style={{ fontSize: "13px", lineHeight: 1.7, margin: "0 0 16px", maxWidth: "260px" }}>Empowering citizens through transparent, accessible, and responsive digital governance.</p>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {["🚨 112", "📞 1800-425-0082"].map(t => (
                  <span key={t} style={{ fontSize: "11px", fontWeight: 700, color: "#86efac", background: "rgba(22,163,74,0.15)", borderRadius: "6px", padding: "4px 10px", border: "1px solid rgba(22,163,74,0.2)" }}>{t}</span>
                ))}
              </div>
            </div>
            {[
              { title: "Portal", links: ["Report Issue", "Track Complaint", "Safety Alerts", "Emergency Contacts"] },
              { title: "Government", links: ["About City", "District Info", "Public Records", "Transparency"] },
              { title: "Support", links: ["Help Center", "Contact Us", "Privacy Policy", "Terms of Use"] },
            ].map(col => (
              <div key={col.title}>
                <div style={{ fontSize: "12px", fontWeight: 700, color: "#fff", letterSpacing: "0.1em", marginBottom: "16px" }}>{col.title.toUpperCase()}</div>
                {col.links.map(link => (
                  <a key={link} href="#" style={{ display: "block", fontSize: "13px", color: "#64748b", textDecoration: "none", marginBottom: "10px", transition: "color 0.2s" }}
                    onMouseEnter={e => (e.currentTarget).style.color = "#22c55e"}
                    onMouseLeave={e => (e.currentTarget).style.color = "#64748b"}>
                    {link}
                  </a>
                ))}
              </div>
            ))}
          </div>
          <div style={{ borderTop: "1px solid #1e293b", paddingTop: "24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
            <span style={{ fontSize: "12px" }}>© 2026 Smart Governance & Citizen Services Platform. All rights reserved.</span>
            <span style={{ fontSize: "12px" }}>Designed & developed for the citizens of National Civic Network 🇮🇳</span>
          </div>
        </div>
      </footer>
  );
}