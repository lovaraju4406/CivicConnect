import { useState, useEffect, useMemo } from "react";
import { useSelector, useDispatch } from "react-redux";
import type { RootState } from "../../store";
import { logout } from "../../store/authSlice";
import { useNavigate } from "react-router-dom";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Complaint {
  id: string; ticketId?: string; title?: string; category?: string;
  description?: string; status: string; department?: string;
  userName?: string; userId?: string; address?: string;
  createdAt: string; updatedAt?: string; priority?: string;
  assignedOfficer?: string; emergency?: boolean; lat?: number; lng?: number;
}
interface User {
  id: string; name: string; email: string; phone?: string;
  role: "citizen"|"officer"|"worker"|"admin"; department?: string;
  createdAt?: string; active?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const ls = (k:string, fb:any=null) => { try{const r=localStorage.getItem(k);return r?JSON.parse(r):fb;}catch{return fb;} };
const lsSet = (k:string, v:any) => { try{localStorage.setItem(k,JSON.stringify(v));}catch{} };
const ADMIN_API = "http://localhost:3001/api";
const adminFetch = async (path:string, opts:RequestInit={}) => {
  const token = JSON.parse(localStorage.getItem("auth")||"{}").token;
  return fetch(`${ADMIN_API}${path}`, {
    ...opts,
    headers:{ "Content-Type":"application/json", Authorization:`Bearer ${token}`, ...(opts.headers as any||{}) }
  });
};

const DEPT_COLORS: Record<string,string> = {
  "Water Works":"#38bdf8","Roads & Infrastructure":"#a78bfa","Electricity":"#fbbf24",
  "Fire Department":"#f87171","Police":"#60a5fa","Sanitation":"#4ade80","General Civic":"#94a3b8",
};
const DEPT_ICONS: Record<string,string> = {
  "Water Works":"💧","Roads & Infrastructure":"🛣️","Electricity":"⚡",
  "Fire Department":"🔥","Police":"👮","Sanitation":"🗑️","General Civic":"🏛️",
};
const ROLE_COLOR: Record<string,string> = { citizen:"#10b981", officer:"#3b82f6", worker:"#f59e0b", admin:"#8b5cf6" };
const ROLE_ICON: Record<string,string> = { citizen:"👤", officer:"👮", worker:"🔧", admin:"🛡️" };

function fmt(d:string){return d?new Date(d).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"}):"—";}
function timeAgo(d:string){
  const diff=(Date.now()-new Date(d).getTime())/1000;
  if(diff<60)return"just now";
  if(diff<3600)return`${Math.floor(diff/60)}m ago`;
  if(diff<86400)return`${Math.floor(diff/3600)}h ago`;
  return`${Math.floor(diff/86400)}d ago`;
}

// ─── Mini Chart ───────────────────────────────────────────────────────────────
function BarChart({data,color="#3b82f6"}:{data:{label:string;value:number}[];color?:string}){
  const max=Math.max(...data.map(d=>d.value),1);
  return(
    <div style={{display:"flex",alignItems:"flex-end",gap:6,height:90,padding:"0 4px"}}>
      {data.map((d,i)=>(
        <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
          <div style={{fontSize:9,color:"var(--text-muted)",fontWeight:700}}>{d.value}</div>
          <div style={{width:"100%",background:`linear-gradient(180deg,${color},${color}99)`,borderRadius:"4px 4px 0 0",height:`${(d.value/max)*60}px`,minHeight:d.value>0?4:2,opacity:0.9,transition:"height .4s cubic-bezier(.4,0,.2,1)",boxShadow:`0 4px 12px ${color}40`}}/>
          <div style={{fontSize:9,color:"var(--text-muted)",fontWeight:600}}>{d.label}</div>
        </div>
      ))}
    </div>
  );
}

function DonutChart({value,total,color,label}:{value:number;total:number;color:string;label:string}){
  const pct=total>0?value/total:0;
  const r=28,circ=2*Math.PI*r;
  return(
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:6}}>
      <svg width="72" height="72" style={{filter:`drop-shadow(0 2px 8px ${color}40)`}}>
        <circle cx="36" cy="36" r={r} fill="none" stroke="var(--border)" strokeWidth="6"/>
        <circle cx="36" cy="36" r={r} fill="none" stroke={color} strokeWidth="6"
          strokeDasharray={`${pct*circ} ${circ}`} strokeLinecap="round"
          transform="rotate(-90 36 36)" style={{transition:"stroke-dasharray .6s cubic-bezier(.4,0,.2,1)"}}/>
        <text x="36" y="40" textAnchor="middle" fill={color} fontSize="12" fontWeight="800">{Math.round(pct*100)}%</text>
      </svg>
      <div style={{fontSize:11,color:"var(--text-muted)",fontWeight:600}}>{label}</div>
      <div style={{fontSize:13,fontWeight:800,color:"var(--text-primary)"}}>{value}</div>
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({icon,label,value,sub,color}:{icon:string;label:string;value:string|number;sub?:string;color:string}){
  return(
    <div style={{background:"var(--bg-card)",borderRadius:18,padding:"22px 24px",border:`1px solid ${color}22`,flex:1,minWidth:150,position:"relative",overflow:"hidden",transition:"transform .2s,box-shadow .2s",cursor:"default"}}
      onMouseOver={e=>{(e.currentTarget as HTMLDivElement).style.transform="translateY(-2px)";(e.currentTarget as HTMLDivElement).style.boxShadow=`0 12px 40px ${color}20`;}}
      onMouseOut={e=>{(e.currentTarget as HTMLDivElement).style.transform="translateY(0)";(e.currentTarget as HTMLDivElement).style.boxShadow="none";}}>
      <div style={{position:"absolute",right:-12,top:-12,width:80,height:80,borderRadius:"50%",background:`${color}08`}}/>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
        <div style={{width:40,height:40,borderRadius:12,background:`linear-gradient(135deg,${color}33,${color}11)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,border:`1px solid ${color}25`,boxShadow:`0 4px 12px ${color}20`}}>{icon}</div>
        <span style={{fontSize:11.5,color:"var(--text-muted)",fontWeight:700,letterSpacing:".03em"}}>{label}</span>
      </div>
      <div style={{fontSize:30,fontWeight:900,color:"var(--text-primary)",lineHeight:1,letterSpacing:"-1px"}}>{value}</div>
      {sub&&<div style={{fontSize:11,color:"var(--text-muted)",marginTop:6,lineHeight:1.4}}>{sub}</div>}
      <div style={{position:"absolute",bottom:0,left:0,right:0,height:3,background:`linear-gradient(90deg,${color},${color}44)`,borderRadius:"0 0 18px 18px"}}/>
    </div>
  );
}

// ─── User Card ────────────────────────────────────────────────────────────────
function UserCard({u,onToggle,onDelete}:{u:User;onToggle:(u:User)=>void;onDelete:(id:string)=>void}){
  const [menu,setMenu]=useState(false);
  const rc=ROLE_COLOR[u.role];
  return(
    <div style={{background:"var(--bg-card)",border:`1px solid ${u.active===false?"rgba(239,68,68,.2)":"var(--border)"}`,borderRadius:14,padding:"16px",position:"relative",transition:"all .2s",cursor:"default"}}
      onMouseOver={e=>{(e.currentTarget as HTMLDivElement).style.boxShadow=`0 6px 24px ${rc}15`;(e.currentTarget as HTMLDivElement).style.borderColor=`${rc}33`;}}
      onMouseOut={e=>{(e.currentTarget as HTMLDivElement).style.boxShadow="none";(e.currentTarget as HTMLDivElement).style.borderColor=u.active===false?"rgba(239,68,68,.2)":"var(--border)";}}>
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:12}}>
        <div style={{width:44,height:44,borderRadius:13,background:`linear-gradient(135deg,${rc}30,${rc}10)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0,border:`1.5px solid ${rc}25`,boxShadow:`0 4px 12px ${rc}20`}}>{ROLE_ICON[u.role]}</div>
        <div style={{position:"relative"}}>
          <button onClick={()=>setMenu(!menu)} style={{width:28,height:28,borderRadius:8,background:"var(--bg-card-alt)",border:"1px solid var(--border)",color:"var(--text-muted)",cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center",transition:"all .15s"}}
            onMouseOver={e=>{(e.currentTarget as HTMLButtonElement).style.background="var(--bg-hover)";}}
            onMouseOut={e=>{(e.currentTarget as HTMLButtonElement).style.background="var(--bg-card-alt)";}}>⋮</button>
          {menu&&(
            <div style={{position:"absolute",right:0,top:32,background:"var(--bg-card)",borderRadius:12,border:"1px solid var(--border)",overflow:"hidden",zIndex:50,minWidth:150,boxShadow:"0 12px 40px rgba(0,0,0,.2)"}}>
              <button onClick={()=>{onToggle(u);setMenu(false);}} style={{width:"100%",padding:"11px 14px",background:"none",border:"none",color:"var(--text-primary)",fontSize:12.5,cursor:"pointer",textAlign:"left",fontFamily:"inherit",display:"flex",alignItems:"center",gap:8,transition:"background .15s"}}
                onMouseOver={e=>(e.currentTarget.style.background="var(--bg-hover)")} onMouseOut={e=>(e.currentTarget.style.background="none")}>{u.active===false?"✅ Activate":"⛔ Deactivate"}</button>
              <button onClick={()=>{onDelete(u.id);setMenu(false);}} style={{width:"100%",padding:"11px 14px",background:"none",border:"none",color:"#ef4444",fontSize:12.5,cursor:"pointer",textAlign:"left",fontFamily:"inherit",display:"flex",alignItems:"center",gap:8,transition:"background .15s"}}
                onMouseOver={e=>(e.currentTarget.style.background="rgba(239,68,68,.06)")} onMouseOut={e=>(e.currentTarget.style.background="none")}>🗑️ Delete User</button>
            </div>
          )}
        </div>
      </div>
      <div style={{fontWeight:700,fontSize:13.5,color:"var(--text-primary)",marginBottom:3,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{u.name}</div>
      <div style={{fontSize:11,color:"var(--text-muted)",marginBottom:8,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{u.email}</div>
      {u.department&&<div style={{fontSize:10.5,color:"var(--accent)",fontWeight:700,marginBottom:8,background:"var(--accent-dim)",padding:"2px 8px",borderRadius:6,display:"inline-block"}}>📁 {u.department}</div>}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:8,paddingTop:8,borderTop:"1px solid var(--border)"}}>
        <span style={{padding:"3px 10px",borderRadius:20,background:`${rc}15`,color:rc,fontSize:10,fontWeight:800,textTransform:"uppercase",letterSpacing:".04em"}}>{u.role}</span>
        <span style={{fontSize:10,color:u.active===false?"#ef4444":"#10b981",fontWeight:700,display:"flex",alignItems:"center",gap:3}}>
          <span style={{width:6,height:6,borderRadius:"50%",background:u.active===false?"#ef4444":"#10b981",display:"inline-block"}}/>
          {u.active===false?"Inactive":"Active"}
        </span>
      </div>
      <div style={{fontSize:10,color:"var(--text-muted)",marginTop:6}}>Joined {fmt(u.createdAt||"")}</div>
    </div>
  );
}

// ─── Notification Panel ───────────────────────────────────────────────────────
interface UnifiedNotif{id:string;icon:string;title:string;body:string;time:string;ticketId?:string;type:"urgent"|"task"|"done"|"alert"|"info"|"warning";read?:boolean;}

function UnifiedNotifsPanel({notifs,onRead,onReadAll,onClose}:{notifs:UnifiedNotif[];onRead:(id:string)=>void;onReadAll:()=>void;onClose:()=>void}){
  const unread=notifs.filter(n=>!n.read).length;
  const tC:{[k:string]:string}={urgent:"#ef4444",task:"#8b5cf6",done:"#10b981",alert:"#f97316",info:"#3b82f6",warning:"#f59e0b"};
  const tB:{[k:string]:string}={urgent:"rgba(239,68,68,.12)",task:"rgba(139,92,246,.12)",done:"rgba(16,185,129,.12)",alert:"rgba(249,115,22,.12)",info:"rgba(59,130,246,.12)",warning:"rgba(245,158,11,.12)"};
  const age=(ts:string)=>{const d=Date.now()-new Date(ts).getTime();if(d<60000)return"just now";if(d<3600000)return`${Math.round(d/60000)}m ago`;if(d<86400000)return`${Math.round(d/3600000)}h ago`;return`${Math.round(d/86400000)}d ago`;};
  return(
    <div style={{position:"absolute",right:0,top:"calc(100% + 12px)",width:380,background:"var(--bg-card)",borderRadius:18,boxShadow:"0 24px 64px rgba(0,0,0,.25)",border:"1px solid var(--border)",zIndex:300,overflow:"hidden",animation:"fadeIn .2s ease"}}>
      <div style={{padding:"16px 18px",borderBottom:"1px solid var(--border)",background:"var(--bg-card-alt)",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div>
          <div style={{fontWeight:800,fontSize:14.5,color:"var(--text-primary)"}}>🔔 Notifications</div>
          <div style={{fontSize:10.5,color:"var(--text-muted)",marginTop:1}}>{notifs.length} total · <span style={{color:unread>0?"#ef4444":"var(--text-muted)",fontWeight:700}}>{unread} unread</span></div>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          {unread>0&&<button onClick={onReadAll} style={{fontSize:11,color:"var(--accent)",background:"var(--accent-dim)",border:"none",cursor:"pointer",fontWeight:700,fontFamily:"inherit",padding:"5px 11px",borderRadius:8}}>✓ Mark all read</button>}
          <button onClick={onClose} style={{width:28,height:28,borderRadius:"50%",background:"var(--bg-hover)",border:"none",cursor:"pointer",fontSize:13,display:"flex",alignItems:"center",justifyContent:"center",color:"var(--text-muted)"}}>✕</button>
        </div>
      </div>
      <div style={{maxHeight:420,overflowY:"auto"}}>
        {notifs.length===0?(
          <div style={{textAlign:"center",padding:"40px 16px",color:"var(--text-muted)"}}>
            <div style={{fontSize:36,marginBottom:10}}>🔕</div>
            <div style={{fontSize:13,fontWeight:700,color:"var(--text-secondary)"}}>All caught up!</div>
            <div style={{fontSize:11,marginTop:4}}>No new notifications</div>
          </div>
        ):notifs.map(n=>(
          <div key={n.id} onClick={()=>onRead(n.id)} style={{padding:"13px 18px",borderBottom:"1px solid var(--border)",display:"flex",gap:12,alignItems:"flex-start",background:n.read?"transparent":tB[n.type],cursor:"pointer",transition:"background .15s"}}
            onMouseOver={e=>(e.currentTarget.style.background="var(--bg-hover)")}
            onMouseOut={e=>(e.currentTarget.style.background=n.read?"transparent":tB[n.type])}>
            <div style={{width:38,height:38,borderRadius:11,background:tB[n.type],border:`1px solid ${tC[n.type]}30`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>{n.icon}</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:12.5,fontWeight:n.read?500:700,color:n.read?"var(--text-secondary)":tC[n.type]}}>{n.title}</div>
              <div style={{fontSize:11.5,color:"var(--text-primary)",marginTop:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{n.body}</div>
              {n.ticketId&&<div style={{fontSize:10,color:"var(--text-secondary)",fontFamily:"monospace",marginTop:2,background:"var(--bg-card-alt)",padding:"1px 6px",borderRadius:4,display:"inline-block"}}>{n.ticketId}</div>}
              <div style={{fontSize:10,color:"var(--text-muted)",marginTop:4}}>{age(n.time)}</div>
            </div>
            {!n.read&&<div style={{width:8,height:8,borderRadius:"50%",background:tC[n.type],flexShrink:0,marginTop:5,boxShadow:`0 0 6px ${tC[n.type]}`}}/>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AdminDashboard(){
  const user=useSelector((s:RootState)=>s.auth.user);
  const dispatch=useDispatch();
  const navigate=useNavigate();

  const [page,setPage]=useState<"overview"|"users"|"complaints"|"analytics"|"departments"|"system">("overview");
  const [complaints,setComplaints]=useState<Complaint[]>([]);
  const [users,setUsers]=useState<User[]>([]);
  const [toast,setToast]=useState<{msg:string;type:"success"|"error"|"info"}|null>(null);
  const [search,setSearch]=useState("");
  const [statusFilter,setStatusFilter]=useState("All");
  const [newUser,setNewUser]=useState({name:"",email:"",phone:"",role:"officer" as User["role"],department:"",password:""});
  const [showAddUser,setShowAddUser]=useState(false);
  const [sysTime,setSysTime]=useState(new Date());
  const [selectedC,setSelectedC]=useState<Complaint|null>(null);
  // ── Real analytics from backend ──
  const [analyticsData,setAnalyticsData]=useState<{
    summary:any; departments:any[]; trend:any[]; workers:any[];
  }>({summary:null,departments:[],trend:[],workers:[]});
  const [adminNote,setAdminNote]=useState("");
  const [adminNotesList,setAdminNotesList]=useState<{id:string;text:string;time:string}[]>([]);
  const [showAdminProfile,setShowAdminProfile]=useState(false);
  const [showLogoutScreen,setShowLogoutScreen]=useState(false);
  const [showAdminNotifs,setShowAdminNotifs]=useState(false);
  const [adminNotifsReadIds,setAdminNotifsReadIds]=useState<Set<string>>(new Set());

  const showToast=(msg:string,type:"success"|"error"|"info"="success")=>{setToast({msg,type});setTimeout(()=>setToast(null),3200);};

  useEffect(()=>{
    if(!user) navigate("/login",{replace:true});
    const API="http://localhost:3001/api";
    const loadData=async()=>{
      try{
        const token=JSON.parse(localStorage.getItem("auth")||"{}").token;
        const headers={Authorization:`Bearer ${token}`};
        const [cRes,uRes,sRes,dRes,tRes]=await Promise.all([
          fetch(`${API}/complaints`,{headers}),
          fetch(`${API}/users`,{headers}),
          fetch(`${API}/analytics/summary`,{headers}),
          fetch(`${API}/analytics/departments`,{headers}),
          fetch(`${API}/analytics/trend?period=weekly`,{headers}),
        ]);
        if(sRes.ok&&dRes.ok&&tRes.ok){
          const [sj,dj,tj]=await Promise.all([sRes.json(),dRes.json(),tRes.json()]);
          setAnalyticsData({summary:sj?.data,departments:Array.isArray(dj?.data)?dj.data:[],trend:Array.isArray(tj?.data)?tj.data:[],workers:[]});
        }
        if(cRes.ok){
          const j=await cRes.json();
          const raw=j?.data?.complaints??j?.data??j;
          if(Array.isArray(raw)){
            const norm=raw.map((c:any)=>({...c,
              ticketId:   c.ticket_id??c.ticketId??c.id,
              title:      c.title??c.category??"Complaint",
              category:   c.category??c.department,
              department: c.department,
              status:     c.status,
              emergency:  c.is_emergency===1||c.is_emergency===true,
              userId:     c.user_id??c.userId,
              userName:   c.user_name??c.userName,
              createdAt:  c.created_at??c.createdAt??new Date().toISOString(),
              updatedAt:  c.updated_at??c.updatedAt,
            }));
            setComplaints(norm);
          }
        } else setComplaints(ls("complaints_all",[])||[]);
        if(uRes.ok){
          const j=await uRes.json();
          const raw=j?.data?.users??j?.data??j;
          if(Array.isArray(raw)){
            // Normalise backend user fields to frontend User shape
            const norm=raw.map((u:any)=>({
              id:          u.id,
              name:        u.name,
              email:       u.email,
              phone:       u.phone,
              role:        u.role,
              department:  u.department,
              district:    u.district,
              badge_number:u.badge_number,
              employee_id: u.employee_id,
              active:      u.is_active===1||u.is_active===true,
              createdAt:   u.created_at??u.createdAt??new Date().toISOString(),
            }));
            setUsers(norm);
          }
        }
        else setUsers(ls("ap_registered_users",[])||[]);
      }catch{
        setComplaints(ls("complaints_all",[])||[]);
        setUsers(ls("ap_registered_users",[])||[]);
      }
      setSysTime(new Date());
    };
    loadData();
    const iv=setInterval(loadData, 30000);
    return()=>clearInterval(iv);
  },[]);

  const total=complaints.length;
  const pending=complaints.filter(c=>c.status==="Pending").length;
  const resolved=complaints.filter(c=>c.status==="Resolved").length;
  const inProgress=complaints.filter(c=>c.status==="In Progress"||c.status==="Assigned").length;
  const emergency=complaints.filter(c=>c.emergency).length;
  const resRate=total>0?Math.round((resolved/total)*100):0;
  const citizens=users.filter(u=>u.role==="citizen").length;
  const officers=users.filter(u=>u.role==="officer").length;
  const workers=users.filter(u=>u.role==="worker").length;

  const builtAdminNotifs:UnifiedNotif[]=useMemo(()=>[
    ...complaints.filter(c=>c.emergency).map(c=>({id:`em-${c.id}`,icon:"🚨",title:"Emergency Complaint",body:c.title||c.category||"Emergency",time:c.createdAt,ticketId:c.ticketId,type:"urgent" as const,read:false})),
    ...complaints.filter(c=>c.status==="Pending").slice(0,5).map(c=>({id:`pd-${c.id}`,icon:"⏳",title:"Pending Review",body:c.title||c.category||"Untitled",time:c.createdAt,ticketId:c.ticketId,type:"alert" as const,read:false})),
    ...complaints.filter(c=>c.status==="Resolved").slice(0,3).map(c=>({id:`rv-${c.id}`,icon:"✅",title:"Complaint Resolved",body:c.title||c.category||"Untitled",time:c.updatedAt||c.createdAt,ticketId:c.ticketId,type:"done" as const,read:true})),
  ].sort((a,b)=>new Date(b.time).getTime()-new Date(a.time).getTime()),[complaints]);

  const deptBreakdown=useMemo(()=>{
    // Use real backend department stats if available
    if(analyticsData.departments.length>0){
      return analyticsData.departments.map((d:any)=>[d.department,Number(d.total)||0] as [string,number]);
    }
    // Fallback
    const map:Record<string,number>={};
    complaints.forEach(c=>{const d=c.department||"General Civic";map[d]=(map[d]||0)+1;});
    return Object.entries(map).sort((a,b)=>b[1]-a[1]);
  },[complaints,analyticsData.departments]);

  const weeklyTrend=useMemo(()=>{
    // Use real backend trend data if available
    if(analyticsData.trend.length>0){
      return analyticsData.trend.slice(-7).map((t:any)=>({
        label:new Date(t.date).toLocaleDateString("en-IN",{weekday:"short"}),
        value:Number(t.submitted)||0,
      }));
    }
    // Fallback: compute from loaded complaints
    const days=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
    const counts=Array(7).fill(0);
    const now=new Date();
    complaints.forEach(c=>{const d=new Date(c.createdAt);const diff=Math.floor((now.getTime()-d.getTime())/(86400000));if(diff<7)counts[d.getDay()]++;});
    return days.map((l,i)=>({label:l,value:counts[i]}));
  },[complaints,analyticsData.trend]);

  const statusData=[
    {label:"Pending",value:pending},{label:"Progress",value:inProgress},
    {label:"Resolved",value:resolved},{label:"Emergency",value:emergency}
  ];

  const toggleUser=async(u:User)=>{
    const newActive = u.active === false;
    try{
      const token=JSON.parse(localStorage.getItem("auth")||"{}").token;
      await fetch(`${ADMIN_API}/users/${u.id}`,{
        method:"PATCH",
        headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},
        body:JSON.stringify({is_active: newActive ? 1 : 0}),
      });
    }catch{}
    setUsers(prev=>prev.map(x=>x.id===u.id?{...x,active:newActive}:x));
    showToast(`${u.name} ${newActive?"activated":"deactivated"}`);
  };
  const deleteUser=async(id:string)=>{
    try{
      const token=JSON.parse(localStorage.getItem("auth")||"{}").token;
      await fetch(`${ADMIN_API}/users/${id}`,{
        method:"DELETE",
        headers:{Authorization:`Bearer ${token}`},
      });
    }catch{}
    setUsers(prev=>prev.filter(u=>u.id!==id));
    showToast("User deactivated","info");
  };
  const addUser=async()=>{
    if(!newUser.name||!newUser.email){showToast("Name and email required","error");return;}
    if(!newUser.password||newUser.password.length<6){showToast("Password must be at least 6 characters","error");return;}
    try{
      const token=JSON.parse(localStorage.getItem("auth")||"{}").token;
      const res=await fetch(`${ADMIN_API}/auth/register`,{
        method:"POST",
        headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},
        body:JSON.stringify({
          name:newUser.name, email:newUser.email, phone:newUser.phone,
          role:newUser.role, department:newUser.department||undefined,
          password:newUser.password,
        }),
      });
      const data=await res.json();
      if(data.success){
        const u=data.data?.user??{id:`user-${Date.now()}`,name:newUser.name,email:newUser.email,phone:newUser.phone,role:newUser.role,department:newUser.department,createdAt:new Date().toISOString(),active:true};
        setUsers(prev=>[...prev,{...u,active:true}]);
        setShowAddUser(false);
        setNewUser({name:"",email:"",phone:"",role:"officer",department:"",password:""});
        showToast(`${newUser.name} added as ${newUser.role}`);
        return;
      } else { showToast(data.message||"Failed to create user","error"); return; }
    }catch{ showToast("Server error — could not create user","error"); }
  };

  const filteredComplaints=complaints.filter(c=>{
    const matchStatus=statusFilter==="All"||c.status===statusFilter;
    const q=search.toLowerCase();
    const matchQ=!q||(c.title||"").toLowerCase().includes(q)||(c.userName||"").toLowerCase().includes(q)||(c.ticketId||"").toLowerCase().includes(q);
    return matchStatus&&matchQ;
  }).sort((a,b)=>new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime());

  const NAV=[
    {id:"overview",icon:"📊",label:"Overview"},
    {id:"users",icon:"👥",label:"Users"},
    {id:"complaints",icon:"📋",label:"Complaints"},
    {id:"analytics",icon:"📈",label:"Analytics"},
    {id:"departments",icon:"🏢",label:"Departments"},
    {id:"system",icon:"⚙️",label:"System"},
  ];

  const inp:React.CSSProperties={width:"100%",padding:"10px 14px",borderRadius:10,border:"1.5px solid var(--border)",background:"var(--bg-input)",color:"var(--text-primary)",fontSize:13,outline:"none",boxSizing:"border-box",fontFamily:"inherit",transition:"border-color .2s"};
  const btn:React.CSSProperties={padding:"10px 20px",borderRadius:10,border:"none",cursor:"pointer",fontSize:13,fontWeight:700,fontFamily:"inherit"};
  const card:React.CSSProperties={background:"var(--bg-card)",borderRadius:18,border:"1px solid var(--border)",overflow:"hidden"};

  const unreadCount=builtAdminNotifs.filter(n=>!adminNotifsReadIds.has(n.id)).length;

  return(
    <div style={{minHeight:"100vh",background:"var(--bg-page)",fontFamily:"'Outfit','DM Sans',system-ui,sans-serif",color:"var(--text-primary)",paddingTop:64}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&display=swap');
        :root{
          --bg-page:#f0faf4;
          --bg-card:#ffffff;
          --bg-card-alt:#f4fbf7;
          --bg-nav:#ffffff;
          --bg-nav-glass:rgba(255,255,255,.96);
          --bg-input:#f4fbf7;
          --bg-hover:#e8f5ee;
          --border:#d1ead9;
          --border-strong:#a3d4b3;
          --text-primary:#0d2b1a;
          --text-secondary:#3d6b52;
          --text-muted:#7aab8e;
          --accent:#16a34a;
          --accent-light:#22c55e;
          --accent-dim:rgba(22,163,74,.12);
          --shadow-sm:0 1px 6px rgba(22,163,74,.06);
          --shadow-md:0 4px 20px rgba(22,163,74,.10);
          --shadow-lg:0 8px 32px rgba(22,163,74,.14);
          --scrollbar:#a3d4b3;
          --nav-border:#d1ead9;
          --footer-bg:#0c1a12;
        }
        @media(prefers-color-scheme:dark){
          :root{
            --bg-page:#06100d;
            --bg-card:#0e1f17;
            --bg-card-alt:#112319;
            --bg-nav:#091510;
            --bg-nav-glass:rgba(9,21,16,.96);
            --bg-input:#0e1f17;
            --bg-hover:#152d1e;
            --border:#1a3326;
            --border-strong:#234d35;
            --text-primary:#dcfce7;
            --text-secondary:#86efac;
            --text-muted:#3d6b52;
            --accent:#22c55e;
            --accent-light:#4ade80;
            --accent-dim:rgba(34,197,94,.12);
            --shadow-sm:0 1px 6px rgba(0,0,0,.35);
            --shadow-md:0 4px 20px rgba(0,0,0,.45);
            --shadow-lg:0 8px 32px rgba(0,0,0,.6);
            --scrollbar:#1a3326;
            --nav-border:#1a3326;
            --footer-bg:#04100a;
          }
        }
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:var(--scrollbar);border-radius:4px}
        @keyframes fadeIn{from{opacity:0;transform:translateY(-10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes slideUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
        @keyframes slideFromRight{from{opacity:0;transform:translateX(40px)}to{opacity:1;transform:translateX(0)}}
        @keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.6;transform:scale(.95)}}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes toastIn{from{opacity:0;transform:translateX(40px)}to{opacity:1;transform:translateX(0)}}
        .nav-tab{transition:all .2s cubic-bezier(.4,0,.2,1)!important;}
        .nav-tab:hover{background:var(--bg-hover)!important;}
        .stat-row-item:hover{background:var(--bg-hover)!important;}
        .complaint-row:hover{background:var(--bg-hover)!important;}
        input:focus{border-color:var(--accent)!important;box-shadow:0 0 0 3px rgba(22,163,74,.12)!important;}
        select:focus{border-color:var(--accent)!important;outline:none!important;}
        textarea:focus{border-color:var(--accent)!important;box-shadow:0 0 0 3px rgba(22,163,74,.12)!important;}
        .section-header{background:linear-gradient(135deg,var(--bg-card-alt),var(--bg-card));border-bottom:1px solid var(--border);padding:18px 22px;}
        .badge-pending{background:rgba(245,158,11,.15);color:#f59e0b;}
        .badge-resolved{background:rgba(16,185,129,.15);color:#10b981;}
        .badge-progress{background:rgba(59,130,246,.15);color:#3b82f6;}
        .badge-emergency{background:rgba(239,68,68,.15);color:#ef4444;}
      `}</style>

      {/* ── Toast ── */}
      {toast&&(
        <div style={{position:"fixed",top:78,right:20,zIndex:9999,animation:"toastIn .3s ease",display:"flex",alignItems:"center",gap:10,background:toast.type==="error"?"#ef4444":toast.type==="info"?"#3b82f6":"#10b981",color:"#fff",padding:"13px 18px",borderRadius:14,fontSize:13,fontWeight:700,boxShadow:"0 8px 32px rgba(0,0,0,.3)"}}>
          <span>{toast.type==="error"?"❌":toast.type==="info"?"ℹ️":"✅"}</span>
          {toast.msg}
        </div>
      )}

      {/* ── NAVBAR ── */}
      <nav style={{background:"var(--bg-nav-glass)",position:"fixed",top:0,left:0,right:0,zIndex:200,borderBottom:"1px solid var(--nav-border)",backdropFilter:"blur(16px)",WebkitBackdropFilter:"blur(16px)",boxShadow:"0 2px 24px rgba(22,163,74,.08)"}}>
        <div style={{maxWidth:1440,margin:"0 auto",padding:"0 24px",height:64,display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>

          {/* Brand with AP Seal */}
          <div style={{display:"flex",alignItems:"center",gap:11,flexShrink:0}}>
            <div style={{width:44,height:44,borderRadius:12,background:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              <img src="/ap-bg.png" style={{width:44,height:44,objectFit:"contain"}} alt="AP Seal"/>
            </div>
            <div>
              <div style={{fontSize:15,fontWeight:900,color:"var(--text-primary)",letterSpacing:"-.02em",lineHeight:1}}>CivicConnect Admin Portal</div>
              <div style={{fontSize:9.5,color:"var(--accent)",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginTop:2}}>Civic Control System</div>
            </div>
          </div>

          {/* Center Nav Tabs */}
          {/* Center Nav Tabs */}
<div style={{
  display: "flex",
  alignItems: "center",
  gap: 20
}}>
  {NAV.map(n => (
    <button
      key={n.id}
      onClick={() => setPage(n.id as any)}
      style={{
        background: "transparent",
        border: "none",
        cursor: "pointer",
        fontFamily: "inherit",
        fontSize: 14,

        // ✅ SAME AS CITIZEN NAVBAR
        color: page === n.id ? "#14532d" : "#16a34a",
        fontWeight: page === n.id ? 700 : 500,

        transition: "all .2s",
        whiteSpace: "nowrap"
      }}
    >
      <span style={{ marginRight: 4 }}>{n.icon}</span>
      {n.label}
    </button>
  ))}
</div>

          {/* Right Controls */}
          <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
            {/* Live indicator */}
            <div style={{display:"flex",alignItems:"center",gap:6,background:"rgba(22,163,74,.08)",border:"1px solid rgba(22,163,74,.2)",borderRadius:20,padding:"5px 12px"}}>
              <div style={{width:7,height:7,borderRadius:"50%",background:"var(--accent)",boxShadow:"0 0 8px var(--accent)",animation:"pulse 2s infinite"}}/>
              <span style={{fontSize:10.5,color:"var(--accent)",fontWeight:800,letterSpacing:".06em"}}>LIVE</span>
            </div>
            {/* Clock */}
            <div style={{fontSize:11,color:"var(--text-secondary)",fontFamily:"'Courier New',monospace",background:"var(--bg-card-alt)",padding:"5px 12px",borderRadius:20,border:"1px solid var(--border)",fontWeight:700,letterSpacing:".02em"}}>{sysTime.toLocaleTimeString("en-IN")}</div>

            {/* Notification bell */}
            <div style={{position:"relative"}}>
              <button onClick={()=>{setShowAdminNotifs(p=>!p);setShowAdminProfile(false);}} style={{width:40,height:40,borderRadius:12,background:showAdminNotifs?"var(--accent)":"var(--bg-card-alt)",border:`1px solid ${showAdminNotifs?"var(--accent)":"var(--border)"}`,color:showAdminNotifs?"#fff":"var(--text-secondary)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",position:"relative",transition:"all .2s",fontSize:17}}>
                🔔
                {unreadCount>0&&<span style={{position:"absolute",top:-4,right:-4,minWidth:18,height:18,borderRadius:9,background:"#ef4444",fontSize:9,fontWeight:900,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",padding:"0 3px",boxShadow:"0 2px 6px rgba(239,68,68,.5)"}}>{unreadCount}</span>}
              </button>
              {showAdminNotifs&&<UnifiedNotifsPanel notifs={builtAdminNotifs.map(n=>({...n,read:adminNotifsReadIds.has(n.id)}))} onRead={id=>setAdminNotifsReadIds(prev=>new Set([...prev,id]))} onReadAll={()=>setAdminNotifsReadIds(new Set(builtAdminNotifs.map(n=>n.id)))} onClose={()=>setShowAdminNotifs(false)}/>}
            </div>

            {/* Profile dropdown */}
            <div style={{position:"relative"}}>
              <button onClick={()=>setShowAdminProfile(p=>!p)} style={{display:"flex",alignItems:"center",gap:8,background:showAdminProfile?"var(--accent-dim)":"var(--bg-card-alt)",border:`1.5px solid ${showAdminProfile?"var(--accent)":"var(--border)"}`,borderRadius:13,padding:"5px 12px 5px 6px",cursor:"pointer",transition:"all .2s"}}>
                <div style={{width:32,height:32,borderRadius:10,background:"linear-gradient(135deg,#16a34a,#22c55e)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,fontSize:14,color:"#fff",boxShadow:"0 2px 10px rgba(22,163,74,.35)"}}>{user?.name?.charAt(0)||"A"}</div>
                <div style={{textAlign:"left"}}>
                  <div style={{fontSize:12.5,fontWeight:700,color:"var(--text-primary)",lineHeight:1.2}}>{user?.name?.split(" ")[0]||"Admin"}</div>
                  <div style={{fontSize:9.5,color:"var(--accent)",fontWeight:700,letterSpacing:".03em"}}>Administrator</div>
                </div>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2.5" strokeLinecap="round"><path d="m6 9 6 6 6-6"/></svg>
              </button>
              {showAdminProfile&&(
                <div style={{position:"absolute",right:0,top:"calc(100% + 12px)",width:290,background:"var(--bg-card)",borderRadius:18,boxShadow:"0 24px 64px rgba(0,0,0,.22)",border:"1px solid var(--border)",zIndex:300,overflow:"hidden",animation:"fadeIn .2s ease"}}>
                  <div style={{padding:"20px 18px 14px",background:"linear-gradient(135deg,rgba(22,163,74,.1),rgba(34,197,94,.05))",borderBottom:"1px solid var(--border)"}}>
                    <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14}}>
                      <div style={{width:52,height:52,borderRadius:16,background:"linear-gradient(135deg,#16a34a,#22c55e)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,fontSize:22,color:"#fff",boxShadow:"0 6px 20px rgba(22,163,74,.45)"}}>{user?.name?.charAt(0)||"A"}</div>
                      <div>
                        <div style={{fontWeight:800,fontSize:15,color:"var(--text-primary)",lineHeight:1.2}}>{user?.name||"Admin"}</div>
                        <div style={{fontSize:11,color:"var(--accent)",fontWeight:700,marginTop:3}}>🛡️ Administrator</div>
                        <div style={{fontSize:10.5,color:"var(--text-muted)",marginTop:1}}>{user?.email||""}</div>
                      </div>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}>
                      {[{l:"Users",v:users.length},{l:"Complaints",v:total},{l:"Resolved",v:resolved}].map(s=>(
                        <div key={s.l} style={{textAlign:"center",background:"rgba(255,255,255,.5)",borderRadius:10,padding:"8px 4px",border:"1px solid var(--border)"}}>
                          <div style={{fontSize:17,fontWeight:900,color:"var(--accent)"}}>{s.v}</div>
                          <div style={{fontSize:9.5,color:"var(--text-muted)",fontWeight:700}}>{s.l}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{padding:"8px 10px"}}>
                    {NAV.map(n=>(
                      <button key={n.id} onClick={()=>{setPage(n.id as any);setShowAdminProfile(false);}} style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"9px 10px",fontSize:13,color:page===n.id?"var(--accent)":"var(--text-secondary)",background:page===n.id?"var(--accent-dim)":"none",border:"none",cursor:"pointer",fontFamily:"inherit",textAlign:"left",borderRadius:8,fontWeight:page===n.id?700:400,transition:"all .15s"}}
                        onMouseOver={e=>(e.currentTarget.style.background="var(--bg-hover)")}
                        onMouseOut={e=>{if(page!==n.id)e.currentTarget.style.background="none";}}>{n.icon} {n.label}</button>
                    ))}
                  </div>
                  <div style={{borderTop:"1px solid var(--border)",padding:"8px 10px"}}>
                    <button onClick={()=>{setShowAdminProfile(false);setShowLogoutScreen(true);}} style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"10px 10px",fontSize:13,color:"#ef4444",background:"none",border:"none",cursor:"pointer",fontFamily:"inherit",textAlign:"left",borderRadius:8,fontWeight:600,transition:"background .15s"}}
                      onMouseOver={e=>(e.currentTarget.style.background="rgba(239,68,68,.06)")}
                      onMouseOut={e=>(e.currentTarget.style.background="none")}>
                      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M17 16l4-4m0 0l-4-4m4 4H7"/></svg> Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      {(showAdminProfile||showAdminNotifs)&&<div style={{position:"fixed",inset:0,zIndex:190}} onClick={()=>{setShowAdminProfile(false);setShowAdminNotifs(false);}}/>}

      {/* ── PAGE CONTENT ── */}
      <div style={{padding:"28px 28px 0",maxWidth:1440,margin:"0 auto"}}>

        {/* Page header strip */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:28}}>
          <div>
            <h1 style={{fontSize:22,fontWeight:900,color:"var(--text-primary)",letterSpacing:"-.02em",margin:0}}>
              {NAV.find(n=>n.id===page)?.icon} {NAV.find(n=>n.id===page)?.label}
            </h1>
            <div style={{fontSize:12,color:"var(--text-muted)",marginTop:4}}>
              {page==="overview"&&`${total} total complaints · ${resRate}% resolution rate`}
              {page==="users"&&`${users.length} registered users across all roles`}
              {page==="complaints"&&`${filteredComplaints.length} complaints${statusFilter!=="All"?` · ${statusFilter}`:""}`}
              {page==="analytics"&&"Detailed insights and performance metrics"}
              {page==="departments"&&"Department-wise workload and performance"}
              {page==="system"&&"System status and configuration settings"}
            </div>
          </div>
          <div style={{fontSize:11,color:"var(--text-muted)",background:"var(--bg-card)",padding:"6px 14px",borderRadius:10,border:"1px solid var(--border)"}}>
            Updated {sysTime.toLocaleTimeString("en-IN")}
          </div>
        </div>

        {/* ── OVERVIEW ── */}
        {page==="overview"&&(
          <div style={{animation:"slideUp .3s ease"}}>
            <div style={{display:"flex",gap:16,marginBottom:24,flexWrap:"wrap"}}>
              <StatCard icon="📋" label="Total Complaints" value={total} sub={`${pending} pending · ${resolved} resolved`} color="#3b82f6"/>
              <StatCard icon="👥" label="Registered Users" value={users.length} sub={`${citizens} citizens · ${officers} officers · ${workers} workers`} color="#10b981"/>
              <StatCard icon="✅" label="Resolution Rate" value={`${resRate}%`} sub={`${resolved} of ${total} resolved`} color="#8b5cf6"/>
              <StatCard icon="🚨" label="Emergency Cases" value={emergency} sub={emergency===0?"No active emergencies":"Needs immediate attention"} color="#ef4444"/>
            </div>

            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,marginBottom:24}}>
              <div style={card}>
                <div className="section-header">
                  <div style={{fontWeight:700,fontSize:14,color:"var(--text-primary)"}}>📅 Weekly Complaint Trend</div>
                  <div style={{fontSize:11,color:"var(--text-muted)",marginTop:2}}>Submissions by day of week</div>
                </div>
                <div style={{padding:"16px 20px 20px"}}><BarChart data={weeklyTrend} color="#3b82f6"/></div>
              </div>
              <div style={card}>
                <div className="section-header">
                  <div style={{fontWeight:700,fontSize:14,color:"var(--text-primary)"}}>📊 Status Distribution</div>
                  <div style={{fontSize:11,color:"var(--text-muted)",marginTop:2}}>Current complaint states</div>
                </div>
                <div style={{padding:"20px",display:"flex",justifyContent:"space-around",alignItems:"center"}}>
                  <DonutChart value={pending} total={total} color="#f59e0b" label="Pending"/>
                  <DonutChart value={inProgress} total={total} color="#3b82f6" label="In Progress"/>
                  <DonutChart value={resolved} total={total} color="#10b981" label="Resolved"/>
                </div>
              </div>
            </div>

            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
              <div style={card}>
                <div className="section-header">
                  <div style={{fontWeight:700,fontSize:14,color:"var(--text-primary)"}}>🏢 By Department</div>
                </div>
                <div style={{padding:"16px 20px",display:"flex",flexDirection:"column",gap:10}}>
                  {deptBreakdown.slice(0,6).map(([dept,count])=>(
                    <div key={dept} style={{display:"flex",alignItems:"center",gap:10}}>
                      <span style={{fontSize:16,width:24,textAlign:"center",flexShrink:0}}>{DEPT_ICONS[dept]||"🏛️"}</span>
                      <div style={{flex:1}}>
                        <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                          <span style={{fontSize:12,color:"var(--text-secondary)",fontWeight:500}}>{dept}</span>
                          <span style={{fontSize:12,fontWeight:800,color:"var(--text-primary)"}}>{count}</span>
                        </div>
                        <div style={{height:5,background:"var(--bg-hover)",borderRadius:3}}>
                          <div style={{height:5,borderRadius:3,background:DEPT_COLORS[dept]||"var(--text-muted)",width:`${(count/Math.max(total,1))*100}%`,transition:"width .5s",boxShadow:`0 2px 6px ${DEPT_COLORS[dept]||"#94a3b8"}50`}}/>
                        </div>
                      </div>
                    </div>
                  ))}
                  {deptBreakdown.length===0&&<div style={{textAlign:"center",padding:20,color:"var(--text-muted)",fontSize:12}}>No complaints yet</div>}
                </div>
              </div>
              <div style={card}>
                <div className="section-header">
                  <div style={{fontWeight:700,fontSize:14,color:"var(--text-primary)"}}>🕐 Recent Activity</div>
                </div>
                <div style={{maxHeight:270,overflowY:"auto"}}>
                  {complaints.slice(0,8).map(c=>(
                    <div key={c.id} className="stat-row-item" style={{padding:"11px 18px",borderBottom:"1px solid var(--border)",display:"flex",gap:10,alignItems:"center",transition:"background .15s",cursor:"pointer"}} onClick={()=>setSelectedC(c)}>
                      <span style={{fontSize:16,flexShrink:0}}>{DEPT_ICONS[c.department||""]||"📋"}</span>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:12.5,fontWeight:600,color:"var(--text-primary)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.title||c.category||"Untitled"}</div>
                        <div style={{fontSize:10.5,color:"var(--text-muted)",marginTop:1}}>{c.userName||"Citizen"} · {timeAgo(c.createdAt)}</div>
                      </div>
                      <span className={`badge-${c.status==="Resolved"?"resolved":c.status==="Pending"?"pending":"progress"}`} style={{padding:"3px 9px",borderRadius:20,fontSize:10,fontWeight:700,whiteSpace:"nowrap",flexShrink:0}}>{c.status}</span>
                    </div>
                  ))}
                  {complaints.length===0&&<div style={{padding:40,textAlign:"center",color:"var(--text-muted)",fontSize:12}}>No complaints yet</div>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── USERS ── */}
        {page==="users"&&(
          <div style={{animation:"slideUp .3s ease"}}>
            <div style={{display:"flex",gap:10,marginBottom:20,flexWrap:"wrap",alignItems:"center"}}>
              <div style={{position:"relative",flex:1,maxWidth:320}}>
                <span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",color:"var(--text-muted)",fontSize:14}}>🔍</span>
                <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by name or email..." style={{...inp,paddingLeft:36}}/>
              </div>
              <button onClick={()=>setShowAddUser(true)} style={{...btn,background:"linear-gradient(135deg,#16a34a,#22c55e)",color:"#fff",marginLeft:"auto",padding:"10px 20px",display:"flex",alignItems:"center",gap:7,boxShadow:"0 4px 14px rgba(22,163,74,.35)"}}>
                <span style={{fontSize:17,lineHeight:1}}>+</span> Add User
              </button>
            </div>

            <div style={{display:"flex",gap:12,marginBottom:24}}>
              {[{label:"Citizens",value:citizens,color:"#10b981",icon:"👤"},{label:"Officers",value:officers,color:"#3b82f6",icon:"👮"},{label:"Workers",value:workers,color:"#f59e0b",icon:"🔧"},{label:"Admins",value:users.filter(u=>u.role==="admin").length,color:"#8b5cf6",icon:"🛡️"},{label:"Total",value:users.length,color:"#94a3b8",icon:"👥"}].map(s=>(
                <div key={s.label} style={{flex:1,background:"var(--bg-card)",borderRadius:14,padding:"16px 14px",border:`1.5px solid ${s.color}22`,textAlign:"center",position:"relative",overflow:"hidden"}}>
                  <div style={{position:"absolute",inset:0,background:`linear-gradient(135deg,${s.color}06,transparent)`}}/>
                  <div style={{fontSize:22,marginBottom:6}}>{s.icon}</div>
                  <div style={{fontSize:26,fontWeight:900,color:s.color,lineHeight:1}}>{s.value}</div>
                  <div style={{fontSize:11,color:"var(--text-muted)",fontWeight:600,marginTop:4}}>{s.label}</div>
                </div>
              ))}
            </div>

            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:20}}>
              {(["citizen","officer","worker"] as const).map(role=>{
                const roleData={citizen:{label:"Citizens",icon:"👤",color:"#10b981",bg:"rgba(16,185,129,.1)",border:"rgba(16,185,129,.25)"},officer:{label:"Officers",icon:"👮",color:"#3b82f6",bg:"rgba(59,130,246,.1)",border:"rgba(59,130,246,.25)"},worker:{label:"Field Workers",icon:"🔧",color:"#f59e0b",bg:"rgba(245,158,11,.1)",border:"rgba(245,158,11,.25)"}}[role];
                const filtered=users.filter(u=>u.role===role&&(!search||u.name.toLowerCase().includes(search.toLowerCase())||u.email.toLowerCase().includes(search.toLowerCase())));
                return(
                  <div key={role}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12,padding:"11px 14px",background:roleData.bg,borderRadius:12,border:`1.5px solid ${roleData.border}`}}>
                      <span style={{fontSize:18}}>{roleData.icon}</span>
                      <div>
                        <div style={{fontWeight:800,fontSize:13,color:roleData.color}}>{roleData.label}</div>
                        <div style={{fontSize:10,color:"var(--text-muted)"}}>{filtered.length} user{filtered.length!==1?"s":""}</div>
                      </div>
                    </div>
                    <div style={{display:"flex",flexDirection:"column",gap:8}}>
                      {filtered.map(u=><UserCard key={u.id} u={u} onToggle={toggleUser} onDelete={deleteUser}/>)}
                      {filtered.length===0&&<div style={{textAlign:"center",padding:"28px",color:"var(--text-muted)",fontSize:12,background:"var(--bg-card)",borderRadius:12,border:"1.5px dashed var(--border)"}}>
                        <div style={{fontSize:24,marginBottom:8}}>👻</div>
                        No {roleData.label.toLowerCase()} {search?"matching search":"registered"}
                      </div>}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Add User Modal */}
            {showAddUser&&(
              <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.65)",backdropFilter:"blur(8px)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
                <div style={{background:"var(--bg-card)",borderRadius:22,padding:30,width:"100%",maxWidth:480,border:"1px solid var(--border)",boxShadow:"0 32px 80px rgba(0,0,0,.25)",animation:"slideUp .3s ease"}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:22}}>
                    <div>
                      <div style={{fontWeight:900,fontSize:18,color:"var(--text-primary)"}}>➕ Add New User</div>
                      <div style={{fontSize:11.5,color:"var(--text-muted)",marginTop:3}}>Create a new portal account</div>
                    </div>
                    <button onClick={()=>setShowAddUser(false)} style={{width:32,height:32,borderRadius:10,background:"var(--bg-hover)",border:"1px solid var(--border)",cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center",color:"var(--text-muted)"}}>✕</button>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:14}}>
                    {[{p:"Full Name",k:"name",req:true},{p:"Email Address",k:"email",req:true},{p:"Phone Number",k:"phone"},{p:"Password",k:"password",req:true}].map(f=>(
                      <div key={f.k}>
                        <label style={{fontSize:11.5,fontWeight:700,color:"var(--text-muted)",marginBottom:5,display:"block"}}>{f.p}{f.req&&<span style={{color:"#ef4444"}}> *</span>}</label>
                        <input placeholder={f.p} type={f.k==="password"?"password":"text"}
                          value={(newUser as any)[f.k]} onChange={e=>setNewUser({...newUser,[f.k]:e.target.value})}
                          style={inp}/>
                      </div>
                    ))}
                    <div>
                      <label style={{fontSize:11.5,fontWeight:700,color:"var(--text-muted)",marginBottom:5,display:"block"}}>Role <span style={{color:"#ef4444"}}>*</span></label>
                      <select value={newUser.role} onChange={e=>setNewUser({...newUser,role:e.target.value as any})} style={{...inp}}>
                        {["citizen","officer","worker","admin"].map(r=><option key={r} value={r}>{ROLE_ICON[r]} {r.charAt(0).toUpperCase()+r.slice(1)}</option>)}
                      </select>
                    </div>
                    {(newUser.role==="officer"||newUser.role==="worker")&&(
                      <div>
                        <label style={{fontSize:11.5,fontWeight:700,color:"var(--text-muted)",marginBottom:5,display:"block"}}>Department <span style={{color:"#ef4444"}}>*</span></label>
                        <select value={newUser.department} onChange={e=>setNewUser({...newUser,department:e.target.value})} style={inp}>
                          <option value="">Select Department</option>
                          {Object.keys(DEPT_COLORS).map(d=><option key={d} value={d}>{d}</option>)}
                        </select>
                      </div>
                    )}
                  </div>
                  <div style={{display:"flex",gap:10,marginTop:24}}>
                    <button onClick={addUser} style={{...btn,flex:1,background:"linear-gradient(135deg,#16a34a,#22c55e)",color:"#fff",padding:"13px",boxShadow:"0 4px 14px rgba(22,163,74,.35)"}}>✓ Create User</button>
                    <button onClick={()=>setShowAddUser(false)} style={{...btn,flex:1,background:"var(--bg-card-alt)",color:"var(--text-secondary)",padding:"13px",border:"1.5px solid var(--border)"}}>Cancel</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── COMPLAINTS ── */}
        {page==="complaints"&&(
          <div style={{animation:"slideUp .3s ease"}}>
            <div style={{display:"flex",gap:12,marginBottom:20,flexWrap:"wrap",alignItems:"center"}}>
              <div style={{position:"relative",flex:1,maxWidth:320}}>
                <span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",color:"var(--text-muted)",fontSize:14}}>🔍</span>
                <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search complaints, users, tickets..." style={{...inp,paddingLeft:36}}/>
              </div>
              <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} style={{...inp,maxWidth:160}}>
                {["All","Pending","Assigned","In Progress","Resolved"].map(s=><option key={s} value={s}>{s}</option>)}
              </select>
              <div style={{marginLeft:"auto",fontSize:12,color:"var(--text-muted)",background:"var(--bg-card)",padding:"8px 14px",borderRadius:10,border:"1px solid var(--border)"}}>
                {filteredComplaints.length} result{filteredComplaints.length!==1?"s":""}
              </div>
            </div>
            <div style={card}>
              <div style={{padding:"13px 18px",borderBottom:"1px solid var(--border)",display:"grid",gridTemplateColumns:"140px 2fr 120px 140px 110px",gap:12,fontSize:10.5,color:"var(--text-muted)",fontWeight:800,textTransform:"uppercase",letterSpacing:".06em",background:"var(--bg-card-alt)"}}>
                <span>Ticket ID</span><span>Title / User</span><span>User</span><span>Department</span><span>Status</span>
              </div>
              {filteredComplaints.slice(0,50).map(c=>(
                <div key={c.id} onClick={()=>setSelectedC(c)} className="complaint-row" style={{padding:"13px 18px",borderBottom:"1px solid var(--border)",display:"grid",gridTemplateColumns:"140px 2fr 120px 140px 110px",gap:12,alignItems:"center",cursor:"pointer",transition:"background .15s"}}>
                  <span style={{fontSize:10.5,color:"var(--accent)",fontFamily:"monospace",fontWeight:700,background:"var(--accent-dim)",padding:"3px 8px",borderRadius:6,display:"inline-block"}}>{c.ticketId||c.id.slice(-8)}</span>
                  <div style={{minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:700,color:"var(--text-primary)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.title||c.category||"Untitled"}</div>
                    <div style={{fontSize:10.5,color:"var(--text-muted)",marginTop:1}}>{timeAgo(c.createdAt)}</div>
                  </div>
                  <span style={{fontSize:12,color:"var(--text-secondary)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.userName||"—"}</span>
                  <span style={{fontSize:11,color:DEPT_COLORS[c.department||""]||"var(--text-muted)",fontWeight:600}}>{DEPT_ICONS[c.department||""]||"🏛️"} {c.department||"—"}</span>
                  <span className={`badge-${c.status==="Resolved"?"resolved":c.status==="Pending"?"pending":c.emergency?"emergency":"progress"}`} style={{padding:"4px 11px",borderRadius:20,fontSize:10,fontWeight:700,display:"inline-block"}}>{c.status}</span>
                </div>
              ))}
              {filteredComplaints.length===0&&(
                <div style={{padding:60,textAlign:"center",color:"var(--text-muted)"}}>
                  <div style={{fontSize:36,marginBottom:12}}>🔍</div>
                  <div style={{fontSize:14,fontWeight:700,color:"var(--text-secondary)"}}>No complaints found</div>
                  <div style={{fontSize:12,marginTop:4}}>Try adjusting your search or filters</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── ANALYTICS ── */}
        {page==="analytics"&&(
          <div style={{animation:"slideUp .3s ease"}}>
            {/* Real-time summary from backend */}
            {analyticsData.summary&&(
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:20}}>
                {[
                  {l:"Total Complaints",v:analyticsData.summary.totalComplaints||total,c:"#3b82f6",icon:"📋"},
                  {l:"Resolution Rate",v:`${analyticsData.summary.resolutionRate||resRate}%`,c:"#10b981",icon:"✅"},
                  {l:"Avg Resolution",v:`${analyticsData.summary.avgResolutionHours||0}h`,c:"#8b5cf6",icon:"⏱️"},
                  {l:"Active Workers",v:analyticsData.summary.activeWorkers||workers,c:"#f59e0b",icon:"🔧"},
                ].map(s=>(
                  <div key={s.l} style={{background:"var(--bg-card)",borderRadius:14,padding:"16px",border:`1px solid ${s.c}22`}}>
                    <div style={{fontSize:20,marginBottom:8}}>{s.icon}</div>
                    <div style={{fontSize:24,fontWeight:900,color:s.c}}>{s.v}</div>
                    <div style={{fontSize:11,color:"var(--text-muted)",marginTop:4}}>{s.l}</div>
                  </div>
                ))}
              </div>
            )}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,marginBottom:20}}>
              <div style={card}>
                <div className="section-header">
                  <div style={{fontWeight:700,fontSize:14,color:"var(--text-primary)"}}>📊 Status Distribution</div>
                </div>
                <div style={{padding:"16px 20px 20px"}}><BarChart data={statusData} color="#8b5cf6"/></div>
              </div>
              <div style={card}>
                <div className="section-header">
                  <div style={{fontWeight:700,fontSize:14,color:"var(--text-primary)"}}>📅 Weekly Submissions</div>
                </div>
                <div style={{padding:"16px 20px 20px"}}><BarChart data={weeklyTrend} color="#10b981"/></div>
              </div>
            </div>
            <div style={{...card,marginBottom:20}}>
              <div className="section-header">
                <div style={{fontWeight:700,fontSize:14,color:"var(--text-primary)"}}>🏢 Department Workload</div>
              </div>
              <div style={{padding:"20px",display:"flex",flexDirection:"column",gap:12}}>
                {deptBreakdown.map(([dept,count])=>(
                  <div key={dept} style={{display:"flex",alignItems:"center",gap:14}}>
                    <span style={{width:28,fontSize:18,textAlign:"center",flexShrink:0}}>{DEPT_ICONS[dept]||"🏛️"}</span>
                    <span style={{width:200,fontSize:13,color:"var(--text-secondary)",fontWeight:500,flexShrink:0}}>{dept}</span>
                    <div style={{flex:1,height:8,background:"var(--bg-hover)",borderRadius:4,overflow:"hidden"}}>
                      <div style={{height:8,borderRadius:4,background:`linear-gradient(90deg,${DEPT_COLORS[dept]||"#94a3b8"},${DEPT_COLORS[dept]||"#94a3b8"}88)`,width:`${(count/Math.max(total,1))*100}%`,transition:"width .6s cubic-bezier(.4,0,.2,1)"}}/>
                    </div>
                    <span style={{width:40,fontSize:13,fontWeight:800,color:"var(--text-primary)",textAlign:"right",flexShrink:0}}>{count}</span>
                    <span style={{width:44,fontSize:11,color:"var(--text-muted)",textAlign:"right",flexShrink:0}}>{total>0?Math.round((count/total)*100):0}%</span>
                  </div>
                ))}
                {deptBreakdown.length===0&&<div style={{textAlign:"center",padding:20,color:"var(--text-muted)",fontSize:12}}>No data available</div>}
              </div>
            </div>
            <div style={card}>
              <div className="section-header">
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:18}}>🤖</span>
                  <div style={{fontWeight:700,fontSize:14,color:"var(--text-primary)"}}>AI Insights</div>
                </div>
              </div>
              <div style={{padding:20,display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:14}}>
                {[
                  {icon:"🔮",title:"Top Issue Dept",value:deptBreakdown[0]?.[0]||"None",sub:"Most reported",color:"#8b5cf6"},
                  {icon:"⚡",title:"Resolution Rate",value:`${resRate}%`,sub:resRate>60?"Above average ✓":"Needs improvement",color:resRate>60?"#10b981":"#f59e0b"},
                  {icon:"📈",title:"Active Cases",value:pending+inProgress,sub:"Requiring attention",color:"#3b82f6"},
                  {icon:"🚨",title:"Emergency Rate",value:`${total>0?Math.round((emergency/total)*100):0}%`,sub:"Of total complaints",color:"#ef4444"},
                  {icon:"👥",title:"Active Users",value:users.filter(u=>u.active!==false).length,sub:`of ${users.length} registered`,color:"#10b981"},
                  {icon:"🏆",title:"Lowest Load",value:deptBreakdown.length>0?deptBreakdown[deptBreakdown.length-1][0]:"—",sub:"Least complaints",color:"#f59e0b"},
                ].map((item,i)=>(
                  <div key={i} style={{background:"var(--bg-card-alt)",borderRadius:14,padding:18,border:`1px solid ${item.color}20`,position:"relative",overflow:"hidden"}}>
                    <div style={{position:"absolute",right:-8,top:-8,width:60,height:60,borderRadius:"50%",background:`${item.color}10`}}/>
                    <div style={{fontSize:22,marginBottom:10}}>{item.icon}</div>
                    <div style={{fontSize:11,color:"var(--text-muted)",fontWeight:700,marginBottom:4,textTransform:"uppercase",letterSpacing:".05em"}}>{item.title}</div>
                    <div style={{fontSize:18,fontWeight:900,color:item.color,lineHeight:1,marginBottom:4}}>{item.value}</div>
                    <div style={{fontSize:11,color:"var(--text-secondary)"}}>{item.sub}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── DEPARTMENTS ── */}
        {page==="departments"&&(
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,animation:"slideUp .3s ease"}}>
            {Object.entries(DEPT_COLORS).map(([dept,color])=>{
              const dc=complaints.filter(c=>c.department===dept);
              const dp=dc.filter(c=>c.status==="Pending").length;
              const dr=dc.filter(c=>c.status==="Resolved").length;
              const officerList=users.filter(u=>u.role==="officer"&&u.department===dept);
              const workerList=users.filter(u=>u.role==="worker"&&u.department===dept);
              const resolvedPct=dc.length>0?Math.round((dr/dc.length)*100):0;
              return(
                <div key={dept} style={{background:"var(--bg-card)",borderRadius:18,padding:22,border:`1px solid ${color}28`,transition:"all .22s",cursor:"default",position:"relative",overflow:"hidden"}}
                  onMouseOver={e=>{(e.currentTarget as HTMLDivElement).style.boxShadow=`0 12px 40px ${color}25`;(e.currentTarget as HTMLDivElement).style.transform="translateY(-2px)";}}
                  onMouseOut={e=>{(e.currentTarget as HTMLDivElement).style.boxShadow="none";(e.currentTarget as HTMLDivElement).style.transform="translateY(0)";}}>
                  <div style={{position:"absolute",right:-20,top:-20,width:100,height:100,borderRadius:"50%",background:`${color}08`}}/>
                  <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:18}}>
                    <div style={{width:48,height:48,borderRadius:14,background:`${color}20`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,border:`1.5px solid ${color}30`,boxShadow:`0 4px 12px ${color}25`,flexShrink:0}}>{DEPT_ICONS[dept]||"🏛️"}</div>
                    <div>
                      <div style={{fontWeight:800,fontSize:14.5,color:"var(--text-primary)"}}>{dept}</div>
                      <div style={{fontSize:11,color:"var(--text-muted)",marginTop:2}}>
                        {officerList.length > 0 ? `${officerList.length} officer${officerList.length!==1?"s":""} · ` : ""}
                        {workerList.length > 0 ? `${workerList.length} worker${workerList.length!==1?"s":""}` : ""}
                        {officerList.length===0&&workerList.length===0?"No staff assigned":""}
                      </div>
                    </div>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:16}}>
                    {[{l:"Total",v:dc.length,c:"var(--text-primary)"},{l:"Pending",v:dp,c:"#f59e0b"},{l:"Resolved",v:dr,c:"#10b981"}].map(s=>(
                      <div key={s.l} style={{background:"var(--bg-card-alt)",borderRadius:10,padding:"10px",textAlign:"center",border:"1px solid var(--border)"}}>
                        <div style={{fontSize:20,fontWeight:900,color:s.c}}>{s.v}</div>
                        <div style={{fontSize:10,color:"var(--text-muted)",fontWeight:600,marginTop:2}}>{s.l}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{marginBottom:6}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                      <span style={{fontSize:11,color:"var(--text-muted)"}}>Resolution Progress</span>
                      <span style={{fontSize:11,fontWeight:800,color:color}}>{resolvedPct}%</span>
                    </div>
                    <div style={{height:6,background:"var(--bg-card-alt)",borderRadius:3,border:"1px solid var(--border)"}}>
                      <div style={{height:"100%",borderRadius:3,background:`linear-gradient(90deg,${color},${color}99)`,width:`${resolvedPct}%`,transition:"width .6s cubic-bezier(.4,0,.2,1)",boxShadow:`0 2px 6px ${color}50`}}/>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── SYSTEM ── */}
        {page==="system"&&(
          <div style={{animation:"slideUp .3s ease"}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:20}}>
              {[
                {icon:"🟢",label:"Frontend Server",status:"Online",detail:"localhost:5173 · Vite + React",color:"#10b981"},
                {icon:"🟢",label:"Backend API",status:"Connected",detail:"http://localhost:3001/api · MySQL + Express",color:"#10b981"},
                {icon:"💾",label:"Local Storage",status:"Active",detail:`${complaints.length} complaints · ${users.length} users`,color:"#10b981"},
                {icon:"🤖",label:"AI Routing",status:"Active",detail:"Rule-based department routing enabled",color:"#10b981"},
              ].map((s,i)=>(
                <div key={i} style={{...card,padding:20,display:"flex",alignItems:"center",gap:14}}>
                  <div style={{width:48,height:48,borderRadius:14,background:`${s.color}18`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,border:`1px solid ${s.color}25`,flexShrink:0}}>{s.icon}</div>
                  <div>
                    <div style={{fontWeight:700,fontSize:14,color:"var(--text-primary)"}}>{s.label}</div>
                    <div style={{fontSize:11.5,color:s.color,fontWeight:700,marginTop:2}}>● {s.status}</div>
                    <div style={{fontSize:11,color:"var(--text-muted)",marginTop:2}}>{s.detail}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{...card,marginBottom:20}}>
              <div className="section-header">
                <div style={{fontWeight:700,fontSize:14,color:"var(--text-primary)"}}>⚙️ Feature Toggles</div>
              </div>
              <div style={{padding:20,display:"flex",flexDirection:"column",gap:12}}>
                {[
                  {label:"AI Department Routing",desc:"Auto-route complaints to the right department",enabled:true},
                  {label:"Emergency Alerts",desc:"Instant notifications for emergency complaints",enabled:true},
                  {label:"Duplicate Detection",desc:"Warn when similar complaints are submitted",enabled:true},
                  {label:"Worker Auto-Assignment",desc:"Auto-assign workers based on availability",enabled:false},
                  {label:"SMS Notifications",desc:"Send SMS status updates to citizens",enabled:false},
                ].map((cfg,i)=>(
                  <div key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 16px",background:"var(--bg-card-alt)",borderRadius:12,border:"1px solid var(--border)"}}>
                    <div>
                      <div style={{fontWeight:700,fontSize:13,color:"var(--text-primary)"}}>{cfg.label}</div>
                      <div style={{fontSize:11,color:"var(--text-muted)",marginTop:2}}>{cfg.desc}</div>
                    </div>
                    <div style={{width:44,height:24,borderRadius:12,background:cfg.enabled?"#10b981":"var(--border-strong)",position:"relative",cursor:"pointer",transition:"background .2s",flexShrink:0}}>
                      <div style={{position:"absolute",width:18,height:18,borderRadius:"50%",background:"#fff",top:3,left:cfg.enabled?23:3,transition:"left .2s",boxShadow:"0 1px 4px rgba(0,0,0,.2)"}}/>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div style={card}>
              <div className="section-header">
                <div style={{fontWeight:700,fontSize:14,color:"var(--text-primary)"}}>📊 Storage Usage</div>
              </div>
              <div style={{padding:20,display:"flex",flexDirection:"column",gap:10}}>
                {[
                  {label:"complaints_all",value:complaints.length,unit:"records",color:"#3b82f6"},
                  {label:"ap_registered_users",value:users.length,unit:"users",color:"#10b981"},
                  {label:"localStorage used",value:Math.round(JSON.stringify(localStorage).length/1024),unit:"KB",color:"#8b5cf6"},
                ].map((s,i)=>(
                  <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"11px 14px",background:"var(--bg-card-alt)",borderRadius:10,border:"1px solid var(--border)"}}>
                    <span style={{fontFamily:"'Courier New',monospace",fontSize:12,color:"var(--text-muted)"}}>{s.label}</span>
                    <span style={{fontSize:13,fontWeight:800,color:s.color}}>{s.value} <span style={{fontSize:10,fontWeight:500,color:"var(--text-muted)"}}>{s.unit}</span></span>
                  </div>
                ))}
                <button onClick={()=>{if(confirm("Clear all complaints? This cannot be undone.")){localStorage.removeItem("complaints_all");setComplaints([]);showToast("Complaints cleared","info");}}}
                  style={{...btn,background:"rgba(239,68,68,.1)",color:"#ef4444",marginTop:8,border:"1px solid rgba(239,68,68,.2)",alignSelf:"flex-start",padding:"9px 18px"}}>
                  🗑️ Clear All Complaints
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── FOOTER (dashboard-only, below all page content) ── */}
      <footer style={{background:"var(--footer-bg)",color:"#94a3b8",padding:"44px 28px 22px",marginTop:48}}>
        <div style={{maxWidth:1440,margin:"0 auto"}}>
          <div style={{display:"grid",gridTemplateColumns:"2.2fr 1fr 1fr 1fr",gap:40,marginBottom:36}}>
            {/* Brand column */}
            <div>
              <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
                <div style={{width:46,height:46,borderRadius:12,background:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  <img src="/ap-bg.png" style={{width:46,height:46,objectFit:"contain",opacity:.92}} alt="AP Seal"/>
                </div>
                <div>
                  <div style={{fontSize:14,fontWeight:900,color:"#f1f5f9",letterSpacing:"-.01em",lineHeight:1}}>CivicConnect</div>
                  <div style={{fontSize:9,color:"#475569",letterSpacing:".1em",textTransform:"uppercase",marginTop:3,fontWeight:700}}>LIVE • CIVICCONNECT PLATFORM</div>
                </div>
              </div>
              <p style={{fontSize:12.5,lineHeight:1.75,color:"#475569",maxWidth:260,margin:"0 0 16px"}}>Empowering citizens through transparent, accessible, and responsive digital governance across National Civic Network.</p>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                {["🚨 112","📞 1800-425-0082"].map((t:string)=>(
                  <span key={t} style={{fontSize:11,fontWeight:700,color:"#86efac",background:"rgba(22,163,74,.12)",borderRadius:7,padding:"5px 12px",border:"1px solid rgba(22,163,74,.2)"}}>{t}</span>
                ))}
              </div>
            </div>
            {/* Link columns */}
            {([{title:"Portal",links:["Report Issue","Track Complaint","Safety Alerts","Emergency Contacts"]},{title:"Government",links:["About City","District Info","Public Records","Transparency"]},{title:"Support",links:["Help Center","Contact Us","Privacy Policy","Terms of Use"]}] as {title:string;links:string[]}[]).map(col=>(
              <div key={col.title}>
                <div style={{fontSize:10.5,fontWeight:800,color:"#e2e8f0",letterSpacing:".12em",marginBottom:16,textTransform:"uppercase"}}>{col.title}</div>
                {col.links.map((link:string)=>(
                  <a key={link} href="#" style={{display:"block",fontSize:12.5,color:"#475569",textDecoration:"none",marginBottom:10,transition:"color .2s"}}
                    onMouseEnter={e=>(e.currentTarget.style.color="#22c55e")}
                    onMouseLeave={e=>(e.currentTarget.style.color="#475569")}>{link}</a>
                ))}
              </div>
            ))}
          </div>
          <div style={{borderTop:"1px solid #1e293b",paddingTop:20,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
            <span style={{fontSize:11.5,color:"#334155"}}>© 2026 Smart Governance & Citizen Services Platform. All rights reserved.</span>
            <span style={{fontSize:11.5,color:"#334155"}}>Designed for the citizens of National Civic Network 🇮🇳</span>
          </div>
        </div>
      </footer>

      {/* ── COMPLAINT DETAIL SIDE PANEL ── */}
      {selectedC&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.7)",zIndex:1000,display:"flex",alignItems:"stretch",justifyContent:"flex-end",backdropFilter:"blur(6px)"}}
          onClick={e=>{if(e.target===e.currentTarget){setSelectedC(null);setAdminNote("");}}}>
          <div style={{width:"min(660px,100vw)",background:"var(--bg-card)",height:"100vh",overflowY:"auto",boxShadow:"-24px 0 80px rgba(0,0,0,.4)",animation:"slideFromRight .3s cubic-bezier(.4,0,.2,1)",paddingTop:64,display:"flex",flexDirection:"column"}}>
            {/* Panel Header */}
            <div style={{padding:"20px 24px",borderBottom:"1px solid var(--border)",flexShrink:0,background:"var(--bg-card-alt)"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                <div style={{flex:1,minWidth:0,marginRight:12}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                    <span style={{fontSize:10,color:"var(--accent)",fontFamily:"monospace",background:"var(--accent-dim)",padding:"3px 10px",borderRadius:6,fontWeight:700}}>{selectedC.ticketId||selectedC.id}</span>
                    {selectedC.emergency&&<span style={{fontSize:10,color:"#ef4444",background:"rgba(239,68,68,.1)",padding:"3px 10px",borderRadius:6,fontWeight:700,border:"1px solid rgba(239,68,68,.2)"}}>🚨 EMERGENCY</span>}
                  </div>
                  <div style={{fontSize:19,fontWeight:900,color:"var(--text-primary)",marginBottom:4,lineHeight:1.3}}>{selectedC.title||selectedC.category||"Complaint"}</div>
                  <div style={{fontSize:12,color:"var(--text-muted)"}}>{DEPT_ICONS[selectedC.department||""]||"🏛️"} {selectedC.department||"General"} · 👤 {selectedC.userName||"Citizen"}</div>
                </div>
                <button onClick={()=>setSelectedC(null)} style={{width:34,height:34,borderRadius:10,background:"var(--bg-hover)",border:"1px solid var(--border)",cursor:"pointer",fontSize:14,color:"var(--text-muted)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>✕</button>
              </div>
            </div>

            <div style={{padding:"20px 24px",flex:1,display:"flex",flexDirection:"column",gap:18,overflowY:"auto"}}>
              {/* Status buttons */}
              <div>
                <div style={{fontSize:11,fontWeight:700,color:"var(--text-muted)",marginBottom:10,textTransform:"uppercase",letterSpacing:".08em"}}>Update Status</div>
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  {[{s:"Pending",icon:"🟡",c:"#f59e0b"},{s:"Assigned",icon:"📋",c:"#8b5cf6"},{s:"In Progress",icon:"🔵",c:"#3b82f6"},{s:"Resolved",icon:"✅",c:"#10b981"}].map(({s:st,icon,c})=>(
                    <button key={st} onClick={async()=>{
  try{ await adminFetch(`/complaints/${selectedC.id}/status`,{method:"PATCH",body:JSON.stringify({status:st})}); }catch{}
  setComplaints(prev=>prev.map(c=>c.id===selectedC.id?{...c,status:st,updatedAt:new Date().toISOString()}:c));
  setSelectedC({...selectedC,status:st});
  showToast(`Status → ${st}`);}}
                      style={{padding:"7px 14px",borderRadius:9,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",border:`1.5px solid ${selectedC.status===st?c+"66":"var(--border)"}`,background:selectedC.status===st?c+"18":"var(--bg-card-alt)",color:selectedC.status===st?c:"var(--text-muted)",transition:"all .15s"}}>
                      {icon} {st}
                    </button>
                  ))}
                </div>
              </div>

              {/* Details */}
              <div style={{background:"var(--bg-card-alt)",borderRadius:14,padding:"16px 18px",border:"1px solid var(--border)"}}>
                <div style={{fontSize:11,fontWeight:700,color:"var(--text-muted)",marginBottom:12,textTransform:"uppercase",letterSpacing:".08em"}}>Complaint Details</div>
                {[
                  {l:"Description",v:selectedC.description||"No description provided"},
                  {l:"Status",v:selectedC.status},{l:"Priority",v:selectedC.priority||"Normal"},
                  {l:"Department",v:selectedC.department||"—"},
                  {l:"Location",v:selectedC.address||"Not specified"},
                  {l:"Assigned To",v:selectedC.assignedOfficer||"Not assigned"},
                  {l:"Submitted",v:selectedC.createdAt?new Date(selectedC.createdAt).toLocaleString("en-IN"):"—"},
                ].map(row=>(
                  <div key={row.l} style={{display:"flex",padding:"8px 0",borderBottom:"1px solid var(--border)"}}>
                    <div style={{width:130,fontSize:11.5,color:"var(--text-muted)",fontWeight:700,flexShrink:0}}>{row.l}</div>
                    <div style={{flex:1,fontSize:12.5,color:"var(--text-primary)",lineHeight:1.5}}>{row.v}</div>
                  </div>
                ))}
              </div>

              {/* Assign officer */}
              <div style={{background:"var(--bg-card-alt)",borderRadius:14,padding:"16px 18px",border:"1px solid var(--border)"}}>
                <div style={{fontSize:11,fontWeight:700,color:"var(--text-muted)",marginBottom:12,textTransform:"uppercase",letterSpacing:".08em"}}>Assign Officer</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                  {users.filter(u=>u.role==="officer").map(u=>(
                    <button key={u.id} onClick={async()=>{
                    try{
                      await adminFetch(`/complaints/${selectedC.id}/assign`,{method:"POST",body:JSON.stringify({worker_id:u.id})});
                    }catch{}
                    setComplaints(prev=>prev.map(c=>c.id===selectedC.id?{...c,assignedOfficer:u.name,status:"Assigned",updatedAt:new Date().toISOString()}:c));
                    setSelectedC({...selectedC,assignedOfficer:u.name,status:"Assigned"});
                    showToast(`Assigned to ${u.name}`);}}
                      style={{padding:"7px 14px",borderRadius:9,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",background:selectedC.assignedOfficer===u.name?"linear-gradient(135deg,#16a34a,#22c55e)":"var(--bg-card)",border:`1.5px solid ${selectedC.assignedOfficer===u.name?"var(--accent)":"var(--border)"}`,color:selectedC.assignedOfficer===u.name?"#fff":"var(--text-secondary)",transition:"all .15s"}}>
                      👮 {u.name}
                    </button>
                  ))}
                  {users.filter(u=>u.role==="officer").length===0&&<span style={{fontSize:12,color:"var(--text-muted)",fontStyle:"italic"}}>No officers available. Add officers in the Users tab.</span>}
                </div>
              </div>

              {/* Admin note */}
              <div style={{background:"var(--bg-card-alt)",borderRadius:14,padding:"16px 18px",border:"1px solid var(--border)"}}>
                <div style={{fontSize:11,fontWeight:700,color:"var(--text-muted)",marginBottom:12,textTransform:"uppercase",letterSpacing:".08em"}}>📝 Admin Notes</div>
                <textarea value={adminNote} onChange={e=>setAdminNote(e.target.value)} placeholder="Add an internal note for this complaint..." rows={3} style={{width:"100%",padding:"11px 13px",borderRadius:10,border:"1.5px solid var(--border)",background:"var(--bg-input)",color:"var(--text-primary)",fontSize:13,resize:"vertical",outline:"none",fontFamily:"inherit",boxSizing:"border-box",transition:"border-color .2s"}}/>
                <button onClick={()=>{if(adminNote.trim()){setAdminNotesList(p=>[...p,{id:`n-${Date.now()}`,text:adminNote,time:new Date().toLocaleString("en-IN")}]);setAdminNote("");showToast("Note saved");}}}
                  style={{marginTop:10,padding:"9px 18px",borderRadius:9,background:"var(--accent)",color:"#fff",border:"none",fontSize:12.5,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                  Save Note
                </button>
                {adminNotesList.slice(-3).map(n=>(
                  <div key={n.id} style={{marginTop:10,padding:"10px 13px",background:"rgba(234,179,8,.08)",borderRadius:10,border:"1px solid rgba(234,179,8,.18)"}}>
                    <div style={{fontSize:12.5,color:"var(--text-primary)",lineHeight:1.5}}>{n.text}</div>
                    <div style={{fontSize:10,color:"var(--text-muted)",marginTop:4}}>{n.time}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Panel Footer */}
            <div style={{padding:"16px 24px",borderTop:"1px solid var(--border)",display:"flex",gap:10,flexShrink:0,background:"var(--bg-card-alt)"}}>
              <button onClick={async()=>{
  try{ await adminFetch(`/complaints/${selectedC.id}/status`,{method:"PATCH",body:JSON.stringify({status:"Resolved"})}); }catch{}
  setComplaints(prev=>prev.map(c=>c.id===selectedC.id?{...c,status:"Resolved",updatedAt:new Date().toISOString()}:c));
  setSelectedC(null);
  showToast("Complaint resolved ✓");}}
                style={{flex:1,padding:"12px",borderRadius:11,background:"linear-gradient(135deg,#10b981,#059669)",border:"none",color:"#fff",fontSize:13,fontWeight:800,cursor:"pointer",fontFamily:"inherit",boxShadow:"0 4px 14px rgba(16,185,129,.35)"}}>✅ Mark as Resolved</button>
              <button onClick={()=>setSelectedC(null)} style={{padding:"12px 22px",borderRadius:11,background:"var(--bg-card)",border:"1.5px solid var(--border)",color:"var(--text-muted)",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ── LOGOUT SCREEN ── */}
      {showLogoutScreen&&(
        <div style={{position:"fixed",inset:0,zIndex:9999,background:"linear-gradient(135deg,#06100d,#0d2b1a,#0c1f14)",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:22}}>
          <div style={{width:88,height:88,borderRadius:24,background:"transparent",display:"flex",alignItems:"center",justifyContent:"center",animation:"pulse 2s ease-in-out infinite"}}>
            <img src="/ap-seal.png" style={{width:80,height:80,objectFit:"contain"}} alt="CivicConnect Seal"/>
          </div>
          <div style={{textAlign:"center"}}>
            <div style={{fontSize:28,fontWeight:900,color:"#fff",marginBottom:6,letterSpacing:"-.02em"}}>Signing Out</div>
            <div style={{fontSize:14,color:"rgba(255,255,255,.5)"}}>CivicConnect Admin Portal · {user?.name||"Admin"}</div>
          </div>
          <div style={{display:"flex",gap:12,marginTop:8}}>
            <button onClick={()=>setShowLogoutScreen(false)} style={{padding:"12px 26px",borderRadius:13,background:"rgba(255,255,255,.08)",border:"1px solid rgba(255,255,255,.15)",color:"rgba(255,255,255,.8)",fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit",transition:"all .2s"}}
              onMouseOver={e=>(e.currentTarget.style.background="rgba(255,255,255,.15)")}
              onMouseOut={e=>(e.currentTarget.style.background="rgba(255,255,255,.08)")}>Stay Logged In</button>
            <button onClick={()=>{dispatch(logout());navigate("/login");}} style={{padding:"12px 28px",borderRadius:13,background:"linear-gradient(135deg,#ef4444,#dc2626)",border:"none",color:"#fff",fontSize:14,fontWeight:800,cursor:"pointer",fontFamily:"inherit",boxShadow:"0 6px 20px rgba(239,68,68,.45)"}}>→ Sign Out</button>
          </div>
        </div>
      )}
    </div>
  );
}