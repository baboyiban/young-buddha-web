import eslint from "@eslint/js";
import typescriptEslint from "@typescript-eslint/eslint-plugin";
import typescriptParser from "@typescript-eslint/parser";
import nextPlugin from "@next/eslint-plugin-next";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

export default [
  // Next.js 앱 코드용 설정
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    ignores: [
      "next.config.js",
      "jest.config.js",
      "coverage/**",
      ".next/**",
      "node_modules/**",
    ],
    plugins: {
      "@typescript-eslint": typescriptEslint,
      "@next/next": nextPlugin,
      "react-hooks": reactHooks,
    },
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: "module",
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2020,
        vi: "readonly", // Vitest global
        describe: "readonly",
        it: "readonly",
        expect: "readonly",
        beforeEach: "readonly",
        afterEach: "readonly",
        beforeAll: "readonly",
        afterAll: "readonly",
        React: "readonly",
        RequestInit: "readonly",
        HeadersInit: "readonly",
        NodeJS: "readonly",
      },
    },
    rules: {
      ...eslint.configs.recommended.rules,
      ...typescriptEslint.configs.recommended.rules,
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
      ...reactHooks.configs.recommended.rules,

      // ESLint 9 호환성 문제로 비활성화
      "@next/next/no-duplicate-head": "off",

      // 개발 단계에서 완화된 규칙들
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-empty-object-type": "off",

      // React hooks 규칙은 활성화하되 경고로만
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "off",

      // 기타 완화된 규칙들
      "no-useless-escape": "warn",
      "no-undef": "off", // TypeScript가 처리
    },
  },

  // Configuration files용 설정
  {
    files: ["next.config.js", "jest.config.js", "*.config.js"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      ...eslint.configs.recommended.rules,
      "@typescript-eslint/no-require-imports": "off",
    },
  },

  // Test files용 특별 설정
  {
    files: [
      "**/*.test.{js,jsx,ts,tsx}",
      "**/*.spec.{js,jsx,ts,tsx}",
      "**/test/**",
      "**/tests/**",
    ],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
    },
  },

  {
    ignores: [
      "**/.next/**",
      "**/node_modules/**",
      "**/coverage/**",
      "**/dist/**",
      "**/.turbo/**",
    ],
  },
];
