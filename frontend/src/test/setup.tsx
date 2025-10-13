import "@testing-library/jest-dom";
import React from "react";
import { vi } from "vitest";
import { JSDOM } from "jsdom";

// Ensure a DOM environment when running under Node (fallback if the test runner
// doesn't already provide jsdom). This makes tests that use @testing-library/react
// work even if the environment isn't configured as jsdom.
if (typeof globalThis.document === "undefined") {
  const dom = new JSDOM("<!doctype html><html><body></body></html>");
  (globalThis as any).window = dom.window;
  (globalThis as any).document = dom.window.document;
  (globalThis as any).navigator = dom.window.navigator;
  (globalThis as any).HTMLElement = dom.window.HTMLElement;
  (globalThis as any).Node = dom.window.Node;
}

// 테스트 환경에서 필요한 전역 설정
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
  }),
  usePathname: () => "/",
}));

// API 모킹
vi.mock("@/lib/api/mission", () => ({
  fetchMissionData: vi.fn(),
}));

// PageLayout 모킹
vi.mock("@/components/layouts/PageLayout", () => {
  return function MockPageLayout({
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
    return <div>{children}</div>;
  };
});
