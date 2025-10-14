"use client";

import Link from "next/link";
import { useAuth } from "@/lib/hooks/useAuth";
import Image from "next/image";

export default function Header() {
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (_error) {
      // Handle logout error silently
    }
  };

  return (
    <header className="h-[52px] flex justify-between items-center p-[0.5rem]">
      <Link
        href="/"
        className="text-xl font-bold !flex items-center space-x-[0.25rem]"
      >
        <Image alt="logo" src="/favicon.ico" width={24} height={24} />{" "}
        <p>청년붓다</p>
      </Link>
      <div className="flex items-center space-x-2">
        {user ? (
          <>
            <span className="text-sm text-dark-gray">{user.name}</span>
            <button onClick={handleLogout} className="button red text-sm">
              로그아웃
            </button>
          </>
        ) : (
          <button
            onClick={() => (window.location.href = "/login")}
            className="button purple text-sm"
          >
            로그인
          </button>
        )}
      </div>
    </header>
  );
}
