import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import StatusTimeline from "../../features/complaints/StatusTimeline";
import type { Complaint } from "../../types/complaint.types";

const DI:Record<string,string>={"Electricity":"⚡","Water Works":"💧","Sanitation":"🗑️","Roads & Infrastructure":"🛣️","Police":"👮","Fire Department":"🔥","General Civic":"🏛️"};
const SC:Record<string,{bg:string;text:string}> = {
  Pending:{bg:"#fef3c7",text:"#92400e"},Assigned:{bg:"#dbeafe",text:"#1e40af"},Resolved:{bg:"#d1fae5",text:"#065f46"},
};

export default function ComplaintDetail() {
  const { id } = useParams<{id:string}>();
  const [complaint, setComplaint] = useState<Complaint|null>(null);

  useEffect(()=>{
    try{
      const all = JSON.parse(localStorage.getItem("complaints_all")||"[]");
      setComplaint(all.find((c:Complaint)=>c.id===id)||null);
    }catch{}
  },[id]);

  if(!complaint)return(
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"system-ui,sans-serif"}}>
      <div style={{textAlign:"center"}}>
        <div style={{fontSize:"40px",marginBottom:"12px"}}>🔍</div>
        <div style={{fontSize:"16px",fontWeight:700,color:"#1e293b",marginBottom:"8px"}}>Complaint not found</div>
        <Link to="/my-complaints" style={{color:"#ea6800",fontWeight:600}}>← Back to My Complaints</Link>
      </div>
    </div>
  );

  return(
    <div style={{minHeight:"100vh",background:"#f8fafc",fontFamily:"'DM Sans',system-ui,sans-serif"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');*{box-sizing:border-box}`}</style>
      <div style={{background:"linear-gradient(135deg,#1a2a4a,#1e3a8a)",padding:"22px 28px"}}>
        <div style={{maxWidth:"760px",margin:"0 auto",display:"flex",alignItems:"center",gap:"12px"}}>
          <Link to="/my-complaints" style={{color:"rgba(255,255,255,.5)",display:"flex",alignItems:"center",padding:"6px",borderRadius:"8px",textDecoration:"none"}}>
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#fff" strokeWidth="2.5"><path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </Link>
          <div>
            <div style={{fontSize:"10px",color:"#f97316",fontWeight:700,letterSpacing:".1em"}}>COMPLAINT DETAIL</div>
            <h1 style={{fontSize:"20px",fontWeight:800,color:"#fff",margin:0}}>{complaint.title}</h1>
          </div>
        </div>
      </div>
      <div style={{maxWidth:"760px",margin:"0 auto",padding:"22px 28px",display:"flex",flexDirection:"column",gap:"14px"}}>
        {/* Status + meta */}
        <div style={{background:"#fff",border:"1.5px solid #e2e8f0",borderRadius:"14px",padding:"18px 20px"}}>
          <div style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"14px",flexWrap:"wrap"}}>
            <span style={{display:"inline-flex",alignItems:"center",gap:"5px",padding:"4px 12px",borderRadius:"20px",fontSize:"12px",fontWeight:700,background:SC[complaint.status]?.bg,color:SC[complaint.status]?.text}}>
              ● {complaint.status}
            </span>
            <span style={{fontSize:"12px",color:"#94a3b8",fontFamily:"monospace"}}>{complaint.ticketId}</span>
            <span style={{fontSize:"12px",color:"#94a3b8"}}>{DI[complaint.department]||"🏛️"} {complaint.department}</span>
          </div>
          <StatusTimeline complaint={complaint}/>
        </div>

        {/* Description */}
        <div style={{background:"#fff",border:"1.5px solid #e2e8f0",borderRadius:"14px",padding:"18px 20px"}}>
          <div style={{fontSize:"11px",color:"#94a3b8",fontWeight:700,letterSpacing:".06em",marginBottom:"8px"}}>DESCRIPTION</div>
          <div style={{fontSize:"13.5px",color:"#334155",lineHeight:1.7}}>{complaint.description}</div>
        </div>

        {/* Location + meta */}
        <div style={{background:"#fff",border:"1.5px solid #e2e8f0",borderRadius:"14px",padding:"18px 20px"}}>
          <div style={{fontSize:"11px",color:"#94a3b8",fontWeight:700,letterSpacing:".06em",marginBottom:"10px"}}>DETAILS</div>
          <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
            {[
              {icon:"📍",label:"Location",val:complaint.address},
              {icon:"🕐",label:"Submitted",val:new Date(complaint.createdAt).toLocaleString("en-IN")},
              ...(complaint.resolvedAt?[{icon:"✅",label:"Resolved",val:new Date(complaint.resolvedAt).toLocaleString("en-IN")}]:[]),
              ...(complaint.resolvedBy?[{icon:"👷",label:"Resolved by",val:complaint.resolvedBy}]:[]),
            ].map(row=>(
              <div key={row.label} style={{display:"flex",gap:"10px",padding:"9px 12px",background:"#f8fafc",borderRadius:"9px"}}>
                <span style={{fontSize:"15px",flexShrink:0}}>{row.icon}</span>
                <div>
                  <div style={{fontSize:"10px",color:"#94a3b8",fontWeight:600}}>{row.label.toUpperCase()}</div>
                  <div style={{fontSize:"13px",color:"#334155"}}>{row.val}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Photo */}
        {complaint.image&&(
          <div style={{background:"#fff",border:"1.5px solid #e2e8f0",borderRadius:"14px",padding:"18px 20px"}}>
            <div style={{fontSize:"11px",color:"#94a3b8",fontWeight:700,letterSpacing:".06em",marginBottom:"10px"}}>PHOTO EVIDENCE</div>
            <img src={complaint.image} alt="Evidence" style={{width:"100%",maxHeight:"300px",objectFit:"cover",borderRadius:"10px",border:"1px solid #e2e8f0"}}/>
          </div>
        )}
      </div>
    </div>
  );
}