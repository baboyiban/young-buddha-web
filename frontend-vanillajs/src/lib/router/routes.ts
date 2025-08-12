import { ROUTES, ROLES, CONFIG } from "../config";
import { setupGoogleLogin } from "../auth/hooks";
import { loadMissionData } from "../../pages/mission";
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
    // 라우터가 진입 시 동적으로 페이지 스크립트를 import하여 바인딩
    bindFn: async () => {
      const mod = await import("../../pages/payment-request");
      if (typeof mod.setupPaymentRequestPage === "function") {
        return mod.setupPaymentRequestPage();
      }
    },
  },
  [ROUTES.PAYMENT_APPROVAL]: {
    title: "결재 승인",
    file: "/pages/payment-approval.html",
    roles: [ROLES.ADMIN],
    // 라우터가 진입 시 동적으로 페이지 스크립트를 import하여 바인딩
    bindFn: async () => {
      const mod = await import("../../pages/payment-approval");
      if (typeof mod.setupPaymentApprovalPage === "function") {
        return mod.setupPaymentApprovalPage();
      }
    },
  },
  [ROUTES.SHEETS_TEST]: {
    title: "Sheets 테스트",
    file: "/pages/sheets-test.html",
    roles: [ROLES.USER, ROLES.ADMIN],
    // 라우터가 진입 시 동적으로 페이지 스크립트를 import하여 바인딩
    bindFn: async () => {
      const mod = await import("../../pages/sheets-test");
      // sheets-test.ts는 submit/이벤트 바인딩을 모듈 로드 시 실행하는 형태이므로
      // 별도의 함수가 없더라도 import 자체로 부트스트랩됨.
      if (typeof (mod as any).default === "function") {
        return (mod as any).default();
      }
    },
  },
};

if (CONFIG.IS_DEV) {
  Object.values(baseRoutes).forEach((route) => {
    route.roles = [];
  });
}

export { baseRoutes as routes };
export type { PageInfo };
