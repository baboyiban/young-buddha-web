"use client";

import { useRouter } from "next/navigation";
import { useAuthContext } from "@/lib/context/AuthContext";

export function useAuth() {
  const ctx = useAuthContext();
  const router = useRouter();

  // 기존 logout 동작에 라우팅이 포함되어 있었으므로, wrapper로 동일 동작 유지
  const logout = async () => {
    try {
      await ctx.logout();
    } finally {
      // logout 성공/실패 관계없이 항상 로그인 페이지로 이동
      router.push("/login");
    }
  };

  return {
    user: ctx.user,
    loading: ctx.loading,
    isAuthenticated: ctx.isAuthenticated,
    login: ctx.login,
    logout,
    checkAuth: ctx.checkAuth,
  };
}
