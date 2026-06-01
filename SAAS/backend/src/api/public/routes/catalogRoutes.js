import express from "express";
import { getCatalog } from "../controllers/catalogController.js";

const router = express.Router();

// GET /api/public/catalog/:machine_id
// PUBLIC — no auth required. Customer-facing (QR code scan).
router.get("/:machine_id", getCatalog);

export default router;
