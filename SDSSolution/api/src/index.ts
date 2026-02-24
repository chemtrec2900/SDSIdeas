import { config } from "dotenv";
import path from "path";

config({ path: path.resolve(process.cwd(), ".env") });

import express from "express";
import cors from "cors";
import helmet from "helmet";

import { authRouter } from "./routes/auth.js";
import { documentsRouter } from "./routes/documents.js";
import { healthRouter } from "./routes/health.js";
import { usersRouter } from "./routes/users.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { devAuth } from "./middleware/devAuth.js";

const app = express();
const PORT = process.env.PORT ?? 3001;
const isProduction = process.env.NODE_ENV === "production";
const webDistPath = path.resolve(__dirname, "../web-dist");

app.use(helmet({
  contentSecurityPolicy: isProduction ? undefined : false,
  crossOriginEmbedderPolicy: false,
}));
app.use(cors({ origin: process.env.WEB_URL ?? (isProduction ? undefined : "http://localhost:5173"), credentials: true }));
app.use(express.json({ limit: "10mb" }));
app.use(devAuth);

// API routes
app.use("/api/health", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api/users", usersRouter);
app.use("/api/documents", documentsRouter);
app.use("/api", (_req, res) => res.status(404).json({ error: "Not found" }));

// Serve static web app (production - from Docker build)
if (isProduction) {
  app.use(express.static(webDistPath, { index: false }));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/")) return next();
    res.sendFile(path.join(webDistPath, "index.html"), (err) => {
      if (err) next(err);
    });
  });
}

// Error handler (must be after routes)
app.use(errorHandler);

app.listen(PORT, () => {
  const d365 = Boolean(
    process.env.D365_URL && process.env.D365_CLIENT_ID && process.env.D365_CLIENT_SECRET && process.env.D365_TENANT_ID
  );
  console.log(`[API] Server running at http://localhost:${PORT}`);
  console.log(`[API] Dynamics 365 auth: ${d365 ? "configured" : "not configured"}`);
});
