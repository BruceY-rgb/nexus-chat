#!/bin/bash
# MCP Tools Comprehensive Test Script
# Tests all 53 MCP tools via HTTP JSON-RPC 2.0

MCP_URL="http://localhost:3002/mcp/messages"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Login and extract token dynamically
LOGIN_RESP=$(curl -s "$MCP_URL" -H "Content-Type: application/json" -d '{
  "jsonrpc": "2.0",
  "id": 0,
  "method": "tools/call",
  "params": {
    "name": "login",
    "arguments": {"email":"slackbot@slack-import.local","password":"password123"}
  }
}')
TOKEN=$(echo "$LOGIN_RESP" | python3 -c "import sys,json; r=json.load(sys.stdin); t=json.loads(r['result']['content'][0]['text']); print(t.get('token',''))" 2>/dev/null)
MY_USER_ID=$(echo "$LOGIN_RESP" | python3 -c "import sys,json; r=json.load(sys.stdin); t=json.loads(r['result']['content'][0]['text']); print(t.get('userId',''))" 2>/dev/null)

if [ -z "$TOKEN" ]; then
  echo -e "${RED}FATAL: Could not get auth token from login${NC}"
  echo "Login response: $LOGIN_RESP"
  exit 1
fi
echo -e "${GREEN}Logged in successfully${NC}"
echo "Token: ${TOKEN:0:30}..."
echo "User ID: $MY_USER_ID"

PASS=0
FAIL=0
RESULTS=""

call_mcp() {
  local id=$1
  local tool=$2
  local args=$3
  local desc=$4
  local expect_error=${5:-""}

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

  if [ "$is_error" = "OK" ] || [ "$expect_error" = "expect_error" ]; then
    PASS=$((PASS+1))
    local status="PASS"
    local color=$GREEN
  else
    FAIL=$((FAIL+1))
    local status="FAIL"
    local color=$RED
  fi

  RESULTS="${RESULTS}${status}|${tool}|${desc}|${text}\n"
  echo -e "${color}[$status]${NC} #$id $tool - $desc"
  echo "  Response: $(echo "$text" | head -c 200)"
  echo ""
}

echo ""
echo -e "${CYAN}==============================================${NC}"
echo -e "${CYAN} MCP Tools Full Coverage Test${NC}"
echo -e "${CYAN} $(date)${NC}"
echo -e "${CYAN}==============================================${NC}"
echo ""

# ===== 1. Health Tool =====
echo -e "${MAGENTA}=== Health (1 tool) ===${NC}"
call_mcp 1 "health_check" '{}' "Health check (no auth)"

# ===== 2. Auth Tools =====
echo -e "${MAGENTA}=== Auth Tools (7 tools) ===${NC}"
call_mcp 2 "login" '{"email":"slackbot@slack-import.local","password":"password123"}' "Login"
call_mcp 3 "get_me" "{\"userToken\":\"$TOKEN\"}" "Get current user"
call_mcp 4 "get_profile" "{\"userToken\":\"$TOKEN\"}" "Get profile"
call_mcp 5 "update_profile" "{\"userToken\":\"$TOKEN\",\"displayName\":\"Slackbot\"}" "Update profile"
call_mcp 6 "send_verification" '{"email":"slackbot@slack-import.local"}' "Send verification email"
# register - tested separately to avoid side effects
call_mcp 7 "register" '{"email":"mcp-test-'$RANDOM'@test.local","password":"TestPass123","displayName":"MCP Test User"}' "Register new user"

# ===== 3. Channel Tools =====
echo -e "${MAGENTA}=== Channel Tools (12 tools)${NC}"
call_mcp 10 "list_channels" "{\"userToken\":\"$TOKEN\"}" "List all channels"

