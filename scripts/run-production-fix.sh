#!/bin/bash

# =====================================================
# Production Database Fix Script
# One-click execution of database table structure supplement
# =====================================================

set -e  # Exit on error

echo "Starting production database fix..."
echo "================================================"

# Color definitions
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check arguments
if [ $# -lt 3 ]; then
    echo -e "${YELLOW}Usage: $0 <host> <username> <database> [port]${NC}"
    echo "Example: $0 localhost yangsmac slack_chat 5432"
    exit 1
fi

HOST=$1
USERNAME=$2
DATABASE=$3
PORT=${4:-5432}

echo -e "${GREEN}Connection Info:${NC}"
echo "   Host: $HOST"
echo "   Port: $PORT"
echo "   User: $USERNAME"
echo "   Database: $DATABASE"
echo ""

# Confirm operation
read -p "Continue? This will modify the production database (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Operation cancelled"
    exit 1
fi

# Check database connection
echo -e "${YELLOW}Checking database connection...${NC}"
if ! PGPASSWORD=$PGPASSWORD psql -h "$HOST" -p "$PORT" -U "$USERNAME" -d "$DATABASE" -c "SELECT 1;" > /dev/null 2>&1; then
    echo -e "${RED}Cannot connect to database, please check connection parameters${NC}"
    echo "Please set PGPASSWORD environment variable or enter password manually"
    exit 1
fi
echo -e "${GREEN}Database connection successful${NC}"
echo ""

# Check existing table structure
echo -e "${YELLOW}Checking existing table structure...${NC}"
EXISTING_TABLES=$(PGPASSWORD=$PGPASSWORD psql -h "$HOST" -p "$PORT" -U "$USERNAME" -d "$DATABASE" -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';")

echo "Existing table count: $EXISTING_TABLES"
echo ""

# Backup existing data (optional)
echo -e "${YELLOW}Backup Options:${NC}"
read -p "Create database backup before executing? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    BACKUP_FILE="backup-${DATABASE}-$(date +%Y%m%d-%H%M%S).sql"
    echo -e "${YELLOW}Creating backup: $BACKUP_FILE${NC}"
    if PGPASSWORD=$PGPASSWORD pg_dump -h "$HOST" -p "$PORT" -U "$USERNAME" -d "$DATABASE" > "$BACKUP_FILE"; then
        echo -e "${GREEN}Backup successful: $BACKUP_FILE${NC}"
    else
        echo -e "${RED}Backup failed${NC}"
        read -p "Continue execution? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
fi
echo ""

# Execute fix script
echo -e "${GREEN}Starting database fix execution...${NC}"
echo "================================================"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FIX_SCRIPT="$SCRIPT_DIR/fix-missing-tables.sql"

if [ ! -f "$FIX_SCRIPT" ]; then
    echo -e "${RED}Fix script not found: $FIX_SCRIPT${NC}"
    exit 1
fi

# Execute SQL script
if PGPASSWORD=$PGPASSWORD psql -h "$HOST" -p "$PORT" -U "$USERNAME" -d "$DATABASE" -f "$FIX_SCRIPT"; then
    echo ""
    echo -e "${GREEN}Database fix executed successfully!${NC}"
else
    echo ""
    echo -e "${RED}Database fix execution failed${NC}"
    exit 1
fi

echo ""
echo "================================================"

# Verify fix results
echo -e "${YELLOW}Verifying fix results...${NC}"

NEW_TABLE_COUNT=$(PGPASSWORD=$PGPASSWORD psql -h "$HOST" -p "$PORT" -U "$USERNAME" -d "$DATABASE" -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';")

echo -e "${GREEN}Tables before fix: $EXISTING_TABLES${NC}"
echo -e "${GREEN}Tables after fix: $NEW_TABLE_COUNT${NC}"

if [ "$NEW_TABLE_COUNT" -gt "$EXISTING_TABLES" ]; then
    echo -e "${GREEN}Successfully added $((NEW_TABLE_COUNT - EXISTING_TABLES)) new tables${NC}"
else
    echo -e "${YELLOW}No table count change, tables may already exist${NC}"
fi

echo ""
echo -e "${YELLOW}Data statistics for each table:${NC}"
PGPASSWORD=$PGPASSWORD psql -h "$HOST" -p "$PORT" -U "$USERNAME" -d "$DATABASE" -c "
SELECT 'users' as table_name, count(*) as count FROM users
UNION ALL
SELECT 'channels', count(*) FROM channels
UNION ALL
SELECT 'messages', count(*) FROM messages
UNION ALL
SELECT 'message_reactions', count(*) FROM message_reactions
ORDER BY table_name;
"

echo ""
echo "================================================"
echo -e "${GREEN}Database fix complete!${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Check if application can connect to database normally"
echo "2. Test new features (message emoji reactions)"
echo "3. Verify all API endpoints work properly"
echo ""

# Cleanup variables
unset PGPASSWORD

exit 0
