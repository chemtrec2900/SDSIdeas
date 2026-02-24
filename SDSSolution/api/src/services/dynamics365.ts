/**
 * Microsoft Dynamics 365 / Dataverse Web API service.
 * Contacts live in D365; login/email and password fields are configured via env.
 * Parent Account has many Contacts. Roles are boolean fields on Contact.
 */
const API_VERSION = "v9.2";

/** D365 role boolean fields for mapping + display. Default: CFBAdminContact, chem_msdscontributor, chemtrec_sdsauthoring, chemtrec_sdsaccess. Set D365_ROLE_FIELDS=field1,field2,... to override. Use empty/false to skip. */
const DEFAULT_ROLE_FIELDS = ["CFBAdminContact", "chem_msdscontributor", "chemtrec_sdsauthoring", "chemtrec_sdsaccess"];

function getRoleFields(): string[] {
  const env = process.env.D365_ROLE_FIELDS?.trim();
  if (env?.toLowerCase() === "false") return [];
  if (env === "") return [];
  if (env) return env.split(",").map((s) => s.trim()).filter(Boolean);
  return DEFAULT_ROLE_FIELDS;
}

function getConfig() {
  return {
    url: process.env.D365_URL,
    clientId: process.env.D365_CLIENT_ID,
    clientSecret: process.env.D365_CLIENT_SECRET,
    tenantId: process.env.D365_TENANT_ID,
    emailField: process.env.D365_EMAIL_FIELD ?? "emailaddress1",
    passwordField: process.env.D365_PASSWORD_FIELD ?? "crXXX_sdspassword",
  };
}

async function getAccessToken(): Promise<string> {
  const { clientId, clientSecret, tenantId, url } = getConfig();
  if (!clientId || !clientSecret || !tenantId) {
    throw new Error("D365_CLIENT_ID, D365_CLIENT_SECRET, D365_TENANT_ID must be set");
  }
  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  const scope = url ? `${url.replace(/\/$/, "")}/.default` : "";
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope,
    grant_type: "client_credentials",
  });
  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`D365 token failed: ${res.status} ${text}`);
  }
  const json = (await res.json()) as { access_token: string };
  return json.access_token;
}

export interface D365Account {
  name?: string | null;
  accountnumber?: string | null;
}

export interface D365Contact {
  contactid: string;
  firstname?: string | null;
  lastname?: string | null;
  _parentcustomerid_value?: string | null;  // lookup FK; parentcustomerid does not exist on Contact
  parentcustomerid_account?: D365Account & { accountid?: string } | null;
  [key: string]: unknown;
}

/** Map D365 role booleans to app roles: Admin, DocumentEditor, Viewer */
export function mapD365RolesToAppRoles(contact: D365Contact): string[] {
  const isTrue = (key: string) => {
    const v = contact[key];
    return v === true || v === "true" || v === 1;
  };
  if (isTrue("CFBAdminContact")) return ["Admin", "DocumentEditor", "Viewer"];
  if (isTrue("chem_msdscontributor") || isTrue("chemtrec_sdsauthoring")) return ["DocumentEditor", "Viewer"];
  if (isTrue("chemtrec_sdsaccess")) return ["Viewer"];
  return ["Viewer"];
}

/** Get raw D365 role flags for display (e.g. Admin UI) */
export function getD365RoleFlags(contact: D365Contact): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const f of getRoleFields()) {
    const v = contact[f];
    out[f] = v === true || v === "true" || v === 1;
  }
  return out;
}

