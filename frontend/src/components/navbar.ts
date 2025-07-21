import { authService } from "../lib/auth";

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

  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn && !logoutBtn.hasAttribute("data-listener-added")) {
    logoutBtn.addEventListener("click", async () => {
      try {
        await authService.logout();
      } catch {
        alert("로그아웃 중 오류가 발생했습니다.");
      }
    });
    logoutBtn.setAttribute("data-listener-added", "true");
  }
}
