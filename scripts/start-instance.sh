#!/bin/bash

# =====================================================
# Start Instance (Delete old volume, recreate database)
# Usage: ./start-instance.sh <instance-name>
# =====================================================

set -e

# Color definitions
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check arguments
if [ -z "$1" ]; then
    echo -e "${RED}Error: Please specify instance name${NC}"
    echo "Usage: $0 <instance-name>"
    echo "Example: $0 my-instance"
    exit 1
fi

INSTANCE_NAME=$1
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTANCES_DIR="$(dirname "$SCRIPT_DIR")/instances"
INSTANCE_DIR="$INSTANCES_DIR/$INSTANCE_NAME"

# Check if instance directory exists
if [ ! -d "$INSTANCE_DIR" ]; then
    echo -e "${RED}Error: Instance '$INSTANCE_NAME' does not exist${NC}"
    echo "Create instance first: ./create-instance.sh $INSTANCE_NAME"
    exit 1
fi

# Check if .env file exists
if [ ! -f "$INSTANCE_DIR/.env" ]; then
    echo -e "${RED}Error: Configuration file not found: $INSTANCE_DIR/.env${NC}"
    exit 1
fi

# Load environment variables
echo -e "${BLUE}Loading configuration...${NC}"
set -a
source "$INSTANCE_DIR/.env"
set +a

# Set default values
INSTANCE_NAME=${INSTANCE_NAME:-$1}
APP_PORT=${APP_PORT:-3000}
WEBSOCKET_PORT=${WEBSOCKET_PORT:-3001}
DB_PORT=${DB_PORT:-5432}
MCP_PORT=${MCP_PORT:-3002}
DB_NAME=${DB_NAME:-slack_chat}

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Starting instance: $INSTANCE_NAME${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Configuration:"
echo "  - App port: $APP_PORT"
echo "  - WebSocket port: $WEBSOCKET_PORT"
echo "  - Database port: $DB_PORT"
echo "  - MCP port: $MCP_PORT"
echo "  - Database name: $DB_NAME"
echo ""

# Change to instance directory
cd "$INSTANCE_DIR"

# Check port availability
echo -e "${BLUE}Checking port availability...${NC}"
for port in $APP_PORT $WEBSOCKET_PORT $DB_PORT $MCP_PORT; do
    if lsof -i:$port >/dev/null 2>&1; then
        echo -e "${YELLOW}Warning: Port $port is already in use${NC}"
    fi
done

# Delete old containers and volume (if exists)
echo -e "${BLUE}Cleaning up old instance (deleting volume)...${NC}"
docker-compose -p "$INSTANCE_NAME" down -v 2>/dev/null || true

# Start services
echo -e "${BLUE}Starting Docker services...${NC}"
docker-compose -p "$INSTANCE_NAME" up -d --build

# Wait for database to be ready
echo -e "${BLUE}Waiting for database to be ready...${NC}"
max_attempts=30
attempt=0
while [ $attempt -lt $max_attempts ]; do
    if docker-compose -p "$INSTANCE_NAME" exec -T db pg_isready -U ${DB_USER:-yangsmac} >/dev/null 2>&1; then
        echo -e "${GREEN}Database is ready!${NC}"
        break
    fi
    attempt=$((attempt + 1))
    echo "Waiting... ($attempt/$max_attempts)"
    sleep 2
done

if [ $attempt -eq $max_attempts ]; then
    echo -e "${RED}Error: Database startup timeout${NC}"
    exit 1
fi

# Wait for app to be ready
echo -e "${BLUE}Waiting for app to be ready...${NC}"
sleep 5

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Instance '$INSTANCE_NAME' started successfully!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Access URLs:"
echo "  - App: http://localhost:$APP_PORT"
echo "  - WebSocket: ws://localhost:$WEBSOCKET_PORT"
echo "  - MCP: http://localhost:$MCP_PORT"
echo ""
echo -e "${YELLOW}Database has been reset to initial state (fresh)${NC}"
echo ""
