import { authService } from "./service";

export function setupGoogleLogin(): void {
  const loginBtn = document.getElementById(
    "google-login-btn"
  ) as HTMLButtonElement | null;
  if (!loginBtn) return;

  loginBtn.addEventListener("click", async () => {
    try {
      const authUrl = await authService.startGoogleAuth();
      window.open(authUrl, "googleLoginPopup", "width=500,height=600");
    } catch (error) {
      alert("로그인을 시작할 수 없습니다. 다시 시도해주세요.");
    }
  });

  // 팝업에서 로그인 완료 메시지 수신
  window.addEventListener("message", (event: MessageEvent) => {
    if (event.data?.type === "LOGIN_SUCCESS") {
      location.hash = "#/";
      location.reload(); // 페이지 새로고침으로 상태 업데이트
    }
  });
}
