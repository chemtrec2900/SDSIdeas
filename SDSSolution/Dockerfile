# =============================================================================
# Stage 1: Build Web (React + Vite)
# =============================================================================
FROM node:20-alpine AS web-builder

WORKDIR /app/web

COPY web/package.json web/package-lock.json* web/pnpm-lock.yaml* ./
RUN npm ci --legacy-peer-deps 2>/dev/null || npm install --legacy-peer-deps

COPY web/ ./
RUN npm run build

# =============================================================================
# Stage 2: Build API (Express + TypeScript)
# =============================================================================
FROM node:20-alpine AS api-builder

WORKDIR /app/api

COPY api/package.json api/package-lock.json* api/pnpm-lock.yaml* ./
RUN npm ci --legacy-peer-deps 2>/dev/null || npm install --legacy-peer-deps

COPY api/ ./
RUN npx prisma generate && npm run build

# =============================================================================
# Stage 3: Production image
# =============================================================================
FROM node:20-alpine AS production

WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Copy API
COPY --from=api-builder /app/api/dist ./dist
COPY --from=api-builder /app/api/node_modules ./node_modules
COPY --from=api-builder /app/api/package.json ./
COPY --from=api-builder /app/api/prisma ./prisma
COPY --from=api-builder /app/api/scripts/start.sh ./scripts/start.sh

# Copy Web static build
COPY --from=web-builder /app/web/dist ./web-dist

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app && \
    chmod +x ./scripts/start.sh

USER nodejs

EXPOSE 8080

ENV NODE_ENV=production
ENV PORT=8080

# Run with dumb-init to handle signals
ENTRYPOINT ["dumb-init", "--"]
CMD ["sh", "./scripts/start.sh"]
