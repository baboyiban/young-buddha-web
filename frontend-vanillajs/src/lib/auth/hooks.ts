import { authService } from "./service";

export function setupGoogleLogin(): void {
  const loginBtn = document.getElementById(
    "google-login-btn",
  ) as HTMLButtonElement | null;
  if (!loginBtn) return;
  loginBtn.addEventListener("click", async () => {
    try {
      const authUrl = await authService.startGoogleAuth();
      window.location.href = authUrl;
    } catch {
      alert("로그인을 시작할 수 없습니다. 다시 시도해주세요.");
    }
  });
  const urlParams = new URLSearchParams(window.location.search);
  const loginStatus = urlParams.get("login");
  if (loginStatus === "success") {
    window.history.replaceState({}, document.title, window.location.pathname);
    location.hash = "#/";
  } else if (loginStatus === "error") {
    alert("로그인 중 오류가 발생했습니다. 다시 시도해주세요.");
    window.history.replaceState({}, document.title, window.location.pathname);
  }
}
