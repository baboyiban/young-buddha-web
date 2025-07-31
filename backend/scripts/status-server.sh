#!/bin/bash

# Young Buddha Web Server 상태 확인 스크립트

# 프로젝트 디렉토리로 이동
cd "$(dirname "$0")"

# 설정 파일 로드
if [ -f "server.conf" ]; then
    source server.conf
else
    DEFAULT_PORT=8080
    PID_FILE="logs/server.pid"
    LOG_FILE="logs/server.log"
    ERROR_LOG_FILE="logs/error.log"
fi

# 함수 정의
log_info() {
    echo "[INFO] $1"
}

log_error() {
    echo "[ERROR] $1" >&2
}

echo "Young Buddha Web Server Status"
echo "=============================="

# PID 파일 확인
if [ -f "$PID_FILE" ]; then
    SERVER_PID=$(cat "$PID_FILE")
    log_info "PID file exists: $SERVER_PID"
    
    if kill -0 "$SERVER_PID" 2>/dev/null; then
        log_info "Process is running"
        echo "Process details:"
        ps -p $SERVER_PID -o pid,ppid,etime,cmd 2>/dev/null || echo "Process info unavailable"
    else
        log_error "Process not running (stale PID file)"
    fi
else
    log_info "No PID file found"
fi

# 포트 확인
PORT_PID=$(lsof -ti:$DEFAULT_PORT 2>/dev/null)
if [ -n "$PORT_PID" ]; then
    log_info "Port $DEFAULT_PORT is in use by PID: $PORT_PID"
else
    log_info "Port $DEFAULT_PORT is available"
fi

# 로그 파일 상태
if [ -f "$LOG_FILE" ]; then
    LOG_SIZE=$(stat -f%z "$LOG_FILE" 2>/dev/null || echo 0)
    LOG_LINES=$(wc -l < "$LOG_FILE" 2>/dev/null || echo 0)
    log_info "Log file: $LOG_FILE (${LOG_SIZE} bytes, ${LOG_LINES} lines)"
    
    if [ $LOG_SIZE -gt 0 ]; then
        echo "Last 5 log entries:"
        tail -5 "$LOG_FILE" | sed 's/^/  /'
    fi
else
    log_info "No log file found"
fi

# 에러 로그 확인
if [ -f "$ERROR_LOG_FILE" ]; then
    ERROR_SIZE=$(stat -f%z "$ERROR_LOG_FILE" 2>/dev/null || echo 0)
    if [ $ERROR_SIZE -gt 0 ]; then
        log_error "Error log has content (${ERROR_SIZE} bytes)"
        echo "Recent errors:"
        tail -5 "$ERROR_LOG_FILE" | sed 's/^/  /'
    else
        log_info "Error log is empty"
    fi
else
    log_info "No error log found"
fi

# HTTP 응답 테스트
if command -v curl >/dev/null 2>&1; then
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 "http://localhost:$DEFAULT_PORT" 2>/dev/null || echo "000")
    if [ "$HTTP_CODE" != "000" ]; then
        log_info "HTTP response: $HTTP_CODE"
    else
        log_info "No HTTP response (server may be down)"
    fi
fi