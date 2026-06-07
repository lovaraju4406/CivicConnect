import { Router } from "express";
import { getNotifications, markRead, markAllRead, deleteNotification } from "../controllers/notifications.controller";
import { authenticate } from "../middleware/auth";

const router = Router();

router.use(authenticate);

router.get   ("/",                getNotifications);
router.patch ("/read-all",        markAllRead);
router.patch ("/:id/read",        markRead);
router.delete("/:id",             deleteNotification);

export default router;
