#!/bin/bash

# Young Buddha Web Server 중지 스크립트

# PID 파일 확인
PID_FILE="server.pid"

if [ ! -f "$PID_FILE" ]; then
    echo "Server is not running (no PID file found)"
    exit 1
fi

# PID 읽기
SERVER_PID=$(cat "$PID_FILE")

if [ -z "$SERVER_PID" ]; then
    echo "Invalid PID file"
    exit 1
fi

# 프로세스 존재 여부 확인
if ! kill -0 $SERVER_PID 2>/dev/null; then
    echo "Server is not running (process $SERVER_PID not found)"
    rm -f "$PID_FILE"
    exit 1
fi

echo "Stopping server with PID: $SERVER_PID"

# 우아한 종료 시도 (SIGTERM)
echo "Sending SIGTERM..."
kill -TERM $SERVER_PID

# 종료 대기
for i in {1..10}; do
    if ! kill -0 $SERVER_PID 2>/dev/null; then
        echo "Server stopped successfully"
        rm -f "$PID_FILE"
        exit 0
    fi
    echo "Waiting for server to stop... ($i/10)"
    sleep 1
done

# 강제 종료 (SIGKILL)
echo "Server did not stop gracefully, sending SIGKILL..."
kill -KILL $SERVER_PID

# PID 파일 제거
rm -f "$PID_FILE"

echo "Server stopped forcefully"
