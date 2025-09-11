import eslint from '@eslint/js';
import typescriptEslint from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';
import nextPlugin from '@next/eslint-plugin-next';
import globals from 'globals';

export default [
  // Next.js 앱 코드용 설정
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    ignores: ['next.config.js'], // next.config.js 제외
    plugins: {
      '@typescript-eslint': typescriptEslint,
      '@next/next': nextPlugin,
    },
    languageOptions: {
      parser: typescriptParser,
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      ...typescriptEslint.configs.recommended.rules,
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
      // ESLint 9 호환성 문제로 비활성화
      '@next/next/no-duplicate-head': 'off',
    },
  },
  // next.config.js용 기본 JavaScript 설정
  {
    files: ['next.config.js'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      ...eslint.configs.recommended.rules,
    },
  },
  {
    ignores: ['**/.next/**', '**/node_modules/**'],
  },
];