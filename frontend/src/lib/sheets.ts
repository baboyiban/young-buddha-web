import { apiClient } from "./api";
import { authService } from "./auth";
import { handleAuthError } from "./error";
import type { SpreadsheetConfig, SpreadsheetData } from "./types";

interface CacheEntry {
  data: string[][];
  timestamp: number;
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
        `/api/sheet/read?${params}`,
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
      await apiClient.post("/api/sheet/write", {
        spreadsheet_id: config.spreadsheetId,
        range: config.range,
        values,
      });
    } catch (error) {
      handleAuthError(error, authService);
      throw error;
    }
  }
}

export const sheetsService = new SheetsService();

export function calculateRowFromDate(
  baseDate: string,
  baseRow: number,
): number {
  const base = new Date(baseDate);
  const today = new Date();
  const timeDiff = today.getTime() - base.getTime();
  const daysDiff = Math.floor(timeDiff / (1000 * 3600 * 24));
  return baseRow + daysDiff;
}

export function createDateBasedRange(
  sheetName: string,
  baseDate: string,
  baseRow: number,
  startCol = "A",
  endCol = "R",
): string {
  const currentRow = calculateRowFromDate(baseDate, baseRow);
  return `${sheetName}!${startCol}${currentRow}:${endCol}${currentRow}`;
}
