#!/bin/bash

# Young Buddha Web Server - Status Script

cd "$(dirname "$0")"
mkdir -p logs

PORT=8080
PID_FILE="logs/server.pid"
LOG_FILE="logs/server.log"
ERROR_LOG_FILE="logs/error.log"

echo "=== Young Buddha Web Server Status ==="

# 1. 프로세스 상태
if [ -f "$PID_FILE" ]; then
    SERVER_PID=$(cat "$PID_FILE")
    if kill -0 "$SERVER_PID" 2>/dev/null; then
        echo "[RUNNING] PID: $SERVER_PID"
        ps -p $SERVER_PID -o pid,ppid,etime,cmd
    else
        echo "[STALE PID] $SERVER_PID (프로세스 없음)"
    fi
else
    echo "[STOPPED] No PID file found"
fi

# 2. 포트 상태
PORT_PID=$(lsof -ti:$PORT 2>/dev/null)
if [ -n "$PORT_PID" ]; then
    echo "[PORT] $PORT is in use by PID: $PORT_PID"
else
    echo "[PORT] $PORT is available"
fi

# 3. 최근 로그
if [ -f "$LOG_FILE" ]; then
    echo "--- Last 5 log entries ---"
    tail -5 "$LOG_FILE"
else
    echo "[LOG] No log file found"
fi

# 4. 최근 에러 로그
if [ -f "$ERROR_LOG_FILE" ]; then
    if [ -s "$ERROR_LOG_FILE" ]; then
        echo "--- Last 5 error log entries ---"
        tail -5 "$ERROR_LOG_FILE"
    else
        echo "[ERROR LOG] Error log is empty"
    fi
else
    echo "[ERROR LOG] No error log found"
fi

# 5. HTTP 응답 확인
if command -v curl >/dev/null 2>&1; then
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 3 "http://localhost:$PORT")
    echo "[HTTP] Response code: $HTTP_CODE"
fi