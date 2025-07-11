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
    const timer = setInterval(() => {
      if (popup && popup.closed) {
        clearInterval(timer);
        fetchMe();
        loading = false;
      }
    }, 500);
  }

  async function handlePopupMessage(event: MessageEvent) {
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

<main>
  {#if loading}
    <div>로그인 중...</div>
  {:else if isLoggedIn}
    <div>로그인 성공!</div>
    {#if currentUser}
      <div>이름: {currentUser.name}</div>
      <div>이메일: {currentUser.email}</div>
      {#if currentUser.picture}
        <img src={currentUser.picture} alt="프로필" width="32" height="32" />
      {/if}
    {/if}
    <button on:click={handleLogout}>로그아웃</button>
  {:else}
    <button on:click={handleGoogleLogin}>Google로 로그인</button>
  {/if}
</main>
