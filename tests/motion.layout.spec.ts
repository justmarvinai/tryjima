import { test, expect } from "@playwright/test";

/*
 * Geometry guards for the Motion editor. Both of these shipped broken and
 * neither is visible to a unit test: they are the browser's own box model
 * disagreeing with what the code assumed.
 */

test.use({ viewport: { width: 1440, height: 900 } });

test("the template rail's thumbnails are not collapsed", async ({ page }) => {
  await page.goto("/motion?t=kinetic-type");
  await page.locator("canvas").first().waitFor({ timeout: 40000 });
  await page.waitForTimeout(3000);

  // 495 buttons in a fixed-height flex column overflow it by two orders of
  // magnitude. Without `shrink-0` every one was squashed to its 4px border box
  // and the whole rail rendered as a stack of grey slivers.
  const heights = await page.evaluate(() =>
    Array.from(document.querySelectorAll('nav[aria-label="Templates"] button'))
      .slice(0, 8)
      .map((b) => Math.round(b.getBoundingClientRect().height)),
  );
  expect(heights.length).toBeGreaterThan(0);
  for (const h of heights) expect(h).toBeGreaterThan(24);
});

test("the artboard matches the animation at every aspect", async ({ page }) => {
  await page.goto("/motion?t=kinetic-type");
  await page.locator("canvas").first().waitFor({ timeout: 40000 });
  await page.waitForTimeout(3000);

  // Only the aspects this template actually offers are rendered.
  const options = page.getByRole("radio");
  const labels = await options.allInnerTexts();

  for (const aspect of labels) {
    await options.filter({ hasText: aspect }).first().click();
    await page.waitForTimeout(1800);

    // The chrome is a sibling of the canvas, sized to the fitted canvas box.
    // Styling the measuring container with `aspect-ratio` + `max-height`
    // instead left 325px of dead surface inside the ring at 9:16.
    const gap = await page.evaluate(() => {
      const canvas = document.querySelector("section canvas") as HTMLCanvasElement;
      const chrome = canvas.parentElement?.querySelector("div[aria-hidden]") as HTMLElement | null;
      if (!chrome) return null;
      const c = canvas.getBoundingClientRect();
      const f = chrome.getBoundingClientRect();
      return { dx: Math.abs(f.width - c.width), dy: Math.abs(f.height - c.height) };
    });
    expect(gap, `aspect ${aspect}`).not.toBeNull();
    expect(gap!.dx, `aspect ${aspect} width`).toBeLessThanOrEqual(2);
    expect(gap!.dy, `aspect ${aspect} height`).toBeLessThanOrEqual(2);
  }
});
