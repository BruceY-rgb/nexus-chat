# 使用官方Node.js运行时作为基础镜像
FROM node:18-alpine AS base

# 安装系统依赖
RUN apk add --no-cache libc6-compat
WORKDIR /app

# 复制package文件
COPY package.json package-lock.json* ./

# 安装依赖
RUN npm ci --only=production && npm cache clean --force

# 生成Prisma客户端
RUN npx prisma generate

# 复制应用代码
COPY . .

# 构建Next.js应用
RUN npm run build

# 生产阶段
FROM node:18-alpine AS production

WORKDIR /app

# 创建非root用户
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# 复制构建产物
COPY --from=base /app/public ./public
COPY --from=base /app/.next/standalone ./
COPY --from=base /app/.next/static ./.next/static
COPY --from=base /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=base /app/prisma ./prisma

# 设置权限
USER nextjs

# 暴露端口
EXPOSE 3000

# 环境变量
ENV PORT 3000
ENV NODE_ENV production

# 启动应用
CMD ["node", "server.js"]
