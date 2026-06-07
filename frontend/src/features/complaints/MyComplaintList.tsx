import { useState, useMemo } from "react";
import type { Complaint } from "../../types/complaint.types";
import ComplaintCard from "./ComplaintCard";
import ComplaintFilter, { type FilterValues } from "./ComplaintFilter";

interface Props {
  complaints: Complaint[];
  onSelect?: (c: Complaint) => void;
  selectedId?: string;
  loading?: boolean;
}

const DEPT_ICON: Record<string, string> = {
  "Electricity":"⚡","Water Works":"💧","Sanitation":"🗑️","Roads & Infrastructure":"🛣️","Police":"👮","Fire Department":"🔥","General Civic":"🏛️"
};

export default function MyComplaintList({ complaints, onSelect, selectedId, loading }: Props) {
  const [filters, setFilters] = useState<FilterValues>({
    status: "All", department: "All", search: "", dateFrom: "", dateTo: "",
  });

  const filtered = useMemo(() => {
    return complaints.filter(c => {
      if (filters.status !== "All" && c.status !== filters.status) return false;
      if (filters.department !== "All" && c.department !== filters.department) return false;
      if (filters.search) {
        const q = filters.search.toLowerCase();
        if (!`${c.title} ${c.description} ${c.ticketId} ${c.address}`.toLowerCase().includes(q)) return false;
      }
      if (filters.dateFrom && c.createdAt < new Date(filters.dateFrom).getTime()) return false;
      if (filters.dateTo && c.createdAt > new Date(filters.dateTo + "T23:59:59").getTime()) return false;
      return true;
    });
  }, [complaints, filters]);

  // Summary counters
  const counts = useMemo(() => ({
    total: complaints.length,
    pending: complaints.filter(c => c.status === "Pending").length,
    assigned: complaints.filter(c => c.status === "Assigned").length,
    resolved: complaints.filter(c => c.status === "Resolved").length,
  }), [complaints]);

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{ background: "#f1f5f9", borderRadius: "14px", height: "90px", animation: "pulse 1.5s ease infinite" }} />
        ))}
        <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      {/* Summary pills */}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        {[
          { label: "Total", value: counts.total, bg: "#f1f5f9", color: "#475569" },
          { label: "Pending", value: counts.pending, bg: "#fef3c7", color: "#92400e" },
          { label: "Assigned", value: counts.assigned, bg: "#dbeafe", color: "#1e40af" },
          { label: "Resolved", value: counts.resolved, bg: "#d1fae5", color: "#065f46" },
        ].map(p => (
          <div key={p.label} style={{ background: p.bg, color: p.color, borderRadius: "10px", padding: "6px 14px", fontSize: "12px", fontWeight: 700 }}>
            {p.value} {p.label}
          </div>
        ))}
      </div>

      {/* Filters */}
      <ComplaintFilter onChange={setFilters} />

      {/* Results */}
      <p style={{ margin: 0, fontSize: "12px", color: "#94a3b8" }}>
        Showing {filtered.length} of {complaints.length} complaints
      </p>

      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 20px", color: "#94a3b8" }}>
          <div style={{ fontSize: "36px", marginBottom: "10px" }}>📭</div>
          <p style={{ margin: 0, fontSize: "14px", fontWeight: 600 }}>No complaints found</p>
          <p style={{ margin: "4px 0 0", fontSize: "12px" }}>Try adjusting your filters</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {filtered.map(c => (
            <ComplaintCard
              key={c.id}
              complaint={c}
              onClick={() => onSelect?.(c)}
              selected={selectedId === c.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
