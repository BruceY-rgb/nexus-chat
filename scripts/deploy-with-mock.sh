#!/bin/bash

# =====================================================
# Automated Deployment Script - With Mock Data
# Used to deploy Slack-like chat application to production and populate test data
# =====================================================

set -e

echo "Starting deployment process..."

# Color definitions
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function: Print colored messages
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check environment variables
print_status "Checking environment configuration..."
if [ ! -f ".env.production" ]; then
    print_error ".env.production file not found"
    exit 1
fi

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    print_error "Docker not installed, please install Docker first"
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    print_error "Docker Compose not installed, please install Docker Compose first"
    exit 1
fi

print_status "Environment check complete"

# Build Docker image
print_status "Building Docker image..."
docker-compose -f docker-compose.dokploy.yml build --no-cache
print_status "Image build complete"

# Stop existing containers
print_status "Stopping existing containers..."
docker-compose -f docker-compose.dokploy.yml down || true
print_status "Containers stopped"

# Start database and app services
print_status "Starting services..."
docker-compose -f docker-compose.dokploy.yml up -d db
print_status "Waiting for database to start..."
sleep 10

# Check database connection
print_status "Checking database connection..."
for i in {1..30}; do
    if docker-compose -f docker-compose.dokploy.yml exec -T db pg_isready -U ${DB_USER:-dokploy} > /dev/null 2>&1; then
        print_status "Database connection successful"
        break
    fi
    if [ $i -eq 30 ]; then
        print_error "Database connection timeout"
        exit 1
    fi
    echo -n "."
    sleep 2
done

# Generate Prisma client
print_status "Generating Prisma client..."
docker-compose -f docker-compose.dokploy.yml run --rm app npx prisma generate
print_status "Prisma client generation complete"

# Run database migration
print_status "Running database migration..."
docker-compose -f docker-compose.dokploy.yml run --rm app npx prisma migrate deploy
print_status "Database migration complete"

# Populate mock data
print_status "Starting mock data population..."
docker-compose -f docker-compose.dokploy.yml run --rm app npm run db:seed
if [ $? -eq 0 ]; then
    print_status "Mock data population complete"
else
    print_warning "Using enhanced mock data script..."
    docker-compose -f docker-compose.dokploy.yml run --rm app tsx scripts/seed-enhanced.ts
    print_status "Enhanced mock data population complete"
fi

# Start app service
print_status "Starting app service..."
docker-compose -f docker-compose.dokploy.yml up -d app

# Wait for app to start
print_status "Waiting for app to start..."
sleep 5

# Check app health status
print_status "Checking app health status..."
for i in {1..30}; do
    if curl -f http://localhost:3000/api/health > /dev/null 2>&1; then
        print_status "App started successfully"
        break
    fi
    if [ $i -eq 30 ]; then
        print_error "App startup failed"
        docker-compose -f docker-compose.dokploy.yml logs app
        exit 1
    fi
    echo -n "."
    sleep 2
done

# Show deployment results
print_status "Deployment complete!"
echo ""
echo "=========================================="
echo "Deployment Info:"
echo "=========================================="
echo "App URL: http://localhost:3000"
echo "WebSocket port: 3001"
echo ""
echo "Test Accounts:"
echo "Admin: admin@chat.com / admin123"
echo "Alice: alice@chat.com / password123"
echo "Bob: bob@chat.com / password123"
echo "Charlie: charlie@chat.com / password123"
echo "Diana: diana@chat.com / password123"
echo ""
echo "Available Channels:"
echo "- #general (public)"
echo "- #random (public)"
echo "- #announcements (public)"
echo "- #development (public)"
echo "- #design (public)"
echo "- #marketing (public)"
echo "- #sales (public)"
echo "- #hr (private)"
echo "- #finance (private)"
echo ""
echo "=========================================="
echo "Management Commands:"
echo "=========================================="
echo "View logs: docker-compose -f docker-compose.dokploy.yml logs -f app"
echo "Stop services: docker-compose -f docker-compose.dokploy.yml down"
echo "Restart services: docker-compose -f docker-compose.dokploy.yml restart"
echo "Reseed data: docker-compose -f docker-compose.dokploy.yml run --rm app tsx scripts/seed-enhanced.ts"
echo ""
echo "=========================================="
