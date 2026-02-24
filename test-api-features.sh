#!/bin/bash
# Slack API Test Suite - Organized by Feature Categories
# This script provides comprehensive API testing for Slack-like application
# Designed for customer reference and system validation

# ============================================================
# CONFIGURATION
# ============================================================

MCP_URL="http://localhost:3002/mcp/messages"
TEST_EMAIL="slackbot@slack-import.local"
TEST_PASSWORD="password123"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Test counters
TOTAL_TESTS=0
PASS_TESTS=0
FAIL_TESTS=0

# Category counters - using simple variables
CAT_AUTH_TOTAL=0; CAT_AUTH_PASS=0; CAT_AUTH_FAIL=0
CAT_CHANNELS_TOTAL=0; CAT_CHANNELS_PASS=0; CAT_CHANNELS_FAIL=0
CAT_MESSAGING_TOTAL=0; CAT_MESSAGING_PASS=0; CAT_MESSAGING_FAIL=0
CAT_SEARCH_TOTAL=0; CAT_SEARCH_PASS=0; CAT_SEARCH_FAIL=0
CAT_USERS_TOTAL=0; CAT_USERS_PASS=0; CAT_USERS_FAIL=0
CAT_DM_TOTAL=0; CAT_DM_PASS=0; CAT_DM_FAIL=0
CAT_NOTIFICATIONS_TOTAL=0; CAT_NOTIFICATIONS_PASS=0; CAT_NOTIFICATIONS_FAIL=0
CAT_THREADS_TOTAL=0; CAT_THREADS_PASS=0; CAT_THREADS_FAIL=0
CAT_ATTACHMENTS_TOTAL=0; CAT_ATTACHMENTS_PASS=0; CAT_ATTACHMENTS_FAIL=0

# ============================================================
# HELPER FUNCTIONS
# ============================================================

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
}

log_error() {
    echo -e "${RED}[FAIL]${NC} $1"
}

log_section() {
    echo ""
    echo -e "${YELLOW}========================================${NC}"
    echo -e "${YELLOW} $1${NC}"
    echo -e "${YELLOW}========================================${NC}"
    echo ""
}

