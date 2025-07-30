# Young Buddha Web Server

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
