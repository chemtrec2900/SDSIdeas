import type { Request, Response, NextFunction } from "express";

// Placeholder for JWT/session validation
// Integrate with Passport and Entra ID in Phase 2
export type AuthUser = {
  id: string;
  email: string;
  roles: string[];
  companyCode?: string;
  firstName?: string;
  lastName?: string;
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  next();
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    if (!roles.some((r) => req.user!.roles.includes(r))) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    next();
  };
}
