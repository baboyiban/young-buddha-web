(() => {
  // 1. 페이지별 정보 정의
  const pageInfo = {
    "/": { title: "메인 페이지", file: "/pages/page.html" },
    "/login": { title: "로그인", file: "/pages/login.html" },
  };

  // 2. 공통 컴포넌트(네비바, 푸터 등) 동적 로딩 함수
  function includeComponent(id, file) {
    const el = document.getElementById(id);
    if (!el) return;
    fetch(`/components/${file}`)
      .then((res) => res.text())
      .then((html) => {
        el.innerHTML = html;
      });
  }

  // 3. 구글 로그인 버튼 이벤트 바인딩
  function bindLoginButton() {
    const loginBtn = document.getElementById("google-login-btn");
    if (!loginBtn) return;

    loginBtn.addEventListener("click", async () => {
      try {
        // 구글 인증 시작 요청
        const res = await fetch("/api/auth/google", {
          method: "POST",
          credentials: "include",
        });
        if (!res.ok) {
          alert("인증 시작 실패");
          return;
        }
        const { auth_url } = await res.json();
        // 팝업으로 구글 로그인 창 오픈
        window.open(auth_url, "googleLoginPopup", "width=500,height=600");
      } catch (e) {
        alert("네트워크 오류");
        console.error(e);
      }
    });

    // 팝업에서 로그인 성공 시 메시지 수신
    window.addEventListener("message", (event) => {
      if (event.data?.type === "LOGIN_SUCCESS") {
        location.hash = "#/success";
      }
    });
  }

  // 4. 인증이 필요한 페이지 목록
  const protectedPages = ["/"];

  // 5. 인증 체크 함수 (로그인 여부 확인)
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

  // 6. 라우터: 해시 변경에 따라 페이지 전환 및 인증 처리
  function router() {
    const hash = location.hash.replace(/^#/, "") || "/";
    const info = pageInfo[hash] || pageInfo["/"];
    document.title = info.title;
    const titleEl = document.getElementById("page-title");
    if (titleEl) titleEl.textContent = info.title;

    // 인증이 필요한 페이지 접근 시 인증 체크
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

    // 인증이 필요 없는 페이지는 바로 렌더링
    fetch(info.file)
      .then((res) => res.text())
      .then((html) => {
        document.getElementById("page-content").innerHTML = html;
        if (hash === "/login") bindLoginButton();
      });
  }

  // 7. 초기화: 컴포넌트 로딩 및 라우터 바인딩
  document.addEventListener("DOMContentLoaded", () => {
    includeComponent("navbar", "navbar.html");
    includeComponent("footer", "footer.html");
    router();
    window.addEventListener("hashchange", router);
  });
})();
