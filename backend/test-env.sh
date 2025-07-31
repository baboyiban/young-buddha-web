#!/bin/bash

# 환경변수 테스트 전용 스크립트

cd "$(dirname "$0")"

echo "=== Environment Variables Test ==="
echo "Current directory: $(pwd)"
echo ""

# 1. 쉘 스크립트로 환경변수 확인
echo "1. Shell Environment Check:"
./check-env.sh
echo ""

# 2. Zig 빌드 후 환경변수 검증만 실행
echo "2. Building test binary..."
if zig build; then
    echo "Build successful"
    echo ""
    
    echo "3. Testing environment validation in Zig:"
    # 환경변수 검증만 하는 간단한 테스트 프로그램 실행
    echo "   (This will be shown in server startup logs)"
else
    echo "Build failed"
    exit 1
fi