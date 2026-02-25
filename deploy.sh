#!/bin/bash
# Slack Chat App - Mac Development Environment One-Click Startup

set -e

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}"
echo "=========================================="
echo "Slack Chat App - Mac Development Startup"
echo "=========================================="
echo -e "${NC}"

# Check if Docker Desktop is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}Docker not running, please start Docker Desktop first${NC}"
    exit 1
fi

echo -e "${GREEN}Docker running normally${NC}"

# Check .env file
if [ ! -f .env ]; then
    echo -e "${YELLOW}Copying .env template...${NC}"
    if [ -f .env.production ]; then
        cp .env.production .env
        echo -e "${GREEN}.env file created${NC}"
        echo ""
        echo -e "${YELLOW}Please edit .env file to configure required environment variables:${NC}"
        echo -e "${YELLOW}   nano .env${NC}"
        echo ""
        read -p "Press Enter to continue after configuration..."
    else
        echo -e "${RED}.env.production file does not exist${NC}"
        exit 1
    fi
fi

# Stop existing containers
echo -e "${YELLOW}Cleaning up existing containers...${NC}"
docker-compose -f docker-compose.dev.yml down || true

# Build development environment image
echo -e "${YELLOW}Building development environment image...${NC}"
docker-compose -f docker-compose.dev.yml build

# Start services
echo -e "${YELLOW}Starting development services...${NC}"
docker-compose -f docker-compose.dev.yml up -d

# Wait for database to be ready
echo -e "${YELLOW}Waiting for database to start...${NC}"
sleep 5

# Run database migrations
echo -e "${YELLOW}Running database migrations...${NC}"
docker-compose -f docker-compose.dev.yml exec -T app npx prisma migrate deploy || true

# Generate Prisma client
echo -e "${YELLOW}Generating Prisma client...${NC}"
docker-compose -f docker-compose.dev.yml exec -T app npx prisma generate || true

echo ""
echo -e "${GREEN}Development environment started successfully!${NC}"
echo ""
echo -e "${BLUE}Access addresses:${NC}"
echo "   Application: http://localhost:3000"
echo "   Database: localhost:5432"
echo ""
echo -e "${BLUE}Management commands:${NC}"
echo "   View logs: docker-compose -f docker-compose.dev.yml logs -f app"
echo "   Stop services: docker-compose -f docker-compose.dev.yml down"
echo "   Restart services: docker-compose -f docker-compose.dev.yml restart"
echo "   Enter container: docker-compose -f docker-compose.dev.yml exec app sh"
echo ""
echo -e "${BLUE}Container status:${NC}"
docker-compose -f docker-compose.dev.yml ps

echo ""
echo -e "${GREEN}Tip: Code changes will auto-reload${NC}"
echo ""
echo -e "${BLUE}Deploy to production:${NC}"
echo "   1. Build image on Mac: ./build.sh"
echo "   2. Deploy on Linux server: ./scripts/deploy-to-server.sh <IMAGE_NAME> <TAG>"
