import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, "../.env") });
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

app.use(helmet());
app.use(cors({ origin: process.env.WEB_URL ?? "http://localhost:5173", credentials: true }));
app.use(express.json({ limit: "10mb" }));
app.use(devAuth);

// Routes
app.use("/api/health", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api/users", usersRouter);
app.use("/api/documents", documentsRouter);

// Error handler
app.use(errorHandler);

app.listen(PORT, () => {
  const d365 = Boolean(
    process.env.D365_URL && process.env.D365_CLIENT_ID && process.env.D365_CLIENT_SECRET && process.env.D365_TENANT_ID
  );
  console.log(`[API] Server running at http://localhost:${PORT}`);
  console.log(`[API] Dynamics 365 auth: ${d365 ? "configured" : "not configured"}`);
});
