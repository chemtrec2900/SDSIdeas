import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "../services/jwt.js";

const DEV_SKIP_AUTH = process.env.DEV_SKIP_AUTH === "true";

const DEV_USER = {
  id: "dev-user-1",
  email: "dev@example.com",
  roles: ["Admin", "DocumentEditor", "Viewer"],
  companyCode: "DEV001",
  firstName: "Dev",
  lastName: "User",
};

export function devAuth(req: Request, _res: Response, next: NextFunction): void {
  // 1. Try JWT from Authorization header
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice(7);
    try {
      const payload = verifyToken(token);
      req.user = {
        id: payload.id,
        email: payload.email,
        roles: payload.roles,
        firstName: payload.firstName,
        lastName: payload.lastName,
      };
      return next();
    } catch {
      // Invalid token, fall through
    }
  }

  // 2. Dev bypass
  if (DEV_SKIP_AUTH) {
    req.user = DEV_USER;
  }

  next();
}
