export default function MapLegend() {
  return(
    <div style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:"10px",padding:"12px 14px",boxShadow:"0 2px 8px rgba(0,0,0,.08)"}}>
      <div style={{fontSize:"11px",fontWeight:700,color:"#1e293b",marginBottom:"8px",letterSpacing:".04em"}}>LEGEND</div>
      {[{color:"#f59e0b",label:"Pending"},{color:"#3b82f6",label:"Assigned"},{color:"#10b981",label:"Resolved"}].map(x=>(
        <div key={x.label} style={{display:"flex",alignItems:"center",gap:"7px",marginBottom:"5px"}}>
          <span style={{width:"10px",height:"10px",borderRadius:"50%",background:x.color,display:"inline-block"}}/>
          <span style={{fontSize:"12px",color:"#475569"}}>{x.label}</span>
        </div>
      ))}
    </div>
  );
}