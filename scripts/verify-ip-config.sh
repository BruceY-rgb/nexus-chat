#!/bin/bash

# IP Configuration Verification Script
# Used to verify that all domain names in configuration files are correctly updated to instagram.rlenv.data4o.ai

echo "================================================"
echo "IP Address Configuration Verification Script"
echo "================================================"
echo ""

# Set correct domain
CORRECT_DOMAIN="instagram.rlenv.data4o.ai"
OLD_IP="118.31.62.122"
OLD_IP2="72.62.252.67"

# Counter
PASS_COUNT=0
FAIL_COUNT=0

# Check function
check_file() {
    local file=$1
    local pattern=$2
    local description=$3

    echo -n "Checking $description... "

    if [ ! -f "$file" ]; then
        echo "File not found: $file"
        ((FAIL_COUNT++))
        return 1
    fi

    if grep -q "$CORRECT_DOMAIN" "$file"; then
        echo "Correct (contains $CORRECT_DOMAIN)"
        ((PASS_COUNT++))
        return 0
    elif grep -q "$OLD_IP" "$file" || grep -q "$OLD_IP2" "$file"; then
        echo "Still using old IP ($OLD_IP or $OLD_IP2)"
        ((FAIL_COUNT++))
        return 1
    else
        echo "Domain not found"
        ((FAIL_COUNT++))
        return 1
    fi
}

# Check .env.server
check_file ".env.server" "NEXT_PUBLIC_APP_URL" ".env.server environment variables"

# Check nginx configuration
check_file "nginx/conf.d/default.conf" "server_name" "Nginx configuration file"

# Check docker-compose.dokploy.yml
if [ -f "docker-compose.dokploy.yml" ]; then
    check_file "docker-compose.dokploy.yml" "Host.*instagram.rlenv.data4o.ai" "Dokploy configuration"
else
    echo "Checking Dokploy configuration... File not found (docker-compose.dokploy.yml)"
fi

echo ""
echo "================================================"
echo "Verification Results Summary"
echo "================================================"
echo "Passed: $PASS_COUNT"
echo "Failed: $FAIL_COUNT"
echo ""

if [ $FAIL_COUNT -eq 0 ]; then
    echo "All checks passed! Domain configuration is correct."
    echo ""
    echo "Next steps:"
    echo "1. Restart services: docker-compose restart"
    echo "2. Test access: https://instagram.rlenv.data4o.ai"
    echo "3. View debugging guide: cat DEBUGGING-GUIDE.md"
    exit 0
else
    echo "Issues found! Please check the failed items above."
    echo ""
    echo "Solutions:"
    echo "1. Manually update failed files"
    echo "2. Run: ./scripts/update-domain.sh instagram.rlenv.data4o.ai"
    echo "3. Rebuild: npm run build"
    exit 1
fi