# Track category results
track_category() {
    local cat_name=$1
    local is_pass=$2

    TOTAL_TESTS=$((TOTAL_TESTS + 1))

    case $cat_name in
        "Auth")
            CAT_AUTH_TOTAL=$((CAT_AUTH_TOTAL + 1))
            if [ "$is_pass" = "1" ]; then
                CAT_AUTH_PASS=$((CAT_AUTH_PASS + 1))
                PASS_TESTS=$((PASS_TESTS + 1))
            else
                CAT_AUTH_FAIL=$((CAT_AUTH_FAIL + 1))
                FAIL_TESTS=$((FAIL_TESTS + 1))
            fi
            ;;
        "Channels")
            CAT_CHANNELS_TOTAL=$((CAT_CHANNELS_TOTAL + 1))
            if [ "$is_pass" = "1" ]; then
                CAT_CHANNELS_PASS=$((CAT_CHANNELS_PASS + 1))
                PASS_TESTS=$((PASS_TESTS + 1))
            else
                CAT_CHANNELS_FAIL=$((CAT_CHANNELS_FAIL + 1))
                FAIL_TESTS=$((FAIL_TESTS + 1))
            fi
            ;;
        "Messaging")
            CAT_MESSAGING_TOTAL=$((CAT_MESSAGING_TOTAL + 1))
            if [ "$is_pass" = "1" ]; then
                CAT_MESSAGING_PASS=$((CAT_MESSAGING_PASS + 1))
                PASS_TESTS=$((PASS_TESTS + 1))
            else
                CAT_MESSAGING_FAIL=$((CAT_MESSAGING_FAIL + 1))
                FAIL_TESTS=$((FAIL_TESTS + 1))
            fi
            ;;
        "Search")
            CAT_SEARCH_TOTAL=$((CAT_SEARCH_TOTAL + 1))
            if [ "$is_pass" = "1" ]; then
                CAT_SEARCH_PASS=$((CAT_SEARCH_PASS + 1))
                PASS_TESTS=$((PASS_TESTS + 1))
            else
                CAT_SEARCH_FAIL=$((CAT_SEARCH_FAIL + 1))
                FAIL_TESTS=$((FAIL_TESTS + 1))
            fi
            ;;
        "Users")
            CAT_USERS_TOTAL=$((CAT_USERS_TOTAL + 1))
            if [ "$is_pass" = "1" ]; then
                CAT_USERS_PASS=$((CAT_USERS_PASS + 1))
                PASS_TESTS=$((PASS_TESTS + 1))
            else
                CAT_USERS_FAIL=$((CAT_USERS_FAIL + 1))
                FAIL_TESTS=$((FAIL_TESTS + 1))
            fi
            ;;
        "DM")
            CAT_DM_TOTAL=$((CAT_DM_TOTAL + 1))
            if [ "$is_pass" = "1" ]; then
                CAT_DM_PASS=$((CAT_DM_PASS + 1))
                PASS_TESTS=$((PASS_TESTS + 1))
            else
                CAT_DM_FAIL=$((CAT_DM_FAIL + 1))
                FAIL_TESTS=$((FAIL_TESTS + 1))
            fi
            ;;
        "Notifications")
            CAT_NOTIFICATIONS_TOTAL=$((CAT_NOTIFICATIONS_TOTAL + 1))
            if [ "$is_pass" = "1" ]; then
                CAT_NOTIFICATIONS_PASS=$((CAT_NOTIFICATIONS_PASS + 1))
                PASS_TESTS=$((PASS_TESTS + 1))
            else
                CAT_NOTIFICATIONS_FAIL=$((CAT_NOTIFICATIONS_FAIL + 1))
                FAIL_TESTS=$((FAIL_TESTS + 1))
            fi
            ;;
        "Threads")
            CAT_THREADS_TOTAL=$((CAT_THREADS_TOTAL + 1))
            if [ "$is_pass" = "1" ]; then
                CAT_THREADS_PASS=$((CAT_THREADS_PASS + 1))
                PASS_TESTS=$((PASS_TESTS + 1))
            else
                CAT_THREADS_FAIL=$((CAT_THREADS_FAIL + 1))
                FAIL_TESTS=$((FAIL_TESTS + 1))
            fi
            ;;
        "Attachments")
            CAT_ATTACHMENTS_TOTAL=$((CAT_ATTACHMENTS_TOTAL + 1))
            if [ "$is_pass" = "1" ]; then
                CAT_ATTACHMENTS_PASS=$((CAT_ATTACHMENTS_PASS + 1))
                PASS_TESTS=$((PASS_TESTS + 1))
            else
                CAT_ATTACHMENTS_FAIL=$((CAT_ATTACHMENTS_FAIL + 1))
                FAIL_TESTS=$((FAIL_TESTS + 1))
            fi
            ;;
    esac
}

# Login and get token
do_login() {
    LOGIN_RESP=$(curl -s "$MCP_URL" -H "Content-Type: application/json" -d "{
        \"jsonrpc\": \"2.0\",
        \"id\": 0,
        \"method\": \"tools/call\",
        \"params\": {
            \"name\": \"login\",
            \"arguments\": {\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}
        }
    }")

    TOKEN=$(echo "$LOGIN_RESP" | python3 -c "import sys,json; r=json.load(sys.stdin); t=json.loads(r['result']['content'][0]['text']); print(t.get('token',''))" 2>/dev/null)
    MY_USER_ID=$(echo "$LOGIN_RESP" | python3 -c "import sys,json; r=json.load(sys.stdin); t=json.loads(r['result']['content'][0]['text']); print(t.get('userId',''))" 2>/dev/null)

    if [ -z "$TOKEN" ]; then
        log_error "Login failed"
        exit 1
    fi

    log_success "Logged in as $TEST_EMAIL"
    echo "Token: ${TOKEN:0:30}..."
    echo "User ID: $MY_USER_ID"
}

