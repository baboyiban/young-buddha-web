import { requireRole, requireAuth, setupGoogleLogin } from "./auth";
import { ROUTES, ROLES, CONFIG } from "./config";
import type { PageInfo } from "./types";
import { updateNavbarActiveState } from "../components/navbar";

export const routes: Record<string, PageInfo> = {
  [ROUTES.HOME]: {
    title: CONFIG.APP_NAME,
    file: "/pages/mission.html",
    roles: [ROLES.USER, ROLES.ADMIN],
    authRequired: true,
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

let currentPath = "";

export async function router(): Promise<void> {
  const hash = location.hash.replace(/^#/, "") || "/";
  const route = routes[hash];
  if (hash === currentPath) return;
  if (!route) {
    document.title = "404 Not Found";
    const titleEl = document.getElementById("page-title");
    if (titleEl) titleEl.textContent = "404 Not Found";
    document.getElementById("page-content")!.innerHTML =
      "<h2>페이지를 찾을 수 없습니다.</h2>";
    return;
  }
  document.title = route.title;
  const titleEl = document.getElementById("page-title");
  if (titleEl) titleEl.textContent = route.title;
  if (route.roles && route.roles.length > 0) {
    try {
      if (route.authRequired) {
        await requireAuth();
      }
      await requireRole(route.roles);
    } catch {
      return;
    }
  }
  try {
    const response = await fetch(route.file);
    const html = await response.text();
    document.getElementById("page-content")!.innerHTML = html;
    currentPath = hash;
    updateNavbarActiveState();
    if (route.bindFn) await route.bindFn();
  } catch {
    document.getElementById("page-content")!.innerHTML =
      "<h2>페이지를 로드할 수 없습니다.</h2>";
  }
}

export { routes as pageInfo };
