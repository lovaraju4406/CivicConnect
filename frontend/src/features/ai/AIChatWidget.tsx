import { useState, useRef, useEffect } from "react";
import { useSelector } from "react-redux";
import type { RootState } from "../../store";

interface Message { id: string; role: "user"|"assistant"; text: string; ts: number; }

const SUGG: Record<string,string[]> = {
  admin:   ["How many complaints pending?","Department with lowest resolution?","Today's system summary","Total users"],
  officer: ["Urgent complaints?","Cases resolved today","All pending complaints","Average resolution time"],
  worker:  ["My tasks today","High priority tasks","Tasks done this week","How to mark complete"],
  citizen: ["My complaint status","How to submit a complaint","Which dept handles roads?","Resolution time estimate"],
};

async function getAIResponse(msg:string,_role:string,complaints:any[]):Promise<string>{
  await new Promise(r=>setTimeout(r,700+Math.random()*500));
  const m=msg.toLowerCase();
  const total=complaints.length, pending=complaints.filter(c=>c.status==="Pending").length,
    assigned=complaints.filter(c=>c.status==="Assigned").length, resolved=complaints.filter(c=>c.status==="Resolved").length,
    rate=total>0?Math.round((resolved/total)*100):0;
  if(m.includes("hello")||m.includes("hi"))return`Hello! 👋 I'm your CivicConnect AI. Ask me about complaints, stats, or portal guidance.`;
  if(m.includes("pending"))return`⏳ **${pending}** complaints pending (${total>0?Math.round(pending/total*100):0}% of ${total} total).`;
  if(m.includes("resolved")||m.includes("resolution"))return`✅ **${resolved}** resolved — **${rate}% resolution rate**.\n${rate>=70?"🎉 Excellent!":rate>=40?"⚠️ Moderate — escalate older cases.":"🔴 Low — review bottlenecks."}`;
  if(m.includes("assigned"))return`🔧 **${assigned}** complaints assigned to field teams.`;
  if(m.includes("summary")||m.includes("today"))return`📊 **Summary**\n• Total: **${total}**\n• Pending: **${pending}**\n• Assigned: **${assigned}**\n• Resolved: **${resolved}**\n• Rate: **${rate}%**`;
  if(m.includes("urgent")||m.includes("priority")){
    const u=complaints.filter(c=>c.status==="Pending"&&["Police","Fire Department"].includes(c.department));
    return u.length>0?`🔴 **${u.length} urgent:**\n${u.slice(0,4).map((c:any)=>`• ${c.title} — ${c.department}`).join("\n")}`:"✅ No urgent complaints right now.";
  }
  if(m.includes("dept")||m.includes("department")){
    const dm:Record<string,number>={};complaints.forEach((c:any)=>{const d=c.department||"General Civic";dm[d]=(dm[d]||0)+1;});
    const s=Object.entries(dm).sort((a,b)=>b[1]-a[1]);
    return s.length>0?`🏢 **By Department:**\n${s.slice(0,6).map(([d,n],i)=>`${i+1}. ${d}: **${n}**`).join("\n")}`:"No data yet.";
  }
  if(m.includes("user")){try{const u=JSON.parse(localStorage.getItem("ap_registered_users")||"[]");return`👥 **${u.length} users** registered.`;}catch{return"User data unavailable.";}}
  if(m.includes("submit")||m.includes("how"))return`📝 **Submit a complaint:**\n1. Click **Submit Complaint** on dashboard\n2. Enter title & description\n3. GPS auto-detected\n4. Add optional photo\n5. Hit Submit!`;
  if(m.includes("status"))return"🔍 Check **My Complaints** on dashboard.\nStages: **Pending → Assigned → Resolved**";
  return`I can help with stats, department data, user info, and portal guidance.\n\nTry: **"Show today's summary"** or **"What's pending?"**\n\n⚠️ *Full AI after backend integration.*`;
}