# Call MCP tool
call_mcp() {
    local id=$1
    local tool=$2
    local args=$3
    local desc=$4
    local category=$5

    local response
    response=$(curl -s "$MCP_URL" -H "Content-Type: application/json" -d "{
        \"jsonrpc\": \"2.0\",
        \"id\": $id,
        \"method\": \"tools/call\",
        \"params\": {
            \"name\": \"$tool\",
            \"arguments\": $args
        }
    }" 2>/dev/null)

    local is_error=$(echo "$response" | python3 -c "import sys,json; r=json.load(sys.stdin); print('ERROR' if r.get('result',{}).get('isError') or 'error' in r else 'OK')" 2>/dev/null)
    local text=$(echo "$response" | python3 -c "import sys,json; r=json.load(sys.stdin); c=r.get('result',{}).get('content',[]); print(c[0]['text'] if c else json.dumps(r.get('error',{})))" 2>/dev/null)

    if [ "$is_error" = "OK" ]; then
        log_success "$desc"
        echo "  Response: $(echo "$text" | head -c 150)"
        [ -n "$category" ] && track_category "$category" "1"
        return 0
    else
        log_error "$desc"
        echo "  Error: $(echo "$text" | head -c 150)"
        [ -n "$category" ] && track_category "$category" "0"
        return 1
    fi
}

# ============================================================
# TEST CATEGORIES
# ============================================================

test_category_1_auth() {
    log_section "CATEGORY 1: Authentication & User Management"

    # Health check (no auth required)
    call_mcp 1 "health_check" '{}' "Health Check" "Auth"

    # Login
    call_mcp 2 "login" "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}" "User Login" "Auth"

    # Get current user
    call_mcp 3 "get_me" "{\"userToken\":\"$TOKEN\"}" "Get Current User Info" "Auth"

    # Get profile
    call_mcp 4 "get_profile" "{\"userToken\":\"$TOKEN\"}" "Get User Profile" "Auth"

    # Update profile
    call_mcp 5 "update_profile" "{\"userToken\":\"$TOKEN\",\"displayName\":\"Slackbot\"}" "Update User Profile" "Auth"
}

test_category_2_channels() {
    log_section "CATEGORY 2: Channel Management"

    # List channels
    call_mcp 10 "list_channels" "{\"userToken\":\"$TOKEN\"}" "List All Channels" "Channels"

    # Get channel details
    call_mcp 11 "get_channel" "{\"channelId\":\"$CHANNEL_ID\",\"userToken\":\"$TOKEN\"}" "Get Channel Details" "Channels"

    # Create channel
    CH_CREATE_RESP=$(curl -s "$MCP_URL" -H "Content-Type: application/json" -d "{
        \"jsonrpc\": \"2.0\",
        \"id\": 12,
        \"method\": \"tools/call\",
        \"params\": {
            \"name\": \"create_channel\",
            \"arguments\": {\"name\":\"test-api-$(date +%s)\",\"description\":\"API Test Channel\",\"userToken\":\"$TOKEN\"}
        }
    }")

    NEW_CHANNEL_ID=$(echo "$CH_CREATE_RESP" | python3 -c "
        import sys,json
        r=json.load(sys.stdin)
        text=r['result']['content'][0]['text']
        data=json.loads(text)
        print(data.get('id', data.get('channel',{}).get('id','')) if isinstance(data,dict) else '')
    " 2>/dev/null)

    log_info "Created channel: $NEW_CHANNEL_ID"

    # Update channel
    call_mcp 13 "update_channel" "{\"channelId\":\"$NEW_CHANNEL_ID\",\"name\":\"updated-channel\",\"userToken\":\"$TOKEN\"}" "Update Channel" "Channels"

    # Join channel - skip if already member (newly created channels auto-join owner)
    log_info "Testing channel membership operations..."

    # List channel members
    call_mcp 15 "list_channel_members" "{\"channelId\":\"$CHANNEL_ID\",\"userToken\":\"$TOKEN\"}" "List Channel Members" "Channels"

    # Invite member
    call_mcp 16 "invite_channel_member" "{\"channelId\":\"$NEW_CHANNEL_ID\",\"userId\":\"$OTHER_USER_ID\",\"userToken\":\"$TOKEN\"}" "Invite Member to Channel" "Channels"

    # Remove member
    call_mcp 17 "remove_channel_member" "{\"channelId\":\"$NEW_CHANNEL_ID\",\"userId\":\"$OTHER_USER_ID\",\"userToken\":\"$TOKEN\"}" "Remove Member from Channel" "Channels"

    # Get channel permissions
    call_mcp 18 "get_channel_permissions" "{\"channelId\":\"$NEW_CHANNEL_ID\",\"userToken\":\"$TOKEN\"}" "Get Channel Permissions" "Channels"

    # Delete channel
    call_mcp 19 "delete_channel" "{\"channelId\":\"$NEW_CHANNEL_ID\",\"userToken\":\"$TOKEN\"}" "Delete Channel" "Channels"

    # Note: Don't leave the main test channel, it's used by subsequent tests
}

