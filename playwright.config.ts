import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";

// Use the environment's pre-installed Chromium when present (its build may not
// match this Playwright version's bundled download). CI installs its own, so
// there this resolves to undefined and Playwright uses the bundled browser.
const preinstalledChromium = process.env.PLAYWRIGHT_BROWSERS_PATH
  ? `${process.env.PLAYWRIGHT_BROWSERS_PATH}/chromium`
  : undefined;
const chromiumExecutable =
  preinstalledChromium && existsSync(preinstalledChromium) ? preinstalledChromium : undefined;

// Golden-frame + export-smoke tests drive the headless render harness
// (apps/web/harness.html) in real browsers. WebGL is enabled via SwiftShader
// so Pixi renders deterministically in CI headless Chromium.
const PORT = 5178;

const swiftshaderArgs = [
  "--use-gl=angle",
  "--use-angle=swiftshader",
  "--enable-unsafe-swiftshader",
  "--ignore-gpu-blocklist",
];

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  // Single worker: WebGL here is SwiftShader (software), and two concurrent
  // Studio flows — especially the real GIF export encode — starve each other on
  // a small CI box. One worker keeps every test on full CPU (the export finishes
  // in ~20s instead of timing out) at the cost of a serial run. The determinism
  // and poster tests are quick enough that the total stays a few minutes.
  workers: 1,
  forbidOnly: !!process.env.CI,
  // WebGL runs on SwiftShader (software) here, so a Studio end-to-end flow —
  // spin up a preview context, render, export a real GIF — is CPU-bound and can
  // take a while when workers overlap. 90s gives these heavy flows headroom; the
  // fast golden/harness renders still finish in seconds.
  timeout: 90_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "line" : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          args: swiftshaderArgs,
          ...(chromiumExecutable ? { executablePath: chromiumExecutable } : {}),
        },
      },
    },
  ],
  webServer: {
    command: `pnpm --filter @jima/web exec vite --port ${PORT} --strictPort`,
    port: PORT,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
