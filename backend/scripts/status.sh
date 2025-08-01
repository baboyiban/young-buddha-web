#!/bin/bash
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR/.."
LOG_DIR="$PROJECT_ROOT/logs"
PID_FILE="$LOG_DIR/server.pid"

if [ -f "$PID_FILE" ]; then
  PID=$(cat "$PID_FILE")
  if kill -0 "$PID" 2>/dev/null; then
    echo "서버가 실행 중입니다. (PID: $PID)"
    exit 0
  else
    echo "서버가 실행 중이지 않습니다. (PID 파일만 존재)"
    exit 1
  fi
else
  echo "서버가 실행 중이지 않습니다."
  exit 1
fi