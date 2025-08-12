# 개발 가이드

## 🚀 빠른 시작

### 전체 스택 실행 (권장)

```bash
# 루트 디렉토리에서
bun install
bun run dev
```

이 명령어는 백엔드(Rust)와 프론트엔드(Next.js)를 동시에 실행합니다.

### 개별 실행

```bash
# 백엔드만 실행
bun run dev:backend

# 프론트엔드만 실행
bun run dev:frontend
```

## 🔧 환경 설정

### 1. 백엔드 환경 변수

`backend/.env` 파일을 생성하고 다음 내용을 추가:

```env
# Google OAuth 설정
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/login

# JWT 설정
JWT_SECRET=your_jwt_secret_key

# 서버 설정
PORT=8080
```

### 2. 프론트엔드 환경 변수

`frontend/.env.local` 파일:

```env
# 실제 백엔드 API 사용
NEXT_PUBLIC_USE_REAL_AUTH=true
NEXT_PUBLIC_API_URL=http://localhost:8080
```

## 📡 API 엔드포인트

### 인증 API

- `POST /api/auth/google` - Google OAuth 시작
- `GET /api/auth/google` - Google OAuth 콜백
- `GET /api/auth/me` - 현재 사용자 정보
- `DELETE /api/auth/logout` - 로그아웃

### 미션 API

- `GET /api/mission` - 미션 데이터 조회

### 기타 API

- `GET /api/sheets/read` - Google Sheets 읽기
- `POST /api/sheets/write` - Google Sheets 쓰기
- `GET /api/payment` - 결재 조회
- `POST /api/payment` - 결재 생성

## 🔄 개발 워크플로우

### 1. 목업 모드 (백엔드 없이 개발)

```bash
cd frontend
# .env.local에서 NEXT_PUBLIC_USE_REAL_AUTH=false 설정
bun run dev
```

### 2. 실제 API 모드

```bash
# 루트에서 전체 스택 실행
bun run dev
```

### 3. 프로덕션 빌드

```bash
# 프론트엔드 빌드
bun run build:frontend

# 백엔드 빌드
cd backend && cargo build --release
```

## 🛠️ 개발 도구

### 프론트엔드

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Package Manager**: Bun

### 백엔드

- **Language**: Rust
- **Framework**: Axum
- **Database**: SQLite (개발용)
- **Authentication**: JWT + Google OAuth

## 📁 프로젝트 구조

```
young-buddha-web/
├── backend/                 # Rust 백엔드
│   ├── src/
│   │   ├── routes/         # API 라우트
│   │   ├── state.rs        # 앱 상태
│   │   ├── web.rs          # 정적 파일 서빙
│   │   └── main.rs         # 메인 엔트리포인트
│   └── Cargo.toml
├── frontend/               # Next.js 프론트엔드
│   ├── src/
│   │   ├── app/           # Next.js App Router
│   │   ├── components/    # React 컴포넌트
│   │   ├── lib/          # 유틸리티 및 API
│   │   └── types/        # TypeScript 타입
│   └── package.json
└── package.json           # 루트 스크립트
```

## 🐛 트러블슈팅

### 백엔드 연결 실패

1. 백엔드가 실행 중인지 확인: `http://localhost:8080`
2. CORS 설정 확인
3. 환경 변수 설정 확인

### 인증 문제

1. Google OAuth 설정 확인
2. JWT 시크릿 키 설정 확인
3. 쿠키 설정 확인

### 빌드 오류

1. 의존성 설치: `bun install`
2. 타입 체크: `bun run type-check`
3. 린트 확인: `bun run lint`
