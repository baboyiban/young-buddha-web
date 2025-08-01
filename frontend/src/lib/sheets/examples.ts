/**
 * Sheets 서비스 사용 예시
 */

import { sheetsService } from "./service";
import { SHEETS_CONFIG, SheetsDynamicHelper, SheetsQueryHelper } from "../config/sheets";

/**
 * 예시 1: 기존 고정된 설정을 사용한 조회
 */
export async function exampleFixedQuery() {
  try {
    // 기존 방식: 고정된 결제 스프레드시트 조회
    const query = SheetsQueryHelper.getPendingPayments(5);
    const result = await sheetsService.querySpreadsheet(
      SHEETS_CONFIG.PAYMENT.SPREADSHEET_ID,
      query
    );
    console.log("고정 설정 조회 결과:", result);
    return result;
  } catch (error) {
    console.error("고정 설정 조회 실패:", error);
    throw error;
  }
}

/**
 * 예시 2: 동적으로 스프레드시트 ID, 쿼리 지정
 */
export async function exampleDynamicQuery() {
  try {
    // 동적 방식: 임의의 스프레드시트와 쿼리 사용
    const result = await sheetsService.querySpreadsheetWithOptions({
      spreadsheetId: "1r8_mfnZAvTFmT02JHi1XgOwn_-sLCR9XgmR8wEQ4uW4",
      query: "select A, B, C where D = '완료' limit 10",
      // gid: "0",        // 선택적: 시트 ID 지정
      // range: "A1:K100" // 선택적: 범위 지정
    });
    console.log("동적 조회 결과:", result);
    return result;
  } catch (error) {
    console.error("동적 조회 실패:", error);
    throw error;
  }
}

/**
 * 예시 3: 헬퍼 함수를 사용한 동적 쿼리 생성
 */
export async function exampleHelperQuery() {
  try {
    // 헬퍼 함수를 사용하여 쿼리 생성
    const query = SheetsDynamicHelper.createSelectQuery(
      ["A", "B", "C"],           // 열 선택
      "D = '대기'",              // 조건
      "C desc",                  // 정렬
      10                         // 제한
    );

    const options = SheetsDynamicHelper.createQueryOptions(
      "1r8_mfnZAvTFmT02JHi1XgOwn_-sLCR9XgmR8wEQ4uW4",
      query,
      {
        // gid: "0",
        // range: "A1:K100"
      }
    );

    const result = await sheetsService.querySpreadsheetWithOptions(options);
    console.log("헬퍼 함수 사용 조회 결과:", result);
    return result;
  } catch (error) {
    console.error("헬퍼 함수 조회 실패:", error);
    throw error;
  }
}

/**
 * 예시 4: GET 방식 동적 조회
 */
export async function exampleGetQuery() {
  try {
    const result = await sheetsService.querySpreadsheetGet({
      spreadsheetId: "1r8_mfnZAvTFmT02JHi1XgOwn_-sLCR9XgmR8wEQ4uW4",
      query: "select count(A) group by B",
      // gid: "0",
      // range: "A1:K100"
    });
    console.log("GET 방식 조회 결과:", result);
    return result;
  } catch (error) {
    console.error("GET 방식 조회 실패:", error);
    throw error;
  }
}

/**
 * 예시 5: 그룹화 쿼리 사용
 */
export async function exampleGroupQuery() {
  try {
    const query = SheetsDynamicHelper.createGroupQuery(
      "B, count(A)",    // 선택할 열과 집계 함수
      "B",              // 그룹화할 열
      "C >= date '2024-01-01'", // 조건
      "count(A) desc",  // 정렬
      5                 // 제한
    );

    const result = await sheetsService.querySpreadsheetWithOptions({
      spreadsheetId: "1r8_mfnZAvTFmT02JHi1XgOwn_-sLCR9XgmR8wEQ4uW4",
      query: query
    });
    console.log("그룹화 조회 결과:", result);
    return result;
  } catch (error) {
    console.error("그룹화 조회 실패:", error);
    throw error;
  }
}

// 사용 예시:
// exampleFixedQuery();
// exampleDynamicQuery();
// exampleHelperQuery();
// exampleGetQuery();
// exampleGroupQuery();
