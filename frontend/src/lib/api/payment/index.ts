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
  const query = `SELECT B WHERE A = '${safeEmail}'`;

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
  const query = `SELECT C WHERE A = '${safeEmail}'`;

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
  return role === "관리자";
}

export async function fetchFilteredPayments(
  userEmail: string,
): Promise<PaymentRequest[]> {
  if (typeof userEmail !== "string") {
    throw new Error("유효하지 않은 사용자 이메일입니다.");
  }

  let query = "";

  // userEmail이 빈 문자열이면 모든 결재 신청을 조회 (관리자용)
  if (!userEmail) {
    // 두 번째 행부터 모든 데이터 조회
    query = "SELECT * OFFSET 1";
  } else {
    const safeUserEmail = escapeSheetQueryString(userEmail).slice(0, 200);
    // B열(이메일)을 기준으로 검색하고 두 번째 행부터 조회
    query = `SELECT * WHERE B = '${safeUserEmail}'`;
  }

  const data = (await sheetsRead(
    PAYMENT_SHEET.spreadsheetId,
    PAYMENT_SHEET.sheetName,
    query,
  )) as SheetsData;

  const rows = data.table?.rows ?? [];

  // 각 행에 대해 이름 조회를 병렬로 처리
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

  return requestsWithNames.filter(
    (request: PaymentRequest) => !!request.id && request.id.trim() !== "",
  );
}

export async function fetchPaymentsByQuery(
  query: string,
): Promise<PaymentRequest[]> {
  if (typeof query !== "string" || !query.trim()) {
    throw new Error("유효하지 않은 쿼리입니다.");
  }

  const data = (await sheetsRead(
    PAYMENT_SHEET.spreadsheetId,
    PAYMENT_SHEET.sheetName,
    query,
  )) as SheetsData;

  const rows = data.table?.rows ?? [];

  // 각 행에 대해 이름 조회를 병렬로 처리
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

  return requestsWithNames.filter(
    (request: PaymentRequest) => !!request.id && request.id.trim() !== "",
  );
}