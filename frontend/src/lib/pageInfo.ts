export type PageInfo = {
  title: string;
  file: string;
  roles?: string[];
  bindFn?: () => void;
};

export const pageInfo: Record<string, PageInfo> = {
  "/": {
    title: "생활소임 일정표",
    file: "/pages/mission.html",
    roles: ["user", "admin"],
  },
  "/login": {
    title: "로그인",
    file: "/pages/login.html",
    roles: [],
  },
  "/payment": {
    title: "일정불참 결재시트",
    file: "/pages/payment.html",
    roles: ["user", "admin"],
  },
  "/privacy": {
    title: "개인정보 처리방침",
    file: "/pages/privacy.html",
    roles: [],
  },
  "/term": {
    title: "이용 약관",
    file: "/pages/term.html",
    roles: [],
  },
};
