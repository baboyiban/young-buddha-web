// lib/config/app.ts
export const APP_CONFIG = {
  // 페이지네이션 설정
  PAGINATION: {
    DEFAULT_SIZE: 10,
    MAX_SIZE: 100,
  },

  // UI 설정
  UI: {
    DEBOUNCE_DELAY: 300,
    LOADING_TIMEOUT: 30000, // 30초
    ERROR_DISPLAY_DURATION: 5000, // 5초
  },

  // API 설정
  API: {
    RETRY_COUNT: 3,
    RETRY_DELAY: 1000, // 1초
    TIMEOUT: 15000, // 15초
  },

  // 캐시 설정
  CACHE: {
    AUTH_TTL: 60 * 1000, // 1분
    USER_DATA_TTL: 5 * 60 * 1000, // 5분
  },

  // 검증 규칙
  VALIDATION: {
    EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    MIN_REASON_LENGTH: 5,
    MAX_REASON_LENGTH: 500,
    MAX_SCHEDULE_LENGTH: 100,
  },
} as const;

// 시트 설정 통합
export const SHEET_CONFIG = {
  PAYMENT: {
    spreadsheetId: "1wmunEJyWUFH01rPNENBt2kk9htJvyBuYigjSvcqm6nA",
    gid: "1780492175",
  },
  USER: {
    spreadsheetId: "1wmunEJyWUFH01rPNENBt2kk9htJvyBuYigjSvcqm6nA",
    gid: "0",
  },
  MISSION: {
    spreadsheetId: "1-xSqaEHOOgIFs9yIh39wUp_oowYcXdQA0nwGZuhSJdQ",
    gid: "257537053",
  },
} as const;

// 메시지 중앙화
export const MESSAGES = {
  // 에러 메시지
  ERRORS: {
    GENERIC: "오류가 발생했습니다. 다시 시도해주세요.",
    NETWORK: "네트워크 연결을 확인해주세요.",
    AUTH_EXPIRED: "인증이 만료되었습니다. 다시 로그인해주세요.",
    PERMISSION_DENIED: "권한이 없습니다.",
    VALIDATION_FAILED: "입력 정보를 확인해주세요.",

    // 결재 관련
    PAYMENT: {
      SUBMIT_FAILED: "결재 신청에 실패했습니다.",
      DELETE_FAILED: "삭제 중 오류가 발생했습니다.",
      UPDATE_FAILED: "수정 중 오류가 발생했습니다.",
      NOT_FOUND: "해당 결재 신청을 찾을 수 없습니다.",
    },

    // 미션 관련
    MISSION: {
      LOAD_FAILED: "미션 데이터를 불러오는데 실패했습니다.",
      NO_DATA: "미션 데이터가 없습니다.",
    },
  },

  // 성공 메시지
  SUCCESS: {
    GENERIC: "성공적으로 처리되었습니다.",

    PAYMENT: {
      SUBMITTED: "결재 신청이 완료되었습니다.",
      UPDATED: "결재 신청이 수정되었습니다.",
      DELETED: "결재 신청이 삭제되었습니다.",
      BATCH_APPROVED: "선택된 항목들이 승인되었습니다.",
      BATCH_REJECTED: "선택된 항목들이 반려되었습니다.",
    },
  },

  // 확인 메시지
  CONFIRM: {
    DELETE: "정말로 삭제하시겠습니까?",
    LOGOUT: "로그아웃하시겠습니까?",
    BATCH_APPROVE: "선택된 항목들을 승인하시겠습니까?",
    BATCH_REJECT: "선택된 항목들을 반려하시겠습니까?",
  },

  // 로딩 메시지
  LOADING: {
    DEFAULT: "처리 중...",
    AUTH: "인증 확인 중...",
    LOGIN: "로그인 페이지 로딩 중...",
    PAYMENT: {
      SUBMITTING: "결재 신청 중...",
      UPDATING: "수정 중...",
      DELETING: "삭제 중...",
      LOADING: "결재 목록 로딩 중...",
    },
    MISSION: {
      LOADING: "미션 데이터 로딩 중...",
    },
  },
} as const;

// 상태 옵션들
export const OPTIONS = {
  PAYMENT: {
    TYPES: [
      { value: "정기", label: "정기" },
      { value: "비정기", label: "비정기" },
      { value: "추가요청", label: "추가요청" },
      { value: "사후알림", label: "사후알림" },
      { value: "야근신청", label: "야근신청" },
      { value: "기타", label: "기타" },
    ],

    STATUSES: [
      { value: "전체", label: "전체" },
      { value: "대기", label: "대기" },
      { value: "승인", label: "승인" },
      { value: "반려", label: "반려" },
    ],
  },

  SORTING: [
    { value: "desc", label: "최신순" },
    { value: "asc", label: "오래된순" },
  ],

  FILTERS: [
    { value: "전체", label: "전체" },
    { value: "정기", label: "정기" },
    { value: "비정기", label: "비정기" },
  ],
} as const;
