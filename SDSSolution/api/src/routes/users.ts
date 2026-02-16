import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const usersRouter = Router();

usersRouter.use(requireAuth);

// GET /api/users - list users (Admin)
usersRouter.get("/", requireRole("Admin"), (_req, res) => {
  res.status(501).json({ message: "List users" });
});

// GET /api/users/:id - get user
usersRouter.get("/:id", (_req, res) => {
  res.status(501).json({ message: "Get user" });
});
