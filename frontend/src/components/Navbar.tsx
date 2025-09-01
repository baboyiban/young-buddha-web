"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/hooks/useAuth";

// 네비게이션 항목 타입 정의
interface NavItem {
  href: string;
  label: string;
  path: string;
}

export default function Navbar() {
  const pathname = usePathname();
  const { user } = useAuth();

  const isAdmin = user?.roles?.includes("ADMIN");

  // 네비게이션 항목 정의 - 그룹별로 주석 처리하여 가독성 향상
  const navItems: NavItem[] = [
    // 주요 기능 항목
    { href: "/", label: "홈", path: "/" },
    { href: "/mission", label: "생활소임", path: "/mission" },
    { href: "/payment", label: "결재시트", path: "/payment" },
    
    // 관리자 전용 항목 (조건부 추가)
    ...(isAdmin ? [{ href: "/admin", label: "관리자", path: "/admin" }] : []),
    
    // 정책 및 정보 항목
    { href: "/privacy", label: "개인정보", path: "/privacy" },
    { href: "/terms", label: "이용약관", path: "/terms" },
  ];

  return (
    <nav className="bg-transparent w-full overflow-x-auto snap-x *:snap-start *:scroll-mx-[0.5rem] flex gap-[0.25rem] items-center justify-center-safe p-[0.5rem] *:whitespace-nowrap *:shadow-[0px_0px_8px_rgba(0,0,0,0.1)] fixed bottom-0 left-0 right-0 z-10">
      {navItems.map((item) => (
        <Link
          key={item.path}
          href={item.href}
          className={`button ${pathname === item.path ? "backdrop-blur-[0.25rem] bg-dark-purple/50 text-white" : "backdrop-blur-[0.25rem] bg-black/[0.1]"} px-[1rem] py-[0.5rem] rounded-[1rem]`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
