# ======================
# Build stage
# ======================
FROM node:20-bookworm-slim AS base

# Install system dependencies (including OpenSSL support)
RUN apt-get update && apt-get install -y \
    openssl \
    ca-certificates \
    libc6 \
    && rm -rf /var/lib/apt/lists/*

# Set OpenSSL environment variables
ENV OPENSSL_CONF=/etc/ssl

WORKDIR /app

COPY package.json package-lock.json* ./
COPY prisma ./prisma

# Install all dependencies, including tsx (used for starting the production environment)
RUN npm ci --ignore-scripts

# Install tsx globally (or install it as a dependency)
RUN npm install tsx --save-dev

# 生成 Prisma Client
RUN npx prisma generate

# Copy the source code and build it.
COPY . .
RUN npm run build

# ======================
# Production stage
# ======================
FROM node:20-bookworm-slim AS production

WORKDIR /app

RUN groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 nextjs

COPY --from=base /app/public ./public
COPY --from=base /app/.next ./.next
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/prisma ./prisma
COPY --from=base /app/server.ts ./server.ts
COPY --from=base /app/package.json ./package.json
COPY --from=base /app/tsconfig.json ./tsconfig.json

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV NODE_ENV=production

# Run server.ts using tsx
CMD ["npx", "tsx", "server.ts"]
