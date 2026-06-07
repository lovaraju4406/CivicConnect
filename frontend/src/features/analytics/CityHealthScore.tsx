/** CityHealthScore — Stub. Backend scoring engine required. */
interface Props { score?: number; }
export default function CityHealthScore({ score }: Props) {
  const s = score ?? 0;
  return(
    <div style={{background:"#111827",border:"1px solid #1e293b",borderRadius:"14px",padding:"20px",textAlign:"center"}}>
      <div style={{fontSize:"11px",color:"#475569",fontWeight:700,letterSpacing:".08em",marginBottom:"8px"}}>CITY HEALTH SCORE</div>
      {s>0?(
        <>
          <div style={{fontSize:"48px",fontWeight:900,color:s>=70?"#4ade80":s>=40?"#fb923c":"#f87171",fontFamily:"monospace"}}>{s}</div>
          <div style={{fontSize:"12px",color:"#475569",marginTop:"4px"}}>out of 100</div>
        </>
      ):(
        <div style={{fontSize:"12px",color:"#475569"}}>⚠️ Requires backend scoring engine</div>
      )}
    </div>
  );
}