"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import LoadingSpinner from "@/components/LoadingSpinner";
import { authService } from "@/lib/auth/service";

// 동적 렌더링 강제 (useSearchParams 사용으로 인해)
export const dynamic = "force-dynamic";

function LoginContent() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const loginStatus = searchParams.get("login");
    if (loginStatus === "success") {
      router.replace("/");
    } else if (loginStatus === "error") {
      alert("로그인 중 오류가 발생했습니다. 다시 시도해주세요.");
      router.replace("/login");
    }
  }, [searchParams, router]);

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      const authUrl = await authService.getGoogleAuthUrl();
      if (authUrl.includes("login=success")) {
        router.push("/?login=success");
      } else {
        window.location.href = authUrl;
      }
    } catch (error) {
      alert("로그인을 시작할 수 없습니다. 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-svh flex items-center justify-center p-[0.5rem]">
      <button onClick={handleGoogleLogin} disabled={loading} className="purple">
        {loading ? (
          <LoadingSpinner color="white" showMessage={false} />
        ) : (
          <>
            <span>Google로 로그인</span>
          </>
        )}
      </button>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
          <LoadingSpinner message="로그인 페이지 로딩 중..." />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
