# Azure Deployment Guide

This guide covers deploying the SDS Safety Document Management system to Azure as a single container.

## Architecture

- **Single container** – API + React web app bundled together
- **Port** – 8080 (configurable via `PORT`)
- **Database** – SQLite (dev/embedded) or Azure SQL (production recommended)

## Prerequisites

- Azure CLI (`az`)
- Docker
- Azure Container Registry (ACR) or Docker Hub
- (Optional) Azure SQL for production database

---

## Option 1: Azure Container Apps

### 1. Create resources

```bash
# Login
az login

# Set variables
RESOURCE_GROUP="rg-sds-solution"
LOCATION="eastus"
ACR_NAME="sdsacr"  # must be globally unique
ENVIRONMENT="sds-env"
APP_NAME="sds-app"

# Create resource group
az group create --name $RESOURCE_GROUP --location $LOCATION

# Create Azure Container Registry
az acr create --resource-group $RESOURCE_GROUP --name $ACR_NAME --sku Basic --admin-enabled true

# Create Container Apps environment
az containerapp env create \
  --name $ENVIRONMENT \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION
```

### 2. Build and push image

```bash
# Login to ACR
az acr login --name $ACR_NAME
ACR_LOGIN_SERVER=$(az acr show --name $ACR_NAME --query loginServer -o tsv)

# Build and push from project root
docker build -t $ACR_LOGIN_SERVER/sds-solution:latest .
docker push $ACR_LOGIN_SERVER/sds-solution:latest
```

### 3. Deploy Container App

```bash
# Get ACR credentials
ACR_USERNAME=$(az acr credential show --name $ACR_NAME --query username -o tsv)
ACR_PASSWORD=$(az acr credential show --name $ACR_NAME --query "passwords[0].value" -o tsv)

az containerapp create \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --environment $ENVIRONMENT \
  --image $ACR_LOGIN_SERVER/sds-solution:latest \
  --target-port 8080 \
  --ingress external \
  --registry-server $ACR_LOGIN_SERVER \
  --registry-username $ACR_USERNAME \
  --registry-password $ACR_PASSWORD \
  --cpu 0.5 \
  --memory 1.0Gi \
  --min-replicas 1 \
  --max-replicas 3 \
  --env-vars \
    NODE_ENV=production \
    PORT=8080 \
    WEB_URL="https://<your-app-url>.azurecontainerapps.io" \
    DATABASE_URL="file:./data/app.db" \
    JWT_SECRET="<generate-strong-secret>" \
    D365_URL="https://yourorg.crm.dynamics.com" \
    D365_CLIENT_ID="<your-client-id>" \
    D365_CLIENT_SECRET="<your-client-secret>" \
    D365_TENANT_ID="<your-tenant-id>" \
    AZURE_STORAGE_CONNECTION_STRING="<your-storage-connection>" \
    AZURE_SEARCH_ENDPOINT="<your-search-endpoint>" \
    AZURE_SEARCH_API_KEY="<your-search-key>"
```

### 4. Add persistent storage (optional – for SQLite)

For SQLite persistence, mount an Azure Files share:

```bash
# Create storage account and file share
STORAGE_ACCOUNT="sdssa$(date +%s)"
az storage account create -n $STORAGE_ACCOUNT -g $RESOURCE_GROUP -l $LOCATION --sku Standard_LRS
az storage share create -n sdsdata --account-name $STORAGE_ACCOUNT
STORAGE_KEY=$(az storage account keys list -n $STORAGE_ACCOUNT -g $RESOURCE_GROUP --query "[0].value" -o tsv)

# Add volume to container app (see Azure docs for volume mounts)
```

---

## Option 2: Azure App Service (Web App for Containers)

### 1. Create App Service Plan and Web App

```bash
RESOURCE_GROUP="rg-sds-solution"
LOCATION="eastus"
ACR_NAME="sdsacr"
APP_NAME="sds-app"
PLAN_NAME="sds-plan"

az appservice plan create --name $PLAN_NAME --resource-group $RESOURCE_GROUP \
  --is-linux --sku B1

az webapp create --name $APP_NAME --resource-group $RESOURCE_GROUP \
  --plan $PLAN_NAME --deployment-container-image-name $ACR_NAME.azurecr.io/sds-solution:latest
```

