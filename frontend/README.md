# Young Buddha Frontend (Next.js)

이 프로젝트는 기존 Vanilla JS 프론트엔드를 Next.js로 마이그레이션한 버전입니다.

## 시작하기

### 개발 서버 실행

```bash
npm install
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 열어 결과를 확인하세요.

### 빌드

```bash
npm run build
npm start
```

## 주요 변경사항

### 기술 스택

- **프레임워크**: Vanilla JS → Next.js 14 (App Router)
- **스타일링**: Tailwind CSS 유지
- **언어**: TypeScript 유지

### 폴더 구조

```
frontend-nextjs/
├── src/
│   ├── app/                 # Next.js App Router
│   │   ├── api/            # API Routes
│   │   ├── globals.css     # 전역 스타일
│   │   ├── layout.tsx      # 루트 레이아웃
│   │   └── page.tsx        # 홈 페이지
│   ├── components/         # React 컴포넌트
│   ├── lib/               # 유틸리티 및 API
│   └── types/             # TypeScript 타입 정의
├── next.config.js         # Next.js 설정
├── tailwind.config.js     # Tailwind CSS 설정
└── tsconfig.json          # TypeScript 설정
```

### 주요 컴포넌트

- `MissionPage`: 메인 미션 페이지 컴포넌트
- `MissionItem`: 개별 미션 항목 컴포넌트
- `LaundryMission`: 빨래 미션 전용 컴포넌트
- `AfternoonCushionMission`: 오후 방석 미션 전용 컴포넌트

### API 구조

- `/api/mission`: 미션 데이터를 가져오는 API 엔드포인트
- 현재는 목업 데이터를 사용하며, 실제 백엔드 API와 연동 필요

## 백엔드 연동

`next.config.js`에서 API 프록시 설정이 되어 있어 백엔드 서버(localhost:8080)와 연동 가능합니다.

실제 데이터를 사용하려면 `src/app/api/mission/route.ts`에서 목업 데이터 대신 실제 백엔드 API를 호출하도록 수정하세요.

## 개발 가이드

### 새로운 페이지 추가

1. `src/app/` 폴더에 새 폴더 생성
2. `page.tsx` 파일 추가
3. 필요시 `layout.tsx` 추가

### 새로운 컴포넌트 추가

1. `src/components/` 폴더에 컴포넌트 파일 생성
2. TypeScript 인터페이스는 `src/types/`에 정의

### API 엔드포인트 추가

1. `src/app/api/` 폴더에 새 폴더 생성
2. `route.ts` 파일에 GET, POST 등 HTTP 메서드 구현

## 인증 시스템

### 주요 기능

- Google OAuth 로그인 지원
- JWT 쿠키 기반 인증
- `useAuth` 훅으로 인증 상태 관리
- `AuthGuard` 컴포넌트로 페이지 보호

### 사용법

```tsx
// 인증이 필요한 페이지
import AuthGuard from "@/components/AuthGuard";

export default function ProtectedPage() {
  return (
    <AuthGuard>
      <YourComponent />
    </AuthGuard>
  );
}

// 인증 상태 사용
import { useAuth } from "@/hooks/useAuth";

export default function Component() {
  const { user, isAuthenticated, login, logout } = useAuth();

  // 컴포넌트 로직
}
```

### 페이지 구조

- `/`: 메인 미션 페이지 (인증 필요)
- `/login`: 로그인 페이지

## 개발 환경 설정

### 목업 인증 vs 실제 인증

기본적으로 개발 환경에서는 백엔드 서버 없이도 테스트할 수 있도록 목업 인증을 사용합니다.

**목업 인증 사용 (기본값)**:

```bash
# .env.local
NEXT_PUBLIC_USE_REAL_AUTH=false
```

**실제 백엔드 API 사용**:

```bash
# .env.local
NEXT_PUBLIC_USE_REAL_AUTH=true
```

### 목업 인증 특징

- 백엔드 서버 없이 로그인/로그아웃 테스트 가능
- 테스트 사용자 정보 자동 생성
- 1초 로딩 시뮬레이션
- JWT 쿠키 시뮬레이션
