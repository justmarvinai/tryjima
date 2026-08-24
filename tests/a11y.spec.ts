import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// WCAG 2.1 A/AA automated pass over the key surfaces. Canvas/WebGL regions are
// exercised elsewhere; here we check the DOM chrome (contrast, labels, roles).
//
// Contrast matters more since the v2.0 dark redesign than it did on white: on
// near-black, a "muted" grey that looks fine to the eye can sit at 3:1. Every
// text token in styles/index.css is picked to clear 4.5:1 on --color-void, and
// this suite is what keeps that true as pages get built on top of them.
async function analyze(page: Page) {
  return new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
}

async function expectClean(page: Page) {
  const results = await analyze(page);
  const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(
    serious,
    JSON.stringify(
      serious.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target).slice(0, 4) })),
      null,
      2,
    ),
  ).toEqual([]);
}

test("landing has no serious a11y violations", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("heading", { name: /Caption it/ }).waitFor({ timeout: 20000 });
  // Let the lazy marquee mount so its cards are in the tree when axe runs.
  await page.locator("#templates").scrollIntoViewIfNeeded();
  await page
    .getByRole("heading", { name: /Something for whatever you're posting/ })
    .waitFor({ timeout: 20000 })
    .catch(() => {});
  await expectClean(page);
});

test("Motion gallery has no serious a11y violations", async ({ page }) => {
  await page.goto("/motion");
  await page.getByRole("heading", { name: "Pick a template" }).waitFor({ timeout: 20000 });
  await expectClean(page);
});

test("Motion editor has no serious a11y violations", async ({ page }) => {
  await page.goto("/motion?t=kinetic-headline");
  await page.locator("canvas").first().waitFor({ timeout: 20000 });
  await expectClean(page);
});

test("Captions has no serious a11y violations", async ({ page }) => {
  await page.goto("/captions");
  // Either the dropzone or the capability floor — both are real states of this
  // route and both must be accessible.
  await page.getByRole("heading", { name: /Drop your video|can't run Captions/ }).waitFor({ timeout: 20000 });
  await expectClean(page);
});

for (const [path, heading] of [
  ["/privacy", "Privacy Policy"],
  ["/terms", "Terms of Use"],
  ["/whats-new", "What's new"],
  ["/help", "Getting started & troubleshooting"],
  ["/projects", "Projects"],
  ["/brand", "Brand kit"],
] as const) {
  test(`${path} has no serious a11y violations`, async ({ page }) => {
    await page.goto(path);
    await page.getByRole("heading", { name: heading, level: 1 }).waitFor({ timeout: 20000 });
    await expectClean(page);
  });
}
