import { test, expect, type Page } from "@playwright/test";
import type { ExportProfile } from "@jima/engine";

// Motion blur averages several poses per output frame. That is only checkable
// against real pixels, so this drives the real renderer and measures edge
// energy: a blurred frame of something moving fast must be measurably softer
// than the same frame rendered sharp, while still rendering a real picture.

async function load(page: Page, template: string, aspect = "16:9"): Promise<void> {
  await page.goto(`/harness.html?template=${template}&aspect=${encodeURIComponent(aspect)}&res=0.3&t=0`);
  await page.waitForFunction(() => window.__jimaHarnessReady === true, undefined, { timeout: 30000 });
  const err = await page.evaluate(() => window.__jimaError);
  if (err) throw new Error(`harness error: ${err}`);
}

test.describe("motion blur", () => {
  test("softens a frame in the middle of a fast move", async ({ page }) => {
    await load(page, "side-slide", "16:9");
    const duration = await page.evaluate(() => window.__jima!.duration);
    // A generous shutter, sampled mid-move where travel is fastest.
    const probe = await page.evaluate(
      ({ t }) => window.__jima!.blurProbe(t, 1 / 30, 8),
      { t: duration * 0.25 },
    );
    expect(probe.sharp).toBeGreaterThan(0);
    expect(probe.blurred).toBeGreaterThan(0);
    expect(probe.blurred).toBeLessThan(probe.sharp);
  });

  test("leaves a still frame essentially untouched", async ({ page }) => {
    await load(page, "side-slide", "16:9");
    const duration = await page.evaluate(() => window.__jima!.duration);
    // The designed hold at the end: nothing is moving, so averaging poses across
    // the shutter must not blur anything away.
    const probe = await page.evaluate(({ t }) => window.__jima!.blurProbe(t, 1 / 30, 8), {
      t: duration - 0.02,
    });
    expect(probe.blurred).toBeGreaterThan(probe.sharp * 0.9);
  });

  test("is deterministic", async ({ page }) => {
    await load(page, "side-slide", "16:9");
    const a = await page.evaluate(() => window.__jima!.blurProbe(0.5, 1 / 30, 8));
    const b = await page.evaluate(() => window.__jima!.blurProbe(0.5, 1 / 30, 8));
    expect(a.blurred).toBeCloseTo(b.blurred, 6);
  });

  test("a blurred export is still a real video with the exact frame count", async ({ page }) => {
    await load(page, "side-slide", "16:9");
    const profile: ExportProfile = { format: "webm", fps: 12, resolution: 0.25 };
    const out = await page.evaluate(
      (p) => window.__jima!.export(p, 1, false, false, true),
      profile,
    );
    expect(out.byteLength).toBeGreaterThan(1000);
    const probe = await page.evaluate((b64) => window.__jima!.probe(b64), out.base64);
    expect(probe).not.toBeNull();
    expect(probe!.packetCount).toBe(out.frames);
  });
});
