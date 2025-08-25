"use client";

import Link from "next/link";
import { useAuth } from "@/lib/hooks/useAuth";

export default function Header() {
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {}
  };

  return (
    <header className="flex justify-between items-center p-[0.5rem]">
      <Link href="/" className="text-xl font-bold mx-[0.5rem]">
        🪷 청년붓다
      </Link>
      <div className="flex items-center space-x-2">
        {user && <span className="text-sm text-dark-gray">{user.name}</span>}
        <button onClick={handleLogout} className="red text-sm">
          로그아웃
        </button>
      </div>
    </header>
  );
}
