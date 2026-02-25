#!/bin/bash
# =====================================================
# Slack Automation Demo Main Entry
# =====================================================

# Ensure running in correct directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Import dependencies
source "$SCRIPT_DIR/lib/colors.sh"
source "$SCRIPT_DIR/lib/mcp.sh"

# Configuration
DEMO_EMAIL="${DEMO_EMAIL:-slackbot@slack-import.local}"
DEMO_PASSWORD="${DEMO_PASSWORD:-password123}"

# ---------------------------------------------------
# Help information
# ---------------------------------------------------

show_help() {
  cat << EOF
Slack Automation Demo Script

Usage: $0 [options]

Options:
  -h, --help           Show help information
  -e, --email EMAIL    Specify login email (default: $DEMO_EMAIL)
  -p, --password PASS  Specify login password (default: $DEMO_PASSWORD)
  --skip-auth          Skip auth scenario
  --skip-channels      Skip channels scenario
  --skip-messages      Skip messages scenario
  --skip-dm            Skip DM scenario
  --skip-interactions  Skip interactions scenario
  --single SCENARIO    Run single scenario (auth|channels|messages|dm|interactions)
  --list               List all available scenarios

Examples:
  $0                           # Run full demo
  $0 --single messages        # Run only messages scenario
  $0 -e alice@chat.com       # Use specified account

EOF
}

# ---------------------------------------------------
# Scenario functions
# ---------------------------------------------------

run_scenario() {
  local scenario=$1
  local script="$SCRIPT_DIR/scenarios/${scenario}.sh"

  if [ ! -f "$script" ]; then
    print_error "Scenario script not found: $script"
    return 1
  fi

  # Save main script's SCRIPT_DIR
  local main_script_dir="$SCRIPT_DIR"

  source "$script"

  # Restore main script's SCRIPT_DIR
  SCRIPT_DIR="$main_script_dir"

  case $scenario in
    01-auth)
      run_auth_scenario
      ;;
    02-channels)
      run_channels_scenario
      ;;
    03-messages)
      run_messages_scenario
      ;;
    04-dm)
      run_dm_scenario
      ;;
    05-interactions)
      run_interactions_scenario
      ;;
    *)
      print_error "Unknown scenario: $scenario"
      return 1
      ;;
  esac
}

# ---------------------------------------------------
# Main function
# ---------------------------------------------------

main() {
  local skip_auth=false
  local skip_channels=false
  local skip_messages=false
  local skip_dm=false
  local skip_interactions=false
  local single_scenario=""

  # Parse arguments
  while [[ $# -gt 0 ]]; do
    case $1 in
      -h|--help)
        show_help
        exit 0
        ;;
      -e|--email)
        DEMO_EMAIL="$2"
        shift 2
        ;;
      -p|--password)
        DEMO_PASSWORD="$2"
        shift 2
        ;;
      --skip-auth)
        skip_auth=true
        shift
        ;;
      --skip-channels)
        skip_channels=true
        shift
        ;;
      --skip-messages)
        skip_messages=true
        shift
        ;;
      --skip-dm)
        skip_dm=true
        shift
        ;;
      --skip-interactions)
        skip_interactions=true
        shift
        ;;
      --single)
        single_scenario="$2"
        shift 2
        ;;
      --list)
        echo "Available scenarios:"
        ls -1 "$SCRIPT_DIR/scenarios/"
        exit 0
        ;;
      *)
        print_error "Unknown option: $1"
        show_help
        exit 1
        ;;
    esac
  done

  # Print title
  print_title "=============================================="
  print_title " Slack Feature Automation Demo"
  print_title " $(date '+%Y-%m-%d %H:%M:%S')"
  print_title "=============================================="
  echo ""
  print_info "Demo account: $DEMO_EMAIL"
  print_info "MCP URL: $MCP_URL"
  echo ""

  # Check if MCP service is available
  print_step "Checking MCP service status..."
  local health_resp
  health_resp=$(mcp_health_check)

  if check_error "$health_resp"; then
    print_error "MCP service is not available!"
    print_info "Make sure MCP server is running (localhost:3002)"
    exit 1
  fi
  print_success "MCP service is running"
  echo ""

  # Run single scenario
  if [ -n "$single_scenario" ]; then
    case $single_scenario in
      auth)
        run_scenario "01-auth"
        exit $?
        ;;
      channels)
        run_scenario "02-channels"
        exit $?
        ;;
      messages)
        run_scenario "03-messages"
        exit $?
        ;;
      dm)
        run_scenario "04-dm"
        exit $?
        ;;
      interactions)
        run_scenario "05-interactions"
        exit $?
        ;;
      *)
        print_error "Unknown scenario: $single_scenario"
        exit 1
        ;;
    esac
  fi

  # Run full demo flow
  local total=5
  local current=0

  # Scenario 1: Auth
  current=$((current + 1))
  if [ "$skip_auth" = "true" ]; then
    print_warning "[$current/$total] Skipping auth scenario"
  else
    run_scenario "01-auth"
    if [ $? -ne 0 ]; then
      print_error "Auth scenario failed, demo terminated"
      exit 1
    fi
  fi
  echo ""

  # Scenario 2: Channels
  current=$((current + 1))
  if [ "$skip_channels" = "true" ]; then
    print_warning "[$current/$total] Skipping channels scenario"
  else
    run_scenario "02-channels"
    # Channel scenario failure does not terminate demo
  fi
  echo ""

  # Scenario 3: Messages
  current=$((current + 1))
  if [ "$skip_messages" = "true" ]; then
    print_warning "[$current/$total] Skipping messages scenario"
  else
    run_scenario "03-messages"
  fi
  echo ""

  # Scenario 4: DM
  current=$((current + 1))
  if [ "$skip_dm" = "true" ]; then
    print_warning "[$current/$total] Skipping DM scenario"
  else
    run_scenario "04-dm"
  fi
  echo ""

  # Scenario 5: Interactions
  current=$((current + 1))
  if [ "$skip_interactions" = "true" ]; then
    print_warning "[$current/$total] Skipping interactions scenario"
  else
    run_scenario "05-interactions"
  fi
  echo ""

  # Complete
  print_title "=============================================="
  print_success "Demo complete!"
  print_title "=============================================="
  echo ""
  print_info "Tip: Use --single <scenario> to run a single scenario"
  print_info "      Use --list to view all available scenarios"
}

# Run main function
main "$@"
