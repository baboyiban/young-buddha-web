export function includeComponent(
  id: string,
  file: string,
  callback?: () => void
) {
  const el = document.getElementById(id);
  if (!el) return;
  fetch(`/components/${file}`)
    .then((res) => res.text())
    .then((html) => {
      el.innerHTML = html;
      if (callback) callback();
    });
}
