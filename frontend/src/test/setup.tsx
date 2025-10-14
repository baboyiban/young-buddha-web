import "@testing-library/jest-dom";
import React from "react";
import { vi } from "vitest";

// Ensure proper DOM environment setup
import { beforeAll, afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Clean up after each test
afterEach(() => {
  cleanup();
});

// Ensure DOM globals are available
beforeAll(() => {
  // Make sure we have proper DOM environment
  if (typeof globalThis.document === "undefined") {
    throw new Error(
      "DOM environment is not set up properly. Make sure vitest.config.ts has environment: 'jsdom'",
    );
  }
});

// Mock matchMedia for tests that might use it
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Next.js 라우터 모킹
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
  useSearchParams: () => ({
    get: vi.fn(),
    has: vi.fn(),
    getAll: vi.fn(),
    keys: vi.fn(),
    values: vi.fn(),
    entries: vi.fn(),
    forEach: vi.fn(),
    toString: vi.fn(),
  }),
  usePathname: () => "/",
}));

// API 모킹
vi.mock("@/lib/api/mission", () => ({
  fetchMissionData: vi.fn(),
}));

// PageLayout 모킹
vi.mock("@/components/layouts/PageLayout", () => {
  return {
    default: function MockPageLayout({
      children,
      loading,
      error,
    }: {
      children: React.ReactNode;
      loading?: boolean;
      error?: string | null;
    }) {
      if (loading) return <div>Loading...</div>;
      if (error) return <div>Error: {error}</div>;
      return <div data-testid="page-layout">{children}</div>;
    },
  };
});

// Mock console methods to reduce noise in tests
const originalError = console.error;
beforeAll(() => {
  console.error = (...args: any[]) => {
    if (
      typeof args[0] === "string" &&
      args[0].includes("Warning: ReactDOM.render is deprecated")
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});
