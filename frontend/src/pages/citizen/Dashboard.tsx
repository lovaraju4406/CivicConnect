import { Link, useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import type { RootState } from "../../store";
import { markAllRead, clearNotifications } from "../../store/notificationSlice";
import { logout } from "../../store/authSlice";
import { clearComplaints } from "../../store/complaintSlice";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import CitizenEmergencySection from "../../features/dashboard/Citizenemergencysection";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:"https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl:"https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:"https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
interface Complaint {
  id:string; ticketId?:string; title?:string; category?:string; description?:string;
  status:string; department?:string; userName?:string; userId?:string;
  address?:string; image?:string; createdAt:string; updatedAt?:string;
  assignedOfficer?:string; officerNote?:string; escalated?:boolean;
  escalationReason?:string; lat?:number; lng?:number; aiRouted?:boolean;
  aiRoutingReason?:string; emergency?:boolean; priority?:string;
  timeline?:TimelineEvent[]; feedback?:Feedback; duplicateOf?:string;
  workerUpdates?:WorkerUpdate[];
}
interface TimelineEvent { id:string; event:string; note?:string; actor?:string; time:string; icon:string; color:string; }
interface Feedback { rating:number; comment:string; submittedAt:string; }
interface WorkerUpdate { id:string; note:string; worker:string; time:string; progress?:number; }
interface CitizenNotif { id:string; message:string; type:"status"|"officer"|"note"|"escalated"|"resolved"|"alert"|"duplicate"; complaintId:string; ticketId?:string; read:boolean; time:string; urgent?:boolean; }
interface AreaAlert { id:string; title:string; type:"flood"|"power"|"accident"|"fire"|"health"; severity:"critical"|"warning"|"info"; distance:string; lat:number; lng:number; time:string; }
interface NearbyDuplicate { id:string; title:string; distance:string; status:string; }

// ─────────────────────────────────────────────────────────────────────────────
// AI ROUTING ENGINE
// ─────────────────────────────────────────────────────────────────────────────
const DEPT_ICON:Record<string,string> = { "Electricity":"⚡","Water Works":"💧","Sanitation":"🗑️","Roads & Infrastructure":"🛣️","Police":"👮","Fire Department":"🔥","General Civic":"🏛️" };
const DEPT_COLOR:Record<string,string> = { "Electricity":"#f59e0b","Water Works":"#3b82f6","Sanitation":"#10b981","Roads & Infrastructure":"#8b5cf6","Police":"#1d4ed8","Fire Department":"#ef4444","General Civic":"var(--text-muted)" };
const DEPT_KEYWORDS:Record<string,string[]> = {
  "Electricity":["power","electricity","light","streetlight","transformer","wire","voltage","outage","blackout","electric","shock","current","meter","pole","wiring"],
  "Water Works":["water","pipe","leak","flood","drain","sewage","tap","supply","bore","overflow","contamination","muddy","pump","canal","plumbing"],
  "Sanitation":["garbage","waste","trash","litter","smell","stench","dump","sanitation","hygiene","dirty","clean","rubbish","bin","compost","sweeping"],
  "Roads & Infrastructure":["road","pothole","bridge","footpath","pavement","traffic","signal","construction","crack","repair","highway","street","divider","median","sidewalk"],
  "Police":["theft","crime","accident","assault","robbery","noise","illegal","police","law","fight","dispute","harassment","vandalism","trespassing","drunk"],
  "Fire Department":["fire","smoke","burn","flame","explosion","gas","hazard","emergency","blaze","combustion","cylinder"],
};

function aiRouteDepartment(c:Partial<Complaint>):{department:string;confidence:number;reason:string;suggestedCategory:string} {
  const text=[c.title,c.description,c.category].filter(Boolean).join(" ").toLowerCase();
  let bestDept="General Civic",bestScore=0,bestReason="No specific keywords matched",sugCat="General";
  for(const [dept,kws] of Object.entries(DEPT_KEYWORDS)){
    const m=kws.filter(k=>text.includes(k));
    if(m.length>bestScore){bestScore=m.length;bestDept=dept;bestReason=`Matched: ${m.slice(0,3).join(", ")}`;sugCat=dept;}
  }
  if(bestScore===0&&c.category){
    const cat=c.category.toLowerCase();
    if(cat.includes("road")){bestDept="Roads & Infrastructure";sugCat="Road Damage";}
    else if(cat.includes("water")){bestDept="Water Works";sugCat="Water Supply";}
    else if(cat.includes("electric")){bestDept="Electricity";sugCat="Power Issue";}
    else if(cat.includes("sanitation")){bestDept="Sanitation";sugCat="Waste Management";}
  }
  return{department:bestDept,confidence:bestScore===0?60:Math.min(95,65+bestScore*8),reason:bestReason,suggestedCategory:sugCat};
}

function detectDuplicates(newC:Partial<Complaint>,existing:Complaint[]):NearbyDuplicate[] {
  if(!newC.lat||!newC.lng)return[];
  const text=(newC.description||"").toLowerCase();
  return existing.filter(c=>{
    if(!c.lat||!c.lng)return false;
    const dist=getDistanceKm(newC.lat!,newC.lng!,c.lat,c.lng);
    if(dist>0.3)return false;
    const cText=(c.description||"").toLowerCase();
    const words=text.split(" ").filter(w=>w.length>4);
    const matches=words.filter(w=>cText.includes(w)).length;
    return matches>2||c.category===newC.category;
  }).slice(0,3).map(c=>({id:c.id,title:c.title||c.category||"Nearby issue",distance:`${(getDistanceKm(newC.lat!,newC.lng!,c.lat!,c.lng!)*1000).toFixed(0)}m away`,status:c.status}));
}

// ─────────────────────────────────────────────────────────────────────────────
// STORAGE
// ─────────────────────────────────────────────────────────────────────────────
const AUTH_KEY="ap_portal_auth";
function lsSave(k:string,v:any){try{localStorage.setItem(k,JSON.stringify(v));}catch{}}
function lsLoad<T>(k:string):T|null{try{const r=localStorage.getItem(k);return r?JSON.parse(r):null;}catch{return null;}}
function lsRemove(k:string){try{localStorage.removeItem(k);}catch{}}
// ── BACKEND SYNC ─────────────────────────────────────────────────────────────
// Server runs at localhost:3001 — works across ALL browsers
const API = "http://localhost:3001/api";

function loadAllComplaints():Complaint[]{
  // Sync localStorage read — backend calls are handled separately via useEffect
  try{
    const raw = localStorage.getItem("complaints_all");
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  }catch{ return []; }
}

// Async version for background refresh — call only inside useEffect
async function fetchComplaintsFromServer():Promise<Complaint[]>{
  try{
    const token = JSON.parse(localStorage.getItem("auth") || "{}").token;
    if(!token) return loadAllComplaints();
    const res = await fetch(`${API}/complaints/mine`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if(!res.ok) throw new Error(`Server error: ${res.status}`);
    const json = await res.json();
    // /mine returns: { success: true, data: [...] }
    const raw = json?.data?.complaints ?? json?.data ?? json;
    const arr = Array.isArray(raw) ? raw : [];
    // Normalise backend field names to match frontend Complaint type
    const normalised = arr.map((c: any) => ({
      ...c,
      id:            c.id,
      ticketId:      c.ticket_id   ?? c.ticketId,
      title:         c.title,
      description:   c.description,
      category:      c.category    ?? c.department,
      department:    c.department,
      status:        c.status,
      address:       c.address,
      lat:           c.lat         ? parseFloat(c.lat) : undefined,
      lng:           c.lng         ? parseFloat(c.lng) : undefined,
      image:         c.image_url   ?? c.image,
      emergency:     c.is_emergency === 1 || c.is_emergency === true,
      userId:        c.user_id     ?? c.userId,
      userName:      c.user_name   ?? c.userName,
      assignedOfficer: c.assigned_name ?? c.assignedOfficer,
      createdAt:     c.created_at  ?? c.createdAt  ?? new Date().toISOString(),
      updatedAt:     c.updated_at  ?? c.updatedAt,
      rating:        c.rating,
      aiRouted:      c.aiRouted    ?? false,
    }));
    if(normalised.length >= 0){
      localStorage.setItem("complaints_all", JSON.stringify(normalised));
    }
    return normalised;
  }catch(e){
    console.warn("[fetchComplaintsFromServer] failed:", e);
    return loadAllComplaints();
  }
}

async function persistComplaint(c:Complaint):Promise<any>{
  const now = new Date().toISOString();
  const fresh:Complaint = {...c, updatedAt: now};

  // 1. Save to real backend with JWT auth
  const _tok = JSON.parse(localStorage.getItem("auth") || "{}").token;
  if(_tok){
    try{
      const res = await fetch(`${API}/complaints`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${_tok}` },
        body: JSON.stringify({
          title:            fresh.title        || fresh.category || "Civic Issue",
          description:      fresh.description  || "No description provided",
          department:       fresh.department   || "General Civic",
          address:          fresh.address      || "Unknown location",
          lat:              typeof fresh.lat === "number" ? fresh.lat : 0,
          lng:              typeof fresh.lng === "number" ? fresh.lng : 0,
          is_emergency:     fresh.emergency    ?? false,
          emergency_reason: (fresh as any).escalationReason || undefined,
        }),
      });
      const d = await res.json();
      if(d?.success){
        console.log("[SYNC→SERVER] ✅ Saved to MySQL:", d?.data?.ticket_id);
        // Update local copy with real ticket_id from MySQL
        const realTicketId = d?.data?.ticket_id;
        if(realTicketId){
          try{
            const raw = localStorage.getItem("complaints_all");
            const all:Complaint[] = raw ? JSON.parse(raw) : [];
            const idx = all.findIndex(x => x.id === fresh.id);
            if(idx >= 0){ all[idx] = {...all[idx], ticketId: realTicketId}; }
            else { all.unshift({...fresh, ticketId: realTicketId}); }
            localStorage.setItem("complaints_all", JSON.stringify(all));
          }catch{}
        }
        return d?.data;
      } else {
        console.warn("[SYNC→SERVER] ❌ Failed:", d?.message);
      }
    }catch(e){
      console.warn("[SYNC→SERVER] Server unavailable:", e);
    }
  }

  // 2. Always also save to localStorage as backup
  try{
    const raw = localStorage.getItem("complaints_all");
    const all:Complaint[] = raw ? JSON.parse(raw) : [];
    const idx = all.findIndex(x => x.id === fresh.id);
    if(idx >= 0) all[idx] = fresh; else all.unshift(fresh);
    localStorage.setItem("complaints_all", JSON.stringify(all));
  }catch{}
}
function getDistanceKm(a1:number,o1:number,a2:number,o2:number){
  const R=6371,dA=((a2-a1)*Math.PI)/180,dO=((o2-o1)*Math.PI)/180;
  const a=Math.sin(dA/2)**2+Math.cos((a1*Math.PI)/180)*Math.cos((a2*Math.PI)/180)*Math.sin(dO/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}
function genTicket(){return`AP-${new Date().getFullYear()}-${Math.random().toString(36).substr(2,6).toUpperCase()}`;}
function genId(){return`cmp-${Date.now()}-${Math.random().toString(36).substr(2,6)}`;}

// ─────────────────────────────────────────────────────────────────────────────
// MOCK AREA ALERTS (in real app would come from backend/websocket)
// ─────────────────────────────────────────────────────────────────────────────
const SAMPLE_ALERTS:AreaAlert[]=[
  {id:"a1",title:"Power grid maintenance — sector 4",type:"power",severity:"warning",distance:"1.2 km",lat:16.510,lng:80.652,time:"30 min ago"},
  {id:"a2",title:"Road flooding reported near NH-16",type:"flood",severity:"critical",distance:"2.5 km",lat:16.512,lng:80.655,time:"1 hr ago"},
  {id:"a3",title:"Street light outage — MG Road",type:"power",severity:"info",distance:"0.8 km",lat:16.508,lng:80.647,time:"2 hr ago"},
];
const ALERT_ICON:Record<string,string>={flood:"🌊",power:"⚡",accident:"🚗",fire:"🔥",health:"🏥"};
const ALERT_COLOR:Record<string,string>={critical:"#ef4444",warning:"#f59e0b",info:"#3b82f6"};

// ─────────────────────────────────────────────────────────────────────────────
// MAP RECENTER
// ─────────────────────────────────────────────────────────────────────────────
function RecenterMap({lat,lng}:{lat:number;lng:number}){const map=useMap();useEffect(()=>{map.setView([lat,lng],14,{animate:true});},[lat,lng,map]);return null;}

// ─────────────────────────────────────────────────────────────────────────────
// STATUS CONFIG
// ─────────────────────────────────────────────────────────────────────────────
const STATUS_CFG:{[k:string]:{color:string;bg:string;border:string;dot:string;icon:string;label:string}}={
  Pending:{color:"#c2410c",bg:"#fff7ed",border:"#fed7aa",dot:"#f97316",icon:"⏳",label:"Pending"},
  Submitted:{color:"#7c3aed",bg:"#f5f3ff",border:"#ddd6fe",dot:"#8b5cf6",icon:"📝",label:"Submitted"},
  Assigned:{color:"#1d4ed8",bg:"#eff6ff",border:"#bfdbfe",dot:"#3b82f6",icon:"🔧",label:"In Progress"},
  "In Progress":{color:"#0369a1",bg:"#f0f9ff",border:"#bae6fd",dot:"#0ea5e9",icon:"⚙️",label:"In Progress"},
  Resolved:{color:"#15803d",bg:"#f0fdf4",border:"#bbf7d0",dot:"#22c55e",icon:"✅",label:"Resolved"},
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPLAINT SUBMISSION MODAL — GPS + Image + AI + Emergency + Duplicate Check
// ─────────────────────────────────────────────────────────────────────────────
interface SubmitModalProps { onClose:()=>void; onSubmit:(c:Complaint)=>void; userId:string; userName:string; existingComplaints:Complaint[]; }

const CATEGORIES=["Roads & Potholes","Water Supply","Electricity/Street Light","Garbage/Sanitation","Drainage/Sewage","Public Property Damage","Noise Complaint","Illegal Construction","Traffic Signal","Animal Menace","Air Pollution","Other"];

function SubmitModal({onClose,onSubmit,userId,userName,existingComplaints}:SubmitModalProps){
  const[step,setStep]=useState<1|2|3>(1);
  const[title,setTitle]=useState("");
  const[desc,setDesc]=useState("");
  const[category,setCategory]=useState("");
  const[emergency,setEmergency]=useState(false);
  const[image,setImage]=useState<string|null>(null);
  const[loc,setLoc]=useState<{lat:number;lng:number;address:string}|null>(null);
  const[locLoading,setLocLoading]=useState(false);
  const[aiResult,setAiResult]=useState<{department:string;confidence:number;reason:string;suggestedCategory:string}|null>(null);
  const[duplicates,setDuplicates]=useState<NearbyDuplicate[]>([]);
  const[submitting,setSubmitting]=useState(false);
  const[dragOver,setDragOver]=useState(false);
  const fileRef=useRef<HTMLInputElement>(null);

  // Auto GPS on open
  useEffect(()=>{
    setLocLoading(true);
    if(!navigator.geolocation){setLocLoading(false);return;}
    navigator.geolocation.getCurrentPosition(
      async(pos)=>{
        const {latitude:lat,longitude:lng}=pos.coords;
        // Reverse geocode via nominatim
        try{
          const r=await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`);
          const d=await r.json();
          setLoc({lat,lng,address:d.display_name?.split(",").slice(0,3).join(", ")||`${lat.toFixed(4)}, ${lng.toFixed(4)}`});
        }catch{setLoc({lat,lng,address:`${lat.toFixed(4)}, ${lng.toFixed(4)}`});}
        setLocLoading(false);
      },
      ()=>{setLoc({lat:16.5062,lng:80.6480,address:"Rajamahendravaram, AP"});setLocLoading(false);},
      {enableHighAccuracy:true,timeout:12000}
    );
  },[]);

  // AI analysis when description changes
  useEffect(()=>{
    if(desc.length<20&&!title)return;
    const r=aiRouteDepartment({title,description:desc,category});
    setAiResult(r);
    // Check duplicates
    if(loc){
      const dups=detectDuplicates({title,description:desc,category,lat:loc.lat,lng:loc.lng},existingComplaints);
      setDuplicates(dups);
    }
  },[desc,title,category,loc]);

  const handleImage=(file:File)=>{
    if(file.size>5*1024*1024){alert("Image must be < 5MB");return;}
    const reader=new FileReader();reader.onload=e=>setImage(e.target?.result as string);reader.readAsDataURL(file);
  };
  const handleFileDrop=(e:React.DragEvent)=>{e.preventDefault();setDragOver(false);const f=e.dataTransfer.files[0];if(f&&f.type.startsWith("image/"))handleImage(f);};

  const handleSubmit=async()=>{
    if(!title.trim()||!desc.trim()){alert("Please fill in title and description");return;}
    setSubmitting(true);
    await new Promise(r=>setTimeout(r,1200));
    const routing=aiResult||aiRouteDepartment({title,description:desc,category});
    const now=new Date().toISOString();
    const complaint:Complaint={
      id:genId(),ticketId:genTicket(),title,description:desc,category:category||routing.suggestedCategory,
      status:"Pending",department:routing.department,userId,userName,
      lat:loc?.lat,lng:loc?.lng,address:loc?.address,image:image||undefined,
      createdAt:now,updatedAt:now,emergency,priority:emergency?"Critical":"Normal",
      aiRouted:true,aiRoutingReason:routing.reason,
      timeline:[{id:"t1",event:"Complaint submitted",note:`Routed to ${routing.department} (${routing.confidence}% confidence)`,actor:userName,time:now,icon:"📝",color:"#8b5cf6"}],
    };
    onSubmit(complaint);setSubmitting(false);
  };

  const S={overlay:{position:"fixed" as const,inset:0,background:"rgba(0,0,0,.55)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16,backdropFilter:"blur(8px)"},modal:{background:"#ffffff",borderRadius:22,width:"100%",maxWidth:640,maxHeight:"92vh",overflowY:"auto" as const,boxShadow:"0 32px 80px rgba(0,0,0,.25),0 0 0 1px rgba(22,163,74,.1)",animation:"slideUp .35s cubic-bezier(.34,1.56,.64,1)"}};

  return(
    <div style={S.overlay} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div style={S.modal}>
        {/* Header */}
        <div style={{background:"linear-gradient(135deg,#14532d 0%,#16a34a 60%,#22c55e 100%)",padding:"22px 26px",borderRadius:"22px 22px 0 0",position:"relative",overflow:"hidden"}}>
          <div style={{position:"absolute",top:-40,right:-40,width:200,height:200,borderRadius:"50%",background:"rgba(255,255,255,.08)",filter:"blur(50px)"}}/>
          <div style={{position:"absolute",bottom:-30,left:-20,width:140,height:140,borderRadius:"50%",background:"rgba(255,255,255,.05)",filter:"blur(35px)"}}/>
          <div style={{position:"absolute",inset:0,backgroundImage:"radial-gradient(circle at 1px 1px,rgba(255,255,255,.06) 1px,transparent 0)",backgroundSize:"24px 24px"}}/>
          <div style={{position:"relative",display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
            <div style={{display:"flex",alignItems:"center",gap:13}}>
              <img src="/ap-bg.png" alt="CivicConnect" style={{width:46,height:46,objectFit:"contain",filter:"brightness(0) invert(1)",opacity:.92,flexShrink:0,dropShadow:"0 2px 8px rgba(0,0,0,.3)"}}/>
              <div>
                <div style={{fontSize:9.5,color:"rgba(255,255,255,.75)",fontWeight:700,letterSpacing:".14em",marginBottom:3,textTransform:"uppercase"}}>New Complaint — CivicConnect</div>
                <h2 style={{fontSize:20,fontWeight:900,color:"#fff",fontFamily:"'DM Serif Display',serif",lineHeight:1.1}}>Report a Civic Issue</h2>
                <p style={{fontSize:11.5,color:"rgba(255,255,255,.75)",marginTop:3}}>AI will auto-detect department · GPS location captured</p>
              </div>
            </div>
            <button onClick={onClose} style={{width:36,height:36,borderRadius:"50%",background:"rgba(255,255,255,.15)",border:"1.5px solid rgba(255,255,255,.25)",color:"#fff",fontSize:16,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,backdropFilter:"blur(4px)"}}>✕</button>
          </div>
          {/* Step indicators */}
          <div style={{display:"flex",gap:8,marginTop:16,position:"relative"}}>
            {["Issue Details","Location & Photo","Review & Submit"].map((s,i)=>(
              <div key={s} style={{flex:1,display:"flex",alignItems:"center",gap:6}}>
                <div style={{width:24,height:24,borderRadius:"50%",background:i+1<=step?"#fff":i+1===step+1?"rgba(255,255,255,.25)":"rgba(255,255,255,.12)",border:`2px solid ${i+1<=step?"#fff":"rgba(255,255,255,.3)"}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:800,color:i+1<=step?"#15803d":"rgba(255,255,255,.6)",flexShrink:0,transition:"all .3s",boxShadow:i+1===step?"0 0 0 3px rgba(255,255,255,.2)":"none"}}>{i+1<=step?i+1<step?"✓":i+1:i+1}</div>
                <span style={{fontSize:10,color:i+1===step?"#fff":i+1<step?"rgba(255,255,255,.85)":"rgba(255,255,255,.45)",fontWeight:i+1===step?700:400,transition:"all .3s"}}>{s}</span>
                {i<2&&<div style={{flex:1,height:2,background:i+1<step?"rgba(255,255,255,.7)":"rgba(255,255,255,.2)",borderRadius:2,transition:"background .3s"}}/>}
              </div>
            ))}
          </div>
        </div>

        <div style={{padding:"22px 26px",background:"#ffffff"}}>
          {/* ── STEP 1: Details ── */}
          {step===1&&(
            <div style={{display:"flex",flexDirection:"column",gap:16}}>
              {/* Emergency toggle */}
              <div onClick={()=>setEmergency(!emergency)} style={{display:"flex",alignItems:"center",gap:14,padding:"14px 18px",borderRadius:12,background:emergency?"#fef2f2":"var(--bg-card-alt)",border:`2px solid ${emergency?"#ef4444":"var(--border)"}`,cursor:"pointer",transition:"all .2s"}}>
                <div style={{width:40,height:40,borderRadius:11,background:emergency?"#ef444420":"var(--bg-hover)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>🚨</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:700,color:emergency?"#dc2626":"var(--text-primary)"}}>Emergency Issue</div>
                  <div style={{fontSize:11,color:emergency?"#ef4444":"var(--text-muted)"}}>Toggle if this needs immediate attention</div>
                </div>
                <div style={{width:44,height:24,borderRadius:12,background:emergency?"#ef4444":"var(--border)",position:"relative",transition:"background .2s"}}>
                  <div style={{position:"absolute",top:2,left:emergency?22:2,width:20,height:20,borderRadius:"50%",background:"var(--bg-card)",transition:"left .2s",boxShadow:"0 1px 4px rgba(0,0,0,.2)"}}/>
                </div>
              </div>

              {/* Title */}
              <div>
                <label style={{fontSize:11.5,fontWeight:700,color:"#374151",display:"block",marginBottom:6}}>Issue Title *</label>
                <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. Deep pothole on main road causing accidents" style={{width:"100%",padding:"11px 14px",border:"1.5px solid #e2e8f0",borderRadius:10,fontSize:13,outline:"none",fontFamily:"inherit",color:"#111827",background:"#f9fafb",transition:"border-color .2s"}} onFocus={e=>(e.target.style.borderColor="#16a34a")} onBlur={e=>(e.target.style.borderColor="#e2e8f0")}/>
              </div>

              {/* Category */}
              <div>
                <label style={{fontSize:11.5,fontWeight:700,color:"#374151",display:"block",marginBottom:6}}>Category {aiResult&&<span style={{color:"#7c3aed",fontWeight:400}}>· AI suggests: {aiResult.suggestedCategory}</span>}</label>
                <select value={category} onChange={e=>setCategory(e.target.value)} style={{width:"100%",padding:"11px 14px",border:"1.5px solid #e2e8f0",borderRadius:10,fontSize:13,outline:"none",fontFamily:"inherit",color:"#111827",background:"#f9fafb",cursor:"pointer"}}>
                  <option value="">Select a category…</option>
                  {CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              {/* Description */}
              <div>
                <label style={{fontSize:11.5,fontWeight:700,color:"#374151",display:"block",marginBottom:6}}>Description * <span style={{color:"var(--text-muted)",fontWeight:400}}>(the AI reads this to route your complaint)</span></label>
                <textarea value={desc} onChange={e=>setDesc(e.target.value)} placeholder="Describe the issue in detail — what you see, location landmarks, how long it's been there, how it affects residents…" rows={4} style={{width:"100%",padding:"11px 14px",border:"1.5px solid #e2e8f0",borderRadius:10,fontSize:13,outline:"none",fontFamily:"inherit",color:"#111827",background:"#f9fafb",resize:"vertical",lineHeight:1.6}} onFocus={e=>(e.target.style.borderColor="#16a34a")} onBlur={e=>(e.target.style.borderColor="#e2e8f0")}/>
              </div>

              {/* AI Result */}
              {aiResult&&desc.length>15&&(
                <div style={{padding:"12px 14px",background:"linear-gradient(135deg,#1e1b4b,#2e1065)",borderRadius:12,border:"1px solid rgba(139,92,246,.3)"}}>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <div style={{width:30,height:30,borderRadius:8,background:"rgba(139,92,246,.25)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>🤖</div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:10,color:"rgba(196,181,253,.7)",fontWeight:700,marginBottom:2}}>AI DEPARTMENT DETECTION</div>
                      <div style={{fontSize:12.5,color:"var(--bg-card)",fontWeight:600}}>{DEPT_ICON[aiResult.department]} {aiResult.department} <span style={{color:aiResult.confidence>75?"#4ade80":"#fbbf24",fontSize:11}}>· {aiResult.confidence}% confident</span></div>
                      <div style={{fontSize:11,color:"rgba(196,181,253,.6)",marginTop:1}}>{aiResult.reason}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Duplicate warning */}
              {duplicates.length>0&&(
                <div style={{padding:"12px 14px",background:"#fffbeb",borderRadius:12,border:"1px solid #fde68a"}}>
                  <div style={{fontSize:11,fontWeight:700,color:"#d97706",marginBottom:8}}>⚠️ Similar complaints already reported nearby</div>
                  {duplicates.map(d=>(
                    <div key={d.id} style={{display:"flex",alignItems:"center",gap:8,marginBottom:6,padding:"8px 10px",background:"var(--bg-card)",borderRadius:8,border:"1px solid #fef3c7"}}>
                      <span style={{fontSize:12}}>{d.status==="Resolved"?"✅":"🔄"}</span>
                      <div style={{flex:1}}>
                        <div style={{fontSize:12,fontWeight:600,color:"#92400e"}}>{d.title}</div>
                        <div style={{fontSize:10.5,color:"#b45309"}}>{d.distance} · {d.status}</div>
                      </div>
                    </div>
                  ))}
                  <div style={{fontSize:11,color:"#78350f",marginTop:4}}>You can still submit — your complaint may have additional details.</div>
                </div>
              )}
            </div>
          )}

          {/* ── STEP 2: Location & Photo ── */}
          {step===2&&(
            <div style={{display:"flex",flexDirection:"column",gap:16}}>
              {/* GPS Location */}
              <div style={{padding:"14px 16px",background:loc?"#f0fdf4":"var(--bg-card-alt)",borderRadius:12,border:`1.5px solid ${loc?"#bbf7d0":"var(--border)"}`}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <div style={{width:34,height:34,borderRadius:9,background:loc?"#dcfce7":"var(--bg-hover)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>{locLoading?"⏳":loc?"📍":"📍"}</div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:12,fontWeight:700,color:loc?"#15803d":"#374151"}}>{locLoading?"Detecting GPS location…":loc?"Location Captured ✓":"Location"}</div>
                    <div style={{fontSize:11,color:loc?"#16a34a":"var(--text-muted)"}}>{loc?loc.address:"Enable location access for accurate reporting"}</div>
                    {loc&&<div style={{fontSize:10,color:"var(--text-muted)",fontFamily:"monospace",marginTop:2}}>{loc.lat.toFixed(6)}, {loc.lng.toFixed(6)}</div>}
                  </div>
                  {!locLoading&&!loc&&<button onClick={()=>{setLocLoading(true);navigator.geolocation?.getCurrentPosition(p=>{setLoc({lat:p.coords.latitude,lng:p.coords.longitude,address:"Location captured"});setLocLoading(false);},()=>setLocLoading(false));}} style={{fontSize:11,fontWeight:700,color:"#16a34a",background:"#f0fdf4",border:"1px solid #bbf7d0",padding:"5px 12px",borderRadius:8,cursor:"pointer",fontFamily:"inherit"}}>Get GPS</button>}
                </div>
              </div>

              {/* Image Upload */}
              <div>
                <label style={{fontSize:11.5,fontWeight:700,color:"#374151",display:"block",marginBottom:8}}>📷 Photo Evidence <span style={{color:"var(--text-muted)",fontWeight:400}}>(optional, max 5MB)</span></label>
                {image?(
                  <div style={{position:"relative",borderRadius:12,overflow:"hidden",border:"2px solid #e2e8f0"}}>
                    <img src={image} alt="Complaint" style={{width:"100%",height:200,objectFit:"cover"}}/>
                    <button onClick={()=>setImage(null)} style={{position:"absolute",top:8,right:8,width:28,height:28,borderRadius:"50%",background:"rgba(0,0,0,.6)",border:"none",color:"var(--bg-card)",cursor:"pointer",fontSize:12}}>✕</button>
                    <div style={{position:"absolute",bottom:8,left:8,background:"rgba(0,0,0,.6)",borderRadius:6,padding:"3px 8px",fontSize:10,color:"var(--bg-card)"}}>✓ Photo attached</div>
                  </div>
                ):(
                  <div onDragOver={e=>{e.preventDefault();setDragOver(true);}} onDragLeave={()=>setDragOver(false)} onDrop={handleFileDrop} onClick={()=>fileRef.current?.click()} style={{border:`2px dashed ${dragOver?"#16a34a":"#e2e8f0"}`,borderRadius:12,padding:"32px 20px",textAlign:"center",cursor:"pointer",background:dragOver?"#f0fdf4":"#fafafa",transition:"all .2s"}}>
                    <div style={{fontSize:32,marginBottom:8}}>📷</div>
                    <div style={{fontSize:13,fontWeight:700,color:"#374151"}}>Drop image here or click to upload</div>
                    <div style={{fontSize:11,color:"var(--text-muted)",marginTop:4}}>JPG, PNG, WebP · Max 5MB</div>
                    <input ref={fileRef} type="file" accept="image/*" style={{display:"none"}} onChange={e=>{const f=e.target.files?.[0];if(f)handleImage(f);}}/>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── STEP 3: Review ── */}
          {step===3&&(
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <div style={{fontSize:13,fontWeight:700,color:"var(--text-primary)",marginBottom:4}}>Review your complaint before submitting:</div>
              {[["Title",title],["Category",category||aiResult?.suggestedCategory||"—"],["Description",desc],["Location",loc?.address||"Not captured"],["Department",aiResult?`${DEPT_ICON[aiResult.department]} ${aiResult.department} (${aiResult.confidence}% AI confidence)`:"—"],["Priority",emergency?"🚨 Emergency / Critical":"Normal"]].map(([k,v])=>(
                <div key={k} style={{display:"flex",gap:12,padding:"10px 14px",background:"var(--bg-card-alt)",borderRadius:10,border:"1px solid #f1f5f9"}}>
                  <span style={{fontSize:11.5,fontWeight:700,color:"var(--text-muted)",minWidth:90,flexShrink:0}}>{k}</span>
                  <span style={{fontSize:12.5,color:"var(--text-primary)",lineHeight:1.5,flex:1}}>{v}</span>
                </div>
              ))}
              {image&&<img src={image} alt="Evidence" style={{width:"100%",height:120,objectFit:"cover",borderRadius:10,border:"1px solid #e2e8f0"}}/>}
              {emergency&&(
                <div style={{padding:"12px 14px",background:"#fef2f2",borderRadius:10,border:"1px solid #fecaca",display:"flex",gap:10,alignItems:"center"}}>
                  <span style={{fontSize:18}}>🚨</span>
                  <div style={{fontSize:12.5,color:"#7f1d1d",fontWeight:600}}>This is marked as an <strong>Emergency</strong>. Officers will be alerted immediately.</div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{padding:"16px 26px 24px",borderTop:"1px solid #e2e8f0",background:"#fafafa",borderRadius:"0 0 22px 22px",display:"flex",gap:10,justifyContent:"space-between",alignItems:"center"}}>
          <button onClick={step===1?onClose:()=>setStep((step-1) as 1|2|3)} style={{padding:"10px 20px",borderRadius:10,background:"var(--bg-card-alt)",border:"1.5px solid #e2e8f0",color:"var(--text-muted)",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{step===1?"Cancel":"← Back"}</button>
          <div style={{display:"flex",gap:10}}>
            {step<3?(
              <button onClick={()=>setStep((step+1) as 1|2|3)} style={{padding:"10px 24px",borderRadius:10,background:"linear-gradient(135deg,#15803d,#16a34a)",border:"none",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",boxShadow:"0 4px 14px rgba(22,163,74,.35)"}}>Next →</button>
            ):(
              <button onClick={handleSubmit} disabled={submitting} style={{padding:"10px 28px",borderRadius:10,background:submitting?"#94a3b8":"linear-gradient(135deg,#15803d,#16a34a)",border:"none",color:"#fff",fontSize:13,fontWeight:700,cursor:submitting?"default":"pointer",fontFamily:"inherit",boxShadow:"0 4px 14px rgba(22,163,74,.4)",display:"flex",alignItems:"center",gap:8}}>
                {submitting?<><span style={{animation:"spin 1s linear infinite",display:"inline-block"}}>⟳</span> Submitting…</>:"🚀 Submit Complaint"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPLAINT TIMELINE COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
function ComplaintTimeline({complaint}:{complaint:Complaint}){
  const timeline:TimelineEvent[]=complaint.timeline||[];
  // Build synthetic timeline from status
  const events:TimelineEvent[]=[
    {id:"tl-created",event:"Complaint submitted",note:`Ticket ${complaint.ticketId||""}`,actor:complaint.userName||"You",time:complaint.createdAt,icon:"📝",color:"#8b5cf6"},
    ...(complaint.department?[{id:"tl-routed",event:`AI routed → ${complaint.department}`,note:complaint.aiRoutingReason||"AI analysis",actor:"System",time:complaint.createdAt,icon:"🤖",color:"#7c3aed"}]:[]),
    ...(complaint.assignedOfficer?[{id:"tl-assigned",event:`Assigned to ${complaint.assignedOfficer}`,note:"Officer will investigate",actor:"System",time:complaint.updatedAt||complaint.createdAt,icon:"👮",color:"#3b82f6"}]:[]),
    ...(complaint.workerUpdates||[]).map(w=>({id:w.id,event:"Field update",note:w.note,actor:w.worker,time:w.time,icon:"🔧",color:"#0ea5e9"})),
    ...(complaint.escalated?[{id:"tl-esc",event:"Escalated to HQ",note:complaint.escalationReason||"Priority escalation",actor:complaint.assignedOfficer||"Officer",time:complaint.updatedAt||complaint.createdAt,icon:"🚨",color:"#ef4444"}]:[]),
    ...timeline.filter(t=>!["tl-created","tl-routed"].includes(t.id)),
    ...(complaint.status==="Resolved"?[{id:"tl-resolved",event:"Issue Resolved",note:"Complaint marked as resolved",actor:complaint.assignedOfficer||"Officer",time:complaint.updatedAt||complaint.createdAt,icon:"✅",color:"#10b981"}]:[]),
  ];
  const deduped=events.filter((e,i,arr)=>arr.findIndex(x=>x.id===e.id)===i);

  return(
    <div style={{padding:"12px 14px",background:"var(--bg-card-alt)",borderRadius:12,border:"1px solid #f1f5f9"}}>
      <div style={{fontSize:10,color:"var(--text-muted)",fontWeight:700,letterSpacing:".08em",marginBottom:12}}>COMPLAINT TIMELINE · {complaint.ticketId}</div>
      <div style={{display:"flex",flexDirection:"column",gap:0}}>
        {deduped.map((ev,i)=>(
          <div key={ev.id} style={{display:"flex",alignItems:"flex-start",gap:10}}>
            <div style={{display:"flex",flexDirection:"column",alignItems:"center"}}>
              <div style={{width:28,height:28,borderRadius:"50%",background:`${ev.color}15`,border:`2px solid ${ev.color}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,flexShrink:0}}>{ev.icon}</div>
              {i<deduped.length-1&&<div style={{width:2,height:20,background:`${ev.color}30`,margin:"3px 0"}}/>}
            </div>
            <div style={{paddingTop:4,paddingBottom:i<deduped.length-1?16:0,flex:1}}>
              <div style={{fontSize:12.5,fontWeight:700,color:"var(--text-primary)"}}>{ev.event}</div>
              {ev.note&&<div style={{fontSize:11.5,color:"var(--text-muted)",marginTop:1,lineHeight:1.4}}>{ev.note}</div>}
              <div style={{fontSize:10,color:"var(--text-muted)",marginTop:2,display:"flex",gap:8}}>
                <span>{ev.actor}</span>
                <span>·</span>
                <span>{new Date(ev.time).toLocaleString("en-IN",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"})}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FEEDBACK MODAL
// ─────────────────────────────────────────────────────────────────────────────
function FeedbackModal({complaint,onClose,onSubmit}:{complaint:Complaint;onClose:()=>void;onSubmit:(fb:Feedback)=>void}){
  const[rating,setRating]=useState(0);
  const[hover,setHover]=useState(0);
  const[comment,setComment]=useState("");
  const[submitting,setSubmitting]=useState(false);
  const[done,setDone]=useState(false);

  const handleSubmit=async()=>{
    if(rating===0){alert("Please select a rating (1-5 stars)");return;}
    setSubmitting(true);
    const fb:Feedback={rating,comment,submittedAt:new Date().toISOString()};
    await onSubmit(fb);
    setDone(true);setSubmitting(false);
    setTimeout(onClose,2000);
  };

  const LABELS=["","Very Poor","Poor","Average","Good","Excellent"];
  const EMOJIS=["","😞","😕","😐","🙂","😄"];

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(5,10,25,.85)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16,backdropFilter:"blur(6px)"}} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div style={{background:"var(--bg-card)",borderRadius:20,width:"100%",maxWidth:440,padding:"28px 28px 24px",boxShadow:"0 24px 80px rgba(0,0,0,.4)",animation:"slideUp .3s ease"}}>
        {done?(
          <div style={{textAlign:"center",padding:"20px 0"}}>
            <div style={{fontSize:48,marginBottom:12}}>🎉</div>
            <div style={{fontSize:18,fontWeight:800,color:"var(--text-primary)"}}>Thank you for your feedback!</div>
            <div style={{fontSize:13,color:"var(--text-muted)",marginTop:6}}>Your rating helps us improve civic services.</div>
          </div>
        ):(
          <>
            <div style={{marginBottom:20}}>
              <div style={{fontSize:10,color:"#ea6800",fontWeight:700,letterSpacing:".1em",marginBottom:4}}>RESOLUTION FEEDBACK</div>
              <h3 style={{fontSize:18,fontWeight:800,color:"var(--text-primary)",fontFamily:"'DM Serif Display',serif"}}>How was the resolution?</h3>
              <div style={{fontSize:12,color:"var(--text-muted)",marginTop:4}}>Complaint: <strong>{complaint.title||complaint.category}</strong></div>
            </div>
            {/* Star rating */}
            <div style={{textAlign:"center",marginBottom:16}}>
              <div style={{fontSize:48,marginBottom:8,lineHeight:1}}>{EMOJIS[hover||rating]||"⭐"}</div>
              <div style={{display:"flex",justifyContent:"center",gap:8,marginBottom:8}}>
                {[1,2,3,4,5].map(s=>(
                  <button key={s} onMouseEnter={()=>setHover(s)} onMouseLeave={()=>setHover(0)} onClick={()=>setRating(s)}
                    style={{fontSize:32,background:"none",border:"none",cursor:"pointer",color:s<=(hover||rating)?"#f59e0b":"var(--border)",transition:"all .15s",transform:s<=(hover||rating)?"scale(1.15)":"scale(1)"}}>★</button>
                ))}
              </div>
              <div style={{fontSize:14,fontWeight:700,color:"var(--text-primary)"}}>{LABELS[hover||rating]||"Select a rating"}</div>
            </div>
            {/* Comment */}
            <textarea value={comment} onChange={e=>setComment(e.target.value)} placeholder="Optional: Share your experience, suggestions…" rows={3} style={{width:"100%",padding:"11px 14px",border:"1.5px solid #e2e8f0",borderRadius:10,fontSize:12.5,outline:"none",fontFamily:"inherit",color:"var(--text-primary)",resize:"vertical",lineHeight:1.6}} onFocus={e=>(e.target.style.borderColor="#ea6800")} onBlur={e=>(e.target.style.borderColor="var(--border)")}/>
            <div style={{display:"flex",gap:10,marginTop:16}}>
              <button onClick={onClose} style={{flex:1,padding:"10px",borderRadius:10,background:"var(--bg-card-alt)",border:"1.5px solid #e2e8f0",color:"var(--text-muted)",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>Skip</button>
              <button onClick={handleSubmit} disabled={submitting||rating===0} style={{flex:2,padding:"10px",borderRadius:10,background:rating>0?"#ea6800":"var(--border)",border:"none",color:rating>0?"var(--bg-card)":"var(--text-muted)",fontSize:13,fontWeight:700,cursor:rating>0?"pointer":"default",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
                {submitting?<><span style={{animation:"spin 1s linear infinite",display:"inline-block"}}>⟳</span> Submitting…</>:"Submit Feedback ⭐"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// OFFICER TRACKER — step-by-step progress
// ─────────────────────────────────────────────────────────────────────────────
function OfficerTracker({c}:{c:Complaint}){
  const steps=[
    {label:"Submitted",icon:"📝",done:true},
    {label:c.department?`Routed → ${c.department.split(" ")[0]}`:"AI Routing",icon:"🤖",done:!!c.department},
    {label:c.assignedOfficer?`Officer: ${c.assignedOfficer.split(" ")[0]}`:"Awaiting Officer",icon:"👮",done:!!c.assignedOfficer},
    {label:"Investigating",icon:"🔧",done:c.status==="Assigned"||c.status==="In Progress"||c.status==="Resolved"},
    {label:"Resolved",icon:"✅",done:c.status==="Resolved"},
  ];
  const activeIdx=steps.filter(s=>s.done).length-1;
  return(
    <div style={{padding:"12px 14px",background:"var(--bg-card-alt)",borderRadius:12,border:"1px solid #f1f5f9"}}>
      <div style={{fontSize:10,color:"var(--text-muted)",fontWeight:700,letterSpacing:".08em",marginBottom:10}}>LIVE PROGRESS TRACKER</div>
      <div style={{display:"flex",flexDirection:"column",gap:0}}>
        {steps.map((step,i)=>(
          <div key={step.label} style={{display:"flex",alignItems:"flex-start",gap:10}}>
            <div style={{display:"flex",flexDirection:"column",alignItems:"center"}}>
              <div style={{width:24,height:24,borderRadius:"50%",background:step.done?"#f0fdf4":i===activeIdx+1?"#fffbeb":"var(--bg-hover)",border:`2px solid ${step.done?"#22c55e":i===activeIdx+1?"#f59e0b":"var(--border)"}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,flexShrink:0}}>
                {step.done?<span style={{color:"#15803d",fontSize:10}}>✓</span>:<span style={{color:i===activeIdx+1?"#d97706":"#cbd5e1",fontSize:9}}>{i+1}</span>}
              </div>
              {i<steps.length-1&&<div style={{width:2,height:14,background:step.done?"#22c55e33":"var(--bg-hover)",margin:"2px 0"}}/>}
            </div>
            <div style={{paddingTop:3,paddingBottom:i<steps.length-1?10:0}}>
              <div style={{fontSize:12,fontWeight:step.done?600:400,color:step.done?"var(--text-primary)":i===activeIdx+1?"#d97706":"var(--text-muted)"}}>{step.icon} {step.label}</div>
            </div>
          </div>
        ))}
      </div>
      {c.officerNote&&(
        <div style={{marginTop:10,padding:"9px 11px",background:"#fffbeb",borderRadius:8,border:"1px solid #fde68a"}}>
          <div style={{fontSize:9.5,color:"#d97706",fontWeight:700,marginBottom:2}}>👮 OFFICER NOTE</div>
          <div style={{fontSize:12,color:"#78350f",lineHeight:1.5}}>{c.officerNote}</div>
        </div>
      )}
      {c.escalated&&(
        <div style={{marginTop:8,padding:"9px 11px",background:"#fef2f2",borderRadius:8,border:"1px solid #fecaca"}}>
          <div style={{fontSize:9.5,color:"#dc2626",fontWeight:700,marginBottom:2}}>🚨 ESCALATED TO HQ</div>
          <div style={{fontSize:12,color:"#7f1d1d",lineHeight:1.5}}>{c.escalationReason||"Priority escalation triggered"}</div>
        </div>
      )}
      {c.workerUpdates&&c.workerUpdates.length>0&&(
        <div style={{marginTop:8}}>
          <div style={{fontSize:9.5,color:"#0ea5e9",fontWeight:700,marginBottom:6}}>🔧 FIELD UPDATES</div>
          {c.workerUpdates.map(w=>(
            <div key={w.id} style={{padding:"7px 10px",background:"#f0f9ff",borderRadius:7,border:"1px solid #bae6fd",marginBottom:4}}>
              <div style={{fontSize:11.5,color:"#0369a1",fontWeight:600}}>{w.worker}</div>
              <div style={{fontSize:11.5,color:"var(--text-primary)",lineHeight:1.4}}>{w.note}</div>
              {w.progress!==undefined&&(
                <div style={{marginTop:5}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                    <span style={{fontSize:10,color:"#0ea5e9"}}>Progress</span>
                    <span style={{fontSize:10,color:"#0ea5e9",fontWeight:700}}>{w.progress}%</span>
                  </div>
                  <div style={{height:4,background:"#e0f2fe",borderRadius:3,overflow:"hidden"}}>
                    <div style={{height:"100%",width:`${w.progress}%`,background:"#0ea5e9",borderRadius:3}}/>
                  </div>
                </div>
              )}
              <div style={{fontSize:10,color:"var(--text-muted)",marginTop:3}}>{new Date(w.time).toLocaleString("en-IN",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"})}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LIVE INCIDENT MAP — color-coded by urgency
// Red=Emergency, Orange=Pending, Blue=Assigned, Green=Resolved
// ─────────────────────────────────────────────────────────────────────────────
function IncidentMap({myComplaints}:{myComplaints:Complaint[]}){
  const [allComplaints, setAllComplaints] = useState<Complaint[]>(()=>loadAllComplaints());
  useEffect(()=>{
    fetchComplaintsFromServer().then(data=>{ if(data.length>0) setAllComplaints(data); });
  },[]);
  const all = allComplaints;
  const[loc,setLoc]=useState<{lat:number;lng:number}|null>(null);
  const[loading,setLoading]=useState(true);
  const[filter,setFilter]=useState<"all"|"mine"|"urgent">("all");
  const FALLBACK:[number,number]=[16.5062,80.6480];

  useEffect(()=>{
    if(!navigator.geolocation){setLoading(false);return;}
    navigator.geolocation.getCurrentPosition(p=>{setLoc({lat:p.coords.latitude,lng:p.coords.longitude});setLoading(false);},()=>setLoading(false),{enableHighAccuracy:true,timeout:10000});
  },[]);

  const valid=all.filter(c=>typeof c.lat==="number"&&typeof c.lng==="number"&&!isNaN(c.lat)&&c.lat!==0);
  const KM=8;
  const base=loc?valid.filter(c=>getDistanceKm(loc.lat,loc.lng,c.lat!,c.lng!)<=KM):valid;
  const pins=filter==="mine"?base.filter(c=>myComplaints.some(m=>m.id===c.id)):filter==="urgent"?base.filter(c=>c.emergency||c.status==="Pending"):base;
  const center:[number,number]=loc?[loc.lat,loc.lng]:pins.length>0?[pins[0].lat!,pins[0].lng!]:FALLBACK;
  const isMine=(c:Complaint)=>myComplaints.some(m=>m.id===c.id);

  const makePin=(c:Complaint)=>{
    const mine=isMine(c);
    const col=c.emergency?"#ef4444":c.status==="Resolved"?"#22c55e":c.status==="Assigned"||c.status==="In Progress"?"#3b82f6":"#f97316";
    const sz=mine?34:c.emergency?30:24;
    return L.divIcon({className:"",
      html:`<div style="position:relative;width:${sz}px;height:${sz}px;display:flex;align-items:center;justify-content:center;">
        <div style="position:absolute;width:100%;height:100%;border-radius:50%;background:${col};opacity:${c.emergency?.25:.12};${(c.emergency||mine)?"animation:lm-pulse 2s ease-in-out infinite;":""}"></div>
        <div style="position:absolute;width:${mine?20:c.emergency?18:13}px;height:${mine?20:c.emergency?18:13}px;border-radius:50%;background:#0f172a;border:${mine?3:2}px solid ${col};${mine||c.emergency?"box-shadow:0 0 8px "+col+"99;":""}"></div>
        <div style="position:absolute;font-size:${mine?9:c.emergency?8:7}px;">${c.emergency?"🚨":DEPT_ICON[c.department||""]||"📌"}</div>
      </div>`,
      iconSize:[sz,sz],iconAnchor:[sz/2,sz/2],popupAnchor:[0,-sz/2]
    });
  };

  const youIcon=L.divIcon({className:"",html:`<div style="position:relative;width:26px;height:26px;display:flex;align-items:center;justify-content:center;"><div style="position:absolute;width:26px;height:26px;border-radius:50%;background:#ea6800;opacity:.18;animation:lm-pulse 2s ease-in-out infinite;"></div><div style="position:absolute;width:16px;height:16px;border-radius:50%;background:#ea6800;border:2.5px solid white;box-shadow:0 2px 8px rgba(234,104,0,.6);"></div></div>`,iconSize:[26,26],iconAnchor:[13,13]});
  const alertIcon=L.divIcon({className:"",html:`<div style="width:24px;height:24px;border-radius:50%;background:#f97316;border:2.5px solid white;display:flex;align-items:center;justify-content:center;font-size:11px;box-shadow:0 2px 8px rgba(249,115,22,.5);">⚠</div>`,iconSize:[24,24],iconAnchor:[12,12]});

  const statsRow=[
    {label:"All",color:"#60a5fa",count:base.length},
    {label:"Emergency",color:"#ef4444",count:base.filter(c=>c.emergency).length},
    {label:"Pending",color:"#f97316",count:base.filter(c=>c.status==="Pending"&&!c.emergency).length},
    {label:"In Progress",color:"#3b82f6",count:base.filter(c=>c.status==="Assigned"||c.status==="In Progress").length},
    {label:"Resolved",color:"#22c55e",count:base.filter(c=>c.status==="Resolved").length},
  ];

  return(
    <div style={{borderRadius:14,overflow:"hidden",position:"relative",height:360,border:"1.5px solid #1e293b",zIndex: 1 }}>
      <style>{`
  :root{
    --bg-page:#f0faf4;
    --bg-card:#ffffff;
    --bg-card-alt:#f4fbf7;
    --bg-nav:#ffffff;--bg-nav-glass:rgba(255,255,255,.94);
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
  
    --footer-bg:#0f172a;
    --footer-text:#94a3b8;
    --footer-heading:#ffffff;
    --footer-muted:#64748b;
    --footer-border:#1e293b;
  }
  @media(prefers-color-scheme:dark){
    :root{
      --bg-page:#07110d;
      --bg-card:#0e1f17;
      --bg-card-alt:#112319;
      --bg-nav:#091510;--bg-nav-glass:rgba(9,21,16,.94);
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
      --shadow-lg:0 8px 32px rgba(0,0,0,.60);
      --scrollbar:#1a3326;
      --nav-border:#1a3326;
    
    --footer-bg:#020d06;
    --footer-text:#6b7280;
    --footer-heading:#e5e7eb;
    --footer-muted:#4b5563;
    --footer-border:#111827;
  }
  }
  *,*::before,*::after{box-sizing:border-box}
  ::-webkit-scrollbar{width:4px;height:4px}
  ::-webkit-scrollbar-track{background:transparent}
  ::-webkit-scrollbar-thumb{background:var(--scrollbar);border-radius:4px}

  ::-webkit-scrollbar{width:4px;height:4px}
  ::-webkit-scrollbar-track{background:transparent}
  ::-webkit-scrollbar-thumb{background:var(--scrollbar-thumb);border-radius:4px}

        @keyframes lm-pulse{0%,100%{transform:scale(1);opacity:.18}50%{transform:scale(1.8);opacity:.07}}
        .leaflet-container{background:#0a1628 !important;z-index: 0 !important;}

        .leaflet-pane,.leaflet-top,
.leaflet-bottom {
  z-index: 0 !important;
}
        .leaflet-tile{filter:invert(1) hue-rotate(180deg) brightness(.8) saturate(.65)}
        .leaflet-popup-content-wrapper{background:#0f172a!important;border:1.5px solid rgba(255,255,255,.1)!important;border-radius:10px!important;box-shadow:0 8px 24px rgba(0,0,0,.5)!important;color:white!important}
        .leaflet-popup-tip{background:#0f172a!important}
        .leaflet-popup-close-button{color:#64748b!important}
        .leaflet-control-zoom a{background:#0f172a!important;color:white!important;border-color:rgba(255,255,255,.12)!important}
        .leaflet-control-attribution{display:none!important}
      `}</style>
      <MapContainer center={center} zoom={14} scrollWheelZoom style={{height:"100%",width:"100%"}}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>
        {loc&&<RecenterMap lat={loc.lat} lng={loc.lng}/>}
        {loc&&<Circle center={[loc.lat,loc.lng]} radius={KM*1000} pathOptions={{color:"#ea6800",fillColor:"#ea6800",fillOpacity:.03,weight:1,dashArray:"6 4"}}/>}
        {loc&&<Marker position={[loc.lat,loc.lng]} icon={youIcon}><Popup maxWidth={120}><div style={{textAlign:"center",padding:"2px 0"}}><strong style={{color:"var(--bg-card)",fontSize:12}}>📍 You</strong></div></Popup></Marker>}
        {/* Area alerts */}
        {SAMPLE_ALERTS.map(a=>(
          <Marker key={a.id} position={[a.lat,a.lng]} icon={alertIcon}>
            <Popup maxWidth={200}><div style={{padding:"2px 0"}}><div style={{fontSize:11,fontWeight:700,color:ALERT_COLOR[a.severity],marginBottom:3}}>{ALERT_ICON[a.type]} {a.title}</div><div style={{fontSize:10,color:"var(--text-muted)"}}>{a.distance} · {a.time}</div></div></Popup>
          </Marker>
        ))}
        {pins.map(pin=>(
          <Marker key={pin.id} position={[pin.lat!,pin.lng!]} icon={makePin(pin)}>
            <Popup maxWidth={230}>
              <div style={{padding:"2px 0",minWidth:190}}>
                <div style={{display:"flex",justifyContent:"space-between",gap:8,marginBottom:5}}>
                  <strong style={{color:"var(--bg-card)",fontSize:12,lineHeight:1.3}}>{pin.title||pin.category}</strong>
                  <span style={{fontSize:10,fontWeight:700,color:pin.emergency?"#ef4444":pin.status==="Resolved"?"#4ade80":pin.status==="Assigned"?"#60a5fa":"#f97316",flexShrink:0}}>{pin.emergency?"🚨 URGENT":pin.status}</span>
                </div>
                {pin.department&&<div style={{fontSize:10.5,color:"var(--text-muted)",marginBottom:2}}>{DEPT_ICON[pin.department]} {pin.department}</div>}
                {pin.assignedOfficer&&<div style={{fontSize:10.5,color:"var(--text-muted)"}}>👮 {pin.assignedOfficer}</div>}
                {isMine(pin)&&<div style={{fontSize:10,color:"#ea6800",fontWeight:700,marginTop:4}}>⭐ Your complaint</div>}
                {pin.address&&<div style={{fontSize:10,color:"var(--text-secondary)",marginTop:2}}>📍 {pin.address.slice(0,50)}</div>}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      {/* Map controls overlay */}
      <div style={{position:"absolute",top:10,left:10,zIndex:1000,display:"flex",flexDirection:"column",gap:6}}>
        <div style={{background:"rgba(15,23,42,.9)",border:"1px solid rgba(234,104,0,.35)",backdropFilter:"blur(8px)",borderRadius:8,padding:"5px 10px",display:"flex",alignItems:"center",gap:6}}>
          <div style={{width:7,height:7,borderRadius:"50%",background:loading?"#f59e0b":"#10b981",animation:"lm-pulse 2s infinite"}}/>
          <span style={{color:"var(--text-muted)",fontSize:11,fontWeight:600}}>{loading?"LOCATING…":`${pins.length} incidents`}</span>
        </div>
        {/* Filter buttons */}
        {(["all","mine","urgent"] as const).map(f=>(
          <button key={f} onClick={()=>setFilter(f)} style={{background:filter===f?"rgba(234,104,0,.9)":"rgba(15,23,42,.88)",border:"1px solid rgba(255,255,255,.12)",borderRadius:7,padding:"4px 10px",color:filter===f?"var(--bg-card)":"var(--text-muted)",fontSize:10.5,fontWeight:600,cursor:"pointer",fontFamily:"inherit",textAlign:"left"}}>{f==="all"?"🗺 All":f==="mine"?"⭐ Mine":"🚨 Urgent"}</button>
        ))}
      </div>
      {/* Legend */}
      <div style={{position:"absolute",bottom:10,right:10,zIndex:1000,background:"rgba(15,23,42,.9)",border:"1px solid rgba(255,255,255,.08)",borderRadius:10,padding:"8px 12px"}}>
        <div style={{fontSize:9,color:"var(--text-secondary)",fontWeight:700,marginBottom:5,letterSpacing:".06em"}}>LEGEND</div>
        {[{c:"#ef4444",l:"Emergency"},{c:"#f97316",l:"Pending"},{c:"#3b82f6",l:"In Progress"},{c:"#22c55e",l:"Resolved"},{c:"#ea6800",l:"You"}].map(x=>(
          <div key={x.l} style={{display:"flex",gap:6,alignItems:"center",marginBottom:3}}>
            <div style={{width:9,height:9,borderRadius:"50%",background:x.c,flexShrink:0}}/>
            <span style={{fontSize:10,color:"var(--text-muted)"}}>{x.l}</span>
          </div>
        ))}
      </div>
      {/* Stats bar */}
      <div style={{position:"absolute",bottom:0,left:0,right:0,zIndex:999,background:"rgba(10,22,40,.92)",backdropFilter:"blur(8px)",borderTop:"1px solid rgba(255,255,255,.06)",padding:"6px 12px",display:"flex",gap:16,alignItems:"center",overflowX:"auto"}}>
        {statsRow.map(s=>(
          <div key={s.label} style={{display:"flex",alignItems:"center",gap:5,flexShrink:0}}>
            <div style={{width:7,height:7,borderRadius:"50%",background:s.color}}/>
            <span style={{fontSize:10,color:s.color,fontWeight:700}}>{s.count}</span>
            <span style={{fontSize:10,color:"var(--text-secondary)"}}>{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EMERGENCY QUICK CALL PANEL
// ─────────────────────────────────────────────────────────────────────────────
function EmergencyPanel(){
  const[calling,setCalling]=useState<string|null>(null);
  const SERVICES=[
    {icon:"🚔",label:"Police",number:"100",color:"#1d4ed8",bg:"linear-gradient(135deg,#1d4ed8,#2563eb)",desc:"Law enforcement"},
    {icon:"🚑",label:"Ambulance",number:"108",color:"#10b981",bg:"linear-gradient(135deg,#10b981,#059669)",desc:"Medical emergency"},
    {icon:"🔥",label:"Fire",number:"101",color:"#ef4444",bg:"linear-gradient(135deg,#ef4444,#dc2626)",desc:"Fire & rescue"},
    {icon:"🌊",label:"Disaster",number:"1070",color:"#f59e0b",bg:"linear-gradient(135deg,#f59e0b,#d97706)",desc:"Disaster relief"},
    {icon:"🚨",label:"AP Emergency",number:"112",color:"#8b5cf6",bg:"linear-gradient(135deg,#8b5cf6,#7c3aed)",desc:"All emergencies"},
    {icon:"📞",label:"Helpline",number:"1800-425-0082",color:"var(--text-muted)",bg:"linear-gradient(135deg,#64748b,#475569)",desc:"Civic helpline"},
  ];
  return(
    <div>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
        <div style={{width:34,height:34,borderRadius:10,background:"linear-gradient(135deg,#ef4444,#dc2626)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>🚨</div>
        <div>
          <div style={{fontSize:13,fontWeight:800,color:"var(--text-primary)"}}>Emergency Quick Call</div>
          <div style={{fontSize:11,color:"var(--text-muted)"}}>Tap to call · Available 24/7</div>
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        {SERVICES.map(s=>(
          <a key={s.label} href={`tel:${s.number}`} onClick={()=>{setCalling(s.label);setTimeout(()=>setCalling(null),3000);}}
            style={{display:"flex",alignItems:"center",gap:11,padding:"13px 14px",borderRadius:12,background:calling===s.label?s.bg:"var(--bg-card)",border:`1.5px solid ${s.color}22`,textDecoration:"none",transition:"all .2s",boxShadow:calling===s.label?`0 6px 20px ${s.color}40`:"0 1px 4px rgba(0,0,0,.04)"}}>
            <div style={{width:36,height:36,borderRadius:10,background:calling===s.label?"rgba(255,255,255,.2)":s.color+"15",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>{s.icon}</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:13,fontWeight:800,color:calling===s.label?"var(--bg-card)":s.color}}>{s.label}</div>
              <div style={{fontSize:10.5,color:calling===s.label?"rgba(255,255,255,.7)":"var(--text-muted)"}}>{s.desc}</div>
              <div style={{fontSize:12,fontWeight:700,color:calling===s.label?"var(--bg-card)":s.color,fontFamily:"monospace"}}>{s.number}</div>
            </div>
            {calling===s.label&&<div style={{fontSize:16,animation:"pulse 1s ease-in-out infinite"}}>📞</div>}
          </a>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AREA RISK ALERTS PANEL
// ─────────────────────────────────────────────────────────────────────────────
function AreaAlertsPanel(){
  const[dismissed,setDismissed]=useState<string[]>([]);
  const active=SAMPLE_ALERTS.filter(a=>!dismissed.includes(a.id));
  if(active.length===0)return null;
  return(
    <div style={{background:"var(--text-primary)",borderRadius:16,padding:18,border:"1px solid rgba(239,68,68,.2)"}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
        <div style={{width:30,height:30,borderRadius:8,background:"rgba(239,68,68,.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>⚠️</div>
        <div style={{flex:1}}>
          <div style={{fontSize:12,fontWeight:700,color:"var(--bg-card)"}}>Area Risk Alerts</div>
          <div style={{fontSize:10,color:"var(--text-muted)"}}>{active.length} alert{active.length!==1?"s":""} near you</div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:5,background:"rgba(239,68,68,.15)",borderRadius:20,padding:"3px 10px"}}>
          <div style={{width:6,height:6,borderRadius:"50%",background:"#ef4444",animation:"pulse 1.5s ease-in-out infinite"}}/>
          <span style={{fontSize:10,color:"#ef4444",fontWeight:700}}>LIVE</span>
        </div>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {active.map(a=>(
          <div key={a.id} style={{display:"flex",alignItems:"flex-start",gap:10,padding:"10px 12px",background:`${ALERT_COLOR[a.severity]}08`,border:`1px solid ${ALERT_COLOR[a.severity]}25`,borderRadius:10}}>
            <span style={{fontSize:18,flexShrink:0}}>{ALERT_ICON[a.type]}</span>
            <div style={{flex:1}}>
              <div style={{fontSize:12.5,fontWeight:700,color:"var(--bg-card)",lineHeight:1.3}}>{a.title}</div>
              <div style={{fontSize:10.5,color:"var(--text-muted)",marginTop:2,display:"flex",gap:8}}>
                <span style={{color:ALERT_COLOR[a.severity],fontWeight:700}}>{a.severity.toUpperCase()}</span>
                <span>{a.distance}</span>
                <span>·</span>
                <span>{a.time}</span>
              </div>
            </div>
            <button onClick={()=>setDismissed(d=>[...d,a.id])} style={{fontSize:11,color:"var(--text-secondary)",background:"none",border:"none",cursor:"pointer",padding:0,flexShrink:0}}>✕</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPLAINT CARD — expandable with full detail
// ─────────────────────────────────────────────────────────────────────────────
function ComplaintCard({c,expanded,onToggle,onFeedback}:{c:Complaint;expanded:boolean;onToggle:()=>void;onFeedback?:()=>void}){
  const cfg=STATUS_CFG[c.status]||STATUS_CFG.Pending;
  const dc=DEPT_COLOR[c.department||""]||"var(--text-muted)";
  const[activeTab,setActiveTab]=useState<"tracker"|"timeline"|"details">("tracker");
  return(
    <div onClick={e=>{if((e.target as HTMLElement).closest("button:not(.card-header-btn)")){return;}onToggle();}} style={{background:"var(--bg-card)",borderRadius:16,border:`1.5px solid ${expanded?dc+"55":"var(--border)"}`,boxShadow:expanded?`0 6px 24px ${dc}18`:"0 1px 6px rgba(0,0,0,.04)",cursor:"pointer",transition:"all .2s",overflow:"hidden"}}>
      {/* Card header */}
      <div style={{padding:"14px 16px"}}>
        <div style={{display:"flex",alignItems:"flex-start",gap:12}}>
          {/* Dept icon */}
          <div style={{width:42,height:42,borderRadius:11,background:`${dc}15`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:19,flexShrink:0,border:`1.5px solid ${dc}25`,position:"relative"}}>
            {DEPT_ICON[c.department||""]||"🏛️"}
            {c.emergency&&<div style={{position:"absolute",top:-4,right:-4,width:14,height:14,borderRadius:"50%",background:"#ef4444",display:"flex",alignItems:"center",justifyContent:"center",fontSize:7,border:"2px solid white"}}>🚨</div>}
          </div>
          <div style={{flex:1,minWidth:0}}>
            {/* Badges */}
            <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:5,flexWrap:"wrap"}}>
              <span style={{display:"inline-flex",alignItems:"center",gap:4,padding:"2px 9px",borderRadius:20,fontSize:10.5,fontWeight:700,background:cfg.bg,color:cfg.color,border:`1px solid ${cfg.border}`}}>
                <span style={{width:5,height:5,borderRadius:"50%",background:cfg.dot,display:"inline-block"}}/>{cfg.icon} {cfg.label}
              </span>
              {c.emergency&&<span style={{fontSize:9.5,fontWeight:700,color:"#dc2626",background:"#fef2f2",border:"1px solid #fecaca",borderRadius:6,padding:"1px 7px",animation:"pulse 2s ease-in-out infinite"}}>🚨 EMERGENCY</span>}
              {c.aiRouted&&<span style={{fontSize:9.5,fontWeight:700,color:"#7c3aed",background:"#f5f3ff",border:"1px solid #ddd6fe",borderRadius:6,padding:"1px 7px"}}>🤖 AI Routed</span>}
              {c.escalated&&<span style={{fontSize:9.5,fontWeight:700,color:"#dc2626",background:"#fef2f2",border:"1px solid #fecaca",borderRadius:6,padding:"1px 7px"}}>🚨 Escalated</span>}
              {c.feedback&&<span style={{fontSize:9.5,fontWeight:700,color:"#d97706",background:"#fffbeb",border:"1px solid #fde68a",borderRadius:6,padding:"1px 7px"}}>⭐ Rated {c.feedback.rating}/5</span>}
              {c.ticketId&&<span style={{fontSize:9.5,color:"var(--text-muted)",fontFamily:"monospace",background:"var(--bg-card-alt)",padding:"1px 7px",borderRadius:5,border:"1px solid #e8edf3"}}>{c.ticketId}</span>}
            </div>
            {/* Title */}
            <div style={{fontSize:13.5,fontWeight:700,color:"var(--text-primary)",marginBottom:4,whiteSpace:expanded?"normal":"nowrap",overflow:expanded?"visible":"hidden",textOverflow:expanded?"clip":"ellipsis"}}>{c.title||c.category||"Civic Issue"}</div>
            {/* Meta */}
            <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"}}>
              {c.department&&<span style={{fontSize:10.5,fontWeight:600,color:dc}}>{DEPT_ICON[c.department]} {c.department}</span>}
              {c.address&&<span style={{fontSize:10.5,color:"var(--text-muted)"}}>📍 {c.address.slice(0,38)}{c.address.length>38?"…":""}</span>}
              <span style={{fontSize:10.5,color:"var(--text-muted)"}}>📅 {new Date(c.createdAt).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"})}</span>
            </div>
            {c.assignedOfficer&&(
              <div style={{marginTop:5,display:"flex",alignItems:"center",gap:6}}>
                <div style={{width:18,height:18,borderRadius:"50%",background:`${dc}20`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10}}>👮</div>
                <span style={{fontSize:11,color:dc,fontWeight:700}}>{c.assignedOfficer}</span>
                <div style={{width:5,height:5,borderRadius:"50%",background:"#10b981",animation:"pulse 2s ease-in-out infinite"}}/>
                <span style={{fontSize:10.5,color:"var(--text-muted)"}}>actively working</span>
              </div>
            )}
          </div>
          <svg style={{color:"var(--text-muted)",transition:"transform .2s",transform:expanded?"rotate(180deg)":"none",flexShrink:0}} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 9l6 6 6-6" strokeLinecap="round"/></svg>
        </div>
      </div>

      {/* Expanded body */}
      {expanded&&(
        <div style={{borderTop:`1.5px solid ${dc}20`}} onClick={e=>e.stopPropagation()}>
          {/* Tabs */}
          <div style={{display:"flex",borderBottom:"1px solid #f1f5f9",background:"var(--bg-card-alt)"}}>
            {(["tracker","timeline","details"] as const).map(tab=>(
              <button key={tab} onClick={()=>setActiveTab(tab)} style={{flex:1,padding:"10px 0",fontSize:11.5,fontWeight:activeTab===tab?700:500,color:activeTab===tab?dc:"var(--text-muted)",background:"none",border:"none",cursor:"pointer",borderBottom:`2px solid ${activeTab===tab?dc:"transparent"}`,transition:"all .15s",fontFamily:"inherit",textTransform:"capitalize"}}>
                {tab==="tracker"?"🔍 Tracker":tab==="timeline"?"📅 Timeline":"📄 Details"}
              </button>
            ))}
          </div>
          <div style={{padding:"16px"}}>
            {activeTab==="tracker"&&(
              <>
                {c.aiRouted&&c.aiRoutingReason&&(
                  <div style={{marginBottom:12,padding:"10px 13px",background:"linear-gradient(135deg,#1e1b4b,#2e1065)",borderRadius:10,border:"1px solid rgba(139,92,246,.3)",display:"flex",alignItems:"center",gap:10}}>
                    <div style={{width:28,height:28,borderRadius:8,background:"rgba(139,92,246,.25)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,flexShrink:0}}>🤖</div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:9.5,color:"rgba(196,181,253,.7)",fontWeight:700,marginBottom:2}}>AI ROUTED → {(c.department||"").toUpperCase()}</div>
                      <div style={{fontSize:11.5,color:"#c4b5fd"}}>{c.aiRoutingReason}</div>
                    </div>
                    <div style={{fontSize:20}}>{DEPT_ICON[c.department||""]||"🏛️"}</div>
                  </div>
                )}
                <OfficerTracker c={c}/>
                {c.status==="Resolved"&&!c.feedback&&onFeedback&&(
                  <button onClick={onFeedback} className="card-header-btn" style={{width:"100%",marginTop:12,padding:"11px",borderRadius:11,background:"linear-gradient(135deg,#ea6800,#f59e0b)",border:"none",color:"var(--bg-card)",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:8,boxShadow:"0 4px 14px rgba(234,104,0,.3)"}}>
                    ⭐ Rate this resolution
                  </button>
                )}
                {c.feedback&&(
                  <div style={{marginTop:12,padding:"12px",background:"#fffbeb",borderRadius:10,border:"1px solid #fde68a"}}>
                    <div style={{fontSize:10,color:"#d97706",fontWeight:700,marginBottom:5}}>YOUR FEEDBACK</div>
                    <div style={{display:"flex",gap:3,marginBottom:5}}>{[1,2,3,4,5].map(s=><span key={s} style={{fontSize:18,color:s<=c.feedback!.rating?"#f59e0b":"var(--border)"}}>★</span>)}</div>
                    {c.feedback.comment&&<div style={{fontSize:12,color:"#78350f",lineHeight:1.5}}>{c.feedback.comment}</div>}
                  </div>
                )}
              </>
            )}
            {activeTab==="timeline"&&<ComplaintTimeline complaint={c}/>}
            {activeTab==="details"&&(
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {[["Ticket ID",c.ticketId||"—",true],["Status",c.status,false],["Department",`${DEPT_ICON[c.department||""]||""} ${c.department||"—"}`,false],["Category",c.category||"—",false],["Location",c.address||"—",false],["Created",new Date(c.createdAt).toLocaleString("en-IN"),false],["Priority",c.emergency?"🚨 Emergency":"Normal",false],["AI Routed",c.aiRouted?"Yes — "+c.aiRoutingReason:"No",false]].map(([k,v,mono])=>(
                  <div key={k as string} style={{display:"flex",gap:12,padding:"9px 12px",background:"var(--bg-card-alt)",borderRadius:9,border:"1px solid #f1f5f9"}}>
                    <span style={{fontSize:11,fontWeight:700,color:"var(--text-muted)",minWidth:90,flexShrink:0}}>{k as string}</span>
                    <span style={{fontSize:12,color:"var(--text-primary)",fontFamily:mono?"monospace":"inherit",flex:1}}>{v as string}</span>
                  </div>
                ))}
                {c.description&&(
                  <div style={{padding:"10px 12px",background:"var(--bg-card-alt)",borderRadius:9,border:"1px solid #f1f5f9"}}>
                    <div style={{fontSize:10,color:"var(--text-muted)",fontWeight:700,marginBottom:4}}>DESCRIPTION</div>
                    <div style={{fontSize:12.5,color:"var(--text-secondary)",lineHeight:1.6}}>{c.description}</div>
                  </div>
                )}
                {c.image&&<img src={c.image} alt="Evidence" style={{width:"100%",maxHeight:160,objectFit:"cover",borderRadius:10,border:"1px solid #e8edf3"}}/>}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// NOTIFICATIONS PANEL
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// UNIFIED NOTIFICATIONS PANEL
// ─────────────────────────────────────────────────────────────────────────────
interface UnifiedNotif{id:string;icon:string;title:string;body:string;time:string;ticketId?:string;type:"urgent"|"task"|"done"|"alert"|"info"|"warning";read?:boolean;}
function UnifiedNotifsPanel({notifs,onRead,onReadAll,onClose}:{notifs:UnifiedNotif[];onRead:(id:string)=>void;onReadAll:()=>void;onClose:()=>void}){
  const unread=notifs.filter(n=>!n.read).length;
  const tC:{[k:string]:string}={urgent:"#ef4444",task:"#8b5cf6",done:"#10b981",alert:"#f97316",info:"#3b82f6",warning:"#f59e0b"};
  const tB:{[k:string]:string}={urgent:"#fef2f2",task:"#f5f3ff",done:"#ecfdf5",alert:"#fff7ed",info:"#eff6ff",warning:"#fffbeb"};
  const age=(ts:string)=>{const d=Date.now()-new Date(ts).getTime();if(d<60000)return"just now";if(d<3600000)return`${Math.round(d/60000)}m ago`;if(d<86400000)return`${Math.round(d/3600000)}h ago`;return`${Math.round(d/86400000)}d ago`;};
  return(
    <div style={{position:"fixed",right:16,top:68,width:360,background:"#ffffff",borderRadius:16,boxShadow:"0 20px 60px rgba(0,0,0,.18)",border:"1px solid #e2e8f0",zIndex:9999,overflow:"hidden",animation:"fadeIn .2s ease"}}>
      <div style={{padding:"14px 16px",borderBottom:"1px solid #e2e8f0",background:"#f8fafb",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div><div style={{fontWeight:800,fontSize:14,color:"var(--text-primary)"}}>🔔 Notifications</div><div style={{fontSize:10.5,color:"var(--text-muted)",marginTop:1}}>{notifs.length} total · {unread} unread</div></div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          {unread>0&&<button onClick={onReadAll} style={{fontSize:10.5,color:"var(--accent)",background:"rgba(22,163,74,.1)",border:"none",cursor:"pointer",fontWeight:700,fontFamily:"inherit",padding:"4px 10px",borderRadius:7}}>✓ All read</button>}
          <button onClick={onClose} style={{width:26,height:26,borderRadius:"50%",background:"var(--bg-hover)",border:"none",cursor:"pointer",fontSize:13,display:"flex",alignItems:"center",justifyContent:"center",color:"var(--text-muted)"}}>✕</button>
        </div>
      </div>
      <div style={{maxHeight:400,overflowY:"auto"}}>
        {notifs.length===0?(<div style={{textAlign:"center",padding:"36px 16px",color:"var(--text-muted)"}}><div style={{fontSize:32,marginBottom:8}}>🔕</div><div style={{fontSize:13,fontWeight:600}}>No notifications</div></div>
        ):notifs.map(n=>(
          <div key={n.id} onClick={()=>onRead(n.id)} style={{padding:"12px 16px",borderBottom:"1px solid var(--border)",display:"flex",gap:12,alignItems:"flex-start",background:n.read?"var(--bg-card)":`${tC[n.type]}06`,cursor:"pointer",transition:"background .15s"}} onMouseOver={e=>(e.currentTarget.style.background="var(--bg-hover)")} onMouseOut={e=>(e.currentTarget.style.background=n.read?"var(--bg-card)":`${tC[n.type]}06`)}>
            <div style={{width:36,height:36,borderRadius:10,background:tB[n.type],display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>{n.icon}</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:12.5,fontWeight:n.read?500:700,color:n.read?"var(--text-muted)":tC[n.type]}}>{n.title}</div>
              <div style={{fontSize:11.5,color:"var(--text-primary)",marginTop:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontWeight:n.read?400:500}}>{n.body}</div>
              {n.ticketId&&<div style={{fontSize:10,color:"var(--text-muted)",fontFamily:"monospace",marginTop:2}}>{n.ticketId}</div>}
              <div style={{fontSize:10,color:"var(--text-muted)",marginTop:3}}>{age(n.time)}</div>
            </div>
            {!n.read&&<div style={{width:8,height:8,borderRadius:"50%",background:tC[n.type],flexShrink:0,marginTop:4,boxShadow:`0 0 6px ${tC[n.type]}`}}/>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DONUT CHART
// ─────────────────────────────────────────────────────────────────────────────
function DonutChart({resolved,assigned,pending,total}:{resolved:number;assigned:number;pending:number;total:number}){
  const size=110,stroke=14,r=(size-stroke)/2,circ=2*Math.PI*r;
  const pct=(n:number)=>total>0?(n/total)*circ:0;
  const rate=total>0?Math.round((resolved/total)*100):0;
  const segs=[{v:resolved,c:"#10b981",o:0},{v:assigned,c:"#3b82f6",o:pct(resolved)},{v:pending,c:"#f97316",o:pct(resolved)+pct(assigned)}];
  return(
    <div style={{position:"relative",width:size,height:size,flexShrink:0}}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{transform:"rotate(-90deg)"}}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth={stroke}/>
        {total===0&&<circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,.05)" strokeWidth={stroke}/>}
        {segs.map((s,i)=>s.v>0&&<circle key={i} cx={size/2} cy={size/2} r={r} fill="none" stroke={s.c} strokeWidth={stroke} strokeDasharray={`${pct(s.v)} ${circ-pct(s.v)}`} strokeDashoffset={-s.o} strokeLinecap="round"/>)}
      </svg>
      <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
        <span style={{fontSize:20,fontWeight:900,color:"#fff",lineHeight:1}}>{rate}%</span>
        <span style={{fontSize:9,color:"var(--text-muted)",marginTop:2}}>resolved</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AI CHAT ASSISTANT
// ─────────────────────────────────────────────────────────────────────────────
const AI_RESP:{[k:string]:string}={
  status:"Check your complaint status below. Each card shows live status — Pending → Assigned → In Progress → Resolved. Click any card to see the full tracker. 📊",
  route:"Our AI reads your complaint text and matches keywords (water→Water Works, road→Roads, power→Electricity). It routes automatically to the right department officer! 🤖",
  officer:"Once submitted, a department officer reviews and is assigned. You'll see their name, field notes, and updates — all synced live from the officer's dashboard. 👮",
  track:"Each complaint shows a 5-step tracker: Submitted → AI Routed → Officer Assigned → Investigating → Resolved. Click any complaint to see the timeline tab. 📅",
  report:"Tap 'Report New Issue' → fill title & description → AI detects department → add GPS location (auto-captured) → attach photo (optional) → submit! 📝",
  emergency:"🚨 Emergency Numbers:\n• Police: 100\n• Fire: 101\n• Ambulance: 108\n• Disaster: 1070\n• AP Emergency: 112\n• Helpline: 1800-425-0082\nUse the Emergency Quick Call section below!",
  escalat:"If your complaint needs urgent attention, officers can escalate to HQ. You'll see the 🚨 Escalated badge and get notified. If unresolved too long, contact the helpline.",
  feedback:"After your complaint is resolved, a 'Rate this resolution' button appears. Rate 1-5 stars and add comments to help improve civic services.",
  duplicate:"Our system checks if a similar issue was already reported nearby (within 300m). You'll see a warning but can still submit if your complaint has more details.",
  alert:"Area alerts notify you about risks near you — power outages, floods, accidents. See the risk alerts panel. You can dismiss alerts once noted.",
  timeline:"The Timeline tab (on each complaint card) shows every event: submission → routing → officer assignment → field updates → resolution, with timestamps.",
  dept:"CivicConnect serves: ⚡ Electricity, 💧 Water Works, 🗑️ Sanitation, 🛣️ Roads, 👮 Police, 🔥 Fire, 🏛️ General Civic. AI picks the best department for your issue.",
  help:"Ask me about: complaint status, AI routing, officer tracking, feedback, duplicates, area alerts, timeline, emergency contacts, or how to report issues. 🤖",
};
interface AiMsg{role:"ai"|"user";text:string;time:string}
function AIAssistant({userName}:{userName:string}){
  const[msgs,setMsgs]=useState<AiMsg[]>([{role:"ai",text:`Hi ${userName||"there"}! 👋 I'm your CivicConnect AI Assistant.\n\nYour complaints are auto-routed to the right department, and you'll get notified of every update. Ask me anything!`,time:"now"}]);
  const[input,setInput]=useState(""),[ typing,setTyping]=useState(false);
  const endRef=useRef<HTMLDivElement>(null);
  const QUICK=["How does AI routing work?","How to track my complaint?","Emergency numbers","What is area risk alert?","How to give feedback?"];
  useEffect(()=>{endRef.current?.scrollIntoView({behavior:"smooth"});},[msgs,typing]);
  const send=(text:string)=>{
    if(!text.trim())return;
    const t=new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
    setMsgs(m=>[...m,{role:"user",text,time:t}]);setInput("");setTyping(true);
    setTimeout(()=>{
      const lower=text.toLowerCase();
      const key=Object.keys(AI_RESP).find(k=>lower.includes(k));
      const reply=key?AI_RESP[key]:"Great question! I can help with complaint status, AI routing, officer tracking, emergency contacts, feedback, duplicate detection, or area alerts. What would you like to know? 🤖";
      setMsgs(m=>[...m,{role:"ai",text:reply,time:new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}]);setTyping(false);
    },900);
  };
  return(
    <div style={{display:"flex",flexDirection:"column",height:"100%",minHeight:0}}>
      <div style={{flex:1,overflowY:"auto",padding:"12px 14px",display:"flex",flexDirection:"column",gap:10,minHeight:0}}>
        {msgs.map((m,i)=>(
          <div key={i} style={{display:"flex",flexDirection:m.role==="user"?"row-reverse":"row",alignItems:"flex-end",gap:7}}>
            {m.role==="ai"&&<div style={{width:28,height:28,borderRadius:"50%",background:"linear-gradient(135deg,#ea6800,#f59e0b)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,flexShrink:0}}>🤖</div>}
            <div style={{maxWidth:"80%",padding:"9px 13px",borderRadius:m.role==="user"?"14px 14px 4px 14px":"14px 14px 14px 4px",background:m.role==="user"?"linear-gradient(135deg,#0f172a,#1a2a4a)":"var(--bg-card-alt)",border:m.role==="user"?"none":"1px solid #e2e8f0",color:m.role==="user"?"var(--bg-card)":"var(--text-primary)",fontSize:12.5,lineHeight:1.6,whiteSpace:"pre-line"}}>
              {m.text}
              <div style={{fontSize:10,color:m.role==="user"?"rgba(255,255,255,.35)":"var(--text-muted)",marginTop:4}}>{m.time}</div>
            </div>
          </div>
        ))}
        {typing&&<div style={{display:"flex",alignItems:"center",gap:7}}><div style={{width:28,height:28,borderRadius:"50%",background:"linear-gradient(135deg,#ea6800,#f59e0b)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12}}>🤖</div><div style={{padding:"10px 14px",background:"var(--bg-card-alt)",border:"1px solid #e2e8f0",borderRadius:"14px 14px 14px 4px",display:"flex",gap:4,alignItems:"center"}}>{[0,1,2].map(i=><div key={i} style={{width:6,height:6,borderRadius:"50%",background:"var(--text-muted)",animation:`bounce 1.2s ${i*.2}s ease-in-out infinite`}}/>)}</div></div>}
        <div ref={endRef}/>
      </div>
      <div style={{padding:"6px 12px",display:"flex",flexWrap:"wrap",gap:5}}>
        {QUICK.map(q=><button key={q} onClick={()=>send(q)} style={{fontSize:10.5,padding:"3px 9px",borderRadius:20,border:"1px solid #e2e8f0",background:"var(--bg-card-alt)",color:"var(--text-secondary)",cursor:"pointer",fontWeight:500,fontFamily:"inherit"}} onMouseEnter={e=>{const b=e.currentTarget;b.style.background="#ea6800";b.style.color="var(--bg-card)";b.style.borderColor="#ea6800";}} onMouseLeave={e=>{const b=e.currentTarget;b.style.background="var(--bg-card-alt)";b.style.color="var(--text-secondary)";b.style.borderColor="var(--border)";}}>{q}</button>)}
      </div>
      <div style={{padding:"8px 12px 12px",display:"flex",gap:8}}>
        <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send(input)} placeholder="Ask about routing, tracking, feedback…" style={{flex:1,padding:"9px 13px",border:"1.5px solid #e2e8f0",borderRadius:10,fontSize:12.5,outline:"none",fontFamily:"inherit",background:"var(--bg-card-alt)",color:"var(--text-primary)"}} onFocus={e=>(e.target.style.borderColor="#ea6800")} onBlur={e=>(e.target.style.borderColor="var(--border)")}/>
        <button onClick={()=>send(input)} style={{width:36,height:36,borderRadius:10,background:input.trim()?"linear-gradient(135deg,#ea6800,#f59e0b)":"var(--border)",border:"none",cursor:input.trim()?"pointer":"default",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--bg-card)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN DASHBOARD COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function CitizenDashboard(){
  const reduxComplaints=useSelector((s:RootState)=>s.complaints.complaints);
  const notifications=useSelector((s:RootState)=>s.notifications.list);
  const user=useSelector((s:RootState)=>s.auth.user);
  const dispatch=useDispatch();
  const navigate=useNavigate();

  // UI state
  const[showSubmit,setShowSubmit]=useState(false);
  const[showNotifs,setShowNotifs]=useState(false);
  const[showUserMenu,setShowUserMenu]=useState(false);
  const[activeNav,setActiveNav]=useState<"dashboard"|"complaints"|"map"|"emergency"|"profile">("dashboard");
  const[showWelcome,setShowWelcome]=useState(false);
  const[isReturning,setIsReturning]=useState(false);
  const[expandedId,setExpandedId]=useState<string|null>(null);
  const[feedbackComplaint,setFeedbackComplaint]=useState<Complaint|null>(null);
  const[statusFilter,setStatusFilter]=useState<"All"|"Pending"|"Assigned"|"In Progress"|"Resolved">("All");
  const[citizenNotifs,setCitizenNotifs]=useState<CitizenNotif[]>([]);
  const[liveComplaints,setLiveComplaints]=useState<Complaint[]>([]);
  const[toast,setToast]=useState<{msg:string;type:"success"|"error"|"info"}|null>(null);
  const initDone=useRef(false);
  const prevRef=useRef<Complaint[]>([]);

  // Generate a stable userId — never let it be undefined/null
  const userId=String((user as any)?.id||user?.email||user?.name||"citizen").replace(/[^a-zA-Z0-9_-]/g,"_");
  const showToast=useCallback((msg:string,type:"success"|"error"|"info"="success")=>{setToast({msg,type});setTimeout(()=>setToast(null),3500);},[]);

  /* ── Init ── */
  useEffect(()=>{
    if(!user||initDone.current)return;
    initDone.current=true;
    const seenKey=`ap_seen_${userId}`;
    if(!lsLoad<boolean>(seenKey)){setShowWelcome(true);lsSave(seenKey,true);}
    else setIsReturning(true);
    lsSave(AUTH_KEY,{user,isAuthenticated:true});
  },[user]);

  /* ── Toast auto-dismiss ── */
  useEffect(()=>{if(toast){}});

  /* ── Live sync — polls every 5s for officer updates ── */
  useEffect(()=>{
    const loadMine=async()=>{
      const all=await fetchComplaintsFromServer();
      if(!Array.isArray(all)) return;
      // /complaints/mine already returns only this user's complaints
      const mine=all;
      setLiveComplaints(mine);
      // Also load real notifications from backend
      try{
        const tok=JSON.parse(localStorage.getItem("auth")||"{}").token;
        const nRes=await fetch(`${API}/notifications`,{headers:{Authorization:`Bearer ${tok}`}});
        if(nRes.ok){
          const nData=await nRes.json();
          const notifs=Array.isArray(nData?.data)?nData.data:[];
          if(notifs.length>0){
            setCitizenNotifs(notifs.map((n:any)=>({
              id:        n.id,
              message:   n.message,
              type:      n.type||"info",
              read:      n.is_read===1||n.is_read===true,
              time:      new Date(n.created_at||Date.now()).toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"}),
              urgent:    n.type==="error",
            })));
          }
        }
      }catch{}
      const prev=prevRef.current;
      if(prev.length>0){
        const newN:CitizenNotif[]=[];
        mine.forEach(c=>{
          const p=prev.find(x=>x.id===c.id);if(!p)return;
          const t=new Date().toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"});
          if(p.status!==c.status)newN.push({id:`ns-${c.id}-${Date.now()}`,message:c.status==="Resolved"?`✅ "${c.title||c.category}" has been resolved!`:`🔄 Status updated to "${c.status}" for "${c.title||c.category}"`,type:c.status==="Resolved"?"resolved":"status",complaintId:c.id,ticketId:c.ticketId,read:false,time:t});
          if(!p.assignedOfficer&&c.assignedOfficer)newN.push({id:`no-${c.id}-${Date.now()}`,message:`👮 Officer ${c.assignedOfficer} assigned to your complaint`,type:"officer",complaintId:c.id,ticketId:c.ticketId,read:false,time:t});
          if(!p.officerNote&&c.officerNote)newN.push({id:`nn-${c.id}-${Date.now()}`,message:`📝 Officer note added: "${c.officerNote.slice(0,60)}${c.officerNote.length>60?"…":""}"`,type:"note",complaintId:c.id,ticketId:c.ticketId,read:false,time:t});
          if(!p.escalated&&c.escalated)newN.push({id:`ne-${c.id}-${Date.now()}`,message:`🚨 "${c.title||c.category}" escalated to HQ for priority attention`,type:"escalated",complaintId:c.id,ticketId:c.ticketId,read:false,time:t,urgent:true});
        });
        if(newN.length>0){setCitizenNotifs(prev=>[...newN,...prev].slice(0,30));if(newN.some(n=>n.urgent))showToast("🚨 Urgent update on your complaint!","error");else showToast(`🔔 ${newN[0].message.slice(0,60)}…`,"info");}
      }
      prevRef.current=mine;
    };
    loadMine();
    const iv=setInterval(loadMine, 30000);
    window.addEventListener("storage",loadMine);
    return()=>{clearInterval(iv);window.removeEventListener("storage",loadMine);};
  },[userId,user?.name,user?.email]);

  /* ── Sync redux complaints → localStorage (one-time migration only) ── */
  useEffect(()=>{
    if(!user||reduxComplaints.length===0)return;
    // Only migrate Redux complaints that are NOT already in complaints_all
    const existing:Complaint[] = [];
    try{ const raw=localStorage.getItem("complaints_all"); if(raw){const a=JSON.parse(raw);if(Array.isArray(a))a.forEach((c:any)=>existing.push(c));} }catch{}
    const existingIds = new Set(existing.map(c=>c.id));
    reduxComplaints.forEach(rc=>{
      try{
        if(existingIds.has((rc as any).id)) return; // already synced, don't overwrite
        let c:Complaint=JSON.parse(JSON.stringify(rc)) as unknown as Complaint;
        if(!c.userId) c.userId=userId;
        if(typeof (c as any).createdAt==="number")(c as any).createdAt=new Date((c as any).createdAt).toISOString();
        if(!c.department||c.department==="General Civic"){
          const r=aiRouteDepartment(c);c.department=r.department;c.aiRouted=true;c.aiRoutingReason=r.reason;
        }
        persistComplaint(c);
      }catch{}
    });
  },[]);// run once on mount only

  /* ── Handle new complaint submission ── */
  const handleNewComplaint=useCallback(async (c:Complaint)=>{
    // 1. Immediately show in UI (optimistic update)
    setLiveComplaints(prev=>[c,...prev]);
    setShowSubmit(false);
    setExpandedId(c.id);
    showToast(`✅ Submitting complaint to ${c.department}...`,"info");
    setActiveNav("complaints");

    // 2. Send to backend — await real ticket_id from MySQL
    const saved = await persistComplaint(c);
    const realTicketId = saved?.ticket_id ?? saved?.ticketId ?? c.ticketId;

    if(saved){
      showToast(`✅ Saved to database! Ticket: ${realTicketId}`,"success");
    } else {
      showToast(`⚠️ Saved locally. Will sync when server is available.`,"info");
    }

    setCitizenNotifs(prev=>[{
      id:`ns-new-${Date.now()}`,
      message:`📝 Complaint submitted! Ticket: ${realTicketId}. Routed to ${c.department}.`,
      type:"status",complaintId:c.id,ticketId:realTicketId,read:false,
      time:new Date().toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"}),
      urgent:false
    } as any,...prev]);

    // 3. Refresh from server after 1.5s to sync latest data
    setTimeout(async()=>{
      const fresh = await fetchComplaintsFromServer();
      if(fresh.length > 0) setLiveComplaints(fresh);
    }, 1500);
  },[showToast]);

  /* ── Handle feedback — saves to MySQL ── */
  const handleFeedback=useCallback(async(complaint:Complaint,fb:Feedback)=>{
    // Call backend rating endpoint
    try{
      const token=JSON.parse(localStorage.getItem("auth")||"{}").token;
      const res=await fetch(`${API}/complaints/${complaint.id}/rate`,{
        method:"POST",
        headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},
        body:JSON.stringify({rating:fb.rating,comment:fb.comment||""}),
      });
      const data=await res.json();
      if(!data.success) console.warn("[rating] backend failed:",data.message);
      else console.log("[rating] ✅ Saved to MySQL");
    }catch(e){console.warn("[rating] backend error:",e);}
    // Update local state
    const updated={...complaint,feedback:fb,rating:fb.rating};
    setLiveComplaints(prev=>prev.map(c=>c.id===complaint.id?updated:c));
    setFeedbackComplaint(null);
    showToast("⭐ Thank you! Rating saved.","success");
  },[showToast]);

  /* ── Computed ── */
  const complaints=liveComplaints.length>0?liveComplaints:(reduxComplaints as unknown as Complaint[]);
  const total=complaints.length;
  const resolved=complaints.filter(c=>c.status==="Resolved").length;
  const assigned=complaints.filter(c=>c.status==="Assigned"||c.status==="In Progress").length;
  const pending=complaints.filter(c=>c.status==="Pending").length;
  const emergency=complaints.filter(c=>c.emergency).length;
  const aiRoutedCount=complaints.filter(c=>c.aiRouted).length;
  const unreadCount=citizenNotifs.filter(n=>!n.read).length+notifications.filter(n=>!n.read).length;
  const resolutionRate=total>0?Math.round((resolved/total)*100):0;
  const avgRating=complaints.filter(c=>c.feedback).length>0?
    (complaints.filter(c=>c.feedback).reduce((a,c)=>a+(c.feedback?.rating||0),0)/complaints.filter(c=>c.feedback).length).toFixed(1):"—";
  const todayCount=complaints.filter(c=>new Date(c.createdAt).toDateString()===new Date().toDateString()).length;

  const filtered=useMemo(()=>complaints.filter(c=>statusFilter==="All"||c.status===statusFilter),[complaints,statusFilter]);
  const recent=[...complaints].reverse().slice(0,5);

  const greeting=()=>{const h=new Date().getHours();return h<12?"Good morning":h<17?"Good afternoon":"Good evening";};
  const greetingEmoji=()=>{const h=new Date().getHours();return h<12?"☕":h<17?"👋":"🌙";};
  const handleLogout=()=>{lsRemove(AUTH_KEY);dispatch(clearNotifications());dispatch(clearComplaints());dispatch(logout());navigate("/login",{replace:true});};
  const markRead=(id:string)=>setCitizenNotifs(p=>p.map(n=>n.id===id?{...n,read:true}:n));
  const markAll=()=>{setCitizenNotifs(p=>p.map(n=>({...n,read:true})));dispatch(markAllRead());};

  if(!user)return null;

  /* ═══════════════════════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════════════════════ */
  return(
    <div style={{minHeight:"100vh",background:"var(--bg-page)",fontFamily:"'DM Sans','Nunito',system-ui,sans-serif",paddingTop:64}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800;9..40,900&family=DM+Serif+Display&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
        @keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.6;transform:scale(1.2)}}
        @keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes slideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes slideRight{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}
        .ch{transition:transform .2s,box-shadow .2s;}.ch:hover{transform:translateY(-2px);box-shadow:0 8px 28px rgba(0,0,0,.1)!important;}
        a{cursor:pointer;}
        ::-webkit-scrollbar{width:4px;height:4px;}::-webkit-scrollbar-track{background:transparent;}::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:4px;}
      `}</style>

      {/* ── TOAST ── */}
      {toast&&(
        <div style={{position:"fixed",top:20,right:20,zIndex:2000,padding:"12px 18px",borderRadius:12,background:toast.type==="success"?"var(--text-primary)":toast.type==="error"?"#7f1d1d":"#1e2a4a",border:`1px solid ${toast.type==="success"?"rgba(16,185,129,.3)":toast.type==="error"?"rgba(239,68,68,.3)":"rgba(59,130,246,.3)"}`,color:"var(--bg-card)",fontSize:12.5,fontWeight:600,maxWidth:340,boxShadow:"0 8px 32px rgba(0,0,0,.3)",animation:"slideRight .35s ease",display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:16}}>{toast.type==="success"?"✅":toast.type==="error"?"🚨":"ℹ️"}</span>
          {toast.msg}
        </div>
      )}

      {/* ── NAV ── */}
      {/* ═══ NAVBAR ═══ */}
      <nav style={{
  background:"var(--bg-nav-glass)",
  position:"fixed",
  top:0,
  left:0,
  right:0,
  zIndex:200,
  borderBottom:"1px solid var(--nav-border)",
  boxShadow:"0 2px 20px rgba(22,163,74,.12)",
  backdropFilter:"blur(12px)",
  WebkitBackdropFilter:"blur(12px)"
}}>
  <div style={{
    maxWidth:1440,
    margin:"0 auto",
    padding:"0 24px",
    height:64,
    display:"flex",
    alignItems:"center",
    justifyContent:"space-between",
    gap:16
  }}>
    
    {/* Brand */}
    <div style={{display:"flex",alignItems:"center",gap:12,flexShrink:0}}>
      <img src="/ap-bg.png" alt="AP Seal" style={{width:44,height:44,objectFit:"contain",flexShrink:0}}/>
      <div>
        <div style={{fontSize:15,fontWeight:800,color:"var(--text-primary)",letterSpacing:"-.01em",lineHeight:1}}>
          CivicConnect
        </div>
        <div style={{fontSize:10,color:"var(--accent)",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginTop:2}}>
          LIVE • CIVICCONNECT PLATFORM
        </div>
      </div>
    </div>

    {/* Center Navigation */}
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 20
    }}>
      {([
        ["dashboard"," Dashboard"],
        ["complaints"," Complaints"],
        ["map"," Live Map"],
        ["emergency"," Emergency"]
      ] as const).map(([nav,label])=>(
        <button
          key={nav}
          onClick={()=>setActiveNav(nav)}
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            fontFamily: "inherit",
            fontSize: 14,

            // color
            color: activeNav === nav ? "#14532d" : "#16a34a",

            // font
            fontWeight: activeNav === nav ? 700 : 500,

            paddingBottom: "6px",
            transition: "all 0.2s ease",
            position: "relative",
            whiteSpace: "nowrap"
          }}
        >
          {label}

          {/* Notification badge */}
          {nav==="complaints" && pending>0 && (
            <span style={{
              position:"absolute",
              top:-6,
              right:-10,
              background:"#16a34a",
              color:"#fff",
              fontSize:9,
              fontWeight:700,
              minWidth:16,
              height:16,
              borderRadius:8,
              display:"flex",
              alignItems:"center",
              justifyContent:"center",
              padding:"0 4px"
            }}>
              {pending}
            </span>
          )}
        </button>
      ))}
    </div>

    {/* Right Side */}
    <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>

      {/* REPORT ISSUE BUTTON */}
      <button
        onClick={()=>setShowSubmit(true)}
        onMouseEnter={(e)=>e.currentTarget.style.background="#15803d"}
        onMouseLeave={(e)=>e.currentTarget.style.background="#16a34a"}
        style={{
          display:"flex",
          alignItems:"center",
          gap:7,
          background:"#16a34a",
          border:"none",
          color:"#fff",
          padding:"8px 16px",
          borderRadius:10,
          fontWeight:700,
          fontSize:12.5,
          cursor:"pointer",
          boxShadow:"0 3px 12px rgba(22,163,74,.35)",
          fontFamily:"inherit",
          transition:"all .2s"
        }}
      >
        <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
        </svg>
        Report Issue
      </button>

      {/* Notifications */}
      <div style={{position:"relative"}}>
        <button
          onClick={()=>{setShowNotifs(!showNotifs);setShowUserMenu(false);}}
          style={{
            width:38,
            height:38,
            borderRadius:10,
            background:showNotifs?"var(--accent)":"var(--bg-card-alt)",
            border:`1px solid ${showNotifs?"var(--accent)":"var(--border)"}`,
            color:showNotifs?"#fff":"var(--text-secondary)",
            display:"flex",
            alignItems:"center",
            justifyContent:"center",
            cursor:"pointer",
            position:"relative",
            transition:"all .2s"
          }}
        >
          🔔
          {unreadCount>0 && (
            <span style={{
              position:"absolute",
              top:-4,
              right:-4,
              background:"#ef4444",
              color:"#fff",
              fontSize:9,
              fontWeight:800,
              minWidth:17,
              height:17,
              borderRadius:9,
              display:"flex",
              alignItems:"center",
              justifyContent:"center"
            }}>
              {unreadCount}
            </span>
          )}
        </button>

        {showNotifs && (
          <UnifiedNotifsPanel
            notifs={citizenNotifs}
            onRead={markRead}
            onReadAll={markAll}
            onClose={()=>setShowNotifs(false)}
          />
        )}
      </div>

      {/* User Menu */}
      <div style={{position:"relative"}}>
        <button
          onClick={()=>{setShowUserMenu(!showUserMenu);setShowNotifs(false);}}
          style={{
            display:"flex",
            alignItems:"center",
            gap:8,
            background:showUserMenu?"rgba(22,163,74,.1)":"var(--bg-card-alt)",
            border:`1px solid ${showUserMenu?"var(--accent)":"var(--border)"}`,
            borderRadius:12,
            padding:"5px 11px 5px 6px",
            cursor:"pointer",
            transition:"all .2s"
          }}
        >
          <div style={{
            width:30,
            height:30,
            borderRadius:9,
            background:"linear-gradient(135deg,#16a34a,#22c55e)",
            display:"flex",
            alignItems:"center",
            justifyContent:"center",
            fontWeight:800,
            fontSize:13,
            color:"#fff"
          }}>
            {user?.name?.charAt(0).toUpperCase() || "C"}
          </div>

          <div style={{textAlign:"left"}}>
            <div style={{fontSize:12.5,fontWeight:700,color:"var(--text-primary)"}}>
              {user?.name?.split(" ")[0] || "Citizen"}
            </div>
            <div style={{fontSize:9.5,color:"var(--accent)",fontWeight:600}}>
              Citizen
            </div>
          </div>
        </button>
      </div>

    </div>
  </div>
</nav>

      {/* ── HERO ── */}
      <div style={{
  background:"linear-gradient(135deg,#16a34a 0%,#15803d 60%,#166534 100%)",
  padding:"24px 24px 20px",
  position:"relative",
  overflow:"hidden"
}}>

  {/* Decorative Background */}
  <div style={{
    position:"absolute",
    inset:0,
    backgroundImage:"radial-gradient(circle at 1px 1px,rgba(255,255,255,.08) 1px,transparent 0)",
    backgroundSize:"28px 28px",
    pointerEvents:"none"
  }}/>

  <div style={{
    position:"absolute",
    top:-80,
    right:-80,
    width:360,
    height:360,
    borderRadius:"50%",
    background:"rgba(255,255,255,.06)",
    filter:"blur(70px)"
  }}/>

  <div style={{
    position:"absolute",
    bottom:-50,
    left:-30,
    width:260,
    height:260,
    borderRadius:"50%",
    background:"rgba(255,255,255,.04)",
    filter:"blur(60px)"
  }}/>

  <div style={{maxWidth:1440,margin:"0 auto",position:"relative"}}>

    {/* Header */}
    <div style={{
      display:"flex",
      alignItems:"flex-end",
      justifyContent:"space-between",
      gap:20,
      flexWrap:"wrap",
      marginBottom:16
    }}>

      {/* Title */}
      <div>
        <div style={{
          fontSize:10,
          color:"rgba(255,255,255,.75)",
          fontWeight:700,
          letterSpacing:".15em",
          marginBottom:4,
          textTransform:"uppercase"
        }}>
          Smart Governance & Citizen Services Platform · Citizen Safety
        </div>

        <h1 style={{
          fontSize:32,
          fontWeight:900,
          color:"#fff",
          lineHeight:1.1,
          fontFamily:"'DM Serif Display',Georgia,serif",
          letterSpacing:"-0.02em"
        }}>
          {greeting()}, {user?.name?.split(" ")[0] || "Citizen"} {greetingEmoji()}
        </h1>

        <p style={{
          color:"rgba(255,255,255,.75)",
          fontSize:13,
          marginTop:5
        }}>
          Smart Civic Portal · Live Citizen Updates
        </p>
      </div>
    </div>

    {/* Stats bar */}
    <div style={{
      display:"flex",
      gap:5,
      flexWrap:"wrap",
      alignItems:"center",
      justifyContent:"space-between"
    }}>

      <div style={{display:"flex",gap:20,flexWrap:"wrap"}}>
        {[
          {l:"Total",v:total,c:"#60a5fa"},
          {l:"Resolved",v:resolved,c:"#34d399"},
          {l:"In Progress",v:assigned,c:"#818cf8"},
          {l:"Pending",v:pending,c:"#fb923c"},
          {l:"Emergency",v:emergency,c:"#f87171"},
          {l:"AI Routed",v:aiRoutedCount,c:"#c084fc"},
          {l:"Rate",v:`${resolutionRate}%`,c:"#34d399"},
          {l:"Avg Rating",v:avgRating==="—"?avgRating:`${avgRating}⭐`,c:"#fbbf24"},
        ].map(s=>(
          <div key={s.l} style={{display:"flex",alignItems:"center",gap:5}}>
            <span style={{
              fontSize:20,
              fontWeight:900,
              color:s.c,
              lineHeight:1
            }}>
              {s.v}
            </span>

            <span style={{
              fontSize:10,
              color:"rgba(255,255,255,.7)",
              lineHeight:1.3
            }}>
              {s.l}
            </span>
          </div>
        ))}
      </div>

      {/* Live indicator */}
      <div style={{
        display:"flex",
        alignItems:"center",
        gap:6,
        background:"rgba(16,185,129,.15)",
        border:"1px solid rgba(16,185,129,.35)",
        borderRadius:20,
        padding:"4px 12px"
      }}>
        <div style={{
          width:7,
          height:7,
          borderRadius:"50%",
          background:"#10b981",
          animation:"pulse 2s ease-in-out infinite"
        }}/>

        <span style={{
          fontSize:10.5,
          color:"#10b981",
          fontWeight:700
        }}>
          LIVE SYNC WITH OFFICERS
        </span>
      </div>

    </div>

  </div>
</div>

      {/* ── MAIN CONTENT ── */}
      <div style={{maxWidth:1440,margin:"0 auto",padding:"22px 24px"}}>

        {/* Welcome banners */}
        {showWelcome&&(
          <div style={{background:"linear-gradient(135deg,#0f172a 0%,#1a2a4a 60%,#1e3a5f 100%)",borderRadius:20,padding:"28px 32px",marginBottom:22,border:"1px solid rgba(234,104,0,.25)",position:"relative",overflow:"hidden",boxShadow:"0 8px 32px rgba(0,0,0,.2)",animation:"fadeIn .5s ease"}}>
            <div style={{position:"absolute",top:-60,right:-60,width:280,height:280,borderRadius:"50%",background:"rgba(234,104,0,.12)",filter:"blur(60px)"}}/>
            <div style={{position:"relative",display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:20,flexWrap:"wrap"}}>
              <div style={{flex:1}}>
                <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:10}}><span style={{fontSize:36}}>🎉</span><div><div style={{fontSize:10,color:"#ea6800",fontWeight:700,letterSpacing:".12em",textTransform:"uppercase",marginBottom:3}}>Welcome to CivicConnect</div><h2 style={{fontSize:24,fontWeight:900,color:"var(--bg-card)",fontFamily:"'DM Serif Display',serif"}}>Hello, {user?.name?.split(" ")[0]||"there"}! 👋</h2></div></div>
                <p style={{color:"var(--text-muted)",fontSize:13,lineHeight:1.6,maxWidth:460,marginBottom:16}}>Your account is ready! Report civic issues — potholes, water leaks, power outages. Our <strong style={{color:"#c4b5fd"}}>AI automatically routes your complaint</strong> to the right department officer with GPS location capture.</p>
                <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                  <button onClick={()=>setShowSubmit(true)} style={{display:"flex",alignItems:"center",gap:7,background:"#ea6800",color:"var(--bg-card)",padding:"10px 20px",borderRadius:11,fontWeight:700,fontSize:13,border:"none",cursor:"pointer",boxShadow:"0 4px 16px rgba(234,104,0,.4)",fontFamily:"inherit"}}>📝 Report First Issue</button>
                  <button onClick={()=>setShowWelcome(false)} style={{display:"flex",alignItems:"center",gap:7,background:"rgba(255,255,255,.07)",color:"rgba(255,255,255,.6)",padding:"10px 18px",borderRadius:11,fontWeight:600,fontSize:13,border:"1px solid rgba(255,255,255,.12)",cursor:"pointer",fontFamily:"inherit"}}>Explore Dashboard</button>
                </div>
              </div>
              <div style={{background:"rgba(255,255,255,.04)",borderRadius:14,padding:"16px 20px",border:"1px solid rgba(255,255,255,.08)",minWidth:200,flexShrink:0}}>
                <div style={{fontSize:10,color:"var(--text-secondary)",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:12}}>How it works</div>
                {[{icon:"📝",text:"Submit civic issue + GPS"},{icon:"🤖",text:"AI routes to right dept"},{icon:"👮",text:"Officer assigned to you"},{icon:"📅",text:"Track full timeline"},{icon:"✅",text:"Resolved & feedback"}].map((s,i)=>(
                  <div key={i} style={{display:"flex",alignItems:"center",gap:10,marginBottom:i<4?8:0}}><span style={{fontSize:13}}>{s.icon}</span><span style={{fontSize:12,color:"var(--text-secondary)"}}>{s.text}</span></div>
                ))}
              </div>
            </div>
          </div>
        )}

        {isReturning&&!showWelcome&&(
          <div style={{background:"linear-gradient(135deg,#0f2a1a,#0f172a)",border:"1px solid rgba(16,185,129,.25)",borderRadius:13,padding:"13px 18px",marginBottom:18,display:"flex",alignItems:"center",gap:13,boxShadow:"0 4px 20px rgba(0,0,0,.2)",animation:"fadeIn .4s ease"}}>
            <div style={{width:34,height:34,borderRadius:9,background:"rgba(16,185,129,.15)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>👋</div>
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:700,color:"var(--bg-card)"}}>Welcome back, {user?.name?.split(" ")[0]}!</div>
              <div style={{fontSize:11.5,color:"var(--text-secondary)",marginTop:2}}>{total} complaint{total!==1?"s":""} on record{pending>0?` · ${pending} still pending`:" · all resolved ✅"}</div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:5,background:"rgba(16,185,129,.12)",borderRadius:20,padding:"4px 10px",flexShrink:0}}>
              <div style={{width:6,height:6,borderRadius:"50%",background:"#10b981",boxShadow:"0 0 6px #10b981"}}/>
              <span style={{fontSize:10,color:"#10b981",fontWeight:700}}>DATA SYNCED</span>
            </div>
          </div>
        )}

        {/* ══ DASHBOARD VIEW ══ */}
        {activeNav==="dashboard"&&(
          <div style={{display:"grid",gridTemplateColumns:"320px 1fr",gap:20}}>
            {/* LEFT COLUMN */}
            <div style={{display:"flex",flexDirection:"column",gap:18}}>
              {/* Donut + stats */}
              <div className="ch" style={{background:"var(--text-primary)",borderRadius:18,padding:20,boxShadow:"0 4px 20px rgba(0,0,0,.18)",animation:"fadeIn .4s ease .05s both",position:"relative",overflow:"hidden"}}>
                <div style={{position:"absolute",top:-30,right:-30,width:120,height:120,borderRadius:"50%",background:"rgba(234,104,0,.12)",filter:"blur(30px)"}}/>
                <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:14}}>
                  <div>
                    <div style={{fontSize:12,color:"var(--text-muted)",fontWeight:600,marginBottom:3}}>My Resolution Progress</div>
                    <div style={{fontSize:10.5,color:"var(--border-strong)"}}>{total} complaint{total!==1?"s":""} submitted</div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:5,background:"rgba(234,104,0,.12)",borderRadius:20,padding:"3px 10px"}}>
                    <div style={{width:6,height:6,borderRadius:"50%",background:"#ea6800",animation:"pulse 2s ease-in-out infinite"}}/>
                    <span style={{fontSize:10,color:"#ea6800",fontWeight:700}}>LIVE</span>
                  </div>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:16}}>
                  <DonutChart resolved={resolved} assigned={assigned} pending={pending} total={total}/>
                  <div style={{flex:1,display:"flex",flexDirection:"column",gap:8}}>
                    {[{l:"Resolved",v:resolved,c:"#10b981"},{l:"In Progress",v:assigned,c:"#3b82f6"},{l:"Pending",v:pending,c:"#f97316"},{l:"Emergency",v:emergency,c:"#ef4444"}].map(item=>(
                      <div key={item.l} style={{display:"flex",alignItems:"center",gap:8}}>
                        <div style={{width:8,height:8,borderRadius:"50%",background:item.c,flexShrink:0}}/>
                        <span style={{fontSize:11,color:"var(--text-muted)",flex:1}}>{item.l}</span>
                        <span style={{fontSize:13,fontWeight:800,color:"var(--bg-card)"}}>{item.v}</span>
                      </div>
                    ))}
                    {avgRating!=="—"&&<div style={{marginTop:4,padding:"6px 10px",background:"rgba(251,191,36,.1)",borderRadius:8,display:"flex",alignItems:"center",gap:6}}><span style={{fontSize:13}}>⭐</span><span style={{fontSize:11,color:"#fbbf24",fontWeight:700}}>Avg Rating: {avgRating}/5</span></div>}
                  </div>
                </div>
              </div>

              {/* Area Alerts */}
              <div style={{animation:"fadeIn .4s ease .08s both"}}><AreaAlertsPanel/></div>

              {/* AI routing summary */}
              {aiRoutedCount>0&&(
                <div className="ch" style={{background:"linear-gradient(135deg,#1e1b4b,#2e1065)",borderRadius:16,padding:18,border:"1px solid rgba(139,92,246,.25)",animation:"fadeIn .4s ease .1s both"}}>
                  <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:12}}>
                    <div style={{width:32,height:32,borderRadius:9,background:"rgba(139,92,246,.25)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:15}}>🤖</div>
                    <div><div style={{fontSize:12,fontWeight:700,color:"var(--bg-card)"}}>AI Routing Active</div><div style={{fontSize:10,color:"rgba(196,181,253,.6)"}}>{aiRoutedCount} of {total} auto-routed</div></div>
                  </div>
                  {(()=>{const m:{[k:string]:number}={};complaints.forEach(c=>{const d=c.department||"General Civic";m[d]=(m[d]||0)+1;});return Object.entries(m).sort((a,b)=>b[1]-a[1]).slice(0,5);})().map(([dept,count])=>(
                    <div key={dept} style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                      <span style={{fontSize:12}}>{DEPT_ICON[dept]||"🏛️"}</span>
                      <div style={{flex:1}}><div style={{height:5,background:"rgba(255,255,255,.08)",borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:`${total>0?Math.round((Number(count)/total)*100):0}%`,background:DEPT_COLOR[dept]||"var(--text-muted)",borderRadius:3}}/></div></div>
                      <span style={{fontSize:10,color:DEPT_COLOR[dept]||"var(--text-muted)",fontWeight:700,minWidth:16}}>{count as number}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Recent complaints */}
              <div className="ch" style={{background:"var(--bg-card)",borderRadius:16,padding:18,boxShadow:"0 2px 8px rgba(0,0,0,.06)",animation:"fadeIn .4s ease .14s both"}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
                  <div style={{fontSize:13,fontWeight:700,color:"var(--text-primary)"}}>Recent Complaints</div>
                  {pending>0&&<span style={{fontSize:10,fontWeight:700,color:"var(--bg-card)",background:"#ea6800",borderRadius:20,padding:"2px 9px"}}>{pending} pending</span>}
                </div>
                {recent.length===0?(
                  <div style={{textAlign:"center",padding:"20px 0",color:"var(--text-muted)"}}>
                    <div style={{fontSize:28,marginBottom:6}}>📋</div>
                    <div style={{fontSize:12,fontWeight:600}}>No complaints yet</div>
                    <button onClick={()=>setShowSubmit(true)} style={{marginTop:10,color:"#ea6800",fontWeight:600,fontSize:12,background:"#fff7ed",border:"1px solid #fed7aa",padding:"6px 16px",borderRadius:8,cursor:"pointer",fontFamily:"inherit"}}>Report first issue →</button>
                  </div>
                ):recent.map((c,i)=>{
                  const col=STATUS_CFG[c.status]?.dot||"var(--text-muted)";
                  return(
                    <div key={c.id||i} onClick={()=>{setExpandedId(c.id);setActiveNav("complaints");}} style={{padding:"9px 0",borderBottom:i<recent.length-1?"1px solid #f8fafc":"none",display:"flex",alignItems:"center",gap:10,cursor:"pointer"}}>
                      <div style={{width:34,height:34,borderRadius:10,background:`${DEPT_COLOR[c.department||""]||"var(--text-muted)"}15`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,flexShrink:0,position:"relative"}}>
                        {DEPT_ICON[c.department||""]||"🏛️"}
                        {c.emergency&&<div style={{position:"absolute",top:-3,right:-3,width:12,height:12,borderRadius:"50%",background:"#ef4444",border:"2px solid white",fontSize:6,display:"flex",alignItems:"center",justifyContent:"center"}}>!</div>}
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:12,fontWeight:600,color:"var(--text-primary)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{c.title||c.category||"Complaint"}</div>
                        <div style={{fontSize:10,color:"var(--text-muted)",marginTop:1,display:"flex",gap:5,alignItems:"center"}}>
                          {c.aiRouted&&<span style={{color:"#7c3aed",fontWeight:700}}>🤖</span>}
                          {c.feedback&&<span style={{color:"#f59e0b"}}>⭐{c.feedback.rating}</span>}
                          {new Date(c.createdAt).toLocaleDateString("en-IN")}
                        </div>
                      </div>
                      <div style={{flexShrink:0,background:`${col}18`,color:col,borderRadius:7,padding:"2px 8px",fontSize:10,fontWeight:700}}>{c.status}</div>
                    </div>
                  );
                })}
                {recent.length>0&&<button onClick={()=>setActiveNav("complaints")} style={{display:"block",width:"100%",textAlign:"center",marginTop:12,fontSize:12,color:"#ea6800",fontWeight:600,background:"none",border:"none",cursor:"pointer",fontFamily:"inherit"}}>View all complaints →</button>}
              </div>
            </div>

            {/* RIGHT COLUMN */}
            <div style={{display:"flex",flexDirection:"column",gap:18}}>
              {/* Stat cards */}
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:13}}>
                {[{l:"Total",v:total,i:"📋",c:"#3b82f6",bg:"linear-gradient(135deg,#3b82f6,#6366f1)",s:"All submitted"},{l:"Resolved",v:resolved,i:"✅",c:"#10b981",bg:"linear-gradient(135deg,#10b981,#059669)",s:`${resolutionRate}% rate`},{l:"In Progress",v:assigned,i:"⚙️",c:"#8b5cf6",bg:"linear-gradient(135deg,#8b5cf6,#7c3aed)",s:"Officer working"},{l:"AI Routed",v:aiRoutedCount,i:"🤖",c:"#f59e0b",bg:"linear-gradient(135deg,#f59e0b,#ea6800)",s:"Auto-assigned"}].map((s,i)=>(
                  <div key={s.l} className="ch" style={{background:"var(--bg-card)",borderRadius:16,padding:18,boxShadow:"0 2px 8px rgba(0,0,0,.06)",animation:`fadeIn .4s ease ${.06+i*.04}s both`}}>
                    <div style={{width:38,height:38,borderRadius:11,background:s.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,boxShadow:`0 4px 14px ${s.c}35`,marginBottom:12}}>{s.i}</div>
                    <div style={{fontSize:32,fontWeight:900,color:"var(--text-primary)",lineHeight:1}}>{s.v}</div>
                    <div style={{fontSize:12.5,fontWeight:600,color:"var(--text-muted)",marginTop:5}}>{s.l}</div>
                    <div style={{fontSize:11,color:"var(--text-muted)",marginTop:2}}>{s.s}</div>
                  </div>
                ))}
              </div>

              {/* Map + AI Assistant */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 340px",gap:16}}>
                <div className="ch" style={{background:"var(--bg-card)",borderRadius:16,padding:16,boxShadow:"0 2px 8px rgba(0,0,0,.06)"}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
                    <div><div style={{fontSize:13,fontWeight:700,color:"var(--text-primary)"}}>Live Incident Map</div><div style={{fontSize:11,color:"var(--text-muted)"}}>Red=urgent · Yellow=pending · Blue=in progress · Green=resolved</div></div>
                    <button onClick={()=>setActiveNav("map")} style={{fontSize:11,fontWeight:600,color:"var(--text-muted)",background:"var(--bg-card-alt)",padding:"4px 12px",borderRadius:8,border:"1px solid #e2e8f0",cursor:"pointer",fontFamily:"inherit"}}>Full Map</button>
                  </div>
                  <IncidentMap myComplaints={complaints}/>
                </div>
                <div style={{background:"var(--bg-card)",borderRadius:16,boxShadow:"0 2px 8px rgba(0,0,0,.06)",display:"flex",flexDirection:"column",overflow:"hidden",minHeight:420}}>
                  <div style={{padding:"14px 16px 10px",borderBottom:"1px solid #f1f5f9",display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
                    <div style={{width:32,height:32,borderRadius:10,background:"linear-gradient(135deg,#ea6800,#f59e0b)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>🤖</div>
                    <div><div style={{fontSize:13,fontWeight:700,color:"var(--text-primary)"}}>AI Civic Assistant</div><div style={{fontSize:10,color:"var(--text-muted)"}}>Routing · Tracking · Alerts</div></div>
                    <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:4,background:"#f0fdf4",borderRadius:20,padding:"3px 8px"}}><div style={{width:6,height:6,borderRadius:"50%",background:"#10b981"}}/><span style={{fontSize:10,color:"#10b981",fontWeight:600}}>Online</span></div>
                  </div>
                  <div style={{flex:1,minHeight:0,display:"flex",flexDirection:"column"}}><AIAssistant userName={user?.name?.split(" ")[0]||""}/></div>
                </div>
              </div>

              {/* Quick report cards */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
                {/* Quick actions */}
                <div className="ch" style={{background:"var(--bg-card)",borderRadius:16,padding:18,boxShadow:"0 2px 8px rgba(0,0,0,.06)"}}>
                  <div style={{fontSize:13,fontWeight:700,color:"var(--text-primary)",marginBottom:14}}>Quick Actions</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                    {[{icon:"📝",label:"Report Issue",desc:"Submit complaint",color:"#ea6800",bg:"#fff7ed",action:()=>setShowSubmit(true)},{icon:"📋",label:"My Complaints",desc:`${total} total`,color:"#3b82f6",bg:"#eff6ff",action:()=>setActiveNav("complaints")},{icon:"🗺",label:"Live Map",desc:"Area incidents",color:"#10b981",bg:"#f0fdf4",action:()=>setActiveNav("map")},{icon:"🚨",label:"Emergency",desc:"Quick call",color:"#ef4444",bg:"#fef2f2",action:()=>setActiveNav("emergency")}].map(item=>(
                      <button key={item.label} onClick={item.action} style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"14px 10px",borderRadius:12,background:item.bg,border:`1px solid ${item.color}20`,cursor:"pointer",transition:"all .15s",fontFamily:"inherit"}} onMouseEnter={e=>(e.currentTarget as HTMLButtonElement).style.transform="translateY(-2px)"} onMouseLeave={e=>(e.currentTarget as HTMLButtonElement).style.transform="translateY(0)"}>
                        <span style={{fontSize:22,marginBottom:4}}>{item.icon}</span>
                        <span style={{fontSize:11.5,fontWeight:700,color:item.color}}>{item.label}</span>
                        <span style={{fontSize:10,color:"var(--text-muted)",marginTop:1}}>{item.desc}</span>
                      </button>
                    ))}
                  </div>
                  {total>0&&<div style={{marginTop:14,background:"var(--text-primary)",borderRadius:10,padding:"12px 14px"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}><span style={{fontSize:11,color:"var(--text-muted)",fontWeight:600}}>Overall Resolution</span><span style={{fontSize:16,fontWeight:900,color:"#34d399"}}>{resolutionRate}%</span></div>
                    <div style={{height:6,background:"rgba(255,255,255,.08)",borderRadius:4,overflow:"hidden"}}><div style={{height:"100%",width:`${resolutionRate}%`,background:"linear-gradient(90deg,#ea6800,#34d399)",borderRadius:4,transition:"width 1s ease"}}/></div>
                  </div>}
                </div>
                {/* How AI works */}
                <div className="ch" style={{background:"linear-gradient(135deg,#0f172a,#1e1b4b)",borderRadius:16,padding:18,border:"1px solid rgba(139,92,246,.2)"}}>
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
                    <div style={{width:32,height:32,borderRadius:9,background:"rgba(139,92,246,.25)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:15}}>🤖</div>
                    <div><div style={{fontSize:12.5,fontWeight:700,color:"var(--bg-card)"}}>How AI Routing Works</div><div style={{fontSize:10,color:"rgba(196,181,253,.5)"}}>Automatic department assignment</div></div>
                  </div>
                  {[{icon:"📝",l:"You report an issue with description",done:true},{icon:"🤖",l:"AI reads keywords → picks department",done:true},{icon:"👮",l:"Officer gets it instantly on their dash",done:total>0&&aiRoutedCount>0},{icon:"📅",l:"You track via timeline + live updates",done:resolved>0},{icon:"✅",l:"Resolved + you rate the service",done:resolved>0&&complaints.some(c=>c.feedback)}].map((s,i)=>(
                    <div key={i} style={{display:"flex",alignItems:"center",gap:9,marginBottom:i<4?8:0}}>
                      <div style={{width:22,height:22,borderRadius:"50%",background:s.done?"rgba(52,211,153,.2)":"rgba(255,255,255,.05)",border:`1px solid ${s.done?"#34d399":"rgba(255,255,255,.1)"}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,flexShrink:0}}>{s.done?"✓":s.icon}</div>
                      <span style={{fontSize:11.5,color:s.done?"rgba(255,255,255,.8)":"rgba(255,255,255,.35)"}}>{s.l}</span>
                    </div>
                  ))}
                  <div style={{marginTop:14,display:"flex",gap:5,flexWrap:"wrap"}}>
                    {["⚡ Electricity","💧 Water","🗑️ Sanitation","🛣️ Roads","👮 Police","🔥 Fire"].map(d=><span key={d} style={{fontSize:9.5,color:"rgba(196,181,253,.6)",background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.08)",padding:"2px 8px",borderRadius:20}}>{d}</span>)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══ COMPLAINTS VIEW ══ */}
        {activeNav==="complaints"&&(
          <div style={{display:"grid",gridTemplateColumns:"1fr 320px",gap:20}}>
            <div>
              {/* Header */}
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,flexWrap:"wrap",gap:10}}>
                <div>
                  <div style={{fontSize:10.5,color:"var(--text-muted)",fontWeight:700,letterSpacing:".08em",marginBottom:2}}>MY COMPLAINTS — LIVE CITIZEN UPDATES</div>
                  <div style={{fontSize:18,fontWeight:800,color:"var(--text-primary)"}}>Complaint Status Board</div>
                </div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  {(["All","Pending","Assigned","In Progress","Resolved"] as const).map(s=>{
                    const active=statusFilter===s;
                    const cols:{[k:string]:string}={All:"#ea6800",Pending:"#f97316",Assigned:"#3b82f6","In Progress":"#0ea5e9",Resolved:"#10b981"};
                    const counts:{[k:string]:number}={All:total,Pending:pending,Assigned:assigned,"In Progress":assigned,Resolved:resolved};
                    return(<button key={s} onClick={()=>setStatusFilter(s)} style={{padding:"6px 14px",borderRadius:9,fontSize:12,fontWeight:600,border:`1.5px solid ${active?cols[s]:"var(--border)"}`,background:active?cols[s]:"#fff",color:active?"#fff":"var(--text-muted)",cursor:"pointer",fontFamily:"inherit",transition:"all .15s"}}>{s} {counts[s]}</button>);
                  })}
                  <button onClick={()=>setShowSubmit(true)} style={{display:"flex",alignItems:"center",gap:5,padding:"6px 14px",borderRadius:9,fontSize:12,fontWeight:700,background:"#ea6800",color:"var(--bg-card)",border:"none",cursor:"pointer",fontFamily:"inherit"}}>+ New</button>
                </div>
              </div>

              {filtered.length===0?(
                <div style={{textAlign:"center",padding:"60px 0",color:"var(--text-muted)",background:"var(--bg-card)",borderRadius:16,border:"1.5px solid #e8edf3"}}>
                  <div style={{fontSize:48,marginBottom:12}}>📭</div>
                  <div style={{fontSize:16,fontWeight:700,color:"var(--text-muted)"}}>{statusFilter==="All"?"No complaints yet":`No ${statusFilter.toLowerCase()} complaints`}</div>
                  {statusFilter==="All"&&<button onClick={()=>setShowSubmit(true)} style={{display:"inline-block",marginTop:14,color:"#ea6800",fontWeight:700,fontSize:13,background:"#fff7ed",border:"1px solid #fed7aa",padding:"10px 24px",borderRadius:12,cursor:"pointer",fontFamily:"inherit"}}>Report your first civic issue →</button>}
                </div>
              ):(
                <div style={{display:"flex",flexDirection:"column",gap:12}}>
                  {filtered.map(c=>(
                    <ComplaintCard key={c.id} c={c} expanded={expandedId===c.id} onToggle={()=>setExpandedId(expandedId===c.id?null:c.id)} onFeedback={c.status==="Resolved"&&!c.feedback?()=>setFeedbackComplaint(c):undefined}/>
                  ))}
                </div>
              )}
            </div>

            {/* Right sidebar */}
            <div style={{display:"flex",flexDirection:"column",gap:16}}>
              <div className="ch" style={{background:"var(--text-primary)",borderRadius:16,padding:18,boxShadow:"0 4px 20px rgba(0,0,0,.18)"}}>
                <div style={{fontSize:12,color:"var(--text-muted)",fontWeight:600,marginBottom:12}}>Status Overview</div>
                <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:16}}>
                  <DonutChart resolved={resolved} assigned={assigned} pending={pending} total={total}/>
                  <div style={{flex:1,display:"flex",flexDirection:"column",gap:7}}>
                    {[{l:"Resolved",v:resolved,c:"#10b981"},{l:"In Progress",v:assigned,c:"#3b82f6"},{l:"Pending",v:pending,c:"#f97316"},{l:"Emergency",v:emergency,c:"#ef4444"}].map(x=>(
                      <div key={x.l} style={{display:"flex",alignItems:"center",gap:7}}><div style={{width:7,height:7,borderRadius:"50%",background:x.c,flexShrink:0}}/><span style={{fontSize:10.5,color:"var(--text-muted)",flex:1}}>{x.l}</span><span style={{fontSize:13,fontWeight:800,color:"var(--bg-card)"}}>{x.v}</span></div>
                    ))}
                  </div>
                </div>
                <button onClick={()=>setShowSubmit(true)} style={{width:"100%",padding:"10px",borderRadius:10,background:"#ea6800",border:"none",color:"var(--bg-card)",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>+ Report New Issue</button>
              </div>
              <div style={{background:"var(--bg-card)",borderRadius:16,boxShadow:"0 2px 8px rgba(0,0,0,.06)",overflow:"hidden",minHeight:300}}>
                <div style={{padding:"14px 16px 10px",borderBottom:"1px solid #f1f5f9",display:"flex",alignItems:"center",gap:8}}>
                  <div style={{width:26,height:26,borderRadius:8,background:"linear-gradient(135deg,#ea6800,#f59e0b)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12}}>🤖</div>
                  <div style={{fontSize:12.5,fontWeight:700,color:"var(--text-primary)"}}>AI Assistant</div>
                </div>
                <div style={{height:380,display:"flex",flexDirection:"column"}}><AIAssistant userName={user?.name?.split(" ")[0]||""}/></div>
              </div>
            </div>
          </div>
        )}

        {/* ══ MAP VIEW ══ */}
        {activeNav==="map"&&(
          <div style={{display:"flex",flexDirection:"column",gap:18}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div><div style={{fontSize:10.5,color:"var(--text-muted)",fontWeight:700,letterSpacing:".08em",marginBottom:2}}>REAL-TIME INCIDENT MAP</div><div style={{fontSize:18,fontWeight:800,color:"var(--text-primary)"}}>Nearby Complaints Map</div></div>
              <button onClick={()=>setShowSubmit(true)} style={{display:"flex",alignItems:"center",gap:7,background:"#ea6800",color:"var(--bg-card)",padding:"10px 20px",borderRadius:10,fontWeight:700,fontSize:13,border:"none",cursor:"pointer",boxShadow:"0 4px 14px rgba(234,104,0,.3)",fontFamily:"inherit"}}>+ Report Issue</button>
            </div>
            <div style={{background:"var(--bg-card)",borderRadius:16,padding:16,boxShadow:"0 2px 8px rgba(0,0,0,.06)"}}>
              <IncidentMap myComplaints={complaints}/>
            </div>
            <AreaAlertsPanel/>
          </div>
        )}

        {/* ══ EMERGENCY VIEW ══ */}
        
              {activeNav==="profile"&&(
                <div style={{maxWidth:900,margin:"0 auto",animation:"fadeIn .4s ease"}}>
                  {/* Hero Banner */}
                  <div style={{background:"linear-gradient(135deg,#14532d 0%,#15803d 35%,#16a34a 65%,#22c55e 100%)",borderRadius:22,padding:"32px 36px",marginBottom:24,position:"relative",overflow:"hidden",boxShadow:"0 8px 32px rgba(22,163,74,.25)"}}>
                    <div style={{position:"absolute",inset:0,backgroundImage:"radial-gradient(circle at 1px 1px,rgba(255,255,255,.07) 1px,transparent 0)",backgroundSize:"28px 28px"}}/>
                    <div style={{position:"absolute",top:-60,right:-60,width:300,height:300,borderRadius:"50%",background:"rgba(255,255,255,.06)",filter:"blur(60px)"}}/>
                    <div style={{position:"absolute",bottom:-40,left:-40,width:200,height:200,borderRadius:"50%",background:"rgba(255,255,255,.04)",filter:"blur(40px)"}}/>
                    <div style={{position:"relative",display:"flex",alignItems:"center",gap:22,flexWrap:"wrap"}}>
                      {/* Avatar */}
                      <div style={{position:"relative",flexShrink:0}}>
                        <div style={{width:80,height:80,borderRadius:22,background:"rgba(255,255,255,.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:32,fontWeight:900,color:"#fff",border:"2.5px solid rgba(255,255,255,.35)",backdropFilter:"blur(10px)",boxShadow:"0 8px 24px rgba(0,0,0,.15)"}}>{user?.name?.charAt(0).toUpperCase()||"C"}</div>
                        <div style={{position:"absolute",bottom:-4,right:-4,width:22,height:22,borderRadius:"50%",background:"#22c55e",border:"2.5px solid white",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10}}>✓</div>
                      </div>
                      {/* User info */}
                      <div style={{flex:1,minWidth:200}}>
                        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:5,flexWrap:"wrap"}}>
                          <h2 style={{fontSize:24,fontWeight:900,color:"#fff",lineHeight:1,fontFamily:"'DM Serif Display',serif"}}>{user?.name}</h2>
                          <span style={{background:"rgba(255,255,255,.2)",color:"#fff",fontSize:10,fontWeight:700,padding:"3px 10px",borderRadius:20,border:"1px solid rgba(255,255,255,.3)",backdropFilter:"blur(4px)"}}>👤 CITIZEN</span>
                        </div>
                        <div style={{fontSize:12.5,color:"rgba(255,255,255,.8)",marginBottom:3}}>{user?.email}</div>
                        <div style={{fontSize:11,color:"rgba(255,255,255,.65)"}}>CivicConnect · LIVE • CIVICCONNECT PLATFORM</div>
                        <div style={{display:"flex",alignItems:"center",gap:8,marginTop:10,flexWrap:"wrap"}}>
                          <div style={{display:"flex",alignItems:"center",gap:5,background:"rgba(255,255,255,.12)",borderRadius:20,padding:"4px 11px",backdropFilter:"blur(4px)"}}>
                            <div style={{width:6,height:6,borderRadius:"50%",background:"#4ade80",animation:"pulse 2s ease-in-out infinite"}}/>
                            <span style={{fontSize:10.5,color:"#dcfce7",fontWeight:600}}>Account Active</span>
                          </div>
                          <div style={{fontSize:10.5,color:"rgba(255,255,255,.65)"}}>Member since {new Date().toLocaleDateString("en-IN",{month:"long",year:"numeric"})}</div>
                        </div>
                      </div>
                      {/* KPI stats */}
                      <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
                        {[{l:"Total",v:total,i:"📋"},{l:"Resolved",v:resolved,i:"✅"},{l:"Pending",v:pending,i:"⏳"},{l:"Rate",v:`${resolutionRate}%`,i:"📈"}].map(s=>(
                          <div key={s.l} style={{textAlign:"center",background:"rgba(255,255,255,.15)",borderRadius:14,padding:"12px 16px",backdropFilter:"blur(10px)",border:"1px solid rgba(255,255,255,.2)",minWidth:68}}>
                            <div style={{fontSize:18,marginBottom:2}}>{s.i}</div>
                            <div style={{fontSize:20,fontWeight:900,color:"#fff",lineHeight:1}}>{s.v}</div>
                            <div style={{fontSize:10,color:"rgba(255,255,255,.75)",fontWeight:600,marginTop:2}}>{s.l}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Main content grid */}
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:18,marginBottom:18}}>
                    {/* Account Details */}
                    <div style={{background:"var(--bg-card)",borderRadius:18,padding:22,border:"1px solid var(--border)",boxShadow:"0 2px 8px rgba(0,0,0,.04)"}}>
                      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:18}}>
                        <div style={{width:34,height:34,borderRadius:10,background:"linear-gradient(135deg,#16a34a,#22c55e)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,boxShadow:"0 3px 10px rgba(22,163,74,.3)"}}>👤</div>
                        <div style={{fontWeight:800,fontSize:14,color:"var(--text-primary)"}}>Account Details</div>
                      </div>
                      {[{l:"Full Name",v:user?.name||"—",icon:"🪪"},{l:"Email Address",v:user?.email||"—",icon:"📧"},{l:"Role",v:"Citizen",icon:"🏛️"},{l:"Portal",v:"AP Civic System",icon:"🖥️"},{l:"Member Since",v:new Date().toLocaleDateString("en-IN",{day:"2-digit",month:"long",year:"numeric"}),icon:"📅"},{l:"Account Status",v:"✅ Verified & Active",icon:"🔐"}].map(row=>(
                        <div key={row.l} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 0",borderBottom:"1px solid var(--border)"}}>
                          <span style={{fontSize:11.5,color:"var(--text-muted)",display:"flex",alignItems:"center",gap:6}}><span>{row.icon}</span>{row.l}</span>
                          <span style={{fontSize:12.5,fontWeight:600,color:"var(--text-primary)",maxWidth:180,textAlign:"right",wordBreak:"break-all"}}>{row.v}</span>
                        </div>
                      ))}
                    </div>

                    {/* Stats Panel */}
                    <div style={{background:"var(--bg-card)",borderRadius:18,padding:22,border:"1px solid var(--border)",boxShadow:"0 2px 8px rgba(0,0,0,.04)"}}>
                      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:18}}>
                        <div style={{width:34,height:34,borderRadius:10,background:"linear-gradient(135deg,#3b82f6,#6366f1)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,boxShadow:"0 3px 10px rgba(99,102,241,.3)"}}>📊</div>
                        <div style={{fontWeight:800,fontSize:14,color:"var(--text-primary)"}}>My Statistics</div>
                      </div>
                      {/* Resolution ring */}
                      <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:18,padding:"14px",background:"var(--bg-card-alt)",borderRadius:13,border:"1px solid var(--border)"}}>
                        <DonutChart resolved={resolved} assigned={assigned} pending={pending} total={total}/>
                        <div style={{flex:1}}>
                          {[{l:"Resolved",v:resolved,c:"#10b981"},{l:"In Progress",v:assigned,c:"#3b82f6"},{l:"Pending",v:pending,c:"#f97316"},{l:"Emergency",v:emergency,c:"#ef4444"}].map(x=>(
                            <div key={x.l} style={{display:"flex",alignItems:"center",gap:8,marginBottom:7}}>
                              <div style={{width:8,height:8,borderRadius:"50%",background:x.c,flexShrink:0}}/>
                              <span style={{fontSize:11.5,color:"var(--text-muted)",flex:1}}>{x.l}</span>
                              <span style={{fontSize:13,fontWeight:800,color:"var(--text-primary)"}}>{x.v}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      {[{l:"Total Submitted",v:total,c:"#3b82f6",bg:"#eff6ff"},{l:"Resolution Rate",v:`${resolutionRate}%`,c:"#16a34a",bg:"#f0fdf4"},{l:"AI Routed",v:aiRoutedCount,c:"#8b5cf6",bg:"#f5f3ff"},{l:"Today's Reports",v:todayCount,c:"#f59e0b",bg:"#fffbeb"},{l:"Avg Rating",v:avgRating==="—"?avgRating:`${avgRating} ⭐`,c:"#f59e0b",bg:"#fffbeb"}].map(row=>(
                        <div key={row.l} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 10px",borderRadius:9,background:"var(--bg-card-alt)",marginBottom:6,border:"1px solid var(--border)"}}>
                          <span style={{fontSize:12,color:"var(--text-muted)"}}>{row.l}</span>
                          <span style={{fontSize:13,fontWeight:800,color:row.c,background:row.bg,padding:"2px 10px",borderRadius:20}}>{row.v}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Recent Complaints */}
                  <div style={{background:"var(--bg-card)",borderRadius:18,padding:22,border:"1px solid var(--border)",boxShadow:"0 2px 8px rgba(0,0,0,.04)",marginBottom:18}}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:18}}>
                      <div style={{display:"flex",alignItems:"center",gap:10}}>
                        <div style={{width:34,height:34,borderRadius:10,background:"linear-gradient(135deg,#f59e0b,#ea6800)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,boxShadow:"0 3px 10px rgba(245,158,11,.3)"}}>📋</div>
                        <div style={{fontWeight:800,fontSize:14,color:"var(--text-primary)"}}>Recent Complaints</div>
                      </div>
                      <button onClick={()=>setActiveNav("complaints")} style={{fontSize:12,color:"var(--accent)",fontWeight:700,background:"#f0fdf4",border:"1px solid #bbf7d0",padding:"5px 14px",borderRadius:8,cursor:"pointer",fontFamily:"inherit"}}>View All →</button>
                    </div>
                    {complaints.slice(0,6).length===0?(
                      <div style={{textAlign:"center",padding:"24px",color:"var(--text-muted)"}}>
                        <div style={{fontSize:32,marginBottom:8}}>📭</div>
                        <div style={{fontSize:13,fontWeight:600}}>No complaints yet</div>
                        <button onClick={()=>setShowSubmit(true)} style={{marginTop:12,color:"var(--accent)",fontWeight:700,fontSize:12,background:"#f0fdf4",border:"1px solid #bbf7d0",padding:"7px 18px",borderRadius:9,cursor:"pointer",fontFamily:"inherit"}}>Report first issue →</button>
                      </div>
                    ):(
                      <div style={{display:"flex",flexDirection:"column",gap:8}}>
                        {[...complaints].reverse().slice(0,6).map(comp=>{
                          const sc=STATUS_CFG[comp.status]||STATUS_CFG.Pending;
                          const dc=DEPT_COLOR[comp.department||""]||"var(--text-muted)";
                          return(
                            <div key={comp.id} onClick={()=>{setExpandedId(comp.id);setActiveNav("complaints");}} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",borderRadius:13,background:"var(--bg-card-alt)",border:"1.5px solid var(--border)",cursor:"pointer",transition:"all .2s"}} onMouseEnter={e=>{e.currentTarget.style.borderColor="var(--accent)";e.currentTarget.style.background="rgba(22,163,74,.03)";}} onMouseLeave={e=>{e.currentTarget.style.borderColor="var(--border)";e.currentTarget.style.background="var(--bg-card-alt)";}}>
                              <div style={{width:38,height:38,borderRadius:11,background:`${dc}15`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0,border:`1.5px solid ${dc}25`,position:"relative"}}>
                                {DEPT_ICON[comp.department||""]||"🏛️"}
                                {comp.emergency&&<div style={{position:"absolute",top:-4,right:-4,width:13,height:13,borderRadius:"50%",background:"#ef4444",border:"2px solid white",fontSize:7,display:"flex",alignItems:"center",justifyContent:"center"}}>!</div>}
                              </div>
                              <div style={{flex:1,minWidth:0}}>
                                <div style={{fontSize:13,fontWeight:700,color:"var(--text-primary)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{comp.title||comp.category||"Complaint"}</div>
                                <div style={{fontSize:10.5,color:"var(--text-muted)",marginTop:2,display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                                  {comp.department&&<span style={{color:dc,fontWeight:600}}>{DEPT_ICON[comp.department]} {comp.department}</span>}
                                  <span>·</span>
                                  <span>{new Date(comp.createdAt).toLocaleDateString("en-IN",{day:"2-digit",month:"short"})}</span>
                                  {comp.aiRouted&&<span style={{color:"#8b5cf6",fontWeight:700}}>🤖 AI</span>}
                                  {comp.feedback&&<span style={{color:"#f59e0b"}}>⭐{comp.feedback.rating}</span>}
                                </div>
                              </div>
                              <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:5,flexShrink:0}}>
                                <span style={{fontSize:10,fontWeight:700,color:sc.color,background:sc.bg,padding:"2px 9px",borderRadius:20,border:`1px solid ${sc.border}`}}>{sc.icon} {sc.label}</span>
                                {comp.ticketId&&<span style={{fontSize:9,color:"var(--text-muted)",fontFamily:"monospace"}}>{comp.ticketId}</span>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Activity + Actions row */}
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:18,marginBottom:18}}>
                    {/* Quick actions */}
                    <div style={{background:"var(--bg-card)",borderRadius:18,padding:22,border:"1px solid var(--border)",boxShadow:"0 2px 8px rgba(0,0,0,.04)"}}>
                      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
                        <div style={{width:34,height:34,borderRadius:10,background:"linear-gradient(135deg,#10b981,#059669)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:15}}>⚡</div>
                        <div style={{fontWeight:800,fontSize:14,color:"var(--text-primary)"}}>Quick Actions</div>
                      </div>
                      <div style={{display:"flex",flexDirection:"column",gap:9}}>
                        {[{icon:"📝",label:"Report New Issue",desc:"Submit a civic complaint",color:"#16a34a",bg:"#f0fdf4",action:()=>setShowSubmit(true)},{icon:"📋",label:"View All Complaints",desc:`${total} total complaints`,color:"#3b82f6",bg:"#eff6ff",action:()=>setActiveNav("complaints")},{icon:"🗺",label:"Live Incident Map",desc:"See nearby issues",color:"#10b981",bg:"#ecfdf5",action:()=>setActiveNav("map")},{icon:"🚨",label:"Emergency Services",desc:"Quick emergency calls",color:"#ef4444",bg:"#fef2f2",action:()=>setActiveNav("emergency")}].map(item=>(
                          <button key={item.label} onClick={item.action} style={{display:"flex",alignItems:"center",gap:12,padding:"11px 13px",borderRadius:11,background:item.bg,border:`1px solid ${item.color}20`,cursor:"pointer",transition:"all .15s",fontFamily:"inherit",textAlign:"left",width:"100%"}} onMouseEnter={e=>(e.currentTarget.style.transform="translateX(4px)")} onMouseLeave={e=>(e.currentTarget.style.transform="translateX(0)")}>
                            <span style={{fontSize:18,flexShrink:0}}>{item.icon}</span>
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{fontSize:12.5,fontWeight:700,color:item.color}}>{item.label}</div>
                              <div style={{fontSize:10.5,color:"var(--text-muted)"}}>{item.desc}</div>
                            </div>
                            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke={item.color} strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Department breakdown */}
                    <div style={{background:"var(--bg-card)",borderRadius:18,padding:22,border:"1px solid var(--border)",boxShadow:"0 2px 8px rgba(0,0,0,.04)"}}>
                      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
                        <div style={{width:34,height:34,borderRadius:10,background:"linear-gradient(135deg,#8b5cf6,#7c3aed)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:15}}>🤖</div>
                        <div style={{fontWeight:800,fontSize:14,color:"var(--text-primary)"}}>AI Dept. Breakdown</div>
                      </div>
                      {total===0?(
                        <div style={{textAlign:"center",padding:"20px 0",color:"var(--text-muted)"}}>
                          <div style={{fontSize:28,marginBottom:6}}>🤖</div>
                          <div style={{fontSize:12}}>No data yet — submit a complaint</div>
                        </div>
                      ):(()=>{
                        const m:{[k:string]:number}={};
                        complaints.forEach(c=>{const d=c.department||"General Civic";m[d]=(m[d]||0)+1;});
                        return Object.entries(m).sort((a,b)=>b[1]-a[1]).map(([dept,count])=>(
                          <div key={dept} style={{marginBottom:10}}>
                            <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                              <span style={{fontSize:12,fontWeight:600,color:"var(--text-secondary)"}}>{DEPT_ICON[dept]||"🏛️"} {dept}</span>
                              <span style={{fontSize:12,fontWeight:800,color:DEPT_COLOR[dept]||"var(--text-muted)"}}>{count}</span>
                            </div>
                            <div style={{height:6,background:"var(--bg-card-alt)",borderRadius:4,overflow:"hidden",border:"1px solid var(--border)"}}>
                              <div style={{height:"100%",width:`${total>0?Math.round((Number(count)/total)*100):0}%`,background:DEPT_COLOR[dept]||"#6b7280",borderRadius:4,transition:"width 1s ease"}}/>
                            </div>
                          </div>
                        ));
                      })()}
                      {total>0&&<div style={{marginTop:12,padding:"10px 12px",background:"linear-gradient(135deg,rgba(139,92,246,.08),rgba(124,58,237,.05))",borderRadius:10,border:"1px solid rgba(139,92,246,.15)",display:"flex",alignItems:"center",gap:8}}>
                        <span style={{fontSize:14}}>🤖</span>
                        <span style={{fontSize:11.5,color:"#7c3aed",fontWeight:600}}>{aiRoutedCount} of {total} complaints AI-routed ({total>0?Math.round((aiRoutedCount/total)*100):0}% automation)</span>
                      </div>}
                    </div>
                  </div>

                  {/* Sign Out */}
                  <div style={{background:"var(--bg-card)",borderRadius:18,padding:20,border:"1.5px solid rgba(239,68,68,.15)",boxShadow:"0 2px 8px rgba(0,0,0,.04)"}}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:12}}>
                      <div>
                        <div style={{fontSize:13,fontWeight:700,color:"var(--text-primary)",marginBottom:3}}>Sign Out of CivicConnect</div>
                        <div style={{fontSize:12,color:"var(--text-muted)"}}>You'll need to sign in again to access your complaints and track progress.</div>
                      </div>
                      <button onClick={()=>{dispatch(logout());navigate("/login");}} style={{display:"flex",alignItems:"center",gap:8,padding:"11px 24px",borderRadius:12,background:"rgba(239,68,68,.08)",border:"1.5px solid rgba(239,68,68,.25)",color:"#ef4444",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",transition:"all .2s",flexShrink:0}} onMouseEnter={e=>{e.currentTarget.style.background="rgba(239,68,68,.15)";}} onMouseLeave={e=>{e.currentTarget.style.background="rgba(239,68,68,.08)";}}>
                        <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
                        Sign Out
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {activeNav === "emergency" && (
  <CitizenEmergencySection
    userId={userId}
    userName={user?.name || ""}
    onReportEmergency={() => setShowSubmit(true)}
  />
)}
      </div>

      {/* Modals */}
      {showSubmit&&<SubmitModal onClose={()=>setShowSubmit(false)} onSubmit={handleNewComplaint} userId={userId} userName={user?.name||""} existingComplaints={complaints}/>}
      {feedbackComplaint&&<FeedbackModal complaint={feedbackComplaint} onClose={()=>setFeedbackComplaint(null)} onSubmit={(fb)=>handleFeedback(feedbackComplaint,fb)}/>}

      {/* Backdrop for menus */}
      
      {/* ── FOOTER ── */}
      
{showUserMenu&&(
        <div style={{position:"fixed",right:16,top:68,width:300,background:"#ffffff",borderRadius:16,boxShadow:"0 20px 60px rgba(0,0,0,.16)",border:"1px solid #e2e8f0",zIndex:9999,overflow:"hidden",animation:"fadeIn .2s ease"}}>
          <div style={{padding:"18px 18px 14px",background:"linear-gradient(135deg,rgba(22,163,74,.12),rgba(34,197,94,.06))",borderBottom:"1px solid var(--border)"}}>
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
              <div style={{width:48,height:48,borderRadius:14,background:"linear-gradient(135deg,#16a34a,#22c55e)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,fontSize:20,color:"#fff",boxShadow:"0 4px 14px rgba(22,163,74,.4)"}}>{user?.name?.charAt(0).toUpperCase()||"C"}</div>
              <div>
                <div style={{fontWeight:800,fontSize:14.5,color:"var(--text-primary)",lineHeight:1.2}}>{user?.name}</div>
                <div style={{fontSize:11,color:"var(--accent)",fontWeight:600,marginTop:2}}>🏛️ Citizen · CivicConnect</div>
                <div style={{fontSize:10.5,color:"var(--text-muted)",marginTop:1}}>{user?.email||""}</div>
              </div>
            </div>
            <div style={{display:"flex",gap:6}}>
              {[{l:"Complaints",v:total},{l:"Resolved",v:resolved},{l:"Pending",v:pending}].map(s=>(
                <div key={s.l} style={{flex:1,textAlign:"center",background:"rgba(255,255,255,.6)",borderRadius:8,padding:"6px 4px"}}>
                  <div style={{fontSize:15,fontWeight:800,color:"var(--accent)"}}>{s.v}</div>
                  <div style={{fontSize:9,color:"var(--text-muted)",fontWeight:600}}>{s.l}</div>
                </div>
              ))}
            </div>
          </div>
          {[{icon:"👤",label:"My Profile",action:()=>{setActiveNav("profile");setShowUserMenu(false);}},{icon:"📋",label:"My Complaints",action:()=>{setActiveNav("complaints");setShowUserMenu(false);}},{icon:"📝",label:"Report New Issue",action:()=>{setShowSubmit(true);setShowUserMenu(false);}},{icon:"🗺",label:"Live Map",action:()=>{setActiveNav("map");setShowUserMenu(false);}},{icon:"🚨",label:"Emergency Services",action:()=>{setActiveNav("emergency");setShowUserMenu(false);}}].map(item=>(
            <button key={item.label} onClick={item.action}
              style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"10px 18px",fontSize:13,color:"var(--text-secondary)",background:"none",border:"none",cursor:"pointer",fontFamily:"inherit",textAlign:"left",transition:"background .15s"}}
              onMouseOver={e=>(e.currentTarget.style.background="var(--bg-hover)")}
              onMouseOut={e=>(e.currentTarget.style.background="none")}>{item.icon} {item.label}</button>
          ))}
          <div style={{borderTop:"1px solid var(--border)"}}>
            <button onClick={handleLogout}
              style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"11px 18px",fontSize:13,color:"#ef4444",background:"none",border:"none",cursor:"pointer",fontWeight:600,fontFamily:"inherit",textAlign:"left",transition:"background .15s"}}
              onMouseOver={e=>(e.currentTarget.style.background="rgba(239,68,68,.06)")}
              onMouseOut={e=>(e.currentTarget.style.background="none")}>
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>Sign Out
            </button>
          </div>
        </div>
              )}
      {(showNotifs||showUserMenu)&&<div style={{position:"fixed",inset:0,zIndex:9998}} onClick={()=>{setShowNotifs(false);setShowUserMenu(false);}}/>}
    </div>
  );
}