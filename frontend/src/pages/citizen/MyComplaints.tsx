import { useState } from "react";
import { useSelector } from "react-redux";
import type { RootState } from "../../store";
import { Link } from "react-router-dom";

const SC:Record<string,{bg:string;text:string;dot:string}> = {
  Pending: {bg:"#fef3c7",text:"#92400e",dot:"#f59e0b"},
  Assigned:{bg:"#dbeafe",text:"#1e40af",dot:"#3b82f6"},
  Resolved:{bg:"#d1fae5",text:"#065f46",dot:"#10b981"},
};
const DI:Record<string,string>={"Electricity":"⚡","Water Works":"💧","Sanitation":"🗑️","Roads & Infrastructure":"🛣️","Police":"👮","Fire Department":"🔥","General Civic":"🏛️"};
type SF="All"|"Pending"|"Assigned"|"Resolved";

export default function MyComplaints(){
  const user = useSelector((s:RootState)=>s.auth.user);
  const [sf,setSf]=useState<SF>("All");
  const [q,setQ]=useState("");

  const allC = (()=>{try{return JSON.parse(localStorage.getItem(`complaints_${user?.id}`)||"[]");}catch{return [];}})();
  const filtered = allC.filter((c:any)=>{
    const ms = sf==="All"||c.status===sf;
    const mq = !q||[c.title,c.ticketId,c.description].some((v:string)=>v?.toLowerCase().includes(q.toLowerCase()));
    return ms&&mq;
  });
  const total=allC.length, pending=allC.filter((c:any)=>c.status==="Pending").length,
    assigned=allC.filter((c:any)=>c.status==="Assigned").length, resolved=allC.filter((c:any)=>c.status==="Resolved").length;

  return(
    <div style={{minHeight:"100vh",background:"#f8fafc",fontFamily:"'DM Sans',system-ui,sans-serif"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');*{box-sizing:border-box}
      .crd{background:#fff;border:1.5px solid #e2e8f0;border-radius:14px;padding:16px 18px;transition:all .2s}.crd:hover{border-color:#f97316;box-shadow:0 4px 16px rgba(249,115,22,.1);transform:translateY(-1px)}
      .badge{display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700}
      .sf{padding:7px 14px;border-radius:9px;border:1.5px solid;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;transition:all .15s}
      .si{background:#fff;border:1.5px solid #e2e8f0;border-radius:10px;padding:9px 14px 9px 36px;font-size:13px;color:#1e293b;outline:none;font-family:inherit;width:100%;transition:border-color .2s}
      .si:focus{border-color:#f97316}`}</style>

      {/* Header */}
      <div style={{background:"linear-gradient(135deg,#1a2a4a,#1e3a8a)",padding:"24px 28px"}}>
        <div style={{maxWidth:"860px",margin:"0 auto",display:"flex",alignItems:"center",gap:"14px"}}>
          <Link to="/dashboard" style={{color:"rgba(255,255,255,.5)",display:"flex",alignItems:"center",padding:"6px",borderRadius:"8px",transition:"all .2s",textDecoration:"none"}}
            onMouseEnter={e=>(e.currentTarget as HTMLAnchorElement).style.background="rgba(255,255,255,.1)"}
            onMouseLeave={e=>(e.currentTarget as HTMLAnchorElement).style.background="transparent"}>
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#fff" strokeWidth="2.5"><path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </Link>
          <div>
            <div style={{fontSize:"11px",color:"#f97316",fontWeight:700,letterSpacing:".1em",marginBottom:"2px"}}>MY COMPLAINTS</div>
            <h1 style={{fontSize:"22px",fontWeight:800,color:"#fff",margin:0}}>Complaint History</h1>
          </div>
        </div>
      </div>

      <div style={{maxWidth:"860px",margin:"0 auto",padding:"22px 28px"}}>
        {/* Stats */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"12px",marginBottom:"20px"}}>
          {[{l:"Total",v:total,c:"#3b82f6"},{l:"Pending",v:pending,c:"#f59e0b"},{l:"Assigned",v:assigned,c:"#8b5cf6"},{l:"Resolved",v:resolved,c:"#10b981"}].map(s=>(
            <div key={s.l} style={{background:"#fff",border:"1.5px solid #e2e8f0",borderRadius:"12px",padding:"14px 16px",textAlign:"center"}}>
              <div style={{fontSize:"26px",fontWeight:900,color:s.c,fontFamily:"'DM Mono',monospace"}}>{s.v}</div>
              <div style={{fontSize:"11.5px",color:"#64748b",marginTop:"2px"}}>{s.l}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{display:"flex",gap:"8px",marginBottom:"14px",flexWrap:"wrap",alignItems:"center"}}>
          <div style={{position:"relative",flex:1,minWidth:"180px"}}>
            <svg style={{position:"absolute",left:"11px",top:"50%",transform:"translateY(-50%)"}} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input className="si" placeholder="Search complaints…" value={q} onChange={e=>setQ(e.target.value)}/>
          </div>
          <div style={{display:"flex",gap:"5px"}}>
            {(["All","Pending","Assigned","Resolved"] as SF[]).map(s=>(
              <button key={s} className="sf" onClick={()=>setSf(s)} style={{
                background:sf===s?(s==="All"?"#1d4ed8":s==="Pending"?"#92400e":s==="Assigned"?"#1e40af":"#065f46"):"#fff",
                color:sf===s?"#fff":(s==="Pending"?"#92400e":s==="Assigned"?"#1e40af":s==="Resolved"?"#065f46":"#475569"),
                borderColor:sf===s?"transparent":(s==="Pending"?"#fde68a":s==="Assigned"?"#bfdbfe":s==="Resolved"?"#a7f3d0":"#e2e8f0"),
              }}>{s}</button>
            ))}
          </div>
        </div>

        <div style={{fontSize:"11.5px",color:"#94a3b8",marginBottom:"10px"}}>{filtered.length} complaint{filtered.length!==1?"s":""}</div>

        {/* List */}
        {!filtered.length?(
          <div style={{textAlign:"center",padding:"64px 24px",background:"#fff",borderRadius:"16px",border:"1.5px dashed #e2e8f0"}}>
            <div style={{fontSize:"40px",marginBottom:"12px"}}>📭</div>
            <div style={{fontSize:"16px",fontWeight:700,color:"#1e293b",marginBottom:"6px"}}>No complaints {sf!=="All"?`with status "${sf}"`:"yet"}</div>
            <div style={{fontSize:"13px",color:"#64748b",marginBottom:"18px"}}>Your submitted complaints will appear here</div>
            <Link to="/submit-complaint" style={{display:"inline-flex",alignItems:"center",gap:"6px",padding:"10px 20px",background:"linear-gradient(135deg,#c2410c,#ea580c)",color:"#fff",borderRadius:"10px",fontWeight:700,fontSize:"13.5px",textDecoration:"none"}}>
              + Submit a Complaint
            </Link>
          </div>
        ):(
          <div style={{display:"flex",flexDirection:"column",gap:"10px"}}>
            {filtered.map((c:any)=>(
              <div key={c.id} className="crd">
                <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:"12px",flexWrap:"wrap"}}>
                  <div style={{flex:1,minWidth:"180px"}}>
                    <div style={{display:"flex",alignItems:"center",gap:"7px",marginBottom:"6px",flexWrap:"wrap"}}>
                      <span className="badge" style={{background:SC[c.status]?.bg,color:SC[c.status]?.text}}>
                        <span style={{width:"5px",height:"5px",borderRadius:"50%",background:SC[c.status]?.dot,display:"inline-block"}}/>
                        {c.status}
                      </span>
                      <span style={{fontSize:"10.5px",color:"#94a3b8",fontFamily:"'DM Mono',monospace"}}>{c.ticketId}</span>
                      {c.department&&<span style={{fontSize:"10.5px",color:"#94a3b8"}}>{DI[c.department]||"🏛️"} {c.department}</span>}
                    </div>
                    <div style={{fontSize:"14.5px",fontWeight:700,color:"#1e293b",marginBottom:"4px"}}>{c.title}</div>
                    {c.description&&<div style={{fontSize:"12.5px",color:"#64748b",lineHeight:1.5,marginBottom:"6px"}}>{c.description.slice(0,100)}{c.description.length>100?"…":""}</div>}
                    <div style={{display:"flex",gap:"12px",flexWrap:"wrap"}}>
                      {c.address&&<span style={{fontSize:"11.5px",color:"#94a3b8"}}>📍 {c.address.slice(0,60)}{c.address.length>60?"…":""}</span>}
                      <span style={{fontSize:"11.5px",color:"#94a3b8"}}>🕐 {new Date(c.createdAt).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"})}</span>
                    </div>
                  </div>
                  {c.image&&<img src={c.image} alt="Evidence" style={{width:"72px",height:"72px",borderRadius:"10px",objectFit:"cover",border:"1px solid #e2e8f0",flexShrink:0}}/>}
                </div>
                {c.status==="Resolved"&&(
                  <div style={{marginTop:"10px",padding:"8px 12px",background:"#d1fae5",borderRadius:"8px",fontSize:"12px",color:"#065f46",fontWeight:600}}>
                    ✅ Resolved on {c.resolvedAt?new Date(c.resolvedAt).toLocaleString("en-IN"):"—"}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* New complaint CTA */}
        {filtered.length>0&&(
          <div style={{textAlign:"center",marginTop:"24px"}}>
            <Link to="/submit-complaint" style={{display:"inline-flex",alignItems:"center",gap:"6px",padding:"10px 22px",background:"linear-gradient(135deg,#c2410c,#ea580c)",color:"#fff",borderRadius:"10px",fontWeight:700,fontSize:"13.5px",textDecoration:"none",boxShadow:"0 4px 14px rgba(194,65,12,.3)"}}>
              + Submit New Complaint
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}