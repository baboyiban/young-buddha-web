"use client";

import { usePathname } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import Header from './Header'
import Navbar from './Navbar'
import Footer from './Footer'

interface AppLayoutProps {
  children: React.ReactNode
}

export default function AppLayout({ children }: AppLayoutProps) {
  const pathname = usePathname()
  const { user } = useAuth()
  const isLoginPage = pathname === '/login'

  return (
    <>
      {/* Header: 로그인 페이지에서 숨김 */}
      {!isLoginPage && <Header />}
      {children}
      {/* Footer: 항상 표시 */}
      <Footer />
      {/* Navbar: 로그인된 경우에만 표시 (로그인 페이지에서는 숨김) */}
      {!isLoginPage && user && <Navbar />}
    </>
  )
}
