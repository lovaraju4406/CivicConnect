interface Props { complaints: any[]; }
export default function DepartmentRanking({ complaints }: Props) {
  const dm:Record<string,{total:number;resolved:number}>={};
  complaints.forEach(c=>{
    const d=c.department||"General Civic";
    if(!dm[d])dm[d]={total:0,resolved:0};
    dm[d].total++; if(c.status==="Resolved")dm[d].resolved++;
  });
  const ranked=Object.entries(dm).map(([dept,{total,resolved}])=>({dept,total,resolved,rate:Math.round((resolved/total)*100)})).sort((a,b)=>b.rate-a.rate);
  return(
    <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
      {!ranked.length?<div style={{color:"#475569",fontSize:"12px"}}>No data yet</div>:ranked.map((r,i)=>(
        <div key={r.dept} style={{background:"#080c14",borderRadius:"10px",padding:"11px 14px",border:"1px solid #1a2234",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
            <span style={{fontSize:"14px",fontWeight:800,color:i===0?"#fbbf24":i===1?"#94a3b8":i===2?"#b45309":"#475569",fontFamily:"monospace",width:"20px"}}>{i+1}</span>
            <div>
              <div style={{fontSize:"12px",fontWeight:600,color:"#e2e8f0"}}>{r.dept}</div>
              <div style={{fontSize:"10.5px",color:"#475569"}}>{r.total} total · {r.resolved} resolved</div>
            </div>
          </div>
          <div style={{fontSize:"18px",fontWeight:800,fontFamily:"monospace",color:r.rate>=70?"#4ade80":r.rate>=40?"#fb923c":"#f87171"}}>{r.rate}%</div>
        </div>
      ))}
    </div>
  );
}