
#!/bin/bash
# =====================================================
# MCP Call Wrapper Library
# Provides convenient MCP tool call functions
# =====================================================

# MCP server address
MCP_URL="${MCP_URL:-http://localhost:3002/mcp/messages}"

# Global variables (only initialize if not defined)
: ${TOKEN:=}
: ${USER_ID:=}

# ---------------------------------------------------
# Helper function: Parse JSON response
# ---------------------------------------------------

# Extract token from login response
extract_token() {
  local response="$1"
  echo "$response" | python3 -c "
import sys, json
try:
  r = json.load(sys.stdin)
  t = json.loads(r['result']['content'][0]['text'])
  print(t.get('token', ''))
except:
  print('')
" 2>/dev/null
}

# Extract userId from response
extract_user_id() {
  local response="$1"
  echo "$response" | python3 -c "
import sys, json
try:
  r = json.load(sys.stdin)
  t = json.loads(r['result']['content'][0]['text'])
  print(t.get('userId', ''))
except:
  print('')
" 2>/dev/null
}

# Extract specified field from response
extract_field() {
  local response="$1"
  local field="$2"
  echo "$response" | python3 -c "
import sys, json
try:
  r = json.load(sys.stdin)
  t = json.loads(r['result']['content'][0]['text'])
  print(t.get('$field', ''))
except:
  print('')
" 2>/dev/null
}

# Extract array from response (e.g., channel list)
extract_array() {
  local response="$1"
  local field="$2"
  echo "$response" | python3 -c "
import sys, json
try:
  r = json.load(sys.stdin)
  t = json.loads(r['result']['content'][0]['text'])
  arr = t.get('$field', [])
  print(json.dumps(arr))
except:
  print('[]')
" 2>/dev/null
}

# Check if response has error
check_error() {
  local response="$1"
  local is_error=$(echo "$response" | python3 -c "
import sys, json
try:
  r = json.load(sys.stdin)
  print('ERROR' if r.get('result',{}).get('isError') or 'error' in r else 'OK')
except:
  print('ERROR')
" 2>/dev/null)
  [ "$is_error" = "ERROR" ]
}

# Get response text content
get_text() {
  local response="$1"
  echo "$response" | python3 -c "
import sys, json
try:
  r = json.load(sys.stdin)
  c = r.get('result',{}).get('content',[])
  if c:
    print(c[0]['text'])
  else:
    print(json.dumps(r.get('error',{})))
except:
  print('ERROR')
" 2>/dev/null
}

# ---------------------------------------------------
# Core function: Call MCP tool
# ---------------------------------------------------

# Call MCP tool (no token)
mcp_call_no_auth() {
  local tool="$1"
  local args="$2"

  local response
  response=$(curl -s "$MCP_URL" \
    -H "Content-Type: application/json" \
    -d "{
      \"jsonrpc\": \"2.0\",
      \"id\": $RANDOM,
      \"method\": \"tools/call\",
      \"params\": {
        \"name\": \"$tool\",
        \"arguments\": $args
      }
    }" 2>/dev/null)

  echo "$response"
}

# Call MCP tool (requires token)
mcp_call() {
  local tool="$1"
  local args="$2"

  local response
  response=$(curl -s "$MCP_URL" \
    -H "Content-Type: application/json" \
    -d "{
      \"jsonrpc\": \"2.0\",
      \"id\": $RANDOM,
      \"method\": \"tools/call\",
      \"params\": {
        \"name\": \"$tool\",
        \"arguments\": $args
      }
    }" 2>/dev/null)

  echo "$response"
}

# ---------------------------------------------------
# Authentication functions
# ---------------------------------------------------

# Login and set global TOKEN
mcp_login() {
  local email="$1"
  local password="$2"

  local response
  response=$(mcp_call_no_auth "login" "{\"email\":\"$email\",\"password\":\"$password\"}")

  if check_error "$response"; then
    return 1
  fi

  local token
  token=$(extract_token "$response")
  local user_id
  user_id=$(extract_user_id "$response")

  if [ -z "$token" ]; then
    return 1
  fi

  # Set global variables for all scenarios
  TOKEN="$token"
  USER_ID="$user_id"

  # Output token
  echo "$token"
  return 0
}

# Get current user info
mcp_get_me() {
  mcp_call "get_me" "{\"userToken\":\"$TOKEN\"}"
}

# Get profile
mcp_get_profile() {
  mcp_call "get_profile" "{\"userToken\":\"$TOKEN\"}"
}

# Update profile
mcp_update_profile() {
  local displayName="$1"
  mcp_call "update_profile" "{\"userToken\":\"$TOKEN\",\"displayName\":\"$displayName\"}"
}

# ---------------------------------------------------
# Channel functions
# ---------------------------------------------------

# List all channels
mcp_list_channels() {
  mcp_call "list_channels" "{\"userToken\":\"$TOKEN\"}"
}

# Get channel details
mcp_get_channel() {
  local channelId="$1"
  mcp_call "get_channel" "{\"userToken\":\"$TOKEN\",\"channelId\":\"$channelId\"}"
}

# Create channel
mcp_create_channel() {
  local name="$1"
  local description="${2:-}"
  mcp_call "create_channel" "{\"userToken\":\"$TOKEN\",\"name\":\"$name\",\"description\":\"$description\"}"
}

# Update channel
mcp_update_channel() {
  local channelId="$1"
  local name="$2"
  mcp_call "update_channel" "{\"userToken\":\"$TOKEN\",\"channelId\":\"$channelId\",\"name\":\"$name\"}"
}

