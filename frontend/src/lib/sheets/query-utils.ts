import { sheetsService } from "./service";
import type { QueryResponse } from "./service";

/**
 * Google Visualization API Query Language 유틸리티 함수들
 */

/**
 * 쿼리 결과를 2차원 배열로 변환
 * @param response 쿼리 응답
 * @returns 2차원 배열 [헤더, 데이터행들]
 */
export function queryResponseToArray(response: QueryResponse): string[][] {
  if (!response.table?.rows || !response.table.cols) {
    return [];
  }

  // 헤더 행 생성
  const headers = response.table.cols.map((col: any) => col?.label || col?.id || "");

  // 데이터 행들 생성
  const dataRows = response.table.rows.map((row: any) => {
    if (!row?.c) return [];
    return row.c.map((cell: any) => {
      if (cell === null || cell === undefined) return "";
      if (cell.v === null || cell.v === undefined) return "";
      return String(cell.v);
    });
  });

  return [headers, ...dataRows];
}

/**
 * 쿼리 결과를 객체 배열로 변환
 * @param response 쿼리 응답
 * @returns 객체 배열
 */
export function queryResponseToObjectArray(response: QueryResponse): Record<string, any>[] {
  if (!response.table?.rows || !response.table.cols) {
    return [];
  }

  const headers = response.table.cols.map((col: any) => col?.label || col?.id || "");

  return response.table.rows.map((row: any) => {
    if (!row?.c) return {};
    const obj: Record<string, any> = {};
    row.c.forEach((cell: any, index: number) => {
      const key = headers[index] || `column_${index}`;
      if (cell === null || cell === undefined) {
        obj[key] = "";
      } else if (cell.v === null || cell.v === undefined) {
        obj[key] = "";
      } else {
        obj[key] = cell.v;
      }
    });
    return obj;
  });
}

/**
 * 기본 SELECT 쿼리 생성
 * @param columns 선택할 열들 (비워두면 모든 열)
 * @returns 쿼리 문자열
 */
export function createSelectQuery(columns: string[] = []): string {
  if (columns.length === 0) {
    return "SELECT *";
  }
  return `SELECT ${columns.join(", ")}`;
}

/**
 * WHERE 조건이 포함된 쿼리 생성
 * @param columns 선택할 열들
 * @param conditions WHERE 조건들
 * @returns 쿼리 문자열
 */
export function createWhereQuery(columns: string[] = [], conditions: string): string {
  const selectPart = columns.length === 0 ? "SELECT *" : `SELECT ${columns.join(", ")}`;
  return `${selectPart} WHERE ${conditions}`;
}

/**
 * ORDER BY가 포함된 쿼리 생성
 * @param columns 선택할 열들
 * @param orderBy 정렬 조건
 * @param descending 내림차순 여부
 * @returns 쿼리 문자열
 */
export function createOrderByQuery(
  columns: string[] = [],
  orderBy: string,
  descending: boolean = false
): string {
  const selectPart = columns.length === 0 ? "SELECT *" : `SELECT ${columns.join(", ")}`;
  const orderPart = descending ? `ORDER BY ${orderBy} DESC` : `ORDER BY ${orderBy}`;
  return `${selectPart} ${orderPart}`;
}

/**
 * LIMIT가 포함된 쿼리 생성
 * @param columns 선택할 열들
 * @param limit 제한할 행 수
 * @returns 쿼리 문자열
 */
export function createLimitQuery(columns: string[] = [], limit: number): string {
  const selectPart = columns.length === 0 ? "SELECT *" : `SELECT ${columns.join(", ")}`;
  return `${selectPart} LIMIT ${limit}`;
}

/**
 * GROUP BY가 포함된 쿼리 생성
 * @param columns 선택할 열들
 * @param groupBy 그룹화할 열
 * @returns 쿼리 문자열
 */
export function createGroupByQuery(columns: string[], groupBy: string): string {
  return `SELECT ${columns.join(", ")} GROUP BY ${groupBy}`;
}

/**
 * 복합 쿼리 생성
 * @param options 쿼리 옵션
 * @returns 쿼리 문자열
 */
export function createComplexQuery(options: {
  select?: string[];
  where?: string;
  orderBy?: string;
  descending?: boolean;
  limit?: number;
  groupBy?: string;
}): string {
  let query = "SELECT";

  if (options.select && options.select.length > 0) {
    query += ` ${options.select.join(", ")}`;
  } else {
    query += " *";
  }

  if (options.where) {
    query += ` WHERE ${options.where}`;
  }

  if (options.groupBy) {
    query += ` GROUP BY ${options.groupBy}`;
  }

  if (options.orderBy) {
    query += ` ORDER BY ${options.orderBy}`;
    if (options.descending) {
      query += " DESC";
    }
  }

  if (options.limit !== undefined) {
    query += ` LIMIT ${options.limit}`;
  }

  return query;
}

/**
 * 스프레드시트에서 쿼리 실행하고 결과를 2차원 배열로 반환
 * @param spreadsheetId 스프레드시트 ID
 * @param query 쿼리 문자열
 * @returns 2차원 배열
 */
export async function executeQueryToArray(
  spreadsheetId: string,
  query: string
): Promise<string[][]> {
  const response = await sheetsService.querySpreadsheet(spreadsheetId, query);
  return queryResponseToArray(response);
}

/**
 * 스프레드시트에서 쿼리 실행하고 결과를 객체 배열로 반환
 * @param spreadsheetId 스프레드시트 ID
 * @param query 쿼리 문자열
 * @returns 객체 배열
 */
export async function executeQueryToObjectArray(
  spreadsheetId: string,
  query: string
): Promise<Record<string, any>[]> {
  const response = await sheetsService.querySpreadsheet(spreadsheetId, query);
  return queryResponseToObjectArray(response);
}
