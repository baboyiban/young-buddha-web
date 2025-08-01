import { ROUTES, ROLES, CONFIG } from "../config";
import type { PageInfo } from "./types";
import { setupGoogleLogin } from "../auth/hooks";
import { loadMissionData } from "../../pages/mission";
import { setupPaymentPage } from "../../pages/payment";

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
  [ROUTES.PAYMENT]: {
    title: "일정불참 결재시트",
    file: "/pages/payment.html",
    roles: [ROLES.USER, ROLES.ADMIN],
    bindFn: setupPaymentPage,
  },
};

if (CONFIG.IS_DEV) {
  Object.values(baseRoutes).forEach((route) => {
    route.roles = [];
  });
}

export { baseRoutes as routes };
export type { PageInfo };
