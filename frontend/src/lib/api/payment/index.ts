import { PaymentRequest } from "@/lib/types/payment";
import { PAYMENT_SHEET, USER_SHEET } from "@/lib/constants/sheets";
import { sheetsRead, escapeSheetQueryString } from "@/lib/api/sheets/client";
import { SheetsData, SheetsRow } from "@/lib/types/sheets";
import { ValidationError } from "@/lib/errors";

// 이메일로 사용자 이름을 조회하는 함수
export async function getUserNameByEmail(email: string): Promise<string> {
  if (!email || typeof email !== "string") {
    throw new ValidationError("유효하지 않은 이메일입니다.");
  }

  const safeEmail = escapeSheetQueryString(email).slice(0, 200);
  // A열(이메일)을 기준으로 검색하여 B열(이름)을 선택
  const query = `select B where A = '${safeEmail}'`;

  const data = (await sheetsRead(
    USER_SHEET.spreadsheetId,
    USER_SHEET.sheetName,
    query,
  )) as SheetsData;

  const rows = data.table?.rows ?? [];
  if (rows.length > 0 && rows[0].c && rows[0].c[0]?.v) {
    return rows[0].c[0].v as string;
  }

  // 이름을 찾지 못한 경우 이메일의 @ 앞부분을 사용
  return email.split("@")[0];
}

// 이메일로 사용자 권한을 조회하는 함수
export async function getUserRoleByEmail(email: string): Promise<string> {
  if (!email || typeof email !== "string") {
    throw new ValidationError("유효하지 않은 이메일입니다.");
  }

  const safeEmail = escapeSheetQueryString(email).slice(0, 200);
  // A열(이메일)을 기준으로 검색하여 C열(권한)을 선택
  const query = `select C where A = '${safeEmail}'`;

  const data = (await sheetsRead(
    USER_SHEET.spreadsheetId,
    USER_SHEET.sheetName,
    query,
  )) as SheetsData;

  const rows = data.table?.rows ?? [];
  if (rows.length > 0 && rows[0].c && rows[0].c[0]?.v) {
    return rows[0].c[0].v as string;
  }

  // 권한을 찾지 못한 경우 기본값 "사용자"
  return "사용자";
}

// 관리자 권한 확인 함수
export async function isAdmin(email: string): Promise<boolean> {
  const role = await getUserRoleByEmail(email);
  return role === "ADMIN";
}

