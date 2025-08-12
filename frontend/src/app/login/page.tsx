import LoginPage from '@/components/LoginPage'

// 동적 렌더링 강제 (useSearchParams 사용으로 인해)
export const dynamic = 'force-dynamic'

export default function Login() {
  return <LoginPage />
}