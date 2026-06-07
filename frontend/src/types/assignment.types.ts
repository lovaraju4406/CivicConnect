export interface Assignment {
  id: string;
  complaintId: string;
  assignedTo: string;   // worker id
  assignedBy: string;   // officer/admin id
  assignedAt: number;
  completedAt?: number;
  notes?: string;
}

// types/analytics.types.ts
export interface DeptStat {
  department: string;
  total: number;
  resolved: number;
  pending: number;
  assigned: number;
  rate: number;
}

export interface TrendPoint {
  date: string;
  submitted: number;
  resolved: number;
}

// types/notification.types.ts
export interface Notification {
  id: string;
  message: string;
  read: boolean;
  createdAt: number;
  type?: "info" | "success" | "warning" | "error";
  relatedId?: string;
}