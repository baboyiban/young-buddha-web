// components/layouts/PageLayout.tsx
"use client";

import React from "react";
import { useAuth } from "@/lib/hooks/useAuth";
import LoadingSpinner from "@/components/LoadingSpinner";
import { MESSAGES } from "@/lib/config/app";
import type { UserRole } from "@/lib/types/user";

interface PageLayoutProps {
  children: React.ReactNode;
  title?: string;
  requireAuth?: boolean;
  requiredRoles?: UserRole[];
  loading?: boolean;
  error?: string | null;
}

export default function PageLayout({
  children,
  title,
  requireAuth = true,
  requiredRoles = [],
  loading = false,
  error = null,
}: PageLayoutProps) {
  const { user, loading: authLoading, isAuthenticated } = useAuth();

  // 로딩 상태
  if (loading || authLoading) {
    return (
      <div className="min-h-[calc(100svh-52px-0.5rem)] flex items-center justify-center">
        <LoadingSpinner message={MESSAGES.LOADING.DEFAULT} />
      </div>
    );
  }

  // 인증 필요하지만 로그인하지 않은 경우
  if (requireAuth && !isAuthenticated) {
    return (
      <div className="min-h-[calc(100svh-52px-0.5rem)] flex items-center justify-center">
        <div className="text-gray-50">로그인이 필요합니다.</div>
      </div>
    );
  }

  // 권한 체크
  if (requiredRoles.length > 0 && user) {
    const hasRequiredRole = requiredRoles.some((role) =>
      user.roles?.includes(role),
    );
    if (!hasRequiredRole) {
      return (
        <div className="min-h-[calc(100svh-52px-0.5rem)] flex items-center justify-center">
          <div className="text-gray-50">접근 권한이 없습니다.</div>
        </div>
      );
    }
  }

  // 에러 상태
  if (error) {
    return (
      <div className="min-h-[calc(100svh-52px-0.5rem)] flex items-center justify-center">
        <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="text-red-500 text-2xl mb-2">!</div>
            <h2 className="text-lg font-semibold mb-2">오류 발생</h2>
            <p className="text-gray-600">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100svh-52px-0.5rem)]">
      {title && (
        <div className="mx-[0.5rem] mb-[0.5rem]">
          <h1 className="text-xl font-bold text-gray-900">{title}</h1>
        </div>
      )}
      {children}
    </div>
  );
}