export const dynamics365Service = {
  isConfigured(): boolean {
    const { url, clientId, clientSecret, tenantId } = getConfig();
    return Boolean(url && clientId && clientSecret && tenantId);
  },

  async getContactByEmail(email: string): Promise<D365Contact | null> {
    const { url, emailField, passwordField } = getConfig();
    if (!url) throw new Error("D365_URL not configured");
    const token = await getAccessToken();
    const baseUrl = url.replace(/\/$/, "");
    const filter = `${emailField} eq '${email.replace(/'/g, "''")}'`;
    const roleFields = getRoleFields();
    const roleSelect = roleFields.length ? "," + roleFields.join(",") : "";
    const select = `contactid,${emailField},${passwordField},firstname,lastname,_parentcustomerid_value${roleSelect}`;
    const expand = "parentcustomerid_account($select=name,accountnumber,accountid)";
    const params = new URLSearchParams({
      $filter: filter,
      $select: select,
      $expand: expand,
      $top: "1",
    });
    const apiUrl = `${baseUrl}/api/data/${API_VERSION}/contacts?${params.toString()}`;
    const res = await fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        "OData-MaxVersion": "4.0",
        "OData-Version": "4.0",
        Accept: "application/json",
      },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`D365 query failed: ${res.status} ${body || res.statusText}`);
    }
    const json = (await res.json()) as { value: D365Contact[] };
    return json.value?.[0] ?? null;
  },

  async getContactById(contactId: string): Promise<D365Contact | null> {
    const { url, emailField, passwordField } = getConfig();
    if (!url) throw new Error("D365_URL not configured");
    const token = await getAccessToken();
    const baseUrl = url.replace(/\/$/, "");
    const roleFields = getRoleFields();
    const roleSelect = roleFields.length ? "," + roleFields.join(",") : "";
    const select = `contactid,${emailField},${passwordField},firstname,lastname,_parentcustomerid_value${roleSelect}`;
    const expand = "parentcustomerid_account($select=name,accountnumber,accountid)";
    const params = new URLSearchParams({ $select: select, $expand: expand });
    const apiUrl = `${baseUrl}/api/data/${API_VERSION}/contacts(${contactId})?${params.toString()}`;
    const res = await fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        "OData-MaxVersion": "4.0",
        "OData-Version": "4.0",
        Accept: "application/json",
      },
    });
    if (!res.ok) return null;
    return (await res.json()) as D365Contact;
  },

  /** Get all contacts for an Account by account number (parentcustomerid_account/accountnumber). */
  async getContactsByAccountNumber(accountNumber: string): Promise<D365Contact[]> {
    const { url, emailField, passwordField } = getConfig();
    if (!url) throw new Error("D365_URL not configured");
    const token = await getAccessToken();
    const baseUrl = url.replace(/\/$/, "");
    const filter = `parentcustomerid_account/accountnumber eq '${accountNumber.replace(/'/g, "''")}'`;
    const roleFields = getRoleFields();
    const roleSelect = roleFields.length ? "," + roleFields.join(",") : "";
    const select = `contactid,${emailField},${passwordField},firstname,lastname,_parentcustomerid_value${roleSelect}`;
    const expand = "parentcustomerid_account($select=name,accountnumber,accountid)";
    const params = new URLSearchParams({
      $filter: filter,
      $select: select,
      $expand: expand,
      $orderby: "lastname,firstname",
    });
    const apiUrl = `${baseUrl}/api/data/${API_VERSION}/contacts?${params.toString()}`;
    const res = await fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        "OData-MaxVersion": "4.0",
        "OData-Version": "4.0",
        Accept: "application/json",
      },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`D365 contacts query failed: ${res.status} ${body || res.statusText}`);
    }
    const json = (await res.json()) as { value: D365Contact[] };
    return json.value ?? [];
  },

  /** Get all contacts for an Account by account GUID (parentcustomerid). */
  async getContactsByAccountId(accountId: string): Promise<D365Contact[]> {
    const { url, emailField, passwordField } = getConfig();
    if (!url) throw new Error("D365_URL not configured");
    const token = await getAccessToken();
    const baseUrl = url.replace(/\/$/, "");
    const filter = `_parentcustomerid_value eq '${accountId.replace(/'/g, "''")}'`;
    const roleFields = getRoleFields();
    const roleSelect = roleFields.length ? "," + roleFields.join(",") : "";
    const select = `contactid,${emailField},${passwordField},firstname,lastname,_parentcustomerid_value${roleSelect}`;
    const expand = "parentcustomerid_account($select=name,accountnumber,accountid)";
    const params = new URLSearchParams({
      $filter: filter,
      $select: select,
      $expand: expand,
      $orderby: "lastname,firstname",
    });
    const apiUrl = `${baseUrl}/api/data/${API_VERSION}/contacts?${params.toString()}`;
    const res = await fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        "OData-MaxVersion": "4.0",
        "OData-Version": "4.0",
        Accept: "application/json",
      },
    });
    if (!res.ok) throw new Error(`D365 contacts query failed: ${res.status}`);
    const json = (await res.json()) as { value: D365Contact[] };
    return json.value ?? [];
  },

  async updateContactPassword(contactId: string, passwordHash: string): Promise<void> {
    const { url, passwordField } = getConfig();
    if (!url) throw new Error("D365_URL not configured");
    const token = await getAccessToken();
    const baseUrl = url.replace(/\/$/, "");
    const apiUrl = `${baseUrl}/api/data/${API_VERSION}/contacts(${contactId})`;
    const res = await fetch(apiUrl, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "OData-MaxVersion": "4.0",
        "OData-Version": "4.0",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ [passwordField]: passwordHash }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`D365 update failed: ${res.status} ${text}`);
    }
  },

  getPasswordFromContact(contact: D365Contact): string | null {
    const { passwordField } = getConfig();
    const val = contact[passwordField];
    return val != null ? String(val) : null;
  },

  /** Update D365 role boolean fields for a contact. Only updates fields in getRoleFields(). */
  async updateContactRoles(contactId: string, roleFlags: Record<string, boolean>): Promise<void> {
    const { url } = getConfig();
    if (!url) throw new Error("D365_URL not configured");
    const allowedFields = new Set(getRoleFields());
    const payload: Record<string, boolean> = {};
    for (const [key, val] of Object.entries(roleFlags)) {
      if (allowedFields.has(key)) payload[key] = Boolean(val);
    }
    if (Object.keys(payload).length === 0) return;
    const token = await getAccessToken();
    const baseUrl = url.replace(/\/$/, "");
    const apiUrl = `${baseUrl}/api/data/${API_VERSION}/contacts(${contactId})`;
    const res = await fetch(apiUrl, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "OData-MaxVersion": "4.0",
        "OData-Version": "4.0",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`D365 role update failed: ${res.status} ${text}`);
    }
  },
};

export { getRoleFields };
