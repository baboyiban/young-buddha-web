import 'jest-environment-jsdom'
import '@testing-library/jest-dom'
import React from 'react'

// 테스트 환경에서 필요한 전역 설정
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
})

// Next.js 라우터 모킹
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
  }),
  useSearchParams: () => ({
    get: jest.fn(),
  }),
  usePathname: () => '/',
}))

// API 모킹
jest.mock('@/lib/api/mission', () => ({
  fetchMissionData: jest.fn(),
}))

// PageLayout 모킹
jest.mock('@/components/layouts/PageLayout', () => {
  return function MockPageLayout({
    children,
    loading,
    error
  }: {
    children: React.ReactNode;
    loading?: boolean;
    error?: string | null
  }) {
    if (loading) return <div>Loading...</div>
    if (error) return <div>Error: {error}</div>
    return <div>{children}</div>
  }
})