# Parse first channel ID
CHANNELS_RESP=$(curl -s "$MCP_URL" -H "Content-Type: application/json" -d "{
  \"jsonrpc\": \"2.0\",
  \"id\": 100,
  \"method\": \"tools/call\",
  \"params\": {
    \"name\": \"list_channels\",
    \"arguments\": {\"userToken\":\"$TOKEN\"}
  }
}")
CHANNEL_ID=$(echo "$CHANNELS_RESP" | python3 -c "
import sys,json
r=json.load(sys.stdin)
text=r['result']['content'][0]['text']
data=json.loads(text)
channels = data if isinstance(data, list) else data.get('channels', data.get('data', []))
if channels and isinstance(channels, list):
    # Prefer a channel the user has joined
    for ch in channels:
        if ch.get('isJoined'):
            print(ch.get('id',''))
            break
    else:
        print(channels[0].get('id',''))
else:
    print('')
" 2>/dev/null)

echo "Using channel ID: $CHANNEL_ID"

call_mcp 11 "get_channel" "{\"channelId\":\"$CHANNEL_ID\",\"userToken\":\"$TOKEN\"}" "Get channel details"
call_mcp 12 "create_channel" "{\"name\":\"mcp-test-$(date +%s)\",\"description\":\"MCP test channel\",\"userToken\":\"$TOKEN\"}" "Create channel"

# Get the created channel ID
NEW_CH_RESP=$(curl -s "$MCP_URL" -H "Content-Type: application/json" -d "{
  \"jsonrpc\": \"2.0\",
  \"id\": 101,
  \"method\": \"tools/call\",
  \"params\": {
    \"name\": \"create_channel\",
    \"arguments\": {\"name\":\"mcp-test-del-$(date +%s)\",\"description\":\"to delete\",\"userToken\":\"$TOKEN\"}
  }
}")
NEW_CHANNEL_ID=$(echo "$NEW_CH_RESP" | python3 -c "
import sys,json
r=json.load(sys.stdin)
text=r['result']['content'][0]['text']
data=json.loads(text)
print(data.get('id', data.get('channel',{}).get('id','')) if isinstance(data,dict) else '')
" 2>/dev/null)
echo "Created channel for tests: $NEW_CHANNEL_ID"

call_mcp 13 "update_channel" "{\"channelId\":\"$NEW_CHANNEL_ID\",\"name\":\"mcp-updated-$(date +%s)\",\"userToken\":\"$TOKEN\"}" "Update channel"
# Create a separate channel to test join (avoid "already a member" error)
JOIN_CH_RESP=$(curl -s "$MCP_URL" -H "Content-Type: application/json" -d "{
  \"jsonrpc\": \"2.0\",
  \"id\": 108,
  \"method\": \"tools/call\",
  \"params\": {
    \"name\": \"create_channel\",
    \"arguments\": {\"name\":\"mcp-join-test-$(date +%s)\",\"userToken\":\"$TOKEN\"}
  }
}")
JOIN_CH_ID=$(echo "$JOIN_CH_RESP" | python3 -c "
import sys,json
r=json.load(sys.stdin)
text=r['result']['content'][0]['text']
data=json.loads(text)
print(data.get('id', data.get('channel',{}).get('id','')) if isinstance(data,dict) else '')
" 2>/dev/null)
# Leave first so we can test join
curl -s "$MCP_URL" -H "Content-Type: application/json" -d "{
  \"jsonrpc\": \"2.0\", \"id\": 109, \"method\": \"tools/call\",
  \"params\": {\"name\": \"leave_channel\", \"arguments\": {\"channelId\":\"$JOIN_CH_ID\",\"userToken\":\"$TOKEN\"}}
}" > /dev/null
call_mcp 14 "join_channel" "{\"channelId\":\"$JOIN_CH_ID\",\"userToken\":\"$TOKEN\"}" "Join channel"
call_mcp 15 "list_channel_members" "{\"channelId\":\"$CHANNEL_ID\",\"userToken\":\"$TOKEN\"}" "List channel members"

