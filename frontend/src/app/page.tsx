import AuthGuard from '@/components/AuthGuard'
import AppLayout from '@/components/AppLayout'
import Link from 'next/link'

export default function Home() {
  return (
    <AuthGuard>
      <AppLayout>
        <div className="bg-gray min-h-screen flex flex-col pb-[48px]">
          <div className="flex flex-col items-center justify-center flex-1 px-4 py-8">
            <div className="text-center space-y-8">
              <div>
                <h1 className="text-3xl font-bold mb-4">청년붓다에 오신 것을 환영합니다</h1>
                <p className="text-gray-600 text-lg">일정 관리와 결재 시스템을 이용해보세요</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-md mx-auto">
                <Link
                  href="/mission"
                  className="button purple text-center py-4 px-6 text-lg"
                >
                  생활소임 일정표
                </Link>

                <Link
                  href="/payment"
                  className="button default text-center py-4 px-6 text-lg"
                >
                  일정불참 결재시트
                </Link>
              </div>

              <div className="text-sm text-gray-500 space-y-2">
                <p>청년붓다들을 위한 일정 관리 서비스</p>
                <p>문의: chl11wq12@gmail.com</p>
              </div>
            </div>
          </div>
        </div>
      </AppLayout>
    </AuthGuard>
  )
}