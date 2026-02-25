#!/bin/sh

# Automatically run database migration when Docker starts
echo "Running database migration on startup..."

# Wait for database to be ready
echo "Waiting for database connection..."
sleep 5

# Generate Prisma client
echo "Generating Prisma client..."
npx prisma generate

# Execute database migration
echo "Running database migration..."
npx prisma migrate deploy

echo "Migration complete, starting application..."
exec "$@"
