import { Router } from "express";
import {
  getComplaints, getMyComplaints, getComplaintById,
  createComplaint, updateComplaint, updateStatus,
  assignComplaint, uploadProof, rateComplaint,
} from "../controllers/complaints.controller";
import { authenticate, authorize } from "../middleware/auth";
import { uploadImage, uploadProof as uploadProofMiddleware } from "../middleware/upload";

const router = Router();

// All routes require authentication
router.use(authenticate);

// ⚠️  IMPORTANT: specific routes MUST come before /:id  ⚠️
router.get   ("/mine",                                                    getMyComplaints);
router.get   ("/",                                                        getComplaints);
router.get   ("/:id",                                                     getComplaintById);
router.post  ("/",              uploadImage,                              createComplaint);
router.patch ("/:id",                                                     updateComplaint);
router.patch ("/:id/status",    authorize("officer","admin","worker"),    updateStatus);
router.post  ("/:id/assign",    authorize("officer","admin"),             assignComplaint);
router.post  ("/:id/proof",     uploadProofMiddleware,                    uploadProof);
router.post  ("/:id/rate",      authorize("citizen"),                     rateComplaint);

export default router;