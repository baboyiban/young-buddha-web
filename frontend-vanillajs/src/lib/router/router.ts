import { requireRole, requireAuth } from "../auth/utils";
import { routes } from "./routes";

let currentPath = "";

export async function router(): Promise<void> {
  const hash = location.hash.replace(/^#/, "") || "/";


  const route = routes[hash];
  if (hash === currentPath) return;
  if (!route) {
    showNotFound();
    return;
  }
  document.title = route.title;
  const titleEl = document.getElementById("page-title");
  if (titleEl) titleEl.textContent = route.title;
  if (route.roles && route.roles.length > 0) {
    try {
      await requireAuth();
      await requireRole(route.roles);
    } catch {
      return;
    }
  }
  try {
    const response = await fetch(route.file);
    const html = await response.text();
    document.getElementById("page-content")!.innerHTML = html;
    currentPath = hash;
    if (route.bindFn) await route.bindFn();
  } catch {
    document.getElementById("page-content")!.innerHTML =
      "<h2>페이지를 로드할 수 없습니다.</h2>";
  }
}

function showNotFound(): void {
  document.title = "404 Not Found";
  const titleEl = document.getElementById("page-title");
  if (titleEl) titleEl.textContent = "404 Not Found";
  document.getElementById("page-content")!.innerHTML =
    "<h2>페이지를 찾을 수 없습니다.</h2>";
}
