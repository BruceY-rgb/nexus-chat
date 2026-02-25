#!/bin/bash
# =====================================================
# Scenario 1: User Login and Profile
# =====================================================

# Import dependencies
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib/colors.sh"
source "$SCRIPT_DIR/../lib/mcp.sh"

# Test account (data imported from Slack)
DEMO_EMAIL="${DEMO_EMAIL:-slackbot@slack-import.local}"
DEMO_PASSWORD="${DEMO_PASSWORD:-password123}"

run_auth_scenario() {
  print_section "Scenario 1: User Login and Profile"

  # 1. Login
  print_step "1. Logging in..."
  TOKEN=$(mcp_login "$DEMO_EMAIL" "$DEMO_PASSWORD")
  local login_result=$?

  if [ $login_result -ne 0 ] || [ -z "$TOKEN" ]; then
    print_error "Login failed!"
    return 1
  fi

  print_success "Login successful! (Token: ${TOKEN:0:30}...)"
  print_info "User ID: $USER_ID"

  # 2. Get current user info
  print_step "2. Getting current user info..."
  local me_resp
  me_resp=$(mcp_get_me)

  local displayName
  displayName=$(extract_field "$me_resp" "displayName")
  local email
  email=$(extract_field "$me_resp" "email")

  print_success "Current user: $displayName <$email>"

  # 3. Get profile
  print_step "3. Getting profile..."
  local profile_resp
  profile_resp=$(mcp_get_profile)

  local realName
  realName=$(extract_field "$profile_resp" "realName")
  local avatarUrl
  avatarUrl=$(extract_field "$profile_resp" "avatarUrl")

  print_success "Real name: $realName"
  print_info "Avatar: ${avatarUrl:0:60}..."

  # 4. Update profile (optional)
  print_step "4. Updating display name to 'Demo User'..."
  local update_resp
  update_resp=$(mcp_update_profile "Demo User")

  local newDisplayName
  newDisplayName=$(extract_field "$update_resp" "displayName")

  if [ "$newDisplayName" = "Demo User" ]; then
    print_success "Display name updated to: $newDisplayName"
  else
    print_warning "Update response: $newDisplayName"
  fi

  print_success "Scenario 1 complete!"
  return 0
}

# If running this script directly
if [ "${BASH_SOURCE[0]}" = "$0" ]; then
  run_auth_scenario
fi