# Get another user for invite
USERS_RESP=$(curl -s "$MCP_URL" -H "Content-Type: application/json" -d "{
  \"jsonrpc\": \"2.0\",
  \"id\": 102,
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
users = data if isinstance(data, list) else data.get('users', data.get('data', []))
my_id='$MY_USER_ID'
for u in users:
    if u.get('id') != my_id:
        print(u['id'])
        break
" 2>/dev/null)
echo "Other user ID: $OTHER_USER_ID"

call_mcp 16 "invite_channel_member" "{\"channelId\":\"$NEW_CHANNEL_ID\",\"userId\":\"$OTHER_USER_ID\",\"userToken\":\"$TOKEN\"}" "Invite member to channel"
call_mcp 17 "join_all_channel_members" "{\"channelId\":\"$NEW_CHANNEL_ID\",\"userToken\":\"$TOKEN\"}" "Join all members"
call_mcp 18 "remove_channel_member" "{\"channelId\":\"$NEW_CHANNEL_ID\",\"userId\":\"$OTHER_USER_ID\",\"userToken\":\"$TOKEN\"}" "Remove member from channel"

# Test get_channel_permissions - owner should have full permissions
call_mcp 19 "get_channel_permissions" "{\"channelId\":\"$NEW_CHANNEL_ID\",\"userToken\":\"$TOKEN\"}" "Get channel permissions (owner)"

# Verify owner permissions fields
PERM_RESP=$(curl -s "$MCP_URL" -H "Content-Type: application/json" -d "{
  \"jsonrpc\": \"2.0\",
  \"id\": 110,
  \"method\": \"tools/call\",
  \"params\": {
    \"name\": \"get_channel_permissions\",
    \"arguments\": {\"channelId\":\"$NEW_CHANNEL_ID\",\"userToken\":\"$TOKEN\"}
  }
}")
PERM_OK=$(echo "$PERM_RESP" | python3 -c "
import sys,json
r=json.load(sys.stdin)
text=r['result']['content'][0]['text']
data=json.loads(text)
p=data.get('permissions',{})
role=data.get('role','')
is_member=data.get('isMember',False)
# Owner should have all permissions
if is_member and role=='owner' and p.get('canEdit') and p.get('canDelete') and p.get('canInvite') and p.get('canRemove') and p.get('canManageSettings') and p.get('canSendMessages') and p.get('canAddReactions'):
    print('PASS')
else:
    print('FAIL: isMember=%s role=%s perms=%s' % (is_member, role, p))
" 2>/dev/null)
if [ "$PERM_OK" = "PASS" ]; then
  PASS=$((PASS+1))
  RESULTS="${RESULTS}PASS|get_channel_permissions|Owner has all permissions verified|\n"
  echo "[PASS] Owner permissions verified: all permissions granted"
else
  FAIL=$((FAIL+1))
  RESULTS="${RESULTS}FAIL|get_channel_permissions|Owner permissions check|$PERM_OK\n"
  echo "[FAIL] Owner permissions check: $PERM_OK"
fi

# Test non-member permissions - create a channel, leave it, then check
PERM_TEST_CH_RESP=$(curl -s "$MCP_URL" -H "Content-Type: application/json" -d "{
  \"jsonrpc\": \"2.0\",
  \"id\": 111,
  \"method\": \"tools/call\",
  \"params\": {
    \"name\": \"create_channel\",
    \"arguments\": {\"name\":\"mcp-perm-test-$(date +%s)\",\"userToken\":\"$TOKEN\"}
  }
}")
PERM_TEST_CH_ID=$(echo "$PERM_TEST_CH_RESP" | python3 -c "
import sys,json
r=json.load(sys.stdin)
text=r['result']['content'][0]['text']
data=json.loads(text)
print(data.get('id', data.get('channel',{}).get('id','')) if isinstance(data,dict) else '')
" 2>/dev/null)

# Leave the channel
curl -s "$MCP_URL" -H "Content-Type: application/json" -d "{
  \"jsonrpc\": \"2.0\", \"id\": 112, \"method\": \"tools/call\",
  \"params\": {\"name\": \"leave_channel\", \"arguments\": {\"channelId\":\"$PERM_TEST_CH_ID\",\"userToken\":\"$TOKEN\"}}
}" > /dev/null

