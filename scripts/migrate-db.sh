#!/bin/bash
# Database Migration Script - From local development environment to production

set -e

# Color output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=========================================="
echo "Database Migration Tool"
echo "==========================================${NC}"

# Check local database connection
echo -e "${YELLOW}Checking local development environment configuration...${NC}"

# Read local database configuration from .env file
if [ -f .env ]; then
    source .env
else
    echo -e "${RED}.env file does not exist${NC}"
    exit 1
fi

LOCAL_DB_URL="${DATABASE_URL}"
PROD_DB_URL="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}?schema=public"

echo -e "${GREEN}Local database URL: $LOCAL_DB_URL${NC}"

# Check remote database connection
echo -e "${YELLOW}Checking production database connection...${NC}"
if docker-compose exec -T db pg_isready -U ${DB_USER} -d ${DB_NAME} &> /dev/null; then
    echo -e "${GREEN}Production database connection normal${NC}"
else
    echo -e "${RED}Production database connection failed, please check configuration${NC}"
    exit 1
fi

echo ""
echo "Please select migration method:"
echo "1) Export local data and import to production"
echo "2) Run database migration only in production (Prisma)"
echo "3) Reset production database (WARNING: Dangerous, will delete all data)"
read -p "Enter selection [1-3]: " choice

case $choice in
    1)
        echo -e "${BLUE}Starting data migration...${NC}"

        # Export local data
        echo -e "${YELLOW}Exporting local database...${NC}"
        pg_dump "$LOCAL_DB_URL" > /tmp/local_db_backup.sql

        # Check exported file size
        if [ ! -s /tmp/local_db_backup.sql ]; then
            echo -e "${RED}Database export failed or empty${NC}"
            exit 1
        fi

        echo -e "${GREEN}Local database export successful${NC}"

        # Backup production database
        echo -e "${YELLOW}Backing up production database...${NC}"
        BACKUP_FILE="/tmp/prod_db_backup_$(date +%Y%m%d_%H%M%S).sql"
        docker-compose exec -T db pg_dump -U ${DB_USER} -d ${DB_NAME} > "$BACKUP_FILE"
        echo -e "${GREEN}Production database backup complete: $BACKUP_FILE${NC}"

        # Clear production database
        echo -e "${YELLOW}Clearing production database...${NC}"
        docker-compose exec -T db psql -U ${DB_USER} -d ${DB_NAME} -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO ${DB_USER}; GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};" || true

        # Import local data
        echo -e "${YELLOW}Importing data to production database...${NC}"
        cat /tmp/local_db_backup.sql | docker-compose exec -T db psql -U ${DB_USER} -d ${DB_NAME}

        echo -e "${GREEN}Data migration complete${NC}"
        ;;
    2)
        echo -e "${BLUE}Running database migration...${NC}"

        # Run Prisma migration
        docker-compose exec -T app npx prisma migrate deploy

        echo -e "${GREEN}Database migration complete${NC}"
        ;;
    3)
        echo -e "${RED}WARNING: This will delete all data in the production database!${NC}"
        read -p "Confirm continue? (Enter 'yes' to confirm): " confirm

        if [ "$confirm" = "yes" ]; then
            echo -e "${YELLOW}Resetting production database...${NC}"
            docker-compose exec -T db psql -U ${DB_USER} -d ${DB_NAME} -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO ${DB_USER}; GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};"

            echo -e "${GREEN}Database reset complete${NC}"
        else
            echo -e "${YELLOW}Operation cancelled${NC}"
        fi
        ;;
    *)
        echo -e "${RED}Invalid selection${NC}"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}Migration complete!${NC}"
echo -e "${BLUE}Checking data:${NC}"
docker-compose exec -T db psql -U ${DB_USER} -d ${DB_NAME} -c "\dt"

# Cleanup temporary files
rm -f /tmp/local_db_backup.sql

echo ""
echo -e "${YELLOW}Tip: If you encounter permission issues, ensure user has correct database permissions${NC}"
