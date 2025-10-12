const nextJest = require('next/jest')

const createJestConfig = nextJest({
  // Next.js 앱의 경로
  dir: './',
})

// Jest 설정
const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/src/test/setup.tsx'],
  testEnvironment: 'jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testMatch: [
    '**/__tests__/**/*.[jt]s?(x)',
    '**/?(*.)+(spec|test).[jt]s?(x)',
  ],
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/test/**',
    '!src/**/*.stories.{js,jsx,ts,tsx}',
    '!src/pages/_app.tsx',
    '!src/pages/_document.tsx',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 60,
      lines: 60,
      statements: 60,
    },
  },
  testPathIgnorePatterns: ['<rootDir>/.next/'],
  // 테스트 타임아웃 증가 (API 모킹 등으로 인한 지연 고려)
  testTimeout: 10000,
}

module.exports = createJestConfig(customJestConfig)