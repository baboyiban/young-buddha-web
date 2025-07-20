import { apiClient } from "../api/client";
import { authService } from "../auth/service";
import {
  ApiError,
  type SpreadsheetConfig,
  type SpreadsheetData,
} from "../types";

interface CacheEntry {
  data: string[][];
  timestamp: number;
}

export class SheetsService {
  private cache = new Map<string, CacheEntry>();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5분 캐시

  async readSpreadsheet(config: SpreadsheetConfig): Promise<string[][]> {
    const cacheKey = `${config.spreadsheetId}:${config.range}`;

    // 캐시 확인
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.data;
    }

    try {
      const params = new URLSearchParams({
        spreadsheet_id: config.spreadsheetId,
        range: config.range,
      });

      const response = await apiClient.get<SpreadsheetData>(
        `/api/sheet/read?${params}`
      );

      if (!response.values || !Array.isArray(response.values)) {
        return [];
      }

      // 캐시 저장
      this.cache.set(cacheKey, {
        data: response.values,
        timestamp: Date.now(),
      });

      return response.values;
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        // 인증 오류 시 자동 처리
        if (error.code === "TOKEN_EXPIRED") {
          authService.clearAuthData();
          authService.redirectToLogin();
          throw new Error("로그인이 만료되었습니다. 다시 로그인해주세요.");
        }
      }
      throw error;
    }
  }

  async writeSpreadsheet(
    config: SpreadsheetConfig,
    values: string[][]
  ): Promise<void> {
    try {
      await apiClient.post("/api/sheet/write", {
        spreadsheet_id: config.spreadsheetId,
        range: config.range,
        values: values,
      });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        // 인증 오류 시 자동 처리
        if (error.code === "TOKEN_EXPIRED") {
          authService.clearAuthData();
          authService.redirectToLogin();
          throw new Error("로그인이 만료되었습니다. 다시 로그인해주세요.");
        }
      }
      throw error;
    }
  }
}

export const sheetsService = new SheetsService();
