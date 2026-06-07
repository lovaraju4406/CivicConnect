// EmergencyButtons.tsx
// Hold-to-call emergency contact grid with progress bar

import { useState, useRef, useCallback } from "react";

const CONTACTS = [
  { id:"police",     label:"Police",       number:"100",         icon:"🚔", accent:"#3b82f6", glow:"rgba(59,130,246,0.35)",  bg:"linear-gradient(135deg,#1e3a5f,#1a2a4a)" },
  { id:"ambulance",  label:"Ambulance",    number:"108",         icon:"🚑", accent:"#ef4444", glow:"rgba(239,68,68,0.35)",   bg:"linear-gradient(135deg,#5f1e1e,#4a1a1a)" },
  { id:"fire",       label:"Fire",         number:"101",         icon:"🔥", accent:"#f97316", glow:"rgba(249,115,22,0.35)",  bg:"linear-gradient(135deg,#5f3a1e,#4a2a1a)" },
  { id:"women",      label:"Women Safety", number:"1091",        icon:"🛡️", accent:"#a855f7", glow:"rgba(168,85,247,0.35)",  bg:"linear-gradient(135deg,#3a1e5f,#2a1a4a)" },
  { id:"ap_emg",     label:"AP Emergency", number:"112",         icon:"🚨", accent:"#ec4899", glow:"rgba(236,72,153,0.35)",  bg:"linear-gradient(135deg,#5f1e3a,#4a1a2e)" },
  { id:"electricity",label:"Electricity",  number:"1912",        icon:"⚡", accent:"#eab308", glow:"rgba(234,179,8,0.35)",   bg:"linear-gradient(135deg,#5f5a1e,#4a471a)" },
  { id:"water",      label:"Water",        number:"1916",        icon:"💧", accent:"#06b6d4", glow:"rgba(6,182,212,0.35)",   bg:"linear-gradient(135deg,#1e4f5f,#1a3e4a)" },
  { id:"child",      label:"Child Help",   number:"1098",        icon:"👶", accent:"#f59e0b", glow:"rgba(245,158,11,0.35)",  bg:"linear-gradient(135deg,#5f4a1e,#4a381a)" },
  { id:"disaster",   label:"Disaster",     number:"1070",        icon:"🌊", accent:"#22d3ee", glow:"rgba(34,211,238,0.35)",  bg:"linear-gradient(135deg,#1e4f5f,#164050)" },
];

const HOLD_DURATION = 1500;

