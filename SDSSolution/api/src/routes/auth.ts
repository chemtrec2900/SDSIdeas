import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../config/prisma.js";
import { dynamics365Service, mapD365RolesToAppRoles } from "../services/dynamics365.js";
import { signToken } from "../services/jwt.js";

const DEV_SKIP_AUTH = process.env.DEV_SKIP_AUTH === "true";
const ENTRA_CLIENT_ID = process.env.ENTRA_CLIENT_ID;
const ENTRA_CLIENT_SECRET = process.env.ENTRA_CLIENT_SECRET;
const ENTRA_TENANT_ID = process.env.ENTRA_TENANT_ID;
const ENTRA_REDIRECT_URI = process.env.ENTRA_REDIRECT_URI ?? "http://localhost:3001/api/auth/microsoft/callback";
const WEB_URL = process.env.WEB_URL ?? "http://localhost:5173";
const ENTRA_POST_LOGIN_REDIRECT_URI = process.env.ENTRA_POST_LOGIN_REDIRECT_URI ?? `${WEB_URL}/auth/callback`;
const ENTRA_OAUTH_TIMEOUT_MS = 10 * 60 * 1000;
const entraStateStore = new Map<string, number>();

export const authRouter = Router();

function getRolesFromContact(contact: { [key: string]: unknown }): string[] {
  return mapD365RolesToAppRoles(contact as Parameters<typeof mapD365RolesToAppRoles>[0]);
}

function isEntraConfigured(): boolean {
  return Boolean(ENTRA_CLIENT_ID && ENTRA_CLIENT_SECRET && ENTRA_TENANT_ID);
}

function cleanupExpiredEntraStates(): void {
  const now = Date.now();
  for (const [state, expiresAt] of entraStateStore.entries()) {
    if (expiresAt <= now) entraStateStore.delete(state);
  }
}

function buildPostLoginRedirect(params: { token?: string; error?: string; message?: string }): string {
  const url = new URL(ENTRA_POST_LOGIN_REDIRECT_URI);
  if (params.token) url.searchParams.set("token", params.token);
  if (params.error) url.searchParams.set("error", params.error);
  if (params.message) url.searchParams.set("message", params.message);
  return url.toString();
}

function extractPrimaryEmail(profile: {
  mail?: string | null;
  userPrincipalName?: string | null;
}): string | null {
  const raw = profile.mail?.trim() || profile.userPrincipalName?.trim();
  if (!raw) return null;
  return raw.toLowerCase();
}

type MicrosoftProfile = {
  id: string;
  mail?: string | null;
  userPrincipalName?: string | null;
  givenName?: string | null;
  surname?: string | null;
};

async function exchangeMicrosoftCodeForAccessToken(code: string): Promise<string> {
  if (!isEntraConfigured()) throw new Error("Entra ID SSO is not configured");
  const tokenUrl = `https://login.microsoftonline.com/${ENTRA_TENANT_ID}/oauth2/v2.0/token`;
  const params = new URLSearchParams({
    client_id: ENTRA_CLIENT_ID!,
    client_secret: ENTRA_CLIENT_SECRET!,
    grant_type: "authorization_code",
    code,
    redirect_uri: ENTRA_REDIRECT_URI,
    scope: "openid profile email User.Read",
  });
  const tokenRes = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    throw new Error(`Microsoft token exchange failed: ${tokenRes.status} ${text}`);
  }
  const tokenBody = (await tokenRes.json()) as { access_token: string };
  return tokenBody.access_token;
}

async function fetchMicrosoftProfile(accessToken: string): Promise<MicrosoftProfile> {
  const profileRes = await fetch("https://graph.microsoft.com/v1.0/me?$select=id,mail,userPrincipalName,givenName,surname", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!profileRes.ok) {
    const text = await profileRes.text();
    throw new Error(`Microsoft profile lookup failed: ${profileRes.status} ${text}`);
  }
  return (await profileRes.json()) as MicrosoftProfile;
}

// POST /api/auth/register - register/set password for existing D365 contact
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

authRouter.post("/register", async (req, res, next) => {
  try {
    if (DEV_SKIP_AUTH) {
      return res.json({ message: "Dev mode: registration skipped" });
    }
    if (!dynamics365Service.isConfigured()) {
      return res.status(503).json({ error: "Registration not available (Dynamics 365 not configured)" });
    }
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Invalid input" });
    }
    const { email, password } = parsed.data;

    const contact = await dynamics365Service.getContactByEmail(email);
    if (!contact) {
      return res.status(404).json({ error: "No contact found with this email. Please contact your administrator." });
    }

    const existingHash = dynamics365Service.getPasswordFromContact(contact);
    if (existingHash && existingHash.length > 0) {
      return res.status(400).json({ error: "Account already registered. Use Sign in or Forgot password." });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await dynamics365Service.updateContactPassword(contact.contactid, passwordHash);

    const roles = getRolesFromContact(contact);
    const firstName = contact.firstname != null ? String(contact.firstname) : "";
    const lastName = contact.lastname != null ? String(contact.lastname) : "";
    const account = contact.parentcustomerid_account;
    const accountName = account?.name != null ? String(account.name) : undefined;
    const accountNumber = account?.accountnumber != null ? String(account.accountnumber) : undefined;
    const payload = {
      id: contact.contactid,
      email,
      roles,
      contactId: contact.contactid,
      firstName,
      lastName,
      accountName,
      accountNumber,
    };
    const token = signToken(payload);

    res.json({
      token,
      user: { id: payload.id, email: payload.email, roles: payload.roles, firstName, lastName, accountName, accountNumber },
    });
  } catch (e) {
    next(e);
  }
});

