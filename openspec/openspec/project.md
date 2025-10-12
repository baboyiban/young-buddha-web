# Project Context

## Purpose
청년붓다(Young Buddha) 웹 애플리케이션 - 불교 공동체를 위한 결재 신청, 미션 관리, 사용자 인증 시스템

## Tech Stack
### Frontend
- Next.js 14.2.10
- React 18.3.1
- TypeScript 5.9.2
- Tailwind CSS 4.1.12
- SWR 2.3.6 (데이터 페칭)
- Bun 1.2.21 (패키지 매니저)

### Backend
- Rust
- Axum 웹 프레임워크
- SQLite 데이터베이스
- JWT 인증
- Google OAuth 2.0
- Google Sheets API 통합

## Project Conventions

### Code Style
- TypeScript strict mode 사용
- 타입 안전성 강화
- 한글 주석 및 메시지 사용
- 함수형 컴포넌트 패턴

### Architecture Patterns
- 프론트엔드/백엔드 분리 아키텍처
- JWT 기반 인증
- Google Sheets를 데이터 저장소로 사용
- SWR을 이용한 데이터 캐싱
- Error Boundary를 통한 에러 처리

### Testing Strategy
- Vitest (프론트엔드 테스트)
- React Testing Library
- Jest DOM

### Git Workflow
- 기능 개발: `feat:` 접두사
- 버그 수정: `fix:` 접두사
- 한글 커밋 메시지 사용

## Domain Context
- 청년붓다 공동체 구성원 관리
- 결재 신청 및 승인 워크플로우
- 일일 생활 소임(미션) 관리
- Google OAuth를 통한 사용자 인증
- Google Sheets를 통한 데이터 관리

## Important Constraints
- Google OAuth 2.0 인증 필수
- Google Sheets API 사용
- JWT 토큰 기반 세션 관리
- 관리자/일반 사용자 역할 구분

## External Dependencies
- Google OAuth 2.0
- Google Sheets API
- Google Service Account
