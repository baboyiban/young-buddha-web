import {
  PaymentRequest,
  PaymentType,
  PaymentStatus,
} from "@/lib/types/payment";
import { PAYMENT_SHEET, USER_SHEET } from "@/lib/constants/sheets";
import {
  sheetsRead,
  sheetsUpdate,
  escapeSheetQueryString,
} from "@/lib/api/sheets/client";
import { SheetsData, SheetsRow } from "@/lib/types/sheets";
import { ValidationError } from "@/lib/errors";

// 시트 열(Column) 상수화
const PAYMENT_COLUMNS = {
  ID: "A",
  EMAIL: "B",
  USER_ID: "C",
  NAME: "D",
  TYPE: "E",
  REQUEST_DATE: "F",
  STATUS: "J",
};

const USER_COLUMNS = {
  EMAIL: "A",
  NAME: "B",
  ROLE: "C",
};

// --- 내부 헬퍼 함수들 ---

// 값 정규화 유틸: 시트 원시 값을 도메인 타입으로 변환
function normalizePaymentType(value?: string | null): PaymentType {
  const v = String(value ?? "").trim();
  switch (v) {
    case "정기":
    case "비정기":
    case "추가요청":
    case "사후알림":
    case "야근신청":
    case "기타":
      return v as PaymentType;
    default: {
      const lower = v.toLowerCase();
      if (lower.includes("regular")) return "정기";
      if (
        lower.includes("irregular") ||
        lower.includes("one-off") ||
        lower.includes("one off")
      )
        return "비정기";
      if (lower.includes("extra") || lower.includes("추가")) return "추가요청";
      if (
        lower.includes("after") ||
        lower.includes("post") ||
        lower.includes("사후")
      )
        return "사후알림";
      if (lower.includes("overtime") || lower.includes("야근"))
        return "야근신청";
      return "기타";
    }
  }
}

function normalizePaymentStatus(value?: string | null): PaymentStatus {
  const v = String(value ?? "").trim();
  switch (v) {
    case "":
    case "대기":
    case "승인":
    case "반려":
      return v as PaymentStatus;
    default: {
      const lower = v.toLowerCase();
      if (lower.includes("pending") || lower.includes("대기")) return "대기";
      if (lower.includes("approved") || lower.includes("승인")) return "승인";
      if (
        lower.includes("rejected") ||
        lower.includes("deny") ||
        lower.includes("denied") ||
        lower.includes("반려")
      )
        return "반려";
      return "";
    }
  }
}

/**
 * SheetsRow 데이터를 PaymentRequest 객체로 변환합니다.
 * @param row - 변환할 시트의 행 데이터
 * @param name - (선택) 사용자 이름 (제공되지 않으면 시트의 이름을 사용)
 * @returns 변환된 PaymentRequest 객체
 */
function _mapRowToPaymentRequest(
  row: SheetsRow,
  name?: string,
): PaymentRequest {
  const cells = row.c ?? [];
  const email = (cells[1]?.v as string) ?? "";

  return {
    id: (cells[0]?.v as string) ?? `${email || "unknown"}-${Date.now()}`,
    email: email,
    userId: (cells[2]?.v as string) ?? "",
    name: name ?? (cells[3]?.v as string) ?? email.split("@")[0],
    type: normalizePaymentType(cells[4]?.v as string),
    requestDate: (cells[5]?.v as string) ?? "",
    absentDate: (cells[6]?.v as string) ?? "",
    schedule: (cells[7]?.v as string) ?? "",
    reason: (cells[8]?.v as string) ?? "",
    approved: normalizePaymentStatus(cells[9]?.v as string),
  };
}

/**
 * 조회된 시트 행들의 목록을 처리하여 PaymentRequest 배열로 변환합니다.
 * 이름 조회 로직(skipNameLookup)을 포함합니다.
 * @param rows - 조회된 시트 행 데이터 배열
 * @param skipNameLookup - 사용자 이름 조회를 건너뛸지 여부
 * @returns 변환된 PaymentRequest 객체 배열
 */
async function _processPaymentRows(
  rows: SheetsRow[],
  skipNameLookup: boolean,
): Promise<PaymentRequest[]> {
  // 헤더 행 제외 (ID가 "고유 번호"인 행 제외)
  const validRows = rows.filter((row) => {
    const id = row.c?.[0]?.v;
    return id && String(id).trim() !== "" && String(id).trim() !== "고유 번호";
  });

  if (skipNameLookup) {
    return validRows.map((row) => _mapRowToPaymentRequest(row));
  }

  // 이름 조회가 필요한 경우
  const emails = Array.from(
    new Set(validRows.map((row) => row.c?.[1]?.v as string).filter(Boolean)),
  );

  const emailToNameMap = new Map<string, string>();
  if (emails.length > 0) {
    const names = await Promise.all(
      emails.map((email) => getUserNameByEmail(email)),
    );
    emails.forEach((email, index) => emailToNameMap.set(email, names[index]));
  }

  return validRows.map((row) => {
    const email = row.c?.[1]?.v as string;
    const userName = email ? emailToNameMap.get(email) : undefined;
    return _mapRowToPaymentRequest(row, userName);
  });
}

