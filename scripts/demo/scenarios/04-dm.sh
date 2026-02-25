#!/bin/bash
# =====================================================
# Scenario 4: Private Message (DM)
# =====================================================

# Import dependencies
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib/colors.sh"
source "$SCRIPT_DIR/../lib/mcp.sh"

run_dm_scenario() {
  print_section "Scenario 4: Private Message (DM)"

  # 1. List all users
  print_step "1. Getting user list..."
  local users_resp
  users_resp=$(mcp_list_users)

  local users_json
  users_json=$(extract_array "$users_resp" "users")

  # Exclude current user
  local other_users_json
  other_users_json=$(echo "$users_json" | python3 -c "
import sys, json
try:
  users = json.load(sys.stdin) if isinstance(json.load(sys.stdin), list) else []
  other = [u for u in users if u.get('id', '') != '$USER_ID']
  print(json.dumps(other[:5]))
except:
  print('[]')
" 2>/dev/null)

  local user_count
  user_count=$(echo "$other_users_json" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "0")

  print_success "Found $user_count other users"

  # Get first other user's ID
  local target_user_id
  target_user_id=$(echo "$other_users_json" | python3 -c "
import sys, json
try:
  users = json.load(sys.stdin) if isinstance(json.load(sys.stdin), list) else []
  if users:
    print(users[0].get('id', ''))
except:
  print('')
" 2>/dev/null)

  local target_user_name
  target_user_name=$(echo "$other_users_json" | python3 -c "
import sys, json
try:
  users = json.load(sys.stdin) if isinstance(json.load(sys.stdin), list) else []
  if users:
    print(users[0].get('displayName', users[0].get('email', 'Unknown')))
except:
  print('Unknown')
" 2>/dev/null)

  if [ -z "$target_user_id" ]; then
    print_error "No other users found, cannot create DM"
    return 1
  fi

  print_info "Target user: $target_user_name (ID: $target_user_id)"

  # 2. Create DM
  print_step "2. Creating DM session..."
  local create_dm_resp
  create_dm_resp=$(mcp_create_dm "$target_user_id")

  local dm_id
  dm_id=$(extract_field "$create_dm_resp" "id")

  if [ -z "$dm_id" ]; then
    # May already exist, try to list
    print_warning "Failed to create DM, trying to find existing DM..."
    local dms_resp
    dms_resp=$(mcp_list_active_dms)

    local dms_json
    dms_json=$(extract_array "$dms_resp" "dms")

    dm_id=$(echo "$dms_json" | python3 -c "
import sys, json
try:
  dms = json.load(sys.stdin) if isinstance(json.load(sys.stdin), list) else []
  for dm in dms:
    members = dm.get('members', [])
    for m in members:
      if m.get('user', {}).get('id', '') == '$target_user_id':
        print(dm.get('id', ''))
        break
except:
  print('')
" 2>/dev/null)
  fi

  if [ -z "$dm_id" ]; then
    print_error "Cannot create or find DM session"
    return 1
  fi

  print_success "DM created successfully! DM ID: $dm_id"

  # 3. Get DM details
  print_step "3. Getting DM details..."
  local dm_detail_resp
  dm_detail_resp=$(mcp_get_dm "$dm_id")

  local dm_members_json
  dm_members_json=$(extract_array "$dm_detail_resp" "members")
  local member_count
  member_count=$(echo "$dm_members_json" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "0")

  print_success "DM member count: $member_count"

  # 4. Send DM message
  print_step "4. Sending DM message..."
  local dm_message="Hello! This is a DM message from automated demo! Time: $(date +'%H:%M:%S')"
  local send_dm_resp
  send_dm_resp=$(mcp_send_dm_message "$dm_id" "$dm_message")

  local dm_msg_id
  dm_msg_id=$(extract_field "$send_dm_resp" "id")

  if [ -n "$dm_msg_id" ]; then
    print_success "DM message sent successfully! ID: $dm_msg_id"
  else
    print_error "DM message sending failed"
    return 1
  fi

  # 5. List active DMs
  print_step "5. Getting active DM list..."
  local active_dms_resp
  active_dms_resp=$(mcp_list_active_dms)

  local active_dms_json
  active_dms_json=$(extract_array "$active_dms_resp" "dms")
  local active_dm_count
  active_dm_count=$(echo "$active_dms_json" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "0")

  print_success "Current active DM count: $active_dm_count"

  # Save DM ID for subsequent scenarios
  echo "$dm_id" > /tmp/demo_dm_id

  print_success "Scenario 4 complete!"
  return 0
}

# If running this script directly
if [ "${BASH_SOURCE[0]}" = "$0" ]; then
  run_dm_scenario
fi
