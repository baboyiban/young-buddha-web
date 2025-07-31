#!/bin/bash

# Young Buddha Web Server 실행 스크립트

set -e

# 프로젝트 디렉토리로 이동
cd "$(dirname "$0")"

# 로그 파일 설정
LOG_FILE="server.log"
ERROR_LOG_FILE="error.log"
PID_FILE="server.pid"

# 이전 로그 파일 백업
if [ -f "$LOG_FILE" ]; then
    mv "$LOG_FILE" "${LOG_FILE}.old"
fi

if [ -f "$ERROR_LOG_FILE" ]; then
    mv "$ERROR_LOG_FILE" "${ERROR_LOG_FILE}.old"
fi

# 이전 PID 파일 제거
rm -f "$PID_FILE"

echo "Starting Young Buddha Web Server..."
echo "Build directory: $(pwd)/zig-out"
echo "Log file: $LOG_FILE"
echo "Error log file: $ERROR_LOG_FILE"
echo "PID file: $PID_FILE"
echo "----------------------------------------"

# 빌드
echo "Building server..."
zig build
echo "Build completed."

# 실행
echo "Starting server..."
PORT=${PORT:-8080}
export PORT

# 실제 서버 바이너리 확인
if [ ! -f "./zig-out/bin/young-buddha-web" ]; then
    echo "ERROR: Server binary not found at ./zig-out/bin/young-buddha-web"
    exit 1
fi

echo "Server binary found: ./zig-out/bin/young-buddha-web"

# 실제 서버 바이너리를 직접 실행
./zig-out/bin/young-buddha-web > "$LOG_FILE" 2> "$ERROR_LOG_FILE" &
SERVER_PID=$!

# PID 파일에 저장
echo $SERVER_PID > "$PID_FILE"

# 저장된 PID 확인
SAVED_PID=$(cat server.pid)
echo "Server PID saved: $SAVED_PID"

echo "Server started with PID: $SERVER_PID"
echo "Server is running on port $PORT"
echo "Logs are being written to $LOG_FILE and $ERROR_LOG_FILE"
echo "Use './stop-server.sh' to stop the server"
echo "----------------------------------------"

# 서버 상태 확인
sleep 3
if kill -0 $SERVER_PID 2>/dev/null; then
    echo "Server is running successfully!"
    echo "Process details:"
    ps -p $SERVER_PID -o pid,ppid,cmd
else
    echo "Server failed to start. Check the error logs:"
    echo "=== Error Log ==="
    cat "$ERROR_LOG_FILE" 2>/dev/null || echo "No error log"
    echo ""
    echo "=== Server Log ==="
    cat "$LOG_FILE" 2>/dev/null || echo "No server log"
    exit 1
fi
