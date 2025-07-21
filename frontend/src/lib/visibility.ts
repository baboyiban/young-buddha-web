export function updateLayoutVisibilityForRoute() {
  const navbar = document.getElementById("navbar");
  const footer = document.getElementById("footer");
  const pageContent = document.getElementById("page-content");
  if (!navbar || !footer || !pageContent) return;
  const hash = location.hash.replace(/^#/, "") || "/";
  if (hash === "/login") {
    navbar.style.display = "none";
    footer.style.display = "none";
    pageContent.className = pageContent.className.replace(
      "*:min-h-[calc(100svh-0.5rem-48px+4px)]",
      "*:min-h-[calc(100svh-0.5rem)]",
    );
  } else {
    navbar.style.display = "";
    footer.style.display = "";
    pageContent.className = pageContent.className.replace(
      "*:min-h-[calc(100svh-0.5rem)]",
      "*:min-h-[calc(100svh-0.5rem-48px+4px)]",
    );
  }
}
