import { test, expect, type Page } from "@playwright/test";
import type { ExportProfile } from "@jima/engine";

// Trim and hold reshape the output clock. What matters is that the *exported
// file* actually gets shorter or longer and still holds a real picture — so
// this drives the real runner and exporter rather than the mapping in isolation.

async function load(page: Page, query: string): Promise<void> {
  await page.goto(`/harness.html?template=side-slide&aspect=16:9&res=0.25&${query}`);
  await page.waitForFunction(() => window.__jimaHarnessReady === true, undefined, { timeout: 30000 });
  const err = await page.evaluate(() => window.__jimaError);
  if (err) throw new Error(`harness error: ${err}`);
}

const durationOf = (page: Page) => page.evaluate(() => window.__jima!.duration);

test.describe("trim and hold", () => {
  test("report the output length, not the template's own", async ({ page }) => {
    await load(page, "t=0");
    const base = await durationOf(page);

    await load(page, "t=0&trim=1");
    expect(await durationOf(page)).toBeCloseTo(base - 1, 3);

    await load(page, "t=0&hold=2");
    expect(await durationOf(page)).toBeCloseTo(base + 2, 3);

    await load(page, "t=0&trim=0.5&hold=1.5");
    expect(await durationOf(page)).toBeCloseTo(base + 1, 3);
  });

  test("a held frame is the last frame, not a blank one", async ({ page }) => {
    await load(page, "t=0&hold=2");
    const duration = await durationOf(page);
    const shots = await page.evaluate((d) => {
      const grab = (t: number): string => {
        window.__jima!.renderAt(t);
        return window.__jima!.canvas.toDataURL("image/png");
      };
      // Inside the hold, and right at the end of it.
      return { early: grab(d - 1.8), late: grab(d - 0.01) };
    }, duration);
    expect(shots.early).toBe(shots.late);
    // A blank canvas encodes tiny; a real held frame does not.
    expect(shots.late.length).toBeGreaterThan(2000);
  });

  test("trimming starts the output past the intro", async ({ page }) => {
    await load(page, "t=0");
    const untrimmed = await page.evaluate(() => {
      window.__jima!.renderAt(0);
      return window.__jima!.canvas.toDataURL("image/png");
    });
    await load(page, "t=0&trim=1.2");
    const trimmed = await page.evaluate(() => {
      window.__jima!.renderAt(0);
      return window.__jima!.canvas.toDataURL("image/png");
    });
    expect(trimmed).not.toBe(untrimmed);
  });

  test("the exported file is as long as the output clock says", async ({ page }) => {
    const profile: ExportProfile = { format: "webm", fps: 10, resolution: 0.25 };
    await load(page, "t=0");
    const plain = await page.evaluate((p) => window.__jima!.export(p), profile);

    await load(page, "t=0&hold=2");
    const held = await page.evaluate((p) => window.__jima!.export(p), profile);

    // 2s of hold at 10fps is 20 more frames.
    expect(held.frames - plain.frames).toBe(20);
    const probe = await page.evaluate((b64) => window.__jima!.probe(b64), held.base64);
    expect(probe!.packetCount).toBe(held.frames);
  });
});
