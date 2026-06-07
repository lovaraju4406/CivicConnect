import { Link } from "react-router-dom";
export default function NotFound(){
  return(
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'DM Sans',system-ui,sans-serif",background:"#f8fafc"}}>
      <div style={{textAlign:"center",padding:"48px",maxWidth:"480px"}}>
        <div style={{fontSize:"64px",fontWeight:900,color:"#e2e8f0",fontFamily:"monospace",lineHeight:1}}>404</div>
        <div style={{fontSize:"48px",margin:"12px 0"}}>🔍</div>
        <h1 style={{fontSize:"22px",fontWeight:800,color:"#1e293b",marginBottom:"8px"}}>Page Not Found</h1>
        <p style={{fontSize:"13px",color:"#64748b",marginBottom:"24px"}}>The page you're looking for doesn't exist or has been moved.</p>
        <Link to="/dashboard" style={{display:"inline-flex",alignItems:"center",gap:"6px",padding:"11px 24px",borderRadius:"10px",background:"linear-gradient(135deg,#c2410c,#ea580c)",color:"#fff",fontWeight:700,fontSize:"14px",textDecoration:"none"}}>
          ← Go to Dashboard
        </Link>
      </div>
    </div>
  );
}