export async function fetchFilteredPayments(
  userEmail: string,
  skipNameLookup: boolean = false,
  page: number = 1,
  limit: number = 10,
  statusFilter: string = "전체",
  typeFilter?: string, // 추가: 타입 필터 (정기, 비정기)
  sortOrder: string = "desc", // desc: 최신순, asc: 오래된순
): Promise<{ data: PaymentRequest[]; totalCount: number }> {
  if (typeof userEmail !== "string") {
    throw new ValidationError("유효하지 않은 사용자 이메일입니다.");
  }

  let query = "";

  // userEmail이 빈 문자열이면 모든 결재 신청을 조회 (관리자용)
  if (!userEmail) {
    // 두 번째 행부터 모든 데이터 조회 (페이지네이션 및 필터링 적용)
    // Google Sheets는 헤더 행을 자동으로 처리하므로 OFFSET 1은 두 번째 데이터 행부터 시작
    const offset = (page - 1) * limit;

    // 기본 조건 배열
    const conditions: string[] = [];

    // 상태 필터 조건
    if (statusFilter !== "전체") {
      const safeStatus = escapeSheetQueryString(statusFilter).slice(0, 50);
      conditions.push(`J = '${safeStatus}'`);
    }

    // 타입 필터 조건
    if (typeFilter && typeFilter !== "전체") {
      const safeType = escapeSheetQueryString(typeFilter).slice(0, 50);
      conditions.push(`E = '${safeType}'`);
    }

    // 쿼리 생성
    if (conditions.length > 0) {
      query = `select * where ${conditions.join(' and ')} order by F ${sortOrder} limit ${limit} offset ${offset + 1}`;
    } else {
      query = `select * order by F ${sortOrder} limit ${limit} offset ${offset + 1}`;
    }
  } else {
    const safeUserEmail = escapeSheetQueryString(userEmail).slice(0, 200);
    // B열(이메일)을 기준으로 검색 (페이지네이션 및 필터링 적용)
    const offset = (page - 1) * limit;

    // 기본 조건 배열 (이메일 조건은 항상 포함)
    const conditions: string[] = [`B = '${safeUserEmail}'`];

    // 상태 필터 조건
    if (statusFilter !== "전체") {
      const safeStatus = escapeSheetQueryString(statusFilter).slice(0, 50);
      conditions.push(`J = '${safeStatus}'`);
    }

    // 타입 필터 조건
    if (typeFilter && typeFilter !== "전체") {
      const safeType = escapeSheetQueryString(typeFilter).slice(0, 50);
      conditions.push(`E = '${safeType}'`);
    }

    // 쿼리 생성
    query = `select * where ${conditions.join(' and ')} order by F ${sortOrder} limit ${limit} offset ${offset}`;
  }

  const data = (await sheetsRead(
    PAYMENT_SHEET.spreadsheetId,
    PAYMENT_SHEET.sheetName,
    query,
  )) as SheetsData;

  const rowsCount = data.table?.rows?.length || 0;

  const rows = data.table?.rows ?? [];

  // 이름 조회 생략 모드 (관리자 페이지용)
  if (skipNameLookup) {
    const paymentData = rows
      .map((row: SheetsRow, idx: number): PaymentRequest => {
        const cells = row.c ?? [];
        const email = cells[1]?.v ?? "";

        return {
          id: cells[0]?.v ?? `${email || "unknown"}-${idx}`,
          email: email,
          userId: cells[2]?.v ?? "",
          name: cells[3]?.v ?? email.split("@")[0], // 시트에 있는 이름 사용
          type: cells[4]?.v ?? "",
          requestDate: cells[5]?.v ?? "",
          absentDate: cells[6]?.v ?? "",
          schedule: cells[7]?.v ?? "",
          reason: cells[8]?.v ?? "",
          approved: cells[9]?.v ?? "",
        };
      })
      .filter(
        (request: PaymentRequest) => !!request.id && request.id.trim() !== "",
      );

    // 총 데이터 개수 조회 (필터링 적용)
    const totalCount = await getTotalPaymentCount(userEmail, statusFilter, typeFilter);

    return { data: paymentData, totalCount };
  }

  // 기존 방식 (개인 페이지용)
  // 먼저 모든 이메일을 수집
  const emails = new Set<string>();
  rows.forEach((row: SheetsRow) => {
    const cells = row.c ?? [];
    const email = cells[1]?.v ?? "";
    if (email) {
      emails.add(email);
    }
  });

  // 이메일별 이름 매핑 생성 (일괄 조회)
  const emailToNameMap = new Map<string, string>();
  if (emails.size > 0) {
    const emailList = Array.from(emails);
    const names = await Promise.all(
      emailList.map(email => getUserNameByEmail(email))
    );
    emailList.forEach((email, index) => {
      emailToNameMap.set(email, names[index]);
    });
  }

  const requestsWithNames = rows.map((row: SheetsRow, idx: number): PaymentRequest => {
    const cells = row.c ?? [];
    const email = cells[1]?.v ?? "";
    const userName = email ? emailToNameMap.get(email) || email.split("@")[0] : "";

    return {
      id: cells[0]?.v ?? `${email || "unknown"}-${idx}`,
      email: email,
      userId: cells[2]?.v ?? "",
      name: userName, // 조회한 이름 사용
      type: cells[4]?.v ?? "",
      requestDate: cells[5]?.v ?? "",
      absentDate: cells[6]?.v ?? "",
      schedule: cells[7]?.v ?? "",
      reason: cells[8]?.v ?? "",
      approved: cells[9]?.v ?? "",
    };
  });

  const filteredData = requestsWithNames.filter(
    (request: PaymentRequest) => !!request.id && request.id.trim() !== "",
  );

  // 총 데이터 개수 조회 (필터링 적용)
  const totalCount = await getTotalPaymentCount(userEmail, statusFilter, typeFilter);

  return { data: filteredData, totalCount };
}

