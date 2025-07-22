export function updateLayoutVisibilityForRoute() {
  const navbar = document.getElementById("navbar");
  const footer = document.getElementById("footer");
  const pageContent = document.getElementById("page-content");
  if (!navbar || !footer || !pageContent) return;

  const hash = location.hash.replace(/^#/, "") || "/";
  const isLoginPage = hash === "/login" || hash === "login";

  if (isLoginPage) {
    navbar.style.display = "none";
    footer.style.display = "none";
    pageContent.className = pageContent.className.replace(
      "*:min-h-[calc(100svh-1rem-48px)]",
      "*:min-h-[calc(100svh-1rem)]"
    );
  } else {
    navbar.style.display = "";
    footer.style.display = "";
    pageContent.className = pageContent.className.replace(
      "*:min-h-[calc(100svh-1rem)]",
      "*:min-h-[calc(100svh-1rem-48px)]"
    );
  }
}
