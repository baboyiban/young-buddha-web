'use client'

import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'

export default function Header() {
  const { user, logout } = useAuth()

  const handleLogout = async () => {
    try {
      await logout()
    } catch (error) {
      alert('로그아웃 중 오류가 발생했습니다.')
    }
  }

  return (
    <header className="flex justify-between items-center pt-[0.5rem] px-[0.5rem]">
      <Link href="/" className="text-xl font-bold mx-[0.5rem]">
        🪷 청년붓다
      </Link>
      <div className="flex items-center space-x-2">
        {user && (
          <span className="text-sm text-dark-gray">
            {user.name}
          </span>
        )}
        <button
          onClick={handleLogout}
          className="button red text-sm"
        >
          로그아웃
        </button>
      </div>
    </header>
  )
}