export async function fetchPaymentsByQuery(
  query: string,
  skipNameLookup: boolean = false,
  page: number = 1,
  limit: number = 10,
): Promise<{ data: PaymentRequest[]; totalCount: number }> {
  if (typeof query !== "string" || !query.trim()) {
    throw new ValidationError("유효하지 않은 쿼리입니다.");
  }

  const data = (await sheetsRead(
    PAYMENT_SHEET.spreadsheetId,
    PAYMENT_SHEET.sheetName,
    query,
  )) as SheetsData;

  const rows = data.table?.rows ?? [];

  // 이름 조회 생략 모드 (관리자 페이지용)
  if (skipNameLookup) {
    const paymentData = rows
      .map((row: SheetsRow, idx: number): PaymentRequest => {
        const cells = row.c ?? [];
        const email = cells[1]?.v ?? "";

        return {
          id: cells[0]?.v ?? `${email || "unknown"}-${idx}`,
          email: email,
          userId: cells[2]?.v ?? "",
          name: cells[3]?.v ?? email.split("@")[0], // 시트에 있는 이름 사용
          type: cells[4]?.v ?? "",
          requestDate: cells[5]?.v ?? "",
          absentDate: cells[6]?.v ?? "",
          schedule: cells[7]?.v ?? "",
          reason: cells[8]?.v ?? "",
          approved: cells[9]?.v ?? "",
        };
      })
      .filter(
        (request: PaymentRequest) => !!request.id && request.id.trim() !== "",
      );

    // 총 데이터 개수 조회 (쿼리 기반이므로 전체 개수는 현재 페이지 데이터만 반환)
    return { data: paymentData, totalCount: paymentData.length };
  }

  // 기존 방식 (개인 페이지용)
  // 먼저 모든 이메일을 수집
  const emails = new Set<string>();
  rows.forEach((row: SheetsRow) => {
    const cells = row.c ?? [];
    const email = cells[1]?.v ?? "";
    if (email) {
      emails.add(email);
    }
  });

  // 이메일별 이름 매핑 생성 (일괄 조회)
  const emailToNameMap = new Map<string, string>();
  if (emails.size > 0) {
    const emailList = Array.from(emails);
    const names = await Promise.all(
      emailList.map(email => getUserNameByEmail(email))
    );
    emailList.forEach((email, index) => {
      emailToNameMap.set(email, names[index]);
    });
  }

  const requestsWithNames = rows.map((row: SheetsRow, idx: number): PaymentRequest => {
    const cells = row.c ?? [];
    const email = cells[1]?.v ?? "";
    const userName = email ? emailToNameMap.get(email) || email.split("@")[0] : "";

    return {
      id: cells[0]?.v ?? `${email || "unknown"}-${idx}`,
      email: email,
      userId: cells[2]?.v ?? "",
      name: userName, // 조회한 이름 사용
      type: cells[4]?.v ?? "",
      requestDate: cells[5]?.v ?? "",
      absentDate: cells[6]?.v ?? "",
      schedule: cells[7]?.v ?? "",
      reason: cells[8]?.v ?? "",
      approved: cells[9]?.v ?? "",
    };
  });

  const filteredData = requestsWithNames.filter(
    (request: PaymentRequest) => !!request.id && request.id.trim() !== "",
  );

  // 총 데이터 개수 조회 (쿼리 기반이므로 전체 개수는 현재 페이지 데이터만 반환)
  return { data: filteredData, totalCount: filteredData.length };
}

// 총 결재 신청 개수 조회 함수 (필터링 지원)
async function getTotalPaymentCount(
  userEmail: string,
  statusFilter: string = "전체",
  typeFilter?: string, // 추가: 타입 필터 (정기, 비정기)
): Promise<number> {
  try {
    let countQuery = "";

    if (!userEmail) {
      // 전체 데이터 개수 조회 (첫 번째 행 제외, 필터링 적용)
      const conditions: string[] = [];

      // 상태 필터 조건
      if (statusFilter !== "전체") {
        const safeStatus = escapeSheetQueryString(statusFilter).slice(0, 50);
        conditions.push(`J = '${safeStatus}'`);
      }

      // 타입 필터 조건
      if (typeFilter && typeFilter !== "전체") {
        const safeType = escapeSheetQueryString(typeFilter).slice(0, 50);
        conditions.push(`E = '${safeType}'`);
      }

      // 쿼리 생성
      if (conditions.length > 0) {
        countQuery = `select count(A) where ${conditions.join(' and ')}`;
      } else {
        countQuery = "select count(A)";
      }
    } else {
      const safeUserEmail = escapeSheetQueryString(userEmail).slice(0, 200);
      // 특정 사용자의 데이터 개수 조회 (필터링 적용)
      const conditions: string[] = [`B = '${safeUserEmail}'`];

      // 상태 필터 조건
      if (statusFilter !== "전체") {
        const safeStatus = escapeSheetQueryString(statusFilter).slice(0, 50);
        conditions.push(`J = '${safeStatus}'`);
      }

      // 타입 필터 조건
      if (typeFilter && typeFilter !== "전체") {
        const safeType = escapeSheetQueryString(typeFilter).slice(0, 50);
        conditions.push(`E = '${safeType}'`);
      }

      // 쿼리 생성
      countQuery = `select count(A) where ${conditions.join(' and ')}`;
    }

    const data = (await sheetsRead(
      PAYMENT_SHEET.spreadsheetId,
      PAYMENT_SHEET.sheetName,
      countQuery,
    )) as SheetsData;

    const count = data.table?.rows?.[0]?.c?.[0]?.v || 0;

    const rows = data.table?.rows ?? [];
    if (rows.length > 0 && rows[0].c && rows[0].c[0]?.v) {
      const totalCount = Number(rows[0].c[0].v) || 0;
      // 헤더 행을 제외하기 위해 1을 뺍니다 (관리자 모드에서만)
      // 일반 사용자 모드에서는 where 절이 헤더를 제외하므로 뺄 필요 없음
      if (!userEmail) {
        return Math.max(0, totalCount - 1);
      }
      return totalCount;
    }

    return 0;
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("총 데이터 개수 조회 실패:", error);
    }
    return 0;
  }
}
