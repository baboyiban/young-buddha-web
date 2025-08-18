'use client'

import { usePathname } from 'next/navigation'
import AuthGuard from '@/components/AuthGuard'
import AppLayout from '@/components/AppLayout'
import { AuthProvider } from '@/context/AuthContext'

export default function ClientShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isLoginPage = pathname === '/login'
  const isPublicPage = pathname === '/privacy' || pathname === '/terms'

  if (isLoginPage) return <>{children}</>

  if (isPublicPage)
    return (
      <AuthProvider>
        <AppLayout>{children}</AppLayout>
      </AuthProvider>
    )

  return (
    <AuthProvider>
      <AuthGuard>
        <AppLayout>{children}</AppLayout>
      </AuthGuard>
    </AuthProvider>
  )
}
