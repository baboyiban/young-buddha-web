import { authService } from "../../lib/auth";

/**
 * 로그아웃 버튼에 이벤트 리스너를 바인딩합니다.
 * 중복 방지를 위해 기존 리스너를 제거 후 새로 추가합니다.
 */
export function setupLogoutButton(): void {
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


/**
 * 현재 해시에 따라 네비게이션 바의 활성화 상태를 업데이트합니다.
 */
export function updateNavbarActiveState(): void {
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

/**
 * 네비게이션 바를 초기화합니다.
 */
export function setupNavbar(): void {
  setupLogoutButton();
  updateNavbarActiveState();
}
