export interface DepartmentStat {
  department: string;
  total: number;
  pending: number;
  assigned: number;
  resolved: number;
  avgResolutionHours: number;
}

export interface TrendPoint {
  date: string;
  submitted: number;
  resolved: number;
}

export interface AnalyticsSummary {
  totalComplaints: number;
  pendingComplaints: number;
  assignedComplaints: number;
  resolvedComplaints: number;
  avgResolutionHours: number;
  resolutionRate: number;
  totalUsers: number;
  activeWorkers: number;
  emergencyCount: number;
  departmentStats: DepartmentStat[];
  weeklyTrend: TrendPoint[];
  monthlyTrend: TrendPoint[];
  topDepartments: { department: string; count: number }[];
  recentActivity: {
    id: string;
    event: string;
    complaintId: string;
    ticketId: string;
    actor: string;
    time: string;
  }[];
}

export interface WorkerPerformance {
  workerId: string;
  workerName: string;
  assigned: number;
  resolved: number;
  avgResolutionHours: number;
  rating: number;
}