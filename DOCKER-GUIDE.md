# Young Buddha Web - Docker 사용 가이드

## 🐳 Docker 환경 개요

이 프로젝트는 개발(development)과 프로덕션(production) 환경을 완전히 분리된 Docker 설정으로 제공합니다.

### 환경별 특징

| 기능 | 개발 환경 | 프로덕션 환경 |
|------|-----------|---------------|
| 핫 리로딩 | ✅ 지원 | ❌ 미지원 |
| 디버그 로깅 | ✅ 상세 로그 | ⚡ 정보 로그 |
| 소스 코드 마운트 | ✅ 실시간 반영 | ❌ 빌드된 이미지 |
| 보안 설정 | 🛡️ 기본 보안 | 🔒 강화된 보안 |
| 사용자 권한 | root | non-root |
| 이미지 크기 | 큰 (~1GB) | 작은 (~100MB) |

## 🚀 빠른 시작

### 개발 환경 실행

```bash
# 방법 1: Makefile 사용 (권장)
make dev

# 방법 2: 스크립트 사용
./scripts/dev.sh

# 방법 3: 직접 Docker 명령어
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

### 프로덕션 환경 실행

```bash
# 방법 1: Makefile 사용 (권장)
make prod

# 방법 2: 스크립트 사용
./scripts/prod.sh

# 방법 3: 직접 Docker 명령어
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d
```

## 📋 Makefile 명령어

```bash
make dev           # 개발 환경 시작
make prod          # 프로덕션 환경 시작 (데몬 모드)
make stop          # 모든 컨테이너 중지
make clean         # 컨테이너와 볼륨 완전 삭제
make logs          # 모든 서비스 로그 보기
make backend       # 백엔드만 개발 모드로 시작
make frontend      # 프론트엔드만 개발 모드로 시작
make build         # 모든 컨테이너 빌드 (실행 없음)
make status        # 컨테이너 상태 확인
make restart       # 모든 서비스 재시작
make backend-logs  # 백엔드 로그만 보기
make frontend-logs # 프론트엔드 로그만 보기
```

## ⚙️ 환경 변수 설정

### 개발 환경 설정

```bash
# 백엔드 환경 변수 설정
cp backend/.env.dev.example backend/.env.dev

# 프론트엔드 환경 변수 설정
cp frontend/.env.dev.example frontend/.env.dev

# 파일 편집하여 실제 값으로 업데이트
nano backend/.env.dev
nano frontend/.env.dev
```

### 프로덕션 환경 설정

```bash
# 백엔드 환경 변수 설정
cp backend/.env.prod.example backend/.env.prod

# 프론트엔드 환경 변수 설정
cp frontend/.env.prod.example frontend/.env.prod

# 보안 값을 실제 프로덕션 값으로 업데이트
nano backend/.env.prod
nano frontend/.env.prod
```

## 🔧 필수 환경 변수

### 백엔드 (.env.dev 또는 .env.prod)

```bash
# 데이터베이스
DATABASE_URL=sqlite:///app/data/data.db

# JWT 보안 (프로덕션에서는 반드시 변경!)
JWT_SECRET=your_secure_jwt_secret_here

# Google OAuth
GOOGLE_CLIENT_ID=your_google_oauth_client_id
GOOGLE_CLIENT_SECRET=your_google_oauth_client_secret
GOOGLE_REDIRECT_URI=http://localhost:8080/api/auth/google/callback

# 프론트엔드 URL
FRONTEND_URL=http://localhost:3000

# 서버 포트
PORT=8080
```

### 프론트엔드 (.env.dev 또는 .env.prod)

```bash
# API 엔드포인트
NEXT_PUBLIC_API_URL=http://localhost:8080

# Google OAuth
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_oauth_client_id

# 환경 설정
NODE_ENV=development
PORT=3000
HOSTNAME=0.0.0.0
```

## 🐳 Docker Compose 파일 설명

### docker-compose.yml
- 기본 서비스 정의
- 공통 설정 포함
- 볼륨 정의

### docker-compose.dev.yml
- 개발 환경 오버라이드
- 핫 리로딩 설정
- 디버그 모드
- 소스 코드 마운트

### docker-compose.prod.yml
- 프로덕션 환경 오버라이드
- 보안 강화 설정
- 헬스체크 구성
- 최적화된 빌드

## 🛠️ 문제 해결

### 일반적인 문제

**포트 충돌 발생 시:**
```bash
# 사용 중인 포트 확인
lsof -i :8080
lsof -i :3000

# 다른 포트로 변경
# backend/.env.dev에서 PORT=8081로 변경
# frontend/.env.dev에서 PORT=3001로 변경
```

**Docker 캐시 문제:**
```bash
# 캐시 없이 재빌드
docker-compose -f docker-compose.yml -f docker-compose.dev.yml build --no-cache

# 특정 서비스만 재빌드
docker-compose -f docker-compose.yml -f docker-compose.dev.yml build backend
```

**환경 변수 문제:**
```bash
# 환경 변수 확인
docker-compose -f docker-compose.yml -f docker-compose.dev.yml config

