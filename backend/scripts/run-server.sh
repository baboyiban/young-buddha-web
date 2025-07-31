#!/bin/bash

# Young Buddha Web Server - Simple Run Script

cd "$(dirname "$0")"

# 기본값 설정
PORT=8080
SERVER_BINARY="../zig-out/bin/young-buddha-web"
LOG_FILE="logs/server.log"
ERROR_LOG_FILE="logs/error.log"
PID_FILE="logs/server.pid"

echo "[INFO] Building server..."
zig build || { echo "[ERROR] Build failed"; exit 1; }
echo "[INFO] Build completed."

echo "[INFO] Checking environment variables..."
./check-env.sh

if [ ! -f "$SERVER_BINARY" ]; then
    echo "[ERROR] Server binary not found at $SERVER_BINARY"
    exit 1
fi

if [ -f "$PID_FILE" ]; then
    EXISTING_PID=$(cat "$PID_FILE")
    if kill -0 "$EXISTING_PID" 2>/dev/null; then
        echo "[ERROR] Server is already running with PID $EXISTING_PID"
        exit 1
    else
        rm -f "$PID_FILE"
    fi
fi

echo "[INFO] Starting server..."
$SERVER_BINARY > "$LOG_FILE" 2> "$ERROR_LOG_FILE" &
SERVER_PID=$!
echo $SERVER_PID > "$PID_FILE"
echo "[INFO] Server started with PID: $SERVER_PID"
