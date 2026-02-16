/**
 * Microsoft Dynamics 365 / Dataverse Web API service.
 * Contacts live in D365; login/email and password fields are configured via env.
 */
const API_VERSION = "v9.2";

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

export interface D365Contact {
  contactid: string;
  firstname?: string | null;
  lastname?: string | null;
  [key: string]: unknown;
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
    const select = `contactid,${emailField},${passwordField},firstname,lastname`;
    const params = new URLSearchParams({
      $filter: filter,
      $select: select,
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
    if (!res.ok) throw new Error(`D365 query failed: ${res.status}`);
    const json = (await res.json()) as { value: D365Contact[] };
    return json.value?.[0] ?? null;
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
};
