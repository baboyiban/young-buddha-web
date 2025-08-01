/**
 * Google Sheets 설정
 * 환경변수나 설정 파일에서 관리되어야 하는 값들
 */
export const SHEETS_CONFIG = {
  // 결제 요청 관련 스프레드시트 설정
  PAYMENT: {
    SPREADSHEET_ID: "1r8_mfnZAvTFmT02JHi1XgOwn_-sLCR9XgmR8wEQ4uW4", // 실제 ID로 변경 필요
    SHEET_NAME: "결재요청",
    RANGE: "결재요청!A:K",
    COLUMNS: {
      ID: "A",
      NAME: "B",
      REQUEST_DATE: "C",
      TYPE: "D",
      ABSENT_DATE: "E",
      TIME_SLOT: "F",
      REASON: "G",
      STATUS: "H",
      APPROVER: "I",
      APPROVED_AT: "J",
      COMMENT: "K",
    },
  },
} as const;

/**
 * Google Sheets 쿼리 헬퍼 함수들
 */
export const SheetsQueryHelper = {
  /**
   * 대기 중인 결제 요청을 조회하는 쿼리 생성
   */
  getPendingPayments: (limit: number = 10) =>
    `select * where H = '대기' order by C desc limit ${limit}`,

  /**
   * 특정 사용자의 결제 요청을 조회하는 쿼리 생성
   */
  getPaymentsByUser: (userName: string, limit: number = 10) =>
    `select * where B = '${userName}' order by C desc limit ${limit}`,

  /**
   * 특정 날짜 범위의 결제 요청을 조회하는 쿼리 생성
   */
  getPaymentsByDateRange: (startDate: string, endDate: string) =>
    `select * where C >= date '${startDate}' and C <= date '${endDate}' order by C desc`,

  /**
   * 특정 상태의 결제 요청을 조회하는 쿼리 생성
   */
  getPaymentsByStatus: (status: string, limit: number = 10) =>
    `select * where H = '${status}' order by C desc limit ${limit}`,
};
