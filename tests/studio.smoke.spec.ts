import { test, expect, type Page } from "@playwright/test";

// Phase 3 Studio integration: the whole no-account loop through the real UI —
// gallery → edit → export → and survive a reload. Runs against the SPA served
// by the Vite dev server. (The suite runs single-worker — see playwright.config
// — so these WebGL-heavy flows never contend with each other.)

test.use({ viewport: { width: 1300, height: 850 } });

async function openEditor(page: Page) {
  await page.goto("/studio");
  await page.getByRole("heading", { name: "Pick a template" }).waitFor({ timeout: 30000 });
  await page.getByRole("button", { name: "Open Kinetic Headline" }).click();
  await page.locator("canvas").first().waitFor({ timeout: 30000 });
}

test("gallery → editor → live edit", async ({ page }) => {
  await openEditor(page);
  const headline = page.getByLabel("Headline", { exact: true });
  await expect(headline).toHaveValue("Say it with motion.");
  await headline.fill("Free forever.");
  await expect(headline).toHaveValue("Free forever.");
  // Aspect switch keeps the editor working.
  await page.getByRole("radio", { name: "9:16" }).click();
  await expect(page.locator("canvas").first()).toBeVisible();
});

test("palette preset fills the color fields", async ({ page }) => {
  await openEditor(page);
  await page.getByRole("tab", { name: "Style" }).click();
  await page.getByRole("button", { name: /White on orange/ }).click();
  // Background field should now hold the palette's background color.
  await expect(page.getByLabel("Hex color").first()).toHaveValue(/#FF4D1C/i);
});

test("export produces a downloadable file through the modal", async ({ page }) => {
  await openEditor(page);
  await page.getByRole("button", { name: /Export ▸/ }).click();
  const dialog = page.getByRole("dialog", { name: "Export" });
  await dialog.waitFor();
  // Use the GIF path — fast and always available — to validate the modal
  // configure → rendering → done flow (engine encoders are covered by
  // export.smoke.spec.ts). 480p keeps software rendering quick.
  await page.getByRole("button", { name: /^GIF/ }).click();
  await page.getByRole("button", { name: /^Export GIF/ }).click();
  await expect(page.getByText(/Saved/)).toBeVisible({ timeout: 75000 });
  const download = page.getByRole("link", { name: /Download again/ });
  await expect(download).toBeVisible();
  await expect(download).toHaveAttribute("download", /^jima-kinetic-headline-.*\.gif$/);
});

test("edits survive a reload (autosave + restore)", async ({ page }) => {
  await openEditor(page);
  await page.getByLabel("Headline", { exact: true }).fill("Persisted!");
  await page.waitForTimeout(800); // let autosave (500ms debounce) flush
  await page.reload();
  await page.locator("canvas").first().waitFor({ timeout: 30000 });
  await expect(page.getByLabel("Headline", { exact: true })).toHaveValue("Persisted!");
});

// ─── Library: favourites + filters ────────────────────────────────────────────

async function openGallery(page: Page) {
  await page.goto("/studio");
  await page.getByRole("heading", { name: "Pick a template" }).waitFor({ timeout: 30000 });
}

/** Every facet chip as `{label, count, disabled}`, read off the live DOM. */
async function chips(page: Page) {
  return page.evaluate(() => {
    const row = document.querySelector('[role="group"][aria-label^="Filter by length"]');
    return [...(row?.querySelectorAll("button[aria-pressed]") ?? [])].map((b) => {
      // The count is the trailing span, not a suffix of the text — "Square / 4:5"
      // ends in a digit, and parsing that out of textContent gets it wrong.
      const count = b.lastElementChild?.textContent ?? "";
      return {
        label: (b.textContent ?? "").slice(0, -count.length).replace(/^[★☆]/, "").trim(),
        count: Number(count),
        disabled: (b as HTMLButtonElement).disabled,
        pressed: b.getAttribute("aria-pressed") === "true",
      };
    });
  });
}

const cards = (page: Page) => page.locator('button[aria-label^="Favourite"]');

test("every filter is worth showing — none of them is the whole library or none of it", async ({ page }) => {
  await openGallery(page);
  const all = await cards(page).count();
  expect(all).toBeGreaterThan(400);

  for (const c of await chips(page)) {
    if (c.label === "Favourites") {
      expect(c.count, "a fresh browser has no favourites").toBe(0);
      expect(c.disabled, "and the chip is inert rather than a dead end").toBe(true);
      continue;
    }
    // A filter matching 2% or 95% of 445 templates isn't a filter, it's noise.
    expect(c.count / all, `${c.label} matches ${c.count} of ${all}`).toBeGreaterThan(0.03);
    expect(c.count / all, `${c.label} matches ${c.count} of ${all}`).toBeLessThan(0.6);
  }
});

test("filters intersect, and each chip's count is what pressing it gives you", async ({ page }) => {
  await openGallery(page);
  const before = await chips(page);
  const vertical = before.find((c) => c.label === "Vertical")!;
  const photoBefore = before.find((c) => c.label === "Takes a photo")!;

  await page.getByRole("button", { name: /^Vertical/ }).click();
  await expect(page.getByText(`${vertical.count} results`).first()).toBeVisible();

  const after = await chips(page);
  const photoAfter = after.find((c) => c.label === "Takes a photo")!;
  // Narrower, because the counts respect the other active filter...
  expect(photoAfter.count).toBeLessThan(photoBefore.count);
  // ...and pressing it really does land on that number.
  await page.getByRole("button", { name: /^Takes a photo/ }).click();
  await expect(page.getByText(`${photoAfter.count} results`).first()).toBeVisible();

  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page.getByText(`${(await cards(page).count())} results`).first()).toBeVisible();
});

test("a starred template survives a reload and is findable again", async ({ page }) => {
  await openGallery(page);
  const first = cards(page).first();
  const name = (await first.getAttribute("aria-label"))!.replace("Favourite ", "");
  await expect(first).toHaveAttribute("aria-pressed", "false");
  await first.click();
  await expect(first).toHaveAttribute("aria-pressed", "true");

  // Nothing left the browser — it's in localStorage, like every other preference.
  expect(await page.evaluate(() => localStorage.getItem("jima.favourites"))).toContain('"');

  await page.reload();
  await page.getByRole("heading", { name: "Pick a template" }).waitFor({ timeout: 30000 });
  await page.getByRole("button", { name: /^Favourites/ }).click();
  await expect(cards(page)).toHaveCount(1);
  await expect(cards(page).first()).toHaveAttribute("aria-label", `Favourite ${name}`);

  // Un-starring from inside the favourites view empties it, and says so.
  await cards(page).first().click();
  await expect(page.getByText(/haven’t starred anything yet/)).toBeVisible();
});
