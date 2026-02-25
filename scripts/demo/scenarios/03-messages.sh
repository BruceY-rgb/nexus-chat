#!/bin/bash
# =====================================================
# Scenario 3: Send and Receive Messages
# =====================================================

# Import dependencies
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib/colors.sh"
source "$SCRIPT_DIR/../lib/mcp.sh"

# Demo message content
DEMO_MESSAGE="This is a message from automated demo! Time: $(date +'%H:%M:%S')"

run_messages_scenario() {
  print_section "Scenario 3: Send and Receive Messages"

  # 1. List channel messages (get a valid channel ID)
  print_step "1. Getting channel list to find available channel..."
  local channels_resp
  channels_resp=$(mcp_list_channels)

  local channels_json
  channels_json=$(extract_array "$channels_resp" "channels")

  local channel_id
  channel_id=$(echo "$channels_json" | python3 -c "
import sys, json
try:
  channels = json.load(sys.stdin) if isinstance(json.load(sys.stdin), list) else []
  for c in channels:
    if not c.get('isPrivate', False):
      print(c.get('id', ''))
      break
except:
  print('')
" 2>/dev/null)

  if [ -z "$channel_id" ]; then
    print_error "No available channel found"
    return 1
  fi

  print_success "Using channel ID: $channel_id"

  # 2. List channel history messages
  print_step "2. Getting channel history messages..."
  local messages_resp
  messages_resp=$(mcp_list_messages "$channel_id" 10)

  local messages_json
  messages_json=$(extract_array "$messages_resp" "messages")
  local message_count
  message_count=$(echo "$messages_json" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "0")

  print_success "Retrieved $message_count historical messages"

  # Extract last message ID for subsequent operations
  local last_message_id
  last_message_id=$(echo "$messages_json" | python3 -c "
import sys, json
try:
  msgs = json.load(sys.stdin) if isinstance(json.load(sys.stdin), list) else []
  if msgs:
    print(msgs[0].get('id', ''))
except:
  print('')
" 2>/dev/null)

  # 3. Send text message
  print_step "3. Sending text message..."
  local send_resp
  send_resp=$(mcp_send_message "$channel_id" "$DEMO_MESSAGE")

  local sent_message_id
  sent_message_id=$(extract_field "$send_resp" "id")

  if [ -n "$sent_message_id" ]; then
    print_success "Message sent successfully! ID: $sent_message_id"
  else
    print_error "Message sending failed"
    print_debug "Response: $send_resp"
    return 1
  fi

  # 4. Search messages
  print_step "4. Searching message keywords..."
  local search_resp
  search_resp=$(mcp_search_messages "demo")

  local search_results_json
  search_results_json=$(extract_array "$search_resp" "results")
  local search_count
  search_count=$(echo "$search_results_json" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "0")

  print_success "Found $search_count messages containing 'demo'"

  # 5. Get just sent message details
  print_step "5. Getting just sent message details..."
  local get_msg_resp
  get_msg_resp=$(mcp_get_message "$sent_message_id")

  local msg_content
  msg_content=$(extract_field "$get_msg_resp" "content")
  local msg_created_at
  msg_created_at=$(extract_field "$get_msg_resp" "createdAt")

  print_success "Message content: ${msg_content:0:50}..."
  print_info "Created at: $msg_created_at"

  # 6. Demonstrate @mention (if other users can be found)
  print_step "6. Trying to send @mention message..."

  # First search for some users
  local users_resp
  users_resp=$(mcp_list_users)
  local users_json
  users_json=$(extract_array "$users_resp" "users")

  # Get first other user's ID
  local mentioned_user_id
  mentioned_user_id=$(echo "$users_json" | python3 -c "
import sys, json
try:
  users = json.load(sys.stdin) if isinstance(json.load(sys.stdin), list) else []
  for u in users:
    if u.get('id', '') != '$USER_ID':
      print(u.get('id', ''))
      break
except:
  print('')
" 2>/dev/null)

  if [ -n "$mentioned_user_id" ]; then
    local mention_msg="@user This is a mention message!"
    local mention_resp
    mention_resp=$(mcp_send_message "$channel_id" "$mention_msg")
    print_success "@mention message sent successfully"
  else
    print_warning "No other users found, skipping @mention demo"
  fi

  # Save message ID for subsequent scenarios
  echo "$sent_message_id" > /tmp/demo_message_id

  print_success "Scenario 3 complete!"
  return 0
}

# If running this script directly
if [ "${BASH_SOURCE[0]}" = "$0" ]; then
  run_messages_scenario
fi
