# MCP Server Dockerfile

FROM node:20-alpine

WORKDIR /app

# 安装依赖
COPY package*.json ./
RUN npm ci --only=production

# 复制构建后的代码
COPY dist ./dist

# 暴露端口
EXPOSE 3002

# 启动服务
CMD ["node", "dist/index.js"]
