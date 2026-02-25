#!/bin/bash
# SSL Certificate Auto-Configuration Script
# Use Let's Encrypt free SSL certificate

set -e

echo "Starting SSL certificate configuration..."

# Check if domain resolves to current server IP
DOMAIN="instagram.rlenv.data4o.ai"
SERVER_IP=$(curl -s ifconfig.me)

echo "Current server IP: $SERVER_IP"
echo "Please ensure domain $DOMAIN is resolved to this IP"
echo ""
read -p "Press Enter to continue after confirming domain resolution..."

# Create SSL directory
mkdir -p ssl

# Install certbot (if not installed)
if ! command -v certbot &> /dev/null; then
    echo "Installing Certbot..."
    if [ -f /etc/debian_version ]; then
        apt-get update
        apt-get install -y certbot python3-certbot-nginx
    elif [ -f /etc/redhat-release ]; then
        yum install -y certbot python3-certbot-nginx
    fi
fi

# Stop nginx container (if running)
echo "Stopping Nginx container..."
docker-compose stop nginx || true

# Temporarily start a simple HTTP server to verify domain
echo "Starting temporary HTTP server to verify domain..."
docker run --rm -d -p 80:80 --name temp-nginx -v $(pwd)/nginx/nginx.conf:/etc/nginx/nginx.conf nginx:alpine || true
sleep 3

# Apply for SSL certificate
echo "Applying for Let's Encrypt certificate..."
certbot certonly \
    --standalone \
    --preferred-challenges http \
    --email admin@rlenv.data4o.ai \
    --agree-tos \
    --no-eff-email \
    -d $DOMAIN

# Copy certificates to project directory
echo "Copying certificate files..."
cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem ssl/
cp /etc/letsencrypt/live/$DOMAIN/privkey.pem ssl/

# Set certificate permissions
chmod 600 ssl/*.pem

# Create certificate renewal script
cat > ssl/renew-ssl.sh << 'EOF'
#!/bin/bash
# SSL Certificate Renewal Script

DOMAIN="instagram.rlenv.data4o.ai"

# Stop nginx
docker-compose stop nginx

# Renew certificate
certbot renew --quiet

# Copy new certificates
cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem $(dirname $0)/../ssl/
cp /etc/letsencrypt/live/$DOMAIN/privkey.pem $(dirname $0)/../ssl/

# Set permissions
chmod 600 $(dirname $0)/../ssl/*.pem

# Restart nginx
docker-compose start nginx

echo "SSL certificate updated"
EOF

chmod +x ssl/renew-ssl.sh

# Stop temporary container
docker stop temp-nginx || true

# Add crontab task (check renewal daily)
(crontab -l 2>/dev/null; echo "0 12 * * * $(pwd)/ssl/renew-ssl.sh >> /var/log/ssl-renew.log 2>&1") | crontab -

# Start all services
echo "Starting all services..."
docker-compose up -d

echo ""
echo "SSL certificate configuration complete!"
echo "Certificate location: ./ssl/"
echo "Auto-renewal: Crontab task configured"
echo "Access URL: https://instagram.rlenv.data4o.ai"
echo ""
echo "Manual renewal command: ./ssl/renew-ssl.sh"
