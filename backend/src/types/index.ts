export type UserRole = "citizen" | "officer" | "worker" | "admin";
export type ComplaintStatus = "Pending" | "Assigned" | "Resolved";
export type NotifType = "info" | "success" | "warning" | "error";

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  district?: string;
  department?: string;
  badge_number?: string;
  employee_id?: string;
  designation?: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Complaint {
  id: string;
  ticket_id: string;
  title: string;
  description: string;
  department: string;
  lat: number;
  lng: number;
  address: string;
  image_url?: string;
  status: ComplaintStatus;
  is_emergency: boolean;
  emergency_reason?: string;
  user_id: string;
  assigned_to?: string;
  assigned_at?: Date;
  resolved_at?: Date;
  resolved_by?: string;
  proof_image?: string;
  resolution_note?: string;
  rating?: number;
  rating_comment?: string;
  created_at: Date;
  updated_at: Date;
}

export interface Assignment {
  id: string;
  complaint_id: string;
  assigned_to: string;
  assigned_by: string;
  notes?: string;
  assigned_at: Date;
  completed_at?: Date;
}

export interface Notification {
  id: string;
  user_id: string;
  message: string;
  type: NotifType;
  related_id?: string;
  is_read: boolean;
  created_at: Date;
}

// Express augmentation for JWT user on req
declare global {
  namespace Express {
    interface Request {
      user?: { id: string; role: UserRole; email: string };
    }
  }
}
