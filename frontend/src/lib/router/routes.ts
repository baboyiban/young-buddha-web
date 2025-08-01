import { ROUTES, ROLES, CONFIG } from "../config";
import type { PageInfo } from "./types";
import { setupGoogleLogin } from "../auth/hooks";
import { loadMissionData } from "../../pages/mission";
import { setupPaymentPage } from "../../pages/payment";

/**
 * ROUTE_ENABLE_PAYMENT: 라우터 등록/접근 가능 여부 제어 (true면 라우트 포함)
 * - 네비 표시 여부는 navbar 아이템의 data-visible 속성으로만 제어한다.
 * - 전역 NAV_SHOW_PAYMENT 같은 값은 제거한다.
 */
export const ROUTE_ENABLE_PAYMENT = true;

const baseRoutes: Record<string, PageInfo> = {
  [ROUTES.HOME]: {
    title: CONFIG.APP_NAME,
    file: "/pages/mission.html",
    roles: [ROLES.USER, ROLES.ADMIN],
    authRequired: true,
    bindFn: loadMissionData,
  },
  [ROUTES.LOGIN]: {
    title: "로그인",
    file: "/pages/login.html",
    roles: [],
    authRequired: false,
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
};

/**
 * Payment page is conditionally included based on SHOW_PAYMENT.
 * Toggle SHOW_PAYMENT to true to enable the page.
 */
// payment 페이지를 조건부로 추가
if (ROUTE_ENABLE_PAYMENT) {
  baseRoutes[ROUTES.PAYMENT] = {
    title: "일정불참 결재시트",
    file: "/pages/payment.html",
    roles: [ROLES.USER, ROLES.ADMIN],
    bindFn: setupPaymentPage,
  };
}

if (CONFIG.IS_DEV) {
  Object.values(baseRoutes).forEach((route) => {
    route.roles = [];
  });
}

export { baseRoutes as routes };
export type { PageInfo };