### 2. Configure App Settings

In Azure Portal: **Web App → Configuration → Application settings**, add:

| Name | Value | Slot Setting |
|------|-------|--------------|
| `WEBSITES_PORT` | `8080` | ✓ |
| `NODE_ENV` | `production` | ✓ |
| `PORT` | `8080` | ✓ |
| `WEB_URL` | `https://<your-app>.azurewebsites.net` | ✓ |
| `DATABASE_URL` | `file:./data/app.db` (or Azure SQL connection string) | ✓ |
| `JWT_SECRET` | `<strong-secret>` | ✓ |
| `D365_URL` | `https://yourorg.crm.dynamics.com` | ✓ |
| `D365_CLIENT_ID` | `<client-id>` | ✓ |
| `D365_CLIENT_SECRET` | `<client-secret>` | ✓ |
| `D365_TENANT_ID` | `<tenant-id>` | ✓ |
| `AZURE_STORAGE_CONNECTION_STRING` | `<connection-string>` | ✓ |
| `AZURE_SEARCH_ENDPOINT` | `<endpoint>` | ✓ |
| `AZURE_SEARCH_API_KEY` | `<api-key>` | ✓ |
| `DEV_SKIP_AUTH` | `false` | ✓ |

### 3. Enable container logging

```bash
az webapp log config --name $APP_NAME --resource-group $RESOURCE_GROUP \
  --docker-container-logging filesystem
```

---

## Option 3: GitHub Actions CI/CD

Create `.github/workflows/azure-container-apps.yml`:

```yaml
name: Deploy to Azure Container Apps

on:
  push:
    branches: [main]

env:
  ACR_NAME: sdsacr
  RESOURCE_GROUP: rg-sds-solution
  CONTAINER_APP_NAME: sds-app
  IMAGE_NAME: sds-solution

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: azure/login@v2
        with:
          creds: ${{ secrets.AZURE_CREDENTIALS }}

      - uses: azure/docker-login@v2
        with:
          login-server: ${{ env.ACR_NAME }}.azurecr.io
          username: ${{ secrets.ACR_USERNAME }}
          password: ${{ secrets.ACR_PASSWORD }}

      - run: |
          docker build -t ${{ env.ACR_NAME }}.azurecr.io/${{ env.IMAGE_NAME }}:${{ github.sha }} .
          docker push ${{ env.ACR_NAME }}.azurecr.io/${{ env.IMAGE_NAME }}:${{ github.sha }}

      - uses: azure/container-apps-deploy-action@v1
        with:
          resourceGroup: ${{ env.RESOURCE_GROUP }}
          containerAppName: ${{ env.CONTAINER_APP_NAME }}
          imageToDeploy: ${{ env.ACR_NAME }}.azurecr.io/${{ env.IMAGE_NAME }}:${{ github.sha }}
```

---

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | Server port (default: 8080) |
| `NODE_ENV` | No | `production` for Docker |
| `WEB_URL` | Yes (prod) | Full URL of the app (for CORS, reset links) |
| `DATABASE_URL` | Yes | SQLite: `file:./data/app.db` or Azure SQL connection string |
| `JWT_SECRET` | Yes (prod) | Strong secret for JWT signing |
| `DEV_SKIP_AUTH` | No | Set `false` in production |
| `D365_*` | Yes (auth) | Dynamics 365 / Dataverse config |
| `AZURE_STORAGE_*` | Yes | Blob storage for documents |
| `AZURE_SEARCH_*` | Yes | AI Search for metadata/full-text |

---

## Local Docker Test

```bash
# Build
docker build -t sds-solution:local .

# Run
docker run -p 8080:8080 \
  -e DATABASE_URL="file:./data/app.db" \
  -e WEB_URL="http://localhost:8080" \
  -e DEV_SKIP_AUTH=true \
  -v sds-data:/app/data \
  sds-solution:local

# Open http://localhost:8080
```

Or with docker-compose:

```bash
docker-compose up --build
# Open http://localhost:8080
```