// POST /api/auth/login - email/password login (validates against D365 contact)
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

authRouter.post("/login", async (req, res, next) => {
  try {
    if (DEV_SKIP_AUTH) {
      return res.json({ message: "Dev login ok" });
    }
    if (!dynamics365Service.isConfigured()) {
      return res.status(503).json({ error: "Login not available (Dynamics 365 not configured)" });
    }
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Invalid input" });
    }
    const { email, password } = parsed.data;

    const contact = await dynamics365Service.getContactByEmail(email);
    if (!contact) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const stored = dynamics365Service.getPasswordFromContact(contact);
    if (!stored || String(stored).length === 0) {
      return res.status(401).json({ error: "Account not registered. Please register first." });
    }

    // Support both bcrypt hashes (from Register) and plain-text passwords (existing in D365)
    const isBcryptHash = /^\$2[aby]\$\d{2}\$.+/.test(stored);
    const valid = isBcryptHash
      ? await bcrypt.compare(password, stored)
      : stored === password;
    if (!valid) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const roles = getRolesFromContact(contact);
    const firstName = contact.firstname != null ? String(contact.firstname) : "";
    const lastName = contact.lastname != null ? String(contact.lastname) : "";
    const account = contact.parentcustomerid_account;
    const accountName = account?.name != null ? String(account.name) : undefined;
    const accountNumber = account?.accountnumber != null ? String(account.accountnumber) : undefined;
    const payload = {
      id: contact.contactid,
      email,
      roles,
      contactId: contact.contactid,
      firstName,
      lastName,
      accountName,
      accountNumber,
    };
    const token = signToken(payload);

    res.json({
      token,
      user: { id: payload.id, email: payload.email, roles: payload.roles, firstName, lastName, accountName, accountNumber },
    });
  } catch (e) {
    next(e);
  }
});

// GET /api/auth/microsoft/start - start Entra ID sign-in
authRouter.get("/microsoft/start", (req, res) => {
  if (DEV_SKIP_AUTH) {
    return res.redirect(buildPostLoginRedirect({ error: "sso_disabled", message: "Microsoft sign-in is disabled in dev bypass mode." }));
  }
  if (!isEntraConfigured()) {
    return res.redirect(buildPostLoginRedirect({ error: "sso_not_configured", message: "Microsoft sign-in is not configured." }));
  }

  cleanupExpiredEntraStates();
  const state = crypto.randomUUID();
  entraStateStore.set(state, Date.now() + ENTRA_OAUTH_TIMEOUT_MS);

  const authorizeUrl = new URL(`https://login.microsoftonline.com/${ENTRA_TENANT_ID}/oauth2/v2.0/authorize`);
  authorizeUrl.searchParams.set("client_id", ENTRA_CLIENT_ID!);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("redirect_uri", ENTRA_REDIRECT_URI);
  authorizeUrl.searchParams.set("response_mode", "query");
  authorizeUrl.searchParams.set("scope", "openid profile email User.Read");
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("prompt", "select_account");

  return res.redirect(authorizeUrl.toString());
});

