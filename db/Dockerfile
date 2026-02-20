FROM postgres:15-alpine

# 安装 Node.js 和 npm（Alpine 使用 apk）
RUN apk add --no-cache nodejs npm

# 全局安装 Prisma CLI
RUN npm install -g prisma

# 注意：init.sql 不在这里复制，因为它需要 Prisma 表创建后再执行
# init.sql 将在 db-init 服务中迁移完成后执行
