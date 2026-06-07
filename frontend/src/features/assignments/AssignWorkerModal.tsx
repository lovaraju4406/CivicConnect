import { useState } from "react";
interface Props { complaintId: string; complaintTitle: string; onAssign: (workerId:string,workerName:string)=>void; onClose: ()=>void; }
export default function AssignWorkerModal({complaintTitle,onAssign,onClose}:Props){
  const workers = (()=>{try{return JSON.parse(localStorage.getItem("ap_registered_users")||"[]").filter((u:any)=>u.role==="worker");}catch{return [];}})();
  const [selected,setSelected]=useState("");
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:"20px"}}>
      <div style={{background:"#fff",borderRadius:"18px",width:"100%",maxWidth:"420px",boxShadow:"0 24px 64px rgba(0,0,0,.2)",overflow:"hidden"}}>
        <div style={{background:"linear-gradient(135deg,#1e40af,#3b82f6)",padding:"18px 22px"}}>
          <div style={{fontSize:"14px",fontWeight:800,color:"#fff"}}>Assign to Worker</div>
          <div style={{fontSize:"12px",color:"rgba(255,255,255,.7)",marginTop:"2px"}}>{complaintTitle}</div>
        </div>
        <div style={{padding:"18px 22px"}}>
          {!workers.length?(
            <div style={{textAlign:"center",padding:"24px",color:"#64748b",fontSize:"13px"}}>No workers registered yet.</div>
          ):(
            <div style={{display:"flex",flexDirection:"column",gap:"8px",maxHeight:"260px",overflowY:"auto"}}>
              {workers.map((w:any)=>(
                <div key={w.id} onClick={()=>setSelected(w.id)} style={{display:"flex",alignItems:"center",gap:"10px",padding:"10px 12px",borderRadius:"10px",border:`1.5px solid ${selected===w.id?"#3b82f6":"#e2e8f0"}`,cursor:"pointer",background:selected===w.id?"#eff6ff":"#f8fafc",transition:"all .15s"}}>
                  <div style={{width:"36px",height:"36px",borderRadius:"50%",background:"#dbeafe",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"16px"}}>🔧</div>
                  <div>
                    <div style={{fontSize:"13px",fontWeight:700,color:"#1e293b"}}>{w.fullName||w.name}</div>
                    <div style={{fontSize:"11.5px",color:"#64748b"}}>{w.department||"Field Operations"} · {w.district||"All Areas"}</div>
                  </div>
                  {selected===w.id&&<span style={{marginLeft:"auto",color:"#3b82f6",fontSize:"16px"}}>✓</span>}
                </div>
              ))}
            </div>
          )}
          <div style={{display:"flex",gap:"10px",marginTop:"16px"}}>
            <button onClick={onClose} style={{flex:1,padding:"10px",borderRadius:"10px",border:"1.5px solid #e2e8f0",background:"#f8fafc",color:"#475569",fontSize:"13.5px",fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>Cancel</button>
            <button disabled={!selected} onClick={()=>{const w=workers.find((x:any)=>x.id===selected);if(w)onAssign(w.id,w.fullName||w.name);}} style={{flex:1,padding:"10px",borderRadius:"10px",border:"none",background:selected?"linear-gradient(135deg,#1e40af,#3b82f6)":"#e2e8f0",color:selected?"#fff":"#94a3b8",fontSize:"13.5px",fontWeight:700,cursor:selected?"pointer":"not-allowed",fontFamily:"inherit",transition:"all .2s"}}>
              Assign Worker
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}