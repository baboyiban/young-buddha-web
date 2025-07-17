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
};
