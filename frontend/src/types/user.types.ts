export type UserRole = "citizen" | "officer" | "worker" | "admin";
export interface User {
  id: string; name: string; fullName?: string; email: string;
  phone?: string; role: UserRole; district?: string;
  department?: string; badgeNumber?: string; employeeId?: string;
  designation?: string; rank?: string;
}