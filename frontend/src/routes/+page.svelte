<script lang="ts">
  import { onMount } from "svelte";

  let isLoggedIn = false;
  let currentUser: any = null;
  let loading = false;

  async function fetchMe() {
    const res = await fetch("/auth/me", { credentials: "include" });
    if (res.ok) {
      currentUser = await res.json();
      isLoggedIn = true;
    } else {
      currentUser = null;
      isLoggedIn = false;
    }
  }

  onMount(() => {
    fetchMe();
    window.addEventListener("message", handlePopupMessage, false);
  });

  async function handleGoogleLogin() {
    loading = true;
    // 1. 인증 URL을 받아서 새 창으로 이동
    const res = await fetch("/auth/google", { credentials: "include" });
    if (!res.ok) {
      alert("인증 시작 실패");
      loading = false;
      return;
    }
    const { auth_url } = await res.json();
    const popup = window.open(
      auth_url,
      "googleLoginPopup",
      "width=500,height=600",
    );
    // 폴백: 팝업 닫힘 감지 후 상태 갱신
    const timer = setInterval(() => {
      if (popup && popup.closed) {
        clearInterval(timer);
        fetchMe();
        loading = false;
      }
    }, 500);
  }

  async function handlePopupMessage(event: MessageEvent) {
    // 팝업에서 postMessage로 로그인 성공/실패를 보낼 수도 있음 (확장 가능)
    if (event.data && event.data.type === "LOGIN_SUCCESS") {
      await fetchMe();
      loading = false;
    }
    if (event.data && event.data.type === "LOGIN_ERROR") {
      alert(event.data.message || "로그인 실패");
      loading = false;
    }
  }

  async function handleLogout() {
    await fetch("/auth/logout", { method: "POST", credentials: "include" });
    await fetchMe();
  }
</script>

<main
  class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center"
>
  <div class="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
    <div class="text-center">
      <h1 class="text-3xl font-bold text-gray-800 mb-2">Young Buddha</h1>
      <p class="text-gray-600 mb-8">구글 계정으로 간편하게 로그인하세요</p>

      {#if loading}
        <div
          class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"
        ></div>
        <p class="text-gray-600">로그인 중...</p>
      {:else if isLoggedIn}
        <h2 class="text-xl font-semibold text-green-600 mb-4">
          로그인 성공! 🎉
        </h2>
        <div class="bg-gray-50 p-4 rounded-lg text-left text-sm">
          {#if currentUser}
            <div class="space-y-2">
              {#if currentUser.name}<div>
                  <strong>이름:</strong>
                  {currentUser.name}
                </div>{/if}
              {#if currentUser.email}<div>
                  <strong>이메일:</strong>
                  {currentUser.email}
                </div>{/if}
              {#if currentUser.picture}
                <div class="flex items-center space-x-2">
                  <strong>프로필:</strong>
                  <img
                    src={currentUser.picture}
                    alt="프로필"
                    class="w-8 h-8 rounded-full"
                  />
                </div>
              {/if}
              <details class="mt-4">
                <summary
                  class="cursor-pointer text-blue-600 hover:text-blue-800"
                  >전체 정보 보기</summary
                >
                <pre
                  class="mt-2 text-xs bg-gray-100 p-2 rounded overflow-x-auto">{JSON.stringify(
                    currentUser,
                    null,
                    2,
                  )}</pre>
              </details>
            </div>
          {/if}
        </div>
        <button
          class="mt-4 bg-gray-500 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded transition duration-200"
          on:click={handleLogout}>로그아웃</button
        >
      {:else}
        <button
          class="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-4 rounded-lg transition duration-200 flex items-center justify-center space-x-2"
          on:click={handleGoogleLogin}
        >
          <svg class="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="currentColor"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="currentColor"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="currentColor"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          <span>Google로 로그인</span>
        </button>
      {/if}
    </div>
  </div>
</main>

<style>
  .animate-spin {
    animation: spin 1s linear infinite;
  }
  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
</style>
