#!/bin/bash
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR/.."
LOG_DIR="$PROJECT_ROOT/logs"
LOG_FILE="$LOG_DIR/server.log"

mkdir -p "$LOG_DIR"

cd "$PROJECT_ROOT"

# Run the server in the background
zig build run > "$LOG_FILE" 2>&1 &
SERVER_PID=$!
echo $SERVER_PID > "$LOG_DIR/server.pid"

# Wait for the server to be ready
echo "서버를 시작하는 중입니다..."

# 로그에서 준비 완료 문구를 한 번만 대기하고 종료
if tail -n +1 -F "$LOG_FILE" 2>/dev/null | grep -m 1 "Server is ready to accept connections"; then
    echo "서버가 실행되었습니다. (PID: $SERVER_PID)"
fi
