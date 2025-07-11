// DOM 요소들
const loginSection = document.getElementById("login-section");
const userSection = document.getElementById("user-section");
const loadingSection = document.getElementById("loading-section");
const googleLoginBtn = document.getElementById("google-login");
const logoutBtn = document.getElementById("logout-btn");
const userInfoDiv = document.getElementById("user-info");

// 상태 관리
let isLoggedIn = false;
let currentUser = null;

// 페이지 로드 시 초기화
document.addEventListener("DOMContentLoaded", function () {
  // 로컬 스토리지에서 사용자 정보 확인
  const savedUser = localStorage.getItem("young-buddha-user");
  if (savedUser) {
    try {
      currentUser = JSON.parse(savedUser);
      isLoggedIn = true;
      showUserSection();
    } catch (e) {
      console.error("저장된 사용자 정보를 읽을 수 없습니다:", e);
      localStorage.removeItem("young-buddha-user");
      showLoginSection();
    }
  } else {
    showLoginSection();
  }

  // 이벤트 리스너 등록
  googleLoginBtn.addEventListener("click", handleGoogleLogin);
  logoutBtn.addEventListener("click", handleLogout);

  // OAuth 콜백 처리
  handleOAuthCallbackIfNeeded();
});

// Google 로그인: 현재 창에서 이동
function handleGoogleLogin() {
  const popup = window.open(
    "/auth/google", // 이 경로에서 구글 인증 시작
    "googleLoginPopup",
    "width=500,height=600",
  );
  // 팝업에서 postMessage로 결과를 받을 이벤트 리스너 등록
  window.addEventListener("message", handlePopupMessage, false);
}

// OAuth 콜백 처리
function handleOAuthCallbackIfNeeded() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  const state = params.get("state");
  if (code && state) {
    showLoadingSection();
    fetch(
      `/auth/google/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`,
    )
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          showError(data.message || "로그인 실패");
          showLoginSection();
          return;
        }
        currentUser = data;
        localStorage.setItem("young-buddha-user", JSON.stringify(currentUser));
        isLoggedIn = true;
        showUserSection();
        // URL에서 code/state 제거 (히스토리만 변경)
        window.history.replaceState(
          {},
          document.title,
          window.location.pathname,
        );
      })
      .catch((err) => {
        showError(err.message || "로그인 실패");
        showLoginSection();
      });
  }
}

function handlePopupMessage(event) {
  // 보안을 위해 origin 체크 필요 (예: if (event.origin !== "http://localhost:8080") return;)
  const { type, data, message } = event.data || {};
  if (type === "LOGIN_SUCCESS") {
    currentUser = data;
    localStorage.setItem("young-buddha-user", JSON.stringify(currentUser));
    isLoggedIn = true;
    showUserSection();
  } else if (type === "LOGIN_ERROR") {
    showError(message || (data && data.message) || "로그인 실패");
    showLoginSection();
  }
  window.removeEventListener("message", handlePopupMessage, false);
}

// 로그아웃 처리
function handleLogout() {
  currentUser = null;
  isLoggedIn = false;
  localStorage.removeItem("young-buddha-user");
  showLoginSection();
  console.log("로그아웃되었습니다.");
}

// UI 섹션 표시 함수들
function showLoginSection() {
  loginSection.classList.remove("hidden");
  userSection.classList.add("hidden");
  loadingSection.classList.add("hidden");
}

function showUserSection() {
  loginSection.classList.add("hidden");
  userSection.classList.remove("hidden");
  loadingSection.classList.add("hidden");

  if (currentUser) {
    displayUserInfo();
  }
}

function showLoadingSection() {
  loginSection.classList.add("hidden");
  userSection.classList.add("hidden");
  loadingSection.classList.remove("hidden");
}

// 사용자 정보 표시
function displayUserInfo() {
  if (!currentUser) return;

  const userInfoHTML = `
        <div class="space-y-2">
            ${currentUser.name ? `<div><strong>이름:</strong> ${currentUser.name}</div>` : ""}
            ${currentUser.email ? `<div><strong>이메일:</strong> ${currentUser.email}</div>` : ""}
            ${
              currentUser.picture
                ? `<div class="flex items-center space-x-2">
                <strong>프로필:</strong>
                <img src="${currentUser.picture}" alt="프로필" class="w-8 h-8 rounded-full">
            </div>`
                : ""
            }
            <details class="mt-4">
                <summary class="cursor-pointer text-blue-600 hover:text-blue-800">전체 정보 보기</summary>
                <pre class="mt-2 text-xs bg-gray-100 p-2 rounded overflow-x-auto">${JSON.stringify(currentUser, null, 2)}</pre>
            </details>
        </div>
    `;

  userInfoDiv.innerHTML = userInfoHTML;
}

// 유틸리티 함수: 에러 표시
function showError(message) {
  console.error("오류:", message);
  alert("오류: " + message);
}
