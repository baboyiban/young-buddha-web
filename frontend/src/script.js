document.body.insertAdjacentHTML("beforeend", "<p>Loaded by VanillaJS!</p>");
document.getElementById("google-login").addEventListener("click", function () {
  // 백엔드의 OAuth 엔드포인트로 이동 (리다이렉트)
  window.location.href = "/auth/google";
});
