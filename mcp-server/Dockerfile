# MCP Server Dockerfile

FROM node:20-alpine

# 安装 openssl（Prisma 依赖）
RUN apk add --no-cache openssl

WORKDIR /app

# 先复制 package.json 和 prisma schema
COPY package*.json ./
COPY prisma ./prisma/

# 安装依赖并生成 Prisma Client
RUN npm ci && npx prisma generate

# 复制源代码并构建
COPY src ./src
COPY tsconfig.json ./
RUN npm run build

# 暴露端口
EXPOSE 3002

# 启动服务
CMD ["node", "dist/index.js"]
