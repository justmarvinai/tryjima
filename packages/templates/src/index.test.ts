import { describe, it, expect } from "vitest";
import { templates, getTemplate } from "./index";
import { TEMPLATE_COUNT, TEMPLATE_DURATIONS } from "./durations";

describe("template registry", () => {
  it("has no duplicate ids", () => {
    const ids = templates.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("resolves every template by id", () => {
    for (const t of templates) {
      expect(getTemplate(t.id)?.id).toBe(t.id);
    }
  });

  it("returns undefined for an unknown id", () => {
    expect(getTemplate("no-such-template")).toBeUndefined();
  });

  /*
   * TEMPLATE_COUNT is what the landing page prints, and it is derived from the
   * duration table so that marketing copy never has to import 2.7 MB of Pixi
   * scenes. That only stays honest if the two lists agree — which is what this
   * test, and the next one, are for.
   */
  it("counts the same number of templates as the duration table", () => {
    expect(TEMPLATE_COUNT).toBe(templates.length);
  });

  it("has a duration entry for every template, and no orphans", () => {
    const registered = new Set(templates.map((t) => t.id));
    const timed = new Set(Object.keys(TEMPLATE_DURATIONS));

    const missing = [...registered].filter((id) => !timed.has(id));
    const orphaned = [...timed].filter((id) => !registered.has(id));

    expect({ missing, orphaned }).toEqual({ missing: [], orphaned: [] });
  });
});
