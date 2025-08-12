"use client"

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import LoadingSpinner from '@/components/LoadingSpinner'
import { authService } from '@/lib/auth/service'

// 동적 렌더링 강제 (useSearchParams 사용으로 인해)
export const dynamic = 'force-dynamic'

function LoginContent() {
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const loginStatus = searchParams.get('login')
    if (loginStatus === 'success') {
      router.replace('/')
    } else if (loginStatus === 'error') {
      alert('로그인 중 오류가 발생했습니다. 다시 시도해주세요.')
      router.replace('/login')
    }
  }, [searchParams, router])

  const handleGoogleLogin = async () => {
    try {
      setLoading(true)
      const authUrl = await authService.startGoogleAuth()
      if (authUrl.includes('login=success')) {
        router.push('/?login=success')
      } else {
        window.location.href = authUrl
      }
    } catch (error) {
      console.error('Login error:', error)
      alert('로그인을 시작할 수 없습니다. 다시 시도해주세요.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="bg-white p-8 rounded-lg shadow-lg">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">청년붓다</h1>
          <p className="text-gray-600">로그인이 필요합니다</p>
          {process.env.NODE_ENV === 'development' && !process.env.NEXT_PUBLIC_USE_REAL_AUTH && (
            <p className="text-sm text-blue-600 mt-2">개발 모드: 목업 인증 사용 중</p>
          )}
        </div>

        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200 flex items-center justify-center space-x-2"
        >
          {loading ? (
            <LoadingSpinner size="sm" color="white" showMessage={false} />
          ) : (
            <>
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              <span>Google로 로그인</span>
            </>
          )}
        </button>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
          <LoadingSpinner size="lg" message="로그인 페이지 로딩 중..." />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  )
}