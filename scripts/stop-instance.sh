#!/bin/bash

# =====================================================
# Stop Instance (Preserve Volume)
# Usage: ./stop-instance.sh <instance-name>
# =====================================================

set -e

# Color definitions
RED='\033[0;31m'
GREEN='\033[0;32m'
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

echo -e "${BLUE}Stopping instance: $INSTANCE_NAME${NC}"
docker-compose -p "$INSTANCE_NAME" down

echo -e "${GREEN}Instance '$INSTANCE_NAME' stopped (data preserved)${NC}"
