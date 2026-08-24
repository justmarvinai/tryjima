import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// WCAG 2.1 A/AA automated pass over the key surfaces. Canvas/WebGL regions are
// exercised elsewhere; here we check the DOM chrome (contrast, labels, roles).
async function analyze(page: Page) {
  return new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
}

test("landing has no serious a11y violations", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("heading", { name: /Motion graphics for social media/ }).waitFor({ timeout: 20000 });
  await page.getByRole("heading", { name: "Templates for every post" }).waitFor({ timeout: 20000 }).catch(() => {});
  const results = await analyze(page);
  const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious, JSON.stringify(serious.map((v) => ({ id: v.id, nodes: v.nodes.length })), null, 2)).toEqual([]);
});

test("studio gallery has no serious a11y violations", async ({ page }) => {
  await page.goto("/studio");
  await page.getByRole("heading", { name: "Pick a template" }).waitFor({ timeout: 20000 });
  const results = await analyze(page);
  const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious, JSON.stringify(serious.map((v) => ({ id: v.id, nodes: v.nodes.length })), null, 2)).toEqual([]);
});

test("studio editor has no serious a11y violations", async ({ page }) => {
  await page.goto("/studio?t=kinetic-headline");
  await page.locator("canvas").first().waitFor({ timeout: 20000 });
  const results = await analyze(page);
  const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious, JSON.stringify(serious.map((v) => ({ id: v.id, nodes: v.nodes.length })), null, 2)).toEqual([]);
});

for (const [path, heading] of [
  ["/privacy", "Privacy Policy"],
  ["/terms", "Terms of Service"],
] as const) {
  test(`${path} has no serious a11y violations`, async ({ page }) => {
    await page.goto(path);
    await page.getByRole("heading", { name: heading }).waitFor({ timeout: 20000 });
    const results = await analyze(page);
    const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(serious, JSON.stringify(serious.map((v) => ({ id: v.id, nodes: v.nodes.length })), null, 2)).toEqual([]);
  });
}
