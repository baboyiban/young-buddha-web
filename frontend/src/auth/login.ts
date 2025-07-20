import { authService } from "./service";

export function setupGoogleLogin(): void {
  const loginBtn = document.getElementById(
    "google-login-btn"
  ) as HTMLButtonElement | null;
  if (!loginBtn) return;

  loginBtn.addEventListener("click", async () => {
    try {
      const authUrl = await authService.startGoogleAuth();
      window.location.href = authUrl;
    } catch (error) {
      alert("로그인을 시작할 수 없습니다. 다시 시도해주세요.");
    }
  });

  // URL 파라미터로부터 로그인 결과 확인
  const urlParams = new URLSearchParams(window.location.search);
  const loginStatus = urlParams.get('login');
  if (loginStatus === 'success') {
    // URL 정리
    window.history.replaceState({}, document.title, window.location.pathname);
    location.hash = "#/";
    location.reload();
  }
}
