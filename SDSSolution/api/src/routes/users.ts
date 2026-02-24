import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { dynamics365Service, mapD365RolesToAppRoles, getD365RoleFlags } from "../services/dynamics365.js";

export const usersRouter = Router();

usersRouter.use(requireAuth);

// GET /api/users - list contacts and roles for Admin (from D365, same Account by account number)
usersRouter.get("/", requireRole("Admin"), async (req, res, next) => {
  try {
    const contactId = req.user?.id;
    const accountNumber = (req.user as { accountNumber?: string })?.accountNumber;
    if (!contactId) {
      return res.status(400).json({ error: "User contact ID not found" });
    }
    if (!dynamics365Service.isConfigured()) {
      return res.status(503).json({ error: "Dynamics 365 not configured" });
    }
    let contacts;
    if (accountNumber) {
      contacts = await dynamics365Service.getContactsByAccountNumber(accountNumber);
    } else {
      const adminContact = await dynamics365Service.getContactById(contactId);
      if (!adminContact) return res.status(404).json({ error: "Contact not found" });
      const accountNum = adminContact.parentcustomerid_account?.accountnumber;
      if (!accountNum) return res.status(400).json({ error: "Contact has no parent account number" });
      contacts = await dynamics365Service.getContactsByAccountNumber(String(accountNum));
    }
    const emailField = process.env.D365_EMAIL_FIELD ?? "emailaddress1";
    const list = contacts.map((c) => ({
      contactId: c.contactid,
      firstName: c.firstname ?? "",
      lastName: c.lastname ?? "",
      email: c[emailField] ?? "",
      roles: mapD365RolesToAppRoles(c),
      d365Roles: getD365RoleFlags(c),
      account: c.parentcustomerid_account ?? undefined,
    }));
    res.json({ contacts: list });
  } catch (e) {
    next(e);
  }
});

// PATCH /api/users/:contactId/roles - update contact roles (Admin only)
const updateRolesSchema = z.object({ d365Roles: z.record(z.string(), z.boolean()) });

usersRouter.patch("/:contactId/roles", requireRole("Admin"), async (req, res, next) => {
  try {
    const { contactId } = req.params;
    const parsed = updateRolesSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Invalid input" });
    }
    if (!dynamics365Service.isConfigured()) {
      return res.status(503).json({ error: "Dynamics 365 not configured" });
    }
    await dynamics365Service.updateContactRoles(contactId, parsed.data.d365Roles);
    res.json({ message: "Roles updated" });
  } catch (e) {
    next(e);
  }
});

// GET /api/users/:id - get user (Admin or self)
usersRouter.get("/:id", (req, res) => {
  res.status(501).json({ message: "Get user" });
});
