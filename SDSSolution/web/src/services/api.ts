const API_BASE = '/api';

const TOKEN_KEY = 'sds_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(path: string, opts?: RequestInit): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(opts?.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    credentials: 'include',
    headers,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? res.statusText);
  }
  if (res.status === 204 || res.headers.get('content-length') === '0') return undefined as T;
  return res.json();
}

export const api = {
  health: () => request<{ status: string }>('/health'),
  auth: {
    microsoftStartUrl: () => `${API_BASE}/auth/microsoft/start`,
    login: (email: string, password: string) =>
      request<{ token: string; user: { id: string; email: string; roles: string[]; firstName?: string; lastName?: string; accountName?: string; accountNumber?: string } }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    register: (email: string, password: string) =>
      request<{ token: string; user: { id: string; email: string; roles: string[]; firstName?: string; lastName?: string; accountName?: string; accountNumber?: string } }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    logout: () => request('/auth/logout', { method: 'POST' }),
    me: () => request<{ id: string; email: string; roles: string[]; firstName?: string; lastName?: string; accountName?: string; accountNumber?: string }>('/auth/me'),
    forgotPassword: (email: string) =>
      request<{ message: string }>('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      }),
    resetPassword: (token: string, password: string) =>
      request<{ message: string }>('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      }),
  },
  documents: {
    search: (params: { q?: string; department?: string; site?: string; page?: number; limit?: number }) => {
      const sp = new URLSearchParams();
      if (params.q) sp.set('q', params.q);
      if (params.department) sp.set('department', params.department);
      if (params.site) sp.set('site', params.site);
      if (params.page) sp.set('page', String(params.page));
      if (params.limit) sp.set('limit', String(params.limit ?? 20));
      return request<{ items: Document[]; total: number; page: number; limit: number }>(`/documents?${sp}`);
    },
    get: (id: string) => request<Document>(`/documents/${id}`),
    download: (id: string) => request<{ url: string; filename: string }>(`/documents/${id}/download`),
    share: (id: string, expiresInDays?: number) =>
      request<{ shareUrl: string }>(`/documents/${id}/share`, {
        method: 'POST',
        body: JSON.stringify({ expiresInDays }),
      }),
    upload: (formData: FormData) =>
      fetch(`${API_BASE}/documents`, {
        method: 'POST',
        credentials: 'include',
        headers: { Authorization: getToken() ? `Bearer ${getToken()}` : '' },
        body: formData,
      }).then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error ?? res.statusText);
        }
        return res.json();
      }),
    bulkUpload: (files: File[]) => {
      const fd = new FormData();
      files.forEach((f) => fd.append('files', f));
      return fetch(`${API_BASE}/documents/bulk`, {
        method: 'POST',
        credentials: 'include',
        headers: { Authorization: getToken() ? `Bearer ${getToken()}` : '' },
        body: fd,
      }).then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error ?? res.statusText);
        }
        return res.json();
      });
    },
    update: (id: string, data: Record<string, unknown>) =>
      request<Document>(`/documents/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    bulkUpdate: (ids: string[], metadata: Record<string, unknown>) =>
      request('/documents/bulk', {
        method: 'PATCH',
        body: JSON.stringify({ ids, metadata }),
      }),
    exportExcel: async (ids?: string[]) => {
      const res = await fetch(`${API_BASE}/documents/export-excel`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Authorization: getToken() ? `Bearer ${getToken()}` : '',
        },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? res.statusText);
      }
      return res;
    },
    importExcel: (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      return fetch(`${API_BASE}/documents/import-excel`, {
        method: 'POST',
        credentials: 'include',
        headers: { Authorization: getToken() ? `Bearer ${getToken()}` : '' },
        body: fd,
      }).then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error ?? res.statusText);
        }
        return res.json();
      });
    },
    getLabel: (id: string) =>
      request<{ productName: string; companyCode: string; department?: string; site?: string; filename: string }>(
        `/documents/${id}/label`
      ),
  },
  users: {
    list: () =>
      request<{
        contacts: {
          contactId: string;
          firstName: string;
          lastName: string;
          email: string;
          roles: string[];
          d365Roles: Record<string, boolean>;
          account?: { name?: string; accountnumber?: string };
        }[];
      }>('/users'),
    updateRoles: (contactId: string, d365Roles: Record<string, boolean>) =>
      request<{ message: string }>(`/users/${contactId}/roles`, {
        method: 'PATCH',
        body: JSON.stringify({ d365Roles }),
      }),
  },
};

export interface Document {
  id: string;
  companyCode: string;
  filename: string;
  productName?: string;
  department?: string;
  site?: string;
  tags?: string[];
  createdAt: string;
}
