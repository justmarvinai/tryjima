// Regenerates the social link-preview image at apps/web/public/og.png.
//
// Per the project principle "poster frames come from the engine, never hand-made
// screenshots" (CLAUDE.md), the OG image is a real Jima render: the Kinetic
// Headline template at 16:9, res 0.625 → 1200×675, wearing the product's own
// brand colours. Deterministic, so re-running only changes the committed file
// when the engine or the copy intentionally changes.
//
// Run with:  pnpm exec playwright test og-image
import { test } from "@playwright/test";

const PUBLIC = new URL("../apps/web/public", import.meta.url).pathname;

test("generate og.png", async ({ page }) => {
  const v = encodeURIComponent(
    JSON.stringify({
      headline: "Caption it. Animate it. Post it.",
      subline: "Two free browser tools · nothing uploaded",
      style: "pop",
      // The Nocturne palette, so the link preview looks like the site it opens.
      background: "#08090B",
      textColor: "#F2F3F5",
      accent: "#C8FF3D",
    }),
  );
  await page.goto(`/harness.html?template=kinetic-headline&aspect=16:9&t=3.2&res=0.625&palette=ink-white&v=${v}`);
  await page.waitForFunction(() => window.__jimaHarnessReady === true, undefined, { timeout: 20000 });
  const err = await page.evaluate(() => window.__jimaError);
  if (err) throw new Error(`harness error: ${err}`);
  await page.locator("#jima-canvas").screenshot({ path: `${PUBLIC}/og.png` });
});
