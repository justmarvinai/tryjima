import { test, expect } from "@playwright/test";

// The unified landing: one page, two tools. These cover the routes a visitor
// actually takes out of it, plus the two pieces of the page that are live
// rather than static (the hero carousel and the FAQ).

test.use({ viewport: { width: 1300, height: 900 } });

test("landing renders and both product CTAs open their tool", async ({ page }) => {
  await page.goto("/");
  // 20s like every other route-mount wait in this file. The default 5s is fine
  // when this test runs alone and is not when it runs behind the a11y suite on
  // a loaded SwiftShader box — the hero boots WebGL previews and an animated
  // ground, and first paint has been seen to take longer than five seconds.
  await expect(page.getByRole("heading", { name: /Caption it/ })).toBeVisible({ timeout: 20000 });

  await page.getByRole("link", { name: "Open Motion" }).first().click();
  await expect(page).toHaveURL(/\/motion$/);
  await expect(page.getByRole("heading", { name: "Pick a template" })).toBeVisible({ timeout: 20000 });

  await page.goto("/");
  await page.getByRole("link", { name: "Caption a video" }).first().click();
  await expect(page).toHaveURL(/\/captions$/);
  // Either the dropzone or the capability floor is a pass here: this asserts
  // the route mounts, not that the browser can encode video, and not how fast
  // it gets there. 45s because the Captions route is a large lazy chunk served
  // by the dev server, and behind the a11y suite on this box it has been seen
  // to take longer than twenty seconds to arrive.
  await expect(
    page.getByRole("heading", { name: /Drop your video|can't run Captions/ }),
  ).toBeVisible({ timeout: 45000 });
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

/*
 * The headline is a caption line, and the transport under it is a real control
 * rather than an ornament. Keyboard rather than a drag, because it is exact:
 * the first key press also takes the playhead off the auto-play, so everything
 * after it is deterministic.
 */
test("the headline scrubber drives the caption highlight", async ({ page }) => {
  await page.goto("/");
  const slider = page.getByRole("slider", { name: "Scrub the headline captions" });
  await slider.waitFor({ timeout: 20000 });

  await slider.focus();
  await page.keyboard.press("Home");
  await expect(slider).toHaveAttribute("aria-valuenow", "0");
  const atStart = await slider.getAttribute("aria-valuetext");

  await page.keyboard.press("End");
  await expect(slider).toHaveAttribute("aria-valuenow", "100");
  const atEnd = await slider.getAttribute("aria-valuetext");

  // The value text names the word under the playhead, so a different word at
  // each end is the whole point: the highlight really did move.
  expect(atEnd).not.toBe(atStart);
  expect(atStart).toContain("Caption");
});

test("the tool switcher swaps the panel", async ({ page }) => {
  await page.goto("/");
  const captions = page.getByRole("tab", { name: "Captions" });
  const motion = page.getByRole("tab", { name: "Motion" });
  await captions.waitFor({ timeout: 20000 });

  await expect(captions).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("heading", { name: "Jima Captions" })).toBeVisible();

  await motion.click();
  await expect(motion).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("heading", { name: "Jima Motion" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Jima Captions" })).toBeHidden();
});

/*
 * Compositing guards for the rail.
 *
 * Four live WebGL canvases sit in it. Hovering a card used to flicker the wide
 * 16:9 ones, because the rail carried a `mask-image` and each card ran
 * `transition-all` over `box-shadow` and `border-color` — a mask pulls every
 * descendant into one layer, and a paint transition then re-rasterises the
 * canvases instead of letting the compositor move them. None of that shows up in
 * a screenshot (the symptom is a dropped frame), so the only way to keep it from
 * creeping back is to assert on the properties themselves.
 *
 * Dropping the mask is also what fixed the left-hand edge: it was a *directional*
 * mask that collapsed to 0px on whichever side had nothing left to scroll to, so
 * at rest the left arrow sat on a bright card with no fade behind it at all.
 */
test("the hero rail composites its live previews rather than repainting them", async ({ page }) => {
  await page.goto("/");
  await page.locator('a[aria-label^="Edit "]').first().waitFor({ timeout: 20000 });

  const styles = await page.evaluate(() => {
    const card = document.querySelector('a[aria-label^="Edit "]') as HTMLElement;
    const rail = card.parentElement as HTMLElement;
    const railStyle = getComputedStyle(rail);
    const cards = Array.from(rail.querySelectorAll('a[aria-label^="Edit "]')) as HTMLElement[];
    // The edge fades are the rail's gradient siblings — one per side.
    const fades = Array.from(rail.parentElement!.children)
      .filter((el) => el !== rail)
      .map((el) => getComputedStyle(el as HTMLElement))
      .filter((cs) => cs.backgroundImage.includes("gradient") && cs.position === "absolute")
      .map((cs) => ({ left: cs.left, right: cs.right, opacity: Number(cs.opacity) }));
    return {
      railMask: railStyle.maskImage,
      cardTransitions: [...new Set(cards.map((c) => getComputedStyle(c).transitionProperty))],
      fades,
    };
  });

  expect(styles.railMask).toBe("none");
  // Every card transitions the composited properties and nothing else.
  // (`transition-transform` expands to `transform, translate, scale, rotate`.)
  expect(styles.cardTransitions).toHaveLength(1);
  for (const t of styles.cardTransitions) {
    expect(t).toContain("transform");
    expect(t).not.toContain("all");
    expect(t).not.toContain("box-shadow");
    expect(t).not.toContain("border-color");
  }
  // One fade per side, and BOTH visible while parked at the start.
  expect(styles.fades).toHaveLength(2);
  for (const f of styles.fades) expect(f.opacity).toBeGreaterThan(0.3);
  expect(styles.fades.some((f) => f.left === "0px")).toBe(true);
  expect(styles.fades.some((f) => f.right === "0px")).toBe(true);
});

test("hovering a hero card keeps its live preview alive", async ({ page }) => {
  await page.goto("/");
  const first = page.locator('a[aria-label^="Edit "]').first();
  await first.waitFor({ timeout: 20000 });
  // Scroll to the rail first. It sits below the stage, so on a laptop-height
  // viewport it starts just outside the observer's margin and no context is
  // built until a visitor comes down to it — which is the intended behaviour,
  // and means asserting from the top of the page is a race.
  await first.scrollIntoViewIfNeeded();
  // Then give the cards time to swap their posters for real contexts; four
  // WebGL boots on SwiftShader is not quick.
  await expect
    .poll(() => page.locator('a[aria-label^="Edit "] canvas').count(), { timeout: 45000 })
    .toBeGreaterThan(0);

  await page.evaluate(() => {
    const rail = (document.querySelector('a[aria-label^="Edit "]') as HTMLElement).parentElement!;
    const w = window as unknown as { __canvasChurn: number };
    w.__canvasChurn = 0;
    new MutationObserver((recs) => {
      for (const r of recs) {
        for (const n of [...r.addedNodes, ...r.removedNodes]) if (n.nodeName === "CANVAS") w.__canvasChurn++;
      }
    }).observe(rail, { childList: true, subtree: true });
  });

  // The card lifts 6px on hover. With a non-zero IntersectionObserver threshold
  // that alone could cross the boundary, tearing the WebGL context down and
  // rebuilding it on every hover — which is a flicker you can see.
  const card = page.locator('a[aria-label^="Edit "]').first();
  for (let i = 0; i < 3; i++) {
    await card.hover();
    await page.waitForTimeout(400);
    await page.mouse.move(650, 60);
    await page.waitForTimeout(400);
  }

  const churn = await page.evaluate(() => (window as unknown as { __canvasChurn: number }).__canvasChurn);
  expect(churn).toBe(0);
});

test.describe("hero carousel", () => {
  // Asking for reduced motion still exercises the branch that skips the live
  // WebGL previews and leaves poster frames — worth having on a rail that
  // would otherwise spin up a dozen contexts under SwiftShader.
  test.use({ reducedMotion: "reduce" });

  test("arrows page through more templates", async ({ page }) => {
    await page.goto("/");
    const firstCard = page.locator('a[aria-label^="Edit "]').first();
    await firstCard.waitFor({ timeout: 20000 });

    // Bring the rail up and let its previews finish booting BEFORE touching an
    // arrow. Clicking straight away makes Playwright scroll the button into
    // view, which is the same moment four WebGL contexts spin up — and a
    // smooth horizontal scroll competing with that on SwiftShader can outrun
    // any reasonable settle timeout. (Asking for reduced motion does not help:
    // this headless build reports `prefers-reduced-motion` as false regardless,
    // so the previews mount and the paging really does animate.)
    await firstCard.scrollIntoViewIfNeeded();
    await expect
      .poll(() => page.locator('a[aria-label^="Edit "] canvas').count(), { timeout: 45000 })
      .toBeGreaterThan(0);

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
