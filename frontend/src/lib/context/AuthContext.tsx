"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { authService } from "@/lib/auth/service";
import { User } from "@/lib/types/user";
import {
  isPublicPath,
  hasAccess,
  ROLE_USER,
  ROLE_ADMIN,
} from "@/lib/utils/pathAccess";

type AuthState = {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<boolean>;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

// 모듈 수준 캐시/중복 요청 방지
let sharedAuthPromise: Promise<{
  user: User | null;
  isAuth: boolean;
} | null> | null = null;
let cachedAuth: { user: User | null; isAuth: boolean } | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 30 * 1000; // 30초

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // 공개 페이지는 인증 확인 스킵
    if (!isPublicPath(pathname)) {
      // 마운트 시 한 번 인증 확인
      checkAuth().catch(() => {
        // 오류는 내부에서 처리
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const checkAuth = async () => {
    setLoading(true);
    try {
      const now = Date.now();
      if (cachedAuth && now - cacheTimestamp < CACHE_TTL) {
        setUser(cachedAuth.user);
        setIsAuthenticated(!!cachedAuth.isAuth);
        return cachedAuth.isAuth;
      }

      if (sharedAuthPromise) {
        const res = await sharedAuthPromise;
        setUser(res?.user ?? null);
        setIsAuthenticated(!!res?.isAuth);
        return res?.isAuth ?? false;
      }

      sharedAuthPromise = (async () => {
        const isAuth = await authService.checkAuthStatus();
        if (isAuth) {
          const userData = await authService.getCurrentUser();
          return { user: userData, isAuth: true };
        }
        return { user: null, isAuth: false };
      })();

      const result = await sharedAuthPromise;
      cachedAuth = result;
      cacheTimestamp = Date.now();

      setUser(result?.user ?? null);
      setIsAuthenticated(!!result?.isAuth);
      return result?.isAuth ?? false;
    } catch (error) {
      setUser(null);
      setIsAuthenticated(false);
      return false;
    } finally {
      sharedAuthPromise = null;
      setLoading(false);
    }
  };

  const login = async () => {
    const authUrl = await authService.getGoogleAuthUrl();
    window.location.href = authUrl;
  };

  const logout = async () => {
    await authService.logout(false);
    // 캐시 초기화
    cachedAuth = null;
    cacheTimestamp = 0;
    setUser(null);
    setIsAuthenticated(false);
  };

  const value: AuthState = {
    user,
    loading,
    isAuthenticated,
    login,
    logout,
    checkAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuthContext = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuthContext must be used within AuthProvider");
  return ctx;
};
