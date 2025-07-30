#!/bin/bash

# Young Buddha Web Server 실행 스크립트

set -e

# 프로젝트 디렉토리로 이동
cd "$(dirname "$0")"

# 로그 파일 설정
LOG_FILE="server.log"
ERROR_LOG_FILE="error.log"

# 이전 로그 파일 백업
if [ -f "$LOG_FILE" ]; then
    mv "$LOG_FILE" "${LOG_FILE}.old"
fi

if [ -f "$ERROR_LOG_FILE" ]; then
    mv "$ERROR_LOG_FILE" "${ERROR_LOG_FILE}.old"
fi

echo "Starting Young Buddha Web Server..."
echo "Build directory: $(pwd)/zig-out"
echo "Log file: $LOG_FILE"
echo "Error log file: $ERROR_LOG_FILE"
echo "----------------------------------------"

# 빌드
echo "Building server..."
zig build
echo "Build completed."

# 실행
echo "Starting server..."
zig build run > "$LOG_FILE" 2> "$ERROR_LOG_FILE" &

# 프로세스 ID 저장
SERVER_PID=$!
echo $SERVER_PID > server.pid

echo "Server started with PID: $SERVER_PID"
echo "Server is running on port 8080"
echo "Logs are being written to $LOG_FILE and $ERROR_LOG_FILE"
echo "Use 'kill $SERVER_PID' to stop the server"
echo "----------------------------------------"

# 서버 상태 확인
sleep 2
if kill -0 $SERVER_PID 2>/dev/null; then
    echo "Server is running successfully!"
else
    echo "Server failed to start. Check the error logs:"
    echo "=== Error Log ==="
    cat "$ERROR_LOG_FILE"
    exit 1
fi
