import { test, expect } from "@playwright/test";

// The unified landing: one page, two tools. These cover the routes a visitor
// actually takes out of it, plus the two pieces of the page that are live
// rather than static (the hero carousel and the FAQ).

test.use({ viewport: { width: 1300, height: 900 } });

test("landing renders and both product CTAs open their tool", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Caption it/ })).toBeVisible();

  await page.getByRole("link", { name: "Open Motion" }).first().click();
  await expect(page).toHaveURL(/\/motion$/);
  await expect(page.getByRole("heading", { name: "Pick a template" })).toBeVisible({ timeout: 20000 });

  await page.goto("/");
  await page.getByRole("link", { name: "Caption a video" }).first().click();
  await expect(page).toHaveURL(/\/captions$/);
  // Either the dropzone or the capability floor is a pass here: this asserts
  // the route mounts, not that the browser can encode video.
  await expect(
    page.getByRole("heading", { name: /Drop your video|can't run Captions/ }),
  ).toBeVisible({ timeout: 20000 });
});

test("the tools menu lists both products", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Tools" }).click();
  await expect(page.getByRole("link", { name: /Jima Captions/ }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: /Jima Motion/ }).first()).toBeVisible();
});

// The hero cards are the only links labelled "Edit <template>", so their shared
// parent is the carousel rail. Read it with page.evaluate rather than
// locator.evaluate: inside a poll a locator re-resolves, and its actionability
// wait never settles once the card has been paged out of the rail's visible
// strip.
const railScrollLeft = () =>
  (document.querySelector('a[aria-label^="Edit "]')?.parentElement as HTMLElement | null)?.scrollLeft ?? -1;

/*
 * Paging is a *smooth* scroll unless the visitor asked for reduced motion, and
 * this headless build reports `prefers-reduced-motion: reduce` as false even
 * when Playwright emulates it — so the animation really does run here, and on
 * a loaded SwiftShader box it can take a couple of seconds. Every assertion
 * below therefore polls for the settled value with a generous timeout; a single
 * sample catches the rail mid-flight and reads whatever intermediate position
 * it happened to be at (0, 101 and 837 have all been seen for the same click).
 */
const SCROLL_SETTLE_MS = 15_000;

test.describe("hero carousel", () => {
  // Asking for reduced motion still exercises the branch that skips the live
  // WebGL previews and leaves poster frames — worth having on a rail that
  // would otherwise spin up a dozen contexts under SwiftShader.
  test.use({ reducedMotion: "reduce" });

  test("arrows page through more templates", async ({ page }) => {
    await page.goto("/");
    await page.locator('a[aria-label^="Edit "]').first().waitFor({ timeout: 20000 });
    const scrolled = () => page.evaluate(railScrollLeft);
    expect(await scrolled()).toBe(0);

    await page.getByRole("button", { name: "Show more templates" }).click();
    await expect.poll(scrolled, { timeout: SCROLL_SETTLE_MS }).toBeGreaterThan(200);

    // Wait for the rail to re-render with the left arrow live before clicking
    // it. The arrow is inert (`aria-disabled`, and its handler returns early)
    // until the scroll handler has told React the rail is no longer at its
    // start — click inside that window and the press is simply swallowed.
    const back = page.getByRole("button", { name: "Show previous templates" });
    await expect(back).toHaveAttribute("aria-disabled", "false");
    await back.click();
    await expect.poll(scrolled, { timeout: SCROLL_SETTLE_MS }).toBe(0);
  });
});

test("marquee cards deep-link into a template", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("heading", { name: /Caption it/ }).waitFor({ timeout: 20000 });
  // The marquee is a lazy chunk well below the fold — scroll it in first.
  await page.locator("#templates").scrollIntoViewIfNeeded();
  await page.getByRole("heading", { name: /Something for whatever you're posting/ }).waitFor({ timeout: 20000 });

  // Take whichever card the marquee sampled rather than naming one: the sample
  // is "every sixth template", so hard-coding a name breaks the moment the
  // library grows. Stop the rows and rewind them to their start — merely
  // pausing leaves the first card wherever the animation had carried it, which
  // is usually off the left edge and therefore unclickable.
  const rail = page.locator("#templates");
  await rail.locator("[style*='jima-marquee']").evaluateAll((els) => {
    for (const el of els) {
      const row = el as HTMLElement;
      row.style.animation = "none";
      row.style.transform = "none";
    }
  });
  const card = rail.getByRole("link").first();
  await card.click();
  await expect(page).toHaveURL(/\/motion\?t=[a-z0-9-]+/);
  await expect(page.locator("canvas").first()).toBeVisible({ timeout: 20000 });
});

test("FAQ accordion expands", async ({ page }) => {
  await page.goto("/");
  const q = page.getByRole("button", { name: /Do my videos get uploaded anywhere\?/ });
  await q.scrollIntoViewIfNeeded();
  await q.click();
  await expect(page.getByText(/there is no backend that could receive a video/)).toBeVisible();
});

test("the command palette navigates between tools", async ({ page }) => {
  await page.goto("/");
  // Wait for the route chunk to mount: the palette lives in the layout route,
  // and a keypress sent before it hydrates goes nowhere.
  await page.getByRole("heading", { name: /Caption it/ }).waitFor({ timeout: 20000 });
  await page.keyboard.press("ControlOrMeta+k");
  const palette = page.getByRole("dialog", { name: "Command palette" });
  await expect(palette).toBeVisible();
  await palette.getByRole("textbox").fill("motion");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/motion$/);
});
