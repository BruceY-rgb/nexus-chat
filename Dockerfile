# ======================
# Build stage
# ======================
FROM node:20-bookworm-slim AS base

# 安装系统依赖（包括 OpenSSL 支持）
RUN apt-get update && apt-get install -y \
    openssl \
    ca-certificates \
    libc6 \
    && rm -rf /var/lib/apt/lists/*

# 设置 OpenSSL 环境变量
ENV OPENSSL_CONF=/etc/ssl

WORKDIR /app

COPY package.json package-lock.json* ./
COPY prisma ./prisma

# 安装全部依赖，但不跑 postinstall
RUN npm ci --ignore-scripts

# 生成 Prisma Client
RUN npx prisma generate

# 复制源码并构建
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
COPY --from=base /app/.next/standalone ./
COPY --from=base /app/.next/static ./.next/static
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/prisma ./prisma

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV NODE_ENV=production

CMD ["node", "server.js"]
