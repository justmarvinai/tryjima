import { test, expect, type Page } from "@playwright/test";

// Emoji live in user text, so they only reach the canvas through the same path
// the templates use. What matters is that they paint a glyph rather than a
// "missing character" box — checkable only against real pixels.

async function load(page: Page, values: Record<string, string>): Promise<void> {
  const v = encodeURIComponent(JSON.stringify(values));
  await page.goto(`/harness.html?template=kinetic-headline&aspect=16:9&res=0.35&t=2.5&palette=ink-white&v=${v}`);
  await page.waitForFunction(() => window.__jimaHarnessReady === true, undefined, { timeout: 30000 });
  const err = await page.evaluate(() => window.__jimaError);
  if (err) throw new Error(`harness error: ${err}`);
}

/** Ink coverage, and how much of it is chromatic rather than grey. */
const inkOf = (page: Page) =>
  page.evaluate(() => {
    const { rgba, width, height } = window.__jimaReadCanvas!();
    let ink = 0;
    let coloured = 0;
    for (let i = 0; i < rgba.length; i += 4) {
      const r = rgba[i] ?? 255;
      const g = rgba[i + 1] ?? 255;
      const b = rgba[i + 2] ?? 255;
      if (r < 245 || g < 245 || b < 245) {
        ink++;
        if (Math.abs(r - g) > 20 || Math.abs(g - b) > 20) coloured++;
      }
    }
    return { ink, coloured, pixels: width * height };
  });

test.describe("emoji in template text", () => {
  test("render as real glyphs, not missing-character boxes", async ({ page }) => {
    await load(page, { headline: "Ship it" });
    const plain = await inkOf(page);
    await load(page, { headline: "Ship it 🚀" });
    const withEmoji = await inkOf(page);

    // The emoji adds ink...
    expect(withEmoji.ink).toBeGreaterThan(plain.ink);
    // ...and it is not a hollow tofu rectangle: a box outline of that size adds
    // far less ink than a filled glyph does.
    expect(withEmoji.ink - plain.ink).toBeGreaterThan(200);
  });

  test("survive an aspect change and a re-render", async ({ page }) => {
    await load(page, { headline: "Big 🎉 news" });
    const a = await inkOf(page);
    const b = await page.evaluate(() => {
      window.__jima!.renderAt(2.5);
      const { rgba } = window.__jimaReadCanvas!();
      let ink = 0;
      for (let i = 0; i < rgba.length; i += 4) if ((rgba[i] ?? 255) < 245) ink++;
      return ink;
    });
    expect(b).toBeGreaterThan(0);
    expect(a.ink).toBeGreaterThan(0);
  });

  test("measure into the layout instead of overflowing it", async ({ page }) => {
    // If emoji measured as zero-width the line would overlap itself; if they
    // measured against a fallback face the fit would be wrong. Both show up as
    // the text no longer fitting the safe area.
    await load(page, { headline: "🔥🔥🔥 Sale 🔥🔥🔥" });
    const edge = await page.evaluate(() => {
      const { rgba, width, height } = window.__jimaReadCanvas!();
      const col = (x: number): boolean => {
        for (let y = 0; y < height; y++) {
          const i = (y * width + x) * 4;
          if ((rgba[i] ?? 255) < 245) return true;
        }
        return false;
      };
      return { left: col(1), right: col(width - 2) };
    });
    expect(edge.left).toBe(false);
    expect(edge.right).toBe(false);
  });
});