test_category_3_messaging() {
    log_section "CATEGORY 3: Messaging"

    # List messages
    call_mcp 30 "list_messages" "{\"channelId\":\"$CHANNEL_ID\",\"userToken\":\"$TOKEN\",\"limit\":10}" "List Messages" "Messaging"

    # Send message
    MSG_RESP=$(curl -s "$MCP_URL" -H "Content-Type: application/json" -d "{
        \"jsonrpc\": \"2.0\",
        \"id\": 31,
        \"method\": \"tools/call\",
        \"params\": {
            \"name\": \"send_message\",
            \"arguments\": {\"channelId\":\"$CHANNEL_ID\",\"content\":\"API Test Message $(date +%s)\",\"userToken\":\"$TOKEN\"}
        }
    }")

    MSG_ID=$(echo "$MSG_RESP" | python3 -c "
        import sys,json
        r=json.load(sys.stdin)
        text=r['result']['content'][0]['text']
        data=json.loads(text)
        print(data.get('id', data.get('message',{}).get('id','')) if isinstance(data,dict) else '')
    " 2>/dev/null)

    log_info "Sent message: $MSG_ID"

    # Get message
    call_mcp 32 "get_message" "{\"messageId\":\"$MSG_ID\",\"userToken\":\"$TOKEN\"}" "Get Message Details" "Messaging"

    # Update message
    call_mcp 33 "update_message" "{\"messageId\":\"$MSG_ID\",\"content\":\"Updated Message\",\"userToken\":\"$TOKEN\"}" "Update Message" "Messaging"

    # Reply to message (thread)
    call_mcp 34 "reply_to_message" "{\"messageId\":\"$MSG_ID\",\"content\":\"Thread Reply\",\"userToken\":\"$TOKEN\"}" "Reply to Message (Thread)" "Messaging"

    # Get thread replies
    call_mcp 35 "get_thread_replies" "{\"messageId\":\"$MSG_ID\",\"userToken\":\"$TOKEN\"}" "Get Thread Replies" "Messaging"

    # Add reaction
    call_mcp 36 "add_reaction" "{\"messageId\":\"$MSG_ID\",\"emoji\":\"thumbsup\",\"userToken\":\"$TOKEN\"}" "Add Reaction" "Messaging"

    # Get reactions
    call_mcp 37 "get_reactions" "{\"messageId\":\"$MSG_ID\",\"userToken\":\"$TOKEN\"}" "Get Reactions" "Messaging"

    # Remove reaction
    call_mcp 38 "remove_reaction" "{\"messageId\":\"$MSG_ID\",\"emoji\":\"thumbsup\",\"userToken\":\"$TOKEN\"}" "Remove Reaction" "Messaging"

    # Delete message
    call_mcp 39 "delete_message" "{\"messageId\":\"$MSG_ID\",\"userToken\":\"$TOKEN\"}" "Delete Message" "Messaging"
}

test_category_4_search() {
    log_section "CATEGORY 4: Search"

    # Search messages
    call_mcp 40 "search_messages" "{\"query\":\"test\",\"userToken\":\"$TOKEN\"}" "Search Messages" "Search"

    # Context search
    call_mcp 41 "context_search_messages" "{\"query\":\"test\",\"channelId\":\"$CHANNEL_ID\",\"userToken\":\"$TOKEN\"}" "Context Search Messages" "Search"
}

