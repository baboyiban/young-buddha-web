import "./style.css";

const isDev = true; // 개발 모드

const pageInfo: Record<
  string,
  { title: string; file: string; roles?: string[]; bindFn?: () => void }
> = {
  "/": {
    title: "메인 페이지",
    file: "/pages/page.html",
    roles: ["user", "admin"],
  },
  "/login": {
    title: "로그인",
    file: "/pages/login.html",
    roles: [],
    bindFn: bindLoginButton,
  },
  "/payment": {
    title: "일정 불참 결재 시트",
    file: "/pages/payment.html",
    roles: [],
  },
};

// 개발 모드에서는 roles를 모두 []로 변경 (즉, 모두 접근 가능)
if (isDev) {
  for (const key in pageInfo) {
    pageInfo[key].roles = [];
  }
}

function includeComponent(id: string, file: string, callback?: () => void) {
  const el = document.getElementById(id);
  if (!el) return;
  fetch(`/components/${file}`)
    .then((res) => res.text())
    .then((html) => {
      el.innerHTML = html;
      if (callback) callback();
    });
}

function bindLoginButton() {
  const loginBtn = document.getElementById(
    "google-login-btn",
  ) as HTMLButtonElement | null;
  if (!loginBtn) return;

  loginBtn.addEventListener("click", async () => {
    try {
      const res = await fetch("/api/auth/google", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        alert("인증 시작 실패");
        return;
      }
      const { auth_url } = await res.json();
      window.open(auth_url, "googleLoginPopup", "width=500,height=600");
    } catch (e) {
      alert("네트워크 오류");
      console.error(e);
    }
  });

  window.addEventListener("message", (event: MessageEvent) => {
    if ((event.data as any)?.type === "LOGIN_SUCCESS") {
      location.hash = "#/";
    }
  });
}

function hasRequiredRole(user: any, requiredRoles?: string[]) {
  if (!requiredRoles || requiredRoles.length === 0) return true;
  if (!user || !user.roles) return false;
  return requiredRoles.some((role) => user.roles.includes(role));
}

async function router() {
  const hash = location.hash.replace(/^#/, "") || "/";
  const info = pageInfo[hash];

  if (!info) {
    document.title = "404 Not Found";
    const titleEl = document.getElementById("page-title");
    if (titleEl) titleEl.textContent = "404 Not Found";
    document.getElementById("page-content")!.innerHTML =
      "<h2>페이지를 찾을 수 없습니다.</h2>";
    return;
  }

  document.title = info.title;
  const titleEl = document.getElementById("page-title");
  if (titleEl) titleEl.textContent = info.title;

  // 권한 체크
  if (info.roles && info.roles.length > 0) {
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (!res.ok) throw new Error("Not authenticated");
      const user = await res.json();
      if (!hasRequiredRole(user, info.roles)) {
        document.getElementById("page-content")!.innerHTML =
          "<h2>접근 권한이 없습니다.</h2>";
        return;
      }
    } catch {
      location.hash = "#/login";
      return;
    }
  }

  fetch(info.file)
    .then((res) => res.text())
    .then((html) => {
      document.getElementById("page-content")!.innerHTML = html;
      if (info.bindFn) info.bindFn();
    });
}

// --- 로그인 화면에서만 navbar 숨기기 ---
function updateNavbarVisibilityForRoute() {
  const navbar = document.getElementById("navbar");
  if (!navbar) return;
  const hash = location.hash.replace(/^#/, "") || "/";
  if (hash === "/login") {
    navbar.style.display = "none";
  } else {
    navbar.style.display = "";
  }
}

function updateNavbarActive() {
  const hash = location.hash.replace(/^#/, "") || "/";
  const navbar = document.getElementById("navbar");
  if (!navbar) return;
  const links = navbar.querySelectorAll("a[data-path]");
  console.log(links);
  links.forEach((link) => {
    if ((link as HTMLAnchorElement).getAttribute("data-path") === hash) {
      link.classList.add("active");
    } else {
      link.classList.remove("active");
    }
  });
}

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