# 특정 서비스 환경 변수 확인
docker-compose -f docker-compose.yml -f docker-compose.dev.yml run backend env
```

### 개발 모드 문제

**핫 리로딩이 작동하지 않을 때:**
```bash
# cargo-watch 재설치
docker-compose -f docker-compose.yml -f docker-compose.dev.yml exec backend cargo install cargo-watch

# 컨테이너 재시작
docker-compose -f docker-compose.yml -f docker-compose.dev.yml restart backend
```

**소스 코드 변경이 반영되지 않을 때:**
```bash
# 볼륨 마운트 확인
docker-compose -f docker-compose.yml -f docker-compose.dev.yml config | grep volumes

# 컨테이너 내부에서 파일 확인
docker-compose -f docker-compose.yml -f docker-compose.dev.yml exec backend ls -la /app
```

### 프로덕션 모드 문제

**헬스체크 실패:**
```bash
# 로그 확인
docker-compose -f docker-compose.yml -f docker-compose.prod.yml logs backend

# 직접 헬스체크 테스트
curl http://localhost:8080/health

# 컨테이너 재시작
docker-compose -f docker-compose.yml -f docker-compose.prod.yml restart backend
```

**이미지 빌드 실패:**
```bash
# 빌드 로그 확인
docker-compose -f docker-compose.yml -f docker-compose.prod.yml build --no-cache

# 의존성 캐시 삭제 후 재시도
docker builder prune
```

## 📊 모니터링 및 디버깅

### 로그 보기

```bash
# 실시간 모든 로그
make logs

# 백엔드 로그만
make backend-logs

# 프론트엔드 로그만
make frontend-logs

# 특정 시간 이후 로그
docker-compose -f docker-compose.yml -f docker-compose.dev.yml logs --since 10m

# 로그 tail (마지막 100줄)
docker-compose -f docker-compose.yml -f docker-compose.dev.yml logs --tail=100
```

### 컨테이너 내부 진입

```bash
# 백엔드 컨테이너 진입
docker-compose -f docker-compose.yml -f docker-compose.dev.yml exec backend sh

# 프론트엔드 컨테이너 진입
docker-compose -f docker-compose.yml -f docker-compose.dev.yml exec frontend sh

# 프로덕션 컨테이너 진입
docker-compose -f docker-compose.yml -f docker-compose.prod.yml exec backend sh
```

### 리소스 사용량 확인

```bash
# 컨테이너 리소스 사용량
docker stats

# 디스크 사용량
docker system df

# 상세 디스크 사용량
docker system df -v
```

## 🚀 배포 가이드

### 로컬 프로덕션 테스트

```bash
# 프로덕션 모드로 실행
make prod

# 서비스 상태 확인
make status

# 로그 확인
make logs

# 헬스체크 테스트
curl http://localhost:8080/health
```

### 실제 배포 시 고려사항

1. **도메인 및 SSL 설정**
   - 프론트엔드/백엔드 도메인 설정
   - SSL 인증서 적용
   - CORS 설정 업데이트

2. **데이터베이스 백업**
   ```bash
   # 데이터베이스 백업
   docker-compose -f docker-compose.yml -f docker-compose.prod.yml exec backend sqlite3 /app/data/data.db .dump > backup.sql
   ```

3. **환경 변수 보안**
   - 비밀 값은 secrets management 사용
   - .env.prod 파일 보호
   - API 키 순환 정책

4. **모니터링 설정**
   - 로그 집계
   - 성능 모니터링
   - 알림 설정

## 🔄 업데이트 및 유지보수

### 의존성 업데이트

```bash
# 백엔드 의존성 업데이트
docker-compose -f docker-compose.yml -f docker-compose.dev.yml exec backend cargo update

# 프론트엔드 의존성 업데이트
docker-compose -f docker-compose.yml -f docker-compose.dev.yml exec frontend bun update
```

### 이미지 재빌드

```bash
# 개발 환경 재빌드
make build

# 프로덕션 환경 재빌드
docker-compose -f docker-compose.yml -f docker-compose.prod.yml build --no-cache
```

### 데이터베이스 마이그레이션

```bash
# 데이터베이스 스키마 확인
docker-compose -f docker-compose.yml -f docker-compose.dev.yml exec backend sqlite3 /app/data/data.db .schema

# 데이터베이스 백업
docker-compose -f docker-compose.yml -f docker-compose.prod.yml exec backend sqlite3 /app/data/data.db .dump > production_backup.sql
```

## 📞 지원

문제가 발생하면 다음을 확인하세요:

1. Docker가 실행 중인지 확인
2. 환경 변수 파일이 올바르게 설정되었는지 확인
3. 포트 충돌이 없는지 확인
4. `make logs`로 로그 확인

**중요한 보안 참고사항:**
- 프로덕션 환경에서는 반드시 기본 JWT_SECRET 값을 변경하세요
- Google OAuth 클라이언트 ID/Secret은 실제 값으로 업데이트하세요
- 프로덕션에서는 HTTPS를 사용하세요

---

이 가이드가 도움이 되셨나요? 추가로 필요한 정보가 있다면 알려주세요!
