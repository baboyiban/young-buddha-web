#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/scripts" && pwd)"

case "$1" in
  start)
    bash "$SCRIPT_DIR/start.sh"
    ;;
  stop)
    bash "$SCRIPT_DIR/stop.sh"
    ;;
  status)
    bash "$SCRIPT_DIR/status.sh"
    ;;
  logs)
    bash "$SCRIPT_DIR/logs.sh"
    ;;
  help|--help|-h)
    bash "$SCRIPT_DIR/help.sh"
    ;;
  *)
    bash "$SCRIPT_DIR/help.sh"
    exit 1
    ;;
esac