interface SkeletonProps {
  width?: string;
  height?: string;
  borderRadius?: string;
  count?: number;
  gap?: string;
}

function SkeletonBlock({ width = "100%", height = "14px", borderRadius = "8px" }: Omit<SkeletonProps, "count" | "gap">) {
  return (
    <div style={{ width, height, borderRadius, background: "#e2e8f0", overflow: "hidden", position: "relative", flexShrink: 0 }}>
      <div style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(90deg,transparent 25%,rgba(255,255,255,.55) 50%,transparent 75%)",
        backgroundSize: "200% 100%",
        animation: "sk-shimmer 1.5s infinite",
      }} />
      <style>{`@keyframes sk-shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
    </div>
  );
}

export default function Skeleton({ width, height, borderRadius, count = 1, gap = "8px" }: SkeletonProps) {
  if (count === 1) return <SkeletonBlock width={width} height={height} borderRadius={borderRadius} />;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap }}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonBlock key={i} width={width} height={height} borderRadius={borderRadius} />
      ))}
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div style={{ background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: "14px", padding: "18px 20px", display: "flex", flexDirection: "column", gap: "12px" }}>
      <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
        <SkeletonBlock width="40px" height="40px" borderRadius="50%" />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "6px" }}>
          <SkeletonBlock width="60%" height="13px" />
          <SkeletonBlock width="40%" height="11px" />
        </div>
      </div>
      <SkeletonBlock height="11px" />
      <SkeletonBlock width="80%" height="11px" />
      <SkeletonBlock width="50%" height="11px" />
    </div>
  );
}
