export type PageInfo = {
  title: string;
  file: string;
  roles?: string[];
  bindFn?: () => void;
};

export const pageInfo: Record<string, PageInfo> = {
  "/": {
    title: "메인 페이지",
    file: "/pages/page.html",
    roles: ["user", "admin"],
  },
  "/login": {
    title: "로그인",
    file: "/pages/login.html",
    roles: [],
    // bindFn은 main.ts에서 import해서 할당
  },
  "/payment": {
    title: "일정 불참 결재 시트",
    file: "/pages/payment.html",
    roles: [],
  },
};
