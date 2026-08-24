import { describe, it, expect } from "vitest";
import type { TemplateDefinition } from "@jima/engine";
import { TEMPLATE_DURATIONS } from "@jima/templates/durations";
import { FACETS, facetCounts, matchesAll, matchesFacet, type FacetId } from "./facets";

// The facets are derived from the definition rather than from tags, so what's
// worth testing is the derivation: a template's shape decides its filters, and
// combining filters intersects rather than unions.

type Def = TemplateDefinition;

const def = (over: Partial<Def> = {}): Def =>
  ({
    id: "t",
    name: "T",
    tagline: "",
    category: "statement",
    defaultAspect: "16:9",
    palettes: [],
    fields: [],
    ...over,
  }) as unknown as Def;

const field = (over: Record<string, unknown>) =>
  ({ key: "k", type: "text", label: "", default: "", ...over }) as unknown as Def["fields"][number];

// Real ids from the shipped duration table, so the length tests exercise the
// same lookup the gallery does rather than a stub of it.
const idOfLength = (pick: (d: number) => boolean): string => {
  const hit = Object.entries(TEMPLATE_DURATIONS).find(([, d]) => pick(d));
  if (!hit) throw new Error("no template of that length in the library");
  return hit[0];
};

describe("facet classification", () => {
  it("reads length off the shipped duration table", () => {
    const short = idOfLength((d) => d < 4);
    const long = idOfLength((d) => d > 4.5);
    expect(matchesFacet(def({ id: short }), "short", [])).toBe(true);
    expect(matchesFacet(def({ id: short }), "long", [])).toBe(false);
    expect(matchesFacet(def({ id: long }), "long", [])).toBe(true);
    expect(matchesFacet(def({ id: long }), "short", [])).toBe(false);
  });

  it("puts a template with no figure in neither bucket, rather than guessing", () => {
    // Better to under-report than to file a template under a length it doesn't
    // have — and the golden suite makes this case impossible in practice.
    expect(matchesFacet(def({ id: "not-a-template" }), "short", [])).toBe(false);
    expect(matchesFacet(def({ id: "not-a-template" }), "long", [])).toBe(false);
  });

  it("leaves both length buckets usefully populated", () => {
    const all = Object.values(TEMPLATE_DURATIONS);
    const short = all.filter((d) => d < 4).length;
    const long = all.filter((d) => d > 4.5).length;
    // A filter that returns 3 of 495, or 490 of 495, isn't a filter.
    for (const [n, name] of [
      [short, "short"],
      [long, "long"],
    ] as const) {
      expect(n / all.length, name).toBeGreaterThan(0.05);
      expect(n / all.length, name).toBeLessThan(0.6);
    }
  });

  it("buckets aspect into the three shapes people actually post in", () => {
    expect(matchesFacet(def({ defaultAspect: "9:16" }), "vertical", [])).toBe(true);
    expect(matchesFacet(def({ defaultAspect: "1:1" }), "square", [])).toBe(true);
    expect(matchesFacet(def({ defaultAspect: "4:5" }), "square", [])).toBe(true);
    expect(matchesFacet(def({ defaultAspect: "16:9" }), "wide", [])).toBe(true);
    expect(matchesFacet(def({ defaultAspect: "16:9" }), "vertical", [])).toBe(false);
  });

  it("finds an image slot by field type, not by name", () => {
    expect(matchesFacet(def({ fields: [field({ key: "photo", type: "image" })] }), "image", [])).toBe(true);
    // A colour field called "image" is not a photo slot.
    expect(matchesFacet(def({ fields: [field({ key: "image", type: "color" })] }), "image", [])).toBe(false);
  });

  it("spots a list slot, which is what people search for when they have five points", () => {
    expect(matchesFacet(def({ fields: [field({ key: "steps", type: "textlist" })] }), "list", [])).toBe(true);
    // A single line of text is not a list, however it is named.
    expect(matchesFacet(def({ fields: [field({ key: "items", type: "text" })] }), "list", [])).toBe(false);
  });

  it("calls a template alpha-safe only when it is built to sit over footage", () => {
    const bg = field({ key: "background", type: "color" });
    expect(matchesFacet(def({ category: "overlay", fields: [bg] }), "overlay", [])).toBe(true);
    expect(matchesFacet(def({ category: "intro", fields: [bg] }), "overlay", [])).toBe(true);
    // Right category, but no background to blank.
    expect(matchesFacet(def({ category: "overlay", fields: [] }), "overlay", [])).toBe(false);
    // Full-bleed categories are not overlays however they are exported.
    expect(matchesFacet(def({ category: "product", fields: [bg] }), "overlay", [])).toBe(false);
  });

  it("reserves 'lots to tweak' for templates that really do have a lot", () => {
    const nine = Array.from({ length: 9 }, (_, i) => field({ key: `f${i}` }));
    expect(matchesFacet(def({ fields: nine }), "editable", [])).toBe(true);
    expect(matchesFacet(def({ fields: nine.slice(1) }), "editable", [])).toBe(false);
  });

  it("takes favourites from the caller — the definition can't know them", () => {
    expect(matchesFacet(def({ id: "a" }), "favourites", ["a"])).toBe(true);
    expect(matchesFacet(def({ id: "a" }), "favourites", ["b"])).toBe(false);
  });
});

describe("combining facets", () => {
  const shortId = idOfLength((d) => d < 4);
  const longId = idOfLength((d) => d > 4.5);
  const library: Def[] = [
    def({ id: shortId, defaultAspect: "9:16" }),
    def({ id: longId, defaultAspect: "9:16" }),
    def({ id: `${shortId}-wide`, defaultAspect: "16:9" }),
  ];

  it("intersects — two filters narrow, they don't widen", () => {
    const pass = library.filter((t) => matchesAll(t, ["vertical", "short"], []));
    expect(pass.map((t) => t.id)).toEqual([shortId]);
  });

  it("passes everything when nothing is selected", () => {
    expect(library.every((t) => matchesAll(t, [], []))).toBe(true);
  });

  it("counts a chip against the *other* filters, so it previews the result", () => {
    // With "vertical" already on, "short" must count only the vertical short
    // one — the number has to be what you'd get if you pressed it.
    const counts = facetCounts(library, ["vertical"], []);
    expect(counts.get("short")).toBe(1);
    // And "vertical" itself still reports its own unfiltered total, so turning
    // it off is as legible as turning it on.
    expect(counts.get("vertical")).toBe(2);
  });

  it("reports zero for a filter that would empty the grid", () => {
    const counts = facetCounts(library, ["wide"], []);
    expect(counts.get("long")).toBe(0);
  });
});

describe("the facet list itself", () => {
  it("has no duplicate ids and no unlabelled chips", () => {
    const ids = FACETS.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const f of FACETS) {
      expect(f.label.length, f.id).toBeGreaterThan(0);
      expect(f.hint.length, f.id).toBeGreaterThan(0);
    }
  });

  it("keeps each group contiguous, so the dividers land between groups", () => {
    const seen = new Set<string>();
    let last = "";
    for (const f of FACETS) {
      if (f.group !== last) {
        expect(seen.has(f.group), `${f.group} is split into two runs`).toBe(false);
        seen.add(f.group);
        last = f.group;
      }
    }
  });

  it("classifies every id — a new facet can't be silently unhandled", () => {
    for (const f of FACETS) {
      expect(typeof matchesFacet(def(), f.id as FacetId, []), f.id).toBe("boolean");
    }
  });
});
