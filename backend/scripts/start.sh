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
timeout 60s tail -f "$LOG_FILE" | while read LOGLINE
do
    echo "$LOGLINE"
    if [[ "$LOGLINE" == *"Server is ready to accept connections"* ]]; then
        echo "서버가 실행되었습니다. (PID: $SERVER_PID)"
        pkill -P $ tail
    fi
done
