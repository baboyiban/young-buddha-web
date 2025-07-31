#!/bin/bash

# Young Buddha Web Server 디버그 모드 실행 스크립트

# 환경변수로 디버그 빌드 사용
export USE_DEBUG_BUILD=1

# 기존 run-server.sh 실행
exec ./run-server.sh