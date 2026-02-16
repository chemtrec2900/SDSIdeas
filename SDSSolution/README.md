# Safety Document Management System

A full-stack Safety Data Sheet (SDS) / Safety Document Management system built with **Express + React**, storing documents in Azure Blob Storage, with metadata and full-text search.

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Backend** | Node.js, Express, TypeScript |
| **Frontend** | React, TypeScript, Vite, React Router |
| **Database** | SQLite (dev) / Azure SQL (prod) via Prisma |
| **Storage** | Azure Blob Storage |
| **Search** | Azure AI Search (metadata + full-text) |
| **Auth** | Dynamics 365 contacts + JWT, Registration, Password recovery |

## Features

- **Documents**: Upload, search (metadata + full text), download, share anonymously
- **Metadata**: CompanyCode, ProductName, Department, Site, Tags
- **Bulk operations**: Bulk upload, bulk metadata update via Excel
- **Tags & filtering**: Filter by department, site, company
- **Labels**: Print Safety Data Sheet labels from metadata
- **Roles**: Admin, DocumentEditor, Viewer
- **Auth**: User Registration, Login (D365 contact), Forgot Password, Reset Password

## Project Structure

```
SDSSolution/
├── api/                 # Express backend
│   ├── prisma/
│   ├── src/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── middleware/
│   │   └── config/
│   └── package.json
├── web/                 # React frontend
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   └── contexts/
│   └── package.json
├── package.json         # Root scripts
└── pnpm-workspace.yaml
```

## Docker

The app runs as a **single container** (API + React web) on port **8080**.

### Prerequisites

- Docker 20.10+
- Docker Compose v2 (optional)

### Build

From the project root:

```bash
docker build -t sds-solution:latest .
```

### Run with `docker run`

**Minimal (dev auth bypass):**

```bash
docker run -p 8080:8080 \
  -e DATABASE_URL="file:./data/app.db" \
  -e WEB_URL="http://localhost:8080" \
  -e DEV_SKIP_AUTH=true \
  -v sds-data:/app/data \
  sds-solution:latest
```

**With Azure services (use `.env` or pass env vars):**

```bash
docker run -p 8080:8080 \
  -e DATABASE_URL="file:./data/app.db" \
  -e WEB_URL="http://localhost:8080" \
  -e AZURE_STORAGE_CONNECTION_STRING="..." \
  -e AZURE_SEARCH_ENDPOINT="..." \
  -e AZURE_SEARCH_API_KEY="..." \
  -e D365_URL="https://yourorg.crm.dynamics.com" \
  -e D365_CLIENT_ID="..." \
  -e D365_CLIENT_SECRET="..." \
  -e D365_TENANT_ID="..." \
  -e JWT_SECRET="your-strong-secret" \
  -v sds-data:/app/data \
  sds-solution:latest
```

**Using an env file:**

```bash
docker run -p 8080:8080 --env-file api/.env -v sds-data:/app/data sds-solution:latest
```

### Run with Docker Compose

```bash
# Build and start
docker-compose up --build

# Run in background
docker-compose up -d --build

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

Open **http://localhost:8080**.

### Docker options

| Option | Description |
|--------|-------------|
| `-p 8080:8080` | Map container port 8080 to host |
| `-v sds-data:/app/data` | Persist SQLite database |
| `-e VAR=value` | Set environment variable |
| `--env-file api/.env` | Load variables from file |

### Environment variables (Docker)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | 8080 | Server port |
| `NODE_ENV` | No | production | Set by Dockerfile |
| `DATABASE_URL` | Yes | — | `file:./data/app.db` for SQLite |
| `WEB_URL` | Yes (prod) | — | App URL (e.g. http://localhost:8080) |
| `DEV_SKIP_AUTH` | No | false | Set `true` to bypass auth |
| `JWT_SECRET` | Yes (prod) | — | JWT signing secret |
| `D365_*` | Yes (auth) | — | Dynamics 365 config |
| `AZURE_STORAGE_*` | Yes | — | Blob storage config |
| `AZURE_SEARCH_*` | Yes | — | AI Search config |

### Health check

```bash
curl http://localhost:8080/api/health
```

### Troubleshooting

| Issue | Solution |
|-------|----------|
| Port 8080 in use | Use `-p 8081:8080` and open http://localhost:8081 |
| Database resets on restart | Add `-v sds-data:/app/data` to persist SQLite |
| Login fails | Set D365 env vars and `DEV_SKIP_AUTH=false` |
| Build fails | Ensure `api/` and `web/` exist and have `package.json` |

### Azure deployment

For Azure Container Apps, App Service, or CI/CD, see **[azure/README.md](azure/README.md)**.

---

## Quick Start (Development)

### Prerequisites

- Node.js 20+
- npm or pnpm

### 1. Install dependencies

```bash
cd api
npm install