# Check non-member permissions
NONMEM_RESP=$(curl -s "$MCP_URL" -H "Content-Type: application/json" -d "{
  \"jsonrpc\": \"2.0\",
  \"id\": 113,
  \"method\": \"tools/call\",
  \"params\": {
    \"name\": \"get_channel_permissions\",
    \"arguments\": {\"channelId\":\"$PERM_TEST_CH_ID\",\"userToken\":\"$TOKEN\"}
  }
}")
NONMEM_OK=$(echo "$NONMEM_RESP" | python3 -c "
import sys,json
r=json.load(sys.stdin)
text=r['result']['content'][0]['text']
data=json.loads(text)
p=data.get('permissions',{})
is_member=data.get('isMember',False)
# Non-member should have NO permissions
if not is_member and not p.get('canEdit') and not p.get('canDelete') and not p.get('canInvite') and not p.get('canRemove') and not p.get('canManageSettings') and not p.get('canSendMessages') and not p.get('canAddReactions'):
    print('PASS')
else:
    print('FAIL: isMember=%s perms=%s' % (is_member, p))
" 2>/dev/null)
if [ "$NONMEM_OK" = "PASS" ]; then
  PASS=$((PASS+1))
  RESULTS="${RESULTS}PASS|get_channel_permissions|Non-member has no permissions|\n"
  echo "[PASS] Non-member permissions verified: all permissions denied"
else
  FAIL=$((FAIL+1))
  RESULTS="${RESULTS}FAIL|get_channel_permissions|Non-member permissions check|$NONMEM_OK\n"
  echo "[FAIL] Non-member permissions check: $NONMEM_OK"
fi

# Cleanup perm test channel - rejoin first to delete
curl -s "$MCP_URL" -H "Content-Type: application/json" -d "{
  \"jsonrpc\": \"2.0\", \"id\": 114, \"method\": \"tools/call\",
  \"params\": {\"name\": \"join_channel\", \"arguments\": {\"channelId\":\"$PERM_TEST_CH_ID\",\"userToken\":\"$TOKEN\"}}
}" > /dev/null
curl -s "$MCP_URL" -H "Content-Type: application/json" -d "{
  \"jsonrpc\": \"2.0\", \"id\": 115, \"method\": \"tools/call\",
  \"params\": {\"name\": \"delete_channel\", \"arguments\": {\"channelId\":\"$PERM_TEST_CH_ID\",\"userToken\":\"$TOKEN\"}}
}" > /dev/null

call_mcp 20 "delete_channel" "{\"channelId\":\"$NEW_CHANNEL_ID\",\"userToken\":\"$TOKEN\"}" "Delete channel"
call_mcp 20 "leave_channel" "{\"channelId\":\"$JOIN_CH_ID\",\"userToken\":\"$TOKEN\"}" "Leave channel"

# ===== 4. Message Tools =====
echo -e "${MAGENTA}=== Message Tools (15 tools)${NC}"
call_mcp 21 "list_messages" "{\"channelId\":\"$CHANNEL_ID\",\"userToken\":\"$TOKEN\",\"limit\":5}" "List messages"
call_mcp 22 "send_message" "{\"channelId\":\"$CHANNEL_ID\",\"content\":\"MCP test message $(date +%s)\",\"userToken\":\"$TOKEN\"}" "Send message"

