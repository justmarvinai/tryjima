// Regenerates the social link-preview image at apps/web/public/og.png.
//
// Per the project principle "poster frames come from the engine, never hand-made
// screenshots" (CLAUDE.md), the OG image is a real Jima render: template T01
// (Kinetic Headline) at 16:9, res 0.625 → 1200×675. Deterministic, so re-running
// only changes the committed file when the engine or copy intentionally changes.
//
// Run with:  pnpm exec playwright test og-image
import { test } from "@playwright/test";

const PUBLIC = new URL("../apps/web/public", import.meta.url).pathname;

test("generate og.png", async ({ page }) => {
  const v = encodeURIComponent(
    JSON.stringify({
      headline: "Motion graphics, in seconds.",
      subline: "Free · no account · no watermark",
      style: "pop",
    }),
  );
  await page.goto(`/harness.html?template=kinetic-headline&aspect=16:9&t=3.2&res=0.625&palette=ink-white&v=${v}`);
  await page.waitForFunction(() => window.__jimaHarnessReady === true, undefined, { timeout: 20000 });
  const err = await page.evaluate(() => window.__jimaError);
  if (err) throw new Error(`harness error: ${err}`);
  await page.locator("#jima-canvas").screenshot({ path: `${PUBLIC}/og.png` });
});
