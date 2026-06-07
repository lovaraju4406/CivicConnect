
export type ComplaintStatus = "Pending" | "Assigned" | "Resolved";
export interface Complaint {
  id: string; ticketId: string; title: string; description: string;
  department: string; lat: number; lng: number; address: string;
  image?: string; status: ComplaintStatus; createdAt: number;
  userId: string; userName: string;
  assignedTo?: string; assignedName?: string;
  resolvedAt?: number; resolvedBy?: string; proofImage?: string;
}