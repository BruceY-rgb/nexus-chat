#!/bin/bash
# =====================================================
# Scenario 5: Message Interactions (Thread/Reaction)
# =====================================================

# Import dependencies
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib/colors.sh"
source "$SCRIPT_DIR/../lib/mcp.sh"

run_interactions_scenario() {
  print_section "Scenario 5: Message Interactions"

  # Get message ID saved from previous scenario
  local message_id
  if [ -f /tmp/demo_message_id ]; then
    message_id=$(cat /tmp/demo_message_id)
  fi

  if [ -z "$message_id" ]; then
    print_warning "Message ID not found, trying to create a new message..."

    # Get a channel
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
      print_error "Cannot get channel ID"
      return 1
    fi

    # Send a new message for interaction
    local new_msg_resp
    new_msg_resp=$(mcp_send_message "$channel_id" "This is a message for interaction test")
    message_id=$(extract_field "$new_msg_resp" "id")

    if [ -z "$message_id" ]; then
      print_error "Cannot send test message"
      return 1
    fi
  fi

  print_info "Using message ID: $message_id"

  # 1. Add emoji reaction
  print_step "1. Adding emoji reaction (thumbsup)..."
  local reaction_resp
  reaction_resp=$(mcp_add_reaction "$message_id" "thumbsup")

  if check_error "$reaction_resp"; then
    print_warning "Failed to add reaction"
  else
    print_success "Added thumbsup emoji"
  fi

  # 2. Get message reactions
  print_step "2. Getting message reaction list..."
  local reactions_resp
  reactions_resp=$(mcp_get_reactions "$message_id")

  local reactions_json
  reactions_json=$(extract_array "$reactions_resp" "reactions")

  local reaction_count
  reaction_count=$(echo "$reactions_json" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "0")

  print_success "Message has $reaction_count emoji reactions"

  # 3. Reply to message (Thread)
  print_step "3. Replying to message to create Thread..."
  local reply_content="This is a reply to the original message! Time: $(date +'%H:%M:%S')"
  local reply_resp
  reply_resp=$(mcp_reply_to_message "$message_id" "$reply_content")

  local reply_id
  reply_id=$(extract_field "$reply_resp" "id")

  if [ -n "$reply_id" ]; then
    print_success "Thread reply successful! ID: $reply_id"
  else
    print_warning "Thread reply may have failed"
  fi

  # 4. Get Thread replies
  if [ -n "$reply_id" ]; then
    print_step "4. Getting Thread replies..."
    local thread_resp
    thread_resp=$(mcp_get_thread_replies "$message_id")

    local replies_json
    replies_json=$(extract_array "$thread_resp" "replies")
    local reply_count
    reply_count=$(echo "$replies_json" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "0")

    print_success "Thread has $reply_count replies"
  fi

  # 5. Edit message
  print_step "5. Editing message content..."
  local edit_content="[Edited] This is an edited message - $(date +'%H:%M:%S')"
  local edit_resp
  edit_resp=$(mcp_update_message "$message_id" "$edit_content")

  local updated_content
  updated_content=$(extract_field "$edit_resp" "content")

  if [[ "$updated_content" == *"Edited"* ]]; then
    print_success "Message edited successfully: ${updated_content:0:50}..."
  else
    print_warning "Message edit result: $updated_content"
  fi

  # 6. Remove reaction (optional)
  print_step "6. Removing emoji reaction..."
  local remove_reaction_resp
  remove_reaction_resp=$(mcp_remove_reaction "$message_id" "thumbsup")

  if check_error "$remove_reaction_resp"; then
    print_warning "Removing reaction may have failed"
  else
    print_success "Removed thumbsup emoji"
  fi

  print_success "Scenario 5 complete!"
  return 0
}

# If running this script directly
if [ "${BASH_SOURCE[0]}" = "$0" ]; then
  run_interactions_scenario
fi
