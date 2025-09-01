"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/hooks/useAuth";

export default function Navbar() {
  const pathname = usePathname();
  const { user } = useAuth();

  const isAdmin = user?.roles?.includes("ADMIN");

  const navItems = [
    { href: "/", label: "홈", path: "/" },
    ...(isAdmin ? [{ href: "/admin", label: "관리자 화면", path: "/admin" }] : []),
    { href: "/mission", label: "생활소임 일정표", path: "/mission" },
    { href: "/payment", label: "일정불참 결재시트", path: "/payment" },
    { href: "/privacy", label: "개인정보 처리방침", path: "/privacy" },
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
