import "./style.css";
import { pageInfo } from "./lib/pageInfo";
import { includeComponent } from "./lib/components";
import { router } from "./lib/router";
import {
  updateNavbarVisibilityForRoute,
  updateNavbarActive,
} from "./lib/navbar";
import { bindLoginButton } from "./lib/login";
import { loadHomeSheetData } from "./lib/mission";

const isDev = true; // 개발 모드

// 개발 모드에서는 roles를 모두 []로 변경
if (isDev) {
  for (const key in pageInfo) {
    pageInfo[key].roles = [];
  }
}

// bindFn 할당
pageInfo["/"].bindFn = loadHomeSheetData;
pageInfo["/login"].bindFn = bindLoginButton;

includeComponent("navbar", "navbar.html", () => {
  updateNavbarActive();
});
includeComponent("payment", "payment.html", () => {
  updateNavbarActive();
});

router();
updateNavbarVisibilityForRoute();
updateNavbarActive();

window.addEventListener("hashchange", () => {
  router();
  updateNavbarVisibilityForRoute();
  updateNavbarActive();
});
