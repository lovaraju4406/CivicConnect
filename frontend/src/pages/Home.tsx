import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";

// ─── Civic Illustration SVG ───────────────────────────────────────────────────
function CivicIllustration() {
  return (
    <svg
      viewBox="0 0 1100 520"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: "100%", height: "100%", display: "block" }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="skyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="rgba(20,83,45,0)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.18)" />
        </linearGradient>
        <linearGradient id="groundGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="rgba(0,0,0,0.22)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.38)" />
        </linearGradient>
        <linearGradient id="bldA" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.14)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0.07)" />
        </linearGradient>
        <linearGradient id="bldB" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.11)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0.05)" />
        </linearGradient>
        <linearGradient id="bldC" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.18)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0.09)" />
        </linearGradient>
        <linearGradient id="personSkin" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#fddcaa" />
          <stop offset="100%" stopColor="#f5c07a" />
        </linearGradient>
        <radialGradient id="shieldGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(187,247,208,0.45)" />
          <stop offset="100%" stopColor="rgba(187,247,208,0)" />
        </radialGradient>
        <linearGradient id="roadGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="rgba(0,0,0,0.25)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.4)" />
        </linearGradient>
      </defs>

      {/* Sky overlay */}
      <rect x="0" y="0" width="1100" height="520" fill="url(#skyGrad)" />

      {/* Far background buildings */}
      <rect x="30" y="170" width="55" height="260" rx="2" fill="rgba(255,255,255,0.07)" />
      <rect x="30" y="162" width="55" height="14" rx="1" fill="rgba(255,255,255,0.1)" />
      <rect x="50" y="155" width="15" height="12" rx="1" fill="rgba(255,255,255,0.1)" />
      {[0,1,2,3,4,5].map(row => [0,1,2].map(col => (
        <rect key={`fw${row}${col}`} x={38 + col*16} y={180 + row*26} width="10" height="14" rx="1" fill="rgba(187,247,208,0.22)" />
      )))}
      <rect x="95" y="210" width="44" height="220" rx="2" fill="rgba(255,255,255,0.06)" />
      {[0,1,2,3].map(row => [0,1].map(col => (
        <rect key={`fmw${row}${col}`} x={102 + col*18} y={220 + row*26} width="11" height="14" rx="1" fill="rgba(187,247,208,0.18)" />
      )))}
      <rect x="1010" y="130" width="62" height="300" rx="2" fill="rgba(255,255,255,0.07)" />
      <rect x="1010" y="122" width="62" height="14" rx="1" fill="rgba(255,255,255,0.1)" />
      <rect x="1033" y="114" width="17" height="12" rx="1" fill="rgba(255,255,255,0.1)" />
      {[0,1,2,3,4,5].map(row => [0,1,2].map(col => (
        <rect key={`rtw${row}${col}`} x={1018 + col*17} y={138 + row*28} width="10" height="16" rx="1" fill="rgba(187,247,208,0.2)" />
      )))}
      <rect x="1075" y="195" width="50" height="235" rx="2" fill="rgba(255,255,255,0.06)" />
      {[0,1,2,3].map(row => [0,1].map(col => (
        <rect key={`rmw${row}${col}`} x={1083 + col*18} y={205 + row*28} width="11" height="16" rx="1" fill="rgba(187,247,208,0.15)" />
      )))}

      {/* Midground buildings */}
      <rect x="140" y="150" width="80" height="280" rx="3" fill="url(#bldB)" />
      <rect x="140" y="140" width="80" height="16" rx="2" fill="rgba(255,255,255,0.12)" />
      {[0,1,2,3,4,5,6].map(row => [0,1,2,3].map(col => (
        <rect key={`lmb${row}${col}`} x={148 + col*18} y={162 + row*28} width="11" height="17" rx="1"
          fill={row % 2 === 0 && col % 2 === 0 ? "rgba(187,247,208,0.35)" : "rgba(255,255,255,0.1)"} />
      )))}
      <rect x="230" y="195" width="62" height="235" rx="3" fill="rgba(255,255,255,0.08)" />
      {[0,1,2,3,4].map(row => [0,1,2].map(col => (
        <rect key={`lb2${row}${col}`} x={238 + col*18} y={207 + row*28} width="11" height="17" rx="1" fill="rgba(187,247,208,0.25)" />
      )))}
      <rect x="880" y="160" width="76" height="270" rx="3" fill="url(#bldB)" />
      <rect x="880" y="150" width="76" height="16" rx="2" fill="rgba(255,255,255,0.12)" />
      {[0,1,2,3,4,5].map(row => [0,1,2,3].map(col => (
        <rect key={`rmb${row}${col}`} x={888 + col*17} y={172 + row*28} width="10" height="17" rx="1"
          fill={row % 2 === col % 2 ? "rgba(187,247,208,0.3)" : "rgba(255,255,255,0.09)"} />
      )))}
      <rect x="965" y="200" width="58" height="230" rx="3" fill="rgba(255,255,255,0.07)" />
      {[0,1,2,3].map(row => [0,1,2].map(col => (
        <rect key={`rb2${row}${col}`} x={973 + col*17} y={212 + row*28} width="10" height="17" rx="1" fill="rgba(187,247,208,0.2)" />
      )))}

      {/* Government Building (center) */}
      <rect x="420" y="200" width="260" height="230" rx="3" fill="url(#bldC)" />
      {[0,1,2,3,4,5].map(i => (
        <rect key={`col${i}`} x={435 + i*38} y={290} width="14" height="140" rx="3" fill="rgba(255,255,255,0.2)" />
      ))}
      <rect x="428" y="285" width="244" height="14" rx="2" fill="rgba(255,255,255,0.22)" />
      <polygon points="420,285 550,215 680,285" fill="rgba(255,255,255,0.18)" />
      <polygon points="432,285 550,224 668,285" fill="rgba(255,255,255,0.08)" />
      {[0,1,2,3,4].map(col => (
        <rect key={`gw${col}`} x={440 + col*44} y={240} width="22" height="32" rx="3" fill="rgba(187,247,208,0.4)" />
      ))}
      <rect x="516" y="370" width="68" height="60" rx="4" fill="rgba(187,247,208,0.25)" />
      <rect x="530" y="374" width="18" height="56" rx="3" fill="rgba(187,247,208,0.35)" />
      <rect x="552" y="374" width="18" height="56" rx="3" fill="rgba(187,247,208,0.35)" />
      <ellipse cx="550" cy="210" rx="45" ry="20" fill="rgba(255,255,255,0.18)" />
      <rect x="530" y="170" width="40" height="44" rx="3" fill="rgba(255,255,255,0.15)" />
      <ellipse cx="550" cy="170" rx="22" ry="10" fill="rgba(255,255,255,0.22)" />
      <rect x="548" y="100" width="4" height="72" rx="1" fill="rgba(255,255,255,0.6)" />
      <polygon points="552,102 588,114 552,126" fill="rgba(187,247,208,0.9)" />
      <rect x="465" y="360" width="170" height="22" rx="3" fill="rgba(255,255,255,0.15)" />
      <rect x="480" y="366" width="140" height="10" rx="2" fill="rgba(255,255,255,0.2)" />
      <rect x="398" y="425" width="304" height="10" rx="2" fill="rgba(255,255,255,0.15)" />
      <rect x="406" y="420" width="288" height="8" rx="2" fill="rgba(255,255,255,0.12)" />
      <rect x="414" y="415" width="272" height="7" rx="2" fill="rgba(255,255,255,0.1)" />

      {/* Road */}
      <rect x="0" y="430" width="1100" height="90" fill="url(#roadGrad)" />
      {[0,1,2,3,4,5,6,7,8,9,10,11,12,13].map(i => (
        <rect key={`rm${i}`} x={i * 80 + 20} y={460} width="50" height="6" rx="3" fill="rgba(255,255,255,0.18)" />
      ))}
      <rect x="0" y="428" width="1100" height="6" fill="rgba(255,255,255,0.12)" />

      {/* Trees */}
      {[
        { x: 310, scale: 1.0 }, { x: 370, scale: 0.85 },
        { x: 720, scale: 1.0 }, { x: 785, scale: 0.85 },
        { x: 170, scale: 0.75 }, { x: 920, scale: 0.75 },
      ].map((t, i) => (
        <g key={`tree${i}`} transform={`translate(${t.x}, 0) scale(${t.scale})`}>
          <rect x="-7" y="382" width="14" height="50" rx="3" fill="rgba(0,0,0,0.25)" />
          <ellipse cx="0" cy="355" rx="34" ry="36" fill="rgba(255,255,255,0.1)" />
          <ellipse cx="0" cy="348" rx="26" ry="28" fill="rgba(255,255,255,0.09)" />
          <ellipse cx="0" cy="340" rx="18" ry="22" fill="rgba(255,255,255,0.1)" />
        </g>
      ))}

      {/* Street lamps */}
      {[250, 455, 645, 840].map((x, i) => (
        <g key={`lamp${i}`}>
          <rect x={x - 3} y="370" width="6" height="62" rx="2" fill="rgba(255,255,255,0.28)" />
          <rect x={x - 18} y="368" width="36" height="6" rx="3" fill="rgba(255,255,255,0.25)" />
          <ellipse cx={x - 15} cy="374" rx="6" ry="5" fill="rgba(187,247,208,0.6)" />
          <ellipse cx={x + 15} cy="374" rx="6" ry="5" fill="rgba(187,247,208,0.6)" />
          <ellipse cx={x - 15} cy="374" rx="14" ry="12" fill="rgba(187,247,208,0.12)" />
          <ellipse cx={x + 15} cy="374" rx="14" ry="12" fill="rgba(187,247,208,0.12)" />
        </g>
      ))}

      {/* Person 1 — Citizen with phone */}
      <g transform="translate(330, 295)">
        <rect x="-16" y="50" width="32" height="80" rx="8" fill="rgba(255,255,255,0.22)" />
        <circle cx="0" cy="34" r="20" fill="url(#personSkin)" />
        <ellipse cx="0" cy="16" rx="20" ry="10" fill="rgba(80,40,20,0.6)" />
        <rect x="-8" y="50" width="16" height="12" rx="4" fill="url(#personSkin)" />
        <rect x="-32" y="56" width="18" height="10" rx="5" fill="rgba(255,255,255,0.2)" transform="rotate(25,-23,61)" />
        <rect x="14" y="54" width="28" height="10" rx="5" fill="rgba(255,255,255,0.22)" transform="rotate(-35,28,59)" />
        <rect x="34" y="38" width="22" height="30" rx="4" fill="rgba(255,255,255,0.5)" />
        <rect x="37" y="42" width="16" height="20" rx="2" fill="rgba(22,163,74,0.6)" />
        <rect x="-14" y="126" width="12" height="38" rx="5" fill="rgba(255,255,255,0.18)" />
        <rect x="2" y="126" width="12" height="38" rx="5" fill="rgba(255,255,255,0.18)" />
        <ellipse cx="-8" cy="165" rx="10" ry="5" fill="rgba(255,255,255,0.25)" />
        <ellipse cx="8" cy="165" rx="10" ry="5" fill="rgba(255,255,255,0.25)" />
        <rect x="28" y="-8" width="72" height="32" rx="10" fill="rgba(255,255,255,0.85)" />
        <polygon points="46,24 36,32 56,24" fill="rgba(255,255,255,0.85)" />
        <rect x="36" y="-1" width="56" height="6" rx="3" fill="rgba(22,163,74,0.5)" />
        <rect x="36" y="10" width="40" height="6" rx="3" fill="rgba(22,163,74,0.3)" />
      </g>

      {/* Person 2 — Official with clipboard */}
      <g transform="translate(700, 290)">
        <rect x="-17" y="50" width="34" height="78" rx="8" fill="rgba(255,255,255,0.18)" />
        <polygon points="-3,52 3,52 1,100 -1,100" fill="rgba(187,247,208,0.7)" />
        <circle cx="0" cy="33" r="21" fill="url(#personSkin)" />
        <ellipse cx="0" cy="14" rx="21" ry="10" fill="rgba(50,30,10,0.65)" />
        <rect x="-9" y="50" width="18" height="12" rx="4" fill="url(#personSkin)" />
        <rect x="-36" y="56" width="22" height="11" rx="5" fill="rgba(255,255,255,0.18)" transform="rotate(15,-25,62)" />
        <rect x="-60" y="46" width="28" height="36" rx="4" fill="rgba(255,255,255,0.55)" />
        <rect x="-57" y="50" width="22" height="4" rx="2" fill="rgba(80,80,80,0.4)" />
        <rect x="-57" y="57" width="18" height="3" rx="2" fill="rgba(80,80,80,0.3)" />
        <rect x="-57" y="63" width="20" height="3" rx="2" fill="rgba(80,80,80,0.3)" />
        <rect x="-57" y="69" width="14" height="3" rx="2" fill="rgba(80,80,80,0.25)" />
        <rect x="16" y="50" width="20" height="10" rx="5" fill="rgba(255,255,255,0.18)" transform="rotate(-50,26,55)" />
        <rect x="-14" y="124" width="12" height="40" rx="5" fill="rgba(255,255,255,0.16)" />
        <rect x="2" y="124" width="12" height="40" rx="5" fill="rgba(255,255,255,0.16)" />
        <ellipse cx="-8" cy="165" rx="10" ry="5" fill="rgba(255,255,255,0.22)" />
        <ellipse cx="8" cy="165" rx="10" ry="5" fill="rgba(255,255,255,0.22)" />
        <rect x="-8" y="58" width="16" height="20" rx="3" fill="rgba(22,163,74,0.5)" />
        <rect x="-5" y="61" width="10" height="4" rx="2" fill="rgba(255,255,255,0.6)" />
      </g>

      {/* Person 3 — Worker with hard hat */}
      <g transform="translate(820, 300)">
        <rect x="-16" y="48" width="32" height="80" rx="8" fill="rgba(255,255,255,0.2)" />
        <rect x="-16" y="66" width="32" height="8" fill="rgba(187,247,208,0.5)" />
        <circle cx="0" cy="30" r="20" fill="url(#personSkin)" />
        <ellipse cx="0" cy="14" rx="26" ry="10" fill="rgba(187,247,208,0.9)" />
        <rect x="-22" y="14" width="44" height="8" rx="4" fill="rgba(187,247,208,0.9)" />
        <rect x="-8" y="48" width="16" height="10" rx="4" fill="url(#personSkin)" />
        <rect x="-38" y="52" width="24" height="11" rx="5" fill="rgba(255,255,255,0.2)" transform="rotate(20,-26,58)" />
        <rect x="14" y="50" width="30" height="11" rx="5" fill="rgba(255,255,255,0.22)" transform="rotate(-30,29,56)" />
        <rect x="36" y="36" width="8" height="26" rx="3" fill="rgba(255,255,255,0.55)" />
        <ellipse cx="40" cy="34" rx="9" ry="7" fill="rgba(255,255,255,0.45)" />
        <rect x="-13" y="124" width="12" height="40" rx="5" fill="rgba(255,255,255,0.18)" />
        <rect x="2" y="124" width="12" height="40" rx="5" fill="rgba(255,255,255,0.18)" />
        <ellipse cx="-7" cy="165" rx="11" ry="5" fill="rgba(255,255,255,0.24)" />
        <ellipse cx="8" cy="165" rx="11" ry="5" fill="rgba(255,255,255,0.24)" />
        <rect x="-16" y="118" width="32" height="9" rx="4" fill="rgba(187,247,208,0.35)" />
      </g>

      {/* Person 4 — Mother with child */}
      <g transform="translate(180, 315)">
        <rect x="-14" y="44" width="28" height="70" rx="7" fill="rgba(255,255,255,0.19)" />
        <circle cx="0" cy="28" r="18" fill="url(#personSkin)" />
        <ellipse cx="0" cy="12" rx="18" ry="9" fill="rgba(60,30,10,0.6)" />
        <rect x="-7" y="44" width="14" height="10" rx="4" fill="url(#personSkin)" />
        <rect x="12" y="50" width="22" height="9" rx="4" fill="rgba(255,255,255,0.18)" transform="rotate(-18,23,55)" />
        <rect x="-12" y="110" width="11" height="36" rx="5" fill="rgba(255,255,255,0.17)" />
        <rect x="2" y="110" width="11" height="36" rx="5" fill="rgba(255,255,255,0.17)" />
        <ellipse cx="-7" cy="147" rx="9" ry="4" fill="rgba(255,255,255,0.22)" />
        <ellipse cx="7" cy="147" rx="9" ry="4" fill="rgba(255,255,255,0.22)" />
        <g transform="translate(36, 32)">
          <circle cx="0" cy="18" r="13" fill="url(#personSkin)" />
          <ellipse cx="0" cy="7" rx="13" ry="7" fill="rgba(60,30,10,0.55)" />
          <rect x="-10" y="28" width="20" height="52" rx="6" fill="rgba(255,255,255,0.22)" />
          <rect x="-6" y="78" width="9" height="28" rx="4" fill="rgba(255,255,255,0.18)" />
          <rect x="4" y="78" width="9" height="28" rx="4" fill="rgba(255,255,255,0.18)" />
          <ellipse cx="-2" cy="107" rx="8" ry="4" fill="rgba(255,255,255,0.22)" />
          <ellipse cx="8" cy="107" rx="8" ry="4" fill="rgba(255,255,255,0.22)" />
        </g>
      </g>

      {/* Signal tower */}
      <g transform="translate(75, 220)">
        <line x1="0" y1="0" x2="0" y2="160" stroke="rgba(255,255,255,0.35)" strokeWidth="4" strokeLinecap="round" />
        {[30,70,110].map((y,i) => (
          <line key={i} x1={-(30-i*8)} y1={y} x2={(30-i*8)} y2={y} stroke="rgba(255,255,255,0.28)" strokeWidth="3" strokeLinecap="round" />
        ))}
        <line x1="-30" y1="30" x2="0" y2="70" stroke="rgba(255,255,255,0.2)" strokeWidth="2" />
        <line x1="30" y1="30" x2="0" y2="70" stroke="rgba(255,255,255,0.2)" strokeWidth="2" />
        {[22,38,54].map((r,i) => (
          <ellipse key={i} cx="0" cy="-8" rx={r} ry={r*0.5}
            fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="2" opacity={1 - i*0.25} />
        ))}
      </g>

      {/* Shield + check (far right) */}
      <g transform="translate(1010, 230)">
        <ellipse cx="0" cy="0" rx="70" ry="70" fill="url(#shieldGlow)" />
        <path d="M0,-60 L52,-30 L52,18 Q52,62 0,80 Q-52,62 -52,18 L-52,-30 Z"
          fill="rgba(255,255,255,0.16)" stroke="rgba(255,255,255,0.35)" strokeWidth="3" />
        <path d="M0,-44 L38,-22 L38,14 Q38,48 0,62 Q-38,48 -38,14 L-38,-22 Z"
          fill="rgba(255,255,255,0.08)" />
        <polyline points="-20,8 -6,24 26,-16"
          fill="none" stroke="rgba(187,247,208,0.92)" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
      </g>

      {/* Connection lines */}
      <line x1="360" y1="370" x2="500" y2="420" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" strokeDasharray="6 5" />
      <line x1="700" y1="380" x2="620" y2="420" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" strokeDasharray="6 5" />
      <circle cx="420" cy="396" r="4" fill="rgba(187,247,208,0.5)" />
      <circle cx="660" cy="400" r="4" fill="rgba(187,247,208,0.5)" />

      {/* Floating complaint card */}
      <g transform="translate(255, 170)">
        <rect x="0" y="0" width="108" height="64" rx="10" fill="rgba(255,255,255,0.18)" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
        <polygon points="12,48 22,30 32,48" fill="rgba(22,163,74,0.8)" />
        <rect x="20" y="36" width="4" height="7" rx="1" fill="white" />
        <circle cx="22" cy="46" r="2" fill="white" />
        <rect x="40" y="12" width="56" height="7" rx="3" fill="rgba(255,255,255,0.55)" />
        <rect x="40" y="24" width="42" height="5" rx="2" fill="rgba(255,255,255,0.35)" />
        <rect x="40" y="34" width="50" height="5" rx="2" fill="rgba(255,255,255,0.28)" />
        <rect x="6" y="8" width="28" height="14" rx="7" fill="rgba(22,163,74,0.55)" />
        <rect x="10" y="12" width="20" height="6" rx="3" fill="rgba(255,255,255,0.5)" />
      </g>

      {/* Floating resolved badge */}
      <g transform="translate(760, 158)">
        <rect x="0" y="0" width="110" height="52" rx="10" fill="rgba(255,255,255,0.18)" stroke="rgba(255,255,255,0.28)" strokeWidth="1.5" />
        <circle cx="26" cy="26" r="16" fill="rgba(74,222,128,0.4)" />
        <polyline points="18,26 24,32 34,20" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="50" y="12" width="50" height="7" rx="3" fill="rgba(255,255,255,0.55)" />
        <rect x="50" y="24" width="38" height="5" rx="2" fill="rgba(255,255,255,0.35)" />
        <rect x="50" y="34" width="44" height="5" rx="2" fill="rgba(255,255,255,0.28)" />
      </g>

      {/* Map pin */}
      <g transform="translate(660, 255)">
        <circle cx="0" cy="0" r="16" fill="rgba(22,163,74,0.75)" />
        <circle cx="0" cy="0" r="9" fill="rgba(255,255,255,0.5)" />
        <circle cx="0" cy="0" r="4" fill="rgba(22,163,74,0.9)" />
        <line x1="0" y1="16" x2="0" y2="32" stroke="rgba(22,163,74,0.7)" strokeWidth="3" strokeLinecap="round" />
      </g>

      {/* Shadows */}
      <ellipse cx="330" cy="434" rx="55" ry="8" fill="rgba(0,0,0,0.18)" />
      <ellipse cx="700" cy="434" rx="48" ry="7" fill="rgba(0,0,0,0.15)" />
      <ellipse cx="820" cy="434" rx="42" ry="7" fill="rgba(0,0,0,0.15)" />
      <ellipse cx="195" cy="432" rx="38" ry="6" fill="rgba(0,0,0,0.14)" />

      {/* Foreground overlay */}
      <rect x="0" y="440" width="1100" height="80" fill="url(#groundGrad)" />
    </svg>
  );
}
// ─────────────────────────────────────────────────────────────────────────────

