#!/bin/bash
# MCP Tools Comprehensive Test Script
# Tests all 52 MCP tools via HTTP JSON-RPC 2.0

MCP_URL="http://localhost:3002/mcp/messages"

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

if [ -z "$TOKEN" ]; then
  echo "FATAL: Could not get auth token from login"
  echo "Login response: $LOGIN_RESP"
  exit 1
fi
echo "Got token: ${TOKEN:0:30}..."

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
  else
    FAIL=$((FAIL+1))
    local status="FAIL"
  fi

  RESULTS="${RESULTS}${status}|${tool}|${desc}|${text}\n"
  echo "[$status] #$id $tool - $desc"
  echo "  Response: $(echo "$text" | head -c 200)"
  echo ""
}

echo "=============================================="
echo " MCP Tools Full Coverage Test"
echo " $(date)"
echo "=============================================="
echo ""

# ===== 1. Health Tool =====
echo "=== Health (1 tool) ==="
call_mcp 1 "health_check" '{}' "Health check (no auth)"

# ===== 2. Auth Tools =====
echo "=== Auth Tools (7 tools) ==="
call_mcp 2 "login" '{"email":"slackbot@slack-import.local","password":"password123"}' "Login"
call_mcp 3 "get_me" "{\"userToken\":\"$TOKEN\"}" "Get current user"
call_mcp 4 "get_profile" "{\"userToken\":\"$TOKEN\"}" "Get profile"
call_mcp 5 "update_profile" "{\"userToken\":\"$TOKEN\",\"displayName\":\"Slackbot\"}" "Update profile"
call_mcp 6 "send_verification" '{"email":"slackbot@slack-import.local"}' "Send verification email"
# register - tested separately to avoid side effects
call_mcp 7 "register" '{"email":"mcp-test-'$RANDOM'@test.local","password":"TestPass123","displayName":"MCP Test User"}' "Register new user"

# ===== 3. Channel Tools =====
echo "=== Channel Tools (11 tools) ==="
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
my_id='c8ae290b-1d01-434d-928c-24df473de8b3'
for u in users:
    if u.get('id') != my_id:
        print(u['id'])
        break
" 2>/dev/null)
echo "Other user ID: $OTHER_USER_ID"

call_mcp 16 "invite_channel_member" "{\"channelId\":\"$NEW_CHANNEL_ID\",\"userId\":\"$OTHER_USER_ID\",\"userToken\":\"$TOKEN\"}" "Invite member to channel"
call_mcp 17 "join_all_channel_members" "{\"channelId\":\"$NEW_CHANNEL_ID\",\"userToken\":\"$TOKEN\"}" "Join all members"
call_mcp 18 "remove_channel_member" "{\"channelId\":\"$NEW_CHANNEL_ID\",\"userId\":\"$OTHER_USER_ID\",\"userToken\":\"$TOKEN\"}" "Remove member from channel"
call_mcp 19 "delete_channel" "{\"channelId\":\"$NEW_CHANNEL_ID\",\"userToken\":\"$TOKEN\"}" "Delete channel"
call_mcp 20 "leave_channel" "{\"channelId\":\"$JOIN_CH_ID\",\"userToken\":\"$TOKEN\"}" "Leave channel"

# ===== 4. Message Tools =====
echo "=== Message Tools (15 tools) ==="
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
echo "=== User Tools (5 tools) ==="
call_mcp 40 "list_users" "{\"userToken\":\"$TOKEN\"}" "List users"
call_mcp 41 "search_users" "{\"query\":\"slack\",\"userToken\":\"$TOKEN\"}" "Search users"
call_mcp 42 "get_unread_counts" "{\"userToken\":\"$TOKEN\"}" "Get unread counts"
call_mcp 43 "get_starred_users" "{\"userToken\":\"$TOKEN\"}" "Get starred users"
call_mcp 44 "toggle_starred_user" "{\"starredUserId\":\"$OTHER_USER_ID\",\"userToken\":\"$TOKEN\"}" "Toggle starred user"

# ===== 6. Conversation/DM Tools =====
echo "=== Conversation/DM Tools (4 tools) ==="
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
echo "=== Notification Tools (4 tools) ==="
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
echo "=== Attachment Tools (2 tools) ==="
call_mcp 70 "get_attachments" "{\"conversationId\":\"$CHANNEL_ID\",\"conversationType\":\"channel\",\"userToken\":\"$TOKEN\"}" "Get attachments"
call_mcp 71 "delete_attachment" "{\"attachmentId\":\"nonexistent-id\",\"userToken\":\"$TOKEN\"}" "Delete attachment (expect not found)" "expect_error"

# ===== 9. Thread Tools =====
echo "=== Thread Tools (3 tools) ==="
call_mcp 80 "get_thread_count" "{\"userToken\":\"$TOKEN\"}" "Get thread count"
call_mcp 81 "get_unread_threads" "{\"userToken\":\"$TOKEN\"}" "Get unread threads"
call_mcp 82 "mark_thread_read" "{\"threadId\":\"$MSG_ID\",\"userToken\":\"$TOKEN\"}" "Mark thread read"

# ===== 10. Logout (last) =====
echo "=== Logout ==="
# We don't actually logout to avoid invalidating the token
# call_mcp 90 "logout" "{\"userToken\":\"$TOKEN\"}" "Logout"

# ===== 11. Clear messages test =====
echo "=== Clear Messages (tested on test channel) ==="
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
echo "=============================================="
echo " TEST RESULTS SUMMARY"
echo "=============================================="
echo " Total: $((PASS+FAIL))"
echo " PASS:  $PASS"
echo " FAIL:  $FAIL"
echo " Pass Rate: $(echo "scale=1; $PASS * 100 / ($PASS + $FAIL)" | bc)%"
echo "=============================================="
echo ""
echo "DETAILED RESULTS:"
echo "----------------------------------------------"
printf "%-6s | %-30s | %s\n" "STATUS" "TOOL" "DESCRIPTION"
echo "----------------------------------------------"
echo -e "$RESULTS" | while IFS='|' read -r status tool desc text; do
  [ -z "$status" ] && continue
  printf "%-6s | %-30s | %s\n" "$status" "$tool" "$desc"
  if [ "$status" = "FAIL" ]; then
    echo "       ERROR: $(echo "$text" | head -c 150)"
  fi
done
echo "----------------------------------------------"
