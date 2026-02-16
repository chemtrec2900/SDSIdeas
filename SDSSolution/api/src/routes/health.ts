import { Router } from "express";
import { dynamics365Service } from "../services/dynamics365.js";

export const healthRouter = Router();

healthRouter.get("/", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

/**
 * GET /api/health/d365
 * Checks if Dynamics 365 / Dataverse is configured and reachable.
 * Use this to verify app registration, permissions, and Web API access.
 */
healthRouter.get("/d365", async (_req, res) => {
  const checks: { name: string; status: "ok" | "fail"; message?: string }[] = [];
  const envVars = ["D365_URL", "D365_CLIENT_ID", "D365_CLIENT_SECRET", "D365_TENANT_ID"];
  const envSet = envVars.every((v) => Boolean(process.env[v]));
  checks.push({
    name: "env",
    status: envSet ? "ok" : "fail",
    message: envSet ? "All D365 env vars set" : `Missing: ${envVars.filter((v) => !process.env[v]).join(", ")}`,
  });

  if (!envSet) {
    return res.json({ configured: false, checks });
  }

  if (!dynamics365Service.isConfigured()) {
    return res.json({ configured: false, checks });
  }

  try {
    const contact = await dynamics365Service.getContactByEmail("__health_check_does_not_exist__@example.com");
    checks.push({
      name: "token_and_api",
      status: "ok",
      message: "OAuth token and Web API request succeeded (no contact found, as expected)",
    });
    if (contact) {
      checks.push({ name: "filter", status: "ok", message: "Filter executed (unexpected match)" });
    }
  } catch (e) {
    const err = e as Error;
    checks.push({
      name: "token_or_api",
      status: "fail",
      message: err.message ?? String(e),
    });
  }

  const allOk = checks.every((c) => c.status === "ok");
  res.json({
    configured: true,
    ok: allOk,
    checks,
    hint: allOk
      ? "D365 is working. Try login with a real contact email."
      : "Fix the failing check (token permissions, D365 URL, or API permissions).",
  });
});
