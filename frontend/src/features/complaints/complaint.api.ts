/**
 * complaint.api.ts — Real backend complaints
 * Replaces the old localStorage-based mock
 */
import { complaintsAPI } from "../../services/api";

export const complaintApi = complaintsAPI;
export default complaintsAPI;