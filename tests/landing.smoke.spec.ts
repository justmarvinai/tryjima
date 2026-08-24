import { test, expect } from "@playwright/test";

test.use({ viewport: { width: 1300, height: 900 } });

test("landing renders and the primary CTA opens the Studio", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Motion graphics for social media/ })).toBeVisible();
  // Nav CTA → Studio
  await page.getByRole("link", { name: "Open the Studio" }).first().click();
  await expect(page).toHaveURL(/\/studio$/);
  await expect(page.getByRole("heading", { name: "Pick a template" })).toBeVisible({ timeout: 20000 });
});

// The hero cards are the only links labelled "Edit <template>", so their shared
// parent is the carousel rail. Read it with page.evaluate rather than
// locator.evaluate: inside expect.poll a locator re-resolves, and its
// actionability wait never settles once the card has been paged out of the
// rail's visible strip.
const railScrollLeft = () =>
  (document.querySelector('a[aria-label^="Edit "]')?.parentElement as HTMLElement | null)?.scrollLeft ?? -1;

test.describe("hero carousel", () => {
  // Reduced motion makes the rail jump instead of animating. Here that is the
  // point: WebGL runs on SwiftShader, so a rAF-driven smooth scroll competing
  // with a dozen live previews can still be mid-flight seconds later. It also
  // pins the reduced-motion branch (poster frames, no live contexts).
  test.use({ reducedMotion: "reduce" });

  test("arrows page through more templates", async ({ page }) => {
    await page.goto("/");
    await page.locator('a[aria-label^="Edit "]').first().waitFor({ timeout: 20000 });
    const scrolled = () => page.evaluate(railScrollLeft);
    expect(await scrolled()).toBe(0);

    await page.getByRole("button", { name: "Show more templates" }).click();
    await expect.poll(scrolled, { timeout: 5000 }).toBeGreaterThan(200);
    await page.getByRole("button", { name: "Show previous templates" }).click();
    await expect.poll(scrolled, { timeout: 5000 }).toBe(0);
  });
});

test("gallery cards deep-link into a template", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("heading", { name: "Templates for every post" }).waitFor({ timeout: 20000 });
  // Scope to the static gallery grid (the marquee rail is animated).
  await page.locator("#templates").getByRole("link", { name: /Glow Promo/ }).first().click();
  await expect(page).toHaveURL(/\/studio\?t=glow-promo/);
  await expect(page.locator("canvas").first()).toBeVisible({ timeout: 20000 });
});

test("FAQ accordion expands", async ({ page }) => {
  await page.goto("/");
  const q = page.getByRole("button", { name: /Do I need an account\?/ });
  await q.scrollIntoViewIfNeeded();
  await q.click();
  await expect(page.getByText(/There's no login to create/)).toBeVisible();
});
