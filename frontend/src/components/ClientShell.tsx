'use client'

import { usePathname } from 'next/navigation'
import AppLayout from '@/components/AppLayout'
import { AuthProvider } from '@/lib/context/AuthContext'
import { isPublicPath } from '@/lib/utils/pathAccess'

export default function ClientShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AppLayout>{children}</AppLayout>
    </AuthProvider>
  )
}
