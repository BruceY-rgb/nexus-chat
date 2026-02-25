#!/bin/bash
# Pull image and run on Linux server

set -e

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}"
echo "=========================================="
echo "Deploy Application on Linux Server"
echo "=========================================="
echo -e "${NC}"

# Check arguments
if [ $# -ne 2 ]; then
    echo -e "${YELLOW}Usage: $0 <IMAGE_NAME> <TAG>${NC}"
    echo "Example: $0 your-username/slack-chat latest"
    exit 1
fi

IMAGE_NAME=$1
IMAGE_TAG=$2

echo -e "${BLUE}Image Info:${NC}"
echo "   Name: $IMAGE_NAME"
echo "   Tag: $IMAGE_TAG"
echo ""

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    echo -e "${RED}Please do not run this script as root user${NC}"
    exit 1
fi

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${YELLOW}Docker not installed, starting installation...${NC}"
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    echo -e "${GREEN}Docker installation complete, please log out and run this script again${NC}"
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo -e "${YELLOW}Docker Compose not installed, starting installation...${NC}"
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    echo -e "${GREEN}Docker Compose installation complete${NC}"
fi

echo -e "${GREEN}Docker environment check passed${NC}"

# Pull image
echo -e "${YELLOW}Pulling image from Docker Hub...${NC}"
docker pull $IMAGE_NAME:$IMAGE_TAG

# Create project directory
echo -e "${YELLOW}Creating project directory...${NC}"
mkdir -p ~/slack-chat-deploy
cd ~/slack-chat-deploy

# Download docker-compose.yml
echo -e "${YELLOW}Downloading docker-compose.yml...${NC}"
curl -O https://raw.githubusercontent.com/your-username/slack-chat/main/docker-compose.server.yml

# Create .env file
echo -e "${YELLOW}Creating .env file...${NC}"
cat > .env << 'EOF'
# Production configuration
# Please modify according to your actual situation

DB_USER=yangsmac
DB_PASSWORD=your_secure_password_here
DB_NAME=slack_chat

JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters-long
JWT_EXPIRES_IN=7d

RESEND_API_KEY=re_your_resend_api_key
EMAIL_FROM="Slack Chat App <onboarding@resend.dev>"
EMAIL_REPLY_TO=onboarding@resend.dev
APP_NAME=Slack Chat App

SESSION_SECRET=your-super-secret-session-key-minimum-32-characters-long

OSS_REGION=oss-cn-hangzhou
OSS_ACCESS_KEY_ID=your_oss_access_key_id
OSS_ACCESS_KEY_SECRET=your_oss_access_key_secret
OSS_BUCKET=q-and-a-chatbot
OSS_ENDPOINT=https://oss-cn-hangzhou.aliyuncs.com

NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://instagram.rlenv.data4o.ai
WEBSOCKET_PORT=3001

ENABLE_FILE_UPLOAD=true
ENABLE_SEARCH=true
ENABLE_NOTIFICATIONS=true
ENABLE_EMAIL_NOTIFICATIONS=false

MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=image/jpeg,image/png,image/gif,image/webp,application/pdf,text/plain

RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

LOG_LEVEL=info
LOG_FORMAT=dev
EOF

echo -e "${YELLOW}Please edit the .env file and configure all required environment variables:${NC}"
echo -e "${YELLOW}   nano .env${NC}"
read -p "Press Enter to continue after configuration..."

# Modify image in docker-compose.yml
echo -e "${YELLOW}Modifying image in docker-compose.yml...${NC}"
sed -i "s|IMAGE_PLACEHOLDER|$IMAGE_NAME:$IMAGE_TAG|g" docker-compose.server.yml

# Create necessary directories
echo -e "${YELLOW}Creating necessary directories...${NC}"
mkdir -p nginx/conf.d ssl db

# Stop existing containers
echo -e "${YELLOW}Stopping existing containers...${NC}"
docker-compose down || true

# Start services
echo -e "${YELLOW}Starting services...${NC}"
docker-compose up -d

# Wait for services to start
echo -e "${YELLOW}Waiting for services to start...${NC}"
sleep 10

# Run database migration
echo -e "${YELLOW}Running database migration...${NC}"
docker-compose exec -T app npx prisma migrate deploy || true

# Check service status
echo -e "${YELLOW}Checking service status...${NC}"
docker-compose ps

echo ""
echo -e "${GREEN}=========================================="
echo "Deployment Complete!"
echo "=========================================="
echo -e "${NC}"
echo -e "${BLUE}Service URLs:${NC}"
echo "   App: http://localhost:3000"
echo "   Database: localhost:5432"
echo ""
echo -e "${YELLOW}Important Reminders:${NC}"
echo "1. Configure domain resolution: instagram.rlenv.data4o.ai -> server IP"
echo "2. Run SSL certificate configuration: sudo bash scripts/init-ssl.sh"
echo "3. Open firewall ports: 80, 443"
echo ""
