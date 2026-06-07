/**
 * assignment.api.ts — Wraps complaintsAPI.assign for backwards compat
 */
import { complaintsAPI } from "../../services/api";

export const assignmentApi = {
  assign:      (complaintId: string, workerId: string, notes?: string) =>
    complaintsAPI.assign(complaintId, workerId, notes),

  getByWorker: () =>
    complaintsAPI.getAll({ status: "Assigned" }),

  unassign: (_complaintId: string) =>
    Promise.resolve({ message: "Use updateStatus to change back to Pending" }),
};