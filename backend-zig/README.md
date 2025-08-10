# Young Buddha Web Server

Zig로 작성된 웹 서버로, Google OAuth2 인증, Google Sheets 연동, 결제 처리 등의 기능을 제공합니다.

## 프로젝트 구조

```
backend/
├── src/
│   ├── auth/           # 인증 모듈 (Google OAuth2, JWT)
│   ├── config/         # 설정 및 환경 변수 관리
│   ├── database/       # 데이터베이스 관련 기능
│   ├── handler/        # HTTP 핸들러들
│   ├── model/          # 데이터 모델 정의
│   ├── payment/        # 결제 처리 모듈
│   ├── sheets/         # Google Sheets 연동
│   ├── util/           # 유틸리티 함수들
│   ├── web/            # 웹 라우팅 및 미들웨어
│   └── main.zig        # 메인 애플리케이션
├── build.zig           # 빌드 설정
└── build.zig.zon       # 의존성 관리
```

## 주요 기능

- **인증**: Google OAuth2를 통한 사용자 인증
- **JWT**: JSON Web Token 기반 세션 관리
- **Google Sheets**: 스프레드시트 데이터 읽기/쓰기
- **결제**: 결제 정보 처리 및 관리
- **정적 파일**: 프론트엔드 파일 서빙
- **데이터베이스**: SQLite를 통한 데이터 저장

## 환경 변수 설정

`.env` 파일을 생성하고 다음 변수들을 설정하세요:

```env
# Google OAuth2 설정
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:8080/api/auth/google/callback

# JWT 설정
JWT_SECRET=your_jwt_secret_key

# 서버 설정
PORT=8080
ENVIRONMENT=development

# Google Sheets 설정
PAYMENT_SHEET_ID=your_spreadsheet_id

# 정적 파일 경로
STATIC_FILES_PATH=../frontend/dist
```

## 서버 실행 방법

### 1. 기본 실행 (개발용)

```bash
cd backend
zig build run
```

### 2. 안정적인 실행 (운영용)

운영 환경에서는 아래의 스크립트를 사용하여 서버를 실행하세요:

```bash
cd backend
./run-server.sh
```

이 스크립트는 다음 기능을 제공합니다:

- 자동 빌드
- 로그 파일 관리
- 프로세스 ID 추적
- 서버 상태 확인
- 에러 로그 분리

### 3. systemd를 사용한 실행 (권장)

운영 환경에서는 systemd를 사용하여 서버를 관리하는 것을 권장합니다.

1. 서비스 파일을 시스템에 설치:

   ```bash
   sudo cp young-buddha-web.service /etc/systemd/system/
   sudo systemctl daemon-reload
   ```

2. 서비스 시작:

   ```bash
   sudo systemctl start young-buddha-web
   ```

3. 부팅 시 자동 시작 설정:

   ```bash
   sudo systemctl enable young-buddha-web
   ```

4. 서비스 상태 확인:
   ```bash
   sudo systemctl status young-buddha-web
   ```

## 서버 중지

### 스크립트를 사용한 중지

```bash
cd backend
./stop-server.sh
```

### systemd를 사용한 중지

```bash
sudo systemctl stop young-buddha-web
```

## 로그 확인

### 스크립트 실행 시 로그

- 일반 로그: `server.log`
- 에러 로그: `error.log`

### systemd 사용 시 로그

```bash
sudo journalctl -u young-buddha-web -f
```

## 문제 해결

### 502 Bad Gateway 에러 발생 시

1. 서버가 실행 중인지 확인:

   ```bash
   ps aux | grep young-buddha
   ```

2. 로그 확인:

   ```bash
   # 스크립트 방식 사용 시
   cat server.log
   cat error.log

   # systemd 사용 시
   sudo journalctl -u young-buddha-web
   ```

3. 포트 사용 확인:
   ```bash
   netstat -tlnp | grep 8080
   ```

### 자동 재시작 설정

systemd 서비스 파일에는 `Restart=always` 설정이 포함되어 있어 서버가 비정상 종료될 경우 자동으로 재시작됩니다.
