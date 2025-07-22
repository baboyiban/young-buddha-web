import { authService } from "../lib/auth";

function setupLogoutButton() {
  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    // 기존 이벤트 리스너 제거 후 새로 추가 (중복 방지)
    const newLogoutBtn = logoutBtn.cloneNode(true) as HTMLElement;
    logoutBtn.parentNode?.replaceChild(newLogoutBtn, logoutBtn);

    newLogoutBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      try {
        await authService.logout();
      } catch {
        alert("로그아웃 중 오류가 발생했습니다.");
      }
    });
  }
}

export function setupNavbar() {
  setupLogoutButton();
  updateNavbarActiveState();
}

export function updateNavbarActiveState() {
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
}
