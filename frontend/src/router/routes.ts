import type { PageInfo } from "../types";
import { ROUTES, ROLES, CONFIG } from "../config";

export const routes: Record<string, PageInfo> = {
  [ROUTES.HOME]: {
    title: CONFIG.APP_NAME,
    file: "/pages/mission.html",
    roles: [ROLES.USER, ROLES.ADMIN],
  },
  [ROUTES.LOGIN]: {
    title: "로그인",
    file: "/pages/login.html",
    roles: [],
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

// 개발 모드에서는 모든 권한 체크를 비활성화
if (CONFIG.IS_DEV) {
  Object.values(routes).forEach(route => {
    route.roles = [];
  });
}