test_category_5_users() {
    log_section "CATEGORY 5: User Management"

    # List users
    call_mcp 50 "list_users" "{\"userToken\":\"$TOKEN\"}" "List All Users" "Users"

    # Search users
    call_mcp 51 "search_users" "{\"query\":\"slack\",\"userToken\":\"$TOKEN\"}" "Search Users" "Users"

    # Get unread counts
    call_mcp 52 "get_unread_counts" "{\"userToken\":\"$TOKEN\"}" "Get Unread Counts" "Users"

    # Get starred users
    call_mcp 53 "get_starred_users" "{\"userToken\":\"$TOKEN\"}" "Get Starred Users" "Users"

    # Toggle starred user
    call_mcp 54 "toggle_starred_user" "{\"starredUserId\":\"$OTHER_USER_ID\",\"userToken\":\"$TOKEN\"}" "Toggle Starred User" "Users"
}

test_category_6_conversations() {
    log_section "CATEGORY 6: Direct Messages (DM)"

    # Create DM
    DM_RESP=$(curl -s "$MCP_URL" -H "Content-Type: application/json" -d "{
        \"jsonrpc\": \"2.0\",
        \"id\": 60,
        \"method\": \"tools/call\",
        \"params\": {
            \"name\": \"create_dm\",
            \"arguments\": {\"userId\":\"$OTHER_USER_ID\",\"userToken\":\"$TOKEN\"}
        }
    }")

    DM_ID=$(echo "$DM_RESP" | python3 -c "
        import sys,json
        r=json.load(sys.stdin)
        text=r['result']['content'][0]['text']
        data=json.loads(text)
        print(data.get('id', data.get('conversationId','')) if isinstance(data,dict) else '')
    " 2>/dev/null)

    log_info "Created DM: $DM_ID"

    # Get DM
    call_mcp 61 "get_dm" "{\"userId\":\"$OTHER_USER_ID\",\"userToken\":\"$TOKEN\"}" "Get DM Conversation" "DM"

    # List active DMs
    call_mcp 62 "list_active_dms" "{\"userToken\":\"$TOKEN\"}" "List Active DMs" "DM"

    # Get read position
    call_mcp 63 "get_read_position" "{\"channelId\":\"$CHANNEL_ID\",\"userToken\":\"$TOKEN\"}" "Get Read Position" "DM"
}

test_category_7_notifications() {
    log_section "CATEGORY 7: Notifications"

    # Channel notification prefs
    call_mcp 70 "get_channel_notification_prefs" "{\"channelId\":\"$CHANNEL_ID\",\"userToken\":\"$TOKEN\"}" "Get Channel Notification Prefs" "Notifications"

    call_mcp 71 "update_channel_notification_prefs" "{\"channelId\":\"$CHANNEL_ID\",\"notificationLevel\":\"mentions\",\"userToken\":\"$TOKEN\"}" "Update Channel Notification Prefs" "Notifications"

    # DM notification prefs
    call_mcp 72 "get_dm_notification_prefs" "{\"conversationId\":\"$DM_ID\",\"userToken\":\"$TOKEN\"}" "Get DM Notification Prefs" "Notifications"

    call_mcp 73 "update_dm_notification_prefs" "{\"conversationId\":\"$DM_ID\",\"notificationLevel\":\"all\",\"userToken\":\"$TOKEN\"}" "Update DM Notification Prefs" "Notifications"

    # Mark messages read
    call_mcp 74 "mark_messages_read" "{\"channelId\":\"$CHANNEL_ID\",\"userToken\":\"$TOKEN\"}" "Mark Messages Read" "Notifications"

    call_mcp 75 "mark_all_messages_read" "{\"userToken\":\"$TOKEN\"}" "Mark All Messages Read" "Notifications"
}

test_category_8_threads() {
    log_section "CATEGORY 8: Thread Management"

    # Get thread count
    call_mcp 80 "get_thread_count" "{\"userToken\":\"$TOKEN\"}" "Get Thread Count" "Threads"

    # Get unread threads
    call_mcp 81 "get_unread_threads" "{\"userToken\":\"$TOKEN\"}" "Get Unread Threads" "Threads"

    # Mark thread read
    call_mcp 82 "mark_thread_read" "{\"threadId\":\"$MSG_ID\",\"userToken\":\"$TOKEN\"}" "Mark Thread Read" "Threads"
}

