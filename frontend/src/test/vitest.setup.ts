// vitest.setup.ts
// Vitest global setup helpers: ensure a JSDOM-like environment is available and
// extend expect() with Testing Library matchers.
//
// This file is intended to be referenced from Vitest config's `setupFiles`.
//
// Usage (package.json or vitest.config):
// {
//   "vitest": {
//     "test": {
//       "environment": "jsdom",
//       "setupFiles": ["./src/test/vitest.setup.ts"]
//     }
//   }
// }

import { JSDOM } from 'jsdom';
import '@testing-library/jest-dom';

// If the test runner is not already providing a DOM (defensive fallback),
// create a minimal JSDOM environment and expose typical globals used by tests.
if (typeof globalThis.document === 'undefined' || typeof globalThis.window === 'undefined') {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', {
    url: 'http://localhost/',
  });

  // Basic DOM globals
  (globalThis as any).window = dom.window;
  (globalThis as any).document = dom.window.document;
  (globalThis as any).navigator = dom.window.navigator;
  (globalThis as any).HTMLElement = dom.window.HTMLElement;
  (globalThis as any).Node = dom.window.Node;
  (globalThis as any).KeyboardEvent = dom.window.KeyboardEvent;
  (globalThis as any).MouseEvent = dom.window.MouseEvent;
  (globalThis as any).Event = dom.window.Event;

  // Common browser APIs used by libraries/components
  (globalThis as any).getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
  (globalThis as any).requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);
  (globalThis as any).cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window);

  // A minimal window.location for components that read it
  try {
    // some environments freeze location; guard against that
    (globalThis as any).window.location = dom.window.location;
  } catch {
    // ignore
  }
}

// Optional: provide a global fetch if tests depend on fetch and the environment doesn't provide one.
// Uncomment and install a fetch polyfill if needed (e.g., node-fetch or cross-fetch).
// import fetch from 'cross-fetch'
// if (typeof (globalThis as any).fetch === 'undefined') {
//   (globalThis as any).fetch = fetch;
// }

// Export nothing; file is only executed for its side effects.
export {};
