#!/bin/bash

# Young Buddha Web Server 중지 스크립트

# 프로젝트 디렉토리로 이동
cd "$(dirname "$0")"

# 설정 파일 로드
if [ -f "server.conf" ]; then
    source server.conf
else
    echo "WARNING: server.conf not found, using defaults"
    DEFAULT_PORT=8080
    PID_FILE="logs/server.pid"
    SHUTDOWN_WAIT=2
    FORCE_KILL_WAIT=1
fi

# 함수 정의
log_info() {
    echo "[INFO] $1"
}

log_error() {
    echo "[ERROR] $1" >&2
}

log_info "Stopping Young Buddha Web Server..."

# PID 파일에서 PID 읽기
SERVER_PID=""

if [ -f "$PID_FILE" ]; then
    SERVER_PID=$(cat "$PID_FILE")
    log_info "Found PID file: $SERVER_PID"
else
    log_info "PID file not found: $PID_FILE"
fi

# PID 파일이 없거나 프로세스가 없으면 포트로 찾기
if [ -z "$SERVER_PID" ] || ! kill -0 "$SERVER_PID" 2>/dev/null; then
    log_info "Looking for process on port $DEFAULT_PORT..."
    SERVER_PID=$(lsof -ti:$DEFAULT_PORT 2>/dev/null)
    
    if [ -z "$SERVER_PID" ]; then
        log_info "No server process found on port $DEFAULT_PORT"
        rm -f "$PID_FILE"
        log_info "Server is not running"
        exit 0
    fi
    
    log_info "Found process: $SERVER_PID"
fi

# 프로세스 종료
log_info "Terminating process $SERVER_PID..."
if kill "$SERVER_PID" 2>/dev/null; then
    log_info "Sent TERM signal to process"
else
    log_error "Failed to send TERM signal"
fi

# 종료 확인
log_info "Waiting ${SHUTDOWN_WAIT}s for graceful shutdown..."
sleep $SHUTDOWN_WAIT

if kill -0 "$SERVER_PID" 2>/dev/null; then
    log_info "Process still running, sending KILL signal..."
    kill -9 "$SERVER_PID" 2>/dev/null
    sleep $FORCE_KILL_WAIT
    
    if kill -0 "$SERVER_PID" 2>/dev/null; then
        log_error "Process $SERVER_PID could not be killed"
        exit 1
    else
        log_info "Process terminated with KILL signal"
    fi
else
    log_info "Process stopped gracefully"
fi

# PID 파일 제거
rm -f "$PID_FILE"

log_info "Server stopped successfully"