test_category_9_attachments() {
    log_section "CATEGORY 9: Attachments"

    # Get attachments
    call_mcp 90 "get_attachments" "{\"conversationId\":\"$CHANNEL_ID\",\"conversationType\":\"channel\",\"userToken\":\"$TOKEN\"}" "Get Attachments" "Attachments"
}

# ============================================================
# MAIN EXECUTION
# ============================================================

echo ""
echo "=============================================="
echo " Slack API Test Suite"
echo " $(date)"
echo " Test User: $TEST_EMAIL"
echo "=============================================="
echo ""

# Step 1: Login
do_login

# Step 2: Get channel and user for testing
log_info "Getting test data..."

# Get list of channels and find one user has joined
CHANNELS_RESP=$(curl -s "$MCP_URL" -H "Content-Type: application/json" -d "{
    \"jsonrpc\": \"2.0\",
    \"id\": 100,
    \"method\": \"tools/call\",
    \"params\": {
        \"name\": \"list_channels\",
        \"arguments\": {\"userToken\":\"$TOKEN\"}
    }
}")

CHANNEL_ID=""
CHANNEL_ID=$(echo "$CHANNELS_RESP" | python3 -c "
import sys,json
r=json.load(sys.stdin)
text=r['result']['content'][0]['text']
data=json.loads(text)
channels = data if isinstance(data, list) else data.get('channels', [])
# First, try to find a joined channel
for ch in channels:
    if ch.get('isJoined'):
        print(ch.get('id',''))
        break
else:
    # If no joined channel, create one
    print('NEED_CREATE')
" 2>/dev/null)

# If no joined channel, create one
if [ "$CHANNEL_ID" = "NEED_CREATE" ] || [ -z "$CHANNEL_ID" ]; then
    log_info "Creating test channel..."
    NEW_CH=$(curl -s "$MCP_URL" -H "Content-Type: application/json" -d "{
        \"jsonrpc\": \"2.0\",
        \"id\": 100,
        \"method\": \"tools/call\",
        \"params\": {
            \"name\": \"create_channel\",
            \"arguments\": {\"name\":\"test-channel-$(date +%s)\",\"description\":\"Test channel for API testing\",\"userToken\":\"$TOKEN\"}
        }
    }")
    CHANNEL_ID=$(echo "$NEW_CH" | python3 -c "
        import sys,json
        r=json.load(sys.stdin)
        text=r['result']['content'][0]['text']
        data=json.loads(text)
        print(data.get('id', data.get('channel',{}).get('id','')) if isinstance(data,dict) else '')
    " 2>/dev/null)
    log_info "Created new channel: $CHANNEL_ID"
fi

# Verify we are a member
JOIN_CHECK=$(curl -s "$MCP_URL" -H "Content-Type: application/json" -d "{
    \"jsonrpc\": \"2.0\",
    \"id\": 100,
    \"method\": \"tools/call\",
    \"params\": {
        \"name\": \"get_channel\",
        \"arguments\": {\"channelId\":\"$CHANNEL_ID\",\"userToken\":\"$TOKEN\"}
    }
}")

IS_MEMBER=$(echo "$JOIN_CHECK" | python3 -c "
import sys,json
r=json.load(sys.stdin)
text=r['result']['content'][0]['text']
data=json.loads(text)
print('yes' if data.get('isJoined') or data.get('members',[{'user':{'id':'$MY_USER_ID'}}]) else 'no')
" 2>/dev/null)

if [ "$IS_MEMBER" != "yes" ]; then
    log_info "Joining channel $CHANNEL_ID..."
    curl -s "$MCP_URL" -H "Content-Type: application/json" -d "{
        \"jsonrpc\": \"2.0\",
        \"id\": 100,
        \"method\": \"tools/call\",
        \"params\": {
            \"name\": \"join_channel\",
            \"arguments\": {\"channelId\":\"$CHANNEL_ID\",\"userToken\":\"$TOKEN\"}
        }
    }" > /dev/null
