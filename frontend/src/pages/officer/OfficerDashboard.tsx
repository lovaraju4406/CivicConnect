import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useSelector, useDispatch } from "react-redux";
import type { RootState } from "../../store";
import { logout } from "../../store/authSlice";
import { clearComplaints } from "../../store/complaintSlice";
import { clearNotifications } from "../../store/notificationSlice";
import { useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup, Circle } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:"https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl:"https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:"https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// ─── TYPES ────────────────────────────────────────────────────────────────────
type NavPage = "Dashboard"|"Complaints"|"Workers"|"Heatmap"|"Analytics"|"Messages"|"ControlRoom"|"Emergency"|"Profile"|"Settings";
interface Complaint {
  id:string; ticketId?:string; title?:string; category?:string;
  description?:string; status:string; department?:string;
  userName?:string; userId?:string; address?:string; image?:string;
  createdAt:string; updatedAt?:string; assignedOfficer?:string;
  assignedWorker?:string; officerNote?:string; escalated?:boolean;
  escalationReason?:string; lat?:number; lng?:number;
  aiRouted?:boolean; aiRoutingReason?:string; emergency?:boolean;
  priority?:string; aiPriority?:number; timeline?:TimelineEvent[];
  workerUpdates?:WorkerUpdate[]; messages?:Message[];
  etaBreachPredicted?:boolean; clusterGroup?:string;
  escalationPendingSince?:string; interAgencyDispatched?:string[];
}
interface TimelineEvent{id:string;event:string;note?:string;actor?:string;time:string;icon:string;color:string;}
interface WorkerUpdate{id:string;note:string;worker:string;time:string;progress?:number;}
interface Message{id:string;from:string;to:string;text:string;time:string;read:boolean;type:"officer-worker"|"officer-citizen";}
interface Worker{id:string;name:string;dept:string;phone:string;status:"available"|"busy"|"offline";currentLoad:number;maxLoad:number;location:{lat:number;lng:number;area:string};completedToday:number;avgResolutionHrs:number;rating:number;skills:string[];}
interface Task{id:string;title:string;description:string;priority:"Critical"|"High"|"Medium"|"Low";category:string;dueTime:string;done:boolean;complaintId?:string;createdAt:string;}
interface HandoverEntry{id:string;action:string;ticketRef?:string;time:string;type:"resolved"|"assigned"|"escalated"|"noted"|"messaged";}
interface HQAlert{id:string;title:string;message:string;severity:"critical"|"warning"|"info";dept:string;time:string;read:boolean;}
interface IncidentCluster{id:string;lat:number;lng:number;complaintIds:string[];detectedAt:string;area:string;dismissed:boolean;}
interface EtaBreachAlert{id:string;complaintId:string;ticketId:string;workerName:string;predictedBreachMins:number;confidence:number;detectedAt:string;dismissed:boolean;}
interface EmergencyRequest{
  id:string;ticketId:string;type:string;subType?:string;
  priority:"CRITICAL"|"HIGH"|"MEDIUM";
  status:"SOS_Sent"|"Dispatched"|"Responder_EnRoute"|"Arrived"|"Resolved"|"Cancelled";
  citizenId:string;citizenName:string;lat?:number;lng?:number;address?:string;description?:string;
  victimCount?:number;injurySeverity?:string;isSilentMode?:boolean;
  assignedResponderId?:string;assignedResponderName?:string;assignedResponderPhone?:string;
  etaMinutes?:number;distanceKm?:number;dispatchedAt?:string;
  createdAt:string;updatedAt?:string;
  timeline?:Array<{id:string;event:string;note?:string;actor?:string;time:string;icon:string;color:string;}>;
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const DEPT_LIST=["Electricity","Water Works","Sanitation","Roads & Infrastructure","Police","Fire Department","General Civic"];
const DEPT_ICON:Record<string,string>={"Electricity":"⚡","Water Works":"💧","Sanitation":"🗑️","Roads & Infrastructure":"🛣️","Police":"👮","Fire Department":"🔥","General Civic":"🏛️"};
const DEPT_COLOR:Record<string,string>={"Electricity":"#D97706","Water Works":"#0284C7","Sanitation":"#16A34A","Roads & Infrastructure":"#7C3AED","Police":"#1D4ED8","Fire Department":"#DC2626","General Civic":"#64748B"};
const DEPT_KEYWORDS:Record<string,string[]>={
  "Electricity":["power","electricity","light","streetlight","transformer","wire","voltage","outage","blackout","electric","shock","current","meter","pole"],
  "Water Works":["water","pipe","leak","flood","drain","sewage","tap","supply","bore","overflow","contamination","muddy","pump","plumbing"],
  "Sanitation":["garbage","waste","trash","litter","smell","stench","dump","sanitation","hygiene","dirty","clean","rubbish","bin","compost"],
  "Roads & Infrastructure":["road","pothole","bridge","footpath","pavement","traffic","signal","construction","crack","repair","highway","street","divider"],
  "Police":["theft","crime","accident","assault","robbery","noise","illegal","police","law","fight","dispute","harassment","vandalism","drunk"],
  "Fire Department":["fire","smoke","burn","flame","explosion","gas","hazard","emergency","blaze","cylinder"],
};
const STATUS_STYLE:Record<string,{bg:string;text:string;dot:string;border:string}>={
  Pending:{bg:"rgba(234,88,12,.10)",text:"#EA580C",dot:"#EA580C",border:"rgba(234,88,12,.25)"},
  Assigned:{bg:"rgba(2,132,199,.10)",text:"#0284C7",dot:"#0284C7",border:"rgba(2,132,199,.25)"},
  "In Progress":{bg:"rgba(124,58,237,.10)",text:"#7C3AED",dot:"#7C3AED",border:"rgba(124,58,237,.25)"},
  Resolved:{bg:"rgba(22,163,74,.10)",text:"#16A34A",dot:"#16A34A",border:"rgba(22,163,74,.25)"},
};
const PRIORITY_STYLE={
  Critical:{bg:"rgba(220,38,38,.10)",text:"#DC2626",border:"rgba(220,38,38,.30)",dot:"#DC2626",glow:"rgba(220,38,38,.15)"},
  High:{bg:"rgba(234,88,12,.10)",text:"#EA580C",border:"rgba(234,88,12,.30)",dot:"#EA580C",glow:"rgba(234,88,12,.10)"},
  Medium:{bg:"rgba(217,119,6,.10)",text:"#D97706",border:"rgba(217,119,6,.30)",dot:"#D97706",glow:"rgba(217,119,6,.08)"},
  Low:{bg:"rgba(22,163,74,.10)",text:"#16A34A",border:"rgba(22,163,74,.30)",dot:"#16A34A",glow:"rgba(22,163,74,.08)"},
};
const STATIC_HQ_ALERTS:HQAlert[]=[
  {id:"a1",title:"High Volume Alert",message:"Water Works has 3+ unresolved in Sector 7. Prioritize field inspection.",severity:"critical",dept:"Water Works",time:"10:30 AM",read:false},
  {id:"a2",title:"Weather Advisory",message:"Heavy rain forecast. Roads & Infrastructure on standby.",severity:"warning",dept:"Roads & Infrastructure",time:"09:15 AM",read:false},
  {id:"a3",title:"AI Routing Active",message:"Complaints now auto-routed to correct departments via AI.",severity:"info",dept:"All Departments",time:"08:00 AM",read:true},
];
const INTER_AGENCY=[
  {id:"police",label:"Police",icon:"🚔",color:"#3b82f6",hotline:"100"},
  {id:"fire",label:"Fire Dept",icon:"🔥",color:"#ef4444",hotline:"101"},
  {id:"medical",label:"Ambulance",icon:"🚑",color:"#10b981",hotline:"108"},
  {id:"disaster",label:"Disaster Mgmt",icon:"🌊",color:"#f59e0b",hotline:"1070"},
];
const EM_KEY="ap_emergency_requests";
const MOCK_WORKERS:Worker[]=[
  {id:"w1",name:"Ravi Kumar",dept:"Roads & Infrastructure",phone:"9876543210",status:"available",currentLoad:2,maxLoad:5,location:{lat:16.508,lng:80.645,area:"Innerspet"},completedToday:3,avgResolutionHrs:2.4,rating:4.7,skills:["Pothole Repair","Road Marking","Traffic Signal"]},
  {id:"w2",name:"Suresh Babu",dept:"Water Works",phone:"9876543211",status:"busy",currentLoad:4,maxLoad:5,location:{lat:16.512,lng:80.651,area:"Ramaraopet"},completedToday:5,avgResolutionHrs:1.8,rating:4.9,skills:["Pipe Repair","Leak Detection","Pump Maintenance"]},
  {id:"w3",name:"Lakshmi Devi",dept:"Sanitation",phone:"9876543212",status:"available",currentLoad:1,maxLoad:6,location:{lat:16.505,lng:80.648,area:"Pushkarghat"},completedToday:7,avgResolutionHrs:0.9,rating:4.5,skills:["Waste Collection","Drain Cleaning","Disinfection"]},
  {id:"w4",name:"Venkat Rao",dept:"Electricity",phone:"9876543213",status:"available",currentLoad:2,maxLoad:4,location:{lat:16.514,lng:80.643,area:"Danavaipeta"},completedToday:4,avgResolutionHrs:3.1,rating:4.3,skills:["Transformer Repair","Wiring","Street Light"]},
  {id:"w5",name:"Anita Singh",dept:"Electricity",phone:"9876543214",status:"offline",currentLoad:0,maxLoad:4,location:{lat:16.510,lng:80.655,area:"Morampudi"},completedToday:0,avgResolutionHrs:2.8,rating:4.6,skills:["Meter Reading","Cable Fault","Panel Wiring"]},
  {id:"w6",name:"Prasad Naidu",dept:"Roads & Infrastructure",phone:"9876543215",status:"busy",currentLoad:3,maxLoad:5,location:{lat:16.502,lng:80.641,area:"Lalacheruvu"},completedToday:2,avgResolutionHrs:2.9,rating:4.2,skills:["Pothole Repair","Bridge Inspection","Footpath Work"]},
  {id:"w7",name:"Kavitha Reddy",dept:"Police",phone:"9876543216",status:"available",currentLoad:1,maxLoad:3,location:{lat:16.507,lng:80.649,area:"Ashok Nagar"},completedToday:2,avgResolutionHrs:1.2,rating:4.8,skills:["Traffic Control","Patrol","Noise Complaint"]},
  {id:"w8",name:"Mohan Das",dept:"Fire Department",phone:"9876543217",status:"available",currentLoad:0,maxLoad:3,location:{lat:16.513,lng:80.647,area:"Jagannaickpur"},completedToday:1,avgResolutionHrs:0.7,rating:4.9,skills:["Fire Suppression","Rescue","Hazmat"]},
  {id:"w9",name:"Srikanth Varma",dept:"Water Works",phone:"9876543218",status:"available",currentLoad:2,maxLoad:5,location:{lat:16.509,lng:80.652,area:"Kotagummam"},completedToday:3,avgResolutionHrs:2.1,rating:4.4,skills:["Borewell","Tank Cleaning","Supply Line"]},
  {id:"w10",name:"Padma Rao",dept:"Sanitation",phone:"9876543219",status:"available",currentLoad:3,maxLoad:6,location:{lat:16.516,lng:80.644,area:"Chandra Layout"},completedToday:6,avgResolutionHrs:1.0,rating:4.6,skills:["Waste Collection","Compost","Drain Maintenance"]},
  {id:"w11",name:"Arun Prasad",dept:"General Civic",phone:"9876543220",status:"available",currentLoad:1,maxLoad:5,location:{lat:16.508,lng:80.647,area:"Kothavalasa"},completedToday:3,avgResolutionHrs:2.0,rating:4.5,skills:["Public Works","Inspection","Civic Support"]},
  {id:"w12",name:"Bhavani Devi",dept:"General Civic",phone:"9876543221",status:"available",currentLoad:2,maxLoad:5,location:{lat:16.511,lng:80.650,area:"Rajolu"},completedToday:4,avgResolutionHrs:1.5,rating:4.7,skills:["Document Handling","Field Survey","Community Liaison"]},
  {id:"w13",name:"Chandra Sekhar",dept:"Police",phone:"9876543222",status:"busy",currentLoad:2,maxLoad:3,location:{lat:16.504,lng:80.645,area:"Suryaraopet"},completedToday:2,avgResolutionHrs:1.1,rating:4.6,skills:["Traffic Management","Crowd Control","Patrol"]},
];

// ─── AI ENGINES ───────────────────────────────────────────────────────────────
function getDistanceKm(a1:number,o1:number,a2:number,o2:number){
  const R=6371,dA=((a2-a1)*Math.PI)/180,dO=((o2-o1)*Math.PI)/180;
  const a=Math.sin(dA/2)**2+Math.cos((a1*Math.PI)/180)*Math.cos((a2*Math.PI)/180)*Math.sin(dO/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}
function aiRouteDepartment(complaint:Partial<Complaint>):{department:string;confidence:number;reason:string}{
  const text=[complaint.title,complaint.description,complaint.category].filter(Boolean).join(" ").toLowerCase();
  let bestDept="General Civic",bestScore=0,bestReason="No keywords matched";
  for(const[dept,kws] of Object.entries(DEPT_KEYWORDS)){
    const m=kws.filter(k=>text.includes(k));
    if(m.length>bestScore){bestScore=m.length;bestDept=dept;bestReason=`Matched: ${m.slice(0,3).join(", ")}`;}
  }
  if(bestScore===0&&complaint.category){
    const cat=complaint.category.toLowerCase();
    if(cat.includes("road")){bestDept="Roads & Infrastructure";bestReason="Category: Road";}
    else if(cat.includes("water")){bestDept="Water Works";bestReason="Category: Water";}
    else if(cat.includes("electric")){bestDept="Electricity";bestReason="Category: Electricity";}
    else if(cat.includes("sanitation")){bestDept="Sanitation";bestReason="Category: Sanitation";}
  }
  return{department:bestDept,confidence:bestScore===0?55:Math.min(95,60+bestScore*10),reason:bestReason};
}
function aiPriorityScore(c:Complaint,area:Complaint[]):number{
  let s=0;
  if(c.emergency)s+=40;
  if(c.status==="Pending")s+=20;
  const ms=typeof c.createdAt==="number"?c.createdAt:isNaN(Number(c.createdAt))?new Date(c.createdAt).getTime():Number(c.createdAt);
  s+=Math.min(10,Math.floor(Math.max(0,(Date.now()-ms)/(1000*60*60*24))));
  const hi=["fire","Police","Fire Department"],med=["Electricity","Water Works","Roads & Infrastructure"];
  if(c.department&&hi.some(r=>c.department!.includes(r)))s+=15;
  else if(c.department&&med.some(r=>c.department!.includes(r)))s+=8;
  if(c.lat&&c.lng)s+=Math.min(15,area.filter(x=>x.id!==c.id&&x.lat&&x.lng&&x.status!=="Resolved"&&getDistanceKm(c.lat!,c.lng!,x.lat!,x.lng!)<0.5).length*3);
  return Math.min(100,s);
}
function getPriorityLabel(score:number):"Critical"|"High"|"Medium"|"Low"{
  if(score>=70)return"Critical";if(score>=45)return"High";if(score>=25)return"Medium";return"Low";
}
function aiSuggestWorkers(complaint:Complaint,workers:Worker[],dept:string):Array<Worker&{score:number;reason:string}>{
  return workers.filter(w=>w.dept===dept&&w.status!=="offline").map(w=>{
    let score=0;const reasons:string[]=[];
    const lp=(w.currentLoad/w.maxLoad)*100;
    if(lp<40){score+=30;reasons.push("Low workload");}else if(lp<70){score+=15;reasons.push("Moderate workload");}else{score+=2;}
    if(complaint.lat&&complaint.lng){
      const km=getDistanceKm(complaint.lat,complaint.lng,w.location.lat,w.location.lng);
      if(km<1){score+=35;reasons.push(`${km.toFixed(1)}km away`);}
      else if(km<3){score+=20;reasons.push(`${km.toFixed(1)}km away`);}
      else if(km<6){score+=10;reasons.push(`${km.toFixed(1)}km away`);}
      else score+=2;
    }
    score+=Math.floor(w.rating*4);
    if(w.rating>=4.7)reasons.push(`⭐ ${w.rating}`);
    const t=(complaint.title||"")+" "+(complaint.description||"");
    const sm=w.skills.filter(s=>t.toLowerCase().includes(s.toLowerCase()));
    score+=sm.length*8;if(sm.length)reasons.push(`Skills: ${sm[0]}`);
    if(w.status==="available"){score+=10;reasons.push("Available");}
    return{...w,score,reason:reasons.slice(0,2).join(" · ")};
  }).sort((a,b)=>b.score-a.score);
}
function detectClusters(complaints:Complaint[]):IncidentCluster[]{
  const now=Date.now();
  const recent=complaints.filter(c=>c.lat&&c.lng&&c.status!=="Resolved"&&(now-new Date(c.createdAt).getTime())<5*60*1000);
  const clusters:IncidentCluster[]=[],used=new Set<string>();
  for(const c of recent){
    if(used.has(c.id))continue;
    const nearby=recent.filter(x=>x.id!==c.id&&!used.has(x.id)&&getDistanceKm(c.lat!,c.lng!,x.lat!,x.lng!)<0.5);
    if(nearby.length>=2){
      const g=[c,...nearby];g.forEach(x=>used.add(x.id));
      clusters.push({id:`cluster-${c.id}`,lat:c.lat!,lng:c.lng!,complaintIds:g.map(x=>x.id),detectedAt:new Date().toISOString(),area:c.address?.split(",")[0]||"Unknown",dismissed:false});
    }
  }
  return clusters;
}
function predictEtaBreaches(complaints:Complaint[],workers:Worker[]):EtaBreachAlert[]{
  const alerts:EtaBreachAlert[]=[];
  for(const c of complaints.filter(c=>c.assignedWorker&&(c.status==="Assigned"||c.status==="In Progress"))){
    const w=workers.find(x=>x.name===c.assignedWorker);if(!w)continue;
    const ageHrs=(Date.now()-new Date(c.createdAt).getTime())/(1000*60*60);
    const rem=w.avgResolutionHrs-ageHrs;
    if(rem<0.5&&rem>-1)alerts.push({id:`breach-${c.id}`,complaintId:c.id,ticketId:c.ticketId||c.id,workerName:c.assignedWorker!,predictedBreachMins:Math.max(0,Math.round(rem*60)),confidence:Math.min(95,70+w.currentLoad*5),detectedAt:new Date().toISOString(),dismissed:false});
  }
  return alerts;
}
function checkAutoEscalations(complaints:Complaint[]):Complaint[]{
  const now=Date.now();
  return complaints.filter(c=>{
    if(c.status!=="Pending"||c.assignedWorker||c.escalated)return false;
    return(now-(c.escalationPendingSince?new Date(c.escalationPendingSince).getTime():new Date(c.createdAt).getTime()))>30000;
  });
}

// ─── STORAGE ──────────────────────────────────────────────────────────────────
const SHARED_KEY="complaints_all";
const API="http://localhost:3001/api";
async function fetchFromServer():Promise<Complaint[]>{
  try{
    const token=JSON.parse(localStorage.getItem("auth")||"{}").token;
    if(!token) throw new Error("No token");
    const res=await fetch(`${API}/complaints`,{headers:{Authorization:`Bearer ${token}`}});
    if(!res.ok)throw new Error(`HTTP ${res.status}`);
    const json=await res.json();
    const raw=json?.data?.complaints??json?.data??json;
    const arr=Array.isArray(raw)?raw:[];
    // Normalise backend field names → frontend Complaint shape
    const normalised=arr.map((c:any)=>({
      ...c,
      id:             c.id,
      ticketId:       c.ticket_id     ?? c.ticketId,
      title:          c.title,
      description:    c.description,
      category:       c.category      ?? c.department,
      department:     c.department,
      status:         c.status,
      address:        c.address,
      lat:            c.lat           ? parseFloat(c.lat) : undefined,
      lng:            c.lng           ? parseFloat(c.lng) : undefined,
      image:          c.image_url     ?? c.image,
      emergency:      c.is_emergency===1||c.is_emergency===true,
      userId:         c.user_id       ?? c.userId,
      userName:       c.user_name     ?? c.userName,
      userPhone:      c.user_phone    ?? c.userPhone,
      assignedOfficer:c.assigned_name ?? c.assignedOfficer,
      createdAt:      c.created_at    ?? c.createdAt ?? new Date().toISOString(),
      updatedAt:      c.updated_at    ?? c.updatedAt,
      aiRouted:       c.aiRouted      ?? false,
    }));
    localStorage.setItem(SHARED_KEY,JSON.stringify(normalised));
    return normalised;
  }
  catch(e){
    console.warn("[Officer] fetchFromServer failed:",e);
    try{const r=localStorage.getItem(SHARED_KEY);return r?JSON.parse(r):[];}catch{return[];}
  }
}
function safeLoad():Complaint[]{
  try{
    const raw=localStorage.getItem(SHARED_KEY),all:any[]=raw?JSON.parse(raw):[];
    const result:Complaint[]=[];
    for(const c of all){
      if(!c?.id||c.dueTime!==undefined)continue;
      if(!c.title&&!c.category&&!c.description&&!c.ticketId)continue;
      let createdAt=c.createdAt;
      if(typeof createdAt==="number")createdAt=new Date(createdAt).toISOString();
      else if(!createdAt)createdAt=new Date().toISOString();
      const norm:Complaint={id:c.id,ticketId:c.ticketId||`AP-${c.id.slice(-6).toUpperCase()}`,title:c.title||c.category||c.description?.slice(0,60)||"Untitled",category:c.category||c.title||"General",description:c.description||"",status:c.status||"Pending",department:c.department||"General Civic",userName:c.userName||"Citizen",userId:c.userId||"",address:c.address||"",image:c.image,createdAt,updatedAt:c.updatedAt||createdAt,lat:typeof c.lat==="number"?c.lat:undefined,lng:typeof c.lng==="number"?c.lng:undefined,aiRouted:c.aiRouted||false,aiRoutingReason:c.aiRoutingReason||"",emergency:c.emergency||false,priority:c.priority||"Normal",assignedOfficer:c.assignedOfficer,officerNote:c.officerNote,escalated:c.escalated||false,timeline:c.timeline||[],workerUpdates:c.workerUpdates||[],messages:c.messages||[],escalationPendingSince:c.escalationPendingSince,interAgencyDispatched:c.interAgencyDispatched};
      if(!norm.department||norm.department==="General Civic"){const r=aiRouteDepartment(norm);norm.department=r.department;norm.aiRouted=true;norm.aiRoutingReason=r.reason;}
      result.push(norm);
    }
    result.sort((a,b)=>new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime());
    return result;
  }catch(e){console.error("safeLoad:",e);return[];}
}
function saveAll(data:Complaint[]){try{localStorage.setItem(SHARED_KEY,JSON.stringify(data));}catch{}}
async function patchComplaintBackend(id:string,payload:Record<string,any>){
  try{
    const token=JSON.parse(localStorage.getItem("auth")||"{}").token;
    await fetch(`${API}/complaints/${id}/status`,{method:"PATCH",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify(payload)});
  }catch(e){console.warn("Backend patch failed",e);}
}
async function assignWorkerBackend(complaintId:string,workerId:string,notes?:string){
  try{
    const token=JSON.parse(localStorage.getItem("auth")||"{}").token;
    await fetch(`${API}/complaints/${complaintId}/assign`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({worker_id:workerId,notes:notes||""})});
  }catch(e){console.warn("Assign failed",e);}
}

// ─── ADMIN PIPELINE ───────────────────────────────────────────────────────────
const ADMIN_PIPELINE_KEY="admin_pipeline_records";

interface AdminPipelineRecord{
  id:string;
  type:"complaint_resolved"|"emergency_resolved"|"escalation"|"inter_agency"|"officer_intervention";
  ticketId:string;
  title:string;
  department:string;
  officerName:string;
  workerName?:string;
  citizenName?:string;
  responseTimeMs:number;       // ms from createdAt to resolution
  responseTimeHrs:number;      // rounded hours
  officerInterventions:number; // count of timeline events by officer
  wasEscalated:boolean;
  wasEmergency:boolean;
  wasInterAgency:boolean;
  interAgencies?:string[];
  wasClustered:boolean;
  wasEtaBreach:boolean;
  aiPriority:number;
  priority:string;
  resolvedAt:string;           // ISO timestamp
  shiftDate:string;            // YYYY-MM-DD
  outcome:"resolved"|"escalated_hq"|"inter_agency_dispatched";
  auditTrail:Array<{event:string;actor:string;time:string}>;
}

function pushToAdminPipeline(record:AdminPipelineRecord){
  try{
    const raw=localStorage.getItem(ADMIN_PIPELINE_KEY);
    const all:AdminPipelineRecord[]=raw?JSON.parse(raw):[];
    const idx=all.findIndex(r=>r.id===record.id);
    if(idx>=0)all[idx]=record; else all.unshift(record);
    // keep last 500 records
    localStorage.setItem(ADMIN_PIPELINE_KEY,JSON.stringify(all.slice(0,500)));
    // fire storage event so AdminDashboard can pick it up cross-tab
    window.dispatchEvent(new StorageEvent("storage",{key:ADMIN_PIPELINE_KEY}));
    // also POST to server if available
    fetch(`${API}/admin/pipeline`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(record)}).catch(()=>{});
  }catch(e){console.warn("[AdminPipeline] write failed:",e);}
}

function loadAdminPipeline():AdminPipelineRecord[]{
  try{const r=localStorage.getItem(ADMIN_PIPELINE_KEY);return r?JSON.parse(r):[];}catch{return[];}
}

