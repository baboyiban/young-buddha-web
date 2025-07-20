export function updateLayoutVisibilityForRoute() {
  const navbar = document.getElementById("navbar");
  const footer = document.getElementById("footer");
  const pageContent = document.getElementById("page-content");

  if (!navbar || !footer || !pageContent) return;

  const hash = location.hash.replace(/^#/, "") || "/";

  if (hash === "/login") {
    navbar.style.display = "none";
    footer.style.display = "none";
    // 로그인 화면에서는 navbar 높이를 제외한 전체 높이 사용
    pageContent.className = pageContent.className.replace(
      "*:min-h-[calc(100svh-0.5rem-48px+4px)]",
      "*:min-h-[calc(100svh-0.5rem)]"
    );
  } else {
    navbar.style.display = "";
    footer.style.display = "";
    // 다른 화면에서는 navbar 높이를 포함한 계산
    pageContent.className = pageContent.className.replace(
      "*:min-h-[calc(100svh-0.5rem)]",
      "*:min-h-[calc(100svh-0.5rem-48px+4px)]"
    );
  }
}
