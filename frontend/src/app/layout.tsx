import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import ClientShell from '../components/ClientShell'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Young Buddha',
  description: 'Young Buddha App',
  icons: {
    icon: '/favicon.ico',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <body className={inter.className}>
        <ClientShell>{children}</ClientShell>
      </body>
    </html>
  )
}