/**
 * 이메일을 기반으로 사용자 시트에서 특정 열의 데이터를 조회하는 범용 함수
 * @param email - 조회할 사용자 이메일
 * @param columnToSelect - 조회할 열 (예: 'B' for name, 'C' for role)
 * @returns 조회된 데이터 (문자열)
 */
async function _getUserDataByEmail(
  email: string,
  columnToSelect: "B" | "C",
): Promise<string | null> {
  if (!email || typeof email !== "string") {
    throw new ValidationError("유효하지 않은 이메일입니다.");
  }

  const safeEmail = escapeSheetQueryString(email).slice(0, 200);
  const query = `select ${columnToSelect} where ${USER_COLUMNS.EMAIL} = '${safeEmail}'`;

  const data = (await sheetsRead(
    USER_SHEET.spreadsheetId,
    USER_SHEET.gid,
    query,
  )) as SheetsData;

  return data.table?.rows?.[0]?.c?.[0]?.v as string | null;
}

// --- 쿼리 빌더 헬퍼 함수들 (기존과 동일, 가독성을 위해 상수 사용) ---

function buildWhereConditions(
  userEmail: string | null,
  statusFilter: string,
  typeFilter?: string,
): string[] {
  const conditions: string[] = [];

  if (userEmail) {
    conditions.push(
      `${PAYMENT_COLUMNS.EMAIL} = '${escapeSheetQueryString(userEmail)}'`,
    );
  }
  if (statusFilter !== "전체") {
    conditions.push(
      `${PAYMENT_COLUMNS.STATUS} = '${escapeSheetQueryString(statusFilter)}'`,
    );
  }
  if (typeFilter && typeFilter !== "전체") {
    conditions.push(
      `${PAYMENT_COLUMNS.TYPE} = '${escapeSheetQueryString(typeFilter)}'`,
    );
  }

  return conditions;
}

function buildCountQuery(conditions: string[]): string {
  // 헤더 행 제외 조건 추가
  const headerExclude = `${PAYMENT_COLUMNS.ID} != '고유 번호' and ${PAYMENT_COLUMNS.ID} is not null`;
  const allConditions = conditions.length > 0
    ? [headerExclude, ...conditions]
    : [headerExclude];
  const whereClause = `where ${allConditions.join(" and ")}`;
  return `select count(${PAYMENT_COLUMNS.ID}) ${whereClause}`;
}

// --- 공개 API 함수들 (Exported Functions) ---

export async function getUserNameByEmail(email: string): Promise<string> {
  const name = await _getUserDataByEmail(email, "B");
  return name || email.split("@")[0]; // 이름을 찾지 못한 경우 이메일의 @ 앞부분 사용
}

export async function getUserRoleByEmail(email: string): Promise<string> {
  const role = await _getUserDataByEmail(email, "C");
  return role || "사용자"; // 권한을 찾지 못한 경우 기본값 "사용자"
}

export async function isAdmin(email: string): Promise<boolean> {
  const role = await getUserRoleByEmail(email);
  return role === "ADMIN";
}

/**
 * 필터 조건에 따라 결재 목록과 전체 개수를 조회합니다.
 * 서버 측 페이지네이션을 사용하여 성능을 최적화합니다.
 */
export async function fetchFilteredPayments(
  userEmail: string,
  skipNameLookup: boolean = false,
  page: number = 1,
  limit: number = 10,
  statusFilter: string = "전체",
  typeFilter?: string,
  sortOrder: string = "desc",
): Promise<{ data: PaymentRequest[]; totalCount: number }> {
  if (typeof userEmail !== "string") {
    throw new ValidationError("유효하지 않은 사용자 이메일입니다.");
  }

  // 서버 측 필터링 조건
  const conditions = buildWhereConditions(
    userEmail || null,
    statusFilter,
    typeFilter,
  );
  
  // 서버 측 페이지네이션 적용
  const offset = (page - 1) * limit;
  const query = `select * ${conditions.length > 0 ? `where ${conditions.join(" and ")}` : ""} order by ${PAYMENT_COLUMNS.REQUEST_DATE} ${sortOrder} limit ${limit} offset ${offset}`;

  const data = (await sheetsRead(
    PAYMENT_SHEET.spreadsheetId,
    PAYMENT_SHEET.gid,
    query,
  )) as SheetsData;
  const rows = data.table?.rows ?? [];

  const paymentData = await _processPaymentRows(rows, skipNameLookup);
  
  // 전체 개수 조회 (필터 조건에 맞는 총 개수)
  const totalCount = await getTotalPaymentCount(userEmail || null, statusFilter, typeFilter);
  
  return { data: paymentData, totalCount };
}

/**
 * 전체 쿼리 문자열을 직접 사용하여 결재 목록을 조회합니다.
 */
