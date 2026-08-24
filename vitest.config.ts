import { defineConfig } from "vitest/config";

// Unit tests run in Node (pure logic: timeline math, easings, springs, RNG,
// layout, capability parsing). Browser-dependent rendering is covered by the
// Playwright golden-frame + export-smoke suites (`pnpm test:golden`).
export default defineConfig({
  test: {
    // Pure Studio logic (gallery facets, persistence shapes) lives in apps/web
    // and is unit-testable in Node too — anything needing a DOM belongs in the
    // Playwright suites instead.
    include: ["packages/**/*.test.ts", "apps/web/src/**/*.test.ts"],
    environment: "node",
    passWithNoTests: false,
  },
});
