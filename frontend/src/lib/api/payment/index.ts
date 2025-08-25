import { PaymentRequest } from "@/lib/types/payment";
import { PAYMENT_SHEET, USER_SHEET } from "@/lib/constants/sheets";
import { sheetsRead, escapeSheetQueryString } from "@/lib/api/sheets/client";
import { SheetsData, SheetsRow } from "@/lib/types/sheets";

// 이메일로 사용자 이름을 조회하는 함수
export async function getUserNameByEmail(email: string): Promise<string> {
  if (!email || typeof email !== "string") {
    throw new Error("유효하지 않은 이메일입니다.");
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
    throw new Error("유효하지 않은 이메일입니다.");
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
): Promise<{ data: PaymentRequest[]; totalCount: number }> {
  if (typeof userEmail !== "string") {
    throw new Error("유효하지 않은 사용자 이메일입니다.");
  }

  let query = "";

  // userEmail이 빈 문자열이면 모든 결재 신청을 조회 (관리자용)
  if (!userEmail) {
    // 두 번째 행부터 모든 데이터 조회 (페이지네이션 및 필터링 적용)
    // Google Sheets는 헤더 행을 자동으로 처리하므로 OFFSET 1은 두 번째 데이터 행부터 시작
    const offset = (page - 1) * limit;
    if (statusFilter === "전체") {
      query = `select * limit ${limit} offset ${offset + 1}`;
    } else {
      const safeStatus = escapeSheetQueryString(statusFilter).slice(0, 50);
      query = `select * where J = '${safeStatus}' limit ${limit} offset ${offset + 1}`;
    }
    console.log("🔍 [ADMIN QUERY]", {
      userEmail,
      page,
      limit,
      statusFilter,
      offset,
      query,
    });
  } else {
    const safeUserEmail = escapeSheetQueryString(userEmail).slice(0, 200);
    // B열(이메일)을 기준으로 검색 (페이지네이션 및 필터링 적용)
    const offset = (page - 1) * limit;
    if (statusFilter === "전체") {
      query = `select * where B = '${safeUserEmail}' limit ${limit} offset ${offset}`;
    } else {
      const safeStatus = escapeSheetQueryString(statusFilter).slice(0, 50);
      query = `select * where B = '${safeUserEmail}' and J = '${safeStatus}' limit ${limit} offset ${offset}`;
    }
    console.log("🔍 [USER QUERY]", {
      userEmail,
      page,
      limit,
      statusFilter,
      offset,
      query,
    });
  }

  const data = (await sheetsRead(
    PAYMENT_SHEET.spreadsheetId,
    PAYMENT_SHEET.sheetName,
    query,
  )) as SheetsData;

  console.log("📊 [QUERY RESULT]", {
    rowsCount: data.table?.rows?.length || 0,
    query: query,
    hasData: !!data.table?.rows?.length,
  });

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
    const totalCount = await getTotalPaymentCount(userEmail, statusFilter);

    return { data: paymentData, totalCount };
  }

  // 기존 방식 (개인 페이지용)
  const requestsWithNames = await Promise.all(
    rows.map(async (row: SheetsRow, idx: number): Promise<PaymentRequest> => {
      const cells = row.c ?? [];
      const email = cells[1]?.v ?? "";
      let userName = "";

      // 이메일이 있는 경우에만 이름 조회
      if (email) {
        userName = await getUserNameByEmail(email);
      }

      return {
        id: cells[0]?.v ?? `${email || "unknown"}-${idx}`,
        email: email,
        userId: cells[2]?.v ?? "",
        name: userName, // 조회한 이름 사용 (중복된 이름 무시)
        type: cells[4]?.v ?? "", // 중복된 이름 컬럼을 건너뛰고 다음 컬럼부터 사용
        requestDate: cells[5]?.v ?? "",
        absentDate: cells[6]?.v ?? "",
        schedule: cells[7]?.v ?? "",
        reason: cells[8]?.v ?? "",
        approved: cells[9]?.v ?? "",
      };
    }),
  );

  const filteredData = requestsWithNames.filter(
    (request: PaymentRequest) => !!request.id && request.id.trim() !== "",
  );

  // 총 데이터 개수 조회 (필터링 적용)
  const totalCount = await getTotalPaymentCount(userEmail, statusFilter);

  return { data: filteredData, totalCount };
}

export async function fetchPaymentsByQuery(
  query: string,
  skipNameLookup: boolean = false,
  page: number = 1,
  limit: number = 10,
): Promise<{ data: PaymentRequest[]; totalCount: number }> {
  if (typeof query !== "string" || !query.trim()) {
    throw new Error("유효하지 않은 쿼리입니다.");
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
  const requestsWithNames = await Promise.all(
    rows.map(async (row: SheetsRow, idx: number): Promise<PaymentRequest> => {
      const cells = row.c ?? [];
      const email = cells[1]?.v ?? "";
      let userName = "";

      // 이메일이 있는 경우에만 이름 조회
      if (email) {
        userName = await getUserNameByEmail(email);
      }

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
    }),
  );

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
): Promise<number> {
  try {
    let countQuery = "";
    console.log("🔢 [COUNT QUERY]", { userEmail, statusFilter });

    if (!userEmail) {
      // 전체 데이터 개수 조회 (첫 번째 행 제외, 필터링 적용)
      if (statusFilter === "전체") {
        countQuery = "select count(A)";
      } else {
        const safeStatus = escapeSheetQueryString(statusFilter).slice(0, 50);
        countQuery = `select count(A) where J = '${safeStatus}'`;
      }
    } else {
      const safeUserEmail = escapeSheetQueryString(userEmail).slice(0, 200);
      // 특정 사용자의 데이터 개수 조회 (필터링 적용)
      if (statusFilter === "전체") {
        countQuery = `select count(A) where B = '${safeUserEmail}'`;
      } else {
        const safeStatus = escapeSheetQueryString(statusFilter).slice(0, 50);
        countQuery = `select count(A) where B = '${safeUserEmail}' and J = '${safeStatus}'`;
      }
    }

    const data = (await sheetsRead(
      PAYMENT_SHEET.spreadsheetId,
      PAYMENT_SHEET.sheetName,
      countQuery,
    )) as SheetsData;

    console.log("📊 [COUNT RESULT]", {
      count: data.table?.rows?.[0]?.c?.[0]?.v || 0,
      query: countQuery,
    });

    const rows = data.table?.rows ?? [];
    if (rows.length > 0 && rows[0].c && rows[0].c[0]?.v) {
      const totalCount = Number(rows[0].c[0].v) || 0;
      // 헤더 행을 제외하기 위해 1을 뺍니다 (관리자 모드에서만)
      return !userEmail ? Math.max(0, totalCount - 1) : totalCount;
    }

    return 0;
  } catch (error) {
    console.error("총 데이터 개수 조회 실패:", error);
    return 0;
  }
}
