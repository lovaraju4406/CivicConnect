import { Router } from "express";
import { getAllUsers, getWorkers, getUserById, updateUser, deleteUser } from "../controllers/users.controller";
import { authenticate, authorize } from "../middleware/auth";

const router = Router();

router.use(authenticate);

router.get   ("/",          authorize("admin"),                  getAllUsers);
router.get   ("/workers",   authorize("officer","admin"),        getWorkers);
router.get   ("/:id",       authorize("officer","admin"),        getUserById);
router.patch ("/:id",       authorize("admin"),                  updateUser);
router.delete("/:id",       authorize("admin"),                  deleteUser);

export default router;
