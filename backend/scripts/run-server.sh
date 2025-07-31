#!/bin/bash

# Young Buddha Web Server 실행 스크립트

set -e

# 프로젝트 디렉토리로 이동
cd "$(dirname "$0")"

# 설정 파일 로드
if [ -f "server.conf" ]; then
    source server.conf
else
    echo "WARNING: server.conf not found, using defaults"
    DEFAULT_PORT=8080
    SERVER_BINARY="./zig-out/bin/young-buddha-web"
    LOG_FILE="logs/server.log"
    ERROR_LOG_FILE="logs/error.log"
    PID_FILE="logs/server.pid"
    STARTUP_WAIT=3
    BUILD_COMMAND="zig build"
fi

# 함수 정의
log_info() {
    echo "[INFO] $1"
}

log_error() {
    echo "[ERROR] $1" >&2
}

cleanup_on_exit() {
    # Only cleanup if we're exiting due to an error (not normal completion)
    if [ "$?" -ne 0 ] && [ -n "$SERVER_PID" ] && kill -0 "$SERVER_PID" 2>/dev/null; then
        log_info "Cleaning up server process $SERVER_PID due to error"
        kill "$SERVER_PID" 2>/dev/null || true
    fi
}

# Only trap on error, not normal exit
trap cleanup_on_exit ERR

# 기존 서버 프로세스 확인
if [ -f "$PID_FILE" ]; then
    EXISTING_PID=$(cat "$PID_FILE")
    if kill -0 "$EXISTING_PID" 2>/dev/null; then
        log_error "Server is already running with PID $EXISTING_PID"
        log_info "Use './stop-server.sh' to stop the existing server first"
        exit 1
    else
        log_info "Removing stale PID file"
        rm -f "$PID_FILE"
    fi
fi

# 로그 파일 로테이션
rotate_log() {
    local logfile=$1
    if [ -f "$logfile" ]; then
        # 파일 크기 확인 (10MB 이상이면 로테이션)
        if [ $(stat -f%z "$logfile" 2>/dev/null || echo 0) -gt 10485760 ]; then
            mv "$logfile" "${logfile}.$(date +%Y%m%d_%H%M%S)"
            log_info "Rotated log file: $logfile"
        fi
    fi
}

rotate_log "$LOG_FILE"
rotate_log "$ERROR_LOG_FILE"

log_info "Starting Young Buddha Web Server..."
log_info "Build directory: $(pwd)/zig-out"
log_info "Log file: $LOG_FILE"
log_info "Error log file: $ERROR_LOG_FILE"
log_info "PID file: $PID_FILE"
echo "----------------------------------------"

# 빌드
if [ "$USE_DEBUG_BUILD" = "1" ]; then
    log_info "Building server in DEBUG mode..."
    BUILD_CMD="$DEBUG_BUILD_COMMAND"
else
    log_info "Building server..."
    BUILD_CMD="$BUILD_COMMAND"
fi

if ! $BUILD_CMD; then
    log_error "Build failed"
    exit 1
fi
log_info "Build completed successfully"

# 환경변수 검증
log_info "Checking environment variables..."
./check-env.sh

# 서버 실행
log_info "Starting server..."
PORT=${PORT:-$DEFAULT_PORT}
export PORT

# 서버 바이너리 확인
if [ ! -f "$SERVER_BINARY" ]; then
    log_error "Server binary not found at $SERVER_BINARY"
    exit 1
fi

log_info "Server binary found: $SERVER_BINARY"

# 포트 사용 중인지 확인
if lsof -ti:$PORT >/dev/null 2>&1; then
    log_error "Port $PORT is already in use"
    exit 1
fi

# 서버 실행
$SERVER_BINARY > "$LOG_FILE" 2> "$ERROR_LOG_FILE" &
SERVER_PID=$!

# PID 파일에 저장
echo $SERVER_PID > "$PID_FILE"

log_info "Server started with PID: $SERVER_PID"
log_info "Server is running on port $PORT"
log_info "Logs: $LOG_FILE | Errors: $ERROR_LOG_FILE"
log_info "Use './stop-server.sh' to stop the server"
echo "----------------------------------------"

# 서버 상태 확인
log_info "Waiting ${STARTUP_WAIT}s for server to start..."
sleep $STARTUP_WAIT

if kill -0 $SERVER_PID 2>/dev/null; then
    log_info "Server is running successfully!"
    log_info "Process details:"
    ps -p $SERVER_PID -o pid,ppid,cmd 2>/dev/null || echo "Process info unavailable"
    
    # 간단한 헬스체크
    if command -v curl >/dev/null 2>&1; then
        if curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT" | grep -q "200\|404"; then
            log_info "Server is responding to HTTP requests"
        fi
    fi
else
    log_error "Server failed to start"
    log_error "=== Error Log ==="
    tail -20 "$ERROR_LOG_FILE" 2>/dev/null || echo "No error log available"
    echo ""
    log_error "=== Server Log ==="
    tail -20 "$LOG_FILE" 2>/dev/null || echo "No server log available"
    rm -f "$PID_FILE"
    exit 1
fi