function buildPipelineRecord(
  complaint:Complaint,
  officerName:string,
  type:AdminPipelineRecord["type"]="complaint_resolved"
):AdminPipelineRecord{
  const now=new Date();
  const createdMs=new Date(complaint.createdAt).getTime();
  const responseTimeMs=now.getTime()-createdMs;
  const officerEvents=(complaint.timeline||[]).filter(e=>e.actor===officerName||e.actor?.includes("Officer")).length;
  return{
    id:`pipe-${complaint.id}`,
    type,
    ticketId:complaint.ticketId||complaint.id,
    title:complaint.title||complaint.category||"Complaint",
    department:complaint.department||"General Civic",
    officerName,
    workerName:complaint.assignedWorker,
    citizenName:complaint.userName,
    responseTimeMs,
    responseTimeHrs:Math.round((responseTimeMs/(1000*60*60))*10)/10,
    officerInterventions:officerEvents,
    wasEscalated:!!complaint.escalated,
    wasEmergency:!!complaint.emergency,
    wasInterAgency:!!(complaint.interAgencyDispatched&&complaint.interAgencyDispatched.length>0),
    interAgencies:complaint.interAgencyDispatched,
    wasClustered:!!complaint.clusterGroup,
    wasEtaBreach:!!complaint.etaBreachPredicted,
    aiPriority:complaint.aiPriority||0,
    priority:complaint.priority||"Normal",
    resolvedAt:now.toISOString(),
    shiftDate:now.toISOString().slice(0,10),
    outcome:complaint.escalated?"escalated_hq":
            (complaint.interAgencyDispatched&&complaint.interAgencyDispatched.length>0)?"inter_agency_dispatched":"resolved",
    auditTrail:(complaint.timeline||[]).map(e=>({event:e.event,actor:e.actor||"System",time:e.time})),
  };
}
function emLoadAll():EmergencyRequest[]{try{const r=localStorage.getItem(EM_KEY);return r?JSON.parse(r):[];}catch{return[];}}
function emSaveReq(req:EmergencyRequest,officerName?:string){
  try{
    const all=emLoadAll(),idx=all.findIndex(r=>r.id===req.id);
    if(idx>=0)all[idx]=req; else all.unshift(req);
    localStorage.setItem(EM_KEY,JSON.stringify(all));
    window.dispatchEvent(new Event("storage"));
    // ── ADMIN PIPELINE: push when emergency is resolved ──
    if(req.status==="Resolved"&&officerName){
      const createdMs=new Date(req.createdAt).getTime();
      const now=new Date();
      const record:AdminPipelineRecord={
        id:`pipe-em-${req.id}`,
        type:"emergency_resolved",
        ticketId:req.ticketId,
        title:`${req.subType||req.type} Emergency`,
        department:"Emergency Dispatch",
        officerName,
        workerName:req.assignedResponderName,
        citizenName:req.citizenName,
        responseTimeMs:now.getTime()-createdMs,
        responseTimeHrs:Math.round(((now.getTime()-createdMs)/(1000*60*60))*10)/10,
        officerInterventions:(req.timeline||[]).filter(e=>e.actor===officerName).length,
        wasEscalated:false,
        wasEmergency:true,
        wasInterAgency:false,
        wasClustered:false,
        wasEtaBreach:false,
        aiPriority:req.priority==="CRITICAL"?90:req.priority==="HIGH"?70:50,
        priority:req.priority,
        resolvedAt:now.toISOString(),
        shiftDate:now.toISOString().slice(0,10),
        outcome:"resolved",
        auditTrail:(req.timeline||[]).map(e=>({event:e.event,actor:e.actor||"System",time:e.time})),
      };
      pushToAdminPipeline(record);
    }
  }catch{}
}
function lsGet<T>(k:string,fb:T):T{try{const r=localStorage.getItem(k);return r?JSON.parse(r):fb;}catch{return fb;}}
function lsSet(k:string,v:any){try{localStorage.setItem(k,JSON.stringify(v));}catch{}}
function genId(){return`msg-${Date.now()}-${Math.random().toString(36).substr(2,5)}`;}
function makeDefaultTasks(complaints:Complaint[],dept:string):Task[]{
  const now=new Date(),out:Task[]=[];
  complaints.filter(c=>c.status==="Pending"&&c.department===dept).slice(0,3).forEach((c,i)=>{
    const due=new Date(now);due.setHours(now.getHours()+i+1);
    out.push({id:`tc-${c.id}`,title:`Review: ${c.title||c.category||"Complaint"}`,description:`Citizen: ${c.userName||"Unknown"}`,priority:i===0?"High":"Medium",category:c.department||dept,dueTime:due.toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"}),done:false,complaintId:c.id,createdAt:now.toISOString()});
  });
  out.push({id:"t-patrol",title:"Complete daily patrol log",description:"Document field observations",priority:"Medium",category:"Admin",dueTime:"05:00 PM",done:false,createdAt:now.toISOString()});
  out.push({id:"t-report",title:"Submit incident report",description:"End-of-day summary",priority:"Low",category:"Admin",dueTime:"06:00 PM",done:false,createdAt:now.toISOString()});
  return out;
}

// ─── GLOBAL STYLES ────────────────────────────────────────────────────────────
const GLOBAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800;9..40,900&family=DM+Serif+Display&family=DM+Mono:wght@400;500&display=swap');

*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}

/* ── CITIZEN-MATCHING DESIGN TOKENS ── */
:root{
  --bg-page:#f0faf4;
  --bg-card:#ffffff;
  --bg-card-alt:#f4fbf7;
  --bg-nav:#ffffff;
  --bg-nav-glass:rgba(255,255,255,.94);
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
  --nav-border:#d1ead9;
  --scrollbar:#a3d4b3;

  /* keep legacy vars for existing component code */
  --bg:var(--bg-page);
  --bg2:var(--bg-card);
  --surface:var(--bg-card);
  --surface2:var(--bg-card-alt);
  --border2:var(--border-strong);
  --text:var(--text-primary);
  --text2:var(--text-secondary);
  --text3:var(--text-muted);
  --green:#16a34a;
  --green-dark:#15803d;
  --green-light:#22c55e;
  --green-bg:rgba(22,163,74,.10);
  --green-border:rgba(22,163,74,.28);
  --blue:#0284c7;
  --blue-bg:rgba(2,132,199,.10);
  --blue-border:rgba(2,132,199,.28);
  --orange:#ea580c;
  --orange-bg:rgba(234,88,12,.10);
  --orange-border:rgba(234,88,12,.28);
  --yellow:#d97706;
  --yellow-bg:rgba(217,119,6,.10);
  --yellow-border:rgba(217,119,6,.28);
  --purple:#7c3aed;
  --purple-bg:rgba(124,58,237,.10);
  --purple-border:rgba(124,58,237,.28);
  --red:#dc2626;
  --red-bg:rgba(220,38,38,.08);
  --red-border:rgba(220,38,38,.25);
  --font:'DM Sans','Nunito',system-ui,sans-serif;
  --font-display:'DM Serif Display',Georgia,serif;
  --font-mono:'DM Mono',monospace;
  --radius:16px;
  --radius-sm:10px;
  --radius-lg:22px;
  --shadow:var(--shadow-sm);
  --shadow-lg:var(--shadow-md);
  --transition:all .18s cubic-bezier(.4,0,.2,1);
}

body{background:var(--bg-page);color:var(--text-primary);font-family:var(--font);}

/* ── ANIMATIONS ── */
@keyframes fadeUp{from{opacity:0;transform:translateY(10px);}to{opacity:1;transform:translateY(0);}}
@keyframes fadeIn{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}
@keyframes slideIn{from{transform:translateX(-100%);}to{transform:translateX(0);}}
@keyframes slideRight{from{opacity:0;transform:translateX(20px);}to{opacity:1;transform:translateX(0);}}
@keyframes pulse{0%,100%{opacity:1;transform:scale(1);}50%{opacity:.5;transform:scale(1.2);}}
@keyframes bounce{0%,100%{transform:translateY(0);}50%{transform:translateY(-4px);}}
@keyframes spin{from{transform:rotate(0deg);}to{transform:rotate(360deg);}}
@keyframes crm-blink{0%,100%{opacity:.18;}50%{opacity:.55;}}
@keyframes hm-pulse{0%,100%{opacity:.38;}50%{opacity:.75;}}

/* ── SCROLLBAR ── */
::-webkit-scrollbar{width:4px;height:4px;}
::-webkit-scrollbar-track{background:transparent;}
::-webkit-scrollbar-thumb{background:var(--scrollbar);border-radius:4px;}
::-webkit-scrollbar-thumb:hover{background:var(--accent);}

/* ── CARDS ── */
.card{
  background:var(--bg-card);
  border:1px solid var(--border);
  border-radius:var(--radius);
  padding:20px;
  box-shadow:var(--shadow-sm);
  transition:var(--transition);
}
.card:hover{box-shadow:var(--shadow-md);border-color:var(--border-strong);}
.ch{transition:transform .2s,box-shadow .2s;}
.ch:hover{transform:translateY(-2px);box-shadow:var(--shadow-md)!important;}

/* ── BUTTONS ── */
.btn{
  display:inline-flex;align-items:center;gap:6px;
  padding:9px 18px;border-radius:10px;
  font-size:13px;font-weight:700;cursor:pointer;border:none;
  transition:var(--transition);font-family:var(--font);
}
.btn-primary{
  background:linear-gradient(135deg,#15803d,#16a34a);color:#fff;
  box-shadow:0 3px 12px rgba(22,163,74,.35);
}
.btn-primary:hover{background:linear-gradient(135deg,#14532d,#15803d);box-shadow:0 4px 16px rgba(22,163,74,.45);}
.btn-ghost{
  background:var(--bg-card);border:1.5px solid var(--border-strong);
  color:var(--text-secondary);
}
.btn-ghost:hover{background:var(--bg-hover);border-color:var(--accent);}
.btn-danger{
  background:linear-gradient(135deg,#b91c1c,#dc2626);color:#fff;border:none;
  box-shadow:0 3px 12px rgba(220,38,38,.3);
}
.btn-danger:hover{background:linear-gradient(135deg,#991b1b,#b91c1c);}

/* ── TAGS ── */
.tag{
  display:inline-flex;align-items:center;gap:5px;
  padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;
}

/* ── INPUTS ── */
.input{
  background:var(--bg-card);border:1.5px solid var(--border-strong);
  border-radius:10px;padding:10px 13px;font-size:13px;
  color:var(--text-primary);width:100%;font-family:var(--font);
}
.input:focus{outline:none;border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-dim);}

/* ── LAYOUT ── */
.officer-wrap{min-height:100vh;background:var(--bg-page);padding-top:64px;}
.page-inner{max-width:1440px;margin:0 auto;padding:22px 24px;}

/* ── LEAFLET ── */
.leaflet-control-attribution{display:none!important}
.leaflet-container{background:#d1fae5!important}

/* ── RESPONSIVE ── */
@media(max-width:900px){
  .page-inner{padding:14px;}
  .nav-center{display:none!important;}
  .mob-menu-btn{display:flex!important;}
}
@media(max-width:640px){.page-inner{padding:10px;}}
`;

// ─── UI ATOMS ─────────────────────────────────────────────────────────────────
function Badge({status}:{status:string}){
  const s=STATUS_STYLE[status]||{bg:"rgba(100,116,139,.1)",text:"#64748b",dot:"#64748b",border:"rgba(100,116,139,.2)"};
  return<span className="tag" style={{background:s.bg,color:s.text,border:`1px solid ${s.border}`}}><span style={{width:5,height:5,borderRadius:"50%",background:s.dot,display:"inline-block",animation:status==="Pending"?"pulse 1.5s infinite":"none"}}/>{status}</span>;
}
function PBadge({p}:{p:string}){
  const s=PRIORITY_STYLE[p as keyof typeof PRIORITY_STYLE]||PRIORITY_STYLE.Low;
  return<span className="tag" style={{background:s.bg,color:s.text,border:`1px solid ${s.border}`}}><span style={{width:4,height:4,borderRadius:"50%",background:s.dot,display:"inline-block"}}/>{p}</span>;
}
function Pill({children,color="green"}:{children:React.ReactNode;color?:string}){
  const map:Record<string,{bg:string;text:string;border:string}>={
    green:{bg:"var(--green-bg)",text:"var(--green)",border:"var(--green-border)"},
    red:{bg:"var(--red-bg)",text:"var(--red)",border:"var(--red-border)"},
    yellow:{bg:"var(--yellow-bg)",text:"var(--yellow)",border:"var(--yellow-border)"},
    blue:{bg:"var(--blue-bg)",text:"var(--blue)",border:"var(--blue-border)"},
    purple:{bg:"var(--purple-bg)",text:"var(--purple)",border:"var(--purple-border)"},
    orange:{bg:"var(--orange-bg)",text:"var(--orange)",border:"var(--orange-border)"},
  };
  const c=map[color]||map.green;
  return<span className="tag" style={{background:c.bg,color:c.text,border:`1px solid ${c.border}`}}>{children}</span>;
}

// ─── NOTIFICATIONS PANEL ──────────────────────────────────────────────────────
interface UnifiedNotif{id:string;icon:string;title:string;body:string;time:string;ticketId?:string;type:"urgent"|"task"|"done"|"alert"|"info"|"warning";read?:boolean;}
function UnifiedNotifsPanel({notifs,onRead,onReadAll,onClose}:{notifs:UnifiedNotif[];onRead:(id:string)=>void;onReadAll:()=>void;onClose:()=>void}){
  const unread=notifs.filter(n=>!n.read).length;
  const tC:{[k:string]:string}={urgent:"#ef4444",task:"#8b5cf6",done:"#10b981",alert:"#f97316",info:"#3b82f6",warning:"#f59e0b"};
  const tB:{[k:string]:string}={urgent:"#fef2f2",task:"#f5f3ff",done:"#ecfdf5",alert:"#fff7ed",info:"#eff6ff",warning:"#fffbeb"};
  const age=(ts:string)=>{const d=Date.now()-new Date(ts).getTime();if(d<60000)return"just now";if(d<3600000)return`${Math.round(d/60000)}m ago`;if(d<86400000)return`${Math.round(d/3600000)}h ago`;return`${Math.round(d/86400000)}d ago`;};
  return(
    <div style={{position:"fixed",right:16,top:72,width:360,background:"#ffffff",borderRadius:16,boxShadow:"0 20px 60px rgba(0,0,0,.18)",border:"1px solid var(--border)",zIndex:9999,overflow:"hidden",animation:"fadeIn .2s ease"}}>
      <div style={{padding:"14px 16px",borderBottom:"1px solid var(--border)",background:"#f8fafb",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div><div style={{fontWeight:800,fontSize:14,color:"var(--text-primary)"}}>🔔 Notifications</div><div style={{fontSize:10.5,color:"var(--text-muted)",marginTop:1}}>{notifs.length} total · {unread} unread</div></div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          {unread>0&&<button onClick={onReadAll} style={{fontSize:10.5,color:"var(--accent)",background:"rgba(22,163,74,.1)",border:"none",cursor:"pointer",fontWeight:700,fontFamily:"inherit",padding:"4px 10px",borderRadius:7}}>✓ All read</button>}
          <button onClick={onClose} style={{width:26,height:26,borderRadius:"50%",background:"var(--bg-hover)",border:"none",cursor:"pointer",fontSize:13,display:"flex",alignItems:"center",justifyContent:"center",color:"var(--text-muted)"}}>✕</button>
        </div>
      </div>
      <div style={{maxHeight:400,overflowY:"auto"}}>
        {notifs.length===0?(<div style={{textAlign:"center",padding:"36px 16px",color:"var(--text-muted)"}}><div style={{fontSize:32,marginBottom:8}}>🔕</div><div style={{fontSize:13,fontWeight:600}}>No notifications</div></div>
        ):notifs.map(n=>(
          <div key={n.id} onClick={()=>onRead(n.id)} style={{padding:"12px 16px",borderBottom:"1px solid var(--border)",display:"flex",gap:12,alignItems:"flex-start",background:n.read?"var(--bg-card)":`${tC[n.type]||"#16a34a"}06`,cursor:"pointer",transition:"background .15s"}} onMouseOver={e=>(e.currentTarget.style.background="var(--bg-hover)")} onMouseOut={e=>(e.currentTarget.style.background=n.read?"var(--bg-card)":`${tC[n.type]||"#16a34a"}06`)}>
            <div style={{width:36,height:36,borderRadius:10,background:tB[n.type]||"#ecfdf5",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>{n.icon}</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:12.5,fontWeight:n.read?500:700,color:n.read?"var(--text-muted)":tC[n.type]||"#16a34a"}}>{n.title}</div>
              <div style={{fontSize:11.5,color:"var(--text-primary)",marginTop:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontWeight:n.read?400:500}}>{n.body}</div>
              {n.ticketId&&<div style={{fontSize:10,color:"var(--text-muted)",fontFamily:"var(--font-mono)",marginTop:2}}>{n.ticketId}</div>}
              <div style={{fontSize:10,color:"var(--text-muted)",marginTop:3}}>{age(n.time)}</div>
            </div>
            {!n.read&&<div style={{width:8,height:8,borderRadius:"50%",background:tC[n.type]||"#16a34a",flexShrink:0,marginTop:4,boxShadow:`0 0 6px ${tC[n.type]||"#16a34a"}`}}/>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── WORKER ASSIGN MODAL ──────────────────────────────────────────────────────
function WorkerAssignModal({complaint,dept,workers,onAssign,onClose}:{complaint:Complaint;dept:string;workers:Worker[];onAssign:(w:Worker)=>void;onClose:()=>void}){
  const suggestions=useMemo(()=>aiSuggestWorkers(complaint,workers,dept),[complaint,dept,workers]);
  // Show all non-offline workers, prioritize dept match
  const deptWorkers=workers.filter(w=>w.dept===dept&&w.status!=="offline");
  const allDept=deptWorkers.length>0?deptWorkers:workers.filter(w=>w.status!=="offline");
  const[sel,setSel]=useState<Worker|null>(null);
  const[msg,setMsg]=useState(`Hi {name}, assigned: ${complaint.ticketId||complaint.id}. Please investigate and update. — Officer`);
  const dc=DEPT_COLOR[dept]||"var(--green)";
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.75)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16,backdropFilter:"blur(8px)"}} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div style={{background:"var(--bg-card)",border:"1px solid var(--border2)",borderRadius:"var(--radius-lg)",width:"100%",maxWidth:580,maxHeight:"90vh",overflowY:"auto",boxShadow:"var(--shadow-lg)",animation:"fadeUp .25s ease"}}>
        <div style={{padding:"22px 24px",borderBottom:"1px solid var(--border)",display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:36,height:36,borderRadius:10,background:"var(--green-bg)",border:"1px solid var(--green-border)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>🤖</div>
          <div>
            <div style={{fontFamily:"'DM Serif Display',Georgia,serif",fontWeight:700,fontSize:15,color:"var(--text-primary)"}}>AI Worker Assignment</div>
            <div style={{fontSize:11,color:"var(--text-muted)",marginTop:1}}>{complaint.ticketId} · {complaint.title||complaint.category}</div>
          </div>
          <button onClick={onClose} style={{marginLeft:"auto",width:28,height:28,borderRadius:"50%",background:"var(--bg-card-alt)",border:"1px solid var(--border)",cursor:"pointer",color:"var(--text-secondary)",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
        </div>
        <div style={{padding:"20px 24px"}}>
          {suggestions.length>0&&(
            <div style={{marginBottom:16,padding:"14px",background:"rgba(16,185,129,.04)",borderRadius:"var(--radius-sm)",border:"1px solid var(--green-border)"}}>
              <div style={{fontSize:10,color:"var(--green)",fontWeight:700,letterSpacing:".1em",marginBottom:10}}>🤖 AI RECOMMENDED · workload + proximity + skills</div>
              {suggestions.slice(0,3).map((w,i)=>(
                <div key={w.id} onClick={()=>setSel(w)} style={{display:"flex",alignItems:"center",gap:12,padding:"11px 12px",background:sel?.id===w.id?"var(--green-bg)":"var(--surface2)",borderRadius:"var(--radius-sm)",marginBottom:6,cursor:"pointer",border:`1px solid ${sel?.id===w.id?"var(--green-border)":"var(--border)"}`,transition:"var(--transition)"}}>
                  <div style={{width:32,height:32,borderRadius:"50%",background:i===0?"rgba(245,158,11,.2)":i===1?"rgba(100,116,139,.2)":"rgba(180,120,50,.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,flexShrink:0}}>{i===0?"🥇":i===1?"🥈":"🥉"}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:600,color:"var(--text-primary)"}}>{w.name} <span style={{fontSize:10,color:w.status==="available"?"var(--green)":w.status==="busy"?"var(--yellow)":"var(--text3)",marginLeft:4}}>● {w.status}</span></div>
                    <div style={{fontSize:11,color:"var(--text-muted)",marginTop:1}}>{w.reason}</div>
                    <div style={{display:"flex",gap:8,marginTop:3}}><span style={{fontSize:10,color:"var(--text-muted)"}}>📍 {w.location.area}</span><span style={{fontSize:10,color:"var(--text-muted)"}}>Load: {w.currentLoad}/{w.maxLoad}</span><span style={{fontSize:10,color:"var(--yellow)"}}>⭐ {w.rating}</span></div>
                  </div>
                  <div style={{background:"var(--bg-card)",borderRadius:"var(--radius-sm)",padding:"4px 10px",border:`1px solid ${sel?.id===w.id?"var(--green-border)":"var(--border)"}`}}><div style={{fontSize:11,fontWeight:700,color:sel?.id===w.id?"var(--green)":"var(--text2)"}}>{w.score}pts</div></div>
                </div>
              ))}
            </div>
          )}
          <div style={{marginBottom:16}}>
            <div style={{fontSize:11,fontWeight:600,color:"var(--text-secondary)",marginBottom:8}}>ALL {dept.toUpperCase()} WORKERS</div>
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {allDept.filter(w=>!suggestions.slice(0,3).some(s=>s.id===w.id)).map(w=>(
                <div key={w.id} onClick={()=>w.status!=="offline"?setSel(w):null} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",background:sel?.id===w.id?"var(--blue-bg)":"var(--surface2)",borderRadius:"var(--radius-sm)",cursor:w.status==="offline"?"not-allowed":"pointer",border:`1px solid ${sel?.id===w.id?"rgba(59,130,246,.3)":"var(--border)"}`,opacity:w.status==="offline"?.4:1,transition:"var(--transition)"}}>
                  <div style={{width:30,height:30,borderRadius:"50%",background:"var(--bg-card)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13}}>{DEPT_ICON[w.dept]}</div>
                  <div style={{flex:1}}><div style={{fontSize:12.5,fontWeight:500,color:"var(--text-primary)"}}>{w.name}</div><div style={{fontSize:10.5,color:"var(--text-muted)"}}>Load {w.currentLoad}/{w.maxLoad} · ⭐{w.rating} · {w.location.area}</div></div>
                  <span style={{fontSize:10,fontWeight:600,color:w.status==="available"?"var(--green)":w.status==="busy"?"var(--yellow)":"var(--text3)"}}>{w.status}</span>
                </div>
              ))}
            </div>
          </div>
          {sel&&<div style={{marginBottom:16}}><div style={{fontSize:11,fontWeight:600,color:"var(--text-secondary)",marginBottom:6}}>MESSAGE TO {sel.name.toUpperCase()}</div><textarea value={msg.replace("{name}",sel.name)} onChange={e=>setMsg(e.target.value)} rows={2} className="input" style={{resize:"vertical"}}/></div>}
        </div>
        <div style={{padding:"0 24px 22px",display:"flex",gap:10,justifyContent:"flex-end"}}>
          <button onClick={onClose} className="btn btn-ghost">Cancel</button>
          <button onClick={()=>{if(sel)onAssign(sel);}} disabled={!sel} style={{padding:"9px 22px",borderRadius:"var(--radius-sm)",background:sel?dc:"var(--surface2)",border:"none",color:sel?"#fff":"var(--text3)",fontSize:13,fontWeight:600,cursor:sel?"pointer":"default",fontFamily:"var(--font)",transition:"var(--transition)"}}>
            {sel?`Assign ${sel.name}`:"Select a Worker"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── VIDEO CALL MODAL ─────────────────────────────────────────────────────────
function VideoCallModal({complaint,officerName,onClose}:{complaint:Complaint;officerName:string;onClose:()=>void}){
  const[state,setState]=useState<"calling"|"connected"|"ended">("calling");
  const[dur,setDur]=useState(0);
  const localRef=useRef<HTMLVideoElement>(null);
  const timerRef=useRef<ReturnType<typeof setInterval>|null>(null);
  useEffect(()=>{
    navigator.mediaDevices?.getUserMedia({video:true,audio:true}).then(s=>{if(localRef.current)localRef.current.srcObject=s;}).catch(()=>{});
    const t=setTimeout(()=>{setState("connected");timerRef.current=setInterval(()=>setDur(d=>d+1),1000);},1500);
    return()=>{clearTimeout(t);if(timerRef.current)clearInterval(timerRef.current);};
  },[]);
  const fmt=(s:number)=>`${Math.floor(s/60).toString().padStart(2,"0")}:${(s%60).toString().padStart(2,"0")}`;
  const end=()=>{setState("ended");setTimeout(onClose,1500);};
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.85)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(16px)"}}>
      <div style={{width:"min(680px,95vw)",borderRadius:"var(--radius-lg)",overflow:"hidden",background:"#fff",border:"2px solid var(--border2)",boxShadow:"0 20px 60px rgba(0,0,0,0.3)"}}>
        <div style={{padding:"14px 20px",borderBottom:"1px solid var(--border)",display:"flex",alignItems:"center",justifyContent:"space-between",background:"var(--bg-card)"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:8,height:8,borderRadius:"50%",background:state==="connected"?"var(--green)":"var(--yellow)",animation:"pulse 1.5s infinite"}}/>
            <div><div style={{fontSize:13,fontWeight:600,color:"var(--text-primary)"}}>{state==="calling"?"Calling…":state==="connected"?`Live · ${fmt(dur)}`:"Call ended"}</div><div style={{fontSize:11,color:"var(--text-muted)",fontFamily:"var(--font-mono)"}}>{complaint.ticketId}</div></div>
          </div>
          <span style={{fontSize:10.5,color:"var(--blue)",background:"var(--blue-bg)",padding:"4px 10px",borderRadius:20,fontWeight:600,border:"1px solid var(--blue-border)"}}>🔒 WebRTC E2E</span>
        </div>
        <div style={{position:"relative",height:340,background:"linear-gradient(135deg,#0f2a1a,#0a1a10)",display:"flex",alignItems:"center",justifyContent:"center"}}>
          {state==="calling"&&<div style={{textAlign:"center"}}><div style={{fontSize:56,marginBottom:12,animation:"bounce 1s infinite"}}>📡</div><div style={{fontSize:15,color:"rgba(255,255,255,.75)"}}>Connecting to {complaint.userName||"Citizen"}…</div></div>}
          {state==="connected"&&<div style={{textAlign:"center"}}>
            <div style={{width:80,height:80,borderRadius:"50%",background:"var(--green-bg)",border:"3px solid var(--green)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:32,margin:"0 auto 12px",boxShadow:"0 0 30px rgba(22,163,74,0.5)"}}>{complaint.userName?.charAt(0)||"C"}</div>
            <div style={{fontSize:16,fontWeight:600,color:"#fff"}}>{complaint.userName||"Citizen"}</div>
            <div style={{fontSize:11,color:"var(--green-light)",marginTop:4,fontFamily:"var(--font-mono)"}}>● LIVE ASSESSMENT</div>
            <div style={{marginTop:12,padding:"10px 18px",background:"rgba(255,255,255,.1)",borderRadius:"var(--radius-sm)",border:"1px solid rgba(255,255,255,.15)",display:"inline-block"}}>
              <div style={{fontSize:11,color:"rgba(255,255,255,.85)"}}>{complaint.title||complaint.category}</div>
              <div style={{fontSize:10.5,color:"rgba(255,255,255,.55)",marginTop:2}}>📍 {complaint.address||"Location not shared"}</div>
            </div>
          </div>}
          {state==="ended"&&<div style={{textAlign:"center"}}><div style={{fontSize:44,marginBottom:10}}>📵</div><div style={{fontSize:15,color:"rgba(255,255,255,.7)"}}>Call ended · {fmt(dur)}</div></div>}
          <div style={{position:"absolute",bottom:10,right:10,width:130,height:90,borderRadius:10,overflow:"hidden",border:"2px solid rgba(255,255,255,.2)",background:"rgba(0,0,0,.3)"}}>
            <video ref={localRef} autoPlay muted playsInline style={{width:"100%",height:"100%",objectFit:"cover"}}/>
            <div style={{position:"absolute",bottom:5,left:7,fontSize:9.5,color:"rgba(255,255,255,.7)",fontWeight:600}}>👮 {officerName.split(" ")[0]}</div>
          </div>
        </div>
        <div style={{padding:"14px 20px",display:"flex",alignItems:"center",justifyContent:"center",gap:12,borderTop:"1px solid var(--border)",background:"var(--bg-card)"}}>
          {[{icon:"🎤",label:"Mute"},{icon:"📷",label:"Camera"},{icon:"📺",label:"Screen"},{icon:"📸",label:"Snap"}].map(b=>(
            <button key={b.label} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4,width:54,height:48,borderRadius:10,background:"var(--bg-card-alt)",border:"1.5px solid var(--border2)",cursor:"pointer",color:"var(--text-secondary)",fontFamily:"var(--font)"}}>
              <span style={{fontSize:16}}>{b.icon}</span><span style={{fontSize:9,fontWeight:500}}>{b.label}</span>
            </button>
          ))}
          <button onClick={end} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4,width:60,height:48,borderRadius:10,background:"var(--red)",border:"none",cursor:"pointer",color:"#fff",fontFamily:"var(--font)"}}>
            <span style={{fontSize:18}}>📵</span><span style={{fontSize:9,fontWeight:700}}>End</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── INTER-AGENCY MODAL ───────────────────────────────────────────────────────
function InterAgencyModal({complaint,onDispatch,onClose}:{complaint:Complaint;onDispatch:(agencies:string[])=>void;onClose:()=>void}){
  const[sel,setSel]=useState<string[]>([]);
  const[note,setNote]=useState("");
  const[done,setDone]=useState(false);
  const toggle=(id:string)=>setSel(s=>s.includes(id)?s.filter(x=>x!==id):[...s,id]);
  const doDispatch=async()=>{setDone(true);await new Promise(r=>setTimeout(r,800));onDispatch(sel);};
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.8)",zIndex:1100,display:"flex",alignItems:"center",justifyContent:"center",padding:16,backdropFilter:"blur(10px)"}} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div style={{background:"var(--bg-card)",border:"1px solid var(--border2)",borderRadius:"var(--radius-lg)",width:"100%",maxWidth:500,boxShadow:"var(--shadow-lg)",overflow:"hidden",animation:"fadeUp .25s ease"}}>
        <div style={{padding:"20px 24px",borderBottom:"1px solid var(--border)",background:"var(--red-bg)"}}>
          <div style={{fontSize:10,color:"var(--red)",fontWeight:700,letterSpacing:".1em",marginBottom:4}}>INTER-AGENCY COORDINATION</div>
          <div style={{fontFamily:"'DM Serif Display',Georgia,serif",fontWeight:700,fontSize:17,color:"var(--text-primary)"}}>Multi-Agency Dispatch</div>
          <div style={{fontSize:11,color:"var(--text-muted)",marginTop:3,fontFamily:"var(--font-mono)"}}>{complaint.ticketId}</div>
        </div>
        <div style={{padding:"20px 24px"}}>
          {done?(
            <div style={{textAlign:"center",padding:"20px 0"}}>
              <div style={{fontSize:44,marginBottom:10}}>✅</div>
              <div style={{fontFamily:"'DM Serif Display',Georgia,serif",fontWeight:700,fontSize:16,color:"var(--text-primary)"}}>Agencies Notified!</div>
              <div style={{fontSize:12,color:"var(--text-muted)",marginTop:6}}>{sel.map(s=>INTER_AGENCY.find(a=>a.id===s)?.label).join(", ")} dispatched</div>
            </div>
          ):(
            <>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
                {INTER_AGENCY.map(a=>{
                  const isSel=sel.includes(a.id);
                  return(
                    <button key={a.id} onClick={()=>toggle(a.id)} style={{display:"flex",alignItems:"center",gap:10,padding:"13px",borderRadius:"var(--radius-sm)",background:isSel?`${a.color}18`:"var(--surface2)",border:`1.5px solid ${isSel?a.color:"var(--border)"}`,cursor:"pointer",fontFamily:"var(--font)",transition:"var(--transition)"}}>
                      <span style={{fontSize:20}}>{a.icon}</span>
                      <div style={{flex:1,textAlign:"left"}}>
                        <div style={{fontSize:12.5,fontWeight:600,color:isSel?a.color:"var(--text-primary)"}}>{a.label}</div>
                        <div style={{fontSize:10,color:"var(--text-muted)"}}>☎ {a.hotline}</div>
                      </div>
                      {isSel&&<div style={{width:16,height:16,borderRadius:"50%",background:a.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,color:"#fff",fontWeight:800}}>✓</div>}
                    </button>
                  );
                })}
              </div>
              <textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="Dispatch note for all agencies…" rows={2} className="input" style={{marginBottom:14,resize:"vertical"}}/>
              {sel.length>0&&<div style={{padding:"8px 12px",background:"var(--red-bg)",borderRadius:"var(--radius-sm)",border:"1px solid var(--red-border)",marginBottom:14,fontSize:11,color:"var(--red)"}}>Will dispatch: {sel.map(s=>INTER_AGENCY.find(a=>a.id===s)?.label).join(", ")}</div>}
              <div style={{display:"flex",gap:10}}>
                <button onClick={onClose} className="btn btn-ghost" style={{flex:1}}>Cancel</button>
                <button onClick={doDispatch} disabled={sel.length===0} style={{flex:2,padding:"10px",borderRadius:"var(--radius-sm)",background:sel.length>0?"var(--red)":"var(--surface2)",border:"none",color:sel.length>0?"#fff":"var(--text3)",fontSize:13,fontWeight:600,cursor:sel.length>0?"pointer":"default",fontFamily:"var(--font)"}}>
                  🚨 Dispatch {sel.length||""} {sel.length===1?"Agency":"Agencies"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── CONTROL ROOM MAP ─────────────────────────────────────────────────────────
function ControlRoomMap({complaints,workers,clusters,onSelectComplaint}:{complaints:Complaint[];workers:Worker[];clusters:IncidentCluster[];onSelectComplaint:(c:Complaint)=>void}){
  const FALLBACK:[number,number]=[16.5062,80.6480];
  const valid=complaints.filter(c=>typeof c.lat==="number"&&typeof c.lng==="number"&&c.lat!==0);
  const center:[number,number]=valid.length>0?[valid[0].lat!,valid[0].lng!]:FALLBACK;
  const mkPin=(c:Complaint)=>{
    const col=c.emergency?"#ef4444":c.status==="Resolved"?"#10b981":(c.status==="Assigned"||c.status==="In Progress")?"#3b82f6":"#f97316";
    const blink=c.status==="Pending"&&!c.emergency,sz=c.emergency?34:c.clusterGroup?28:22;
    return L.divIcon({className:"",html:`<div style="position:relative;width:${sz}px;height:${sz}px;display:flex;align-items:center;justify-content:center;"><div style="position:absolute;width:100%;height:100%;border-radius:50%;background:${col};opacity:.18;${blink?"animation:crm-blink 1.2s ease-in-out infinite;":""}"></div><div style="position:absolute;width:${sz*.55}px;height:${sz*.55}px;border-radius:50%;background:#ffffff;border:2px solid ${col};box-shadow:0 0 10px ${col}66;"></div><div style="position:absolute;font-size:${c.emergency?9:7}px;">${c.emergency?"🚨":DEPT_ICON[c.department||""]||"📌"}</div></div>`,iconSize:[sz,sz],iconAnchor:[sz/2,sz/2],popupAnchor:[0,-sz/2]});
  };
  const mkWorker=(w:Worker)=>{
    const col=w.status==="available"?"#16A34A":w.status==="busy"?"#D97706":"#64748B";
    return L.divIcon({className:"",html:`<div style="position:relative;width:28px;height:28px;display:flex;align-items:center;justify-content:center;"><div style="position:absolute;width:100%;height:100%;border-radius:50%;background:${col};opacity:.15;${w.status==="busy"?"animation:crm-blink 2s ease-in-out infinite;":""}"></div><div style="position:absolute;width:18px;height:18px;border-radius:50%;background:${col};border:2px solid #fff;box-shadow:0 2px 8px ${col}88;"></div><div style="position:absolute;font-size:7px;font-weight:900;color:#fff;">${w.name.charAt(0)}</div></div>`,iconSize:[28,28],iconAnchor:[14,14]});
  };
  const mkCluster=(cl:IncidentCluster)=>L.divIcon({className:"",html:`<div style="position:relative;width:48px;height:48px;display:flex;align-items:center;justify-content:center;"><div style="position:absolute;width:100%;height:100%;border-radius:50%;background:#ef4444;opacity:.08;animation:crm-blink 0.8s ease-in-out infinite;"></div><div style="position:absolute;width:34px;height:34px;border-radius:50%;background:rgba(239,68,68,.85);border:2.5px solid rgba(255,255,255,.2);box-shadow:0 0 18px rgba(239,68,68,.6);display:flex;align-items:center;justify-content:center;flex-direction:column;gap:1px;"><span style="font-size:9px;color:#fff;font-weight:800;">${cl.complaintIds.length}</span><span style="font-size:8px;">🚨</span></div></div>`,iconSize:[48,48],iconAnchor:[24,24]});
  const activeEm=valid.filter(c=>c.emergency&&c.status!=="Resolved").length;
  const pendP=valid.filter(c=>c.status==="Pending").length;
  const inProg=valid.filter(c=>c.status==="Assigned"||c.status==="In Progress").length;
  return(
    <div style={{borderRadius:"var(--radius)",overflow:"hidden",position:"relative",height:500,border:"1px solid var(--border)"}}>
      <MapContainer center={center} zoom={14} scrollWheelZoom style={{height:"100%",width:"100%"}}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>
        {valid.map(c=><Marker key={c.id} position={[c.lat!,c.lng!]} icon={mkPin(c)} eventHandlers={{click:()=>onSelectComplaint(c)}}><Popup maxWidth={200}><div style={{padding:"2px 0",minWidth:160}}><div style={{fontWeight:600,fontSize:12,color:"var(--text-primary)",marginBottom:3}}>{c.title||c.category}</div>{c.department&&<div style={{fontSize:10.5,color:"var(--text-muted)"}}>{DEPT_ICON[c.department]} {c.department}</div>}{c.userName&&<div style={{fontSize:10.5,color:"var(--text-muted)"}}>👤 {c.userName}</div>}{c.assignedWorker&&<div style={{fontSize:10.5,color:"var(--green)",marginTop:2}}>🔧 {c.assignedWorker}</div>}</div></Popup></Marker>)}
        {workers.filter(w=>w.location.lat&&w.status!=="offline").map(w=><Marker key={w.id} position={[w.location.lat,w.location.lng]} icon={mkWorker(w)}><Popup maxWidth={160}><div><div style={{fontWeight:600,fontSize:12,color:"var(--text-primary)",marginBottom:3}}>{w.name}</div><div style={{fontSize:10.5,color:"var(--text-muted)"}}>{w.dept}</div><div style={{fontSize:10.5,color:w.status==="available"?"var(--green)":"var(--yellow)",marginTop:2}}>● {w.status}</div></div></Popup></Marker>)}
        {clusters.filter(cl=>!cl.dismissed).map(cl=><Marker key={cl.id} position={[cl.lat,cl.lng]} icon={mkCluster(cl)}><Popup maxWidth={180}><div><div style={{fontWeight:700,fontSize:12,color:"var(--red)",marginBottom:3}}>🚨 CLUSTER: {cl.complaintIds.length} incidents</div><div style={{fontSize:10.5,color:"var(--text-muted)"}}>{cl.area}</div></div></Popup></Marker>)}
      </MapContainer>
      <div style={{position:"absolute",top:10,left:10,zIndex:1000}}>
        <div style={{background:"rgba(255,255,255,.95)",backdropFilter:"blur(12px)",border:"1.5px solid var(--border2)",borderRadius:"var(--radius-sm)",padding:"10px 14px",minWidth:150,boxShadow:"var(--shadow)"}}>
          <div style={{fontSize:9,color:"var(--green)",fontWeight:700,letterSpacing:".1em",marginBottom:8,fontFamily:"'DM Serif Display',Georgia,serif"}}>LIVE FEED</div>
          {[{c:"var(--red)",l:"Emergency",v:activeEm},{c:"var(--orange)",l:"Pending",v:pendP},{c:"var(--blue)",l:"In Progress",v:inProg},{c:"var(--text3)",l:"Clusters",v:clusters.filter(cl=>!cl.dismissed).length}].map(s=>(
            <div key={s.l} style={{display:"flex",alignItems:"center",gap:7,marginBottom:5}}>
              <div style={{width:6,height:6,borderRadius:"50%",background:s.c,flexShrink:0}}/>
              <span style={{fontSize:10.5,color:"var(--text-secondary)",flex:1}}>{s.l}</span>
              <span style={{fontSize:12,fontWeight:700,color:s.c}}>{s.v}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{position:"absolute",bottom:10,right:10,zIndex:1000,background:"rgba(255,255,255,.95)",backdropFilter:"blur(12px)",border:"1.5px solid var(--border2)",borderRadius:"var(--radius-sm)",padding:"8px 12px",boxShadow:"var(--shadow)"}}>
        <div style={{fontSize:9,color:"var(--green)",fontWeight:700,marginBottom:6,fontFamily:"'DM Serif Display',Georgia,serif"}}>LEGEND</div>
        {[{c:"var(--red)",l:"Emergency"},{c:"var(--orange)",l:"Pending"},{c:"var(--blue)",l:"In Progress"},{c:"var(--green)",l:"Worker GPS"}].map(x=>(
          <div key={x.l} style={{display:"flex",gap:6,alignItems:"center",marginBottom:3}}><div style={{width:7,height:7,borderRadius:"50%",background:x.c}}/><span style={{fontSize:9.5,color:"var(--text-muted)"}}>{x.l}</span></div>
        ))}
      </div>
    </div>
  );
}

// ─── CLUSTER BANNER ───────────────────────────────────────────────────────────
function ClusterBanner({clusters,onDismiss,onViewAll}:{clusters:IncidentCluster[];onDismiss:(id:string)=>void;onViewAll:()=>void}){
  const active=clusters.filter(cl=>!cl.dismissed);
  if(active.length===0)return null;
  return(
    <div style={{background:"linear-gradient(135deg,rgba(239,68,68,.12),rgba(239,68,68,.06))",borderRadius:"var(--radius)",padding:"14px 18px",marginBottom:14,border:"1px solid var(--red-border)",animation:"fadeUp .3s ease"}}>
      <div style={{display:"flex",alignItems:"center",gap:12}}>
        <div style={{width:8,height:8,borderRadius:"50%",background:"var(--red)",animation:"pulse 1s infinite",flexShrink:0}}/>
        <div style={{flex:1}}>
          <div style={{fontSize:13,fontWeight:700,color:"var(--red)",fontFamily:"'DM Serif Display',Georgia,serif"}}>🚨 MASS INCIDENT DETECTED — {active.length} cluster{active.length!==1?"s":""}</div>
          <div style={{fontSize:11.5,color:"var(--text-muted)",marginTop:2}}>{active.map(cl=>`${cl.complaintIds.length} complaints in ${cl.area}`).join(" · ")}</div>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={onViewAll} className="btn btn-danger" style={{padding:"5px 12px",fontSize:11}}>View Map</button>
          <button onClick={()=>active.forEach(cl=>onDismiss(cl.id))} className="btn btn-ghost" style={{padding:"5px 10px",fontSize:11}}>Dismiss</button>
        </div>
      </div>
    </div>
  );
}

// ─── ETA BREACH PANEL ─────────────────────────────────────────────────────────
function EtaBreachPanel({breaches,onDismiss}:{breaches:EtaBreachAlert[];onDismiss:(id:string)=>void}){
  const active=breaches.filter(b=>!b.dismissed);
  if(active.length===0)return null;
  return(
    <div style={{background:"rgba(245,158,11,.06)",borderRadius:"var(--radius)",padding:"12px 16px",border:"1px solid rgba(245,158,11,.25)",marginBottom:14}}>
      <div style={{fontSize:10,fontWeight:700,color:"var(--yellow)",letterSpacing:".1em",marginBottom:8,fontFamily:"'DM Serif Display',Georgia,serif"}}>⏱ ML ETA BREACH — {active.length} at risk</div>
      {active.map(b=>(
        <div key={b.id} style={{display:"flex",alignItems:"center",gap:12,padding:"8px 10px",background:"rgba(245,158,11,.06)",borderRadius:"var(--radius-sm)",marginBottom:6,border:"1px solid rgba(245,158,11,.15)"}}>
          <span style={{fontSize:15}}>⚠️</span>
          <div style={{flex:1}}>
            <div style={{fontSize:12.5,fontWeight:600,color:"var(--yellow)",fontFamily:"var(--font-mono)"}}>{b.ticketId} · {b.workerName}</div>
            <div style={{fontSize:11,color:"var(--text-muted)",marginTop:2}}>Breach in <strong style={{color:"var(--yellow)"}}>{b.predictedBreachMins} min</strong> · {b.confidence}% confidence</div>
          </div>
          <button onClick={()=>onDismiss(b.id)} className="btn btn-ghost" style={{padding:"4px 8px",fontSize:10}}>✕</button>
        </div>
      ))}
    </div>
  );
}

// ─── AUTO ESCALATION PANEL ────────────────────────────────────────────────────
function AutoEscalationPanel({pendingEscalations,onManualAssign,onDismiss}:{pendingEscalations:Complaint[];onManualAssign:(c:Complaint)=>void;onDismiss:(id:string)=>void}){
  if(pendingEscalations.length===0)return null;
  return(
    <div style={{background:"var(--red-bg)",borderRadius:"var(--radius)",padding:"14px 18px",border:"1px solid var(--red-border)",marginBottom:14}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
        <div style={{width:30,height:30,borderRadius:9,background:"rgba(239,68,68,.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,animation:"pulse 1.5s infinite"}}>🚨</div>
        <div>
          <div style={{fontSize:12,fontWeight:700,color:"var(--red)",fontFamily:"'DM Serif Display',Georgia,serif"}}>AUTO-ESCALATION — {pendingEscalations.length} unassigned &gt;30s</div>
          <div style={{fontSize:10.5,color:"var(--text-muted)"}}>Manual intervention required</div>
        </div>
      </div>
      {pendingEscalations.slice(0,3).map(c=>(
        <div key={c.id} style={{display:"flex",alignItems:"center",gap:12,padding:"9px 12px",background:"rgba(239,68,68,.06)",borderRadius:"var(--radius-sm)",marginBottom:6,border:"1px solid var(--red-border)"}}>
          <span style={{fontSize:15}}>{DEPT_ICON[c.department||""]||"🏛️"}</span>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:12.5,fontWeight:600,color:"var(--text-primary)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{c.title||c.category||"Complaint"}</div>
            <div style={{fontSize:10.5,color:"var(--text-muted)",fontFamily:"var(--font-mono)"}}>{c.ticketId} · {Math.round((Date.now()-new Date(c.createdAt).getTime())/1000)}s ago</div>
          </div>
          <button onClick={()=>onManualAssign(c)} className="btn btn-danger" style={{padding:"5px 12px",fontSize:11,flexShrink:0}}>Assign</button>
          <button onClick={()=>onDismiss(c.id)} className="btn btn-ghost" style={{padding:"5px 8px",fontSize:10}}>✕</button>
        </div>
      ))}
    </div>
  );
}

// ─── COMPLAINT DETAIL MODAL ───────────────────────────────────────────────────
function ComplaintDetailModal({c,dept,officerName,workers,onSave,onClose}:{c:Complaint;dept:string;officerName:string;workers:Worker[];onSave:(u:Complaint)=>void;onClose:()=>void}){
  const[tab,setTab]=useState<"overview"|"map"|"messages"|"timeline">("overview");
  const[status,setStatus]=useState(c.status);
  const[note,setNote]=useState(c.officerNote||"");
  const[escalReason,setEscalReason]=useState("");
  const[msgText,setMsgText]=useState("");
  const[messages,setMessages]=useState<Message[]>(()=>{
    // Load from localStorage where worker saved messages
    let lsMsgs:Message[]=[];
    try{ lsMsgs=JSON.parse(localStorage.getItem(`chat_${c.ticketId}`)||"[]"); }catch{}
    const combined=[...(c.messages||[]),...lsMsgs];
    const seen=new Set<string>();
    return combined.filter(m=>{ if(seen.has(m.id))return false; seen.add(m.id); return true; });
  });
  const[showAssign,setShowAssign]=useState(false);
  const[showVideo,setShowVideo]=useState(false);
  const[showIA,setShowIA]=useState(false);
  const[wNote,setWNote]=useState("");
  const[wProg,setWProg]=useState(0);
  const dc=DEPT_COLOR[c.department||""]||"var(--green)";
  const msgEnd=useRef<HTMLDivElement>(null);
  useEffect(()=>{msgEnd.current?.scrollIntoView({behavior:"smooth"});},[messages]);
  const save=()=>{
    const tl:TimelineEvent[]=[...(c.timeline||[])];
    if(status!==c.status)tl.push({id:`tl-${Date.now()}`,event:`Status → ${status}`,actor:officerName,time:new Date().toISOString(),icon:"🔄",color:"var(--blue)"});
    if(note&&note!==c.officerNote)tl.push({id:`tl-n-${Date.now()}`,event:"Note added",note,actor:officerName,time:new Date().toISOString(),icon:"📝",color:"var(--purple)"});
    onSave({...c,status,officerNote:note||c.officerNote,assignedOfficer:officerName,updatedAt:new Date().toISOString(),messages,timeline:tl});
    onClose();
  };
  const sendMsg=(type:"officer-citizen"|"officer-worker")=>{
    if(!msgText.trim())return;
    const m:Message={id:genId(),from:officerName,to:type==="officer-citizen"?c.userName||"Citizen":c.assignedWorker||"Worker",text:msgText,time:new Date().toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"}),read:false,type};
    setMessages(p=>{
      const updated=[...p,m];
      // Save to localStorage so worker can see officer messages
      try{ localStorage.setItem(`chat_${c.ticketId}`,JSON.stringify(updated)); }catch{}
      return updated;
    });
    setMsgText("");
  };
  const addWU=()=>{
    if(!wNote.trim())return;
    const wu:WorkerUpdate={id:`wu-${Date.now()}`,note:wNote,worker:c.assignedWorker||officerName,time:new Date().toISOString(),progress:wProg};
    onSave({...c,workerUpdates:[...(c.workerUpdates||[]),wu],messages});setWNote("");
  };
  const handleIA=(agencies:string[])=>{
    onSave({...c,interAgencyDispatched:agencies,timeline:[...(c.timeline||[]),{id:`tl-ia-${Date.now()}`,event:`Multi-agency: ${agencies.join(", ")}`,actor:officerName,time:new Date().toISOString(),icon:"🚨",color:"var(--red)"}]});
    setShowIA(false);
  };
  const TABS=["overview","map","messages","timeline"] as const;
  const TLABELS=["Overview","Map","Messages","Timeline"];
  return(
    <>
    {showVideo&&<VideoCallModal complaint={c} officerName={officerName} onClose={()=>setShowVideo(false)}/>}
    {showIA&&<InterAgencyModal complaint={c} onDispatch={handleIA} onClose={()=>setShowIA(false)}/>}
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.7)",zIndex:999,display:"flex",alignItems:"stretch",justifyContent:"flex-end",backdropFilter:"blur(4px)"}} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div style={{width:"min(720px,100vw)",background:"var(--bg2)",borderLeft:"1px solid var(--border)",height:"100vh",overflowY:"auto",display:"flex",flexDirection:"column",paddingTop:60,animation:"slideIn .25s ease"}}>
        {/* Header */}
        <div style={{padding:"20px 22px",borderBottom:"1px solid var(--border)",flexShrink:0}}>
          <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12,marginBottom:10}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:8}}>
                <Badge status={c.status}/>
                {c.emergency&&<Pill color="red">🚨 EMERGENCY</Pill>}
                {c.escalated&&<Pill color="purple">↑ Escalated</Pill>}
                {c.aiRouted&&<Pill color="purple">🤖 AI Routed</Pill>}
                {c.etaBreachPredicted&&<Pill color="yellow">⏱ ETA Risk</Pill>}
                {c.interAgencyDispatched&&c.interAgencyDispatched.length>0&&<Pill color="red">🚔 Multi-Agency</Pill>}
                {c.clusterGroup&&<Pill color="red">🚨 Cluster</Pill>}
                {c.ticketId&&<span style={{fontSize:10,color:"var(--text-muted)",fontFamily:"var(--font-mono)",background:"var(--bg-card)",padding:"2px 8px",borderRadius:6,border:"1px solid var(--border)"}}>{c.ticketId}</span>}
              </div>
              <h2 style={{fontSize:16,fontWeight:700,color:"var(--text-primary)",fontFamily:"'DM Serif Display',Georgia,serif",lineHeight:1.3}}>{c.title||c.category||"Complaint"}</h2>
              <div style={{display:"flex",gap:10,marginTop:5,flexWrap:"wrap",fontSize:11.5,color:"var(--text-muted)"}}>
                <span style={{color:dc,fontWeight:600}}>{DEPT_ICON[c.department||""]} {c.department}</span>
                {c.userName&&<span>👤 {c.userName}</span>}
                {c.address&&<span>📍 {c.address.slice(0,40)}{c.address.length>40?"…":""}</span>}
              </div>
            </div>
            <button onClick={onClose} style={{width:32,height:32,borderRadius:"50%",background:"var(--bg-card-alt)",border:"1px solid var(--border)",fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:"var(--text-secondary)",flexShrink:0}}>✕</button>
          </div>
          <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
            <button onClick={()=>setShowVideo(true)} className="btn btn-ghost" style={{fontSize:11.5}}>📹 Video Call</button>
            <button onClick={()=>setShowIA(true)} className="btn btn-danger" style={{fontSize:11.5}}>🚔 Multi-Agency</button>
          </div>
          <div style={{display:"flex",gap:2,background:"var(--bg-card)",borderRadius:"var(--radius-sm)",padding:3,width:"fit-content"}}>
            {TABS.map((t,i)=>(
              <button key={t} onClick={()=>setTab(t)} style={{padding:"6px 13px",borderRadius:6,fontSize:12,fontWeight:tab===t?600:400,color:tab===t?"var(--text)":"var(--text3)",background:tab===t?"var(--surface2)":"transparent",border:`1px solid ${tab===t?"var(--border2)":"transparent"}`,cursor:"pointer",fontFamily:"var(--font)",transition:"var(--transition)"}}>{TLABELS[i]}</button>
            ))}
          </div>
        </div>

        <div style={{flex:1,overflowY:"auto",padding:"18px 22px"}}>
          {tab==="overview"&&(
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              {c.description&&<div style={{padding:"12px 14px",background:"var(--bg-card)",borderRadius:"var(--radius-sm)",border:"1px solid var(--border)"}}><div style={{fontSize:10,color:"var(--text-muted)",fontWeight:600,letterSpacing:".08em",marginBottom:6}}>DESCRIPTION</div><div style={{fontSize:13,color:"var(--text-secondary)",lineHeight:1.7}}>{c.description}</div></div>}
              {c.image&&<img src={c.image} alt="Evidence" style={{width:"100%",maxHeight:200,objectFit:"cover",borderRadius:"var(--radius-sm)",border:"1px solid var(--border)"}}/>}
              {c.aiRouted&&c.aiRoutingReason&&<div style={{padding:"10px 14px",background:"var(--purple-bg)",borderRadius:"var(--radius-sm)",border:"1px solid rgba(139,92,246,.25)",display:"flex",gap:10,alignItems:"center"}}><span style={{fontSize:16}}>🤖</span><div><div style={{fontSize:10,color:"var(--purple)",fontWeight:700,letterSpacing:".08em"}}>AI ROUTED</div><div style={{fontSize:12,color:"var(--text-secondary)"}}>{c.aiRoutingReason}</div></div></div>}
              {c.interAgencyDispatched&&c.interAgencyDispatched.length>0&&<div style={{padding:"10px 14px",background:"var(--red-bg)",borderRadius:"var(--radius-sm)",border:"1px solid var(--red-border)"}}><div style={{fontSize:10,color:"var(--red)",fontWeight:700,letterSpacing:".08em",marginBottom:6}}>MULTI-AGENCY ACTIVE</div><div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{c.interAgencyDispatched.map(id=>{const a=INTER_AGENCY.find(x=>x.id===id);return a?<span key={id} className="tag" style={{background:`${a.color}18`,color:a.color,border:`1px solid ${a.color}30`}}>{a.icon} {a.label}</span>:null;})}</div></div>}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <div style={{padding:"12px 14px",background:"var(--bg-card)",borderRadius:"var(--radius-sm)",border:"1px solid var(--border)"}}><div style={{fontSize:10,color:"var(--text-muted)",fontWeight:600,letterSpacing:".08em",marginBottom:6}}>PRIORITY</div><PBadge p={c.priority||"Medium"}/><div style={{fontSize:11,color:"var(--text-muted)",marginTop:4,fontFamily:"var(--font-mono)"}}>Score: {c.aiPriority||"—"}/100</div></div>
                <div style={{padding:"12px 14px",background:c.assignedWorker?"rgba(16,185,129,.06)":"var(--surface)",borderRadius:"var(--radius-sm)",border:`1px solid ${c.assignedWorker?"var(--green-border)":"var(--border)"}`}}><div style={{fontSize:10,color:"var(--text-muted)",fontWeight:600,letterSpacing:".08em",marginBottom:6}}>WORKER</div>{c.assignedWorker?<div style={{fontSize:13,fontWeight:600,color:"var(--green)"}}>🔧 {c.assignedWorker}</div>:<div style={{fontSize:12,color:"var(--text-muted)"}}>Not assigned</div>}</div>
              </div>
              <div><div style={{fontSize:11,fontWeight:600,color:"var(--text-secondary)",marginBottom:8}}>UPDATE STATUS</div><div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{["Pending","Assigned","In Progress","Resolved"].map(s=><button key={s} onClick={()=>setStatus(s)} style={{padding:"7px 14px",borderRadius:"var(--radius-sm)",fontSize:12,fontWeight:500,border:`1.5px solid ${status===s?dc:"var(--border)"}`,background:status===s?`${dc}20`:"var(--surface2)",color:status===s?dc:"var(--text2)",cursor:"pointer",fontFamily:"var(--font)",transition:"var(--transition)"}}>{s}</button>)}</div></div>
              <div><div style={{fontSize:11,fontWeight:600,color:"var(--text-secondary)",marginBottom:6}}>OFFICER NOTE</div><textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="Add investigation notes…" rows={3} className="input" style={{resize:"vertical"}}/></div>
              {c.workerUpdates&&c.workerUpdates.length>0&&(
                <div>
                  <div style={{fontSize:11,fontWeight:600,color:"var(--text-secondary)",marginBottom:8}}>WORKER UPDATES</div>
                  {c.workerUpdates.map(wu=>(
                    <div key={wu.id} style={{padding:"10px 12px",background:"var(--blue-bg)",borderRadius:"var(--radius-sm)",border:"1px solid rgba(59,130,246,.2)",marginBottom:6}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{fontSize:12,fontWeight:600,color:"var(--blue)"}}>{wu.worker}</span><span style={{fontSize:10,color:"var(--text-muted)",fontFamily:"var(--font-mono)"}}>{new Date(wu.time).toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"})}</span></div>
                      <div style={{fontSize:12.5,color:"var(--text-secondary)"}}>{wu.note}</div>
                      {wu.progress!==undefined&&<div style={{marginTop:6}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{fontSize:10,color:"var(--blue)"}}>Progress</span><span style={{fontSize:10,fontWeight:700,color:"var(--blue)"}}>{wu.progress}%</span></div><div style={{height:4,background:"var(--bg-card)",borderRadius:3}}><div style={{height:"100%",width:`${wu.progress}%`,background:"var(--blue)",borderRadius:3}}/></div></div>}
                    </div>
                  ))}
                  <div style={{display:"flex",gap:8,marginTop:8}}>
                    <input value={wNote} onChange={e=>setWNote(e.target.value)} placeholder="Add update…" className="input" style={{flex:1}}/>
                    <input type="number" min="0" max="100" value={wProg} onChange={e=>setWProg(Number(e.target.value))} className="input" style={{width:60,textAlign:"center"}}/>
                    <button onClick={addWU} className="btn btn-primary">Add</button>
                  </div>
                </div>
              )}
              {!c.escalated&&<div style={{padding:"12px 14px",background:"var(--red-bg)",borderRadius:"var(--radius-sm)",border:"1px solid var(--red-border)"}}><div style={{fontSize:11,fontWeight:600,color:"var(--red)",marginBottom:8}}>ESCALATE TO HQ</div><textarea value={escalReason} onChange={e=>setEscalReason(e.target.value)} placeholder="Reason for escalation…" rows={2} className="input" style={{marginBottom:8,resize:"vertical"}}/><button onClick={()=>{if(escalReason.trim()){onSave({...c,escalated:true,escalationReason:escalReason});onClose();}}} disabled={!escalReason.trim()} className="btn btn-danger" style={{opacity:escalReason.trim()?1:.5}}>Escalate</button></div>}
              {c.escalated&&<div style={{padding:"10px 14px",background:"var(--purple-bg)",borderRadius:"var(--radius-sm)",border:"1px solid rgba(139,92,246,.25)"}}><div style={{fontSize:10,color:"var(--purple)",fontWeight:700,marginBottom:3}}>↑ ESCALATED</div><div style={{fontSize:12.5,color:"var(--text-secondary)"}}>{c.escalationReason}</div></div>}
            </div>
          )}
          {tab==="map"&&(
            <div>
              {c.lat&&c.lng?<div style={{borderRadius:"var(--radius-sm)",overflow:"hidden",height:320,border:"1px solid var(--border)"}}><MapContainer center={[c.lat,c.lng]} zoom={15} scrollWheelZoom style={{height:"100%",width:"100%"}}><TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/><Circle center={[c.lat,c.lng]} radius={200} pathOptions={{color:dc,fillColor:dc,fillOpacity:.08,weight:1.5}}/><Marker position={[c.lat,c.lng]}><Popup>{c.title||c.category}</Popup></Marker></MapContainer></div>:<div style={{textAlign:"center",padding:"60px",background:"var(--bg-card)",borderRadius:"var(--radius-sm)",border:"1px solid var(--border)"}}><div style={{fontSize:32,marginBottom:8}}>🗺</div><div style={{color:"var(--text-muted)"}}>No GPS data</div></div>}
              {c.lat&&c.lng&&<div style={{marginTop:10,padding:"10px 14px",background:"var(--bg-card)",borderRadius:"var(--radius-sm)",border:"1px solid var(--border)",display:"flex",gap:10,alignItems:"center"}}><span style={{fontSize:12.5,color:"var(--text-secondary)"}}>📍 {c.address||"Captured"}</span><a href={`https://maps.google.com/?q=${c.lat},${c.lng}`} target="_blank" rel="noreferrer" style={{fontSize:12,color:"var(--blue)",fontWeight:600,textDecoration:"none",marginLeft:"auto"}}>Google Maps →</a></div>}
            </div>
          )}
          {tab==="messages"&&(
            <div style={{display:"flex",flexDirection:"column",minHeight:400}}>
              <div style={{flex:1,display:"flex",flexDirection:"column",gap:8,marginBottom:12}}>
                {messages.length===0&&<div style={{textAlign:"center",padding:"40px",color:"var(--text-muted)"}}><div style={{fontSize:28,marginBottom:6}}>💬</div><div style={{fontWeight:600}}>No messages yet</div><div style={{fontSize:12,marginTop:4}}>Messages from the worker will appear here once they chat via their dashboard</div></div>}
                {messages.map(m=>(
                  <div key={m.id} style={{display:"flex",flexDirection:m.from===officerName?"row-reverse":"row",gap:8,alignItems:"flex-end"}}>
                    <div style={{width:26,height:26,borderRadius:"50%",background:"var(--bg-card-alt)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,flexShrink:0}}>{m.from===officerName?"👮":m.type==="officer-citizen"?"👤":"🔧"}</div>
                    <div style={{maxWidth:"75%",padding:"9px 13px",borderRadius:m.from===officerName?"12px 12px 3px 12px":"12px 12px 12px 3px",background:m.from===officerName?"var(--green-bg)":"var(--surface2)",border:`1px solid ${m.from===officerName?"var(--green-border)":"var(--border)"}`,fontSize:12.5,lineHeight:1.5,color:"var(--text-primary)"}}>
                      <div style={{fontSize:9.5,color:"var(--text-muted)",marginBottom:3}}>{m.from} → {m.to}</div>
                      {m.text}
                      <div style={{fontSize:9.5,color:"var(--text-muted)",marginTop:3,fontFamily:"var(--font-mono)"}}>{m.time}</div>
                    </div>
                  </div>
                ))}
                <div ref={msgEnd}/>
              </div>
              <div style={{display:"flex",gap:8,paddingTop:12,borderTop:"1px solid var(--border)"}}>
                <input value={msgText} onChange={e=>setMsgText(e.target.value)} onKeyDown={e=>e.key==="Enter"&&sendMsg("officer-worker")} placeholder="Type message…" className="input"/>
                <button onClick={()=>sendMsg("officer-worker")} className="btn btn-primary" style={{flexShrink:0}}>→ Worker</button>
                <button onClick={()=>sendMsg("officer-citizen")} className="btn btn-ghost" style={{flexShrink:0}}>→ Citizen</button>
              </div>
            </div>
          )}
          {tab==="timeline"&&(
            <div>
              {c.timeline&&c.timeline.length>0?c.timeline.map((ev,i)=>(
                <div key={ev.id} style={{display:"flex",alignItems:"flex-start",gap:12,marginBottom:i<c.timeline!.length-1?0:0}}>
                  <div style={{display:"flex",flexDirection:"column",alignItems:"center"}}>
                    <div style={{width:28,height:28,borderRadius:"50%",background:`${ev.color}18`,border:`1.5px solid ${ev.color}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,flexShrink:0}}>{ev.icon}</div>
                    {i<c.timeline!.length-1&&<div style={{width:1,height:20,background:"var(--border)",margin:"3px 0"}}/>}
                  </div>
                  <div style={{paddingTop:4,paddingBottom:i<c.timeline!.length-1?18:0,flex:1}}>
                    <div style={{fontSize:13,fontWeight:500,color:"var(--text-primary)"}}>{ev.event}</div>
                    {ev.note&&<div style={{fontSize:11.5,color:"var(--text-muted)",marginTop:1}}>{ev.note}</div>}
                    <div style={{fontSize:10,color:"var(--text-muted)",marginTop:2,fontFamily:"var(--font-mono)"}}>{ev.actor} · {new Date(ev.time).toLocaleString("en-IN",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"})}</div>
                  </div>
                </div>
              )):<div style={{textAlign:"center",padding:"40px",color:"var(--text-muted)"}}><div style={{fontSize:28,marginBottom:6}}>📅</div>No events yet</div>}
            </div>
          )}
        </div>

        <div style={{padding:"14px 22px",borderTop:"1px solid var(--border)",display:"flex",gap:10,flexShrink:0}}>
          <button onClick={()=>setShowAssign(true)} className="btn btn-primary" style={{flex:1}}>🔧 {c.assignedWorker?"Reassign":"Assign"} Worker</button>
          <button onClick={save} style={{flex:2,padding:"9px",borderRadius:"var(--radius-sm)",background:dc,border:"none",color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"var(--font)"}}>💾 Save Changes</button>
        </div>
      </div>
    </div>
    {showAssign&&<WorkerAssignModal complaint={c} dept={dept} workers={workers} onClose={()=>setShowAssign(false)} onAssign={async w=>{
  await assignWorkerBackend(c.id, w.id, `Assigned by ${officerName}`);
  onSave({...c,assignedWorker:w.name,status:"Assigned",assignedOfficer:officerName});
  setShowAssign(false);
}}/>}
    </>
  );
}

// ─── COMPLAINT HEATMAP ────────────────────────────────────────────────────────
function ComplaintHeatmap({complaints}:{complaints:Complaint[]}){
  const[filter,setFilter]=useState<"all"|"pending"|"emergency">("all");
  const valid=complaints.filter(c=>typeof c.lat==="number"&&typeof c.lng==="number"&&!isNaN(c.lat)&&c.lat!==0);
  const shown=filter==="pending"?valid.filter(c=>c.status!=="Resolved"):filter==="emergency"?valid.filter(c=>c.emergency):valid;
  const center:[number,number]=shown.length>0?[shown[0].lat!,shown[0].lng!]:[16.5062,80.6480];
  const cells=useMemo(()=>{
    const g:Record<string,{lat:number;lng:number;count:number;emergency:number}>={};
    shown.forEach(c=>{const k=`${(c.lat!*10).toFixed(0)}_${(c.lng!*10).toFixed(0)}`;if(!g[k])g[k]={lat:c.lat!,lng:c.lng!,count:0,emergency:0};g[k].count++;if(c.emergency)g[k].emergency++;});
    return Object.values(g);
  },[shown]);
  const deptAreas=useMemo(()=>{const m:Record<string,{dept:string;count:number;lat:number;lng:number}>={};valid.forEach(c=>{const d=c.department||"General";if(!m[d]){m[d]={dept:d,count:0,lat:c.lat!,lng:c.lng!};}m[d].count++;});return Object.values(m).filter(x=>x.count>0);},[valid]);
  const mkIcon=(cell:{count:number;emergency:number})=>{
    const i=Math.min(1,cell.count/5),col=cell.emergency>0?"#ef4444":cell.count>=4?"#f97316":cell.count>=2?"#f59e0b":"#3b82f6",sz=Math.max(22,Math.min(50,16+cell.count*8));
    return L.divIcon({className:"",html:`<div style="position:relative;width:${sz}px;height:${sz}px;display:flex;align-items:center;justify-content:center;"><div style="position:absolute;width:100%;height:100%;border-radius:50%;background:${col};opacity:${0.1+i*0.28};animation:hm-pulse ${1.5+i}s ease-in-out infinite;"></div><div style="position:absolute;width:${sz*.5}px;height:${sz*.5}px;border-radius:50%;background:${col};opacity:${0.45+i*.4};"></div><div style="position:absolute;font-size:${sz>34?10:8}px;font-weight:800;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.6);">${cell.count}</div></div>`,iconSize:[sz,sz],iconAnchor:[sz/2,sz/2]});
  };
  return(
    <div style={{padding:20}}>
      <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap",alignItems:"center"}}>
        {[["all","All"],["pending","Active"],["emergency","Emergency"]].map(([f,l])=>(
          <button key={f} onClick={()=>setFilter(f as any)} className="btn btn-ghost" style={{background:filter===f?"var(--green-bg)":"transparent",color:filter===f?"var(--green)":"var(--text3)",borderColor:filter===f?"var(--green-border)":"var(--border)",fontSize:11.5}}>
            {l}{filter===f?` (${shown.length})` :""}
          </button>
        ))}
        <div style={{marginLeft:"auto",display:"flex",gap:10}}>{[{c:"var(--red)",l:"Emergency"},{c:"var(--orange)",l:"Hotspot"},{c:"var(--yellow)",l:"Medium"},{c:"var(--blue)",l:"Low"}].map(x=><div key={x.l} style={{display:"flex",gap:5,alignItems:"center"}}><div style={{width:8,height:8,borderRadius:"50%",background:x.c}}/><span style={{fontSize:10,color:"var(--text-muted)"}}>{x.l}</span></div>)}</div>
      </div>
      <div style={{borderRadius:"var(--radius)",overflow:"hidden",height:420,border:"1px solid var(--border)",position:"relative"}}>
        <MapContainer center={center} zoom={13} scrollWheelZoom style={{height:"100%",width:"100%"}}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>
          {cells.map((cell,i)=><Marker key={i} position={[cell.lat,cell.lng]} icon={mkIcon(cell)}><Popup maxWidth={160}><div><strong style={{fontSize:12,color:"var(--text-primary)"}}>{cell.count} complaint{cell.count!==1?"s":""}</strong>{cell.emergency>0&&<div style={{color:"var(--red)",fontWeight:700,fontSize:11,marginTop:2}}>🚨 {cell.emergency} emergency</div>}</div></Popup></Marker>)}
        </MapContainer>
        <div style={{position:"absolute",top:10,right:10,zIndex:1000,background:"rgba(255,255,255,.96)",backdropFilter:"blur(12px)",border:"1.5px solid var(--border2)",borderRadius:"var(--radius-sm)",padding:"12px 14px",minWidth:150,boxShadow:"var(--shadow)"}}>
          <div style={{fontSize:9,color:"var(--green)",fontWeight:700,marginBottom:8,fontFamily:"'DM Serif Display',Georgia,serif",letterSpacing:".1em"}}>STATS</div>
          {[{l:"Total",v:shown.length,c:"var(--blue)"},{l:"Hotspots",v:cells.filter(c=>c.count>=3).length,c:"var(--orange)"},{l:"Emergency",v:shown.filter(c=>c.emergency).length,c:"var(--red)"},{l:"Departments",v:deptAreas.length,c:"var(--purple)"}].map(s=>(
            <div key={s.l} style={{display:"flex",justifyContent:"space-between",marginBottom:5}}><span style={{fontSize:11,color:"var(--text-muted)"}}>{s.l}</span><span style={{fontSize:13,fontWeight:700,color:s.c}}>{s.v}</span></div>
          ))}
        </div>
      </div>
      {deptAreas.length>0&&<div style={{marginTop:14,display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:10}}>
        {deptAreas.sort((a,b)=>b.count-a.count).slice(0,6).map(d=>(
          <div key={d.dept} style={{padding:"12px 14px",background:"var(--bg-card)",borderRadius:"var(--radius-sm)",border:"1px solid var(--border)"}}>
            <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:5}}><span style={{fontSize:15}}>{DEPT_ICON[d.dept]||"🏛️"}</span><span style={{fontSize:11,fontWeight:600,color:DEPT_COLOR[d.dept]||"var(--text3)"}}>{d.dept.split(" ")[0]}</span></div>
            <div style={{fontFamily:"'DM Serif Display',Georgia,serif",fontSize:24,fontWeight:800,color:"var(--text-primary)",lineHeight:1}}>{d.count}</div>
            <div style={{height:3,background:"var(--bg-card-alt)",borderRadius:2,marginTop:6,overflow:"hidden"}}><div style={{height:"100%",width:`${Math.min(100,(d.count/Math.max(...deptAreas.map(x=>x.count)))*100)}%`,background:DEPT_COLOR[d.dept]||"var(--text3)",borderRadius:2}}/></div>
          </div>
        ))}
      </div>}
    </div>
  );
}

// ─── WORKERS PANEL ────────────────────────────────────────────────────────────
function WorkersPanel({dept,complaints,workers}:{dept:string;complaints:Complaint[];workers:Worker[]}){
  // Show all workers, not just the officer's department
  const dw=workers.length>0?workers:[];
  const[sel,setSel]=useState<Worker|null>(null);
  const wc=(w:Worker)=>complaints.filter(c=>c.assignedWorker===w.name);
  return(
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:14}}>
      {dw.map(w=>{
        const wcc=wc(w),active=wcc.filter(c=>c.status!=="Resolved").length,sc=w.status==="available"?"var(--green)":w.status==="busy"?"var(--yellow)":"var(--text3)",lp=(w.currentLoad/w.maxLoad)*100;
        return(
          <div key={w.id} onClick={()=>setSel(sel?.id===w.id?null:w)} style={{background:"var(--bg-card)",borderRadius:"var(--radius)",padding:18,border:`1px solid ${sel?.id===w.id?"var(--green-border)":"var(--border)"}`,cursor:"pointer",transition:"var(--transition)"}}>
            <div style={{display:"flex",alignItems:"flex-start",gap:12,marginBottom:14}}>
              <div style={{width:42,height:42,borderRadius:12,background:"var(--bg-card-alt)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:19,flexShrink:0,position:"relative"}}>
                {DEPT_ICON[dept]||"🔧"}
                <div style={{position:"absolute",bottom:-2,right:-2,width:12,height:12,borderRadius:"50%",background:sc,border:"2px solid var(--surface)"}}/>
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:14,fontWeight:600,color:"var(--text-primary)",fontFamily:"'DM Serif Display',Georgia,serif"}}>{w.name}</div>
                <div style={{fontSize:11,color:"var(--text-muted)",marginTop:1}}>{w.location.area}</div>
              </div>
              <div style={{fontFamily:"'DM Serif Display',Georgia,serif",fontSize:16,fontWeight:700,color:w.rating>=4.7?"var(--green)":w.rating>=4?"var(--yellow)":"var(--red)"}}>{w.rating}★</div>
            </div>
            <div style={{marginBottom:12}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}><span style={{fontSize:10.5,color:"var(--text-muted)",fontWeight:500}}>Load</span><span style={{fontSize:10.5,fontWeight:600,color:lp>=80?"var(--red)":lp>=50?"var(--yellow)":"var(--green)"}}>{w.currentLoad}/{w.maxLoad}</span></div>
              <div style={{height:4,background:"var(--bg-card-alt)",borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:`${lp}%`,background:lp>=80?"var(--red)":lp>=50?"var(--yellow)":"var(--green)",borderRadius:3,transition:"width .5s ease"}}/></div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginBottom:10}}>
              {[{l:"Active",v:active,c:"var(--blue)"},{l:"Done",v:w.completedToday,c:"var(--green)"},{l:"Avg",v:`${w.avgResolutionHrs}h`,c:"var(--purple)"}].map(s=>(
                <div key={s.l} style={{textAlign:"center",padding:"5px 3px",background:"var(--bg-card-alt)",borderRadius:7}}>
                  <div style={{fontFamily:"'DM Serif Display',Georgia,serif",fontSize:14,fontWeight:700,color:s.c}}>{s.v}</div>
                  <div style={{fontSize:9,color:"var(--text-muted)"}}>{s.l}</div>
                </div>
              ))}
            </div>
            <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
              {w.skills.slice(0,3).map(s=><span key={s} className="tag" style={{fontSize:9,background:"var(--bg-card-alt)",color:"var(--text-muted)",border:"1px solid var(--border)"}}>{s}</span>)}
            </div>
            {sel?.id===w.id&&(
              <div style={{marginTop:12,paddingTop:12,borderTop:"1px solid var(--border)"}}>
                <a href={`tel:${w.phone}`} style={{display:"flex",alignItems:"center",gap:8,fontSize:12.5,color:"var(--blue)",textDecoration:"none",fontWeight:500}}>📞 {w.phone}</a>
                {wcc.slice(0,2).map(c=><div key={c.id} style={{marginTop:4,fontSize:11.5,color:"var(--text-secondary)",padding:"4px 8px",background:"var(--bg-card-alt)",borderRadius:6,border:"1px solid var(--border)"}}>{c.title||c.category} · {c.status}</div>)}
              </div>
            )}
          </div>
        );
      })}
      {dw.length===0&&<div style={{gridColumn:"1/-1",textAlign:"center",padding:"40px",color:"var(--text-muted)"}}><div style={{fontSize:32,marginBottom:8}}>👷</div><div>No workers in {dept}</div></div>}
    </div>
  );
}

// ─── MESSAGES PANEL ───────────────────────────────────────────────────────────
function MessagesPanel({complaints,officerName}:{complaints:Complaint[];officerName:string}){
  // Read messages from localStorage chat keys (worker saves to chat_${ticketId})
  const allMsgs=useMemo(()=>{
    const out:Array<{msg:Message;complaint:Complaint}>=[];
    complaints.forEach(c=>{
      // Read from localStorage where worker/citizen saved messages
      const key=`chat_${c.ticketId}`;
      let lsMsgs:Message[]=[];
      try{ lsMsgs=JSON.parse(localStorage.getItem(key)||"[]"); }catch{}
      // Also include messages stored on complaint object itself
      const combined=[...(c.messages||[]),...lsMsgs];
      // Deduplicate by id
      const seen=new Set<string>();
      combined.forEach(m=>{
        if(!seen.has(m.id)){seen.add(m.id);out.push({msg:m,complaint:c});}
      });
    });
    return out.sort((a,b)=>new Date(b.msg.time).getTime()-new Date(a.msg.time).getTime()||b.msg.time.localeCompare(a.msg.time));
  },[complaints]);
  const[tab,setTab]=useState<"all"|"citizen"|"worker">("all");
  const cq=allMsgs.filter(x=>x.msg.type==="officer-citizen"),wu=allMsgs.filter(x=>x.msg.type==="officer-worker");
  const shown=tab==="citizen"?cq:tab==="worker"?wu:allMsgs;
  return(
    <div>
      <div style={{display:"flex",gap:6,marginBottom:16,background:"var(--bg-card)",borderRadius:"var(--radius-sm)",padding:4,width:"fit-content"}}>
        {[["all","All"],["citizen","👤 Citizens"],["worker","🔧 Workers"]].map(([t,l])=>(
          <button key={t} onClick={()=>setTab(t as any)} style={{padding:"6px 14px",borderRadius:6,fontSize:12,fontWeight:tab===t?600:400,color:tab===t?"var(--text)":"var(--text3)",background:tab===t?"var(--surface2)":"transparent",border:`1px solid ${tab===t?"var(--border2)":"transparent"}`,cursor:"pointer",fontFamily:"var(--font)",transition:"var(--transition)"}}>
            {l} ({(t==="all"?allMsgs:t==="citizen"?cq:wu).length})
          </button>
        ))}
      </div>
      {shown.length===0?<div style={{textAlign:"center",padding:"60px",background:"var(--bg-card)",borderRadius:"var(--radius)",border:"1px solid var(--border)"}}><div style={{fontSize:36,marginBottom:8}}>💬</div><div style={{color:"var(--text-muted)"}}>No messages yet</div></div>:
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {shown.map(({msg,complaint},i)=>(
          <div key={i} style={{background:"var(--bg-card)",borderRadius:"var(--radius)",padding:"14px 16px",border:"1px solid var(--border)"}}>
            <div style={{display:"flex",alignItems:"flex-start",gap:12}}>
              <div style={{width:34,height:34,borderRadius:"50%",background:"var(--bg-card-alt)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,flexShrink:0}}>{msg.from===officerName?"👮":msg.type==="officer-citizen"?"👤":"🔧"}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                  <div style={{fontSize:12.5,fontWeight:600,color:"var(--text-primary)"}}>{msg.from} → {msg.to}</div>
                  <div style={{display:"flex",gap:8,alignItems:"center"}}>
                    <Pill color={msg.type==="officer-citizen"?"blue":"green"}>{msg.type==="officer-citizen"?"Citizen":"Worker"}</Pill>
                    <span style={{fontSize:9.5,color:"var(--text-muted)",fontFamily:"var(--font-mono)"}}>{msg.time}</span>
                  </div>
                </div>
                <div style={{fontSize:13,color:"var(--text-secondary)",lineHeight:1.5}}>{msg.text}</div>
                <div style={{marginTop:5,fontSize:10.5,color:"var(--text-muted)",fontFamily:"var(--font-mono)"}}>Re: {complaint.ticketId}</div>
              </div>
            </div>
          </div>
        ))}
      </div>}
    </div>
  );
}

// ─── CHARTS ───────────────────────────────────────────────────────────────────
function DonutChart({resolved,assigned,pending,total}:{resolved:number;assigned:number;pending:number;total:number}){
  const size=96,stroke=12,r=(size-stroke)/2,circ=2*Math.PI*r;
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
        <span style={{fontSize:18,fontWeight:900,color:"#fff",lineHeight:1}}>{rate}%</span>
        <span style={{fontSize:9,color:"rgba(255,255,255,.5)",marginTop:2}}>resolved</span>
      </div>
    </div>
  );
}
function VelocityChart({complaints}:{complaints:Complaint[]}){
  const months=useMemo(()=>{const map:Record<string,{r:number;s:number}>={};const now=new Date();for(let i=5;i>=0;i--){const d=new Date(now.getFullYear(),now.getMonth()-i,1);map[d.toLocaleString("en-IN",{month:"short"})]={r:0,s:0};}complaints.forEach(c=>{const k=new Date(c.createdAt).toLocaleString("en-IN",{month:"short"});if(map[k]){map[k].r++;if(c.status==="Resolved")map[k].s++;}});return Object.entries(map).map(([k,v])=>({k,...v}));},[complaints]);
  const mx=Math.max(...months.map(m=>m.r),1),H=64,BW=14,GAP=10,TOTAL_W=months.length*(BW*2+GAP+4);
  return(
    <div style={{overflowX:"auto"}}>
      <svg width={Math.max(TOTAL_W,320)} height={H+28} viewBox={`0 0 ${Math.max(TOTAL_W,320)} ${H+28}`} style={{display:"block",minWidth:"100%"}}>
        {months.map((m,i)=>{const x=i*(BW*2+GAP+4)+2;const rH=Math.max(2,(m.r/mx)*H);const sH=Math.max(2,(m.s/mx)*H);return(<g key={m.k}>
          <rect x={x} y={H-rH} width={BW} height={rH} fill="var(--blue)" rx={3} opacity={0.75}/>
          <rect x={x+BW+3} y={H-sH} width={BW} height={sH} fill="var(--green)" rx={3} opacity={0.75}/>
          <text x={x+BW} y={H+16} textAnchor="middle" fontSize={9} fill="var(--text3)" fontFamily="var(--font-display)">{m.k}</text>
        </g>);})}
      </svg>
      <div style={{display:"flex",gap:12,marginTop:6}}>{[["var(--blue)","Submitted"],["var(--green)","Resolved"]].map(([c,l])=><div key={l} style={{display:"flex",alignItems:"center",gap:5}}><div style={{width:8,height:8,borderRadius:2,background:c}}/><span style={{fontSize:10,color:"var(--text-muted)"}}>{l}</span></div>)}</div>
    </div>
  );
}

// ─── AI ASSISTANT ─────────────────────────────────────────────────────────────
const OFC_AI:Record<string,string>={
  task:"Task list shows today's priorities. Mark done as you complete — auto-logs to handover. 📋",shift:"Shift timer tracks duty. Start on arrival, end at close. Handover auto-generates. ⏱️",escalat:"Open complaint → fill reason → Escalate. HQ notified instantly. 🚨",worker:"Workers tab shows your crew. AI suggests best match by workload, location, skills. 🔧",assign:"Assign Worker → AI shows top 3 by proximity + load + skills. 👷",priority:"Every complaint scores 0–100: emergency, age, dept risk, density. Critical=70+. 🎯",heatmap:"Heatmap shows city-wide density. Red=emergency, Orange=hotspot. 🗺️",cluster:"3+ complaints in 500m/5min = 🚨 MASS INCIDENT. Check Control Room. 🚔",eta:"ML predictor warns if worker will miss SLA before it happens. ⏱️",video:"📹 Video Call — WebRTC P2P encrypted, no external app. Assess scene live.",interagency:"🚔 Inter-Agency — alert Police, Fire, Medical, Disaster simultaneously.",controlroom:"Control Room: 🔴 SOS, 🟠 pending, 🔵 in-progress, 🟢 worker GPS.",help:"Ask: triage, assignment, priority, heatmap, clusters, ETA, video, inter-agency. 👮",
};
interface AiMsg{role:"ai"|"user";text:string;time:string}
function AIAssistantPanel({officerName,dept}:{officerName:string;dept:string}){
  const[msgs,setMsgs]=useState<AiMsg[]>([{role:"ai",text:`Hey ${officerName.split(" ")[0]}! 👮 Command AI for ${dept}.\n\n🗺️ Control Room · 🚨 Clusters · ⏱️ ETA prediction · 📹 Video · 🚔 Multi-agency\n\nAsk me anything.`,time:"now"}]);
  const[input,setInput]=useState(""),[ typing,setTyping]=useState(false);
  const endRef=useRef<HTMLDivElement>(null);
  const QUICK=["Clusters?","ETA breach?","Video call?","Priorities?"];
  useEffect(()=>{endRef.current?.scrollIntoView({behavior:"smooth"});},[msgs,typing]);
  const send=(text:string)=>{
    if(!text.trim())return;
    const t=new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
    setMsgs(m=>[...m,{role:"user",text,time:t}]);setInput("");setTyping(true);
    setTimeout(()=>{
      const lower=text.toLowerCase(),key=Object.keys(OFC_AI).find(k=>lower.includes(k));
      setMsgs(m=>[...m,{role:"ai",text:key?OFC_AI[key]:"Ask about: assignment, heatmap, clusters, ETA, video, inter-agency.",time:new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}]);
      setTyping(false);
    },700);
  };
  const dc=DEPT_COLOR[dept]||"var(--green)";
  return(
    <div style={{display:"flex",flexDirection:"column",height:"100%",minHeight:0}}>
      <div style={{flex:1,overflowY:"auto",padding:"12px 14px",display:"flex",flexDirection:"column",gap:8,minHeight:0}}>
        {msgs.map((m,i)=>(
          <div key={i} style={{display:"flex",flexDirection:m.role==="user"?"row-reverse":"row",alignItems:"flex-end",gap:6}}>
            {m.role==="ai"&&<div style={{width:26,height:26,borderRadius:"50%",background:"var(--green-bg)",border:"1px solid var(--green-border)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,flexShrink:0}}>👮</div>}
            <div style={{maxWidth:"80%",padding:"8px 12px",borderRadius:m.role==="user"?"12px 12px 3px 12px":"12px 12px 12px 3px",background:m.role==="user"?`${dc}25`:"var(--surface2)",border:`1px solid ${m.role==="user"?`${dc}40`:"var(--border)"}`,color:"var(--text-primary)",fontSize:12.5,lineHeight:1.6,whiteSpace:"pre-line"}}>
              {m.text}<div style={{fontSize:9.5,color:"var(--text-muted)",marginTop:3,fontFamily:"var(--font-mono)"}}>{m.time}</div>
            </div>
          </div>
        ))}
        {typing&&<div style={{display:"flex",alignItems:"center",gap:6}}><div style={{width:26,height:26,borderRadius:"50%",background:"var(--green-bg)",border:"1px solid var(--green-border)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11}}>👮</div><div style={{padding:"8px 12px",background:"var(--bg-card-alt)",border:"1px solid var(--border)",borderRadius:"12px 12px 12px 3px",display:"flex",gap:3,alignItems:"center"}}>{[0,1,2].map(i=><div key={i} style={{width:5,height:5,borderRadius:"50%",background:"var(--text3)",animation:`bounce 1.2s ${i*.2}s ease-in-out infinite`}}/>)}</div></div>}
        <div ref={endRef}/>
      </div>
      <div style={{padding:"6px 12px",display:"flex",flexWrap:"wrap",gap:4}}>
        {QUICK.map(q=><button key={q} onClick={()=>send(q)} style={{fontSize:10,padding:"3px 8px",borderRadius:20,border:"1px solid var(--border)",background:"transparent",color:"var(--text-muted)",cursor:"pointer",fontFamily:"var(--font)",transition:"var(--transition)"}} onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.borderColor="var(--green)";(e.currentTarget as HTMLButtonElement).style.color="var(--green)";}} onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.borderColor="var(--border)";(e.currentTarget as HTMLButtonElement).style.color="var(--text3)";}}>{q}</button>)}
      </div>
      <div style={{padding:"8px 12px 12px",display:"flex",gap:7}}>
        <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send(input)} placeholder="Ask anything…" className="input" style={{flex:1,fontSize:12}}/>
        <button onClick={()=>send(input)} style={{width:34,height:34,borderRadius:"var(--radius-sm)",background:input.trim()?dc:"var(--surface2)",border:"none",cursor:input.trim()?"pointer":"default",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"var(--transition)"}}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>
      </div>
    </div>
  );
}

// ─── SETTINGS ─────────────────────────────────────────────────────────────────
function SettingsNotifPanel({showToast}:{showToast:(m:string,t?:"success"|"error"|"info")=>void}){
  const ITEMS=[{l:"New Complaint Alerts",d:"When new complaints need attention",def:true},{l:"HQ Broadcasts",d:"Headquarters advisories",def:true},{l:"Worker Updates",d:"When workers change status",def:true},{l:"Auto-Escalation",d:"Complaints unassigned >30s",def:true},{l:"ETA Breach Predictions",d:"ML SLA breach warnings",def:true},{l:"Cluster Incidents",d:"3+ complaints in 500m/5min",def:true},{l:"Priority Changes",d:"AI re-routes or changes priority",def:false}];
  const[states,setStates]=useState<boolean[]>(()=>ITEMS.map(x=>x.def));
  return(
    <div className="card" style={{marginBottom:12}}>
      <div style={{fontSize:11,fontWeight:700,color:"var(--text-secondary)",letterSpacing:".1em",marginBottom:14,fontFamily:"'DM Serif Display',Georgia,serif"}}>🔔 NOTIFICATION PREFERENCES</div>
      {ITEMS.map((item,i)=>(
        <div key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 0",borderBottom:i<ITEMS.length-1?"1px solid var(--border)":"none"}}>
          <div><div style={{fontSize:13,color:"var(--text-primary)",fontWeight:500}}>{item.l}</div><div style={{fontSize:11,color:"var(--text-muted)",marginTop:1}}>{item.d}</div></div>
          <div onClick={()=>{const n=[...states];n[i]=!n[i];setStates(n);showToast((n[i]?"On: ":"Off: ")+item.l,"info");}} style={{width:40,height:22,borderRadius:22,background:states[i]?"var(--green)":"var(--surface2)",cursor:"pointer",position:"relative",transition:"all .25s",flexShrink:0,border:`1px solid ${states[i]?"var(--green-border)":"var(--border)"}`}}>
            <div style={{position:"absolute",top:2,left:states[i]?19:2,width:16,height:16,borderRadius:"50%",background:"#fff",opacity:.9,transition:"all .25s"}}/>
          </div>
        </div>
      ))}
    </div>
  );
}
function SettingsDisplayPanel({deptFilter,setDeptFilter,sortBy,setSortBy,showToast}:{deptFilter:string;setDeptFilter:(v:any)=>void;sortBy:string;setSortBy:(v:any)=>void;showToast:(m:string,t?:"success"|"error"|"info")=>void}){
  const ITEMS=[{l:"AI Priority Scores",d:"Show scoring badges on cards",def:true},{l:"Compact View",d:"Fit more complaints on screen",def:false},{l:"Worker GPS on Map",d:"Live dots on Control Room map",def:true},{l:"Auto-refresh",d:"Poll server every 3 seconds",def:true},{l:"ETA Breach Warnings",d:"Proactive SLA alerts",def:true},{l:"Cluster Banners",d:"Mass incident banners",def:true}];
  const[states,setStates]=useState<boolean[]>(()=>ITEMS.map(x=>x.def));
  return(
    <div className="card" style={{marginBottom:12}}>
      <div style={{fontSize:11,fontWeight:700,color:"var(--text-secondary)",letterSpacing:".1em",marginBottom:14,fontFamily:"'DM Serif Display',Georgia,serif"}}>🖥️ DISPLAY & PREFERENCES</div>
      {ITEMS.map((item,i)=>(
        <div key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 0",borderBottom:"1px solid var(--border)"}}>
          <div><div style={{fontSize:13,color:"var(--text-primary)",fontWeight:500}}>{item.l}</div><div style={{fontSize:11,color:"var(--text-muted)",marginTop:1}}>{item.d}</div></div>
          <div onClick={()=>{const n=[...states];n[i]=!n[i];setStates(n);showToast((n[i]?"On: ":"Off: ")+item.l,"info");}} style={{width:40,height:22,borderRadius:22,background:states[i]?"var(--green)":"var(--surface2)",cursor:"pointer",position:"relative",transition:"all .25s",flexShrink:0,border:`1px solid ${states[i]?"var(--green-border)":"var(--border)"}`}}>
            <div style={{position:"absolute",top:2,left:states[i]?19:2,width:16,height:16,borderRadius:"50%",background:"#fff",opacity:.9,transition:"all .25s"}}/>
          </div>
        </div>
      ))}
      <div style={{padding:"10px 0",borderBottom:"1px solid var(--border)",display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,marginTop:2}}>
        <div><div style={{fontSize:13,color:"var(--text-primary)",fontWeight:500}}>Default View</div></div>
        <div style={{display:"flex",gap:5}}>{["My Dept","All Depts"].map(v=><button key={v} onClick={()=>{setDeptFilter(v);showToast(`View: ${v}`,"info");}} style={{padding:"5px 11px",borderRadius:"var(--radius-sm)",background:deptFilter===v?"var(--green-bg)":"var(--surface2)",color:deptFilter===v?"var(--green)":"var(--text3)",border:`1px solid ${deptFilter===v?"var(--green-border)":"var(--border)"}`,fontSize:11,fontWeight:500,cursor:"pointer",fontFamily:"var(--font)",transition:"var(--transition)"}}>{v}</button>)}</div>
      </div>
      <div style={{padding:"10px 0",display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
        <div><div style={{fontSize:13,color:"var(--text-primary)",fontWeight:500}}>Sort Order</div></div>
        <div style={{display:"flex",gap:5}}>{(["date","priority","status"] as const).map(v=><button key={v} onClick={()=>{setSortBy(v);showToast(`Sort: ${v}`,"info");}} style={{padding:"5px 11px",borderRadius:"var(--radius-sm)",background:sortBy===v?"var(--green-bg)":"var(--surface2)",color:sortBy===v?"var(--green)":"var(--text3)",border:`1px solid ${sortBy===v?"var(--green-border)":"var(--border)"}`,fontSize:11,fontWeight:500,cursor:"pointer",fontFamily:"var(--font)",transition:"var(--transition)",textTransform:"capitalize"}}>{v}</button>)}</div>
      </div>
    </div>
  );
}

// ─── STORAGE DEBUGGER ─────────────────────────────────────────────────────────
function StorageDebugger({count,onReload}:{count:number;onReload:()=>void}){
  return(
    <div style={{background:"var(--bg-card)",borderBottom:"1px solid var(--border)",padding:"5px 24px",display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
      <div style={{display:"flex",alignItems:"center",gap:5,background:"rgba(22,163,74,.1)",borderRadius:20,padding:"2px 10px"}}>
        <div style={{width:5,height:5,borderRadius:"50%",background:count>0?"#16a34a":"#dc2626",animation:"pulse 2s infinite"}}/>
        <span style={{fontSize:10,color:count>0?"#16a34a":"#dc2626",fontFamily:"var(--font-mono)",fontWeight:700}}>{count} loaded</span>
      </div>
      <button onClick={onReload} style={{padding:"2px 10px",borderRadius:6,background:"transparent",border:"1px solid var(--border)",color:"var(--text-muted)",fontSize:10,cursor:"pointer",fontFamily:"var(--font-mono)"}}>↻ reload</button>
    </div>
  );
}

// ─── CONTROL ROOM VIEW ────────────────────────────────────────────────────────
function ControlRoomView({allComplaints,deptComplaints,liveWorkers,clusters,etaBreaches,autoEscalations,officerName,onSelectComplaint,onDismissCluster,onDismissBreach,onManualAssign,onDismissEscalation,onViewMap}:{allComplaints:Complaint[];deptComplaints:Complaint[];liveWorkers:Worker[];clusters:IncidentCluster[];etaBreaches:EtaBreachAlert[];autoEscalations:Complaint[];officerName:string;onSelectComplaint:(c:Complaint)=>void;onDismissCluster:(id:string)=>void;onDismissBreach:(id:string)=>void;onManualAssign:(c:Complaint)=>void;onDismissEscalation:(id:string)=>void;onViewMap:()=>void}){
  const[sf,setSf]=useState<"priority"|"date"|"status">("priority");
  const[stf,setStf]=useState<"All"|"Pending"|"Assigned"|"In Progress">("All");
  const tbl=useMemo(()=>{
    let b=deptComplaints.filter(c=>c.status!=="Resolved");
    if(stf!=="All")b=b.filter(c=>c.status===stf);
    if(sf==="priority")return[...b].sort((a,bx)=>(bx.aiPriority||0)-(a.aiPriority||0));
    if(sf==="date")return[...b].sort((a,bx)=>new Date(bx.createdAt).getTime()-new Date(a.createdAt).getTime());
    return[...b].sort((a,bx)=>a.status.localeCompare(bx.status));
  },[deptComplaints,stf,sf]);
  const activeSOS=useMemo(()=>emLoadAll().filter(r=>!["Resolved","Cancelled"].includes(r.status)),[]);
  return(
    <div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:18,flexWrap:"wrap",gap:12}}>
        <div><div style={{fontSize:10,color:"var(--text-muted)",fontWeight:600,letterSpacing:".1em",fontFamily:"'DM Serif Display',Georgia,serif",marginBottom:3}}>LIVE CITY COMMAND</div><div style={{fontFamily:"'DM Serif Display',Georgia,serif",fontSize:22,fontWeight:800,color:"var(--text-primary)"}}>🗺️ Control Room</div></div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {activeSOS.length>0&&<Pill color="red">🔴 {activeSOS.length} SOS Active</Pill>}
          {clusters.filter(cl=>!cl.dismissed).length>0&&<Pill color="red">🚨 {clusters.filter(cl=>!cl.dismissed).length} Cluster{clusters.filter(cl=>!cl.dismissed).length!==1?"s":""}</Pill>}
        </div>
      </div>
      <ClusterBanner clusters={clusters} onDismiss={onDismissCluster} onViewAll={onViewMap}/>
      <EtaBreachPanel breaches={etaBreaches} onDismiss={onDismissBreach}/>
      <AutoEscalationPanel pendingEscalations={autoEscalations} onManualAssign={onManualAssign} onDismiss={onDismissEscalation}/>
      <div className="card" style={{marginBottom:20}}>
        <div style={{fontSize:12,fontWeight:600,color:"var(--text-secondary)",marginBottom:12,display:"flex",alignItems:"center",gap:8}}><div style={{width:7,height:7,borderRadius:"50%",background:"var(--red)",animation:"pulse 1.5s infinite"}}/>Live City Map</div>
        <ControlRoomMap complaints={allComplaints} workers={liveWorkers} clusters={clusters} onSelectComplaint={onSelectComplaint}/>
      </div>
      <div className="card">
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14,flexWrap:"wrap",gap:10}}>
          <div style={{fontWeight:600,color:"var(--text-primary)"}}>Request Queue <span style={{fontSize:12,color:"var(--text-muted)",fontWeight:400}}>({tbl.length} active)</span></div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {(["All","Pending","Assigned","In Progress"] as const).map(s=><button key={s} onClick={()=>setStf(s)} className="btn btn-ghost" style={{padding:"4px 10px",fontSize:11,background:stf===s?"var(--green-bg)":"transparent",color:stf===s?"var(--green)":"var(--text3)",borderColor:stf===s?"var(--green-border)":"var(--border)"}}>{s}</button>)}
            <select value={sf} onChange={e=>setSf(e.target.value as any)} className="input" style={{padding:"4px 8px",width:"auto",fontSize:11}}><option value="priority">AI Priority</option><option value="date">Date</option><option value="status">Status</option></select>
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr 1fr",background:"var(--bg-card-alt)",padding:"8px 14px",borderRadius:"var(--radius-sm) var(--radius-sm) 0 0",marginBottom:1}}>
          {["Complaint","Score","Dept","Worker","Status","ETA"].map(h=><div key={h} style={{fontSize:9.5,fontWeight:700,color:"var(--text-muted)",textTransform:"uppercase",letterSpacing:".08em",fontFamily:"'DM Serif Display',Georgia,serif"}}>{h}</div>)}
        </div>
        {tbl.slice(0,15).map(c=>{
          const ps=PRIORITY_STYLE[c.priority as keyof typeof PRIORITY_STYLE]||PRIORITY_STYLE.Low;
          const sc=STATUS_STYLE[c.status]||{bg:"transparent",text:"var(--text3)",dot:"var(--text3)",border:"var(--border)"};
          return(
            <div key={c.id} onClick={()=>onSelectComplaint(c)} style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr 1fr",padding:"11px 14px",borderBottom:"1px solid var(--border)",cursor:"pointer",transition:"var(--transition)"}} onMouseEnter={e=>(e.currentTarget.style.background="var(--surface2)")} onMouseLeave={e=>(e.currentTarget.style.background="transparent")}>
              <div style={{minWidth:0}}>
                <div style={{fontSize:12.5,fontWeight:500,color:"var(--text-primary)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{c.title||c.category||"Complaint"}</div>
                <div style={{fontSize:9.5,color:"var(--text-muted)",marginTop:1,display:"flex",gap:5,fontFamily:"var(--font-mono)"}}>{c.emergency&&"🚨"}{c.clusterGroup&&"⛓"}{c.ticketId}</div>
              </div>
              <div style={{display:"flex",alignItems:"center"}}><span style={{fontSize:12,fontWeight:700,color:ps.text,background:ps.bg,border:`1px solid ${ps.border}`,borderRadius:6,padding:"2px 7px",fontFamily:"var(--font-mono)"}}>{c.aiPriority||0}</span></div>
              <div style={{display:"flex",alignItems:"center",fontSize:11,color:DEPT_COLOR[c.department||""]||"var(--text3)"}}>{DEPT_ICON[c.department||""]||"🏛️"} {(c.department||"").split(" ")[0]}</div>
              <div style={{display:"flex",alignItems:"center",fontSize:11,color:c.assignedWorker?"var(--green)":"var(--text3)"}}>{c.assignedWorker?`🔧 ${c.assignedWorker.split(" ")[0]}`:"—"}</div>
              <div style={{display:"flex",alignItems:"center"}}><Badge status={c.status}/></div>
              <div style={{display:"flex",alignItems:"center"}}>{c.etaBreachPredicted?<Pill color="yellow">⚠️ Risk</Pill>:<span style={{fontSize:10,color:"var(--text-muted)"}}>—</span>}</div>
            </div>
          );
        })}
        {tbl.length===0&&<div style={{textAlign:"center",padding:"32px",color:"var(--text-muted)"}}><div style={{fontSize:24,marginBottom:6}}>✅</div>All caught up!</div>}
      </div>
    </div>
  );
}

// ─── EMERGENCY DISPATCH VIEW ──────────────────────────────────────────────────
function EmergencyDispatchView({officerName,workers,onShowToast}:{officerName:string;workers:Worker[];onShowToast:(m:string,t?:"success"|"error"|"info")=>void}){
  const[requests,setRequests]=useState<EmergencyRequest[]>([]);
  const[sel,setSel]=useState<EmergencyRequest|null>(null);
  const[dispOpen,setDispOpen]=useState(false);
  const[eta,setEta]=useState("5");
  const[note,setNote]=useState("");
  const[tab,setTab]=useState<"active"|"resolved">("active");
  const reload=useCallback(()=>{const all=emLoadAll();all.sort((a,b)=>new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime());setRequests(all);},[]);
  useEffect(()=>{reload();const iv=setInterval(reload,15000);window.addEventListener("storage",reload);return()=>{clearInterval(iv);window.removeEventListener("storage",reload);};},[reload]);
  const active=requests.filter(r=>!["Resolved","Cancelled"].includes(r.status)),resolved=requests.filter(r=>r.status==="Resolved"),shown=tab==="active"?active:resolved;
  const ESC:Record<string,string>={SOS_Sent:"var(--red)",Dispatched:"var(--orange)",Responder_EnRoute:"var(--blue)",Arrived:"var(--purple)",Resolved:"var(--green)",Cancelled:"var(--text3)"};
  const ESL:Record<string,string>={SOS_Sent:"SOS Sent",Dispatched:"Dispatched",Responder_EnRoute:"En Route",Arrived:"Arrived",Resolved:"Resolved",Cancelled:"Cancelled"};
  const STEPS:EmergencyRequest["status"][]=["SOS_Sent","Dispatched","Responder_EnRoute","Arrived","Resolved"];
  const ET:Record<string,{icon:string;color:string}>={medical:{icon:"🚑",color:"var(--red)"},fire:{icon:"🔥",color:"var(--orange)"},accident:{icon:"🚗",color:"var(--red)"},flood:{icon:"🌊",color:"var(--blue)"},collapse:{icon:"🏗️",color:"var(--yellow)"},other:{icon:"🚨",color:"var(--red)"}};
  const upd=(req:EmergencyRequest,status:EmergencyRequest["status"])=>{
    const now=new Date().toISOString();const u:EmergencyRequest={...req,status,updatedAt:now,timeline:[...(req.timeline||[]),{id:`tl-${Date.now()}`,event:`→ ${ESL[status]}`,actor:officerName,time:now,icon:"🔄",color:ESC[status]||"var(--blue)"}]};
    emSaveReq(u,officerName);setSel(u);setRequests(p=>p.map(r=>r.id===u.id?u:r));onShowToast(`${req.ticketId} → ${ESL[status]}`,"success");
  };
  const dispW=(req:EmergencyRequest,worker:Worker)=>{
    const now=new Date().toISOString(),etaN=parseInt(eta)||5,dist=req.lat&&req.lng?getDistanceKm(req.lat,req.lng,worker.location.lat,worker.location.lng):undefined;
    const u:EmergencyRequest={...req,status:"Responder_EnRoute",assignedResponderId:worker.id,assignedResponderName:worker.name,assignedResponderPhone:worker.phone,etaMinutes:etaN,distanceKm:dist,dispatchedAt:now,updatedAt:now,timeline:[...(req.timeline||[]),{id:`tl-d-${Date.now()}`,event:`Dispatched: ${worker.name}`,note:`ETA ${etaN}min${dist?` · ${dist.toFixed(1)}km`:""}${note?` · ${note}`:""}`,actor:officerName,time:now,icon:"🚀",color:"var(--blue)"}]};
    emSaveReq(u,officerName);setSel(u);setRequests(p=>p.map(r=>r.id===u.id?u:r));setDispOpen(false);setNote("");
    onShowToast(`🚨 ${worker.name} dispatched! ETA ${etaN}min`,"success");
  };
  const sw=[...workers.filter(w=>w.status!=="offline")].sort((a,b)=>{if(!sel?.lat||!sel?.lng)return 0;return getDistanceKm(sel.lat,sel.lng,a.location.lat,a.location.lng)-getDistanceKm(sel.lat,sel.lng,b.location.lat,b.location.lng);});
  return(
    <div style={{display:"grid",gridTemplateColumns:sel?"1fr 380px":"1fr",gap:18}}>
      <div>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14,flexWrap:"wrap",gap:10}}>
          <div style={{fontFamily:"'DM Serif Display',Georgia,serif",fontSize:18,fontWeight:800,color:"var(--text-primary)"}}>🚨 SOS Queue</div>
          <div style={{display:"flex",alignItems:"center",gap:5,padding:"5px 12px",borderRadius:20,background:active.length>0?"var(--red-bg)":"rgba(16,185,129,.1)",border:`1px solid ${active.length>0?"var(--red-border)":"var(--green-border)"}`}}>
            <div style={{width:6,height:6,borderRadius:"50%",background:active.length>0?"var(--red)":"var(--green)",animation:active.length>0?"pulse 1s infinite":"none"}}/>
            <span style={{fontSize:11,fontWeight:600,color:active.length>0?"var(--red)":"var(--green)"}}>{active.length>0?`${active.length} ACTIVE`:"ALL CLEAR"}</span>
          </div>
        </div>
        <div style={{display:"flex",gap:6,marginBottom:14}}>
          {(["active","resolved"] as const).map(t=><button key={t} onClick={()=>setTab(t)} className="btn btn-ghost" style={{background:tab===t?t==="active"?"var(--red-bg)":"var(--green-bg)":"transparent",color:tab===t?t==="active"?"var(--red)":"var(--green)":"var(--text3)",borderColor:tab===t?t==="active"?"var(--red-border)":"var(--green-border)":"var(--border)"}}>{t==="active"?`🚨 Active (${active.length})`:`✅ Resolved (${resolved.length})`}</button>)}
        </div>
        {shown.length===0?<div style={{textAlign:"center",padding:"60px",background:"var(--bg-card)",borderRadius:"var(--radius)",border:"1px solid var(--border)"}}><div style={{fontSize:44,marginBottom:10}}>{tab==="active"?"✅":"📭"}</div><div style={{color:"var(--text-muted)"}}>{tab==="active"?"No active emergencies":"No resolved emergencies"}</div></div>:
        shown.map(req=>{
          const et=ET[req.type]||{icon:"🚨",color:"var(--red)"},sc=ESC[req.status]||"var(--red)",isSel=sel?.id===req.id,isCrit=req.priority==="CRITICAL"&&req.status==="SOS_Sent";
          return(
            <div key={req.id} onClick={()=>setSel(isSel?null:req)} style={{background:"var(--bg-card)",borderRadius:"var(--radius)",padding:"14px 16px",border:`1px solid ${isSel?sc:"var(--border)"}`,cursor:"pointer",marginBottom:10,transition:"var(--transition)"}}>
              {isCrit&&<div style={{height:2,background:"linear-gradient(90deg,var(--red),var(--orange))",borderRadius:"var(--radius) var(--radius) 0 0",margin:"-14px -16px 12px"}}/>}
              <div style={{display:"flex",alignItems:"flex-start",gap:12}}>
                <div style={{width:40,height:40,borderRadius:10,background:`${et.color.replace("var(--","").replace(")","")==="red"?"rgba(239,68,68,.15)":"rgba(249,115,22,.15)"}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>{et.icon}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",gap:5,marginBottom:5,flexWrap:"wrap"}}>
                    <span className="tag" style={{background:`${sc}18`,color:sc,border:`1px solid ${sc}30`}}>{ESL[req.status]}</span>
                    <span className="tag" style={{background:req.priority==="CRITICAL"?"var(--red-bg)":"var(--orange-bg)",color:req.priority==="CRITICAL"?"var(--red)":"var(--orange)",border:`1px solid ${req.priority==="CRITICAL"?"var(--red-border)":"var(--orange-bg)"}`}}>{req.priority}</span>
                    {req.isSilentMode&&<Pill color="purple">🤫 Silent</Pill>}
                    <span style={{fontSize:9.5,color:"var(--text-muted)",fontFamily:"var(--font-mono)"}}>{req.ticketId}</span>
                  </div>
                  <div style={{fontSize:13.5,fontWeight:600,color:"var(--text-primary)",fontFamily:"'DM Serif Display',Georgia,serif",marginBottom:3}}>{req.subType||req.type} Emergency</div>
                  <div style={{fontSize:11,color:"var(--text-muted)",display:"flex",gap:10,flexWrap:"wrap"}}>
                    <span>👤 {req.citizenName}</span>
                    {req.address&&<span>📍 {req.address.slice(0,30)}</span>}
                    <span style={{fontFamily:"var(--font-mono)"}}>🕐 {new Date(req.createdAt).toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"})}</span>
                  </div>
                  {req.assignedResponderName&&<div style={{marginTop:4,fontSize:11,color:"var(--blue)",fontWeight:600}}>🚀 {req.assignedResponderName}{req.etaMinutes?` · ETA ${req.etaMinutes}m`:""}</div>}
                </div>
                {req.status==="SOS_Sent"&&<button onClick={e=>{e.stopPropagation();setSel(req);setDispOpen(true);}} className="btn btn-danger" style={{flexShrink:0}}>🚀 Dispatch</button>}
              </div>
            </div>
          );
        })}
      </div>
      {sel&&(()=>{
        const et=ET[sel.type]||{icon:"🚨",color:"var(--red)"};
        return(
          <div style={{background:"var(--bg-card)",borderRadius:"var(--radius)",overflow:"hidden",border:"1px solid var(--border2)",boxShadow:"var(--shadow)",height:"fit-content",position:"sticky",top:70}}>
            <div style={{padding:"16px 18px",borderBottom:"1px solid var(--border)"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}><span style={{fontSize:22}}>{et.icon}</span><div><div style={{fontFamily:"'DM Serif Display',Georgia,serif",fontWeight:700,fontSize:14,color:"var(--text-primary)"}}>{sel.subType||sel.type} Emergency</div><div style={{fontSize:9.5,color:"var(--text-muted)",fontFamily:"var(--font-mono)"}}>{sel.ticketId}</div></div></div>
                <button onClick={()=>setSel(null)} style={{width:26,height:26,borderRadius:"50%",background:"var(--bg-card-alt)",border:"1px solid var(--border)",cursor:"pointer",color:"var(--text-secondary)",fontSize:12,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
              </div>
              {[["👤",sel.citizenName],["📍",sel.address||"No location"],["👥",`${sel.victimCount||1} person(s)`],["🩺",sel.injurySeverity||"—"]].map(([k,v])=>(
                <div key={k as string} style={{display:"flex",gap:8,marginBottom:4}}><span style={{fontSize:11,color:"var(--text-muted)",minWidth:25}}>{k as string}</span><span style={{fontSize:11.5,color:"var(--text-secondary)"}}>{v as string}</span></div>
              ))}
            </div>
            <div style={{padding:"12px 18px",borderBottom:"1px solid var(--border)"}}>
              <div style={{fontSize:9.5,color:"var(--text-muted)",fontWeight:700,letterSpacing:".1em",marginBottom:8,fontFamily:"'DM Serif Display',Georgia,serif"}}>UPDATE STATUS</div>
              <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>{STEPS.filter(s=>s!=="SOS_Sent").map(s=>{const c=ESC[s],isA=sel.status===s;return<button key={s} onClick={()=>upd(sel,s)} style={{padding:"5px 11px",borderRadius:"var(--radius-sm)",fontSize:10.5,fontWeight:500,border:`1px solid ${isA?c:"var(--border)"}`,background:isA?`${c}18`:"var(--surface2)",color:isA?c:"var(--text3)",cursor:"pointer",fontFamily:"var(--font)",transition:"var(--transition)"}}>{ESL[s]}</button>;})}</div>
            </div>
            <div style={{padding:"12px 18px"}}>
              {!dispOpen?<button onClick={()=>setDispOpen(true)} style={{width:"100%",padding:"11px",borderRadius:"var(--radius-sm)",background:"var(--red)",border:"none",color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"'DM Serif Display',Georgia,serif"}}>🚀 Dispatch Responder</button>:
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                <div style={{fontSize:10,color:"var(--text-muted)",fontWeight:600,letterSpacing:".08em",fontFamily:"'DM Serif Display',Georgia,serif"}}>NEARBY WORKERS</div>
                <div style={{maxHeight:200,overflowY:"auto",display:"flex",flexDirection:"column",gap:5}}>
                  {sw.slice(0,5).map((w,i)=>{
                    const dist=sel.lat&&sel.lng?getDistanceKm(sel.lat,sel.lng,w.location.lat,w.location.lng):null;
                    return<div key={w.id} onClick={()=>dispW(sel,w)} style={{display:"flex",alignItems:"center",gap:9,padding:"9px 11px",borderRadius:"var(--radius-sm)",border:"1px solid var(--border)",background:i===0?"var(--green-bg)":"var(--surface2)",cursor:"pointer",transition:"var(--transition)"}} onMouseEnter={e=>(e.currentTarget as HTMLDivElement).style.borderColor="var(--green)"} onMouseLeave={e=>(e.currentTarget as HTMLDivElement).style.borderColor="var(--border)"}>
                      <div style={{fontSize:12,flexShrink:0}}>{i===0?"🥇":i===1?"🥈":"👷"}</div>
                      <div style={{flex:1,minWidth:0}}><div style={{fontSize:12,fontWeight:500,color:"var(--text-primary)"}}>{w.name}</div><div style={{fontSize:10,color:"var(--text-muted)"}}>{w.location.area}{dist!==null?` · ${dist.toFixed(1)}km`:""}</div></div>
                      <span style={{fontSize:10,color:"var(--green)",fontWeight:600}}>→</span>
                    </div>;
                  })}
                </div>
                <div style={{display:"flex",gap:7}}>
                  <div style={{flexShrink:0}}><div style={{fontSize:9.5,color:"var(--text-muted)",marginBottom:3}}>ETA (min)</div><input type="number" min="1" max="60" value={eta} onChange={e=>setEta(e.target.value)} className="input" style={{width:60,textAlign:"center",fontSize:13,fontWeight:700}}/></div>
                  <div style={{flex:1}}><div style={{fontSize:9.5,color:"var(--text-muted)",marginBottom:3}}>Note</div><input value={note} onChange={e=>setNote(e.target.value)} placeholder="Optional…" className="input" style={{fontSize:11.5}}/></div>
                </div>
                <button onClick={()=>setDispOpen(false)} className="btn btn-ghost" style={{width:"100%",justifyContent:"center"}}>Cancel</button>
              </div>}
            </div>
            {sel.timeline&&sel.timeline.length>0&&(
              <div style={{padding:"0 18px 14px",borderTop:"1px solid var(--border)",paddingTop:12}}>
                <div style={{fontSize:9.5,color:"var(--text-muted)",fontWeight:600,letterSpacing:".08em",marginBottom:8,fontFamily:"'DM Serif Display',Georgia,serif"}}>TIMELINE</div>
                {[...sel.timeline].reverse().slice(0,4).map((ev,i)=>(
                  <div key={ev.id} style={{display:"flex",gap:9,marginBottom:i<3?7:0}}>
                    <div style={{width:22,height:22,borderRadius:"50%",background:`${ev.color}18`,border:`1.5px solid ${ev.color}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,flexShrink:0}}>{ev.icon}</div>
                    <div><div style={{fontSize:11.5,fontWeight:500,color:"var(--text-primary)"}}>{ev.event}</div>{ev.note&&<div style={{fontSize:10,color:"var(--text-muted)"}}>{ev.note}</div>}<div style={{fontSize:9.5,color:"var(--text-muted)",fontFamily:"var(--font-mono)"}}>{ev.actor} · {new Date(ev.time).toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"})}</div></div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}

// ─── ADMIN PIPELINE PANEL ────────────────────────────────────────────────────
function AdminPipelinePanel({officerName}:{officerName:string}){
  const[records,setRecords]=useState<AdminPipelineRecord[]>(()=>loadAdminPipeline());
  const[tab,setTab]=useState<"mine"|"all">("mine");
  const[expanded,setExpanded]=useState<string|null>(null);

  useEffect(()=>{
    const sync=()=>setRecords(loadAdminPipeline());
    window.addEventListener("storage",sync);
    const iv=setInterval(sync,5000);
    return()=>{window.removeEventListener("storage",sync);clearInterval(iv);};
  },[]);

  const shown=(tab==="mine"?records.filter(r=>r.officerName===officerName):records).slice(0,30);
  const avgRes=shown.length>0?Math.round(shown.reduce((a,r)=>a+r.responseTimeHrs,0)/shown.length*10)/10:0;
  const totalInterv=shown.reduce((a,r)=>a+r.officerInterventions,0);
  const escalated=shown.filter(r=>r.wasEscalated).length;
  const resolved=shown.filter(r=>r.outcome==="resolved").length;
  const resRate=shown.length>0?Math.round((resolved/shown.length)*100):0;

  const fmt=(ms:number)=>{
    const h=Math.floor(ms/3600000),m=Math.floor((ms%3600000)/60000);
    return h>0?`${h}h ${m}m`:`${m}m`;
  };

  return(
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      {/* Section header */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
        <div>
          <div style={{fontSize:10,fontWeight:700,color:"var(--text-muted)",letterSpacing:".1em",marginBottom:3}}>CASE CLOSURE → ADMIN KPI PIPELINE</div>
          <div style={{fontFamily:"'DM Serif Display',Georgia,serif",fontSize:18,fontWeight:800,color:"var(--text-primary)"}}>📤 Admin Analytics Feed</div>
          <div style={{fontSize:11.5,color:"var(--text-muted)",marginTop:3}}>Every resolved/escalated case is automatically logged here and pushed to the Admin dashboard.</div>
        </div>
        <div style={{display:"flex",gap:6}}>
          {(["mine","all"] as const).map(t=>(
            <button key={t} onClick={()=>setTab(t)} className="btn btn-ghost" style={{background:tab===t?"var(--accent-dim)":"transparent",color:tab===t?"var(--accent)":"var(--text-muted)",borderColor:tab===t?"var(--accent)":"var(--border)",fontSize:11.5}}>
              {t==="mine"?`My Records (${records.filter(r=>r.officerName===officerName).length})`:`All Officers (${records.length})`}
            </button>
          ))}
        </div>
      </div>

      {records.length===0?(
        <div className="card" style={{textAlign:"center",padding:"40px 20px",color:"var(--text-muted)",background:"var(--bg-card-alt)",border:"1.5px dashed var(--border-strong)"}}>
          <div style={{fontSize:40,marginBottom:12}}>📊</div>
          <div style={{fontSize:14,fontWeight:700,color:"var(--text-secondary)",marginBottom:6}}>No pipeline data yet</div>
          <div style={{fontSize:12,lineHeight:1.6,maxWidth:320,margin:"0 auto"}}>
            Records automatically appear here whenever a complaint is <strong>Resolved</strong>, <strong>Escalated</strong>, or an <strong>Emergency is closed</strong>. Each record feeds the Admin KPI dashboard with response time, intervention count, and outcome.
          </div>
        </div>
      ):(
        <>
          {/* KPI Cards */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:13}}>
            {[
              {l:"Cases Sent",v:shown.length,icon:"📤",bg:"linear-gradient(135deg,#16a34a,#22c55e)",c:"#16a34a"},
              {l:"Avg Response",v:`${avgRes}h`,icon:"⏱",bg:"linear-gradient(135deg,#0284c7,#38bdf8)",c:"#0284c7"},
              {l:"Interventions",v:totalInterv,icon:"👮",bg:"linear-gradient(135deg,#7c3aed,#a78bfa)",c:"#7c3aed"},
              {l:"Resolution Rate",v:`${resRate}%`,icon:"📈",bg:"linear-gradient(135deg,#ea580c,#fb923c)",c:"#ea580c"},
            ].map((s,i)=>(
              <div key={s.l} className="ch card" style={{animation:`fadeIn .35s ease ${i*.06}s both`}}>
                <div style={{width:38,height:38,borderRadius:11,background:s.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,marginBottom:12,boxShadow:`0 4px 14px ${s.c}35`}}>{s.icon}</div>
                <div style={{fontSize:30,fontWeight:900,color:"var(--text-primary)",lineHeight:1}}>{s.v}</div>
                <div style={{fontSize:12,color:"var(--text-muted)",fontWeight:500,marginTop:5}}>{s.l}</div>
              </div>
            ))}
          </div>

          {/* Pipeline flow diagram */}
          <div style={{background:"var(--text-primary)",borderRadius:18,padding:"18px 22px",overflow:"hidden",position:"relative"}}>
            <div style={{position:"absolute",top:-40,right:-40,width:200,height:200,borderRadius:"50%",background:"rgba(22,163,74,.12)",filter:"blur(40px)"}}/>
            <div style={{position:"relative"}}>
              <div style={{fontSize:10,color:"rgba(255,255,255,.5)",fontWeight:700,letterSpacing:".1em",marginBottom:12}}>DATA FLOW PIPELINE</div>
              <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                {[
                  {icon:"✅",label:"Case Closed",bg:"rgba(22,163,74,.25)",c:"#4ade80"},
                  {icon:"→",label:"",bg:"transparent",c:"rgba(255,255,255,.3)"},
                  {icon:"📋",label:"Build Record",bg:"rgba(99,102,241,.25)",c:"#a5b4fc"},
                  {icon:"→",label:"",bg:"transparent",c:"rgba(255,255,255,.3)"},
                  {icon:"💾",label:"localStorage",bg:"rgba(2,132,199,.25)",c:"#7dd3fc"},
                  {icon:"→",label:"",bg:"transparent",c:"rgba(255,255,255,.3)"},
                  {icon:"📡",label:"POST /admin/pipeline",bg:"rgba(234,88,12,.25)",c:"#fb923c"},
                  {icon:"→",label:"",bg:"transparent",c:"rgba(255,255,255,.3)"},
                  {icon:"📊",label:"Admin KPI Dashboard",bg:"rgba(217,119,6,.25)",c:"#fde68a"},
                ].map((step,i)=>(
                  step.label===""
                  ?<span key={i} style={{fontSize:16,color:step.c,fontWeight:300}}>→</span>
                  :<div key={i} style={{display:"flex",alignItems:"center",gap:7,background:step.bg,borderRadius:10,padding:"7px 12px",border:`1px solid ${step.c}30`}}>
                    <span style={{fontSize:14}}>{step.icon}</span>
                    <span style={{fontSize:11,fontWeight:600,color:step.c,whiteSpace:"nowrap"}}>{step.label}</span>
                  </div>
                ))}
              </div>
              <div style={{display:"flex",gap:20,marginTop:14,flexWrap:"wrap"}}>
                {[
                  {l:"Response Time",sub:"ms from submit → resolve"},
                  {l:"Officer Interventions",sub:"timeline event count"},
                  {l:"Outcome Type",sub:"resolved / escalated / multi-agency"},
                  {l:"Shift Date",sub:"YYYY-MM-DD for daily KPI"},
                  {l:"Audit Trail",sub:"full event log with actors"},
                  {l:"AI Priority Score",sub:"0–100 at time of close"},
                ].map(f=>(
                  <div key={f.l} style={{display:"flex",alignItems:"flex-start",gap:6}}>
                    <div style={{width:5,height:5,borderRadius:"50%",background:"#4ade80",marginTop:4,flexShrink:0}}/>
                    <div>
                      <div style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,.85)"}}>{f.l}</div>
                      <div style={{fontSize:10,color:"rgba(255,255,255,.4)"}}>{f.sub}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Audit table */}
          <div className="card" style={{padding:0,overflow:"hidden"}}>
            <div style={{padding:"14px 18px",borderBottom:"1px solid var(--border)",display:"flex",alignItems:"center",gap:10}}>
              <div style={{fontWeight:700,fontSize:14,color:"var(--text-primary)"}}>Audit Trail</div>
              <span style={{fontSize:11,color:"var(--text-muted)",background:"var(--bg-card-alt)",border:"1px solid var(--border)",borderRadius:20,padding:"1px 9px"}}>{shown.length} records</span>
              <div style={{marginLeft:"auto",fontSize:11,color:"var(--text-muted)"}}>
                {escalated>0&&<span style={{color:"#dc2626",fontWeight:600,marginRight:12}}>↑ {escalated} escalated to HQ</span>}
                <span style={{color:"#16a34a",fontWeight:600}}>{resolved} resolved ✅</span>
              </div>
            </div>
            <div style={{overflowX:"auto"}}>
              {/* Table header */}
              <div style={{display:"grid",gridTemplateColumns:"2fr 1.2fr 1fr 1fr 1.4fr 1.2fr",background:"var(--bg-card-alt)",padding:"9px 18px",gap:8,minWidth:780,borderBottom:"1px solid var(--border)"}}>
                {["Complaint / Ticket","Department","Response","Officer Acts","Flags","Outcome"].map(h=>(
                  <div key={h} style={{fontSize:9.5,fontWeight:700,color:"var(--text-muted)",textTransform:"uppercase",letterSpacing:".07em"}}>{h}</div>
                ))}
              </div>
              {shown.length===0&&(
                <div style={{padding:"32px",textAlign:"center",color:"var(--text-muted)"}}>
                  <div style={{fontSize:24,marginBottom:6}}>📭</div>
                  <div style={{fontSize:12}}>No records for this filter</div>
                </div>
              )}
              {shown.map(r=>(
                <div key={r.id}>
                  <div
                    onClick={()=>setExpanded(expanded===r.id?null:r.id)}
                    style={{display:"grid",gridTemplateColumns:"2fr 1.2fr 1fr 1fr 1.4fr 1.2fr",padding:"12px 18px",borderTop:"1px solid var(--border)",gap:8,alignItems:"center",minWidth:780,cursor:"pointer",transition:"background .15s"}}
                    onMouseEnter={e=>(e.currentTarget.style.background="var(--bg-card-alt)")}
                    onMouseLeave={e=>(e.currentTarget.style.background="transparent")}
                  >
                    {/* Complaint */}
                    <div>
                      <div style={{fontSize:12.5,fontWeight:600,color:"var(--text-primary)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:220}}>{r.title}</div>
                      <div style={{display:"flex",gap:8,marginTop:2}}>
                        <span style={{fontSize:9.5,color:"var(--text-muted)",fontFamily:"var(--font-mono)"}}>{r.ticketId}</span>
                        <span style={{fontSize:9.5,color:"var(--text-muted)"}}>{r.shiftDate}</span>
                        {r.workerName&&<span style={{fontSize:9.5,color:"#16a34a"}}>🔧 {r.workerName.split(" ")[0]}</span>}
                      </div>
                    </div>
                    {/* Department */}
                    <div style={{fontSize:11.5,color:DEPT_COLOR[r.department]||"var(--text-muted)",fontWeight:600,display:"flex",alignItems:"center",gap:5}}>
                      <span>{DEPT_ICON[r.department]||"🏛️"}</span>
                      <span style={{whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{r.department.split(" ")[0]}</span>
                    </div>
                    {/* Response time */}
                    <div style={{fontSize:13,fontWeight:700,color:r.responseTimeHrs<1?"#16a34a":r.responseTimeHrs<4?"#d97706":"#dc2626"}}>
                      {fmt(r.responseTimeMs)}
                      <div style={{fontSize:9,color:"var(--text-muted)",fontWeight:400,marginTop:1}}>AI:{r.aiPriority}pts</div>
                    </div>
                    {/* Officer interventions */}
                    <div style={{textAlign:"center"}}>
                      <span style={{fontFamily:"var(--font-mono)",fontSize:16,fontWeight:900,color:"#7c3aed"}}>{r.officerInterventions}</span>
                      <div style={{fontSize:9,color:"var(--text-muted)",marginTop:1}}>events</div>
                    </div>
                    {/* Flags */}
                    <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                      {r.wasEmergency&&<span style={{fontSize:9,background:"rgba(220,38,38,.1)",color:"#dc2626",border:"1px solid rgba(220,38,38,.25)",borderRadius:6,padding:"2px 6px",fontWeight:700}}>🚨 SOS</span>}
                      {r.wasEscalated&&<span style={{fontSize:9,background:"rgba(124,58,237,.1)",color:"#7c3aed",border:"1px solid rgba(124,58,237,.25)",borderRadius:6,padding:"2px 6px",fontWeight:700}}>↑ ESC</span>}
                      {r.wasInterAgency&&<span style={{fontSize:9,background:"rgba(2,132,199,.1)",color:"#0284c7",border:"1px solid rgba(2,132,199,.25)",borderRadius:6,padding:"2px 6px",fontWeight:700}}>🚔 IA</span>}
                      {r.wasClustered&&<span style={{fontSize:9,background:"rgba(234,88,12,.1)",color:"#ea580c",border:"1px solid rgba(234,88,12,.25)",borderRadius:6,padding:"2px 6px",fontWeight:700}}>⛓ CLU</span>}
                      {r.wasEtaBreach&&<span style={{fontSize:9,background:"rgba(217,119,6,.1)",color:"#d97706",border:"1px solid rgba(217,119,6,.25)",borderRadius:6,padding:"2px 6px",fontWeight:700}}>⏱ ETA</span>}
                      {!r.wasEmergency&&!r.wasEscalated&&!r.wasInterAgency&&!r.wasClustered&&!r.wasEtaBreach&&<span style={{fontSize:10,color:"var(--text-muted)"}}>—</span>}
                    </div>
                    {/* Outcome */}
                    <div>
                      <span style={{
                        fontSize:10,fontWeight:700,borderRadius:20,padding:"3px 9px",
                        color:r.outcome==="resolved"?"#16a34a":r.outcome==="escalated_hq"?"#dc2626":"#0284c7",
                        background:r.outcome==="resolved"?"rgba(22,163,74,.1)":r.outcome==="escalated_hq"?"rgba(220,38,38,.08)":"rgba(2,132,199,.1)",
                        border:`1px solid ${r.outcome==="resolved"?"rgba(22,163,74,.28)":r.outcome==="escalated_hq"?"rgba(220,38,38,.25)":"rgba(2,132,199,.28)"}`,
                      }}>
                        {r.outcome==="resolved"?"✅ Resolved":r.outcome==="escalated_hq"?"↑ HQ":"🚔 Multi-Agency"}
                      </span>
                    </div>
                  </div>
                  {/* Expandable audit trail */}
                  {expanded===r.id&&(
                    <div style={{background:"var(--bg-card-alt)",borderTop:"1px solid var(--border)",padding:"14px 18px 18px"}}>
                      <div style={{fontSize:10,fontWeight:700,color:"var(--text-muted)",letterSpacing:".08em",marginBottom:10}}>FULL AUDIT TRAIL · {r.ticketId}</div>
                      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:8,marginBottom:12}}>
                        {[
                          {l:"Officer",v:r.officerName},
                          {l:"Citizen",v:r.citizenName||"—"},
                          {l:"Worker",v:r.workerName||"Not assigned"},
                          {l:"Resolved At",v:new Date(r.resolvedAt).toLocaleString("en-IN",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"})},
                          {l:"Response Time",v:`${r.responseTimeHrs}h (${fmt(r.responseTimeMs)})`},
                          {l:"AI Priority",v:`${r.aiPriority} / 100 · ${r.priority}`},
                          ...(r.interAgencies?.length?[{l:"Agencies Dispatched",v:r.interAgencies.join(", ")}]:[]),
                        ].map(item=>(
                          <div key={item.l} style={{padding:"8px 12px",background:"var(--bg-card)",borderRadius:9,border:"1px solid var(--border)"}}>
                            <div style={{fontSize:9.5,color:"var(--text-muted)",fontWeight:700,letterSpacing:".06em",marginBottom:2}}>{item.l.toUpperCase()}</div>
                            <div style={{fontSize:12.5,fontWeight:600,color:"var(--text-primary)"}}>{item.v}</div>
                          </div>
                        ))}
                      </div>
                      {r.auditTrail.length>0&&(
                        <div>
                          <div style={{fontSize:9.5,color:"var(--text-muted)",fontWeight:700,letterSpacing:".07em",marginBottom:8}}>EVENT LOG ({r.auditTrail.length} events)</div>
                          <div style={{display:"flex",flexDirection:"column",gap:5,maxHeight:200,overflowY:"auto"}}>
                            {r.auditTrail.map((ev,i)=>(
                              <div key={i} style={{display:"flex",gap:10,alignItems:"flex-start",padding:"7px 10px",background:"var(--bg-card)",borderRadius:8,border:"1px solid var(--border)"}}>
                                <div style={{fontSize:11,fontWeight:600,color:"var(--text-primary)",flex:1}}>{ev.event}</div>
                                <div style={{fontSize:10,color:"#16a34a",fontWeight:600,whiteSpace:"nowrap"}}>{ev.actor}</div>
                                <div style={{fontSize:9.5,color:"var(--text-muted)",fontFamily:"var(--font-mono)",whiteSpace:"nowrap"}}>{new Date(ev.time).toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"})}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════════════════════════
export default function OfficerDashboard(){
  const user=useSelector((s:RootState)=>s.auth.user);
  const reduxDispatch=useDispatch();
  const navigate=useNavigate();

  const[allComplaints,setAllComplaints]=useState<Complaint[]>(()=>safeLoad());
  const[activePage,setActivePage]=useState<NavPage>("Dashboard");
  const[selC,setSelC]=useState<Complaint|null>(null);
  const[toast,setToast]=useState<{msg:string;type:"success"|"error"|"info"}|null>(null);
  const[searchQ,setSearchQ]=useState("");
  const[statusFilter,setStatusFilter]=useState<"All"|"Pending"|"Assigned"|"In Progress"|"Resolved">("All");
  const[deptFilter,setDeptFilter]=useState<"My Dept"|"All Depts">("All Depts");
  const[priorityFilter,setPriorityFilter]=useState<"All"|"Critical"|"High"|"Medium"|"Low">("All");
  const[sortBy,setSortBy]=useState<"date"|"priority"|"status">("date");
  const[shiftActive,setShiftActive]=useState(false);
  const[shiftSec,setShiftSec]=useState(0);
  const[shiftStart,setShiftStart]=useState<string|null>(null);
  const[tasks,setTasks]=useState<Task[]>([]);
  const[newTask,setNewTask]=useState("");
  const[handover,setHandover]=useState<HandoverEntry[]>([]);
  const[alerts,setAlerts]=useState<HQAlert[]>(STATIC_HQ_ALERTS);
  const[showAlerts,setShowAlerts]=useState(false);
  const[showProfile,setShowProfile]=useState(false);
  const[showMob,setShowMob]=useState(false);
  const[liveWorkers,setLiveWorkers]=useState<Worker[]>(()=>{
    try{const s=localStorage.getItem("workers_registry");if(s){const p=JSON.parse(s) as Worker[];if(Array.isArray(p)&&p.length>0)return p;}return MOCK_WORKERS;}catch{return MOCK_WORKERS;}
  });
  // ── FIX: single state for intelligence data ──
  const[clusters,setClusters]=useState<IncidentCluster[]>([]);
  const[etaBreaches,setEtaBreaches]=useState<EtaBreachAlert[]>([]);
  const[autoEscalations,setAutoEscalations]=useState<Complaint[]>([]);
  const[dimCl,setDimCl]=useState<Set<string>>(new Set());
  const[dimBr,setDimBr]=useState<Set<string>>(new Set());
  const[dimEs,setDimEs]=useState<Set<string>>(new Set());
  const[newBanner,setNewBanner]=useState<{count:number;depts:string[]}|null>(null);
  // ── FIX: cache emLoadAll to avoid calling on every render ──
  const[activeSOS,setActiveSOS]=useState(0);
  const seenIds=useRef(new Set<string>());

  const DEPT_MAP:Record<string,string>={Police:"Police","Fire Services":"Fire Department","Public Works":"Roads & Infrastructure","Roads & Highways":"Roads & Infrastructure",Sanitation:"Sanitation","Water Supply":"Water Works",Electricity:"Electricity",Municipal:"General Civic","Municipal Corporation":"General Civic",Health:"General Civic",Revenue:"General Civic","IT & Digital Services":"General Civic","Parks & Recreation":"General Civic"};
  const rawDept=(user as any)?.department||"";
  const officerDept=DEPT_MAP[rawDept]||rawDept||"General Civic";
  const dc=DEPT_COLOR[officerDept]||"var(--green)";
  const taskKey=`tasks_${user?.id||"officer"}`;
  const handoverKey=`handover_${user?.id||"officer"}_${new Date().toDateString()}`;

  useEffect(()=>{if(!user)navigate("/login",{replace:true});},[user,navigate]);

  // ── PERF FIX: single setAllComplaints call per poll cycle ──
  useEffect(()=>{
    const load=async()=>{
      const fresh=await fetchFromServer();
      setAllComplaints(prev=>{
        const prevIds=new Set(prev.map(c=>c.id));
        const norm=fresh.map((c:any):Complaint|null=>{
          if(!c?.id)return null;
          let createdAt=typeof c.createdAt==="number"?new Date(c.createdAt).toISOString():c.createdAt||new Date().toISOString();
          const n:Complaint={id:c.id,ticketId:c.ticketId||`AP-${c.id.slice(-6).toUpperCase()}`,title:c.title||c.category||"Untitled",category:c.category||"General",description:c.description||"",status:c.status||"Pending",department:c.department||"General Civic",userName:c.userName||"Citizen",userId:c.userId||"",address:c.address||"",image:c.image,createdAt,updatedAt:c.updatedAt||createdAt,lat:typeof c.lat==="number"?c.lat:undefined,lng:typeof c.lng==="number"?c.lng:undefined,aiRouted:c.aiRouted||false,aiRoutingReason:c.aiRoutingReason||"",emergency:c.emergency||false,priority:c.priority||"Normal",assignedOfficer:c.assignedOfficer,officerNote:c.officerNote,escalated:c.escalated||false,timeline:c.timeline||[],workerUpdates:c.workerUpdates||[],messages:c.messages||[],escalationPendingSince:c.escalationPendingSince||createdAt,interAgencyDispatched:c.interAgencyDispatched};
          if(!n.department||n.department==="General Civic"){const r=aiRouteDepartment(n);n.department=r.department;n.aiRouted=true;n.aiRoutingReason=r.reason;}
          return n;
        }).filter(Boolean) as Complaint[];
        norm.sort((a,b)=>new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime());
        const added=norm.filter(c=>!prevIds.has(c.id)&&!seenIds.current.has(c.id));
        if(added.length>0){
          added.forEach(c=>seenIds.current.add(c.id));
          const depts=[...new Set(added.map(c=>c.department||"General Civic"))];
          setNewBanner({count:added.length,depts});
          setTimeout(()=>setNewBanner(null),8000);
          setAlerts(prev=>[...added.slice(0,5).map(nc=>({id:`notif-${nc.id}`,title:`New: ${nc.title||nc.category||"Complaint"}`,message:`${nc.userName||"Citizen"} · ${nc.department||"General Civic"}`,severity:nc.emergency?"critical":"info" as "critical"|"info",dept:nc.department||"General Civic",time:new Date().toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"}),read:false})),...prev].slice(0,30));
        }
        return norm;
      });
    };
    load();
    let sse:EventSource|null=null;
    // SSE stream not implemented — polling handles updates
    const iv=setInterval(load, 15000);
    window.addEventListener("focus",load);
    return()=>{clearInterval(iv);window.removeEventListener("focus",load);try{sse?.close();}catch{}};
  },[]);

  // ── Workers sync — from real backend ──
  useEffect(()=>{
    const loadWorkers=async()=>{
      try{
        const token=JSON.parse(localStorage.getItem("auth")||"{}").token;
        if(!token) return;
        const res=await fetch(`${API}/users/workers`,{headers:{Authorization:`Bearer ${token}`}});
        if(res.ok){
          const json=await res.json();
          const arr=json?.data??json;
          if(Array.isArray(arr)&&arr.length>0){
            // Map backend user fields to frontend Worker shape
            const mapped=arr.map((w:any,idx:number)=>({
              id:          w.id,
              name:        w.name,
              dept:        w.department ?? officerDept,
              department:  w.department ?? officerDept,
              phone:       w.phone ?? "",
              email:       w.email ?? "",
              status:      (w.active_assignments > 0 ? "busy" : "available") as "available"|"busy"|"offline",
              currentLoad: Number(w.active_assignments) || 0,
              maxLoad:     5,
              completedToday: 0,
              avgResolutionHrs: 2.0,
              rating:      Number(w.rating) || 4.5,
              skills:      [],
              // Spread workers around Vijayawada area so map shows them
              location: {
                lat:  16.5062 + (idx % 5) * 0.006 - 0.012,
                lng:  80.6480 + Math.floor(idx / 5) * 0.006 - 0.012,
                area: w.district ?? "Vijayawada",
              },
            }));
            setLiveWorkers(mapped);
            return;
          }
        }
      }catch(e){ console.warn("[Officer] workers load failed:",e); }
      // Fallback to MOCK_WORKERS if backend unavailable
      setLiveWorkers(MOCK_WORKERS);
    };
    loadWorkers();
    const iv=setInterval(loadWorkers, 60000);
    return()=>clearInterval(iv);
  },[]);

  // ── PERF FIX: intelligence engine — batched updates, avoids double setAllComplaints ──
  useEffect(()=>{
    const run=()=>{
      const newCl=detectClusters(allComplaints).map(cl=>({...cl,dismissed:dimCl.has(cl.id)}));
      const newBr=predictEtaBreaches(allComplaints,liveWorkers).map(b=>({...b,dismissed:dimBr.has(b.id)}));
      const newEs=checkAutoEscalations(allComplaints).filter(c=>!dimEs.has(c.id));
      const sos=emLoadAll().filter(r=>!["Resolved","Cancelled"].includes(r.status)).length;
      setClusters(newCl);
      setEtaBreaches(newBr);
      setAutoEscalations(newEs);
      setActiveSOS(sos);
      // PERF FIX: batch complaint flags update in a single setState
      const breachIds=new Set(newBr.map(b=>b.complaintId));
      const clusterMap=new Map(newCl.flatMap(cl=>cl.complaintIds.map(id=>[id,cl.id])));
      const needsUpdate=allComplaints.some(c=>{
        const wantsBreach=breachIds.has(c.id),wantsCluster=clusterMap.has(c.id);
        return(wantsBreach&&!c.etaBreachPredicted)||(wantsCluster&&c.clusterGroup!==clusterMap.get(c.id))||(!wantsBreach&&c.etaBreachPredicted)||(!wantsCluster&&c.clusterGroup);
      });
      if(needsUpdate)setAllComplaints(prev=>prev.map(c=>({...c,etaBreachPredicted:breachIds.has(c.id)||undefined,clusterGroup:clusterMap.get(c.id)||undefined})));
      if(newCl.filter(cl=>!cl.dismissed).length>0)setAlerts(prev=>{if(prev.find(a=>a.id.startsWith("cluster-alert")))return prev;return[{id:`cluster-alert-${Date.now()}`,title:"Mass Incident Cluster",message:`${newCl.filter(cl=>!cl.dismissed).length} cluster(s) detected.`,severity:"critical" as const,dept:"All",time:new Date().toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"}),read:false},...prev].slice(0,30);});
      // AudioContext requires user gesture - skip auto-play sound
    };
    run();const iv=setInterval(run, 20000);return()=>clearInterval(iv);
  },[allComplaints,liveWorkers,dimCl,dimBr,dimEs]);// eslint-disable-line

  // Tasks init
  useEffect(()=>{const s=lsGet<Task[]>(taskKey,[]);if(s.length===0){const d=makeDefaultTasks(allComplaints,officerDept);setTasks(d);lsSet(taskKey,d);}else setTasks(s);setHandover(lsGet<HandoverEntry[]>(handoverKey,[]));},[allComplaints.length]);// eslint-disable-line

  // Shift timer
  useEffect(()=>{if(!shiftActive)return;const iv=setInterval(()=>setShiftSec(s=>s+1),1000);return()=>clearInterval(iv);},[shiftActive]);

  // ── Computed ──
  const deptC=useMemo(()=>{
    const base=deptFilter==="All Depts"?allComplaints:allComplaints.filter(c=>!c.department||c.department==="General Civic"||c.department===officerDept);
    return base.map(c=>({...c,aiPriority:aiPriorityScore(c,base),priority:getPriorityLabel(aiPriorityScore(c,base))}));
  },[allComplaints,officerDept,deptFilter]);

  const total=deptC.length,pending=deptC.filter(c=>c.status==="Pending").length,assigned=deptC.filter(c=>c.status==="Assigned"||c.status==="In Progress").length,resolved=deptC.filter(c=>c.status==="Resolved").length,emergency=deptC.filter(c=>c.emergency).length,escalated=deptC.filter(c=>c.escalated).length;
  const resRate=total>0?Math.round((resolved/total)*100):0;
  const myResolved=allComplaints.filter(c=>c.assignedOfficer===user?.name&&c.status==="Resolved").length;
  const aiRouted=allComplaints.filter(c=>c.aiRouted).length;
  const unreadAlerts=alerts.filter(a=>!a.read).length;
  const critCount=deptC.filter(c=>c.priority==="Critical").length;
  const tasksDone=tasks.filter(t=>t.done).length,taskPct=tasks.length>0?Math.round((tasksDone/tasks.length)*100):0;
  // FIX: add user?.name to deps
  const unreadMsgs=useMemo(()=>{
    let count=0;
    allComplaints.forEach(c=>{
      const key=`chat_${c.ticketId}`;
      let lsMsgs:Message[]=[];
      try{ lsMsgs=JSON.parse(localStorage.getItem(key)||"[]"); }catch{}
      const all=[...(c.messages||[]),...lsMsgs];
      all.forEach(m=>{ if(!m.read&&m.to===user?.name)count++; });
    });
    return count;
  },[allComplaints,user?.name]);
  const acClusters=clusters.filter(cl=>!cl.dismissed).length,acBreaches=etaBreaches.filter(b=>!b.dismissed).length;

  // FIX: use [...base].sort() to avoid mutation
  const filteredC=useMemo(()=>{
    let base=deptC.filter(c=>{
      if(statusFilter!=="All"&&c.status!==statusFilter)return false;
      if(priorityFilter!=="All"&&c.priority!==priorityFilter)return false;
      if(searchQ){const q=searchQ.toLowerCase();return[c.title,c.ticketId,c.userName,c.department,c.address,c.category].some(v=>v?.toLowerCase().includes(q));}
      return true;
    });
    const ts=(d:string|number|undefined)=>{if(!d)return 0;if(typeof d==="number")return d;const n=Number(d);return isNaN(n)?new Date(d).getTime():n;};
    if(sortBy==="priority")return[...base].sort((a,b)=>{const pd=(b.aiPriority||0)-(a.aiPriority||0);return pd!==0?pd:ts(b.createdAt)-ts(a.createdAt);});
    if(sortBy==="date")return[...base].sort((a,b)=>ts(b.createdAt)-ts(a.createdAt));
    return[...base].sort((a,b)=>{const sd=a.status.localeCompare(b.status);return sd!==0?sd:ts(b.createdAt)-ts(a.createdAt);});
  },[deptC,statusFilter,priorityFilter,searchQ,sortBy]);

  const fmtDur=(s:number)=>{const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sec=s%60;return h>0?`${h}h ${m}m`:`${m}m ${sec.toString().padStart(2,"0")}s`;};
  const showToast=useCallback((msg:string,type:"success"|"error"|"info"="success")=>{setToast({msg,type});setTimeout(()=>setToast(null),2800);},[]);
  const greeting=()=>{const h=new Date().getHours();return h<12?"Good morning":h<17?"Good afternoon":"Good evening";};
  const addHandover=(entry:Omit<HandoverEntry,"id"|"time">)=>{const e:HandoverEntry={...entry,id:Date.now().toString(),time:new Date().toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"})};setHandover(p=>{const n=[e,...p].slice(0,30);lsSet(handoverKey,n);return n;});};

  const saveC=useCallback((updated:Complaint)=>{
    const next=allComplaints.map(c=>c.id===updated.id?updated:c);
    setAllComplaints(next);saveAll(next);
    if(selC?.id===updated.id)setSelC(updated);
    // Sync to backend
    if(updated.status)patchComplaintBackend(updated.id,{status:updated.status});
    addHandover({action:`Updated: ${updated.title||updated.ticketId}`,ticketRef:updated.ticketId,type:updated.status==="Resolved"?"resolved":updated.assignedWorker?"assigned":"noted"});
    // ── ADMIN PIPELINE: push record whenever complaint reaches Resolved or Escalated ──
    if(updated.status==="Resolved"||updated.escalated){
      const record=buildPipelineRecord(updated,user?.name||"Officer",
        updated.escalated?"escalation":"complaint_resolved");
      pushToAdminPipeline(record);
    }
    showToast("Complaint updated ✓");
  },[allComplaints,selC,user?.name]);// eslint-disable-line

  const quickStatus=(id:string,status:string)=>{
    const c=allComplaints.find(x=>x.id===id);if(!c)return;
    const updated={...c,status,assignedOfficer:user?.name,updatedAt:new Date().toISOString(),timeline:[...(c.timeline||[]),{id:`tl-${Date.now()}`,event:`Status → ${status}`,actor:user?.name||"Officer",time:new Date().toISOString(),icon:"🔄",color:"var(--blue)"}]};
    const next=allComplaints.map(x=>x.id===id?updated:x);setAllComplaints(next);saveAll(next);
    // Sync status to backend
    patchComplaintBackend(id,{status});
    addHandover({action:`${status}: ${c.title||c.category}`,ticketRef:c.ticketId,type:status==="Resolved"?"resolved":"assigned"});
    // ── ADMIN PIPELINE: push when quick-resolved ──
    if(status==="Resolved"){
      pushToAdminPipeline(buildPipelineRecord(updated,user?.name||"Officer","complaint_resolved"));
    }
    showToast(`Marked ${status}`);
  };

  const handleLogout=()=>{reduxDispatch(clearNotifications());reduxDispatch(clearComplaints());reduxDispatch(logout());navigate("/login",{replace:true});};

  if(!user)return null;

  const NAV_ITEMS:[NavPage,string,string][]=[["Dashboard","🏠","Dashboard"],["Complaints","📋","Complaints"],["Workers","👷","Workers"],["Messages","💬","Messages"],["ControlRoom","🗺️","Control Room"],["Emergency","🚨","Emergency"]];

  return(
    <div className="officer-wrap" style={{fontFamily:"'DM Sans','Nunito',system-ui,sans-serif"}}>
      <style>{GLOBAL_CSS}</style>

      {/* TOAST */}
      {toast&&(
        <div style={{position:"fixed",top:20,right:20,zIndex:3000,padding:"12px 18px",borderRadius:12,background:toast.type==="success"?"var(--text-primary)":toast.type==="error"?"#7f1d1d":"#1e2a4a",border:`1px solid ${toast.type==="success"?"rgba(16,185,129,.3)":toast.type==="error"?"rgba(239,68,68,.3)":"rgba(59,130,246,.3)"}`,color:"#fff",fontSize:12.5,fontWeight:600,maxWidth:340,boxShadow:"0 8px 32px rgba(0,0,0,.3)",animation:"slideRight .35s ease",display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:16}}>{toast.type==="success"?"✅":toast.type==="error"?"🚨":"ℹ️"}</span>
          {toast.msg}
        </div>
      )}

      {/* NAV */}
      <nav style={{background:"var(--bg-nav-glass)",position:"fixed",top:0,left:0,right:0,zIndex:200,borderBottom:"1px solid var(--nav-border)",boxShadow:"0 2px 20px rgba(22,163,74,.12)",backdropFilter:"blur(12px)",WebkitBackdropFilter:"blur(12px)",height:64}}>
        <div style={{maxWidth:1440,margin:"0 auto",padding:"0 24px",height:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
          {/* Brand */}
          <div style={{display:"flex",alignItems:"center",gap:12,flexShrink:0}}>
            <img src="/ap-bg.png" alt="AP Seal" style={{width:44,height:44,objectFit:"contain",flexShrink:0}}/>
            <div>
              <div style={{fontSize:15,fontWeight:800,color:"var(--text-primary)",letterSpacing:"-.01em",lineHeight:1}}>CivicConnect Officer Portal</div>
              <div style={{fontSize:9.5,color:"var(--accent)",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginTop:2}}>{officerDept}</div>
            </div>
          </div>

          {/* Center nav */}
          <div className="nav-center" style={{display:"flex",alignItems:"center",gap:20}}>
            {NAV_ITEMS.map(([page,icon,label])=>(
              <button key={page} onClick={()=>setActivePage(page)} style={{background:"transparent",border:"none",cursor:"pointer",fontFamily:"inherit",fontSize:14,color:activePage===page?"#14532d":"#16a34a",fontWeight:activePage===page?700:500,paddingBottom:"6px",borderBottom:activePage===page?"2.5px solid #16a34a":"2.5px solid transparent",transition:"all .2s ease",position:"relative",whiteSpace:"nowrap"}}>
                {icon} {label}
                {page==="Complaints"&&critCount>0&&<span style={{position:"absolute",top:-6,right:-10,background:"#dc2626",color:"#fff",fontSize:9,fontWeight:800,minWidth:16,height:16,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 4px"}}>{critCount}</span>}
                {page==="Messages"&&unreadMsgs>0&&<span style={{position:"absolute",top:-6,right:-10,background:"#0284c7",color:"#fff",fontSize:9,fontWeight:800,minWidth:16,height:16,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 4px"}}>{unreadMsgs}</span>}
                {page==="ControlRoom"&&acClusters>0&&<span style={{position:"absolute",top:-6,right:-10,background:"#dc2626",color:"#fff",fontSize:9,fontWeight:800,minWidth:16,height:16,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 4px",animation:"pulse 1s infinite"}}>{acClusters}</span>}
                {page==="Emergency"&&activeSOS>0&&<span style={{position:"absolute",top:-6,right:-10,background:"#dc2626",color:"#fff",fontSize:9,fontWeight:800,minWidth:16,height:16,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 4px",animation:"pulse 1s infinite"}}>{activeSOS}</span>}
              </button>
            ))}
          </div>

          {/* Right */}
          <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
            {acBreaches>0&&<div onClick={()=>setActivePage("ControlRoom")} style={{cursor:"pointer",padding:"4px 10px",borderRadius:20,background:"rgba(217,119,6,.12)",border:"1px solid rgba(217,119,6,.3)"}}><span style={{fontSize:10.5,fontWeight:700,color:"#d97706"}}>⏱ {acBreaches} ETA</span></div>}
            {acClusters>0&&<div onClick={()=>setActivePage("ControlRoom")} style={{cursor:"pointer",padding:"4px 10px",borderRadius:20,background:"rgba(220,38,38,.08)",border:"1px solid rgba(220,38,38,.25)",animation:"pulse 3s infinite"}}><span style={{fontSize:10.5,fontWeight:700,color:"#dc2626"}}>🚨 {acClusters}</span></div>}
            {/* Live count badge */}
            <div onClick={()=>{const f=safeLoad();setAllComplaints(f);showToast(`Refreshed — ${f.length}`,"info");}} style={{cursor:"pointer",display:"flex",alignItems:"center",gap:5,padding:"5px 11px",borderRadius:20,background:"rgba(22,163,74,.1)",border:"1px solid rgba(22,163,74,.28)"}}>
              <div style={{width:6,height:6,borderRadius:"50%",background:"#16a34a",animation:"pulse 2s infinite"}}/>
              <span style={{fontSize:10.5,fontWeight:700,color:"#16a34a"}}>{allComplaints.length}</span>
            </div>
            {/* Bell */}
            <button onClick={()=>{setShowAlerts(p=>!p);setShowProfile(false);}} style={{width:38,height:38,borderRadius:10,background:showAlerts?"rgba(22,163,74,.1)":"var(--bg-card-alt)",border:`1px solid ${showAlerts?"var(--accent)":"var(--border)"}`,color:showAlerts?"var(--accent)":"var(--text-secondary)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",position:"relative",transition:"var(--transition)"}}>
              🔔
              {unreadAlerts>0&&<span style={{position:"absolute",top:-4,right:-4,background:"#dc2626",color:"#fff",fontSize:8,minWidth:16,height:16,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 2px"}}>{unreadAlerts}</span>}
            </button>
            {/* Shift timer */}
            <button onClick={()=>{if(!shiftActive){setShiftActive(true);setShiftStart(new Date().toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"}));showToast("Shift started");}else{setShiftActive(false);showToast(`Shift ended · ${fmtDur(shiftSec)}`,"info");}}} style={{display:"flex",alignItems:"center",gap:5,padding:"6px 12px",borderRadius:10,background:shiftActive?"rgba(22,163,74,.1)":"var(--bg-card-alt)",border:`1px solid ${shiftActive?"var(--accent)":"var(--border)"}`,color:shiftActive?"var(--accent)":"var(--text-secondary)",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"var(--font)",transition:"var(--transition)"}}>
              <div style={{width:6,height:6,borderRadius:"50%",background:shiftActive?"#16a34a":"var(--text-muted)",animation:shiftActive?"pulse 1.5s infinite":"none"}}/>
              {shiftActive?fmtDur(shiftSec):"Shift"}
            </button>
            {/* Hamburger mobile */}
            <button className="mob-menu-btn" onClick={()=>setShowMob(p=>!p)} style={{display:"none",width:38,height:38,borderRadius:10,background:"var(--bg-card-alt)",border:"1px solid var(--border)",alignItems:"center",justifyContent:"center",cursor:"pointer",color:"var(--text-secondary)",flexShrink:0,fontSize:16}}>☰</button>
            {/* Avatar button */}
            <button onClick={()=>{setShowProfile(p=>!p);setShowAlerts(false);}} style={{display:"flex",alignItems:"center",gap:8,background:showProfile?"rgba(22,163,74,.1)":"var(--bg-card-alt)",border:`1px solid ${showProfile?"var(--accent)":"var(--border)"}`,borderRadius:12,padding:"5px 11px 5px 5px",cursor:"pointer",transition:"var(--transition)"}}>
              <div style={{width:30,height:30,borderRadius:9,background:"linear-gradient(135deg,#15803d,#16a34a)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,fontSize:13,color:"#fff",boxShadow:"0 2px 8px rgba(22,163,74,.3)"}}>{user?.name?.charAt(0).toUpperCase()||"O"}</div>
              <div style={{textAlign:"left"}}>
                <div style={{fontSize:12.5,fontWeight:700,color:"var(--text-primary)",lineHeight:1.1}}>{user?.name?.split(" ")[0]||"Officer"}</div>
                <div style={{fontSize:9.5,color:"var(--accent)",fontWeight:600}}>{officerDept.split(" ")[0]}</div>
              </div>
            </button>
          </div>
        </div>
      </nav>

      {/* HERO BANNER */}
      <div style={{background:"linear-gradient(135deg,#16a34a 0%,#15803d 60%,#166534 100%)",padding:"24px 24px 20px",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",inset:0,backgroundImage:"radial-gradient(circle at 1px 1px,rgba(255,255,255,.08) 1px,transparent 0)",backgroundSize:"28px 28px",pointerEvents:"none"}}/>
        <div style={{position:"absolute",top:-80,right:-80,width:360,height:360,borderRadius:"50%",background:"rgba(255,255,255,.06)",filter:"blur(70px)"}}/>
        <div style={{position:"absolute",bottom:-50,left:-30,width:260,height:260,borderRadius:"50%",background:"rgba(255,255,255,.04)",filter:"blur(60px)"}}/>
        <div style={{maxWidth:1440,margin:"0 auto",position:"relative"}}>
          <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between",gap:20,flexWrap:"wrap",marginBottom:16}}>
            <div>
              <div style={{fontSize:10,color:"rgba(255,255,255,.75)",fontWeight:700,letterSpacing:".15em",marginBottom:4,textTransform:"uppercase"}}>Smart Governance & Citizen Services Platform · Officer Command</div>
              <h1 style={{fontSize:32,fontWeight:900,color:"#fff",lineHeight:1.1,fontFamily:"'DM Serif Display',Georgia,serif",letterSpacing:"-0.02em"}}>{greeting()}, {user?.name?.split(" ")[0]||"Officer"} 👮</h1>
              <p style={{color:"rgba(255,255,255,.75)",fontSize:13,marginTop:5}}>AI Priority · Smart Assignment · Live Map · Cluster Detection · ETA Prediction</p>
            </div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              <button onClick={()=>setActivePage("ControlRoom")} style={{display:"inline-flex",alignItems:"center",gap:6,padding:"9px 16px",borderRadius:10,background:"rgba(255,255,255,.18)",border:"1.5px solid rgba(255,255,255,.35)",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"var(--font)",backdropFilter:"blur(4px)",transition:"var(--transition)",position:"relative"}}>🗺️ Control Room{acClusters>0&&<span style={{position:"absolute",top:-6,right:-6,background:"#dc2626",color:"#fff",fontSize:9,minWidth:16,height:16,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",animation:"pulse 1s infinite"}}>{acClusters}</span>}</button>
              <button onClick={()=>setActivePage("Emergency")} style={{padding:"9px 16px",borderRadius:10,background:"rgba(220,38,38,.8)",border:"1.5px solid rgba(255,255,255,.25)",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"var(--font)"}}>🚨 Emergency</button>
              <button onClick={()=>setActivePage("Analytics")} style={{padding:"9px 16px",borderRadius:10,background:"rgba(255,255,255,.12)",border:"1.5px solid rgba(255,255,255,.28)",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"var(--font)"}}>📊 Analytics</button>
            </div>
          </div>
          <div style={{display:"flex",gap:5,flexWrap:"wrap",alignItems:"center",justifyContent:"space-between"}}>
            <div style={{display:"flex",gap:20,flexWrap:"wrap"}}>
              {[{l:"Total",v:total,c:"#fff"},{l:"Pending",v:pending,c:"#fde68a"},{l:"In Progress",v:assigned,c:"#bae6fd"},{l:"Resolved",v:resolved,c:"#a7f3d0"},{l:"Critical",v:critCount,c:"#fca5a5"},{l:"Clusters",v:acClusters,c:"#fca5a5"},{l:"ETA Risk",v:acBreaches,c:"#fde68a"},{l:"Rate",v:`${resRate}%`,c:"#a7f3d0"}].map(s=>(
                <div key={s.l} style={{display:"flex",alignItems:"center",gap:5}}>
                  <span style={{fontSize:20,fontWeight:900,color:s.c,lineHeight:1}}>{s.v}</span>
                  <span style={{fontSize:10,color:"rgba(255,255,255,.7)",lineHeight:1.3}}>{s.l}</span>
                </div>
              ))}
            </div>
            <div style={{display:"flex",alignItems:"center",gap:6,background:"rgba(16,185,129,.15)",border:"1px solid rgba(16,185,129,.35)",borderRadius:20,padding:"4px 12px"}}>
              <div style={{width:7,height:7,borderRadius:"50%",background:"#10b981",animation:"pulse 2s ease-in-out infinite"}}/>
              <span style={{fontSize:10.5,color:"#10b981",fontWeight:700}}>LIVE SYNC</span>
            </div>
          </div>
        </div>
      </div>

      {/* CRITICAL ALERT BAR */}
      {alerts.filter(a=>!a.read&&a.severity==="critical").length>0&&(
        <div style={{background:"rgba(220,38,38,.07)",borderBottom:"1px solid rgba(220,38,38,.2)",padding:"7px 24px"}}>
          <div style={{maxWidth:1440,margin:"0 auto",display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:11,animation:"pulse 2s infinite"}}>🚨</span>
            <span style={{fontSize:12,color:"#dc2626",fontWeight:600}}>{alerts.find(a=>!a.read&&a.severity==="critical")?.message}</span>
            <button onClick={()=>setAlerts(a=>a.map(x=>({...x,read:true})))} className="btn btn-ghost" style={{marginLeft:"auto",padding:"3px 9px",fontSize:10}}>Dismiss all</button>
          </div>
        </div>
      )}

      {/* NEW COMPLAINT BANNER */}
      {newBanner&&(
        <div style={{background:"rgba(22,163,74,.08)",borderBottom:"1px solid rgba(22,163,74,.25)",padding:"8px 24px",animation:"fadeIn .3s ease"}}>
          <div style={{maxWidth:1440,margin:"0 auto",display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:6,height:6,borderRadius:"50%",background:"#16a34a",animation:"pulse 1s infinite",flexShrink:0}}/>
            <span style={{fontSize:12.5,fontWeight:600,color:"#16a34a"}}>🆕 {newBanner.count} new complaint{newBanner.count>1?"s":""} received</span>
            <span style={{fontSize:11.5,color:"var(--text-muted)"}}>→ {newBanner.depts.join(", ")}</span>
            <button onClick={()=>{setActivePage("Complaints");setNewBanner(null);}} className="btn btn-primary" style={{marginLeft:"auto",padding:"4px 12px",fontSize:11}}>View →</button>
          </div>
        </div>
      )}

      <StorageDebugger count={allComplaints.length} onReload={()=>{const f=safeLoad();setAllComplaints(f);showToast(`Reloaded ${f.length}`,"info");}}/>

      {/* MAIN */}
      <div className="page-inner">

        {/* ══ DASHBOARD ══ */}
        {activePage==="Dashboard"&&(
          <div style={{display:"grid",gridTemplateColumns:"300px 1fr",gap:18}}>
            {/* LEFT */}
            <div style={{display:"flex",flexDirection:"column",gap:16}}>
              {(acClusters>0||acBreaches>0)&&(
                <div style={{background:"rgba(239,68,68,.06)",borderRadius:"var(--radius)",padding:"13px 16px",border:"1px solid var(--red-border)"}}>
                  <div style={{fontSize:10,fontWeight:700,color:"var(--red)",fontFamily:"'DM Serif Display',Georgia,serif",letterSpacing:".1em",marginBottom:8}}>⚡ INTELLIGENCE ALERTS</div>
                  {acClusters>0&&<div onClick={()=>setActivePage("ControlRoom")} style={{display:"flex",alignItems:"center",gap:8,marginBottom:6,cursor:"pointer"}}><span>🚨</span><span style={{fontSize:11.5,color:"var(--red)",flex:1}}>{acClusters} mass incident cluster{acClusters!==1?"s":""}</span><span style={{fontSize:10,color:"var(--red)",fontWeight:600}}>→</span></div>}
                  {acBreaches>0&&<div onClick={()=>setActivePage("ControlRoom")} style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer"}}><span>⏱</span><span style={{fontSize:11.5,color:"var(--yellow)",flex:1}}>{acBreaches} ETA breach prediction{acBreaches!==1?"s":""}</span><span style={{fontSize:10,color:"var(--yellow)",fontWeight:600}}>→</span></div>}
                </div>
              )}
              {/* Donut */}
              <div className="ch" style={{background:"var(--text-primary)",borderRadius:18,padding:20,boxShadow:"0 4px 20px rgba(0,0,0,.18)",animation:"fadeIn .4s ease .05s both",position:"relative",overflow:"hidden"}}>
                <div style={{position:"absolute",top:-30,right:-30,width:120,height:120,borderRadius:"50%",background:"rgba(22,163,74,.15)",filter:"blur(30px)"}}/>
                <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:14}}>
                  <div>
                    <div style={{fontSize:12,color:"var(--text-muted)",fontWeight:600,marginBottom:3}}>{officerDept}</div>
                    <div style={{fontSize:10.5,color:"rgba(255,255,255,.45)"}}>{total} complaints total</div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:5,background:"rgba(22,163,74,.15)",borderRadius:20,padding:"3px 10px"}}>
                    <div style={{width:6,height:6,borderRadius:"50%",background:"#10b981",animation:"pulse 2s ease-in-out infinite"}}/>
                    <span style={{fontSize:10,color:"#10b981",fontWeight:700}}>LIVE</span>
                  </div>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:16}}>
                  <DonutChart resolved={resolved} assigned={assigned} pending={pending} total={total}/>
                  <div style={{flex:1,display:"flex",flexDirection:"column",gap:8}}>
                    {[{l:"Pending",v:pending,c:"#f97316"},{l:"In Progress",v:assigned,c:"#3b82f6"},{l:"Resolved",v:resolved,c:"#10b981"},{l:"Clusters",v:acClusters,c:"#ef4444"},{l:"ETA Risk",v:acBreaches,c:"#f59e0b"}].map(x=>(
                      <div key={x.l} style={{display:"flex",alignItems:"center",gap:8}}>
                        <div style={{width:8,height:8,borderRadius:"50%",background:x.c,flexShrink:0}}/>
                        <span style={{fontSize:11,color:"rgba(255,255,255,.55)",flex:1}}>{x.l}</span>
                        <span style={{fontSize:13,fontWeight:800,color:"#fff"}}>{x.v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              {/* HQ Alerts */}
              <div className="card">
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
                  <span style={{fontSize:16}}>🚨</span>
                  <div style={{fontFamily:"'DM Serif Display',Georgia,serif",fontSize:13,fontWeight:700,color:"var(--text-primary)",flex:1}}>HQ Alerts</div>
                  {unreadAlerts>0&&<span className="tag" style={{background:"var(--red-bg)",color:"var(--red)",border:"1px solid var(--red-border)"}}>{unreadAlerts}</span>}
                </div>
                {alerts.slice(0,4).map((a,i)=>(
                  <div key={a.id} style={{padding:"9px 11px",background:"var(--bg-card-alt)",borderRadius:"var(--radius-sm)",marginBottom:i<3?7:0,border:"1px solid var(--border)",opacity:a.read?0.5:1}}>
                    <div style={{display:"flex",alignItems:"flex-start",gap:8}}>
                      <span style={{fontSize:13}}>{a.severity==="critical"?"🚨":a.severity==="warning"?"⚠️":"📢"}</span>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:12,fontWeight:500,color:a.severity==="critical"?"var(--red)":a.severity==="warning"?"var(--yellow)":"var(--blue)"}}>{a.title}</div>
                        <div style={{fontSize:10.5,color:"var(--text-muted)",marginTop:1,lineHeight:1.4}}>{a.message}</div>
                      </div>
                      {!a.read&&<button onClick={()=>setAlerts(p=>p.map(x=>x.id===a.id?{...x,read:true}:x))} style={{fontSize:10,color:"var(--text-muted)",background:"none",border:"none",cursor:"pointer"}}>✓</button>}
                    </div>
                  </div>
                ))}
              </div>
              {/* Tasks */}
              <div className="card">
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                  <div style={{fontFamily:"'DM Serif Display',Georgia,serif",fontSize:13,fontWeight:700,color:"var(--text-primary)"}}>Tasks</div>
                  <span style={{fontSize:11,color:"var(--text-muted)"}}>{tasksDone}/{tasks.length}</span>
                </div>
                <div style={{height:3,background:"var(--bg-card-alt)",borderRadius:3,marginBottom:12,overflow:"hidden"}}><div style={{height:"100%",width:`${taskPct}%`,background:"var(--green)",borderRadius:3,transition:"width .8s ease"}}/></div>
                {tasks.slice(0,5).map(t=>(
                  <div key={t.id} style={{display:"flex",alignItems:"center",gap:9,padding:"7px 0",borderBottom:"1px solid var(--border)"}}>
                    <button onClick={()=>{const u=tasks.map(x=>x.id===t.id?{...x,done:!x.done}:x);setTasks(u);lsSet(taskKey,u);if(!t.done)addHandover({action:`Done: ${t.title}`,type:"noted"});}} style={{width:18,height:18,borderRadius:5,border:`1.5px solid ${t.done?"var(--green)":"var(--border)"}`,background:t.done?"var(--green)":"transparent",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0,color:"#fff",fontSize:10}}>
                      {t.done?"✓":""}
                    </button>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:12,fontWeight:t.done?400:500,color:t.done?"var(--text3)":"var(--text)",textDecoration:t.done?"line-through":"none",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{t.title}</div>
                      <div style={{fontSize:9.5,color:"var(--text-muted)",fontFamily:"var(--font-mono)"}}>{t.dueTime}</div>
                    </div>
                    <PBadge p={t.priority}/>
                  </div>
                ))}
                <div style={{display:"flex",gap:7,marginTop:10}}>
                  <input value={newTask} onChange={e=>setNewTask(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&newTask.trim()){const t:Task={id:`t-${Date.now()}`,title:newTask,description:"",priority:"Medium",category:"Custom",dueTime:"EOD",done:false,createdAt:new Date().toISOString()};const u=[...tasks,t];setTasks(u);lsSet(taskKey,u);setNewTask("");}}} placeholder="Add task…" className="input" style={{flex:1,fontSize:12}}/>
                  <button onClick={()=>{if(newTask.trim()){const t:Task={id:`t-${Date.now()}`,title:newTask,description:"",priority:"Medium",category:"Custom",dueTime:"EOD",done:false,createdAt:new Date().toISOString()};const u=[...tasks,t];setTasks(u);lsSet(taskKey,u);setNewTask("");}}} className="btn btn-primary" style={{padding:"9px 12px"}}>+</button>
                </div>
              </div>
            </div>

            {/* RIGHT */}
            <div style={{display:"flex",flexDirection:"column",gap:16}}>
              {/* Stat cards */}
              <div className="grid-cols-4" style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:13}}>
                {[{l:"Incoming",v:pending,icon:"📥",c:"#ea580c",bg:"linear-gradient(135deg,#ea580c,#f97316)",action:()=>{setActivePage("Complaints");setStatusFilter("Pending");}},{l:"In Progress",v:assigned,icon:"⚙️",c:"#7c3aed",bg:"linear-gradient(135deg,#7c3aed,#8b5cf6)",action:()=>{setActivePage("Complaints");setStatusFilter("Assigned");}},{l:"Clusters",v:acClusters,icon:"🚨",c:"#dc2626",bg:"linear-gradient(135deg,#dc2626,#ef4444)",action:()=>setActivePage("ControlRoom")},{l:"ETA Risk",v:acBreaches,icon:"⏱",c:"#d97706",bg:"linear-gradient(135deg,#d97706,#f59e0b)",action:()=>setActivePage("ControlRoom")}].map((s,i)=>(
                  <div key={s.l} onClick={s.action} className="ch card" style={{cursor:"pointer",animation:`fadeIn .4s ease ${i*.05}s both`,background:"var(--bg-card)"}}>
                    <div style={{width:38,height:38,borderRadius:11,background:s.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,boxShadow:`0 4px 14px ${s.c}35`,marginBottom:12}}>{s.icon}</div>
                    <div style={{fontSize:32,fontWeight:900,color:"var(--text-primary)",lineHeight:1}}>{s.v}</div>
                    <div style={{fontSize:12.5,fontWeight:600,color:"var(--text-muted)",marginTop:5}}>{s.l}</div>
                  </div>
                ))}
              </div>
              {/* AI Priority Queue */}
              <div className="card">
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
                  <div>
                    <div style={{fontSize:9.5,color:"var(--text-muted)",fontWeight:600,letterSpacing:".1em",fontFamily:"'DM Serif Display',Georgia,serif",marginBottom:2}}>AI PRIORITY</div>
                    <div style={{fontFamily:"'DM Serif Display',Georgia,serif",fontWeight:700,fontSize:15,color:"var(--text-primary)"}}>Incoming Queue</div>
                  </div>
                  <div style={{display:"flex",gap:7}}>
                    <select value={deptFilter} onChange={e=>setDeptFilter(e.target.value as any)} className="input" style={{width:"auto",padding:"4px 8px",fontSize:11}}><option>My Dept</option><option>All Depts</option></select>
                    <button onClick={()=>setActivePage("Complaints")} className="btn btn-primary" style={{padding:"5px 12px",fontSize:11}}>View All</button>
                  </div>
                </div>
                {deptC.filter(c=>c.status!=="Resolved").sort((a,b)=>new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime()).slice(0,5).map(c=>{
                  const ps=PRIORITY_STYLE[c.priority as keyof typeof PRIORITY_STYLE]||PRIORITY_STYLE.Low;
                  return(
                    <div key={c.id} onClick={()=>setSelC(c)} style={{display:"flex",alignItems:"flex-start",gap:11,padding:"11px",borderRadius:"var(--radius-sm)",marginBottom:7,background:"var(--bg-card-alt)",border:"1px solid var(--border)",cursor:"pointer",transition:"var(--transition)"}} onMouseEnter={e=>(e.currentTarget.style.borderColor="var(--border2)")} onMouseLeave={e=>(e.currentTarget.style.borderColor="var(--border)")}>
                      <div style={{width:28,height:28,borderRadius:7,background:ps.bg,border:`1px solid ${ps.border}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,flexDirection:"column"}}>
                        <span style={{fontFamily:"var(--font-mono)",fontSize:9,fontWeight:700,color:ps.text,lineHeight:1}}>{c.aiPriority}</span>
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:3}}>
                          <PBadge p={c.priority||"Low"}/>{c.emergency&&<Pill color="red">🚨</Pill>}{c.clusterGroup&&<Pill color="red">⛓</Pill>}{c.etaBreachPredicted&&<Pill color="yellow">⏱</Pill>}{c.aiRouted&&<span style={{fontSize:9.5,color:"var(--purple)"}}>🤖</span>}
                        </div>
                        <div style={{fontSize:13,fontWeight:500,color:"var(--text-primary)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{c.title||c.category||"Complaint"}</div>
                        <div style={{fontSize:10.5,color:"var(--text-muted)",marginTop:2}}>{c.userName&&`👤 ${c.userName}`} {new Date(c.createdAt).toLocaleDateString("en-IN")}</div>
                      </div>
                      <button onClick={e=>{e.stopPropagation();setSelC(c);}} className="btn btn-primary" style={{padding:"4px 9px",fontSize:10,flexShrink:0}}>Assign</button>
                    </div>
                  );
                })}
                {deptC.filter(c=>c.status!=="Resolved").length===0&&<div style={{textAlign:"center",padding:"24px",color:"var(--text-muted)"}}><div style={{fontSize:24,marginBottom:4}}>🎉</div>All caught up!</div>}
              </div>
              {/* Charts + AI */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 300px",gap:14}}>
                <div className="card">
                  <div style={{fontFamily:"'DM Serif Display',Georgia,serif",fontWeight:700,fontSize:13,color:"var(--text-primary)",marginBottom:12}}>6-Month Velocity</div>
                  <VelocityChart complaints={deptC}/>
                </div>
                <div className="card" style={{display:"flex",flexDirection:"column",padding:0,overflow:"hidden",minHeight:260}}>
                  <div style={{padding:"13px 16px 10px",borderBottom:"1px solid var(--border)",display:"flex",alignItems:"center",gap:9,flexShrink:0}}>
                    <div style={{width:28,height:28,borderRadius:8,background:"var(--green-bg)",border:"1px solid var(--green-border)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12}}>👮</div>
                    <div><div style={{fontFamily:"'DM Serif Display',Georgia,serif",fontSize:12.5,fontWeight:700,color:"var(--text-primary)"}}>Command AI</div><div style={{fontSize:9.5,color:"var(--text-muted)"}}>Cluster · ETA · Video</div></div>
                  </div>
                  <div style={{flex:1,minHeight:0,display:"flex",flexDirection:"column"}}><AIAssistantPanel officerName={user?.name||"Officer"} dept={officerDept}/></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══ COMPLAINTS ══ */}
        {activePage==="Complaints"&&(
          <div>
            <ClusterBanner clusters={clusters} onDismiss={id=>setDimCl(s=>new Set([...s,id]))} onViewAll={()=>setActivePage("ControlRoom")}/>
            <EtaBreachPanel breaches={etaBreaches} onDismiss={id=>setDimBr(s=>new Set([...s,id]))}/>
            <AutoEscalationPanel pendingEscalations={autoEscalations} onManualAssign={c=>setSelC(c)} onDismiss={id=>setDimEs(s=>new Set([...s,id]))}/>
            <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
              <div style={{flex:1,minWidth:200,position:"relative"}}>
                <svg style={{position:"absolute",left:11,top:"50%",transform:"translateY(-50%)",color:"var(--text-muted)"}} width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path strokeLinecap="round" d="m21 21-4.35-4.35"/></svg>
                <input value={searchQ} onChange={e=>setSearchQ(e.target.value)} placeholder="Search complaints, tickets, citizens…" className="input" style={{paddingLeft:33}}/>
              </div>
              <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value as any)} className="input" style={{width:"auto",padding:"9px 12px"}}>{["All","Pending","Assigned","In Progress","Resolved"].map(s=><option key={s}>{s}</option>)}</select>
              <select value={priorityFilter} onChange={e=>setPriorityFilter(e.target.value as any)} className="input" style={{width:"auto",padding:"9px 12px"}}>{["All","Critical","High","Medium","Low"].map(p=><option key={p}>{p}</option>)}</select>
              <select value={sortBy} onChange={e=>setSortBy(e.target.value as any)} className="input" style={{width:"auto",padding:"9px 12px"}}><option value="priority">AI Priority</option><option value="date">Date</option><option value="status">Status</option></select>
              <select value={deptFilter} onChange={e=>setDeptFilter(e.target.value as any)} className="input" style={{width:"auto",padding:"9px 12px"}}><option>My Dept</option><option>All Depts</option></select>
            </div>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
              <div style={{fontSize:12,color:"var(--text-muted)"}}><strong style={{color:"var(--text-primary)"}}>{filteredC.length}</strong> complaints</div>
              <div style={{display:"flex",gap:6}}>
                {(["All","Pending","Assigned","In Progress","Resolved"] as const).map(s=>{
                  const cnt={All:total,Pending:pending,Assigned:assigned,"In Progress":assigned,Resolved:resolved}[s]||0;
                  return<button key={s} onClick={()=>setStatusFilter(s)} className="btn btn-ghost" style={{padding:"4px 10px",fontSize:11,background:statusFilter===s?"var(--green-bg)":"transparent",color:statusFilter===s?"var(--green)":"var(--text3)",borderColor:statusFilter===s?"var(--green-border)":"var(--border)"}}>{s} {cnt}</button>;
                })}
              </div>
            </div>
            {filteredC.length===0?<div style={{textAlign:"center",padding:"60px",background:"var(--bg-card)",borderRadius:"var(--radius)",border:"1px solid var(--border)"}}><div style={{fontSize:44,marginBottom:12}}>📭</div><div style={{color:"var(--text-muted)"}}>No complaints match</div><button onClick={()=>{setSearchQ("");setStatusFilter("All");setPriorityFilter("All");}} className="btn btn-primary" style={{marginTop:12}}>Clear Filters</button></div>:
            <div style={{display:"flex",flexDirection:"column",gap:7}}>
              {filteredC.map((c,idx)=>{
                const ps=PRIORITY_STYLE[c.priority as keyof typeof PRIORITY_STYLE]||PRIORITY_STYLE.Low;
                return(
                  <div key={c.id} onClick={()=>setSelC(c)} style={{background:"var(--bg-card)",borderRadius:"var(--radius)",padding:"13px 15px",border:"1px solid var(--border)",cursor:"pointer",transition:"var(--transition)",animation:`fadeUp .25s ease ${Math.min(idx*.03,.2)}s both"}`}} onMouseEnter={e=>{(e.currentTarget as HTMLDivElement).style.borderColor="var(--border2)";(e.currentTarget as HTMLDivElement).style.background="var(--surface2)";}} onMouseLeave={e=>{(e.currentTarget as HTMLDivElement).style.borderColor="var(--border)";(e.currentTarget as HTMLDivElement).style.background="var(--surface)";}}>
                    <div style={{display:"flex",alignItems:"flex-start",gap:12}}>
                      <div style={{width:28,height:28,borderRadius:7,background:ps.bg,border:`1px solid ${ps.border}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                        <span style={{fontFamily:"var(--font-mono)",fontSize:9,fontWeight:700,color:ps.text}}>{c.aiPriority}</span>
                      </div>
                      <div style={{width:36,height:36,borderRadius:9,background:"var(--bg-card-alt)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,flexShrink:0,position:"relative"}}>
                        {DEPT_ICON[c.department||""]||"🏛️"}
                        {c.emergency&&<div style={{position:"absolute",top:-2,right:-2,width:10,height:10,borderRadius:"50%",background:"var(--red)",border:"1.5px solid var(--bg2)",animation:"pulse 2s infinite"}}/>}
                        {c.clusterGroup&&<div style={{position:"absolute",bottom:-2,right:-2,width:9,height:9,borderRadius:"50%",background:"var(--orange)",border:"1.5px solid var(--bg2)",animation:"pulse 1.5s infinite"}}/>}
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{display:"flex",gap:5,marginBottom:4,flexWrap:"wrap",alignItems:"center"}}>
                          <Badge status={c.status}/><PBadge p={c.priority||"Low"}/>
                          {c.emergency&&<Pill color="red">🚨 Emergency</Pill>}
                          {c.clusterGroup&&<Pill color="red">⛓ Cluster</Pill>}
                          {c.etaBreachPredicted&&<Pill color="yellow">⏱ ETA</Pill>}
                          {c.interAgencyDispatched&&c.interAgencyDispatched.length>0&&<Pill color="red">🚔 Multi-Agency</Pill>}
                          {c.escalated&&<Pill color="purple">↑ Escalated</Pill>}
                          {c.aiRouted&&<span style={{fontSize:9.5,color:"var(--purple)"}}>🤖</span>}
                          {c.ticketId&&<span style={{fontSize:9,color:"var(--text-muted)",fontFamily:"var(--font-mono)",background:"var(--bg-card-alt)",padding:"1px 6px",borderRadius:4,border:"1px solid var(--border)"}}>{c.ticketId}</span>}
                        </div>
                        <div style={{fontSize:13.5,fontWeight:500,color:"var(--text-primary)",marginBottom:3}}>{c.title||c.category||"Complaint"}</div>
                        <div style={{display:"flex",gap:9,flexWrap:"wrap",fontSize:10.5,color:"var(--text-muted)"}}>
                          {c.department&&<span style={{color:DEPT_COLOR[c.department]||"var(--text3)"}}>{DEPT_ICON[c.department]} {c.department}</span>}
                          {c.userName&&<span>👤 {c.userName}</span>}
                          <span style={{fontFamily:"var(--font-mono)"}}>{new Date(c.createdAt).toLocaleDateString("en-IN",{day:"2-digit",month:"short"})}</span>
                          {c.assignedWorker&&<span style={{color:"var(--green)"}}>🔧 {c.assignedWorker}</span>}
                        </div>
                      </div>
                      <div style={{display:"flex",flexDirection:"column",gap:5,flexShrink:0}}>
                        <button onClick={e=>{e.stopPropagation();setSelC(c);}} className="btn btn-primary" style={{padding:"5px 12px",fontSize:11}}>Open</button>
                        {c.status==="Pending"&&<button onClick={e=>{e.stopPropagation();quickStatus(c.id,"Assigned");}} className="btn btn-ghost" style={{padding:"4px 10px",fontSize:10.5}}>Assign</button>}
                        {c.status==="Assigned"&&<button onClick={e=>{e.stopPropagation();quickStatus(c.id,"Resolved");}} className="btn btn-ghost" style={{padding:"4px 10px",fontSize:10.5,color:"var(--green)",borderColor:"var(--green-border)"}}>✓ Resolve</button>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>}
          </div>
        )}

        {/* ══ WORKERS ══ */}
        {activePage==="Workers"&&(
          <div style={{display:"flex",flexDirection:"column",gap:20}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div><div style={{fontSize:9.5,color:"var(--text-muted)",fontWeight:600,letterSpacing:".1em",fontFamily:"'DM Serif Display',Georgia,serif",marginBottom:2}}>FIELD WORKERS</div><div style={{fontFamily:"'DM Serif Display',Georgia,serif",fontSize:20,fontWeight:800,color:"var(--text-primary)"}}>All Departments</div><div style={{fontSize:11,color:"var(--text-muted)",marginTop:2}}>{liveWorkers.length} worker{liveWorkers.length!==1?"s":""} registered</div></div>
              <div style={{display:"flex",gap:10}}>{[{c:"var(--green)",l:"Available"},{c:"var(--yellow)",l:"Busy"},{c:"var(--text3)",l:"Offline"}].map(x=><div key={x.l} style={{display:"flex",gap:5,alignItems:"center"}}><div style={{width:7,height:7,borderRadius:"50%",background:x.c}}/><span style={{fontSize:11,color:"var(--text-muted)"}}>{x.l}</span></div>)}</div>
            </div>
            <WorkersPanel dept={officerDept} complaints={allComplaints} workers={liveWorkers}/>
            {liveWorkers.length===0&&(
              <div style={{textAlign:"center",padding:"32px",background:"var(--bg-card-alt)",borderRadius:14,border:"1.5px dashed var(--border)",marginTop:16}}>
                <div style={{fontSize:32,marginBottom:8}}>👷</div>
                <div style={{fontSize:14,fontWeight:700,color:"var(--text-secondary)"}}>No workers loaded yet</div>
                <div style={{fontSize:12,color:"var(--text-muted)",marginTop:4}}>Workers are loaded from the backend. Make sure workers are registered in the system.</div>
              </div>
            )}
            <div>
              <div style={{fontSize:9.5,color:"var(--text-muted)",fontWeight:600,letterSpacing:".1em",fontFamily:"'DM Serif Display',Georgia,serif",marginBottom:12}}>PERFORMANCE TABLE</div>
              <div className="card" style={{padding:0,overflow:"hidden"}}>
                <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr 1fr",background:"var(--bg-card-alt)",padding:"9px 16px",gap:10}}>
                  {["Worker","Status","Load","Done","Avg Time","Rating"].map(h=><div key={h} style={{fontSize:9.5,fontWeight:700,color:"var(--text-muted)",textTransform:"uppercase",letterSpacing:".08em",fontFamily:"'DM Serif Display',Georgia,serif"}}>{h}</div>)}
                </div>
                {liveWorkers.sort((a,b)=>b.rating-a.rating).map(w=>{
                  const sc=w.status==="available"?"var(--green)":w.status==="busy"?"var(--yellow)":"var(--text3)",lp=(w.currentLoad/w.maxLoad)*100;
                  return(
                    <div key={w.id} style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr 1fr",padding:"11px 16px",borderTop:"1px solid var(--border)",gap:10,alignItems:"center"}}>
                      <div style={{display:"flex",alignItems:"center",gap:9}}><div style={{width:30,height:30,borderRadius:"50%",background:"var(--bg-card-alt)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13}}>{DEPT_ICON[w.dept]||"🔧"}</div><div><div style={{fontSize:13,fontWeight:500,color:"var(--text-primary)"}}>{w.name}</div><div style={{fontSize:10,color:"var(--text-muted)"}}>{w.location.area}</div></div></div>
                      <span style={{fontSize:11,fontWeight:500,color:sc}}>● {w.status}</span>
                      <div><div style={{fontSize:10,color:"var(--text-muted)",marginBottom:3,fontFamily:"var(--font-mono)"}}>{w.currentLoad}/{w.maxLoad}</div><div style={{height:4,background:"var(--bg-card-alt)",borderRadius:2}}><div style={{height:"100%",width:`${lp}%`,background:lp>=80?"var(--red)":lp>=50?"var(--yellow)":"var(--green)",borderRadius:2}}/></div></div>
                      <span style={{fontFamily:"'DM Serif Display',Georgia,serif",fontSize:14,fontWeight:700,color:"var(--purple)"}}>{w.completedToday}</span>
                      <span style={{fontSize:13,fontWeight:500,color:w.avgResolutionHrs<2?"var(--green)":w.avgResolutionHrs<5?"var(--yellow)":"var(--red)"}}>{w.avgResolutionHrs}h</span>
                      <span style={{fontFamily:"'DM Serif Display',Georgia,serif",fontSize:14,fontWeight:700,color:w.rating>=4.7?"var(--green)":w.rating>=4?"var(--yellow)":"var(--red)"}}>{w.rating}★</span>
                    </div>
                  );
                })}
                {liveWorkers.filter(w=>w.dept===officerDept).length===0&&<div style={{padding:"32px",textAlign:"center",color:"var(--text-muted)"}}>No workers</div>}
              </div>
            </div>
          </div>
        )}

        {/* ══ HEATMAP ══ */}
        {activePage==="Heatmap"&&(
          <div>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,flexWrap:"wrap",gap:10}}>
              <div><div style={{fontSize:9.5,color:"var(--text-muted)",fontWeight:600,letterSpacing:".1em",fontFamily:"'DM Serif Display',Georgia,serif",marginBottom:2}}>CITY-WIDE DISTRIBUTION</div><div style={{fontFamily:"'DM Serif Display',Georgia,serif",fontSize:20,fontWeight:800,color:"var(--text-primary)"}}>🗺️ Heatmap</div></div>
              <div style={{display:"flex",gap:6}}>{(["My Dept","All Depts"] as const).map(v=><button key={v} onClick={()=>setDeptFilter(v)} className="btn btn-ghost" style={{background:deptFilter===v?"var(--green-bg)":"transparent",color:deptFilter===v?"var(--green)":"var(--text3)",borderColor:deptFilter===v?"var(--green-border)":"var(--border)"}}>{v}</button>)}</div>
            </div>
            <div className="card" style={{padding:0,overflow:"hidden"}}>
              <ComplaintHeatmap complaints={deptFilter==="My Dept"?deptC:allComplaints}/>
            </div>
          </div>
        )}

        {/* ══ ANALYTICS ══ */}
        {activePage==="Analytics"&&(
          <div style={{display:"flex",flexDirection:"column",gap:16}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
              <div><div style={{fontSize:9.5,color:"var(--text-muted)",fontWeight:600,letterSpacing:".1em",fontFamily:"'DM Serif Display',Georgia,serif",marginBottom:2}}>INTELLIGENCE</div><div style={{fontFamily:"'DM Serif Display',Georgia,serif",fontSize:20,fontWeight:800,color:"var(--text-primary)"}}>📊 Analytics</div></div>
              <div style={{display:"flex",gap:6}}>{(["My Dept","All Depts"] as const).map(v=><button key={v} onClick={()=>setDeptFilter(v)} className="btn btn-ghost" style={{background:deptFilter===v?"var(--green-bg)":"transparent",color:deptFilter===v?"var(--green)":"var(--text3)",borderColor:deptFilter===v?"var(--green-border)":"var(--border)"}}>{v}</button>)}</div>
            </div>
            <div className="grid-cols-4" style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>
              {[{l:"Resolution",v:`${resRate}%`,icon:"📈",c:"var(--green)",sub:`${resolved}/${total}`},{l:"Pending",v:pending,icon:"⏳",c:"var(--orange)",sub:"need action"},{l:"Clusters",v:acClusters,icon:"🚨",c:"var(--red)",sub:"detected"},{l:"ETA Risk",v:acBreaches,icon:"⏱",c:"var(--yellow)",sub:"predicted"}].map(s=>(
                <div key={s.l} className="card">
                  <div style={{fontSize:20,marginBottom:10}}>{s.icon}</div>
                  <div style={{fontFamily:"'DM Serif Display',Georgia,serif",fontSize:26,fontWeight:800,color:s.c,lineHeight:1}}>{s.v}</div>
                  <div style={{fontSize:12,color:"var(--text-primary)",marginTop:5,fontWeight:500}}>{s.l}</div>
                  <div style={{fontSize:10.5,color:"var(--text-muted)",marginTop:2}}>{s.sub}</div>
                </div>
              ))}
            </div>
            <div className="card">
              <div style={{fontFamily:"'DM Serif Display',Georgia,serif",fontWeight:700,fontSize:14,color:"var(--text-primary)",marginBottom:14}}>📈 Complaint Velocity — 6 Months</div>
              <VelocityChart complaints={deptFilter==="My Dept"?deptC:allComplaints}/>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
              <div className="card">
                <div style={{fontFamily:"'DM Serif Display',Georgia,serif",fontWeight:700,fontSize:13,color:"var(--text-primary)",marginBottom:14}}>Status Distribution</div>
                {[{l:"Pending",v:pending,c:"var(--orange)"},{l:"In Progress",v:assigned,c:"var(--blue)"},{l:"Resolved",v:resolved,c:"var(--green)"},{l:"Escalated",v:escalated,c:"var(--red)"}].map(s=>{
                  const pct=total>0?Math.round((s.v/total)*100):0;
                  return(<div key={s.l} style={{marginBottom:12}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}><span style={{fontSize:12,color:"var(--text-secondary)"}}>{s.l}</span><span style={{fontSize:12,fontWeight:600,color:s.c,fontFamily:"var(--font-mono)"}}>{s.v} ({pct}%)</span></div><div style={{height:6,background:"var(--bg-card-alt)",borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:`${pct}%`,background:s.c,borderRadius:3,transition:"width .8s ease"}}/></div></div>);
                })}
              </div>
              <div className="card">
                <div style={{fontFamily:"'DM Serif Display',Georgia,serif",fontWeight:700,fontSize:13,color:"var(--text-primary)",marginBottom:14}}>Priority Breakdown</div>
                {[{l:"Critical",v:deptC.filter(x=>x.priority==="Critical").length,c:"var(--red)"},{l:"High",v:deptC.filter(x=>x.priority==="High").length,c:"var(--orange)"},{l:"Medium",v:deptC.filter(x=>x.priority==="Medium").length,c:"var(--yellow)"},{l:"Low",v:deptC.filter(x=>x.priority==="Low").length,c:"var(--green)"}].map(s=>{
                  const pct=total>0?Math.round((s.v/total)*100):0;
                  return(<div key={s.l} style={{marginBottom:12}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}><span style={{fontSize:12,color:"var(--text-secondary)"}}>● {s.l}</span><span style={{fontSize:12,fontWeight:600,color:s.c,fontFamily:"var(--font-mono)"}}>{s.v} ({pct}%)</span></div><div style={{height:6,background:"var(--bg-card-alt)",borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:`${pct}%`,background:s.c,borderRadius:3,transition:"width .8s ease"}}/></div></div>);
                })}
              </div>
            </div>
            <div className="card" style={{padding:0,overflow:"hidden"}}>
              <div style={{padding:"14px 20px",borderBottom:"1px solid var(--border)",fontFamily:"'DM Serif Display',Georgia,serif",fontWeight:700,fontSize:13,color:"var(--text-primary)"}}>Department Performance</div>
              <div style={{overflowX:"auto"}}>
                <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr",minWidth:480}}>
                  {["Department","Total","Resolved","Pending","Rate"].map(h=><div key={h} style={{padding:"9px 16px",fontSize:9.5,fontWeight:700,color:"var(--text-muted)",textTransform:"uppercase",letterSpacing:".08em",fontFamily:"'DM Serif Display',Georgia,serif",background:"var(--bg-card-alt)",borderBottom:"1px solid var(--border)"}}>{h}</div>)}
                  {DEPT_LIST.map(dept=>{
                    const dt=allComplaints.filter(x=>x.department===dept),dr=dt.filter(x=>x.status==="Resolved").length,dp=dt.filter(x=>x.status==="Pending").length,rate=dt.length>0?Math.round((dr/dt.length)*100):0,isMy=dept===officerDept;
                    return[
                      <div key={`d${dept}`} style={{padding:"11px 16px",borderBottom:"1px solid var(--border)",display:"flex",alignItems:"center",gap:8,background:isMy?"rgba(16,185,129,.04)":"transparent"}}>
                        <div style={{width:26,height:26,borderRadius:7,background:"var(--bg-card-alt)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12}}>{DEPT_ICON[dept]}</div>
                        <div><div style={{fontSize:12.5,fontWeight:500,color:"var(--text-primary)"}}>{dept}</div>{isMy&&<div style={{fontSize:9,color:"var(--green)",fontWeight:700,fontFamily:"'DM Serif Display',Georgia,serif"}}>MY DEPT</div>}</div>
                      </div>,
                      <div key={`t${dept}`} style={{padding:"11px 16px",borderBottom:"1px solid var(--border)",fontFamily:"'DM Serif Display',Georgia,serif",fontSize:14,fontWeight:700,color:"var(--text-primary)",display:"flex",alignItems:"center",background:isMy?"rgba(16,185,129,.04)":"transparent"}}>{dt.length}</div>,
                      <div key={`r${dept}`} style={{padding:"11px 16px",borderBottom:"1px solid var(--border)",fontFamily:"'DM Serif Display',Georgia,serif",fontSize:14,fontWeight:700,color:"var(--green)",display:"flex",alignItems:"center",background:isMy?"rgba(16,185,129,.04)":"transparent"}}>{dr}</div>,
                      <div key={`p${dept}`} style={{padding:"11px 16px",borderBottom:"1px solid var(--border)",fontFamily:"'DM Serif Display',Georgia,serif",fontSize:14,fontWeight:700,color:"var(--orange)",display:"flex",alignItems:"center",background:isMy?"rgba(16,185,129,.04)":"transparent"}}>{dp}</div>,
                      <div key={`rt${dept}`} style={{padding:"11px 16px",borderBottom:"1px solid var(--border)",display:"flex",alignItems:"center",background:isMy?"rgba(16,185,129,.04)":"transparent"}}><div style={{width:"100%"}}><span style={{fontFamily:"var(--font-mono)",fontSize:12,fontWeight:600,color:rate>=70?"var(--green)":rate>=40?"var(--yellow)":"var(--red)"}}>{rate}%</span><div style={{height:3,background:"var(--bg-card-alt)",borderRadius:2,marginTop:4}}><div style={{height:"100%",width:`${rate}%`,background:rate>=70?"var(--green)":rate>=40?"var(--yellow)":"var(--red)",borderRadius:2}}/></div></div></div>,
                    ];
                  })}
                </div>
              </div>
            </div>

            {/* ── ADMIN PIPELINE AUDIT TRAIL ── */}
            <AdminPipelinePanel officerName={user?.name||"Officer"}/>
          </div>
        )}

        {/* ══ MESSAGES ══ */}
        {activePage==="Messages"&&(
          <div>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
              <div><div style={{fontSize:9.5,color:"var(--text-muted)",fontWeight:600,letterSpacing:".1em",fontFamily:"'DM Serif Display',Georgia,serif",marginBottom:2}}>COMMUNICATIONS</div><div style={{fontFamily:"'DM Serif Display',Georgia,serif",fontSize:20,fontWeight:800,color:"var(--text-primary)"}}>Messages</div><div style={{fontSize:11,color:"var(--text-muted)",marginTop:2}}>Messages sent by workers via their chat panel appear here</div></div>
              {unreadMsgs>0&&<span className="tag" style={{background:"var(--blue-bg)",color:"var(--blue)",border:"1px solid rgba(59,130,246,.3)",fontSize:12}}>{unreadMsgs} unread</span>}
            </div>
            <MessagesPanel complaints={allComplaints} officerName={user?.name||"Officer"}/>
          </div>
        )}

        {/* ══ CONTROL ROOM ══ */}
        {activePage==="ControlRoom"&&(
          <ControlRoomView
            allComplaints={allComplaints}
            deptComplaints={deptC}
            liveWorkers={liveWorkers}
            clusters={clusters}
            etaBreaches={etaBreaches}
            autoEscalations={autoEscalations}
            officerName={user?.name||"Officer"}
            onSelectComplaint={c=>setSelC(c)}
            onDismissCluster={id=>setDimCl(s=>new Set([...s,id]))}
            onDismissBreach={id=>setDimBr(s=>new Set([...s,id]))}
            onManualAssign={c=>setSelC(c)}
            onDismissEscalation={id=>setDimEs(s=>new Set([...s,id]))}
            onViewMap={()=>setActivePage("ControlRoom")}
          />
        )}

        {/* ══ EMERGENCY ══ */}
        {activePage==="Emergency"&&(
          <div>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,flexWrap:"wrap",gap:10}}>
              <div><div style={{fontSize:9.5,color:"var(--text-muted)",fontWeight:600,letterSpacing:".1em",fontFamily:"'DM Serif Display',Georgia,serif",marginBottom:2}}>COMMAND CENTER</div><div style={{fontFamily:"'DM Serif Display',Georgia,serif",fontSize:20,fontWeight:800,color:"var(--text-primary)"}}>🚨 Emergency Dispatch</div></div>
              <div style={{fontSize:11,color:"var(--text-muted)"}}>Live SOS · WebRTC · Multi-agency</div>
            </div>
            <EmergencyDispatchView officerName={user?.name||"Officer"} workers={liveWorkers} onShowToast={showToast}/>
          </div>
        )}

        {/* ══ PROFILE ══ */}
        {activePage==="Profile"&&(
          <div style={{maxWidth:820,margin:"0 auto",padding:"20px 0"}}>
          <div style={{background:"linear-gradient(135deg,#14532d 0%,#15803d 35%,#16a34a 65%,#22c55e 100%)",borderRadius:22,padding:"32px 36px",marginBottom:20,position:"relative",overflow:"hidden",boxShadow:"0 8px 32px rgba(22,163,74,.25)"}}>
              <div style={{position:"absolute",inset:0,backgroundImage:"radial-gradient(circle at 1px 1px,rgba(255,255,255,.07) 1px,transparent 0)",backgroundSize:"28px 28px"}}/>
              <div style={{position:"absolute",top:-60,right:-60,width:300,height:300,borderRadius:"50%",background:"rgba(255,255,255,.06)",filter:"blur(60px)"}}/>
              <div style={{position:"absolute",bottom:-40,left:-40,width:200,height:200,borderRadius:"50%",background:"rgba(255,255,255,.04)",filter:"blur(40px)"}}/>
              <div style={{position:"relative",display:"flex",alignItems:"center",gap:22,flexWrap:"wrap"}}>
                <div style={{position:"relative",flexShrink:0}}>
                  <div style={{width:72,height:72,borderRadius:20,background:"rgba(255,255,255,.2)",border:"2.5px solid rgba(255,255,255,.35)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,fontSize:28,color:"#fff",backdropFilter:"blur(10px)"}}>{user?.name?.charAt(0)||"O"}</div>
                  <div style={{position:"absolute",bottom:-3,right:-3,width:20,height:20,borderRadius:"50%",background:"#22c55e",border:"2.5px solid white",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:"#fff",fontWeight:800}}>✓</div>
                </div>
                <div style={{flex:1}}>
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:4,flexWrap:"wrap"}}>
                    <h2 style={{fontSize:24,fontWeight:900,color:"#fff",lineHeight:1,fontFamily:"'DM Serif Display',serif"}}>{user?.name||"Officer"}</h2>
                    <span style={{background:"rgba(255,255,255,.2)",color:"#fff",fontSize:10,fontWeight:700,padding:"3px 10px",borderRadius:20,border:"1px solid rgba(255,255,255,.3)"}}>👮 OFFICER</span>
                  </div>
                  <div style={{fontSize:12.5,color:"rgba(255,255,255,.8)",marginBottom:2}}>{user?.email||""}</div>
                  <div style={{fontSize:11,color:"rgba(255,255,255,.65)"}}>⚖️ Field Officer · {officerDept}</div>
                  {shiftActive&&<div style={{display:"inline-flex",alignItems:"center",gap:5,background:"rgba(255,255,255,.15)",borderRadius:20,padding:"4px 11px",marginTop:8}}>
                    <div style={{width:6,height:6,borderRadius:"50%",background:"#4ade80",animation:"pulse 2s infinite"}}/>
                    <span style={{fontSize:10.5,color:"#dcfce7",fontWeight:600}}>On Shift · {fmtDur(shiftSec)}</span>
                  </div>}
                </div>
                <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
                  {[{l:"Total",v:allComplaints.length,i:"📋"},{l:"Resolved",v:allComplaints.filter(x=>x.status==="Resolved").length,i:"✅"},{l:"AI Routed",v:aiRouted,i:"🤖"},{l:"Escalated",v:escalated,i:"↑"}].map(s=>(
                    <div key={s.l} style={{textAlign:"center",background:"rgba(255,255,255,.15)",borderRadius:14,padding:"12px 16px",backdropFilter:"blur(10px)",border:"1px solid rgba(255,255,255,.2)",minWidth:68}}>
                      <div style={{fontSize:18,marginBottom:2}}>{s.i}</div>
                      <div style={{fontSize:20,fontWeight:900,color:"#fff",lineHeight:1}}>{s.v}</div>
                      <div style={{fontSize:10,color:"rgba(255,255,255,.75)",fontWeight:600,marginTop:2}}>{s.l}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
              <div className="card">
                <div style={{fontFamily:"'DM Serif Display',Georgia,serif",fontSize:13,fontWeight:700,color:"var(--text-primary)",marginBottom:14}}>Account Information</div>
                {[{l:"Full Name",v:user?.name||"—"},{l:"Email",v:user?.email||"—"},{l:"Role",v:"Field Officer"},{l:"Department",v:officerDept},{l:"Employee ID",v:"AP-"+(user?.id||"001").slice(-6).toUpperCase()},{l:"Features",v:"Cluster · ETA · Video · Multi-Agency"}].map(row=>(
                  <div key={row.l} style={{display:"flex",alignItems:"center",padding:"9px 0",borderBottom:"1px solid var(--border)"}}>
                    <div style={{width:110,fontSize:11,color:"var(--text-muted)",fontWeight:500,flexShrink:0}}>{row.l}</div>
                    <div style={{flex:1,fontSize:12.5,color:"var(--text-primary)",wordBreak:"break-all"}}>{row.v}</div>
                  </div>
                ))}
              </div>
              <div className="card">
                <div style={{fontFamily:"'DM Serif Display',Georgia,serif",fontSize:13,fontWeight:700,color:"var(--text-primary)",marginBottom:14}}>Performance</div>
                {[{l:"Resolution Rate",v:resRate,max:100,c:"var(--green)",sfx:"%"},{l:"My Resolved",v:myResolved,max:50,c:"var(--purple)",sfx:""},{l:"AI Routed",v:aiRouted,max:100,c:"var(--blue)",sfx:""},{l:"Task Progress",v:taskPct,max:100,c:"var(--yellow)",sfx:"%"}].map(m=>(
                  <div key={m.l} style={{marginBottom:12}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                      <span style={{fontSize:12,color:"var(--text-secondary)"}}>{m.l}</span>
                      <span style={{fontFamily:"var(--font-mono)",fontSize:12,fontWeight:600,color:m.c}}>{m.v}{m.sfx}</span>
                    </div>
                    <div style={{height:5,background:"var(--bg-card-alt)",borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:`${Math.min(100,m.v)}%`,background:m.c,borderRadius:3,transition:"width .8s ease"}}/></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ══ SETTINGS ══ */}
        {activePage==="Settings"&&(
          <div style={{maxWidth:680,margin:"0 auto",padding:"20px 0"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:18,flexWrap:"wrap",gap:10}}>
              <div><div style={{fontSize:9.5,color:"var(--text-muted)",fontWeight:600,letterSpacing:".1em",fontFamily:"'DM Serif Display',Georgia,serif",marginBottom:2}}>PORTAL</div><div style={{fontFamily:"'DM Serif Display',Georgia,serif",fontSize:20,fontWeight:800,color:"var(--text-primary)"}}>⚙️ Settings</div></div>
              <button onClick={()=>showToast("Settings saved")} className="btn btn-primary">💾 Save</button>
            </div>
            <div className="card" style={{marginBottom:12}}>
              <div style={{fontFamily:"'DM Serif Display',Georgia,serif",fontSize:11,fontWeight:700,color:"var(--text-muted)",letterSpacing:".1em",marginBottom:14}}>ACCOUNT</div>
              {[{l:"Name",v:user?.name||"—"},{l:"Email",v:user?.email||"—"},{l:"Role",v:"Field Officer"},{l:"Department",v:officerDept},{l:"Employee ID",v:"AP-"+(user?.id||"001").slice(-6).toUpperCase()}].map(row=>(
                <div key={row.l} style={{display:"flex",alignItems:"center",padding:"9px 0",borderBottom:"1px solid var(--border)"}}>
                  <div style={{width:120,fontSize:11,color:"var(--text-muted)",fontWeight:500,flexShrink:0}}>{row.l}</div>
                  <div style={{flex:1,fontSize:12.5,color:"var(--text-primary)"}}>{row.v}</div>
                </div>
              ))}
            </div>
            <div className="card" style={{marginBottom:12}}>
              <div style={{fontFamily:"'DM Serif Display',Georgia,serif",fontSize:11,fontWeight:700,color:"var(--text-muted)",letterSpacing:".1em",marginBottom:14}}>SHIFT</div>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px",background:"var(--bg-card-alt)",borderRadius:"var(--radius-sm)",border:"1px solid var(--border)",flexWrap:"wrap",gap:10}}>
                <div>
                  <div style={{fontSize:13,fontWeight:500,color:"var(--text-primary)"}}>Current Shift</div>
                  <div style={{fontSize:11,color:"var(--text-muted)",marginTop:2,fontFamily:"var(--font-mono)"}}>{shiftActive?`Started ${shiftStart} · ${fmtDur(shiftSec)}`:"No active shift"}</div>
                </div>
                <button onClick={()=>{if(!shiftActive){setShiftActive(true);setShiftStart(new Date().toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"}));showToast("Shift started");}else{setShiftActive(false);setShiftSec(0);showToast(`Ended · ${fmtDur(shiftSec)}`,"info");}}} className={shiftActive?"btn btn-danger":"btn btn-primary"}>
                  {shiftActive?"🛑 End Shift":"🟢 Start Shift"}
                </button>
              </div>
            </div>
            <SettingsNotifPanel showToast={showToast}/>
            <SettingsDisplayPanel deptFilter={deptFilter} setDeptFilter={setDeptFilter} sortBy={sortBy} setSortBy={setSortBy} showToast={showToast}/>
            <div className="card" style={{border:"1.5px solid rgba(220,38,38,.2)",background:"var(--bg-card)"}}>
              <div style={{fontFamily:"'DM Serif Display',Georgia,serif",fontSize:11,fontWeight:700,color:"#dc2626",letterSpacing:".1em",marginBottom:14}}>DANGER ZONE</div>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
                <div><div style={{fontSize:13,fontWeight:600,color:"var(--text-primary)"}}>Sign out of all devices</div><div style={{fontSize:11,color:"var(--text-muted)",marginTop:1}}>Ends your shift and clears session</div></div>
                <button onClick={handleLogout} style={{display:"flex",alignItems:"center",gap:8,padding:"10px 20px",borderRadius:11,background:"rgba(220,38,38,.08)",border:"1.5px solid rgba(220,38,38,.25)",color:"#dc2626",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"var(--font)",transition:"var(--transition)"}} onMouseEnter={e=>{e.currentTarget.style.background="rgba(220,38,38,.15)";}} onMouseLeave={e=>{e.currentTarget.style.background="rgba(220,38,38,.08)";}}>
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        )}

      </div>{/* /page-inner */}

      {/* ── MOBILE DRAWER ── */}
      {showMob&&(
        <>
          <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.6)",zIndex:8998,backdropFilter:"blur(4px)"}} onClick={()=>setShowMob(false)}/>
          <div style={{position:"fixed",top:0,left:0,bottom:0,width:260,background:"var(--bg-card)",zIndex:8999,overflowY:"auto",boxShadow:"0 8px 32px rgba(0,0,0,.2)",borderRight:"1px solid var(--border)",animation:"slideIn .25s ease"}}>
            <div style={{padding:"18px 18px 14px",background:"linear-gradient(135deg,rgba(22,163,74,.12),rgba(34,197,94,.06))",borderBottom:"1px solid var(--border)",display:"flex",alignItems:"center",gap:12}}>
              <div style={{width:40,height:40,borderRadius:12,background:"linear-gradient(135deg,#16a34a,#22c55e)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,fontSize:16,color:"#fff",boxShadow:"0 4px 14px rgba(22,163,74,.4)"}}>{user?.name?.charAt(0)||"O"}</div>
              <div style={{flex:1}}>
                <div style={{fontWeight:800,fontSize:14,color:"var(--text-primary)",lineHeight:1.2}}>{user?.name||"Officer"}</div>
                <div style={{fontSize:10.5,color:"var(--accent)",fontWeight:600,marginTop:2}}>👮 Officer · {officerDept.split(" ")[0]}</div>
              </div>
              <button onClick={()=>setShowMob(false)} style={{width:28,height:28,borderRadius:"50%",background:"var(--bg-hover)",border:"1px solid var(--border)",cursor:"pointer",fontSize:13,display:"flex",alignItems:"center",justifyContent:"center",color:"var(--text-muted)"}}>✕</button>
            </div>
            <div style={{padding:"8px 0"}}>
              {([["Dashboard","🏠"],["Complaints","📋"],["Workers","👷"],["Heatmap","🗺️"],["Analytics","📊"],["Messages","💬"],["ControlRoom","🗺️"],["Emergency","🚨"],["Profile","👮"],["Settings","⚙️"]] as [NavPage,string][]).map(([page,icon])=>(
                <button key={page} onClick={()=>{setActivePage(page);setShowMob(false);}} style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"11px 18px",fontSize:13,fontWeight:activePage===page?700:500,color:activePage===page?"var(--accent)":"var(--text-secondary)",background:activePage===page?"var(--accent-dim)":"transparent",border:"none",cursor:"pointer",fontFamily:"var(--font)",textAlign:"left",transition:"var(--transition)"}} onMouseOver={e=>(e.currentTarget.style.background="var(--bg-hover)")} onMouseOut={e=>(e.currentTarget.style.background=activePage===page?"var(--accent-dim)":"transparent")}>
                  <span style={{fontSize:16}}>{icon}</span>
                  {page==="ControlRoom"?"Control Room":page}
                </button>
              ))}
              <div style={{margin:"6px 14px",height:1,background:"var(--border)"}}/>
              <button onClick={handleLogout} style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"11px 18px",fontSize:13,fontWeight:600,color:"#dc2626",background:"transparent",border:"none",cursor:"pointer",fontFamily:"var(--font)",textAlign:"left"}} onMouseOver={e=>(e.currentTarget.style.background="rgba(220,38,38,.06)")} onMouseOut={e=>(e.currentTarget.style.background="transparent")}>
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
                Sign Out
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── PROFILE DROPDOWN ── */}
      {showProfile&&(
        <>
          <div style={{position:"fixed",inset:0,zIndex:9998}} onClick={()=>setShowProfile(false)}/>
          <div style={{position:"fixed",right:16,top:72,width:300,background:"#fff",borderRadius:16,boxShadow:"0 20px 60px rgba(0,0,0,.16)",border:"1px solid var(--border)",zIndex:9999,overflow:"hidden",animation:"fadeIn .2s ease"}}>
            <div style={{padding:"18px 18px 14px",background:"linear-gradient(135deg,rgba(22,163,74,.12),rgba(34,197,94,.06))",borderBottom:"1px solid var(--border)"}}>
              <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
                <div style={{width:46,height:46,borderRadius:13,background:"linear-gradient(135deg,#16a34a,#22c55e)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,fontSize:18,color:"#fff",boxShadow:"0 4px 14px rgba(22,163,74,.4)"}}>{user?.name?.charAt(0).toUpperCase()||"O"}</div>
                <div>
                  <div style={{fontWeight:800,fontSize:14.5,color:"var(--text-primary)",lineHeight:1.2}}>{user?.name||"Officer"}</div>
                  <div style={{fontSize:11,color:"var(--accent)",fontWeight:600,marginTop:2}}>🏛️ Officer · {officerDept.split(" ")[0]}</div>
                  <div style={{fontSize:10.5,color:"var(--text-muted)",marginTop:1}}>{user?.email||""}</div>
                </div>
              </div>
              <div style={{display:"flex",gap:6}}>
                {[{l:"Total",v:allComplaints.length},{l:"Resolved",v:resolved},{l:"Pending",v:pending}].map(s=>(
                  <div key={s.l} style={{flex:1,textAlign:"center",background:"rgba(255,255,255,.6)",borderRadius:8,padding:"6px 4px"}}>
                    <div style={{fontSize:15,fontWeight:800,color:"var(--accent)"}}>{s.v}</div>
                    <div style={{fontSize:9,color:"var(--text-muted)",fontWeight:600}}>{s.l}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{padding:"5px 0"}}>
              {([["👮 Profile","Profile"],["🗺️ Control Room","ControlRoom"],["🚨 Emergency","Emergency"],["⚙️ Settings","Settings"]] as [string,NavPage][]).map(([label,page])=>(
                <button key={page} onClick={()=>{setActivePage(page);setShowProfile(false);}} style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"10px 18px",fontSize:13,color:"var(--text-secondary)",background:"transparent",border:"none",cursor:"pointer",fontFamily:"var(--font)",textAlign:"left",transition:"var(--transition)"}} onMouseOver={e=>(e.currentTarget.style.background="var(--bg-hover)")} onMouseOut={e=>(e.currentTarget.style.background="transparent")}>{label}</button>
              ))}
              <div style={{borderTop:"1px solid var(--border)"}}>
                <button onClick={handleLogout} style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"11px 18px",fontSize:13,color:"#dc2626",background:"transparent",border:"none",cursor:"pointer",fontFamily:"var(--font)",textAlign:"left",fontWeight:600}} onMouseOver={e=>(e.currentTarget.style.background="rgba(220,38,38,.06)")} onMouseOut={e=>(e.currentTarget.style.background="transparent")}>
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── ALERTS PANEL ── */}
      {showAlerts&&(
        <>
          <div style={{position:"fixed",inset:0,zIndex:9998}} onClick={()=>setShowAlerts(false)}/>
          <UnifiedNotifsPanel
            notifs={alerts.map(a=>({id:a.id,icon:a.severity==="critical"?"🚨":a.severity==="warning"?"⚠️":"📢",title:a.title,body:a.message,time:new Date().toISOString(),ticketId:a.dept,type:a.severity==="critical"?"urgent":a.severity==="warning"?"warning":"info",read:a.read}))}
            onRead={id=>setAlerts(p=>p.map(x=>x.id===id?{...x,read:true}:x))}
            onReadAll={()=>setAlerts(a=>a.map(x=>({...x,read:true})))}
            onClose={()=>setShowAlerts(false)}
          />
        </>
      )}

      {/* ── COMPLAINT DETAIL ── */}
      {selC&&(
        <ComplaintDetailModal
          c={selC}
          dept={officerDept}
          officerName={user?.name||"Officer"}
          workers={liveWorkers}
          onSave={saveC}
          onClose={()=>setSelC(null)}
        />
      )}

      {/* ── FOOTER ── */}
      <footer style={{ background: "#0f172a", color: "#94a3b8", padding: "56px 5vw 28px" }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: "40px", marginBottom: "48px" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
                <img
                  src="/ap-bg.png"
                  alt="AP Seal"
                  style={{ width: "40px", height: "40px", objectFit: "contain", flexShrink: 0, opacity: 0.85 }}
                />
                <div>
                  <div style={{ fontSize: "14px", fontWeight: 800, color: "#fff" }}>CivicConnect</div>
                  <div style={{ fontSize: "10px", color: "#475569", letterSpacing: "0.06em" }}>LIVE • CIVICCONNECT PLATFORM</div>
                </div>
              </div>
              <p style={{ fontSize: "13px", lineHeight: 1.7, margin: "0 0 16px", maxWidth: "260px" }}>Empowering citizens through transparent, accessible, and responsive digital governance.</p>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {["🚨 112", "📞 1800-425-0082"].map(t => (
                  <span key={t} style={{ fontSize: "11px", fontWeight: 700, color: "#86efac", background: "rgba(22,163,74,0.15)", borderRadius: "6px", padding: "4px 10px", border: "1px solid rgba(22,163,74,0.2)" }}>{t}</span>
                ))}
              </div>
            </div>
            {[
              { title: "Portal", links: ["Report Issue", "Track Complaint", "Safety Alerts", "Emergency Contacts"] },
              { title: "Government", links: ["About City", "District Info", "Public Records", "Transparency"] },
              { title: "Support", links: ["Help Center", "Contact Us", "Privacy Policy", "Terms of Use"] },
            ].map(col => (
              <div key={col.title}>
                <div style={{ fontSize: "12px", fontWeight: 700, color: "#fff", letterSpacing: "0.1em", marginBottom: "16px" }}>{col.title.toUpperCase()}</div>
                {col.links.map(link => (
                  <a key={link} href="#" style={{ display: "block", fontSize: "13px", color: "#64748b", textDecoration: "none", marginBottom: "10px", transition: "color 0.2s" }}
                    onMouseEnter={e => (e.currentTarget).style.color = "#22c55e"}
                    onMouseLeave={e => (e.currentTarget).style.color = "#64748b"}>
                    {link}
                  </a>
                ))}
              </div>
            ))}
          </div>
          <div style={{ borderTop: "1px solid #1e293b", paddingTop: "24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
            <span style={{ fontSize: "12px" }}>© 2026 Smart Governance & Citizen Services Platform. All rights reserved.</span>
            <span style={{ fontSize: "12px" }}>Designed & developed for the citizens of National Civic Network 🇮🇳</span>
          </div>
        </div>
      </footer>
    </div>
  );
}