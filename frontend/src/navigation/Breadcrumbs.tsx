import { Link, useLocation } from "react-router-dom";
const LABELS: Record<string,string> = {
  "dashboard":"Dashboard","submit-complaint":"Submit Complaint","my-complaints":"My Complaints",
  "admin-dashboard":"Admin Dashboard","officer-dashboard":"Officer Dashboard","worker-dashboard":"Worker Dashboard",
};
export default function Breadcrumbs() {
  const { pathname } = useLocation();
  const parts = pathname.split("/").filter(Boolean);
  return(
    <nav style={{display:"flex",alignItems:"center",gap:"6px",fontSize:"12.5px",color:"#94a3b8"}}>
      <Link to="/" style={{color:"#94a3b8",textDecoration:"none"}}>Home</Link>
      {parts.map((part,i)=>{
        const path="/"+parts.slice(0,i+1).join("/");
        const isLast=i===parts.length-1;
        return(
          <span key={path} style={{display:"flex",alignItems:"center",gap:"6px"}}>
            <span>/</span>
            {isLast
              ?<span style={{color:"#1e293b",fontWeight:600}}>{LABELS[part]||part}</span>
              :<Link to={path} style={{color:"#64748b",textDecoration:"none"}}>{LABELS[part]||part}</Link>}
          </span>
        );
      })}
    </nav>
  );
}