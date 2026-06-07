import type { Complaint } from "../../types/complaint.types";
const DI:Record<string,string>={"Electricity":"⚡","Water Works":"💧","Sanitation":"🗑️","Roads & Infrastructure":"🛣️","Police":"👮","Fire Department":"🔥","General Civic":"🏛️"};
const PRIO:Record<string,string>={"Police":"🔴 High","Fire Department":"🔴 High","Electricity":"🟠 Medium","Water Works":"🟠 Medium","General Civic":"🟢 Low"};
interface Props { tasks: Complaint[]; onSelect?: (c:Complaint)=>void; selected?: string; }
export default function WorkerTaskList({tasks,onSelect,selected}:Props){
  if(!tasks.length)return(
    <div style={{textAlign:"center",padding:"48px",background:"#fff",borderRadius:"14px",border:"1.5px solid #d1fae5"}}>
      <div style={{fontSize:"32px",marginBottom:"8px"}}>🎉</div>
      <div style={{fontSize:"14px",fontWeight:600,color:"#065f46"}}>All caught up! No active tasks.</div>
    </div>
  );
  return(
    <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
      {tasks.map(c=>(
        <div key={c.id} onClick={()=>onSelect?.(c)} style={{background:"#fff",border:`1.5px solid ${selected===c.id?"#059669":"#d1fae5"}`,borderRadius:"13px",padding:"13px 15px",cursor:"pointer",transition:"all .2s",boxShadow:selected===c.id?"0 0 0 3px rgba(16,185,129,.15)":"none"}}
          onMouseEnter={e=>{if(selected!==c.id)(e.currentTarget as HTMLDivElement).style.borderColor="#059669";}}
          onMouseLeave={e=>{if(selected!==c.id)(e.currentTarget as HTMLDivElement).style.borderColor="#d1fae5";}}>
          <div style={{display:"flex",alignItems:"center",gap:"7px",marginBottom:"5px",flexWrap:"wrap"}}>
            <span style={{fontSize:"10.5px",color:"#94a3b8",fontFamily:"monospace"}}>{c.ticketId}</span>
            <span style={{fontSize:"10.5px",color:"#94a3b8"}}>{PRIO[c.department]||"🟢 Low"}</span>
          </div>
          <div style={{fontSize:"14px",fontWeight:700,color:"#1e293b",marginBottom:"3px"}}>{c.title}</div>
          <div style={{fontSize:"12px",color:"#64748b"}}>{DI[c.department]||"🏛️"} {c.department} · 📍 {(c.address||"—").slice(0,55)}{(c.address?.length||0)>55?"…":""}</div>
        </div>
      ))}
    </div>
  );
}