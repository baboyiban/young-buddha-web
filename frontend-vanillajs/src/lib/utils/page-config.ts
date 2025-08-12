/**
 * 페이지별 설정을 관리하는 유틸리티
 */

export interface PageConfig {
  apiEndpoint?: string;
  maxRecords?: number;
  elementIds: Record<string, string>;
  messages: Record<string, string>;
  headers?: readonly string[];
}

export interface SheetConfig {
  spreadsheetId: string;
  sheetName: string;
  baseDate: string;
  baseRow: number;
  columnRange: {
    start: string;
    end: string;
  };
}

/**
 * 공통 UI 메시지
 */
export const COMMON_MESSAGES = {
  loading: "데이터를 불러오는 중...",
  noData: "데이터가 없습니다.",
  loadError: "불러오기 실패",
  submitSuccess: "저장 완료!",
  submitError: "저장 실패",
  loginRequired: "로그인이 필요합니다.",
  loginButton: "로그인하기",
} as const;

/**
 * 페이지 설정 팩토리
 */
export class PageConfigFactory {
  /**
   * 기본 페이지 설정을 생성합니다
   */
  static createBasicConfig(
    elementIds: Record<string, string>,
    customMessages: Record<string, string> = {}
  ): PageConfig {
    return {
      elementIds,
      messages: { ...COMMON_MESSAGES, ...customMessages },
    };
  }

  /**
   * API 기반 페이지 설정을 생성합니다
   */
  static createApiConfig(
    apiEndpoint: string,
    elementIds: Record<string, string>,
    options: {
      maxRecords?: number;
      customMessages?: Record<string, string>;
      headers?: readonly string[];
    } = {}
  ): PageConfig {
    const { maxRecords = 10, customMessages = {}, headers } = options;

    return {
      apiEndpoint,
      maxRecords,
      elementIds,
      messages: { ...COMMON_MESSAGES, ...customMessages },
      headers,
    };
  }

  /**
   * 시트 기반 페이지 설정을 생성합니다
   */
  static createSheetConfig(
    sheetConfig: SheetConfig,
    elementIds: Record<string, string>,
    customMessages: Record<string, string> = {}
  ): PageConfig & { sheet: SheetConfig } {
    return {
      elementIds,
      messages: { ...COMMON_MESSAGES, ...customMessages },
      sheet: sheetConfig,
    };
  }
}
