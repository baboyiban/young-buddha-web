import { authService } from "../auth";

export function updateNavbarActive() {
  const hash = location.hash.replace(/^#/, "") || "/";
  const navbar = document.getElementById("navbar");
  if (!navbar) return;
  const links = navbar.querySelectorAll("a[data-path]");
  links.forEach((link) => {
    if ((link as HTMLElement).getAttribute("data-path") === hash) {
      link.classList.add("purple");
    } else {
      link.classList.remove("purple");
    }
  });

  // 로그아웃 버튼 이벤트 리스너 추가 (중복 방지)
  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn && !logoutBtn.hasAttribute("data-listener-added")) {
    logoutBtn.addEventListener("click", async () => {
      try {
        await authService.logout();
      } catch (error) {
        alert("로그아웃 중 오류가 발생했습니다.");
      }
    });
    logoutBtn.setAttribute("data-listener-added", "true");
  }
}
