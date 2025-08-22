"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

export default function Navbar() {
  const pathname = usePathname();

  const navItems = [
    { href: "/", label: "홈", path: "/" },
    { href: "/mission", label: "생활소임 일정표", path: "/mission" },
    { href: "/payment", label: "일정불참 결재시트", path: "/payment" },
  ];

  return (
    <nav className="bg-transparent w-full overflow-x-auto snap-x *:snap-start *:scroll-mx-[0.5rem] flex gap-[0.25rem] items-center justify-center-safe p-[0.5rem] *:whitespace-nowrap *:shadow-[0px_0px_8px_rgba(0,0,0,0.1)] fixed bottom-0 left-0 right-0 z-10">
      {navItems.map((item) => (
        <button
          key={item.path}
          className={`${pathname === item.path ? "blur-blue" : "blur-white"}`}
        >
          <Link href={item.href}>{item.label}</Link>
        </button>
      ))}
    </nav>
  );
}
