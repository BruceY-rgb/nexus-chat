#!/bin/bash
# Build production image on Mac and push to Docker Hub

set -e

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}"
echo "=========================================="
echo "Build Production Image - Mac Platform"
echo "=========================================="
echo -e "${NC}"

# Check if Docker Desktop is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}Docker not running, please start Docker Desktop first${NC}"
    exit 1
fi

echo -e "${GREEN}Docker running normally${NC}"

# Ask for Docker Hub username
read -p "Please enter Docker Hub username: " DOCKER_USERNAME

if [ -z "$DOCKER_USERNAME" ]; then
    echo -e "${RED}Username cannot be empty${NC}"
    exit 1
fi

# Read .env.production file
if [ ! -f .env.production ]; then
    echo -e "${RED}.env.production file does not exist${NC}"
    exit 1
fi

# Extract image name and tag
IMAGE_NAME="$DOCKER_USERNAME/slack-chat"
IMAGE_TAG="latest"

echo ""
echo -e "${BLUE}Image information:${NC}"
echo "   Name: $IMAGE_NAME"
echo "   Tag: $IMAGE_TAG"
echo ""

# Login to Docker Hub
echo -e "${YELLOW}Logging in to Docker Hub...${NC}"
docker login

# Build production image
echo -e "${YELLOW}Building production image...${NC}"
docker build -t $IMAGE_NAME:$IMAGE_TAG .

# Push to Docker Hub
echo -e "${YELLOW}Pushing to Docker Hub...${NC}"
docker push $IMAGE_NAME:$IMAGE_TAG

echo -e "${GREEN}Image pushed successfully!${NC}"

echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "1. Run on Linux server: ./scripts/deploy-to-server.sh $IMAGE_NAME $IMAGE_TAG"
echo "2. Or manually pull the image:"
echo "   docker pull $IMAGE_NAME:$IMAGE_TAG"
echo ""
echo -e "${YELLOW}Tip: Make sure Docker and Docker Compose are installed on the server${NC}"
