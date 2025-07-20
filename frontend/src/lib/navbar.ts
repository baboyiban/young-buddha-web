

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
