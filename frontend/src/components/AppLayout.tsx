'use client'

import { usePathname } from 'next/navigation'
import Header from './Header'
import Navbar from './Navbar'
import Footer from './Footer'

interface AppLayoutProps {
  children: React.ReactNode
}

export default function AppLayout({ children }: AppLayoutProps) {
  const pathname = usePathname()

  // 로그인 페이지에서는 Header, Footer, Navbar를 숨김
  const showNavigation = pathname !== '/login'

  return (
    <>
      {showNavigation && <Header />}
      {children}
      {showNavigation && <Footer />}
      {showNavigation && <Navbar />}
    </>
  )
}