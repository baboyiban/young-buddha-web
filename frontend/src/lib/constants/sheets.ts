import { SHEET_CONFIG as APP_SHEET_CONFIG } from "@/lib/config/app";

export const SHEET_CONFIG = {
  PAYMENT: {
    ID: process.env.NEXT_PUBLIC_GOOGLE_SHEET_ID || "default_sheet_id",
    NAME: "payment",
  },
  USER: {
    ID: process.env.NEXT_PUBLIC_GOOGLE_SHEET_ID || "default_sheet_id",
    NAME: "user",
  },
};

export const API_ENDPOINTS = {
  SHEETS: "/api/sheets",
  AUTH: "/api/auth",
  DB: "/api/db",
};

// 앱 전역 시트 설정을 기반으로 실제 사용되는 시트 식별자 export
export const PAYMENT_SHEET = {
  spreadsheetId: APP_SHEET_CONFIG.PAYMENT.spreadsheetId,
  sheetName: APP_SHEET_CONFIG.PAYMENT.sheetName,
};

export const USER_SHEET = {
  spreadsheetId: APP_SHEET_CONFIG.USER.spreadsheetId,
  sheetName: APP_SHEET_CONFIG.USER.sheetName,
};
