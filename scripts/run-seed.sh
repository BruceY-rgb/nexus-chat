#!/bin/bash
# Execute database seed script

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=========================================="
echo "Database Seed Script"
echo "==========================================${NC}"

echo -e "${YELLOW}Starting seed script execution...${NC}"

# Execute in Docker container
docker-compose exec -T app npx tsx scripts/seed.ts

echo -e "${GREEN}Seed script execution complete${NC}"
