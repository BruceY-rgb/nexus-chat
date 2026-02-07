#!/bin/bash
# 执行数据库种子脚本

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=========================================="
echo "🌱 数据库种子脚本"
echo "==========================================${NC}"

echo -e "${YELLOW}🚀 开始执行种子脚本...${NC}"

# 在Docker容器中执行
docker-compose exec -T app npx tsx scripts/seed.ts

echo -e "${GREEN}✅ 种子脚本执行完成${NC}"