cd ../web
npm install
```

### 2. Configure API

```bash
cd api
cp .env.example .env
```

Edit `api/.env`:

- `DATABASE_URL` – SQLite for dev: `file:./dev.db`
- `DEV_SKIP_AUTH=true` – Skip auth for local development (optional)

### 3. Initialize database

```bash
cd api
npx prisma generate
npx prisma db push
```

### 4. Run development servers

**Terminal 1 – API:**

```bash
cd api
npm run dev
```

**Terminal 2 – Web:**

```bash
cd web
npm run dev
```

- API: http://localhost:3001  
- Web: http://localhost:5173  

With `DEV_SKIP_AUTH=true`, use any email/password to sign in (dev user is used).

## Environment Variables

### API (`api/.env`)

| Variable | Description |
|----------|-------------|
| `PORT` | API port (default: 3001) |
| `WEB_URL` | Frontend URL for CORS (default: http://localhost:5173) |
| `DATABASE_URL` | Prisma connection string |
| `AZURE_STORAGE_CONNECTION_STRING` | Azure Blob Storage |
| `AZURE_STORAGE_CONTAINER` | Blob container name (default: safety-documents) |
| `AZURE_SEARCH_ENDPOINT` | Azure AI Search endpoint |
| `AZURE_SEARCH_API_KEY` | Azure AI Search key |
| `AZURE_SEARCH_INDEX` | Search index name |
| `DEV_SKIP_AUTH` | Set `true` to bypass auth (dev only) |
| `JWT_SECRET` | Secret for JWT signing (required in prod) |
| `D365_URL` | Dynamics 365 org URL (e.g. https://yourorg.crm.dynamics.com) |
| `D365_CLIENT_ID` | App registration client ID |
| `D365_CLIENT_SECRET` | App registration client secret |
| `D365_TENANT_ID` | Azure AD tenant ID |
| `D365_EMAIL_FIELD` | Contact field for login (default: emailaddress1) |
| `D365_PASSWORD_FIELD` | Custom contact field for password hash |

### Create Azure AI Search index (run once)

After configuring `AZURE_SEARCH_ENDPOINT` and `AZURE_SEARCH_API_KEY`:

```bash
cd api
npm run create-search-index
```

This creates the `safety-documents` index with fields: `id`, `companyCode`, `filename`, `productName`, `department`, `site`, `tags`, `content`. If the index already exists, the script skips creation.

### Dynamics 365 (Auth)

User information lives in Microsoft Dynamics 365 as **Contact** entities; contacts belong to **Account**. The Contact entity has login (email) and password fields.

1. **App registration**: Create an app in Azure AD with Client Credentials flow, grant API permissions for Dynamics 365 (Dataverse).
2. **Custom password field**: Add a custom field on the Contact entity for storing bcrypt password hashes (e.g. `crXXX_sdspassword`). Set `D365_PASSWORD_FIELD` in `.env`.
3. **Registration**: Users with an existing Contact in D365 can register by entering their work email and setting a password.
4. **Password recovery**: Uses `PasswordResetToken` in local DB; reset link is logged to console in dev (integrate SendGrid/SMTP for email in prod).

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| POST | `/api/auth/register` | Register (set password for D365 contact) |
| POST | `/api/auth/login` | Email/password login |
| POST | `/api/auth/forgot-password` | Request password reset |
| POST | `/api/auth/reset-password` | Reset password with token |
| GET | `/api/auth/me` | Current user |
| GET | `/api/documents` | Search documents |
| GET | `/api/documents/:id` | Get document metadata |
| GET | `/api/documents/:id/download` | Download URL |
| POST | `/api/documents/:id/share` | Create anonymous share link |
| POST | `/api/documents` | Upload document |
| POST | `/api/documents/bulk` | Bulk upload |
| PATCH | `/api/documents/:id` | Update metadata |
| PATCH | `/api/documents/bulk` | Bulk update metadata |
| POST | `/api/documents/export-excel` | Export metadata to Excel |
| POST | `/api/documents/import-excel` | Import metadata from Excel |
| GET | `/api/documents/:id/label` | Get label data for printing |

## Next Steps

1. **Auth**: Integrate Passport.js with `passport-azure-ad` and `passport-local` for Entra ID SSO and email/password.
2. **Azure Storage**: Create Blob Storage account and container, set connection string.
3. **Azure AI Search**: Create search service and index with fields: `id`, `companyCode`, `filename`, `productName`, `department`, `site`, `tags`, `content`.
4. **Document Intelligence**: Add text extraction for full-text search via Azure AI Document Intelligence.
5. **Row-level security**: Filter documents by user roles and company/department/site.

## License

Private – SDS Ideas