export default function AIChatWidget({role="citizen"}:{role?:"admin"|"officer"|"worker"|"citizen"}){
  const user=useSelector((s:RootState)=>s.auth.user);
  const [open,setOpen]=useState(false);
  const [msgs,setMsgs]=useState<Message[]>([{id:"0",role:"assistant",text:`Hi ${user?.name?.split(" ")[0]||"there"}! 👋 I'm your CivicConnect AI. Ask me about complaints, stats, or the portal.`,ts:Date.now()}]);
  const [input,setInput]=useState("");
  const [loading,setLoad]=useState(false);
  const [unread,setUnread]=useState(0);
  const bottomRef=useRef<HTMLDivElement>(null);
  const inputRef=useRef<HTMLInputElement>(null);
  const allC=(()=>{try{return JSON.parse(localStorage.getItem("complaints_all")||"[]");}catch{return [];}})();
  const GRAD:Record<string,string>={admin:"linear-gradient(135deg,#7c3aed,#4f46e5)",officer:"linear-gradient(135deg,#1e40af,#2563eb)",worker:"linear-gradient(135deg,#065f46,#059669)",citizen:"linear-gradient(135deg,#c2410c,#ea580c)"};
  const grad=GRAD[role]||GRAD.citizen;
  useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:"smooth"});},[msgs,loading]);
  useEffect(()=>{if(open){setUnread(0);setTimeout(()=>inputRef.current?.focus(),100);}},[open]);
  const send=async(text:string)=>{
    if(!text.trim()||loading)return;
    setMsgs(p=>[...p,{id:Date.now().toString(),role:"user",text:text.trim(),ts:Date.now()}]);
    setInput("");setLoad(true);
    const reply=await getAIResponse(text,role,allC);
    setMsgs(p=>[...p,{id:(Date.now()+1).toString(),role:"assistant",text:reply,ts:Date.now()}]);
    setLoad(false);
    if(!open)setUnread(u=>u+1);
  };
  const renderText=(text:string)=>text.split("\n").map((line,i)=>{
    const parts=line.split(/(\*\*[^*]+\*\*)/g);
    return<span key={i} style={{display:"block",minHeight:line?"auto":"8px"}}>{parts.map((p,j)=>p.startsWith("**")&&p.endsWith("**")?<strong key={j}>{p.slice(2,-2)}</strong>:p)}</span>;
  });
  return(<>
    <style>{`
      @keyframes chatPop{from{opacity:0;transform:scale(.85) translateY(20px)}to{opacity:1;transform:scale(1) translateY(0)}}
      @keyframes msgIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
      @keyframes dotB{0%,80%,100%{transform:scale(0)}40%{transform:scale(1)}}
      @keyframes fabGlow{0%,100%{box-shadow:0 8px 28px rgba(0,0,0,.25)}50%{box-shadow:0 8px 40px rgba(99,102,241,.45)}}
      .cp{animation:chatPop .25s cubic-bezier(.34,1.56,.64,1) both}
      .mi{animation:msgIn .2s ease both}
      .d1{animation:dotB 1.4s .0s infinite}.d2{animation:dotB 1.4s .2s infinite}.d3{animation:dotB 1.4s .4s infinite}
      .ci:focus{outline:none;border-color:#3b82f6!important;box-shadow:0 0 0 3px rgba(59,130,246,.12)!important}
      .sc{cursor:pointer;border:1px solid #e2e8f0;border-radius:20px;padding:5px 12px;font-size:11.5px;background:#f8fafc;color:#475569;white-space:nowrap;font-family:inherit;transition:all .15s}
      .sc:hover{border-color:#3b82f6;color:#1d4ed8;background:#eff6ff}
      .sb{transition:all .18s}.sb:hover:not(:disabled){filter:brightness(1.1);transform:scale(1.05)}.sb:disabled{opacity:.5;cursor:not-allowed}
      .fab{animation:fabGlow 3s ease infinite}
    `}</style>
    <div style={{position:"fixed",bottom:"28px",right:"28px",zIndex:1000}}>
      {!open&&(
        <button className="fab" onClick={()=>setOpen(true)} style={{width:"58px",height:"58px",borderRadius:"50%",border:"none",background:grad,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"24px",position:"relative"}}>
          🤖{unread>0&&<span style={{position:"absolute",top:"-4px",right:"-4px",width:"20px",height:"20px",borderRadius:"50%",background:"#ef4444",color:"#fff",fontSize:"11px",fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",border:"2px solid #fff"}}>{unread}</span>}
        </button>
      )}
      {open&&(
        <div className="cp" style={{width:"360px",height:"520px",background:"#fff",borderRadius:"20px",boxShadow:"0 24px 64px rgba(0,0,0,.2)",display:"flex",flexDirection:"column",overflow:"hidden",border:"1px solid #e2e8f0"}}>
          <div style={{background:grad,padding:"14px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
            <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
              <div style={{width:"36px",height:"36px",borderRadius:"50%",background:"rgba(255,255,255,.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"18px",border:"2px solid rgba(255,255,255,.3)"}}>🤖</div>
              <div>
                <div style={{fontSize:"13.5px",fontWeight:800,color:"#fff",lineHeight:1}}>CivicConnect AI</div>
                <div style={{fontSize:"10.5px",color:"rgba(255,255,255,.7)",display:"flex",alignItems:"center",gap:"4px"}}><span style={{width:"5px",height:"5px",borderRadius:"50%",background:"#4ade80",display:"inline-block"}}/>Ready · {role} mode</div>
              </div>
            </div>
            <div style={{display:"flex",gap:"6px"}}>
              <button onClick={()=>setMsgs([{id:"0",role:"assistant",text:"Chat cleared. How can I help?",ts:Date.now()}])} title="Clear" style={{background:"rgba(255,255,255,.15)",border:"none",borderRadius:"8px",width:"28px",height:"28px",cursor:"pointer",color:"#fff",fontSize:"13px",display:"flex",alignItems:"center",justifyContent:"center"}}>🗑</button>
              <button onClick={()=>setOpen(false)} style={{background:"rgba(255,255,255,.15)",border:"none",borderRadius:"8px",width:"28px",height:"28px",cursor:"pointer",color:"#fff",fontSize:"16px",display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
            </div>
          </div>
          <div style={{background:"#fefce8",borderBottom:"1px solid #fde68a",padding:"6px 14px",fontSize:"11px",color:"#92400e",flexShrink:0}}>⚠️ Stub mode — full AI activates after backend integration</div>
          <div style={{flex:1,overflowY:"auto",padding:"14px",display:"flex",flexDirection:"column",gap:"10px"}}>
            {msgs.map(msg=>(
              <div key={msg.id} className="mi" style={{display:"flex",flexDirection:"column",alignItems:msg.role==="user"?"flex-end":"flex-start"}}>
                <div style={{maxWidth:"84%",padding:"10px 13px",borderRadius:msg.role==="user"?"16px 16px 4px 16px":"16px 16px 16px 4px",fontSize:"13px",lineHeight:1.65,background:msg.role==="user"?grad:"#f1f5f9",color:msg.role==="user"?"#fff":"#1e293b",boxShadow:"0 2px 8px rgba(0,0,0,.06)"}}>
                  {renderText(msg.text)}
                </div>
                <span style={{fontSize:"10px",color:"#94a3b8",marginTop:"3px",paddingLeft:"4px",paddingRight:"4px"}}>{new Date(msg.ts).toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"})}</span>
              </div>
            ))}
            {loading&&<div className="mi" style={{display:"flex"}}><div style={{background:"#f1f5f9",padding:"12px 16px",borderRadius:"16px 16px 16px 4px",display:"flex",gap:"4px",alignItems:"center"}}>{[1,2,3].map(d=><span key={d} className={`d${d}`} style={{width:"7px",height:"7px",borderRadius:"50%",background:"#94a3b8",display:"inline-block"}}/>)}</div></div>}
            <div ref={bottomRef}/>
          </div>
          {msgs.length<=2&&<div style={{padding:"0 12px 8px",display:"flex",gap:"6px",overflowX:"auto",flexShrink:0}}>{(SUGG[role]||SUGG.citizen).map(s=><button key={s} className="sc" onClick={()=>send(s)}>{s}</button>)}</div>}
          <div style={{padding:"10px 12px",borderTop:"1px solid #f1f5f9",display:"flex",gap:"8px",alignItems:"center",flexShrink:0}}>
            <input ref={inputRef} className="ci" style={{flex:1,border:"1.5px solid #e2e8f0",borderRadius:"12px",padding:"9px 14px",fontSize:"13px",fontFamily:"inherit",color:"#1e293b",background:"#f8fafc"}} placeholder="Ask me anything…" value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send(input);}}}/>
            <button className="sb" disabled={!input.trim()||loading} onClick={()=>send(input)} style={{width:"38px",height:"38px",borderRadius:"11px",border:"none",background:grad,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </button>
          </div>
        </div>
      )}
    </div>
  </>);
}