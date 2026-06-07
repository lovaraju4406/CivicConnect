import { useState } from "react";
import type { ComplaintStatus } from "../../types/complaint.types";

const DEPARTMENTS = ["All","Electricity","Water Works","Sanitation","Roads & Infrastructure","Police","Fire Department","General Civic"];
const STATUSES: (ComplaintStatus | "All")[] = ["All", "Pending", "Assigned", "Resolved"];

export interface FilterValues {
  status: ComplaintStatus | "All";
  department: string;
  search: string;
  dateFrom: string;
  dateTo: string;
}

interface Props {
  onChange: (filters: FilterValues) => void;
  initial?: Partial<FilterValues>;
}

export default function ComplaintFilter({ onChange, initial }: Props) {
  const [filters, setFilters] = useState<FilterValues>({
    status: initial?.status ?? "All",
    department: initial?.department ?? "All",
    search: initial?.search ?? "",
    dateFrom: initial?.dateFrom ?? "",
    dateTo: initial?.dateTo ?? "",
  });

  const update = (patch: Partial<FilterValues>) => {
    const next = { ...filters, ...patch };
    setFilters(next);
    onChange(next);
  };

  const hasActive = filters.status !== "All" || filters.department !== "All" || filters.search || filters.dateFrom || filters.dateTo;

  const inputStyle: React.CSSProperties = {
    padding: "8px 11px", fontSize: "12.5px", border: "1.5px solid #e2e8f0",
    borderRadius: "9px", outline: "none", fontFamily: "inherit", color: "#334155",
    background: "#fff",
  };

  return (
    <div style={{ background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: "14px", padding: "14px 16px", display: "flex", flexDirection: "column", gap: "12px" }}>
      {/* Search */}
      <div style={{ position: "relative" }}>
        <span style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8", fontSize: "14px" }}>🔍</span>
        <input
          value={filters.search}
          onChange={e => update({ search: e.target.value })}
          placeholder="Search by title, address, ticket ID…"
          style={{ ...inputStyle, width: "100%", paddingLeft: "32px", boxSizing: "border-box" }}
        />
      </div>

      {/* Row: status + department */}
      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
        {/* Status pills */}
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          {STATUSES.map(s => (
            <button
              key={s} type="button"
              onClick={() => update({ status: s })}
              style={{
                padding: "5px 12px", borderRadius: "20px", fontSize: "12px", fontWeight: 600,
                border: `1.5px solid ${filters.status === s ? "#ea6800" : "#e2e8f0"}`,
                background: filters.status === s ? "#ea6800" : "#fff",
                color: filters.status === s ? "#fff" : "#64748b",
                cursor: "pointer", fontFamily: "inherit",
              }}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Department */}
        <select
          value={filters.department}
          onChange={e => update({ department: e.target.value })}
          style={{ ...inputStyle, flex: 1, minWidth: "160px", cursor: "pointer", appearance: "none" }}
        >
          {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      {/* Date range */}
      <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: "12px", color: "#64748b", fontWeight: 600 }}>Date:</span>
        <input type="date" value={filters.dateFrom} onChange={e => update({ dateFrom: e.target.value })} style={{ ...inputStyle }} />
        <span style={{ fontSize: "12px", color: "#94a3b8" }}>to</span>
        <input type="date" value={filters.dateTo} onChange={e => update({ dateTo: e.target.value })} style={{ ...inputStyle }} />
        {hasActive && (
          <button
            type="button"
            onClick={() => update({ status: "All", department: "All", search: "", dateFrom: "", dateTo: "" })}
            style={{ fontSize: "12px", color: "#ef4444", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}
          >
            ✕ Clear
          </button>
        )}
      </div>
    </div>
  );
}
