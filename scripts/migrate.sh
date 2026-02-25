#!/bin/bash

# =====================================================
# Database Migration Script
# Slack-like Chat Tool
# =====================================================

set -e

echo "Starting database migration..."

# Check required tools
command -v psql >/dev/null 2>&1 || { echo "PostgreSQL client not installed" >&2; exit 1; }
command -v node >/dev/null 2>&1 || { echo "Node.js not installed" >&2; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "npm not installed" >&2; exit 1; }

# Load environment variables
if [ -f .env ]; then
    echo "Loading environment variables..."
    # Safely load environment variables, skip comments and empty lines
    while IFS= read -r line; do
        # Skip empty lines
        [[ -z "$line" ]] && continue
        # Skip comment lines
        [[ "$line" =~ ^[[:space:]]*# ]] && continue
        # Extract variable name and value (remove trailing comments)
        if [[ "$line" =~ ^([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]]; then
            var_name="${BASH_REMATCH[1]}"
            var_value="${BASH_REMATCH[2]}"
            # Remove trailing comments
            var_value=$(echo "$var_value" | sed 's/[[:space:]]*#.*$//')
            # Export variable
            export "$var_name=$var_value"
        fi
    done < <(grep -v '^#' .env | grep -v '^$' | sed 's/\r$//')
else
    echo "Warning: .env file not found, make sure environment variables are set"
fi

# Check required environment variables
if [ -z "$DATABASE_URL" ]; then
    echo "DATABASE_URL environment variable not set"
    exit 1
fi

# Step 1: Check database connection
echo ""
echo "Checking database connection..."
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "SELECT 1;" > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "Database connection failed"
    exit 1
fi
echo "Database connection successful"

# Step 2: Check if extensions exist
echo ""
echo "Checking PostgreSQL extensions..."
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "SELECT extname FROM pg_extension WHERE extname IN ('uuid-ossp', 'pgcrypto', 'unaccent');" > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "Extension check failed"
    exit 1
fi
echo "PostgreSQL extensions installed"

# Step 3: Backup existing data (if tables exist)
echo ""
echo "Backing up existing data (if exists)..."
BACKUP_FILE="backup_$(date +%Y%m%d_%H%M%S).sql"
PGPASSWORD=$DB_PASSWORD pg_dump -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME --schema-only > "${BACKUP_FILE}_schema.sql" 2>/dev/null || true
PGPASSWORD=$DB_PASSWORD pg_dump -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME --data-only > "${BACKUP_FILE}_data.sql" 2>/dev/null || true
if [ -s "${BACKUP_FILE}_schema.sql" ] || [ -s "${BACKUP_FILE}_data.sql" ]; then
    echo "Data backed up to ${BACKUP_FILE}_*.sql"
else
    echo "No existing data found, no backup needed"
    rm -f "${BACKUP_FILE}_schema.sql" "${BACKUP_FILE}_data.sql"
fi

# Step 4: Execute initialization SQL script
echo ""
echo "Executing database initialization script..."
if [ -f "database/init.sql" ]; then
    PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f "database/init.sql" > /dev/null 2>&1
    if [ $? -eq 0 ]; then
        echo "Database initialization successful"
    else
        echo "Database initialization failed"
        exit 1
    fi
else
    echo "Warning: database/init.sql not found, skipping initialization"
fi

# Step 5: Install dependencies
echo ""
echo "Installing Node.js dependencies..."
npm install

# Step 6: Generate Prisma client
echo ""
echo "Generating Prisma client..."
npx prisma generate

# Step 7: Push Prisma Schema to database
echo ""
echo "Pushing Prisma Schema..."
npx prisma db push

# Step 8: Verify database structure
echo ""
echo "Verifying database structure..."
TABLE_COUNT=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';" | xargs)
echo "Created $TABLE_COUNT tables"

# Step 9: Create indexes (if not already created)
echo ""
echo "Checking indexes..."
INDEX_COUNT=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT count(*) FROM pg_indexes WHERE schemaname = 'public';" | xargs)
echo "Found $INDEX_COUNT indexes"

# Step 10: Verify initialization data
echo ""
echo "Verifying initialization data..."
USER_COUNT=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT count(*) FROM users;" | xargs)
CHANNEL_COUNT=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT count(*) FROM channels;" | xargs)
echo "Created $USER_COUNT users"
echo "Created $CHANNEL_COUNT channels"

# Step 11: Run Prisma Studio (optional)
echo ""
read -p "Open Prisma Studio to view data? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Starting Prisma Studio..."
    npx prisma studio
fi

# Complete
echo ""
echo "Database migration complete!"
echo ""
echo "Next steps:"
echo "  1. Check database configuration in .env file"
echo "  2. Start application: npm run dev"
echo "  3. View documentation: https://your-docs-url.com"
echo ""
echo "Default admin account:"
echo "  Email: admin@example.com"
echo "  Password: admin123"
echo ""
echo "Tips:"
echo "  - Use 'npm run db:reset' to reset database"
echo "  - Use 'npm run db:seed' to reseed data"
echo "  - Use 'npm run db:studio' to open Prisma Studio"
echo ""
