# Environment Variables Guide

## 구조

```
young-buddha-web/
├── .env                 # 공통 + 프론트엔드 환경변수
├── .env.example         # 예시 파일
└── backend/
    ├── .env             # 백엔드 민감 정보
    └── .env.example     # 백엔드 예시 파일
```

## 로딩 순서

### 프론트엔드 (Vite)

1. 루트 `.env` 파일 로드
2. `VITE_` 접두사가 있는 변수만 클라이언트에 노출

### 백엔드 (Zig)

1. 루트 `.env` 파일 로드 (공통 설정)
2. `backend/.env` 파일 로드 (덮어쓰기, 민감 정보)

## 환경변수 분류

### 공통 설정 (루트 .env)

- `NODE_ENV`: 환경 모드
- `PORT`: 서버 포트
- `HOST`: 서버 호스트
- `VITE_*`: 프론트엔드 노출 변수

### 백엔드 전용 (backend/.env)

- `GOOGLE_CLIENT_SECRET`: OAuth 시크릿
- `JWT_SECRET`: JWT 서명 키
- `DATABASE_URL`: 데이터베이스 연결
- 기타 민감한 API 키들

## 보안 원칙

1. **민감한 정보는 backend/.env에만**
2. **프론트엔드 노출 변수는 VITE\_ 접두사 사용**
3. **시크릿 키는 최소 32자 이상**
4. **.env 파일은 .gitignore에 포함**

## 배포 시 주의사항

### 개발 환경

```bash
# 루트 .env
VITE_API_BASE_URL=http://localhost:8080

# backend/.env
GOOGLE_REDIRECT_URI=http://localhost:8080/api/auth/google/callback
```

### 프로덕션 환경

```bash
# 루트 .env
VITE_API_BASE_URL=https://yourdomain.com

# backend/.env
GOOGLE_REDIRECT_URI=https://yourdomain.com/api/auth/google/callback
```
