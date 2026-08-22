import { Router } from "express";
import { authMiddleware }  from "../middlewares/authMiddleware.js";
import { authorizeRoles }  from "../middlewares/rbacMiddleware.js";
import {
  listAssignments,
  createAssignment,
  deleteAssignment,
} from "../controllers/machineController.js";

const router = Router();

// All assignment routes require JWT + ADMIN or above
router.use(authMiddleware, authorizeRoles("SUPER_ADMIN", "ADMIN"));

router.get("/",     listAssignments);    // List all assignments for this company
router.post("/",    createAssignment);   // Assign a technician to a machine
router.delete("/:id", deleteAssignment); // Remove a technician–machine assignment

export default router;
