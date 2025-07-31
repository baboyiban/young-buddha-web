#!/bin/bash
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR/.."
LOG_DIR="$PROJECT_ROOT/logs"
PID_FILE="$LOG_DIR/server.pid"

echo "서버 종료 중..."

# PID 파일이 있으면 먼저 시도
if [ -f "$PID_FILE" ]; then
  PID=$(cat "$PID_FILE")
  if kill -0 "$PID" 2>/dev/null; then
    echo "PID 파일에서 서버(PID: $PID)를 종료 중..."
    kill "$PID"
    sleep 2
    if kill -0 "$PID" 2>/dev/null; then
      echo "강제 종료 중..."
      kill -9 "$PID"
    fi
  fi
  rm -f "$PID_FILE"
fi

# pkill로 모든 young-buddha-web 프로세스 종료
echo "모든 young-buddha-web 프로세스를 종료 중..."
pkill -f "young-buddha-web" 2>/dev/null || true

# 추가로 zig run 프로세스도 종료
echo "zig run 프로세스를 종료 중..."
pkill -f "zig.*run" 2>/dev/null || true

echo "서버 종료 완료"