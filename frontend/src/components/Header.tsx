"use client";

import Link from "next/link";
import { useAuth } from "@/lib/hooks/useAuth";
import Image from "next/image";

export default function Header() {
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) { }
  };

  return (
    <header className="flex justify-between items-center p-[0.5rem]">
      <Link href="/" className="text-xl font-bold mx-[0.5rem] !flex items-center space-x-[0.25rem]">
        <Image alt="logo" src="/favicon.ico" width={24} height={24} /> <p>청년붓다</p>
      </Link>
      <div className="flex items-center space-x-2">
        {user && <span className="text-sm text-gray-50">{user.name}</span>}
        <button onClick={handleLogout} className="button red text-sm">
          로그아웃
        </button>
      </div>
    </header>
  );
}