# Delete channel
mcp_delete_channel() {
  local channelId="$1"
  mcp_call "delete_channel" "{\"userToken\":\"$TOKEN\",\"channelId\":\"$channelId\"}"
}

# Join channel
mcp_join_channel() {
  local channelId="$1"
  mcp_call "join_channel" "{\"userToken\":\"$TOKEN\",\"channelId\":\"$channelId\"}"
}

# Leave channel
mcp_leave_channel() {
  local channelId="$1"
  mcp_call "leave_channel" "{\"userToken\":\"$TOKEN\",\"channelId\":\"$channelId\"}"
}

# List channel members
mcp_list_channel_members() {
  local channelId="$1"
  mcp_call "list_channel_members" "{\"userToken\":\"$TOKEN\",\"channelId\":\"$channelId\"}"
}

# ---------------------------------------------------
# DM functions
# ---------------------------------------------------

# Create DM
mcp_create_dm() {
  local userId="$1"
  mcp_call "create_dm" "{\"userToken\":\"$TOKEN\",\"userId\":\"$userId\"}"
}

# Get DM
mcp_get_dm() {
  local dmId="$1"
  mcp_call "get_dm" "{\"userToken\":\"$TOKEN\",\"dmId\":\"$dmId\"}"
}

# List active DMs
mcp_list_active_dms() {
  mcp_call "list_active_dms" "{\"userToken\":\"$TOKEN\"}"
}

# ---------------------------------------------------
# Message functions
# ---------------------------------------------------

# List messages
mcp_list_messages() {
  local channelId="$1"
  local limit="${2:-20}"
  mcp_call "list_messages" "{\"userToken\":\"$TOKEN\",\"channelId\":\"$channelId\",\"limit\":$limit}"
}

# Send message
mcp_send_message() {
  local channelId="$1"
  local content="$2"
  mcp_call "send_message" "{\"userToken\":\"$TOKEN\",\"channelId\":\"$channelId\",\"content\":\"$content\"}"
}

# Send DM message
mcp_send_dm_message() {
  local dmId="$1"
  local content="$2"
  mcp_call "send_message" "{\"userToken\":\"$TOKEN\",\"dmId\":\"$dmId\",\"content\":\"$content\"}"
}

# Get message
mcp_get_message() {
  local messageId="$1"
  mcp_call "get_message" "{\"userToken\":\"$TOKEN\",\"messageId\":\"$messageId\"}"
}

# Update message
mcp_update_message() {
  local messageId="$1"
  local content="$2"
  mcp_call "update_message" "{\"userToken\":\"$TOKEN\",\"messageId\":\"$messageId\",\"content\":\"$content\"}"
}

# Delete message
mcp_delete_message() {
  local messageId="$1"
  mcp_call "delete_message" "{\"userToken\":\"$TOKEN\",\"messageId\":\"$messageId\"}"
}

# Reply to message (Thread)
mcp_reply_to_message() {
  local messageId="$1"
  local content="$2"
  mcp_call "reply_to_message" "{\"userToken\":\"$TOKEN\",\"parentMessageId\":\"$messageId\",\"content\":\"$content\"}"
}

# Get thread replies
mcp_get_thread_replies() {
  local messageId="$1"
  mcp_call "get_thread_replies" "{\"userToken\":\"$TOKEN\",\"parentMessageId\":\"$messageId\"}"
}

# Search messages
mcp_search_messages() {
  local query="$1"
  mcp_call "search_messages" "{\"userToken\":\"$TOKEN\",\"query\":\"$query\"}"
}

# Add reaction
mcp_add_reaction() {
  local messageId="$1"
  local emoji="$2"
  mcp_call "add_reaction" "{\"userToken\":\"$TOKEN\",\"messageId\":\"$messageId\",\"emoji\":\"$emoji\"}"
}

# Remove reaction
mcp_remove_reaction() {
  local messageId="$1"
  local emoji="$2"
  mcp_call "remove_reaction" "{\"userToken\":\"$TOKEN\",\"messageId\":\"$messageId\",\"emoji\":\"$emoji\"}"
}

# Get reactions
mcp_get_reactions() {
  local messageId="$1"
  mcp_call "get_reactions" "{\"userToken\":\"$TOKEN\",\"messageId\":\"$messageId\"}"
}

# Mark messages as read
mcp_mark_messages_read() {
  local channelId="$1"
  mcp_call "mark_messages_read" "{\"userToken\":\"$TOKEN\",\"channelId\":\"$channelId\"}"
}

# Mark all messages as read
mcp_mark_all_messages_read() {
  mcp_call "mark_all_messages_read" "{\"userToken\":\"$TOKEN\"}"
}

# ---------------------------------------------------
# User functions
# ---------------------------------------------------

# List users
mcp_list_users() {
  mcp_call "list_users" "{\"userToken\":\"$TOKEN\"}"
}

# Search users
mcp_search_users() {
  local query="$1"
  mcp_call "search_users" "{\"userToken\":\"$TOKEN\",\"query\":\"$query\"}"
}

# Get user
mcp_get_user() {
  local userId="$1"
  mcp_call "get_user" "{\"userToken\":\"$TOKEN\",\"userId\":\"$userId\"}"
}

# Get unread counts
mcp_get_unread_counts() {
  mcp_call "get_unread_counts" "{\"userToken\":\"$TOKEN\"}"
}

# ---------------------------------------------------
# Health check
# ---------------------------------------------------

# Health check
mcp_health_check() {
  mcp_call_no_auth "health_check" "{}"
}
