import { apiClient } from "../api";
import { authService } from "../auth/service";
import { handleAuthError } from "../error";
import type { SpreadsheetConfig, SpreadsheetData } from "../../types/sheet";

interface CacheEntry {
  data: string[][];
  timestamp: number;
}

export interface QueryResponse {
  table?: {
    cols?: Array<{
      id?: string;
      label?: string;
      type?: string;
    }>;
    rows?: Array<{
      c?: Array<{
        v?: any;
        f?: string;
      } | null>;
    }>;
  };
}

export class SheetsService {
  private cache = new Map<string, CacheEntry>();
  private readonly CACHE_DURATION = 5 * 60 * 1000;

  async readSpreadsheet(config: SpreadsheetConfig): Promise<string[][]> {
    const cacheKey = `${config.spreadsheetId}:${config.range}`;
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
        `/api/sheets/read?${params}`,
      );
      if (!response.values || !Array.isArray(response.values)) return [];
      this.cache.set(cacheKey, {
        data: response.values,
        timestamp: Date.now(),
      });
      return response.values;
    } catch (error) {
      handleAuthError(error, authService);
      throw error;
    }
  }

  async writeSpreadsheet(
    config: SpreadsheetConfig,
    values: string[][],
  ): Promise<void> {
    try {
      await apiClient.post("/api/sheets/write", {
        spreadsheet_id: config.spreadsheetId,
        range: config.range,
        values,
      });
    } catch (error) {
      handleAuthError(error, authService);
      throw error;
    }
  }

  /**
   * Google Visualization API Query Language를 사용하여 스프레드시트 데이터 조회
   * @param spreadsheetId 스프레드시트 ID
   * @param query Google Visualization API 쿼리 문자열
   * @returns 쿼리 결과
   */
  async querySpreadsheet(
    spreadsheetId: string,
    query: string,
  ): Promise<QueryResponse> {
    try {
      const response = await apiClient.post<QueryResponse>("/api/sheets/query", {
        spreadsheet_id: spreadsheetId,
        query: query,
      });
      return response;
    } catch (error) {
      handleAuthError(error, authService);
      throw error;
    }
  }

  /**
   * 동적으로 스프레드시트 ID, 범위, 쿼리를 지정하여 데이터 조회
   * @param options 스프레드시트 조회 옵션
   * @returns 쿼리 결과
   */
  async querySpreadsheetWithOptions(options: {
    spreadsheetId: string;
    query: string;
    gid?: string;
    range?: string;
  }): Promise<QueryResponse> {
    try {
      const requestBody: any = {
        spreadsheet_id: options.spreadsheetId,
        query: options.query,
      };

      if (options.gid !== undefined) {
        requestBody.gid = options.gid;
      }

      if (options.range !== undefined) {
        requestBody.range = options.range;
      }

      const response = await apiClient.post<QueryResponse>("/api/sheets/query", requestBody);
      return response;
    } catch (error) {
      handleAuthError(error, authService);
      throw error;
    }
  }

  /**
   * GET 방식으로 동적으로 스프레드시트 조회
   * @param options 스프레드시트 조회 옵션
   * @returns 쿼리 결과
   */
  async querySpreadsheetGet(options: {
    spreadsheetId: string;
    query: string;
    gid?: string;
    range?: string;
  }): Promise<QueryResponse> {
    try {
      const params = new URLSearchParams({
        spreadsheet_id: options.spreadsheetId,
        tq: encodeURIComponent(options.query),
      });

      if (options.gid !== undefined) {
        params.append("gid", options.gid);
      }

      if (options.range !== undefined) {
        params.append("range", encodeURIComponent(options.range));
      }

      const response = await apiClient.get<QueryResponse>(
        `/api/sheets/query?${params.toString()}`
      );
      return response;
    } catch (error) {
      handleAuthError(error, authService);
      throw error;
    }
  }
}

export const sheetsService = new SheetsService();
