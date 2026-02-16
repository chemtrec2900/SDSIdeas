import type { Request, Response, NextFunction } from "express";

export function errorHandler(
  err: Error & { statusCode?: number },
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = err.statusCode ?? 500;
  res.status(statusCode).json({
    error: err.message ?? "Internal Server Error",
  });
}
