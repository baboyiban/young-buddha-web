export function bindLoginButton() {
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
