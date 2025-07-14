(() => {
  // 페이지별 정보
  const pageInfo = {
    "/": { title: "메인 페이지", file: "/pages/page.html" },
    "/login": { title: "로그인", file: "/pages/login.html" },
    "/success": { title: "로그인 성공", file: "/pages/success.html" },
  };

  // 컴포넌트 로딩
  function includeComponent(id, file) {
    const el = document.getElementById(id);
    if (!el) return;
    fetch(`/components/${file}`)
      .then((res) => res.text())
      .then((html) => {
        el.innerHTML = html;
      });
  }

  // 로그인 버튼 바인딩
  function bindLoginButton() {
    const loginBtn = document.getElementById("google-login-btn");
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

    window.addEventListener("message", (event) => {
      if (event.data?.type === "LOGIN_SUCCESS") {
        location.hash = "#/success";
      }
    });
  }

  // 인증이 필요한 페이지 목록
  const protectedPages = ["/", "/success"];

  // 인증 체크 함수
  async function requireAuth() {
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (!res.ok) throw new Error("Not authenticated");
      const data = await res.json();
      if (data.error) throw new Error("Not authenticated");
      return data;
    } catch (e) {
      location.hash = "#/login";
      throw e;
    }
  }

  // 라우터
  function router() {
    const hash = location.hash.replace(/^#/, "") || "/";
    const info = pageInfo[hash] || pageInfo["/"];
    document.title = info.title;
    const titleEl = document.getElementById("page-title");
    if (titleEl) titleEl.textContent = info.title;

    // 인증이 필요한 페이지 체크
    if (protectedPages.includes(hash)) {
      requireAuth()
        .then(() => {
          fetch(info.file)
            .then((res) => res.text())
            .then((html) => {
              document.getElementById("page-content").innerHTML = html;
            });
        })
        .catch(() => {});
      return;
    }

    fetch(info.file)
      .then((res) => res.text())
      .then((html) => {
        document.getElementById("page-content").innerHTML = html;
        if (hash === "/login") bindLoginButton();
      });
  }

  document.addEventListener("DOMContentLoaded", () => {
    includeComponent("navbar", "navbar.html");
    includeComponent("footer", "footer.html");
    router();
    window.addEventListener("hashchange", router);
  });
})();
