import { ROUTES, ROLES, CONFIG } from "../config";
import type { PageInfo } from "./types";
import { setupGoogleLogin } from "../auth/hooks";
import { loadMissionData } from "../../pages/mission";

export const routes: Record<string, PageInfo> = {
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
  [ROUTES.PAYMENT]: {
    title: "일정불참 결재시트",
    file: "/pages/payment.html",
    roles: [ROLES.USER, ROLES.ADMIN],
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

if (CONFIG.IS_DEV) {
  Object.values(routes).forEach((route) => {
    route.roles = [];
  });
}

export { routes as pageInfo };