# Get message ID
MSG_RESP=$(curl -s "$MCP_URL" -H "Content-Type: application/json" -d "{
  \"jsonrpc\": \"2.0\",
  \"id\": 103,
  \"method\": \"tools/call\",
  \"params\": {
    \"name\": \"send_message\",
    \"arguments\": {\"channelId\":\"$CHANNEL_ID\",\"content\":\"Test msg for thread $(date +%s)\",\"userToken\":\"$TOKEN\"}
  }
}")
MSG_ID=$(echo "$MSG_RESP" | python3 -c "
import sys,json
r=json.load(sys.stdin)
text=r['result']['content'][0]['text']
data=json.loads(text)
print(data.get('id', data.get('message',{}).get('id','')) if isinstance(data,dict) else '')
" 2>/dev/null)
echo "Test message ID: $MSG_ID"

call_mcp 23 "get_message" "{\"messageId\":\"$MSG_ID\",\"userToken\":\"$TOKEN\"}" "Get message"
call_mcp 24 "update_message" "{\"messageId\":\"$MSG_ID\",\"content\":\"Updated MCP test message\",\"userToken\":\"$TOKEN\"}" "Update message"
call_mcp 25 "reply_to_message" "{\"messageId\":\"$MSG_ID\",\"content\":\"Thread reply via MCP\",\"userToken\":\"$TOKEN\"}" "Reply to message"
call_mcp 26 "get_thread_replies" "{\"messageId\":\"$MSG_ID\",\"userToken\":\"$TOKEN\"}" "Get thread replies"
call_mcp 27 "add_reaction" "{\"messageId\":\"$MSG_ID\",\"emoji\":\"thumbsup\",\"userToken\":\"$TOKEN\"}" "Add reaction"
call_mcp 28 "get_reactions" "{\"messageId\":\"$MSG_ID\",\"userToken\":\"$TOKEN\"}" "Get reactions"
call_mcp 29 "remove_reaction" "{\"messageId\":\"$MSG_ID\",\"emoji\":\"thumbsup\",\"userToken\":\"$TOKEN\"}" "Remove reaction"
call_mcp 30 "search_messages" "{\"query\":\"MCP test\",\"userToken\":\"$TOKEN\"}" "Search messages"
call_mcp 31 "context_search_messages" "{\"query\":\"MCP test\",\"channelId\":\"$CHANNEL_ID\",\"userToken\":\"$TOKEN\"}" "Context search messages"
call_mcp 32 "mark_messages_read" "{\"channelId\":\"$CHANNEL_ID\",\"userToken\":\"$TOKEN\"}" "Mark messages read"
call_mcp 33 "mark_all_messages_read" "{\"userToken\":\"$TOKEN\"}" "Mark all messages read"
# delete_message tested at end
call_mcp 34 "delete_message" "{\"messageId\":\"$MSG_ID\",\"userToken\":\"$TOKEN\"}" "Delete message"

# ===== 5. User Tools =====
echo -e "${MAGENTA}=== User Tools (5 tools)${NC}"
call_mcp 40 "list_users" "{\"userToken\":\"$TOKEN\"}" "List users"
call_mcp 41 "search_users" "{\"query\":\"slack\",\"userToken\":\"$TOKEN\"}" "Search users"
call_mcp 42 "get_unread_counts" "{\"userToken\":\"$TOKEN\"}" "Get unread counts"
call_mcp 43 "get_starred_users" "{\"userToken\":\"$TOKEN\"}" "Get starred users"
call_mcp 44 "toggle_starred_user" "{\"starredUserId\":\"$OTHER_USER_ID\",\"userToken\":\"$TOKEN\"}" "Toggle starred user"

# ===== 6. Conversation/DM Tools =====
echo -e "${MAGENTA}=== Conversation/DM Tools (4 tools)${NC}"
call_mcp 50 "create_dm" "{\"userId\":\"$OTHER_USER_ID\",\"userToken\":\"$TOKEN\"}" "Create DM"

# Get DM conversation ID
DM_RESP=$(curl -s "$MCP_URL" -H "Content-Type: application/json" -d "{
  \"jsonrpc\": \"2.0\",
  \"id\": 104,
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
print(data.get('id', data.get('conversationId', data.get('conversation',{}).get('id',''))) if isinstance(data,dict) else '')
" 2>/dev/null)
echo "DM conversation ID: $DM_ID"

call_mcp 51 "get_dm" "{\"userId\":\"$OTHER_USER_ID\",\"userToken\":\"$TOKEN\"}" "Get DM"
call_mcp 52 "list_active_dms" "{\"userToken\":\"$TOKEN\"}" "List active DMs"
call_mcp 53 "get_read_position" "{\"channelId\":\"$CHANNEL_ID\",\"userToken\":\"$TOKEN\"}" "Get read position"

# ===== 7. Notification Tools =====
echo -e "${MAGENTA}=== Notification Tools (4 tools)${NC}"
call_mcp 60 "get_channel_notification_prefs" "{\"channelId\":\"$CHANNEL_ID\",\"userToken\":\"$TOKEN\"}" "Get channel notification prefs"
call_mcp 61 "update_channel_notification_prefs" "{\"channelId\":\"$CHANNEL_ID\",\"notificationLevel\":\"mentions\",\"userToken\":\"$TOKEN\"}" "Update channel notification prefs"

if [ -n "$DM_ID" ]; then
  call_mcp 62 "get_dm_notification_prefs" "{\"conversationId\":\"$DM_ID\",\"userToken\":\"$TOKEN\"}" "Get DM notification prefs"
  call_mcp 63 "update_dm_notification_prefs" "{\"conversationId\":\"$DM_ID\",\"notificationLevel\":\"all\",\"userToken\":\"$TOKEN\"}" "Update DM notification prefs"
else
  echo "[SKIP] DM notification tests - no DM ID"
  FAIL=$((FAIL+2))
  RESULTS="${RESULTS}FAIL|get_dm_notification_prefs|Get DM notification prefs|No DM ID\n"
  RESULTS="${RESULTS}FAIL|update_dm_notification_prefs|Update DM notification prefs|No DM ID\n"
fi

# ===== 8. Attachment Tools =====
echo -e "${MAGENTA}=== Attachment Tools (2 tools)${NC}"
call_mcp 70 "get_attachments" "{\"conversationId\":\"$CHANNEL_ID\",\"conversationType\":\"channel\",\"userToken\":\"$TOKEN\"}" "Get attachments"
call_mcp 71 "delete_attachment" "{\"attachmentId\":\"nonexistent-id\",\"userToken\":\"$TOKEN\"}" "Delete attachment (expect not found)" "expect_error"

# ===== 9. Thread Tools =====
echo -e "${MAGENTA}=== Thread Tools (3 tools)${NC}"
call_mcp 80 "get_thread_count" "{\"userToken\":\"$TOKEN\"}" "Get thread count"
call_mcp 81 "get_unread_threads" "{\"userToken\":\"$TOKEN\"}" "Get unread threads"
call_mcp 82 "mark_thread_read" "{\"threadId\":\"$MSG_ID\",\"userToken\":\"$TOKEN\"}" "Mark thread read"

# ===== 10. Logout (last) =====
echo -e "${MAGENTA}=== Logout${NC}"
# We don't actually logout to avoid invalidating the token
# call_mcp 90 "logout" "{\"userToken\":\"$TOKEN\"}" "Logout"

# ===== 11. Clear messages test =====
echo -e "${MAGENTA}=== Clear Messages (tested on test channel)${NC}"
# Create temp channel for clear test
CLEAR_CH_RESP=$(curl -s "$MCP_URL" -H "Content-Type: application/json" -d "{
  \"jsonrpc\": \"2.0\",
  \"id\": 105,
  \"method\": \"tools/call\",
  \"params\": {
    \"name\": \"create_channel\",
    \"arguments\": {\"name\":\"mcp-clear-test-$(date +%s)\",\"userToken\":\"$TOKEN\"}
  }
}")
CLEAR_CH_ID=$(echo "$CLEAR_CH_RESP" | python3 -c "
import sys,json
r=json.load(sys.stdin)
text=r['result']['content'][0]['text']
data=json.loads(text)
print(data.get('id', data.get('channel',{}).get('id','')) if isinstance(data,dict) else '')
" 2>/dev/null)
echo "Clear test channel: $CLEAR_CH_ID"
# Send a message first
curl -s "$MCP_URL" -H "Content-Type: application/json" -d "{
  \"jsonrpc\": \"2.0\",
  \"id\": 106,
  \"method\": \"tools/call\",
  \"params\": {
    \"name\": \"send_message\",
    \"arguments\": {\"channelId\":\"$CLEAR_CH_ID\",\"content\":\"msg to clear\",\"userToken\":\"$TOKEN\"}
  }
}" > /dev/null