export default function Home() {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [counter, setCounter] = useState({ districts: 0, citizens: 0, resolved: 0, uptime: 0 });

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const targets = { districts: 26, citizens: 53, resolved: 12480, uptime: 99 };
    const duration = 1800;
    const steps = 60;
    const interval = duration / steps;
    let step = 0;
    const timer = setInterval(() => {
      step++;
      const progress = step / steps;
      const ease = 1 - Math.pow(1 - progress, 3);
      setCounter({
        districts: Math.round(targets.districts * ease),
        citizens: Math.round(targets.citizens * ease),
        resolved: Math.round(targets.resolved * ease),
        uptime: Math.round(targets.uptime * ease),
      });
      if (step >= steps) clearInterval(timer);
    }, interval);
    return () => clearInterval(timer);
  }, []);

  const services = [
    {
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
      ),
      title: "Report Civic Issues",
      desc: "File complaints about roads, drainage, electricity, and public infrastructure instantly.",
      color: "#16a34a", bg: "#f0fdf4",
    },
    {
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
      ),
      title: "Track Complaints",
      desc: "Real-time status updates on every issue you've raised — from submission to resolution.",
      color: "#0ea5e9", bg: "#f0f9ff",
    },
    {
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        </svg>
      ),
      title: "Safety Alerts",
      desc: "Receive instant district-wise alerts for floods, fires, and public safety emergencies.",
      color: "#ef4444", bg: "#fef2f2",
    },
    {
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
      ),
      title: "Citizen Connect",
      desc: "Engage with local government officials, access public records, and stay informed.",
      color: "#8b5cf6", bg: "#f5f3ff",
    },
    {
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
        </svg>
      ),
      title: "Public Dashboard",
      desc: "Transparent district-wise analytics on complaint resolution and government performance.",
      color: "#10b981", bg: "#f0fdf4",
    },
    {
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.99 12 19.79 19.79 0 0 1 1.92 3.38a2 2 0 0 1 1.99-2.18h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
        </svg>
      ),
      title: "Emergency Contacts",
      desc: "One-tap access to police, fire, ambulance, and district collector offices 24/7.",
      color: "#f59e0b", bg: "#fffbeb",
    },
  ];

  const steps = [
    { num: "01", title: "Create Account", desc: "Register with your Aadhaar-linked mobile number in under 2 minutes.", icon: "👤" },
    { num: "02", title: "Report an Issue", desc: "Describe the problem, attach photos, and pin the location on the map.", icon: "📍" },
    { num: "03", title: "Track & Resolve", desc: "Get SMS/app updates as officials work on your complaint in real time.", icon: "✅" },
  ];

  const news = [
    { date: "Feb 18, 2026", tag: "Update", title: "New mobile app launched for faster complaint filing across all 26 districts", color: "#16a34a" },
    { date: "Feb 12, 2026", tag: "Alert", title: "Flood preparedness advisory issued for coastal districts — check your area", color: "#ef4444" },
    { date: "Feb 05, 2026", tag: "Achievement", title: "Portal crosses 10,000 resolved complaints — transparency report published", color: "#10b981" },
  ];

  return (
    <div style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", color: "#1e293b", overflowX: "hidden" }}>
      <style>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(28px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-10px); } }
        @keyframes pulse-ring { 0% { transform: scale(1); opacity: 0.6; } 100% { transform: scale(1.6); opacity: 0; } }
        @keyframes illus-drift { 0%, 100% { transform: translateY(0px) scale(1); } 50% { transform: translateY(-8px) scale(1.005); } }
        @keyframes illus-fadein { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
        .fade-up { animation: fadeUp 0.6s ease both; }
        .delay-1 { animation-delay: 0.1s; }
        .delay-2 { animation-delay: 0.2s; }
        .delay-3 { animation-delay: 0.3s; }
        .delay-4 { animation-delay: 0.4s; }
        .service-card:hover { transform: translateY(-6px); box-shadow: 0 20px 48px rgba(0,0,0,0.12) !important; }
        .service-card { transition: transform 0.25s ease, box-shadow 0.25s ease; }
        .nav-link:hover { color: #16a34a !important; }
        .nav-link { transition: color 0.2s; }
        .btn-primary:hover { opacity: 0.9; transform: translateY(-1px); }
        .btn-primary { transition: all 0.2s; }
        .btn-outline:hover { background: rgba(255,255,255,0.15) !important; }
        .btn-outline { transition: all 0.2s; }
        .news-card:hover { border-color: #16a34a !important; background: #f0fdf4 !important; }
        .news-card { transition: all 0.2s; }
        html { scroll-behavior: smooth; }
        .civic-illustration { animation: illus-drift 6s ease-in-out infinite; }
        .civic-illustration-wrap { animation: illus-fadein 1s ease 0.3s both; }
      `}</style>

      {/* ═══ STICKY NAVBAR ═══ */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 1000,
        background: scrolled ? "rgba(255,255,255,0.97)" : "transparent",
        backdropFilter: scrolled ? "blur(16px)" : "none",
        boxShadow: scrolled ? "0 2px 24px rgba(0,0,0,0.09)" : "none",
        borderBottom: scrolled ? "1px solid rgba(0,0,0,0.06)" : "none",
        transition: "all 0.3s ease",
        padding: "0 5vw",
      }}>
        <div style={{
          maxWidth: "1200px", margin: "0 auto",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          height: "68px",
        }}>
          {/* ── BRAND with AP Seal ── */}
          <div
            style={{ display: "flex", alignItems: "center", gap: "12px", cursor: "pointer" }}
            onClick={() => window.scrollTo(0, 0)}
          >
            <img
              src="/ap-bg.png"
              alt="Smart Governance & Citizen Services Platform"
              style={{
                width: "44px", height: "44px",
                objectFit: "contain", flexShrink: 0,
              }}
            />
            <div>
              <div style={{ fontSize: "16px", fontWeight: 800, color: scrolled ? "#1e293b" : "#fff", lineHeight: 1.1 }}>
                CivicConnect
              </div>
              <div style={{ fontSize: "10px", color: scrolled ? "#16a34a" : "rgba(255,255,255,0.75)", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginTop: "1px" }}>
                Smart Governance & Citizen Services Platform
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "32px" }}>
            {["Services", "How It Works", "News"].map(item => (
              <a key={item} href={`#${item.toLowerCase().replace(/ /g, "-")}`} className="nav-link"
                style={{ fontSize: "14px", fontWeight: 600, color: scrolled ? "#475569" : "rgba(255,255,255,0.85)", textDecoration: "none" }}>
                {item}
              </a>
            ))}
          </div>

          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <button className="btn-outline" onClick={() => navigate("/login")} style={{
              padding: "9px 20px", borderRadius: "10px", fontSize: "14px", fontWeight: 700, cursor: "pointer",
              border: scrolled ? "2px solid #e2e8f0" : "2px solid rgba(255,255,255,0.4)",
              background: "transparent", color: scrolled ? "#475569" : "#fff",
            }}>Login</button>
            <button className="btn-primary" onClick={() => navigate("/register")} style={{
              padding: "9px 22px", borderRadius: "10px", fontSize: "14px", fontWeight: 700, cursor: "pointer", border: "none",
              background: scrolled ? "linear-gradient(135deg, #15803d, #16a34a)" : "rgba(255,255,255,0.95)",
              color: scrolled ? "#fff" : "#15803d",
              boxShadow: scrolled ? "0 4px 16px rgba(22,163,74,0.35)" : "none",
            }}>Register Free</button>
          </div>
        </div>
      </nav>

      {/* ═══ HERO ═══ */}
      <section style={{
        minHeight: "100vh",
        background: "linear-gradient(145deg, #14532d 0%, #15803d 20%, #16a34a 42%, #22c55e 65%, #4ade80 85%, #86efac 100%)",
        position: "relative", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", overflow: "hidden",
        padding: "100px 5vw 80px",
      }}>
        {/* Abstract decorative circles */}
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          <div style={{ position: "absolute", top: "-10%", right: "-5%", width: "45vw", height: "45vw", borderRadius: "50%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }} />
          <div style={{ position: "absolute", top: "5%", right: "5%", width: "30vw", height: "30vw", borderRadius: "50%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }} />
          <div style={{ position: "absolute", bottom: "-5%", left: "-5%", width: "35vw", height: "35vw", borderRadius: "50%", background: "rgba(0,0,0,0.06)" }} />
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 70% 40%, rgba(187,247,208,0.15) 0%, transparent 60%)" }} />
          <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
        </div>

        {/* ══ CIVIC ILLUSTRATION BACKGROUND ══ */}
        <div
          className="civic-illustration-wrap"
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: "58%",
            pointerEvents: "none",
            zIndex: 1,
          }}
        >
          <div className="civic-illustration" style={{ width: "100%", height: "100%" }}>
            <CivicIllustration />
          </div>
          {/* Top blend gradient */}
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0, height: "38%",
            background: "linear-gradient(to bottom, rgba(22,163,74,0.85), transparent)",
            pointerEvents: "none",
          }} />
          {/* Side vignette */}
          <div style={{
            position: "absolute", inset: 0,
            background: "linear-gradient(to right, rgba(20,83,45,0.45) 0%, transparent 18%, transparent 82%, rgba(20,83,45,0.45) 100%)",
            pointerEvents: "none",
          }} />
        </div>

        {/* Hero content */}
        <div style={{ maxWidth: "1100px", width: "100%", display: "flex", alignItems: "center", gap: "60px", position: "relative", zIndex: 2 }}>
          <div style={{ flex: 1 }}>
            {/* AP Seal + Live badge */}
            <div className="fade-up" style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "22px" }}>
              <div style={{ width: "56px", height: "56px", borderRadius: "50%", background: "rgba(255,255,255,0.95)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 2px 12px rgba(0,0,0,0.15)" }}>
                <img
                  src="/ap-bg.png"
                  alt="AP Seal"
                  style={{ width: "46px", height: "46px", objectFit: "contain" }}
                />
              </div>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: "8px",
                background: "rgba(255,255,255,0.15)", backdropFilter: "blur(10px)",
                border: "1px solid rgba(255,255,255,0.25)", borderRadius: "50px",
                padding: "6px 16px",
                fontSize: "12px", fontWeight: 700, color: "#fff", letterSpacing: "0.08em",
              }}>
                <div style={{ position: "relative" }}>
                  <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#4ade80" }} />
                  <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "#4ade80", animation: "pulse-ring 1.5s ease-out infinite" }} />
                </div>
                LIVE • SMART GOVERNANCE & CITIZEN SERVICES PLATFORM
              </div>
            </div>

            <h1 className="fade-up delay-1" style={{
              fontSize: "clamp(32px, 4vw, 58px)", fontWeight: 900, color: "#fff",
              lineHeight: 1.1, letterSpacing: "-0.02em", margin: "0 0 8px",
              textShadow: "0 4px 24px rgba(0,0,0,0.2)",
            }}>
              Your Voice.<br />
              <span style={{ color: "#bbf7d0" }}>Your Government.</span><br />
              Your Safety.
            </h1>

            <p className="fade-up delay-2" style={{
              fontSize: "clamp(15px, 1.4vw, 18px)", color: "rgba(255,255,255,0.82)",
              lineHeight: 1.7, margin: "20px 0 36px", maxWidth: "480px",
            }}>
              The official citizen safety platform of National Civic Network. Report civic issues, track resolutions, and connect with your district administration — all in one place.
            </p>

            <div className="fade-up delay-3" style={{ display: "flex", gap: "14px", flexWrap: "wrap" }}>
              <button className="btn-primary" onClick={() => navigate("/register")} style={{
                padding: "15px 32px", borderRadius: "14px", fontSize: "16px", fontWeight: 800,
                border: "none", background: "#fff", color: "#15803d", cursor: "pointer",
                boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
                display: "flex", alignItems: "center", gap: "8px",
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                  <line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>
                </svg>
                Register Now — It's Free
              </button>
              <button className="btn-outline" onClick={() => navigate("/login")} style={{
                padding: "15px 32px", borderRadius: "14px", fontSize: "16px", fontWeight: 700,
                border: "2px solid rgba(255,255,255,0.5)", background: "transparent",
                color: "#fff", cursor: "pointer",
                display: "flex", alignItems: "center", gap: "8px",
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/>
                </svg>
                Sign In
              </button>
            </div>

            <div className="fade-up delay-4" style={{ display: "flex", alignItems: "center", gap: "20px", marginTop: "36px" }}>
              {[{ icon: "🔒", text: "Aadhaar Secured" }, { icon: "✅", text: "Govt. Verified" }, { icon: "📱", text: "Mobile Ready" }].map(t => (
                <div key={t.text} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ fontSize: "14px" }}>{t.icon}</span>
                  <span style={{ fontSize: "12px", fontWeight: 600, color: "rgba(255,255,255,0.75)" }}>{t.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Stats Card */}
          <div className="fade-up delay-3" style={{
            flexShrink: 0, width: "300px",
            background: "rgba(255,255,255,0.1)", backdropFilter: "blur(20px)",
            border: "1px solid rgba(255,255,255,0.2)", borderRadius: "24px",
            padding: "28px 24px",
            boxShadow: "0 24px 64px rgba(0,0,0,0.2)",
            animation: "float 4s ease-in-out infinite",
          }}>
            <div style={{ fontSize: "12px", fontWeight: 700, color: "rgba(255,255,255,0.6)", letterSpacing: "0.1em", marginBottom: "18px" }}>PORTAL STATISTICS</div>
            {[
              { val: counter.districts, suffix: "", label: "Districts Covered", icon: "🗺️" },
              { val: counter.citizens, suffix: "Cr+", label: "Citizens Registered", icon: "👥" },
              { val: counter.resolved.toLocaleString(), suffix: "", label: "Issues Resolved", icon: "✅" },
              { val: counter.uptime, suffix: "%", label: "Uptime Guaranteed", icon: "⚡" },
            ].map((stat, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: "12px",
                padding: "11px 0",
                borderBottom: i < 3 ? "1px solid rgba(255,255,255,0.1)" : "none",
              }}>
                <div style={{
                  width: "38px", height: "38px", borderRadius: "10px",
                  background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "16px", flexShrink: 0,
                }}>{stat.icon}</div>
                <div>
                  <div style={{ fontSize: "20px", fontWeight: 900, color: "#fff", lineHeight: 1 }}>{stat.val}{stat.suffix}</div>
                  <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.6)", marginTop: "2px", fontWeight: 500 }}>{stat.label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Emergency strip */}
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          background: "rgba(0,0,0,0.2)", backdropFilter: "blur(10px)",
          borderTop: "1px solid rgba(255,255,255,0.1)",
          padding: "12px 5vw", display: "flex", alignItems: "center", justifyContent: "center", gap: "40px", flexWrap: "wrap",
          zIndex: 3,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ position: "relative", width: "8px", height: "8px" }}>
              <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#f87171", position: "absolute" }} />
              <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "#f87171", animation: "pulse-ring 1.2s ease-out infinite" }} />
            </div>
            <span style={{ fontSize: "13px", fontWeight: 700, color: "#fff" }}>🚨 Emergency: <span style={{ color: "#fca5a5" }}>112</span></span>
          </div>
          <div style={{ width: "1px", height: "20px", background: "rgba(255,255,255,0.2)" }} />
          <span style={{ fontSize: "13px", fontWeight: 600, color: "rgba(255,255,255,0.8)" }}>📞 Helpline: <span style={{ color: "#bbf7d0" }}>1800-425-0082</span></span>
          <div style={{ width: "1px", height: "20px", background: "rgba(255,255,255,0.2)" }} />
          <span style={{ fontSize: "13px", fontWeight: 600, color: "rgba(255,255,255,0.8)" }}>🌐 Available 24 × 7 in all 26 districts</span>
        </div>
      </section>

      {/* ═══ SERVICES ═══ */}
      <section id="services" style={{ padding: "90px 5vw", background: "#f8fafc" }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "56px" }}>
            <div style={{ display: "inline-block", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "50px", padding: "5px 16px", fontSize: "12px", fontWeight: 700, color: "#16a34a", letterSpacing: "0.1em", marginBottom: "14px" }}>WHAT WE OFFER</div>
            <h2 style={{ fontSize: "clamp(26px, 3vw, 40px)", fontWeight: 900, color: "#0f172a", margin: "0 0 14px", letterSpacing: "-0.02em" }}>Everything a Citizen Needs</h2>
            <p style={{ fontSize: "16px", color: "#64748b", maxWidth: "480px", margin: "0 auto", lineHeight: 1.6 }}>One platform, six powerful tools to make civic life simpler and safer for every National Civic Network citizen.</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "24px" }}>
            {services.map((s, i) => (
              <div key={i} className="service-card" style={{ background: "#fff", borderRadius: "20px", padding: "28px", border: "1px solid #e2e8f0", boxShadow: "0 4px 16px rgba(0,0,0,0.05)", cursor: "pointer" }}>
                <div style={{ width: "56px", height: "56px", borderRadius: "14px", background: s.bg, color: s.color, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "18px", border: `1px solid ${s.color}22` }}>{s.icon}</div>
                <h3 style={{ fontSize: "18px", fontWeight: 800, color: "#0f172a", margin: "0 0 8px" }}>{s.title}</h3>
                <p style={{ fontSize: "14px", color: "#64748b", lineHeight: 1.6, margin: "0 0 18px" }}>{s.desc}</p>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", color: s.color, fontSize: "13px", fontWeight: 700 }}>
                  Learn more
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ HOW IT WORKS ═══ */}
      <section id="how-it-works" style={{ padding: "90px 5vw", background: "#fff" }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "60px" }}>
            <div style={{ display: "inline-block", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "50px", padding: "5px 16px", fontSize: "12px", fontWeight: 700, color: "#16a34a", letterSpacing: "0.1em", marginBottom: "14px" }}>SIMPLE PROCESS</div>
            <h2 style={{ fontSize: "clamp(26px, 3vw, 40px)", fontWeight: 900, color: "#0f172a", margin: "0 0 14px", letterSpacing: "-0.02em" }}>Three Steps to Change Your City</h2>
            <p style={{ fontSize: "16px", color: "#64748b", maxWidth: "420px", margin: "0 auto", lineHeight: 1.6 }}>Filing a complaint takes less than 3 minutes. Track it until it's resolved.</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0", position: "relative" }}>
            <div style={{ position: "absolute", top: "36px", left: "calc(16.67% + 28px)", right: "calc(16.67% + 28px)", height: "2px", background: "linear-gradient(to right, #15803d, #4ade80)", zIndex: 0 }} />
            {steps.map((step, i) => (
              <div key={i} style={{ textAlign: "center", padding: "0 32px", position: "relative", zIndex: 1 }}>
                <div style={{
                  width: "72px", height: "72px", borderRadius: "50%", margin: "0 auto 24px",
                  background: "linear-gradient(135deg, #15803d, #16a34a)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: "0 8px 24px rgba(22,163,74,0.35)", fontSize: "28px",
                  border: "4px solid #fff",
                }}>{step.icon}</div>
                <div style={{ display: "inline-block", fontSize: "11px", fontWeight: 800, color: "#16a34a", letterSpacing: "0.15em", marginBottom: "10px", background: "#f0fdf4", borderRadius: "50px", padding: "3px 12px", border: "1px solid #bbf7d0" }}>STEP {step.num}</div>
                <h3 style={{ fontSize: "20px", fontWeight: 800, color: "#0f172a", margin: "0 0 10px" }}>{step.title}</h3>
                <p style={{ fontSize: "14px", color: "#64748b", lineHeight: 1.6, margin: 0 }}>{step.desc}</p>
              </div>
            ))}
          </div>
          <div style={{ textAlign: "center", marginTop: "56px" }}>
            <button className="btn-primary" onClick={() => navigate("/register")} style={{
              padding: "16px 40px", borderRadius: "14px", fontSize: "16px", fontWeight: 800,
              border: "none", cursor: "pointer",
              background: "linear-gradient(135deg, #15803d, #16a34a, #22c55e)",
              color: "#fff", boxShadow: "0 8px 28px rgba(22,163,74,0.4)",
              display: "inline-flex", alignItems: "center", gap: "10px",
            }}>
              Get Started Today
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
            </button>
          </div>
        </div>
      </section>

      {/* ═══ NEWS ═══ */}
      <section id="news" style={{ padding: "90px 5vw", background: "#f8fafc" }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: "40px", flexWrap: "wrap", gap: "16px" }}>
            <div>
              <div style={{ display: "inline-block", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "50px", padding: "5px 16px", fontSize: "12px", fontWeight: 700, color: "#16a34a", letterSpacing: "0.1em", marginBottom: "12px" }}>LATEST UPDATES</div>
              <h2 style={{ fontSize: "clamp(24px, 2.5vw, 36px)", fontWeight: 900, color: "#0f172a", margin: 0, letterSpacing: "-0.02em" }}>News & Alerts</h2>
            </div>
            <a href="#" style={{ fontSize: "14px", fontWeight: 700, color: "#16a34a", textDecoration: "none", display: "flex", alignItems: "center", gap: "4px" }}>
              View all updates
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
            </a>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {news.map((item, i) => (
              <div key={i} className="news-card" style={{ background: "#fff", borderRadius: "16px", padding: "22px 28px", border: "1px solid #e2e8f0", display: "flex", alignItems: "center", gap: "20px", cursor: "pointer" }}>
                <div style={{ width: "6px", height: "48px", borderRadius: "3px", background: item.color, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
                    <span style={{ fontSize: "11px", fontWeight: 700, color: item.color, background: `${item.color}18`, borderRadius: "50px", padding: "2px 10px", letterSpacing: "0.06em" }}>{item.tag}</span>
                    <span style={{ fontSize: "12px", color: "#94a3b8", fontWeight: 500 }}>{item.date}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: "15px", fontWeight: 600, color: "#1e293b", lineHeight: 1.4 }}>{item.title}</p>
                </div>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ FINAL CTA ═══ */}
      <section style={{
        padding: "80px 5vw",
        background: "linear-gradient(135deg, #14532d 0%, #15803d 30%, #16a34a 70%, #22c55e 100%)",
        position: "relative", overflow: "hidden",
      }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)", backgroundSize: "32px 32px", pointerEvents: "none" }} />
        <div style={{ position: "absolute", top: "-60px", right: "-60px", width: "300px", height: "300px", borderRadius: "50%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }} />
        <div style={{ maxWidth: "700px", margin: "0 auto", textAlign: "center", position: "relative", zIndex: 1 }}>
          {/* AP Seal in CTA */}
          <div style={{ width: "72px", height: "72px", borderRadius: "50%", background: "rgba(255,255,255,0.95)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", boxShadow: "0 4px 20px rgba(0,0,0,0.15)" }}>
            <img
              src="/ap-bg.png"
              alt="AP Seal"
              style={{ width: "60px", height: "60px", objectFit: "contain" }}
            />
          </div>
          <h2 style={{ fontSize: "clamp(26px, 3.5vw, 44px)", fontWeight: 900, color: "#fff", margin: "0 0 16px", letterSpacing: "-0.02em", lineHeight: 1.15 }}>Be the Voice of Change in National Civic Network</h2>
          <p style={{ fontSize: "17px", color: "rgba(255,255,255,0.8)", lineHeight: 1.6, margin: "0 0 36px" }}>Join over 53 lakh citizens who are already shaping a safer, smarter National Civic Network. Your complaint today is tomorrow's solution.</p>
          <div style={{ display: "flex", gap: "14px", justifyContent: "center", flexWrap: "wrap" }}>
            <button className="btn-primary" onClick={() => navigate("/register")} style={{
              padding: "16px 36px", borderRadius: "14px", fontSize: "16px", fontWeight: 800,
              border: "none", background: "#fff", color: "#15803d", cursor: "pointer",
              boxShadow: "0 8px 28px rgba(0,0,0,0.2)", display: "flex", alignItems: "center", gap: "8px",
            }}>
              Register as Citizen
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
            </button>
            <button className="btn-outline" onClick={() => navigate("/login")} style={{
              padding: "16px 36px", borderRadius: "14px", fontSize: "16px", fontWeight: 700,
              border: "2px solid rgba(255,255,255,0.5)", background: "transparent", color: "#fff", cursor: "pointer",
            }}>Already a member? Login</button>
          </div>
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
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