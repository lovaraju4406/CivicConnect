import { useState } from "react";
import { useAuth } from "../hooks/useAuth";

export default function UserMenu() {
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const ROLE_COLORS: Record<string,string> = { citizen:"#f97316", officer:"#3b82f6", worker:"#22c55e", admin:"#a78bfa" };
  const color = ROLE_COLORS[user?.role||"citizen"];
  return(
    <div style={{position:"relative"}}>
      <button onClick={()=>setOpen(!open)} style={{display:"flex",alignItems:"center",gap:"8px",background:"rgba(255,255,255,.1)",border:"1px solid rgba(255,255,255,.2)",borderRadius:"10px",padding:"6px 12px",cursor:"pointer"}}>
        <div style={{width:"28px",height:"28px",borderRadius:"8px",background:color,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:800,fontSize:"12px"}}>
          {user?.name?.charAt(0).toUpperCase()||"U"}
        </div>
        <span style={{fontSize:"12px",fontWeight:700,color:"#fff"}}>{user?.name}</span>
      </button>
      {open&&(
        <>
          <div style={{position:"fixed",inset:0,zIndex:99}} onClick={()=>setOpen(false)}/>
          <div style={{position:"absolute",right:0,top:"calc(100% + 8px)",width:"190px",background:"#fff",border:"1px solid #e2e8f0",borderRadius:"12px",overflow:"hidden",boxShadow:"0 16px 48px rgba(0,0,0,.15)",zIndex:100}}>
            <div style={{padding:"12px 14px",borderBottom:"1px solid #f1f5f9"}}>
              <div style={{fontSize:"13px",fontWeight:700,color:"#1e293b"}}>{user?.name}</div>
              <div style={{fontSize:"11px",color:color,textTransform:"capitalize"}}>{user?.role}</div>
            </div>
            <button onClick={()=>{setOpen(false);signOut();}} style={{width:"100%",padding:"11px 14px",background:"none",border:"none",color:"#ef4444",fontSize:"13px",fontWeight:600,cursor:"pointer",textAlign:"left",fontFamily:"inherit",display:"flex",alignItems:"center",gap:"8px"}}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
              Sign Out
            </button>
          </div>
        </>
      )}
    </div>
  );
}