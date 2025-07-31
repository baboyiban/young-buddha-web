#!/bin/bash

# Young Buddha Web Server 중지 스크립트

echo "Stopping Young Buddha Web Server..."

# PID 파일에서 PID 읽기
PID_FILE="server.pid"
SERVER_PID=""

if [ -f "$PID_FILE" ]; then
    SERVER_PID=$(cat "$PID_FILE")
    echo "Found PID file: $SERVER_PID"
else
    echo "PID file not found: $PID_FILE"
fi

# PID 파일이 없거나 프로세스가 없으면 포트로 찾기
if [ -z "$SERVER_PID" ] || ! kill -0 "$SERVER_PID" 2>/dev/null; then
    echo "Looking for process on port 8080..."
    SERVER_PID=$(lsof -ti:8080 2>/dev/null)
    
    if [ -z "$SERVER_PID" ]; then
        echo "No server process found on port 8080"
        rm -f "$PID_FILE"
        exit 1
    fi
    
    echo "Found process: $SERVER_PID"
fi

# 프로세스 종료
echo "Killing process $SERVER_PID..."
kill "$SERVER_PID" 2>/dev/null

# 종료 확인
sleep 2
if kill -0 "$SERVER_PID" 2>/dev/null; then
    echo "Process still running, forcing kill..."
    kill -9 "$SERVER_PID"
    sleep 1
    
    if kill -0 "$SERVER_PID" 2>/dev/null; then
        echo "ERROR: Process $SERVER_PID could not be killed"
        exit 1
    else
        echo "Process killed successfully with -9"
    fi
else
    echo "Process stopped gracefully"
fi

# PID 파일 제거
rm -f "$PID_FILE"

echo "Server stopped successfully"
