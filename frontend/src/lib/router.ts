import { pageInfo } from "./pageInfo";
import { hasRequiredRole, getCurrentUser } from "./auth";

export async function router() {
  const hash = location.hash.replace(/^#/, "") || "/";
  const info = pageInfo[hash];

  if (!info) {
    document.title = "404 Not Found";
    const titleEl = document.getElementById("page-title");
    if (titleEl) titleEl.textContent = "404 Not Found";
    document.getElementById("page-content")!.innerHTML =
      "<h2>페이지를 찾을 수 없습니다.</h2>";
    return;
  }

  document.title = info.title;
  const titleEl = document.getElementById("page-title");
  if (titleEl) titleEl.textContent = info.title;

  // 권한 체크
  if (info.roles && info.roles.length > 0) {
    try {
      const user = await getCurrentUser();
      if (!hasRequiredRole(user, info.roles)) {
        document.getElementById("page-content")!.innerHTML =
          "<h2>접근 권한이 없습니다.</h2>";
        return;
      }
    } catch {
      location.hash = "#/login";
      return;
    }
  }

  fetch(info.file)
    .then((res) => res.text())
    .then((html) => {
      document.getElementById("page-content")!.innerHTML = html;
      if (info.bindFn) info.bindFn();
    });
}
