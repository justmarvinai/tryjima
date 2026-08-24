import { test, expect } from "@playwright/test";

// Phase 0 smoke: proves the Playwright + Vite + browser pipeline works in this
// environment, so the Phase 1 golden-frame suite has solid ground to build on.
test("render harness page loads and signals ready", async ({ page }) => {
  await page.goto("/harness.html");
  await page.waitForFunction(() => window.__jimaHarnessReady === true, undefined, {
    timeout: 15_000,
  });
  expect(await page.evaluate(() => window.__jimaHarnessReady)).toBe(true);
});

test("headless WebGL is available (required by the Pixi renderer)", async ({ page }) => {
  await page.goto("/harness.html");
  const hasWebGL = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    return gl != null;
  });
  expect(hasWebGL).toBe(true);
});
