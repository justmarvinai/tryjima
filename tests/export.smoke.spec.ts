import { test, expect, type Page } from "@playwright/test";
import type { ExportProfile } from "@jima/engine";

// Phase 2 export-smoke suite: prove T01 leaves the browser as MP4/WebM/GIF,
// fully client-side, with the exact frame count. Video outputs are decoded back
// with Mediabunny to verify real container contents (not just magic bytes).

async function loadHarness(page: Page): Promise<void> {
  await page.goto("/harness.html?template=kinetic-headline&aspect=1:1&res=0.25&palette=ink-white");
  await page.waitForFunction(() => window.__jimaHarnessReady === true, undefined, { timeout: 20000 });
  const err = await page.evaluate(() => window.__jimaError);
  if (err) throw new Error(`harness error: ${err}`);
}

async function runExport(page: Page, profile: ExportProfile) {
  return page.evaluate((p) => window.__jima!.export(p), profile);
}

async function runExportWithSound(page: Page, profile: ExportProfile) {
  return page.evaluate((p) => window.__jima!.export(p, 1, true), profile);
}

// T01 is 4.0s. res 0.25 → 270×270 (even). fps 12 → 48 frames.
const FPS = 12;
const EXPECTED_FRAMES = 48;
const DIM = 270;

test.describe("capabilities", () => {
  test("WebM + GIF are always available; MP4 is probed honestly", async ({ page }) => {
    await loadHarness(page);
    const caps = await page.evaluate(() => window.__jima!.caps());
    // VP9/VP8 (WebM) works wherever WebCodecs does; GIF is pure JS.
    expect(caps.webm).toBe("native");
    expect(caps.gif).toBe("always");
    // MP4/H.264 depends on a platform encoder — 'native' or 'none' are both
    // valid (headless SwiftShader Chromium and Firefox commonly lack it). The
    // point is we never claim a format we can't actually produce.
    expect(["native", "none"]).toContain(caps.mp4);
  });
});

test.describe("MP4 export", () => {
  test("produces a real MP4 with the exact frame count (where H.264 is available)", async ({
    page,
  }) => {
    await loadHarness(page);
    const caps = await page.evaluate(() => window.__jima!.caps());
    test.skip(caps.mp4 !== "native", "No H.264 encoder in this browser/environment (Tier B).");

    const out = await runExport(page, { format: "mp4", fps: FPS, resolution: 0.25 });
    expect(out.format).toBe("mp4");
    expect(out.frames).toBe(EXPECTED_FRAMES);
    expect(out.filename).toMatch(/^jima-kinetic-headline-270x270\.mp4$/);

    const probe = await page.evaluate((b64) => window.__jima!.probe(b64), out.base64);
    expect(probe).not.toBeNull();
    expect(probe!.width).toBe(DIM);
    expect(probe!.height).toBe(DIM);
    expect(probe!.packetCount).toBe(EXPECTED_FRAMES);
    expect(probe!.duration).toBeCloseTo(EXPECTED_FRAMES / FPS, 1);
  });
});

test.describe("WebM export", () => {
  test("produces a real WebM with the exact frame count", async ({ page }) => {
    await loadHarness(page);
    const out = await runExport(page, { format: "webm", fps: FPS, resolution: 0.25 });
    expect(out.format).toBe("webm");
    expect(out.byteLength).toBeGreaterThan(0);
    expect(out.frames).toBe(EXPECTED_FRAMES);

    const probe = await page.evaluate((b64) => window.__jima!.probe(b64), out.base64);
    expect(probe).not.toBeNull();
    expect(probe!.packetCount).toBe(EXPECTED_FRAMES);
  });
});

test.describe("GIF export", () => {
  test("produces a valid, budget-sized GIF89a", async ({ page }) => {
    await loadHarness(page);
    const out = await runExport(page, { format: "gif", fps: 10, resolution: 0.25, gifMaxColors: 128 });
    expect(out.format).toBe("gif");
    expect(out.byteLength).toBeGreaterThan(0);
    // Under the 8 MB GIF budget (docs/TEMPLATE_LIBRARY.md QA gate).
    expect(out.byteLength).toBeLessThan(8 * 1024 * 1024);

    const header = await page.evaluate((b64) => atob(b64).slice(0, 6), out.base64);
    expect(header).toBe("GIF89a");
  });
});

test.describe("sound track", () => {
  test("WebM with sound on muxes a real audio track alongside the exact video frames", async ({
    page,
  }) => {
    await loadHarness(page);
    const caps = await page.evaluate(() => window.__jima!.caps());
    test.skip(!caps.webmAudioCodec, "No Opus/AudioEncoder in this browser/environment.");

    const out = await runExportWithSound(page, { format: "webm", fps: FPS, resolution: 0.25 });
    expect(out.format).toBe("webm");
    expect(out.frames).toBe(EXPECTED_FRAMES);

    const probe = await page.evaluate((b64) => window.__jima!.probe(b64), out.base64);
    expect(probe).not.toBeNull();
    expect(probe!.packetCount).toBe(EXPECTED_FRAMES); // video unaffected
    expect(probe!.audioPacketCount).toBeGreaterThan(0); // sound actually baked in
  });

  test("sound off produces no audio track", async ({ page }) => {
    await loadHarness(page);
    const out = await runExport(page, { format: "webm", fps: FPS, resolution: 0.25 });
    const probe = await page.evaluate((b64) => window.__jima!.probe(b64), out.base64);
    expect(probe!.audioPacketCount).toBe(0);
  });
});

test.describe("transparent (alpha) export", () => {
  test("a transparent render blanks the background — corner alpha is 0", async ({ page }) => {
    await page.goto("/harness.html?template=kinetic-headline&aspect=1:1&res=0.25&transparent=1&t=0");
    await page.waitForFunction(() => window.__jimaHarnessReady === true, undefined, { timeout: 20000 });
    const alpha = await page.evaluate(() => window.__jima!.cornerAlpha());
    expect(alpha).toBeLessThan(8); // fully transparent corners
  });

  test("transparent WebM is a real VP9-alpha track with the exact frame count", async ({ page }) => {
    await loadHarness(page);
    const out = await page.evaluate(
      (p) => window.__jima!.export(p, 1, false, true),
      { format: "webm", fps: FPS, resolution: 0.25 } as ExportProfile,
    );
    expect(out.format).toBe("webm");
    expect(out.frames).toBe(EXPECTED_FRAMES);

    const probe = await page.evaluate((b64) => window.__jima!.probe(b64), out.base64);
    expect(probe).not.toBeNull();
    expect(probe!.packetCount).toBe(EXPECTED_FRAMES);
    expect(probe!.transparent).toBe(true); // the WebM track carries alpha
  });

  test("a normal (opaque) WebM is not marked transparent", async ({ page }) => {
    await loadHarness(page);
    const out = await runExport(page, { format: "webm", fps: FPS, resolution: 0.25 });
    const probe = await page.evaluate((b64) => window.__jima!.probe(b64), out.base64);
    expect(probe!.transparent).toBe(false);
  });
});

test.describe("cancellation", () => {
  test("an aborted signal rejects with ExportCancelledError and leaks nothing", async ({ page }) => {
    await loadHarness(page);
    // Use WebM so the frame loop is actually reached (it's always available);
    // an immediately-aborted signal must bail on the first frame.
    const name = await page.evaluate(
      (p) => window.__jima!.exportExpectCancel(p),
      { format: "webm", fps: FPS, resolution: 0.25 } as ExportProfile,
    );
    expect(name).toBe("ExportCancelledError");
  });
});