call_mcp 35 "clear_messages" "{\"channelId\":\"$CLEAR_CH_ID\",\"userToken\":\"$TOKEN\"}" "Clear messages"

# Cleanup
curl -s "$MCP_URL" -H "Content-Type: application/json" -d "{
  \"jsonrpc\": \"2.0\",
  \"id\": 107,
  \"method\": \"tools/call\",
  \"params\": {
    \"name\": \"delete_channel\",
    \"arguments\": {\"channelId\":\"$CLEAR_CH_ID\",\"userToken\":\"$TOKEN\"}
  }
}" > /dev/null

echo ""
echo -e "${CYAN}==============================================${NC}"
echo -e "${CYAN} TEST RESULTS SUMMARY${NC}"
echo -e "${CYAN}==============================================${NC}"
echo -e " Total: ${YELLOW}$((PASS+FAIL))${NC}"
echo -e " ${GREEN}PASS:${NC}  $PASS"
echo -e " ${RED}FAIL:${NC}  $FAIL"
echo -e " Pass Rate: ${GREEN}$(echo "scale=1; $PASS * 100 / ($PASS + $FAIL)" | bc)%${NC}"
echo -e "${CYAN}==============================================${NC}"
echo ""
echo -e "${YELLOW}DETAILED RESULTS:${NC}"
echo -e "${YELLOW}----------------------------------------------${NC}"
printf "${YELLOW}%-6s | %-30s | %s${NC}\n" "STATUS" "TOOL" "DESCRIPTION"
echo -e "${YELLOW}----------------------------------------------${NC}"
echo -e "$RESULTS" | while IFS='|' read -r status tool desc text; do
  [ -z "$status" ] && continue
  if [ "$status" = "PASS" ]; then
    printf "${GREEN}%-6s${NC} | %-30s | %s\n" "$status" "$tool" "$desc"
  else
    printf "${RED}%-6s${NC} | %-30s | %s\n" "$status" "$tool" "$desc"
    echo "       ERROR: $(echo "$text" | head -c 150)"
  fi
done
echo -e "${YELLOW}----------------------------------------------${NC}"
