"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/hooks/useAuth";
import {
  PATH_ACCESS_RULES,
  ROLE_USER,
  ROLE_ADMIN,
} from "@/lib/utils/pathAccess";

// 네비게이션 항목 타입 정의
interface NavItem {
  href: string;
  label: string;
  path: string;
  requiredRoles?: string[];
}

export default function Navbar() {
  const pathname = usePathname();
  const { user } = useAuth();

  const userRoles = user?.roles || [];

  // PATH_ACCESS_RULES에서 네비게이션에 표시할 항목 매핑 (순서 지정)
  const navigationConfig = [
    { path: "/", label: "홈" },
    { path: "/mission", label: "생활소임" },
    { path: "/payment", label: "결재신청" },
    { path: "/approval", label: "결재관리" },
    { path: "/privacy", label: "개인정보" },
    { path: "/terms", label: "이용약관" },
  ];

  // 네비게이션 항목 생성 및 필터링
  const navItems = navigationConfig
    .map(({ path, label }) => ({
      href: path,
      label,
      path,
      requiredRoles: PATH_ACCESS_RULES[path],
    }))
    .filter((item) => {
      // requiredRoles가 없거나 빈 배열이면 모든 사용자에게 표시
      if (!item.requiredRoles || item.requiredRoles.length === 0) {
        return true;
      }
      // 사용자 역할 중 하나라도 requiredRoles에 포함되면 표시
      return item.requiredRoles.some((role) => userRoles.includes(role));
    });

  return (
    <nav className="bg-transparent w-full overflow-x-auto snap-x *:snap-start *:scroll-mx-[0.5rem] flex gap-[0.25rem] items-center justify-center-safe p-[0.5rem] *:whitespace-nowrap *:shadow-[0px_0px_8px_rgba(0,0,0,0.1)] fixed bottom-0 left-0 right-0 z-10">
      {navItems.map((item) => (
        <Link
          key={item.path}
          href={item.href}
          className={`button ${pathname === item.path ? "backdrop-blur-[0.25rem] bg-dark-purple/50 text-white" : "backdrop-blur-[0.25rem] bg-white/[0.1]"} px-[1rem] py-[0.5rem] rounded-[1rem]`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
