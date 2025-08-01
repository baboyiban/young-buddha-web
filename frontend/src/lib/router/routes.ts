import { ROUTES, ROLES, CONFIG } from "../config";
import { setupGoogleLogin } from "../auth/hooks";
import { loadMissionData } from "../../pages/mission";
import { setupPaymentRequestPage } from "../../pages/payment-request";
import { setupPaymentApprovalPage } from "../../pages/payment-approval";
import type { PageInfo } from "../../types";

const baseRoutes: Record<string, PageInfo> = {
  [ROUTES.HOME]: {
    title: CONFIG.APP_NAME,
    file: "/pages/mission.html",
    roles: [ROLES.USER, ROLES.ADMIN],
    bindFn: loadMissionData,
  },
  [ROUTES.LOGIN]: {
    title: "로그인",
    file: "/pages/login.html",
    roles: [],
    bindFn: setupGoogleLogin,
  },
  [ROUTES.PRIVACY]: {
    title: "개인정보 처리방침",
    file: "/pages/privacy.html",
    roles: [],
  },
  [ROUTES.TERM]: {
    title: "이용 약관",
    file: "/pages/term.html",
    roles: [],
  },
  [ROUTES.PAYMENT_REQUEST]: {
    title: "결재 신청",
    file: "/pages/payment-request.html",
    roles: [ROLES.USER, ROLES.ADMIN],
    bindFn: setupPaymentRequestPage,
  },
  [ROUTES.PAYMENT_APPROVAL]: {
    title: "결재 승인",
    file: "/pages/payment-approval.html",
    roles: [ROLES.ADMIN],
    bindFn: setupPaymentApprovalPage,
  },
  [ROUTES.SHEETS_TEST]: {
    title: "Sheets 테스트",
    file: "/pages/sheets-test.html",
    roles: [ROLES.USER, ROLES.ADMIN],
  },
};

if (CONFIG.IS_DEV) {
  Object.values(baseRoutes).forEach((route) => {
    route.roles = [];
  });
}

export { baseRoutes as routes };
export type { PageInfo };
