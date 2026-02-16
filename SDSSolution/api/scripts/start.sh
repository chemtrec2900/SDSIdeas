#!/bin/sh
set -e

# Ensure data directory exists (for SQLite)
mkdir -p /app/data

# Run Prisma migrations / push (creates DB if needed)
npx prisma db push --accept-data-loss 2>/dev/null || true

# Start the app
exec node dist/index.js
