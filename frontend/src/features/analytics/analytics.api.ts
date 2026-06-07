/**
 * analytics.api.ts — Real backend analytics
 */
export { analyticsAPI } from "../../services/api";

// Keep old interface types for backwards compat
export interface DeptStat {
  department: string; total: number; resolved: number;
  pending: number; assigned: number; rate: number;
  avgResolutionHours?: number;
}
export interface TrendPoint { date: string; submitted: number; resolved: number; }
export interface AnalyticsData {
  deptStats: DeptStat[]; trend: TrendPoint[];
  totalUsers: number; resolutionRate: number;
}