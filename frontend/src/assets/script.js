(() => {
  // 페이지별 정보 정의 (접근권한 포함)
  const pageInfo = {
    "/": { title: "메인 페이지", file: "/pages/page.html", protected: true },
    "/login": { title: "로그인", file: "/pages/login.html", protected: false },
    "/sheet": {
      title: "스프레드시트",
      file: "/pages/sheet.html",
      protected: true,
    },
  };

  // 공통 컴포넌트(네비바, 푸터 등) 동적 로딩 함수
  function includeComponent(id, file) {
    const el = document.getElementById(id);
    if (!el) return;
    fetch(`/components/${file}`)
      .then((res) => res.text())
      .then((html) => {
        el.innerHTML = html;
      });
  }

  // 구글 로그인 버튼 이벤트 바인딩
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
        location.hash = "#/";
      }
    });
  }

  // 인증 체크 함수 (로그인 여부 확인)
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

  // 스프레드시트 페이지 이벤트 바인딩
  function bindSheetPage() {
    const btn = document.getElementById("load-sheet-btn");
    if (!btn) return;
    btn.onclick = async function () {
      const spreadsheetId = document
        .getElementById("spreadsheet-id")
        .value.trim();
      const range = document.getElementById("range").value.trim();
      const resultDiv = document.getElementById("sheet-result");
      resultDiv.innerHTML = "불러오는 중...";
      try {
        const res = await fetch(
          `/api/sheet/read?spreadsheet_id=${encodeURIComponent(spreadsheetId)}&range=${encodeURIComponent(range)}`,
          {
            credentials: "include",
          },
        );
        if (!res.ok) {
          resultDiv.innerHTML = "API 오류: " + res.status;
          return;
        }
        const data = await res.json();
        if (!data.values || !Array.isArray(data.values)) {
          resultDiv.innerHTML = "데이터 없음";
          return;
        }
        let html = '<table border="1"><tbody>';
        for (const row of data.values) {
          html +=
            "<tr>" + row.map((cell) => `<td>${cell}</td>`).join("") + "</tr>";
        }
        html += "</tbody></table>";
        resultDiv.innerHTML = html;
      } catch (e) {
        resultDiv.innerHTML = "네트워크 오류";
        console.error(e); // 에러를 콘솔에 출력
      }
    };
  }

  // 라우터: 해시 변경에 따라 페이지 전환 및 인증 처리
  function router() {
    const hash = location.hash.replace(/^#/, "") || "/";
    const info = pageInfo[hash] || pageInfo["/"];
    document.title = info.title;
    const titleEl = document.getElementById("page-title");
    if (titleEl) titleEl.textContent = info.title;

    // 인증이 필요한 페이지 체크
    if (info.protected) {
      requireAuth()
        .then(() => {
          fetch(info.file)
            .then((res) => res.text())
            .then((html) => {
              document.getElementById("page-content").innerHTML = html;
              if (hash === "/sheet") bindSheetPage();
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
        if (hash === "/sheet") bindSheetPage();
      });
  }

  // 초기화: 컴포넌트 로딩 및 라우터 바인딩
  document.addEventListener("DOMContentLoaded", () => {
    includeComponent("navbar", "navbar.html");
    includeComponent("footer", "footer.html");
    router();
    window.addEventListener("hashchange", router);
  });
})();