// GET /api/auth/microsoft/callback - complete Entra ID sign-in
authRouter.get("/microsoft/callback", async (req, res) => {
  try {
    const code = typeof req.query.code === "string" ? req.query.code : "";
    const state = typeof req.query.state === "string" ? req.query.state : "";
    const oauthError = typeof req.query.error === "string" ? req.query.error : "";
    const oauthErrorDescription = typeof req.query.error_description === "string" ? req.query.error_description : "";

    if (oauthError) {
      return res.redirect(buildPostLoginRedirect({
        error: "sso_failed",
        message: oauthErrorDescription || "Microsoft sign-in was cancelled or failed.",
      }));
    }
    if (!code || !state) {
      return res.redirect(buildPostLoginRedirect({ error: "invalid_callback", message: "Microsoft sign-in callback is invalid." }));
    }

    cleanupExpiredEntraStates();
    const expiresAt = entraStateStore.get(state);
    if (!expiresAt || expiresAt < Date.now()) {
      entraStateStore.delete(state);
      return res.redirect(buildPostLoginRedirect({ error: "invalid_state", message: "Microsoft sign-in session expired. Please try again." }));
    }
    entraStateStore.delete(state);

    if (!dynamics365Service.isConfigured()) {
      return res.redirect(buildPostLoginRedirect({
        error: "dynamics_not_configured",
        message: "Dynamics 365 is not configured. Please contact support.",
      }));
    }

    const accessToken = await exchangeMicrosoftCodeForAccessToken(code);
    const profile = await fetchMicrosoftProfile(accessToken);
    const email = extractPrimaryEmail(profile);
    if (!email) {
      return res.redirect(buildPostLoginRedirect({
        error: "missing_email",
        message: "Microsoft account has no usable email address.",
      }));
    }

    const contact = await dynamics365Service.getContactByEmail(email);
    if (!contact) {
      console.log(`[AUTH] Microsoft sign-in denied. No Dynamics contact for email: ${email}`);
      return res.redirect(buildPostLoginRedirect({
        error: "no_account",
        message: "You do not have an account with us. Please contact us to register your account and contact.",
      }));
    }

    const roles = getRolesFromContact(contact);
    const firstName = contact.firstname != null ? String(contact.firstname) : (profile.givenName ?? "");
    const lastName = contact.lastname != null ? String(contact.lastname) : (profile.surname ?? "");
    const account = contact.parentcustomerid_account;
    const accountName = account?.name != null ? String(account.name) : undefined;
    const accountNumber = account?.accountnumber != null ? String(account.accountnumber) : undefined;
    const payload = {
      id: contact.contactid,
      email,
      roles,
      contactId: contact.contactid,
      firstName,
      lastName,
      accountName,
      accountNumber,
    };
    const token = signToken(payload);

    return res.redirect(buildPostLoginRedirect({ token }));
  } catch (error) {
    console.error("[AUTH] Microsoft sign-in failed:", error);
    return res.redirect(buildPostLoginRedirect({
      error: "sso_failed",
      message: "Microsoft sign-in failed. Please try again.",
    }));
  }
});

// POST /api/auth/forgot-password - request password reset
const forgotSchema = z.object({ email: z.string().email() });

authRouter.post("/forgot-password", async (req, res, next) => {
  try {
    if (DEV_SKIP_AUTH) {
      return res.json({ message: "Dev: Check your email for reset link (simulated)" });
    }
    if (!dynamics365Service.isConfigured()) {
      return res.status(503).json({ error: "Password recovery not available" });
    }
    const parsed = forgotSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid email" });
    }
    const { email } = parsed.data;

    const contact = await dynamics365Service.getContactByEmail(email);
    if (!contact) {
      return res.json({ message: "If an account exists, you will receive a reset link." }); // Don't leak existence
    }

    const token = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, "");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.passwordResetToken.create({
      data: { email, token, expiresAt },
    });

    // TODO: Send email with reset link - integrate SendGrid/SMTP
    const resetLink = `${process.env.WEB_URL ?? "http://localhost:5173"}/reset-password?token=${token}`;
    console.log(`[AUTH] Password reset link for ${email}: ${resetLink}`); // Remove in prod; use email

    res.json({ message: "If an account exists, you will receive a reset link." });
  } catch (e) {
    next(e);
  }
});

// POST /api/auth/reset-password - set new password with token
const resetSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

authRouter.post("/reset-password", async (req, res, next) => {
  try {
    if (DEV_SKIP_AUTH) {
      return res.json({ message: "Dev: Password reset complete" });
    }
    if (!dynamics365Service.isConfigured()) {
      return res.status(503).json({ error: "Password recovery not available" });
    }
    const parsed = resetSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Invalid input" });
    }
    const { token, password } = parsed.data;

    const record = await prisma.passwordResetToken.findUnique({
      where: { token },
    });
    if (!record || record.expiresAt < new Date()) {
      return res.status(400).json({ error: "Invalid or expired reset link. Please request a new one." });
    }

    const contact = await dynamics365Service.getContactByEmail(record.email);
    if (!contact) {
      return res.status(400).json({ error: "Contact not found" });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await dynamics365Service.updateContactPassword(contact.contactid, passwordHash);

    await prisma.passwordResetToken.delete({ where: { id: record.id } });

    res.json({ message: "Password has been reset. You can now sign in." });
  } catch (e) {
    next(e);
  }
});

// POST /api/auth/logout
authRouter.post("/logout", (_req, res) => {
  res.json({ message: "Logged out" });
});

// GET /api/auth/me - current user (requires JWT or dev bypass)
authRouter.get("/me", (req, res) => {
  if (req.user) {
    return res.json({
      id: req.user.id,
      email: req.user.email,
      roles: req.user.roles,
      firstName: req.user.firstName,
      lastName: req.user.lastName,
      accountName: req.user.accountName,
      accountNumber: req.user.accountNumber,
    });
  }
  res.status(401).json({ error: "Not authenticated" });
});
