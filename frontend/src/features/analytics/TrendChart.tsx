/** TrendChart — pure CSS bar chart (no external deps). Shows complaint volume trend. */
interface Props { complaints: any[]; }
export default function TrendChart({ complaints }: Props) {
  // Group by day for last 7 days
  const days: { label:string; submitted:number; resolved:number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const ds = d.toDateString();
    days.push({
      label: d.toLocaleDateString("en-IN",{weekday:"short"}),
      submitted: complaints.filter(c=>new Date(c.createdAt).toDateString()===ds).length,
      resolved: complaints.filter(c=>c.status==="Resolved"&&new Date(c.createdAt).toDateString()===ds).length,
    });
  }
  const maxVal = Math.max(...days.map(d=>d.submitted), 1);
  return(
    <div>
      <div style={{fontSize:"13px",fontWeight:700,color:"#f1f5f9",marginBottom:"16px"}}>7-Day Trend</div>
      <div style={{display:"flex",alignItems:"flex-end",gap:"8px",height:"100px"}}>
        {days.map((d,i)=>(
          <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:"4px",height:"100%",justifyContent:"flex-end"}}>
            <div style={{width:"100%",display:"flex",gap:"2px",alignItems:"flex-end",height:`${(d.submitted/maxVal)*80}px`,minHeight:"4px"}}>
              <div style={{flex:1,background:"#4f46e5",borderRadius:"3px 3px 0 0",height:"100%",minHeight:"4px"}} title={`Submitted: ${d.submitted}`}/>
              <div style={{flex:1,background:"#4ade80",borderRadius:"3px 3px 0 0",height:`${d.resolved/Math.max(d.submitted,1)*100}%`,minHeight:d.resolved>0?"4px":"0"}} title={`Resolved: ${d.resolved}`}/>
            </div>
            <span style={{fontSize:"10px",color:"#475569"}}>{d.label}</span>
          </div>
        ))}
      </div>
      <div style={{display:"flex",gap:"14px",marginTop:"10px"}}>
        {[{c:"#4f46e5",l:"Submitted"},{c:"#4ade80",l:"Resolved"}].map(x=>(
          <div key={x.l} style={{display:"flex",alignItems:"center",gap:"5px",fontSize:"11px",color:"#475569"}}>
            <span style={{width:"10px",height:"10px",borderRadius:"2px",background:x.c,display:"inline-block"}}/>
            {x.l}
          </div>
        ))}
      </div>
    </div>
  );
}