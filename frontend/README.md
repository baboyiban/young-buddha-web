# Frontend

## Backend Origin 설정 가이드

미들웨어(Edge)에서 Next rewrites가 보장되지 않으므로, 백엔드 검증 호출은 절대 URL을 사용합니다. 프로젝트는 다음 우선순위로 백엔드 Origin을 결정합니다.

우선순위
1) `BACKEND_INTERNAL_URL` (컨테이너-간 통신용)
2) `NEXT_PUBLIC_BACKEND_URL` (로컬 개발/공개 API Origin)
3) Fallback: hostname이 `localhost`면 `http://localhost:8080`, 그 외엔 `http://backend:8080`

환경별 예시
- Docker 개발: `BACKEND_INTERNAL_URL=http://backend:8080` (docker-compose.dev.yml에 설정됨)
- 로컬 개발(도커 미사용): `NEXT_PUBLIC_BACKEND_URL=http://localhost:8080`
- 프로덕션: `NEXT_PUBLIC_BACKEND_URL=https://api.your-domain` 또는 내부 네트워크면 `BACKEND_INTERNAL_URL=http://backend:8080`

클라이언트(브라우저)에서의 일반 API 호출은 `/api` 경로를 사용하며, `next.config.js`의 rewrites를 통해 백엔드로 프록시됩니다. 미들웨어만 절대 URL을 사용합니다.

## 환경변수 요약

필수
- NEXT_PUBLIC_API_URL=/api (권장: rewrites 사용)

선택 (둘 중 하나)
- NEXT_PUBLIC_BACKEND_URL=https://api.your-domain (브라우저가 호출할 퍼블릭 백엔드)
- BACKEND_INTERNAL_URL=http://backend:8080 (컨테이너 내부 접근; 미들웨어/SSR 우선)

기타
- NEXT_PUBLIC_GOOGLE_CLIENT_ID=… (필요 시 버튼 노출 제어 등에 사용)
- NODE_ENV=development|production
- PORT=3000, HOSTNAME=0.0.0.0

샘플 파일
- 개발 템플릿: `frontend/.env.example`
- 프로덕션 템플릿: `frontend/.env.prod.example`