fi

# Get another user
USERS_RESP=$(curl -s "$MCP_URL" -H "Content-Type: application/json" -d "{
    \"jsonrpc\": \"2.0\",
    \"id\": 101,
    \"method\": \"tools/call\",
    \"params\": {
        \"name\": \"list_users\",
        \"arguments\": {\"userToken\":\"$TOKEN\"}
    }
}")

OTHER_USER_ID=$(echo "$USERS_RESP" | python3 -c "
import sys,json
r=json.load(sys.stdin)
text=r['result']['content'][0]['text']
data=json.loads(text)
users = data if isinstance(data, list) else data.get('users', [])
my_id='$MY_USER_ID'
for u in users:
    if u.get('id') != my_id:
        print(u['id'])
        break
" 2>/dev/null)

echo ""
log_info "Test Channel ID: $CHANNEL_ID"
log_info "Other User ID: $OTHER_USER_ID"
echo ""

# Step 3: Run all test categories
test_category_1_auth
test_category_2_channels
test_category_3_messaging
test_category_4_search
test_category_5_users
test_category_6_conversations
test_category_7_notifications
test_category_8_threads
test_category_9_attachments

# ============================================================
# COVERAGE REPORT
# ============================================================

print_coverage_report() {
    echo ""
    echo -e "${CYAN}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║           TEST COVERAGE REPORT                                ║${NC}"
    echo -e "${CYAN}╚════════════════════════════════════════════════════════════════╝${NC}"
    echo ""

    # Overall summary
    local pass_rate=0
    if [ $TOTAL_TESTS -gt 0 ]; then
        pass_rate=$((PASS_TESTS * 100 / TOTAL_TESTS))
    fi

    echo -e "${YELLOW}┌─────────────────────────────────────────────────────────────────┐${NC}"
    printf "${YELLOW}│${NC} %-62s ${YELLOW}│${NC}\n" "OVERALL SUMMARY"
    echo -e "${YELLOW}├─────────────────────────────────────────────────────────────────┤${NC}"
    printf "${YELLOW}│${NC} Total Tests: %-50s ${YELLOW}│${NC}\n" "$TOTAL_TESTS"
    printf "${YELLOW}│${NC} ${GREEN}PASSED${NC}: %-50s ${YELLOW}│${NC}\n" "$PASS_TESTS"
    printf "${YELLOW}│${NC} ${RED}FAILED${NC}: %-50s ${YELLOW}│${NC}\n" "$FAIL_TESTS"
    printf "${YELLOW}│${NC} Pass Rate: %-50s ${YELLOW}│${NC}\n" "$pass_rate%"
    echo -e "${YELLOW}└─────────────────────────────────────────────────────────────────┘${NC}"
    echo ""

    # Per-category breakdown
    echo -e "${YELLOW}┌─────────────────────────────────────────────────────────────────┐${NC}"
    printf "${YELLOW}│${NC} %-62s ${YELLOW}│${NC}\n" "COVERAGE BY CATEGORY"
    echo -e "${YELLOW}├─────────────────────────────────────────────────────────────────┤${NC}"
    printf "${YELLOW}│${NC} %-20s %10s %10s %15s ${YELLOW}│${NC}\n" "Category" "Total" "Pass" "Rate"
    echo -e "${YELLOW}├─────────────────────────────────────────────────────────────────┤${NC}"

    # Helper function to print category line
    print_cat_line() {
        local name=$1
        local total=$2
        local pass=$3
        local fail=$4

        if [ $total -gt 0 ]; then
            local rate=$((pass * 100 / total))
            if [ $fail -gt 0 ]; then
                printf "${YELLOW}│${NC} %-20s %10s ${GREEN}%10s${NC} %11s%2s%% ${YELLOW}│${NC}\n" "$name" "$total" "$pass" "" "$rate"
            else
                printf "${YELLOW}│${NC} %-20s %10s ${GREEN}%10s${NC} %13s%% ${YELLOW}│${NC}\n" "$name" "$total" "$pass" "$rate"
            fi
        fi
    }

    print_cat_line "Auth" "$CAT_AUTH_TOTAL" "$CAT_AUTH_PASS" "$CAT_AUTH_FAIL"
    print_cat_line "Channels" "$CAT_CHANNELS_TOTAL" "$CAT_CHANNELS_PASS" "$CAT_CHANNELS_FAIL"
    print_cat_line "Messaging" "$CAT_MESSAGING_TOTAL" "$CAT_MESSAGING_PASS" "$CAT_MESSAGING_FAIL"
    print_cat_line "Search" "$CAT_SEARCH_TOTAL" "$CAT_SEARCH_PASS" "$CAT_SEARCH_FAIL"
    print_cat_line "Users" "$CAT_USERS_TOTAL" "$CAT_USERS_PASS" "$CAT_USERS_FAIL"
    print_cat_line "DM" "$CAT_DM_TOTAL" "$CAT_DM_PASS" "$CAT_DM_FAIL"
    print_cat_line "Notifications" "$CAT_NOTIFICATIONS_TOTAL" "$CAT_NOTIFICATIONS_PASS" "$CAT_NOTIFICATIONS_FAIL"
    print_cat_line "Threads" "$CAT_THREADS_TOTAL" "$CAT_THREADS_PASS" "$CAT_THREADS_FAIL"
    print_cat_line "Attachments" "$CAT_ATTACHMENTS_TOTAL" "$CAT_ATTACHMENTS_PASS" "$CAT_ATTACHMENTS_FAIL"

    echo -e "${YELLOW}└─────────────────────────────────────────────────────────────────┘${NC}"
    echo ""

    # Feature matrix
    echo -e "${CYAN}FEATURE MATRIX:${NC}"
    echo ""
    echo -e "${YELLOW}  #  Category                              Tests  Status${NC}"
    echo -e "${YELLOW}  ──────────────────────────────────────────────────────────${NC}"

    print_matrix_line() {
        local idx=$1
        local name=$2
        local total=$3
        local pass=$4
        local fail=$5

        if [ $total -gt 0 ]; then
            local rate=$((pass * 100 / total))
            if [ $fail -eq 0 ]; then
                printf "  %d  %-35s %5s   ${GREEN}✓ PASS${NC}\n" "$idx" "$name" "$total"
            else
                printf "  %d  %-35s %5s   ${YELLOW}◐ PARTIAL${NC}\n" "$idx" "$name" "$total"
            fi
        else
            printf "  %d  %-35s %5s   ${RED}✗ NOT TESTED${NC}\n" "$idx" "$name" "0"
        fi
    }

    print_matrix_line 1 "Auth" "$CAT_AUTH_TOTAL" "$CAT_AUTH_PASS" "$CAT_AUTH_FAIL"
    print_matrix_line 2 "Channels" "$CAT_CHANNELS_TOTAL" "$CAT_CHANNELS_PASS" "$CAT_CHANNELS_FAIL"
    print_matrix_line 3 "Messaging" "$CAT_MESSAGING_TOTAL" "$CAT_MESSAGING_PASS" "$CAT_MESSAGING_FAIL"
    print_matrix_line 4 "Search" "$CAT_SEARCH_TOTAL" "$CAT_SEARCH_PASS" "$CAT_SEARCH_FAIL"
    print_matrix_line 5 "Users" "$CAT_USERS_TOTAL" "$CAT_USERS_PASS" "$CAT_USERS_FAIL"
    print_matrix_line 6 "DM" "$CAT_DM_TOTAL" "$CAT_DM_PASS" "$CAT_DM_FAIL"
    print_matrix_line 7 "Notifications" "$CAT_NOTIFICATIONS_TOTAL" "$CAT_NOTIFICATIONS_PASS" "$CAT_NOTIFICATIONS_FAIL"
    print_matrix_line 8 "Threads" "$CAT_THREADS_TOTAL" "$CAT_THREADS_PASS" "$CAT_THREADS_FAIL"
    print_matrix_line 9 "Attachments" "$CAT_ATTACHMENTS_TOTAL" "$CAT_ATTACHMENTS_PASS" "$CAT_ATTACHMENTS_FAIL"

    echo ""
    echo "=============================================="
    echo ""
}

# Print coverage report
print_coverage_report
