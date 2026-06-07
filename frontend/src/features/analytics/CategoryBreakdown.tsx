const DI:Record<string,string>={"Electricity":"⚡","Water Works":"💧","Sanitation":"🗑️","Roads & Infrastructure":"🛣️","Police":"👮","Fire Department":"🔥","General Civic":"🏛️"};
interface Props { complaints: any[]; }
export default function CategoryBreakdown({ complaints }: Props) {
  const dm:Record<string,number>={};
  complaints.forEach(c=>{const d=c.department||"General Civic";dm[d]=(dm[d]||0)+1;});
  const sorted=Object.entries(dm).sort((a,b)=>b[1]-a[1]);
  const max=sorted[0]?.[1]||1;
  return(
    <div>
      <div style={{fontSize:"13px",fontWeight:700,color:"#f1f5f9",marginBottom:"16px"}}>Category Breakdown</div>
      {!sorted.length?<div style={{color:"#475569",fontSize:"12px"}}>No data yet</div>:sorted.map(([dept,count])=>(
        <div key={dept} style={{marginBottom:"12px"}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:"4px"}}>
            <span style={{fontSize:"12px",color:"#94a3b8"}}>{DI[dept]||"🏛️"} {dept}</span>
            <span style={{fontSize:"12px",fontWeight:700,color:"#e2e8f0",fontFamily:"monospace"}}>{count}</span>
          </div>
          <div style={{background:"#1e293b",borderRadius:"6px",height:"5px",overflow:"hidden"}}>
            <div style={{height:"100%",width:`${(count/max)*100}%`,background:"linear-gradient(90deg,#7c3aed,#4f46e5)",borderRadius:"6px",transition:"width .8s"}}/>
          </div>
        </div>
      ))}
    </div>
  );
}