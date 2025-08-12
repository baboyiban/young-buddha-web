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
    <header className="bg-gray border-b border-gray-200">
      <div className="flex justify-between items-center p-4">
        <Link href="/" className="text-xl font-bold hover:text-gray-700 transition-colors">
          청년붓다
        </Link>
        <div className="flex items-center space-x-2">
          {user && (
            <span className="text-sm text-gray-600">
              {user.name}님
            </span>
          )}
          <button
            onClick={handleLogout}
            className="button red text-sm"
          >
            로그아웃
          </button>
        </div>
      </div>
    </header>
  )
}