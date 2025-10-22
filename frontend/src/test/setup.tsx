import React from "react";
import "@testing-library/jest-dom";
import { afterEach, beforeAll, mock } from "bun:test";
import { cleanup } from "@testing-library/react";
import { Window } from "happy-dom";

// Provide a more complete `jest.fn` compatible mock factory so existing tests
// using `jest.fn()` or `fn()` behave similarly to Jest's mocks.
function createMockFunction(impl?: (...args: any[]) => any) {
  const f: any = (...args: any[]) => {
    f.mock.calls.push(args);
    f.mock.instances.push(this);
    // If there are one-time implementations queued, use the next one
    if (f._onceQueue && f._onceQueue.length > 0) {
      const onceImpl = f._onceQueue.shift();
      return onceImpl.apply(this, args);
    }
    if (f._impl) return f._impl.apply(this, args);
    return undefined;
  };

  // Internal queues and mock state
  f._onceQueue = [];
  f.mock = { calls: [], instances: [] };

  // Common mock APIs used by Jest/Vitest/Bun
  f.mockClear = () => { f.mock.calls = []; f.mock.instances = []; return f; };
  f.mockReset = () => { f.mock.calls = []; f.mock.instances = []; f._impl = undefined; f._onceQueue = []; return f; };
  f.mockImplementation = (implFn: (...args: any[]) => any) => { f._impl = implFn; return f; };
  f.mockImplementationOnce = (implFn: (...args: any[]) => any) => { f._onceQueue.push(implFn); return f; };
  f.mockReturnValue = (v: any) => { f._impl = () => v; return f; };
  f.mockReturnValueOnce = (v: any) => { f._onceQueue.push(() => v); return f; };
  f.mockResolvedValue = (v: any) => { f._impl = () => Promise.resolve(v); return f; };
  f.mockResolvedValueOnce = (v: any) => { f._onceQueue.push(() => Promise.resolve(v)); return f; };
  f.mockRejectedValue = (v: any) => { f._impl = () => Promise.reject(v); return f; };
  f.mockRejectedValueOnce = (v: any) => { f._onceQueue.push(() => Promise.reject(v)); return f; };
  f.mockReturnThis = () => { f._impl = function (this: any) { return this; }; return f; };
  f.mockName = (name: string) => { f._name = name; return f; };
  f.getMockName = () => f._name || 'mockFunction';

  // Additional compatibility helpers so matchers recognize this as a mock
  try {
    Object.defineProperty(f, '_isMockFunction', { value: true, configurable: true, writable: true });
  } catch (e) {
    // ignore if the property is readonly in this environment
  }
  f.getMockImplementation = () => f._impl;
  f.mockRestore = () => { };

  // Ensure the function reports a reasonable name
  try {
    Object.defineProperty(f, 'name', { value: f._name || 'mockFunction', configurable: true });
  } catch (e) {
    // ignore if not writable in some environments
  }

  // Make Function.prototype._isMockFunction report true for any function that
  // has a `.mock` property to improve compatibility with different mock
  // implementations that expect `_isMockFunction` to be present.
  if (!Object.prototype.hasOwnProperty.call(Function.prototype, '_isMockFunction')) {
    Object.defineProperty(Function.prototype, '_isMockFunction', {
      get() {
        try {
          return !!(this && (this as any).mock);
        } catch (e) {
          return false;
        }
      },
      configurable: true,
    });
  }

  if (impl) f._impl = impl;
  return f;
}

// Expose minimal jest and fn globals
// @ts-ignore
globalThis.jest = { fn: createMockFunction };
// @ts-ignore
globalThis.fn = createMockFunction;

// Setup HappyDOM environment
const window = new Window();
const document = window.document;

; (global as any).window = window;
; (global as any).document = document;
; (global as any).navigator = window.navigator;

// Clean up after each test
afterEach(() => {
  cleanup();
});

// Mock matchMedia for tests that might use it
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: createMockFunction((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: createMockFunction(), // deprecated
    removeListener: createMockFunction(), // deprecated
    addEventListener: createMockFunction(),
    removeEventListener: createMockFunction(),
    dispatchEvent: createMockFunction(),
  })),
});

// Mock ResizeObserver
; (global as any).ResizeObserver = createMockFunction(() => ({
  observe: createMockFunction(),
  unobserve: createMockFunction(),
  disconnect: createMockFunction(),
}));

// Mock IntersectionObserver
; (global as any).IntersectionObserver = createMockFunction(() => ({
  observe: createMockFunction(),
  unobserve: createMockFunction(),
  disconnect: createMockFunction(),
}));

// Next.js 라우터 모킹
mock("next/navigation", () => ({
  useRouter: () => ({
    push: createMockFunction(),
    replace: createMockFunction(),
    prefetch: createMockFunction(),
    back: createMockFunction(),
    forward: createMockFunction(),
    refresh: createMockFunction(),
  }),
  useSearchParams: () => ({
    get: createMockFunction(),
    has: createMockFunction(),
    getAll: createMockFunction(),
    keys: createMockFunction(),
    values: createMockFunction(),
    entries: createMockFunction(),
    forEach: createMockFunction(),
    toString: createMockFunction(),
  }),
  usePathname: () => "/",
}));

// API 모킹
mock("@/lib/api/mission", () => ({
  fetchMissionData: createMockFunction(),
}));


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
