import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Mirror tsconfig paths: @ -> ./src
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    // Ensure jsdom environment so DOM globals (document/window) are available
    environment: "jsdom",
    // Run our setup file to initialize jsdom, mocks, and global helpers
    setupFiles: ["./src/test/setup.tsx"],
    // Enable global test APIs like `describe`, `it`, `expect`
    globals: true,
    // Allow importing CSS in tests
    css: true,
    // Typical patterns for test files in this repo
    include: ["src/**/*.{test,spec}.{ts,tsx,js,jsx}"],
    // Keep output deterministic in CI
    isolate: true,
  },
  // Ensure JSX handling matches Next/React setup
  esbuild: {
    jsx: "automatic",
  },
});
