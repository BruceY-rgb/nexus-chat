#!/bin/bash
# =====================================================
# One-click push to server script
# For: Docker already built, just need to upload to server
# =====================================================

set -e

# Color definitions
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

print_message() {
    echo -e "${2}${1}${NC}"
}

show_header() {
    clear
    print_message "========================================" "$BLUE"
    print_message "Push Application to Server" "$BLUE"
    print_message "========================================" "$BLUE"
    echo ""
}

# Server configuration
SERVER_IP="72.62.252.67"
# Need to confirm correct username (usually root or ubuntu)
SERVER_USER="root"
PROJECT_PATH="/Users/yangsmac/Desktop/Slack/slack-chat"

# Check parameters
check_params() {
    if [ $# -eq 0 ]; then
        print_message "Please provide Docker Hub username" "$RED"
        print_message "Usage: ./push-to-server.sh <your-dockerhub-username>" "$BLUE"
        print_message "Example: ./push-to-server.sh yourname" "$BLUE"
        exit 1
    fi

    DOCKERHUB_USER=$1
    IMAGE_NAME="$DOCKERHUB_USER/slack-chat"
    print_message "Deployment configuration:" "$PURPLE"
    echo "   Server: $SERVER_USER@$SERVER_IP"
    echo "   Image: $IMAGE_NAME:latest"
    echo ""
}

# Verify server connection
test_connection() {
    print_message "Testing server connection..." "$YELLOW"

    # Test IP connectivity
    if ! ping -c 2 "$SERVER_IP" > /dev/null 2>&1; then
        print_message "Cannot connect to server $SERVER_IP" "$RED"
        print_message "Please check:" "$BLUE"
        print_message "   1. Server IP is correct" "$CYAN"
        print_message "   2. Server is powered on" "$CYAN"
        print_message "   3. Network is working" "$CYAN"
        exit 1
    fi

    print_message "Server connection normal" "$GREEN"
    echo ""

    # Test SSH connection (without executing commands)
    print_message "Testing SSH authentication..." "$YELLOW"
    if ! ssh -o ConnectTimeout=5 -o BatchMode=yes "$SERVER_USER@$SERVER_IP" echo "SSH connection successful" > /dev/null 2>&1; then
        print_message "SSH key authentication failed" "$YELLOW"
        print_message "Will try password authentication..." "$CYAN"
        echo ""
        read -p "Please enter server password: " -s SERVER_PASSWORD
        echo ""
    else
        print_message "SSH key authentication successful" "$GREEN"
        echo ""
    fi
}

# Check local Docker image
check_local_image() {
    print_message "Checking local Docker image..." "$YELLOW"

    if docker images slack-chat-app > /dev/null 2>&1; then
        print_message "Local image found" "$GREEN"
        docker images | grep slack-chat-app
    elif docker images | grep "slack-chat" > /dev/null 2>&1; then
        print_message "Related image found" "$GREEN"
        docker images | grep slack-chat
    else
        print_message "Docker image not found" "$RED"
        print_message "Please build the image first: ./build.sh" "$BLUE"
        exit 1
    fi
    echo ""
}

# Push image to Docker Hub
push_image() {
    print_message "Pushing image to Docker Hub..." "$YELLOW"
    echo ""

    # Check if logged in
    if ! docker info | grep -q "Username:"; then
        print_message "Please log in to Docker Hub..." "$YELLOW"
        docker login
    fi

    # Tagging
    print_message "Tagging image..." "$CYAN"
    docker tag slack-chat-app:latest "$IMAGE_NAME:latest"
    docker tag slack-chat-app:latest "$IMAGE_NAME:$(date +%Y%m%d)"

    # Push
    print_message "Pushing image..." "$CYAN"
    docker push "$IMAGE_NAME:latest"
    docker push "$IMAGE_NAME:$(date +%Y%m%d)"

    print_message "Image push complete" "$GREEN"
    echo ""
}

# Upload project files
upload_project() {
    print_message "Uploading project files to server..." "$YELLOW"

    # Create deployment package
    print_message "   Creating deployment package..." "$CYAN"
    cd "$PROJECT_PATH"
    tar -czf /tmp/slack-chat-deploy.tar.gz \
        --exclude='node_modules' \
        --exclude='.next' \
        --exclude='dist' \
        --exclude='*.log' \
        --exclude='.git' \
        .

    # Upload files
    print_message "   Uploading deployment package..." "$CYAN"
    scp /tmp/slack-chat-deploy.tar.gz "$SERVER_USER@$SERVER_IP:/tmp/"

    print_message "Project files uploaded successfully" "$GREEN"
    echo ""
}

# Deploy on server
deploy_on_server() {
    print_message "Deploying application on server..." "$YELLOW"
    echo ""

    # SSH command
    SSH_CMD="ssh $SERVER_USER@$SERVER_IP"

    # If password exists, use sshpass
    if [ -n "$SERVER_PASSWORD" ]; then
        SSH_CMD="sshpass -p '$SERVER_PASSWORD' ssh -o StrictHostKeyChecking=no $SERVER_USER@$SERVER_IP"
    fi

    # Execute deployment on server
    $SSH_CMD << 'EOF'
# Extract project
echo "Extracting project files..."
cd /tmp
tar -xzf slack-chat-deploy.tar.gz
sudo mv slack-chat /opt/
cd /opt/slack-chat

# Install Docker (if not installed)
echo "Checking Docker..."
if ! command -v docker > /dev/null 2>&1; then
    echo "Installing Docker..."
    curl -fsSL https://get.docker.com | sudo sh
    sudo usermod -aG docker $USER
fi

# Stop existing containers
echo "Stopping existing containers..."
sudo docker-compose down --remove-orphans 2>/dev/null || true

# Pull image
echo "Pulling latest image..."
sudo docker pull DOCKERHUB_USER/slack-chat:latest

# Update docker-compose.yml
echo "Updating configuration..."
sed -i.bak "s|image: .*|image: DOCKERHUB_USER/slack-chat:latest|g" docker-compose.yml

# Start services
echo "Starting services..."
sudo docker-compose up -d

# Wait for database
echo "Waiting for database..."
timeout=60
while [ $timeout -gt 0 ]; do
    if sudo docker-compose exec -T db pg_isready -U yangsmac > /dev/null 2>&1; then
        break
    fi
    sleep 2
    timeout=$((timeout - 2))
done

# Run migrations
echo "Running database migrations..."
sudo docker-compose exec -T app npx prisma migrate deploy || sudo docker-compose exec -T app npx prisma migrate dev --name init || true

echo ""
echo "Deployment complete!"
echo ""
echo "Access addresses:"
echo "   Application: http://localhost:3000"
echo "   Domain: https://instagram.rlenv.data4o.ai (Nginx configuration required)"
echo ""
echo "Management commands:"
echo "   View status: sudo docker-compose ps"
echo "   View logs: sudo docker-compose logs -f app"
echo "   Stop services: sudo docker-compose down"
echo "   Restart services: sudo docker-compose restart"
echo ""

EOF

    # Replace variables
    $SSH_CMD "sed -i 's/DOCKERHUB_USER/$DOCKERHUB_USER/g' /tmp/deploy-commands.sh"
}

# Show completion information
show_completion() {
    echo ""
    print_message "========================================" "$GREEN"
    print_message "Push to server complete!" "$GREEN"
    print_message "========================================" "$GREEN"
    echo ""

    print_message "Access information:" "$BLUE"
    echo "   Server: $SERVER_IP"
    echo "   Application: http://$SERVER_IP:3000"
    echo "   Domain: https://instagram.rlenv.data4o.ai"
    echo ""

    print_message "Server management commands:" "$BLUE"
    echo "   Login to server: ssh $SERVER_USER@$SERVER_IP"
    echo "   View status: sudo docker-compose -f /opt/slack-chat/docker-compose.yml ps"
    echo "   View logs: sudo docker-compose -f /opt/slack-chat/docker-compose.yml logs -f app"
    echo "   Restart application: sudo docker-compose -f /opt/slack-chat/docker-compose.yml restart"
    echo ""
}

# Main function
main() {
    show_header

    check_params "$@"
    test_connection
    check_local_image
    push_image
    upload_project
    deploy_on_server

    show_completion
}

# Show help
if [ "$1" == "-h" ] || [ "$1" == "--help" ]; then
    echo ""
    echo "Usage: $0 <dockerhub-username>"
    echo ""
    echo "Examples:"
    echo "  $0 yourname          # Push image to yourname/slack-chat"
    echo ""
    echo "Prerequisites:"
    echo "  1. Local Docker image built"
    echo "  2. Logged in to Docker Hub (docker login)"
    echo "  3. Server SSH access"
    echo ""
    exit 0
fi

# Execute main function
main "$@"
