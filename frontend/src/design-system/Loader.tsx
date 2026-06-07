import { ReactNode } from "react";

interface LoaderProps {
  size?: "sm" | "md" | "lg";
  color?: string;
  fullPage?: boolean;
  label?: string;
}

const SIZES = { sm: 18, md: 28, lg: 44 };

export default function Loader({ size = "md", color = "#ea6800", fullPage = false, label }: LoaderProps) {
  const px = SIZES[size];
  const spinner = (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
      <svg width={px} height={px} viewBox="0 0 44 44" style={{ animation: "ldr-spin .7s linear infinite" }}>
        <circle cx="22" cy="22" r="18" fill="none" stroke={`${color}30`} strokeWidth="4" />
        <path
          d="M22 4 A18 18 0 0 1 40 22"
          fill="none" stroke={color} strokeWidth="4" strokeLinecap="round"
        />
        <style>{`@keyframes ldr-spin{to{transform:rotate(360deg);transform-origin:22px 22px}}`}</style>
      </svg>
      {label && <p style={{ fontSize: "13px", color: "#64748b", margin: 0 }}>{label}</p>}
    </div>
  );

  if (fullPage) {
    return (
      <div style={{
        position: "fixed", inset: 0, display: "flex", alignItems: "center",
        justifyContent: "center", background: "rgba(255,255,255,.85)", zIndex: 9999,
      }}>
        {spinner}
      </div>
    );
  }
  return spinner;
}

interface SkeletonLineProps { width?: string; height?: string; borderRadius?: string; }

export function SkeletonLine({ width = "100%", height = "14px", borderRadius = "6px" }: SkeletonLineProps) {
  return (
    <div style={{ width, height, borderRadius, background: "#e2e8f0", overflow: "hidden", position: "relative" }}>
      <div style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(90deg,transparent,rgba(255,255,255,.6),transparent)",
        animation: "shimmer 1.4s infinite",
      }} />
      <style>{`@keyframes shimmer{0%{transform:translateX(-100%)}100%{transform:translateX(100%)}}`}</style>
    </div>
  );
}
