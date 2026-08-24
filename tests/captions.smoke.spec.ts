import { test, expect, type Page } from "@playwright/test";

/*
 * Jima Captions integration smoke.
 *
 * Two things are worth proving in a real browser, and neither is covered by the
 * Node unit suite:
 *
 *  1. Input validation reaches the user. The rules are unit-tested; what this
 *     checks is that a rejected file produces a visible, specific message
 *     instead of a spinner that never resolves.
 *
 *  2. The caption renderer actually paints, and paints the same frame twice.
 *     `drawCaptions` is the single function shared by the live preview and the
 *     export worker — the whole "what you see is what you get" guarantee rests
 *     on it being deterministic, and a Node test can only check its geometry
 *     helpers, not its output pixels.
 *
 * Transcription itself is deliberately not exercised: it would download a
 * ~150 MB model into CI on every run to test code that is a thin wrapper over
 * transformers.js.
 */

test.use({ viewport: { width: 1300, height: 900 } });

/** Drop a fabricated file onto the dropzone's file input. */
async function dropFile(page: Page, name: string, type: string, bytes: number) {
  await page.setInputFiles('input[type="file"]', {
    name,
    mimeType: type,
    // A buffer of the requested length. Content is irrelevant — every case here
    // is rejected before anything tries to decode it.
    buffer: Buffer.alloc(bytes, 1),
  });
}

test("the editor opens on the dropzone", async ({ page }) => {
  await page.goto("/captions");
  await expect(page.getByRole("heading", { name: /Drop your video here|can't run Captions/ })).toBeVisible({
    timeout: 20000,
  });
});

test.describe("input validation", () => {
  test("rejects a non-mp4 with a specific message", async ({ page }) => {
    await page.goto("/captions");
    await page.getByRole("heading", { name: "Drop your video here" }).waitFor({ timeout: 20000 });
    await dropFile(page, "holiday.mov", "video/quicktime", 1024);
    await expect(page.getByRole("alert")).toContainText("needs an .mp4 file");
  });

  test("rejects an empty file", async ({ page }) => {
    await page.goto("/captions");
    await page.getByRole("heading", { name: "Drop your video here" }).waitFor({ timeout: 20000 });
    await dropFile(page, "broken.mp4", "video/mp4", 0);
    await expect(page.getByRole("alert")).toContainText("empty");
  });

  test("names the limit when the file is too large", async ({ page }) => {
    await page.goto("/captions");
    await page.getByRole("heading", { name: "Drop your video here" }).waitFor({ timeout: 20000 });
    // 201 MB of zeroes, one megabyte past the limit. Allocated in the browser
    // rather than shipped as a fixture.
    await page.evaluate(async () => {
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const big = new File([new ArrayBuffer(201 * 1024 * 1024)], "huge.mp4", { type: "video/mp4" });
      const dt = new DataTransfer();
      dt.items.add(big);
      input.files = dt.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await expect(page.getByRole("alert")).toContainText("The limit is 200 MB");
  });
});

test("the shared caption renderer paints, and repaints identically", async ({ page }) => {
  // `?__e2e` is what exposes the store and the renderer on window — see
  // captions/state/store.ts. Nothing is exposed in normal use.
  await page.goto("/captions?__e2e");
  await page.waitForFunction(() => Boolean(window.__JIMA__), undefined, { timeout: 20000 });

  const { blank, first, second } = await page.evaluate(() => {
    const api = window.__JIMA__!;
    const style = api.store.getState().style;
    const cues = [
      {
        id: "c1",
        start: 0,
        end: 2,
        words: [
          { text: "HELLO", start: 0, end: 0.7 },
          { text: "WORLD", start: 0.7, end: 2 },
        ],
      },
    ];
    const canvas = document.createElement("canvas");
    canvas.width = 360;
    canvas.height = 640;
    const ctx = canvas.getContext("2d")!;

    const blankUrl = canvas.toDataURL("image/png");
    const scene = { cues, style, videoWidth: 360, videoHeight: 640 };
    api.drawCaptions(ctx, 1.0, scene);
    const a = canvas.toDataURL("image/png");
    // Draw a different frame in between, then come back — a renderer that
    // carried state between calls would return something else the second time.
    api.drawCaptions(ctx, 0.2, scene);
    api.drawCaptions(ctx, 1.0, scene);
    const b = canvas.toDataURL("image/png");
    return { blank: blankUrl, first: a, second: b };
  });

  expect(first, "the renderer drew nothing").not.toBe(blank);
  expect(second, "re-drawing the same time produced a different frame").toBe(first);
});
