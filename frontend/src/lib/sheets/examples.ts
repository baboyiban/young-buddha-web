import { sheetsService } from "./service";
import {
  executeQueryToArray,
  executeQueryToObjectArray,
  createComplexQuery,
  queryResponseToArray,
  queryResponseToObjectArray
} from "./query-utils";

/**
 * Google Visualization API Query Language 사용 예제
 */

// 예제 스프레드시트 ID (실제 사용시 변경 필요)
const EXAMPLE_SPREADSHEET_ID = "your_spreadsheet_id_here";

/**
 * 기본 SELECT 쿼리 예제
 */
export async function exampleSelectAll(): Promise<void> {
  try {
    const query = "SELECT *";
    const response = await sheetsService.querySpreadsheet(
      EXAMPLE_SPREADSHEET_ID,
      query
    );

    // 2차원 배열로 변환
    const arrayData = queryResponseToArray(response);
    console.log("Array data:", arrayData);

    // 객체 배열로 변환
    const objectData = queryResponseToObjectArray(response);
    console.log("Object data:", objectData);
  } catch (error) {
    console.error("Query failed:", error);
  }
}

/**
 * WHERE 조건이 있는 쿼리 예제
 */
export async function exampleWhereQuery(): Promise<void> {
  try {
    // 급여가 500 이상인 직원 조회
    const query = "SELECT * WHERE D > 500";
    const response = await sheetsService.querySpreadsheet(
      EXAMPLE_SPREADSHEET_ID,
      query
    );

    const data = queryResponseToObjectArray(response);
    console.log("High salary employees:", data);
  } catch (error) {
    console.error("Query failed:", error);
  }
}

/**
 * ORDER BY가 있는 쿼리 예제
 */
export async function exampleOrderByQuery(): Promise<void> {
  try {
    // 급여 기준 내림차순 정렬
    const query = "SELECT * ORDER BY D DESC";
    const response = await sheetsService.querySpreadsheet(
      EXAMPLE_SPREADSHEET_ID,
      query
    );

    const data = queryResponseToArray(response);
    console.log("Employees by salary (desc):", data);
  } catch (error) {
    console.error("Query failed:", error);
  }
}

/**
 * LIMIT가 있는 쿼리 예제
 */
export async function exampleLimitQuery(): Promise<void> {
  try {
    // 상위 3명의 직원만 조회
    const query = "SELECT * ORDER BY D DESC LIMIT 3";
    const response = await sheetsService.querySpreadsheet(
      EXAMPLE_SPREADSHEET_ID,
      query
    );

    const data = queryResponseToObjectArray(response);
    console.log("Top 3 employees:", data);
  } catch (error) {
    console.error("Query failed:", error);
  }
}

/**
 * GROUP BY가 있는 쿼리 예제
 */
export async function exampleGroupByQuery(): Promise<void> {
  try {
    // 부서별 평균 급여
    const query = "SELECT B, AVG(D) GROUP BY B";
    const response = await sheetsService.querySpreadsheet(
      EXAMPLE_SPREADSHEET_ID,
      query
    );

    const data = queryResponseToArray(response);
    console.log("Average salary by department:", data);
  } catch (error) {
    console.error("Query failed:", error);
  }
}

/**
 * 복합 쿼리 예제
 */
export async function exampleComplexQuery(): Promise<void> {
  try {
    // 복합 쿼리 생성
    const query = createComplexQuery({
      select: ["A", "B", "C", "D"],
      where: "D > 500",
      orderBy: "D",
      descending: true,
      limit: 5
    });

    const response = await sheetsService.querySpreadsheet(
      EXAMPLE_SPREADSHEET_ID,
      query
    );

    const data = queryResponseToObjectArray(response);
    console.log("Complex query result:", data);
  } catch (error) {
    console.error("Query failed:", error);
  }
}

/**
 * 실제 결재 요청 데이터 조회 예제
 */
export async function examplePaymentRequests(): Promise<void> {
  try {
    // 최근 10개의 결재 요청을 날짜순으로 정렬
    const query = createComplexQuery({
      select: ["A", "B", "C", "D", "E", "F", "G", "H"], // 필요한 열만 선택
      orderBy: "D", // 요청 날짜 기준 정렬
      descending: true,
      limit: 10
    });

    const response = await sheetsService.querySpreadsheet(
      EXAMPLE_SPREADSHEET_ID,
      query
    );

    const requests = queryResponseToObjectArray(response);
    console.log("Recent payment requests:", requests);

    // 상태가 '대기'인 요청만 필터링
    const pendingRequests = requests.filter(req => req.H === "대기");
    console.log("Pending requests:", pendingRequests);
  } catch (error) {
    console.error("Query failed:", error);
  }
}

/**
 * 날짜 범위로 데이터 조회 예제
 */
export async function exampleDateRangeQuery(): Promise<void> {
  try {
    // 특정 날짜 범위의 데이터 조회
    const query = "SELECT * WHERE D >= DATE '2024-01-01' AND D <= DATE '2024-12-31'";
    const response = await sheetsService.querySpreadsheet(
      EXAMPLE_SPREADSHEET_ID,
      query
    );

    const data = queryResponseToObjectArray(response);
    console.log("2024 requests:", data);
  } catch (error) {
    console.error("Query failed:", error);
  }
}

/**
 * 텍스트 검색 예제
 */
export async function exampleTextSearch(): Promise<void> {
  try {
    // 이름에 'John'이 포함된 직원 검색
    const query = "SELECT * WHERE B CONTAINS 'John'";
    const response = await sheetsService.querySpreadsheet(
      EXAMPLE_SPREADSHEET_ID,
      query
    );

    const data = queryResponseToArray(response);
    console.log("Employees with 'John' in name:", data);
  } catch (error) {
    console.error("Query failed:", error);
  }
}

// 사용 예제
/*
// 컴포넌트에서 사용 예시
async function loadPaymentData() {
  try {
    // 기본 조회
    await exampleSelectAll();
    
    // 조건부 조회
    await exampleWhereQuery();
    
    // 정렬된 데이터
    await exampleOrderByQuery();
    
    // 제한된 데이터
    await exampleLimitQuery();
    
    // 그룹화된 데이터
    await exampleGroupByQuery();
    
    // 복합 쿼리
    await exampleComplexQuery();
    
    // 실제 결재 요청 데이터
    await examplePaymentRequests();
    
  } catch (error) {
    console.error("Failed to load data:", error);
  }
}
*/
