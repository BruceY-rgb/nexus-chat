#!/bin/bash

# =====================================================
# Destroy Instance (Including volume)
# Usage: ./destroy-instance.sh <instance-name>
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
    exit 1
fi

# Change to instance directory
cd "$INSTANCE_DIR"

# Stop and delete volume
echo -e "${BLUE}Deleting instance: $INSTANCE_NAME (including database)${NC}"
docker-compose -p "$INSTANCE_NAME" down -v

# Delete instance directory
echo -e "${BLUE}Deleting instance directory: $INSTANCE_DIR${NC}"
cd "$INSTANCES_DIR"
rm -rf "$INSTANCE_DIR"

echo -e "${GREEN}Instance '$INSTANCE_NAME' completely deleted${NC}"
