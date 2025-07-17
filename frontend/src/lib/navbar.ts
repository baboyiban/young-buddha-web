export function updateNavbarVisibilityForRoute() {
  const navbar = document.getElementById("navbar");
  if (!navbar) return;
  const hash = location.hash.replace(/^#/, "") || "/";
  if (hash === "/login") {
    navbar.style.display = "none";
  } else {
    navbar.style.display = "";
  }
}

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
}
