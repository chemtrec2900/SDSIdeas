import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../config/prisma.js";
import { dynamics365Service } from "../services/dynamics365.js";
import { signToken } from "../services/jwt.js";

const DEV_SKIP_AUTH = process.env.DEV_SKIP_AUTH === "true";

export const authRouter = Router();

// Default roles for new/registered users
const DEFAULT_ROLES = ["Viewer"];

function getRolesFromContact(_contact: { [key: string]: unknown }): string[] {
  // Map D365 contact fields to roles if needed (e.g. custom role field)
  return DEFAULT_ROLES;
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
    const payload = {
      id: contact.contactid,
      email,
      roles,
      contactId: contact.contactid,
      firstName,
      lastName,
    };
    const token = signToken(payload);

    res.json({
      token,
      user: { id: payload.id, email: payload.email, roles: payload.roles, firstName, lastName },
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
    const payload = {
      id: contact.contactid,
      email,
      roles,
      contactId: contact.contactid,
      firstName,
      lastName,
    };
    const token = signToken(payload);

    res.json({
      token,
      user: { id: payload.id, email: payload.email, roles: payload.roles, firstName, lastName },
    });
  } catch (e) {
    next(e);
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
    });
  }
  res.status(401).json({ error: "Not authenticated" });
});
