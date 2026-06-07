import type { Complaint } from "../../types/complaint.types";
const SC:Record<string,{bg:string;text:string;dot:string}> = {
  Pending:{bg:"#fef3c7",text:"#92400e",dot:"#f59e0b"},Assigned:{bg:"#dbeafe",text:"#1e40af",dot:"#3b82f6"},Resolved:{bg:"#d1fae5",text:"#065f46",dot:"#10b981"},
};
const DI:Record<string,string>={"Electricity":"⚡","Water Works":"💧","Sanitation":"🗑️","Roads & Infrastructure":"🛣️","Police":"👮","Fire Department":"🔥","General Civic":"🏛️"};
interface Props { complaint: Complaint; onClick?: ()=>void; selected?: boolean; }
export default function ComplaintCard({complaint:c,onClick,selected}:Props){
  return(
    <div onClick={onClick} style={{background:"#fff",border:`1.5px solid ${selected?"#3b82f6":"#e2e8f0"}`,borderRadius:"14px",padding:"14px 16px",cursor:"pointer",transition:"all .2s",boxShadow:selected?"0 0 0 3px rgba(59,130,246,.15)":"none"}}
      onMouseEnter={e=>{if(!selected)(e.currentTarget as HTMLDivElement).style.borderColor="#3b82f6";}}
      onMouseLeave={e=>{if(!selected)(e.currentTarget as HTMLDivElement).style.borderColor="#e2e8f0";}}>
      <div style={{display:"flex",alignItems:"center",gap:"7px",marginBottom:"6px",flexWrap:"wrap"}}>
        <span style={{display:"inline-flex",alignItems:"center",gap:"5px",padding:"3px 10px",borderRadius:"20px",fontSize:"11px",fontWeight:700,background:SC[c.status]?.bg,color:SC[c.status]?.text}}>
          <span style={{width:"5px",height:"5px",borderRadius:"50%",background:SC[c.status]?.dot,display:"inline-block"}}/>{c.status}
        </span>
        <span style={{fontSize:"10.5px",color:"#94a3b8",fontFamily:"monospace"}}>{c.ticketId}</span>
        {c.department&&<span style={{fontSize:"10.5px",color:"#94a3b8"}}>{DI[c.department]||"🏛️"} {c.department}</span>}
      </div>
      <div style={{fontSize:"14px",fontWeight:700,color:"#1e293b",marginBottom:"3px"}}>{c.title}</div>
      <div style={{fontSize:"12px",color:"#64748b"}}>👤 {c.userName||"Unknown"} · 📍 {(c.address||"—").slice(0,55)}{(c.address?.length||0)>55?"…":""}</div>
      <div style={{fontSize:"11px",color:"#94a3b8",marginTop:"3px"}}>{new Date(c.createdAt).toLocaleString("en-IN")}</div>
    </div>
  );
}