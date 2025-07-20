export function updateLayoutVisibilityForRoute() {
  const navbar = document.getElementById("navbar");
  const footer = document.getElementById("footer");

  if (!navbar || !footer) return;

  const hash = location.hash.replace(/^#/, "") || "/";

  if (hash === "/login") {
    navbar.style.display = "none";
    footer.style.display = "none";
  } else {
    navbar.style.display = "";
    footer.style.display = "";
  }
}
