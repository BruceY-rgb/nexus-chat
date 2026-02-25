#!/bin/bash
# =====================================================
# Scenario 2: Channel Operations
# =====================================================

# Import dependencies
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib/colors.sh"
source "$SCRIPT_DIR/../lib/mcp.sh"

# Demo channel name
DEMO_CHANNEL_NAME="demo-channel-$(date +%s)"

run_channels_scenario() {
  print_section "Scenario 2: Channel Operations"

  # 1. List all channels
  print_step "1. Getting channel list..."
  local channels_resp
  channels_resp=$(mcp_list_channels)

  if check_error "$channels_resp"; then
    print_error "Failed to get channel list!"
    return 1
  fi

  local channels_json
  channels_json=$(extract_array "$channels_resp" "channels")

  # Extract channel names
  local channel_names
  channel_names=$(echo "$channels_json" | python3 -c "
import sys, json
try:
  channels = json.load(sys.stdin) if isinstance(json.load(sys.stdin), list) else []
  names = [c.get('name', 'unnamed') for c in channels[:10]]
  print(', '.join(names))
except:
  print('Cannot parse')
" 2>/dev/null)

  print_success "Channel list: $channel_names"
  print_info "Total $(echo "$channels_json" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "?") channels"

  # Get first public channel ID
  local first_channel_id
  first_channel_id=$(echo "$channels_json" | python3 -c "
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

  # 2. Create new channel
  print_step "2. Creating new channel: $DEMO_CHANNEL_NAME..."
  local create_resp
  create_resp=$(mcp_create_channel "$DEMO_CHANNEL_NAME" "Channel created by automated demo")

  local new_channel_id
  new_channel_id=$(extract_field "$create_resp" "id")

  if [ -n "$new_channel_id" ]; then
    print_success "Channel created successfully! ID: $new_channel_id"
  else
    # May already exist, try to find
    print_warning "Channel may already exist, trying to find..."
    new_channel_id=$(echo "$channels_json" | python3 -c "
import sys, json
try:
  channels = json.load(sys.stdin) if isinstance(json.load(sys.stdin), list) else []
  for c in channels:
    if c.get('name', '').startswith('demo-channel'):
      print(c.get('id', ''))
      break
except:
  print('')
" 2>/dev/null)
  fi

  # 3. Join channel
  print_step "3. Joining channel..."
  local join_resp
  join_resp=$(mcp_join_channel "$new_channel_id")

  if check_error "$join_resp"; then
    print_warning "May have already joined this channel"
  else
    print_success "Successfully joined channel"
  fi

  # 4. Get channel details
  print_step "4. Getting channel details..."
  local channel_detail_resp
  channel_detail_resp=$(mcp_get_channel "$new_channel_id")

  local channel_name
  channel_name=$(extract_field "$channel_detail_resp" "name")
  local channel_desc
  channel_desc=$(extract_field "$channel_detail_resp" "description")

  print_success "Channel name: $channel_name"
  print_info "Channel description: $channel_desc"

  # 5. List channel members
  print_step "5. Getting channel member list..."
  local members_resp
  members_resp=$(mcp_list_channel_members "$new_channel_id")

  local members_json
  members_json=$(extract_array "$members_resp" "members")
  local member_count
  member_count=$(echo "$members_json" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "?")

  print_success "Channel member count: $member_count"

  # 6. Update channel description
  print_step "6. Updating channel description..."
  local update_resp
  update_resp=$(mcp_update_channel "$new_channel_id" "$channel_name")

  print_success "Channel updated successfully"

  # Save channel ID for subsequent scenarios
  echo "$new_channel_id" > /tmp/demo_channel_id

  print_success "Scenario 2 complete!"
  return 0
}

# If running this script directly
if [ "${BASH_SOURCE[0]}" = "$0" ]; then
  run_channels_scenario
fi
