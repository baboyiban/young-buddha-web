# 청년붓다 프로젝트

OAuth 인증을 통한 구글 스프레드시트 데이터 접근 시스템

## 개요

이 프로젝트는 사용자가 OAuth로 로그인하여 자신의 권한으로 구글 스프레드시트 데이터에 접근할 수 있는 시스템입니다.

## 기술 스택

- **백엔드**: Rust (Axum)
- **프론트엔드**: Next.js (TypeScript)
- **인증**: Google OAuth 2.0
- **데이터베이스**: SQLite
- **API**: Google Sheets API v4

## 주요 기능

- Google OAuth 2.0 로그인
- 사용자 권한으로 스프레드시트 읽기/쓰기
- 자동 토큰 갱신
- JWT 기반 세션 관리

## 설정 방법

### 1. Google Cloud Console 설정

1. [Google Cloud Console](https://console.cloud.google.com/)에서 새 프로젝트 생성
2. Google Sheets API 활성화
3. OAuth 2.0 클라이언트 ID 생성:
   - 애플리케이션 유형: 웹 애플리케이션
   - 승인된 리디렉션 URI: `http://localhost:8080/api/auth/google/callback`

### 2. 환경 변수 설정

`backend/.env` 파일 생성:

```bash
# Google OAuth 설정
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:8080/api/auth/google/callback
GOOGLE_SCOPE="openid email profile https://www.googleapis.com/auth/spreadsheets"

# JWT 시크릿 (openssl rand -base64 32로 생성)
JWT_SECRET=your-jwt-secret

# 서버 설정
PORT=8080
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
DB_PATH=./data.db
```

`frontend/.env.local` 파일 생성:

```bash
NEXT_PUBLIC_API_URL=http://localhost:8080
```

### 3. 실행 방법

#### 개발 환경

```bash
# 백엔드 실행
cd backend
cargo run

# 프론트엔드 실행 (새 터미널)
cd frontend
npm install
npm run dev
```

#### Docker 실행

```bash
docker-compose up --build
```

## API 엔드포인트

### 인증

- `GET /api/auth/google` - OAuth 로그인 URL 생성
- `GET /api/auth/google/callback` - OAuth 콜백 처리
- `GET /api/auth/me` - 현재 사용자 정보
- `DELETE /api/auth/logout` - 로그아웃

### 스프레드시트

- `GET /api/sheets/read?spreadsheet_id={id}&range={range}` - 스프레드시트 읽기
- `POST /api/sheets/write` - 스프레드시트 쓰기

## 사용 방법

1. 웹사이트 접속 후 로그인 버튼 클릭
2. Google 계정으로 로그인 및 권한 승인
3. 로그인 완료 후 스프레드시트 데이터 접근 가능

## 보안 고려사항

- 모든 스프레드시트 접근은 로그인한 사용자의 권한으로만 가능
- JWT 토큰은 HttpOnly 쿠키로 관리
- 액세스 토큰은 자동으로 갱신됨
- 프로덕션 환경에서는 HTTPS 필수

## 문제 해결

### 로그인 실패

- Google OAuth 설정 확인
- 리디렉션 URI 정확성 확인

### 스프레드시트 접근 실패

- 사용자가 해당 스프레드시트에 대한 권한이 있는지 확인
- 스프레드시트 ID와 범위 형식 확인

### 토큰 만료

- 시스템이 자동으로 토큰을 갱신하므로 재로그인 필요시에만 로그인

## 라이선스

MIT License
