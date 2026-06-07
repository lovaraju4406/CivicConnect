import type { Complaint } from "../../types/complaint.types";
const STAGES = ["Pending","Assigned","Resolved"] as const;
const STAGE_COLORS:Record<string,string>={"Pending":"#f59e0b","Assigned":"#3b82f6","Resolved":"#10b981"};
const STAGE_ICONS:Record<string,string>={"Pending":"⏳","Assigned":"🔧","Resolved":"✅"};
export default function StatusTimeline({complaint}:{complaint:Complaint}){
  const currentIdx = STAGES.indexOf(complaint.status as any);
  return(
    <div style={{padding:"12px 0"}}>
      <div style={{fontSize:"11px",color:"#94a3b8",fontWeight:700,letterSpacing:".06em",marginBottom:"12px"}}>PROGRESS TIMELINE</div>
      <div style={{display:"flex",alignItems:"center",gap:"0"}}>
        {STAGES.map((stage,i)=>{
          const done=i<=currentIdx, active=i===currentIdx;
          return(<div key={stage} style={{display:"flex",alignItems:"center",flex:i<STAGES.length-1?1:"none"}}>
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"4px"}}>
              <div style={{width:"36px",height:"36px",borderRadius:"50%",background:done?STAGE_COLORS[stage]:"#f1f5f9",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"16px",border:active?`3px solid ${STAGE_COLORS[stage]}`:"3px solid transparent",transition:"all .3s",boxShadow:active?`0 0 0 4px ${STAGE_COLORS[stage]}22`:"none"}}>
                {STAGE_ICONS[stage]}
              </div>
              <span style={{fontSize:"10.5px",fontWeight:done?700:400,color:done?STAGE_COLORS[stage]:"#94a3b8",whiteSpace:"nowrap"}}>{stage}</span>
            </div>
            {i<STAGES.length-1&&<div style={{flex:1,height:"3px",background:i<currentIdx?STAGE_COLORS[STAGES[i+1]]:"#e2e8f0",margin:"0 4px",marginBottom:"18px",borderRadius:"4px",transition:"background .3s"}}/>}
          </div>);
        })}
      </div>
    </div>
  );
}