#!/bin/bash

# =====================================================
# Database Reset Script
# Reset database by re-running db-init service via docker-compose
# Usage: bash scripts/reset-db.sh <instance-name>
# Example: bash scripts/reset-db.sh instance-1
# =====================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

INSTANCE_NAME="$1"
if [ -z "$INSTANCE_NAME" ]; then
    echo "Please specify instance name"
    echo "Usage: bash scripts/reset-db.sh <instance-name>"
    echo "Example: bash scripts/reset-db.sh instance-1"
    exit 1
fi

INSTANCE_DIR="$PROJECT_DIR/instances/$INSTANCE_NAME"
ENV_FILE="$INSTANCE_DIR/.env"
COMPOSE_FILE="$INSTANCE_DIR/docker-compose.yml"

if [ ! -f "$ENV_FILE" ]; then
    echo "Instance configuration file not found: $ENV_FILE"
    exit 1
fi
if [ ! -f "$COMPOSE_FILE" ]; then
    echo "Instance docker-compose file not found: $COMPOSE_FILE"
    exit 1
fi

echo "Starting database reset [$INSTANCE_NAME]..."

# Stop and remove old db-init container, ignore if not exists
echo "Stopping old db-init container..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" rm -fsv db-init 2>/dev/null || true

# Re-run db-init service
echo "Running db-init..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" run --rm db-init

echo ""
echo "Instance [$INSTANCE_NAME] database reset complete!"