export default function EmergencyButtons() {
  const [holding, setHolding] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [called, setCalled] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startRef = useRef<number>(0);

  const startHold = useCallback((id: string, number: string) => {
    setHolding(id); setProgress(0); startRef.current = Date.now();
    intervalRef.current = setInterval(() => {
      const pct = Math.min(((Date.now() - startRef.current) / HOLD_DURATION) * 100, 100);
      setProgress(pct);
      if (pct >= 100) {
        clearInterval(intervalRef.current!);
        setCalled(id); setHolding(null); setProgress(0);
        setTimeout(() => setCalled(null), 3000);
        window.location.href = `tel:${number}`;
      }
    }, 16);
  }, []);

  const cancelHold = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setHolding(null); setProgress(0);
  }, []);

  return (
    <div style={{ fontFamily: "'DM Sans',system-ui,sans-serif" }}>
      <style>{`
        @keyframes eb-ring { 0%{transform:scale(1);opacity:.6} 100%{transform:scale(2.2);opacity:0} }
        @keyframes eb-shake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-3px)} 40%{transform:translateX(3px)} 60%{transform:translateX(-2px)} 80%{transform:translateX(2px)} }
        @keyframes eb-in { 0%{transform:scale(.8);opacity:0} 60%{transform:scale(1.1)} 100%{transform:scale(1);opacity:1} }
        .eb-btn{position:relative;border:none;cursor:pointer;border-radius:14px;overflow:hidden;padding:0;outline:none;user-select:none;-webkit-user-select:none;transition:transform .15s,box-shadow .15s;min-width:0}
        .eb-btn:hover:not(:disabled){transform:translateY(-2px)}
        .eb-btn:active{transform:scale(.96)}
        .eb-btn.holding{animation:eb-shake .4s ease}
      `}</style>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8 }}>
        {CONTACTS.map(c => {
          const isH = holding === c.id, isC = called === c.id, prog = isH ? progress : 0;
          return (
            <button key={c.id} className={`eb-btn${isH?" holding":""}`}
              onMouseDown={() => startHold(c.id, c.number)} onMouseUp={cancelHold} onMouseLeave={cancelHold}
              onTouchStart={e => { e.preventDefault(); startHold(c.id, c.number); }} onTouchEnd={cancelHold} onTouchCancel={cancelHold}
              style={{ background:c.bg, boxShadow:isH?`0 0 0 2px ${c.accent},0 8px 24px ${c.glow}`:`0 2px 10px rgba(0,0,0,.3),inset 0 1px 0 rgba(255,255,255,.07)` }}>
              {isH && <div style={{ position:"absolute",inset:0,background:`linear-gradient(to top,${c.accent}44,transparent)`,height:`${prog}%`,top:"auto",bottom:0,zIndex:0 }}/>}
              {isH && <div style={{ position:"absolute",top:"50%",left:"50%",width:40,height:40,marginLeft:-20,marginTop:-20,borderRadius:"50%",background:c.accent,opacity:0,animation:"eb-ring .8s ease-out infinite",zIndex:0 }}/>}
              <div style={{ position:"relative",zIndex:1,padding:"12px 8px 10px" }}>
                <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6 }}>
                  <span style={{ fontSize:22,lineHeight:1 }}>{isC ? "✅" : c.icon}</span>
                  <div style={{ width:6,height:6,borderRadius:"50%",background:c.accent,boxShadow:`0 0 6px ${c.accent}`,opacity:isH?1:.5 }}/>
                </div>
                <div style={{ fontSize:11.5,fontWeight:800,color:"white",lineHeight:1.2,marginBottom:2 }}>{c.label}</div>
                <div style={{ fontSize:14,fontWeight:900,color:c.accent,marginBottom:6 }}>{c.number}</div>
                <div style={{ height:3,borderRadius:2,background:"rgba(255,255,255,.12)",overflow:"hidden" }}>
                  <div style={{ height:"100%",width:`${prog}%`,background:c.accent,borderRadius:2,boxShadow:`0 0 6px ${c.accent}` }}/>
                </div>
                <div style={{ marginTop:4,fontSize:9,color:isH?c.accent:"rgba(255,255,255,.3)",fontWeight:600,letterSpacing:".04em",textTransform:"uppercase" as const }}>
                  {isC?"Calling…":isH?"Release to cancel":"Hold to call"}
                </div>
              </div>
              <div style={{ position:"absolute",inset:0,borderRadius:14,border:`1px solid ${isH?c.accent:"rgba(255,255,255,.08)"}`,pointerEvents:"none" }}/>
            </button>
          );
        })}
      </div>
      {called && (
        <div style={{ marginTop:10,padding:"8px 14px",background:"#0f172a",border:`1px solid ${CONTACTS.find(c=>c.id===called)?.accent}44`,borderRadius:10,display:"flex",alignItems:"center",gap:8,animation:"eb-in .3s ease" }}>
          <div style={{ width:7,height:7,borderRadius:"50%",background:CONTACTS.find(c=>c.id===called)?.accent,boxShadow:`0 0 8px ${CONTACTS.find(c=>c.id===called)?.accent}` }}/>
          <span style={{ fontSize:12,color:"rgba(255,255,255,.7)",fontWeight:600 }}>
            Connecting to {CONTACTS.find(c=>c.id===called)?.label} ({CONTACTS.find(c=>c.id===called)?.number})…
          </span>
        </div>
      )}
    </div>
  );
}