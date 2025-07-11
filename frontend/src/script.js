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
  console.log("Young Buddha 앱이 로드되었습니다!");

  // 로컬 스토리지에서 사용자 정보 확인
  const savedUser = localStorage.getItem("young-buddha-user");
  if (savedUser) {
    try {
      currentUser = JSON.parse(savedUser);
      showUserSection();
    } catch (e) {
      console.error("저장된 사용자 정보를 읽을 수 없습니다:", e);
      localStorage.removeItem("young-buddha-user");
    }
  }

  // 이벤트 리스너 등록
  googleLoginBtn.addEventListener("click", handleGoogleLogin);
  logoutBtn.addEventListener("click", handleLogout);

  // 팝업 메시지 리스너 등록
  window.addEventListener("message", handlePopupMessage);
});

// Google 로그인 처리
function handleGoogleLogin() {
  console.log("Google 로그인 시작...");
  showLoadingSection();

  // 팝업 창으로 OAuth 플로우 시작
  const popup = window.open(
    "/auth/google",
    "google-login",
    "width=500,height=600,scrollbars=yes,resizable=yes",
  );

  // 팝업이 닫혔는지 확인
  const checkClosed = setInterval(() => {
    if (popup.closed) {
      clearInterval(checkClosed);
      // 팝업이 닫혔지만 로그인이 완료되지 않은 경우
      if (!isLoggedIn) {
        console.log("로그인이 취소되었습니다.");
        showLoginSection();
      }
    }
  }, 1000);
}

// 팝업에서 오는 메시지 처리
function handlePopupMessage(event) {
  console.log("팝업 메시지 수신:", event.data);

  if (event.data && event.data.type === "LOGIN_SUCCESS") {
    try {
      currentUser =
        typeof event.data.data === "string"
          ? JSON.parse(event.data.data)
          : event.data.data;

      // 로컬 스토리지에 저장
      localStorage.setItem("young-buddha-user", JSON.stringify(currentUser));

      isLoggedIn = true;
      showUserSection();

      console.log("로그인 성공:", currentUser);
    } catch (e) {
      console.error("사용자 정보 파싱 오류:", e);
      showLoginSection();
    }
  }
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
  // 여기에 토스트 메시지나 에러 모달을 표시할 수 있습니다
  alert("오류: " + message);
}

// 디버깅용
console.log("Young Buddha 스크립트가 로드되었습니다.");
