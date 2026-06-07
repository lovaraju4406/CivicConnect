
import { useSelector } from "react-redux";
import type { RootState } from "../store";

export function useComplaints() {
  const complaints = useSelector((s: RootState) => s.complaints.complaints);
  const loading    = useSelector((s: RootState) => s.complaints.loading);
  const total    = complaints.length;
  const pending  = complaints.filter(c => c.status === "Pending").length;
  const assigned = complaints.filter(c =>
    c.status === "Assigned" || c.status === "In Progress"
  ).length;
  const resolved = complaints.filter(c => c.status === "Resolved").length;
  const rate     = total > 0 ? Math.round((resolved / total) * 100) : 0;
  return { complaints, loading, total, pending, assigned, resolved, rate };
}