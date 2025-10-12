# Young Buddha Web

📖 **자세한 Docker 사용 가이드는 [DOCKER-GUIDE.md](DOCKER-GUIDE.md)를 참조하세요**

현대적인 Rust 백엔드와 Next.js 프론트엔드로 구성된 풀스택 웹 애플리케이션입니다.

## 🏗️ 프로젝트 아키텍처

### 백엔드 (Rust + Axum)

- **웹 프레임워크**: Axum 0.7
- **데이터베이스**: SQLite (rusqlite)
- **캐싱**: Redis (선택적)
- **인증**: JWT + Google OAuth
- **보안**: CSRF 보호 (Double Submit Cookie)

### 프론트엔드 (Next.js 14 + TypeScript)

- **프레임워크**: Next.js 14.2.5
- **스타일링**: Tailwind CSS 4
- **인증**: 미들웨어 기반 JWT 검증
- **타입**: TypeScript 5.9

## 🚀 빠른 시작

📖 **자세한 Docker 사용법은 [DOCKER-GUIDE.md](DOCKER-GUIDE.md) 참조**

### 개발 환경 실행

1. **환경 변수 설정**

    ```bash
    # 백엔드 개발 환경
    cp backend/.env.dev.example backend/.env.dev

    # 프론트엔드 개발 환경
    cp frontend/.env.dev.example frontend/.env.dev

    # 환경 변수 파일을 편집하여 실제 값으로 업데이트
    ```

2. **Docker 개발 환경 실행**

    ```bash
    docker-compose -f docker-compose.yml -f docker-compose.dev.yml up --build
    ```

3. **개별 서비스 실행**

    ```bash
    # 백엔드만 실행
    docker-compose -f docker-compose.yml -f docker-compose.dev.yml up backend

    # 프론트엔드만 실행
    docker-compose -f docker-compose.yml -f docker-compose.dev.yml up frontend
    ```

## 🔧 주요 기능

### 인증 시스템

- Google OAuth 2.0 연동
- JWT 기반 세션 관리
- **강화된 CSRF 보호** (Cookie 크레이트 기반 파싱)
- 역할 기반 접근 제어 (관리자/일반 사용자)

### 데이터 관리

- **SQLite 데이터베이스 (커넥션 풀링 적용)**
- 데이터베이스 요청 관리 기능
- 사용자 토큰 저장

### 보안 기능

- CORS 설정
- **구조화된 JSON 에러 응답**
- 환경 변수 기반 구성
- 프로덕션 보안 강화

## 🚀 최근 개선사항 (v0.2.0)

### 보안 강화
- **CSRF 미들웨어 개선**: Cookie 크레이트를 활용한 더 견고한 토큰 검증
- **에러 응답 구조화**: 일관된 JSON 형식의 에러 응답
- **의존성 보안 업데이트**: 최신 보안 패치 적용

### 성능 개선
- **데이터베이스 커넥션 풀링**: 연결 재사용으로 성능 향상
- **메모리 사용 최적화**: 불필요한 객체 생성 감소

### 개발 경험 개선
- **테스트 커버리지 확대**: 데이터베이스 풀 및 CSRF 유틸리티 테스트 추가
- **Vitest 설정 추가**: Next.js 프로젝트에 최적화된 테스트 환경 구성
- **추가 개발 도구**: 더 나은 디버깅 및 테스트 환경 제공

## 📁 프로젝트 구조

```
young-buddha-web/
├── backend/                 # Rust 백엔드
│   ├── src/
│   │   ├── api/            # API 핸들러
│   │   ├── auth/           # 인증 관련
│   │   ├── db/             # 데이터베이스
│   │   ├── routes/         # 라우트 정의
│   │   ├── services/       # 비즈니스 로직
│   │   └── types/          # 타입 정의
│   ├── Dockerfile.dev      # 개발용 Dockerfile
│   ├── Dockerfile.prod     # 프로덕션용 Dockerfile
│   ├── .env.dev.example    # 개발 환경 변수 예제
│   └── .env.prod.example   # 프로덕션 환경 변수 예제
├── frontend/               # Next.js 프론트엔드
│   ├── src/
│   │   ├── app/           # App Router
│   │   ├── components/    # 재사용 컴포넌트
│   │   └── lib/          # 유틸리티
│   ├── Dockerfile.dev      # 개발용 Dockerfile
│   ├── Dockerfile.prod     # 프로덕션용 Dockerfile
│   ├── .env.dev.example    # 개발 환경 변수 예제
│   └── .env.prod.example   # 프로덕션 환경 변수 예제
├── docker-compose.yml      # 기본 Docker Compose
├── docker-compose.dev.yml  # 개발 오버라이드
└── docker-compose.prod.yml # 프로덕션 오버라이드
```

## 🐳 Docker 환경 설명

### 개발 환경 특징

- **핫 리로딩**: 코드 변경 시 자동 재시작
- **볼륨 마운트**: 호스트 코드와 컨테이너 동기화
- **디버그 로깅**: 상세한 로그 출력
- **의존성 캐싱**: 빌드 시간 최적화

### 프로덕션 환경 특징

- **멀티스테이지 빌드**: 최소한의 런타임 이미지
- **보안 강화**: non-root 사용자 실행
- **헬스체크**: 서비스 상태 모니터링
- **성능 최적화**: 네이티브 CPU 타겟팅

## ⚙️ 환경 변수 설정

### 백엔드 필수 변수

```bash
# 데이터베이스
DATABASE_URL=sqlite:///app/data/data.db

# JWT 보안
JWT_SECRET=your_secure_jwt_secret

# Google OAuth
GOOGLE_CLIENT_ID=your_google_oauth_client_id
GOOGLE_CLIENT_SECRET=your_google_oauth_client_secret
GOOGLE_REDIRECT_URI=http://localhost:8080/api/auth/google/callback

# 프론트엔드 URL
FRONTEND_URL=http://localhost:3000
```

### 프론트엔드 필수 변수

```bash
# API 엔드포인트
NEXT_PUBLIC_API_URL=http://localhost:8080

# Google OAuth
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_oauth_client_id
```

## 🚀 배포 가이드

### 개발 모드

```bash
# 전체 서비스 개발 모드 실행
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up --build

# 백엔드만 개발 모드 실행
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up backend

# 프론트엔드만 개발 모드 실행
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up frontend
```

### 프로덕션 모드

```bash
# 전체 서비스 프로덕션 모드 실행
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d

# 서비스 상태 확인
docker-compose -f docker-compose.yml -f docker-compose.prod.yml ps

# 로그 확인
docker-compose -f docker-compose.yml -f docker-compose.prod.yml logs
```

## 🔍 문제 해결

### 일반적인 문제

1. **포트 충돌**: 8080 또는 3000 포트가 사용 중인지 확인
2. **환경 변수**: .env.dev 또는 .env.prod 파일이 올바르게 설정되었는지 확인
3. **의존성**: Docker 이미지를 재빌드해야 할 수 있음 (`--build` 플래그 사용)

## 📝 추가 정보

- **Docker 상세 가이드**: [DOCKER-GUIDE.md](DOCKER-GUIDE.md) 파일 참조
- **백엔드 API**: http://localhost:8080
- **프론트엔드**: http://localhost:3000
- **상태 확인**: http://localhost:8080/health

개발 중 문제가 발생하면 Docker 로그를 확인하고 환경 변수 설정을 재검토하세요.