export async function fetchPaymentsByQuery(
  query: string,
  skipNameLookup: boolean = false,
): Promise<{ data: PaymentRequest[]; totalCount: number }> {
  if (typeof query !== "string" || !query.trim()) {
    throw new ValidationError("유효하지 않은 쿼리입니다.");
  }

  const data = (await sheetsRead(
    PAYMENT_SHEET.spreadsheetId,
    PAYMENT_SHEET.gid,
    query,
  )) as SheetsData;
  const rows = data.table?.rows ?? [];

  const paymentData = await _processPaymentRows(rows, skipNameLookup);

  // 이 경우, 전체 개수는 조회된 데이터의 개수와 동일
  return { data: paymentData, totalCount: paymentData.length };
}

/**
 * 페이지 단위로 결재 목록만 조회합니다. (totalCount 계산 없음)
 * 서버 측 페이지네이션을 사용하여 성능을 최적화합니다.
 */
export async function fetchPaymentsPage(
  userEmail: string,
  skipNameLookup: boolean = true,
  page: number = 1,
  limit: number = 10,
  statusFilter: string = "전체",
  typeFilter?: string,
  sortOrder: string = "desc",
): Promise<PaymentRequest[]> {
  if (typeof userEmail !== "string") {
    throw new ValidationError("유효하지 않은 사용자 이메일입니다.");
  }

  // 서버 측 필터링 조건
  const conditions = buildWhereConditions(
    userEmail || null,
    statusFilter,
    typeFilter,
  );
  
  // 서버 측 페이지네이션 적용
  const offset = (page - 1) * limit;
  const query = `select * ${conditions.length > 0 ? `where ${conditions.join(" and ")}` : ""} order by ${PAYMENT_COLUMNS.REQUEST_DATE} ${sortOrder} limit ${limit} offset ${offset}`;

  const data = (await sheetsRead(
    PAYMENT_SHEET.spreadsheetId,
    PAYMENT_SHEET.gid,
    query,
  )) as SheetsData;
  const rows = data.table?.rows ?? [];

  return await _processPaymentRows(rows, skipNameLookup);
}

/**
 * 필터 조건에 맞는 총 결재 신청 개수를 조회합니다.
 */
export async function getTotalPaymentCount(
  userEmail: string | null, // null을 허용하여 전체 조회를 명시적으로 표현
  statusFilter: string = "전체",
  typeFilter?: string,
): Promise<number> {
  try {
    const conditions = buildWhereConditions(
      userEmail,
      statusFilter,
      typeFilter,
    );
    const countQuery = buildCountQuery(conditions);

    const data = (await sheetsRead(
      PAYMENT_SHEET.spreadsheetId,
      PAYMENT_SHEET.gid,
      countQuery,
    )) as SheetsData;

    const totalCount = Number(data.table?.rows?.[0]?.c?.[0]?.v) || 0;
    return Math.max(0, totalCount);
  } catch {
    return 0;
  }
}

export async function updatePaymentStatus(
  paymentId: string,
  status: string,
): Promise<boolean> {
  if (typeof paymentId !== "string" || !paymentId.trim()) {
    throw new ValidationError("유효하지 않은 결재 ID입니다.");
  }

  const normalizedStatus = normalizePaymentStatus(status);
  const whereId = escapeSheetQueryString(paymentId.trim());

  // 기존 행 조회
  const selectQuery = `select * where ${PAYMENT_COLUMNS.ID} = '${whereId}'`;
  const data = (await sheetsRead(
    PAYMENT_SHEET.spreadsheetId,
    PAYMENT_SHEET.gid,
    selectQuery,
  )) as SheetsData;

  const row = data.table?.rows?.[0];
  if (!row) {
    throw new ValidationError("해당 결재 신청을 찾을 수 없습니다.");
  }

  const cells = row.c ?? [];
  const updatedRow = [
    cells[0]?.v ?? "",
    cells[1]?.v ?? "",
    cells[2]?.v ?? "",
    cells[3]?.v ?? "",
    cells[4]?.v ?? "",
    cells[5]?.v ?? "",
    cells[6]?.v ?? "",
    cells[7]?.v ?? "",
    cells[8]?.v ?? "",
    normalizedStatus,
  ];

  let updateQuery = `UPDATE WHERE A = '${whereId}' VALUES ${JSON.stringify(updatedRow)}`;

   try {
     await sheetsUpdate(
       PAYMENT_SHEET.spreadsheetId,
       PAYMENT_SHEET.gid,
       updateQuery,
     );
   } catch {
     // 작은따옴표 파싱 이슈 대비 더블쿼트 fallback
     updateQuery = `UPDATE WHERE A = "${whereId}" VALUES ${JSON.stringify(updatedRow)}`;
     await sheetsUpdate(
       PAYMENT_SHEET.spreadsheetId,
       PAYMENT_SHEET.gid,
       updateQuery,
     );
   }

  return true;
}
