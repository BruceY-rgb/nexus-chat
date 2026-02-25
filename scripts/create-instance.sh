#!/bin/bash

# =====================================================
# Create New Instance
# Usage: ./create-instance.sh <instance-name>
# =====================================================

set -e

# Color definitions
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
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
TEMPLATE_DIR="$INSTANCES_DIR/template"
INSTANCE_DIR="$INSTANCES_DIR/$INSTANCE_NAME"

# Check if template directory exists
if [ ! -d "$TEMPLATE_DIR" ]; then
    echo -e "${RED}Error: Template directory does not exist: $TEMPLATE_DIR${NC}"
    exit 1
fi

# Check if instance already exists
if [ -d "$INSTANCE_DIR" ]; then
    echo -e "${RED}Error: Instance '$INSTANCE_NAME' already exists${NC}"
    exit 1
fi

# Create instance directory
echo -e "${GREEN}Creating instance directory: $INSTANCE_DIR${NC}"
mkdir -p "$INSTANCE_DIR"

# Copy docker-compose.yml (use symlink to point to template)
echo -e "${GREEN}Creating docker-compose.yml${NC}"
ln -sf ../template/docker-compose.yml "$INSTANCE_DIR/docker-compose.yml"

# Copy .env.example to .env
echo -e "${GREEN}Creating .env configuration file${NC}"
cp "$TEMPLATE_DIR/.env.example" "$INSTANCE_DIR/.env"

# Set environment variables so symlink resolves correctly
cd "$INSTANCE_DIR"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Instance '$INSTANCE_NAME' created successfully!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Configuration steps:"
echo "1. Go to instance directory: cd instances/$INSTANCE_NAME"
echo "2. Modify .env configuration file (especially ports)"
echo "3. Start instance: ../scripts/start-instance.sh $INSTANCE_NAME"
echo ""
echo -e "${YELLOW}Note: Please modify the following in .env to avoid port conflicts:${NC}"
echo "  - APP_PORT (default 3000)"
echo "  - WEBSOCKET_PORT (default 3001)"
echo "  - DB_PORT (default 5432)"
echo "  - MCP_PORT (default 3002)"
echo "  - DB_NAME (database name)"
echo "  - INSTANCE_NAME (instance name)"
echo ""
