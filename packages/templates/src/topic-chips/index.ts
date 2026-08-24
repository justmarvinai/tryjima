import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  makeOutBack,
  shrinkToFit,
  safeZone,
  TRANSPARENT_BG,
  type BuiltTemplate,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;

const DEFAULT_TAGS = ["Highlights", "Recap", "Behind the Scenes"];
const asItems = (v: unknown, fallback: string[]): string[] => {
  if (Array.isArray(v)) {
    const arr = v.filter((s): s is string => typeof s === "string" && s.trim().length > 0);
    if (arr.length >= 2) return arr;
  }
  return fallback;
};
/** Strip any leading "#" the user may have typed — the hash is re-added (or not) by `showHash`. */
const stripHash = (s: string): string => s.trim().replace(/^#+/, "").trim();

interface ChipBox {
  text: string;
  width: number;
  cx: number;
  cy: number;
}

/** Greedy-wrap fixed-width chips into centered rows, itself centered as a block. */
function packRow(items: { text: string; width: number }[], maxWidth: number, gapX: number, rowH: number): ChipBox[] {
  const lines: { items: { text: string; width: number }[]; width: number }[] = [];
  let current: { text: string; width: number }[] = [];
  let currentWidth = 0;
  for (const it of items) {
    const add = current.length === 0 ? it.width : currentWidth + gapX + it.width;
    if (add <= maxWidth || current.length === 0) {
      current.push(it);
      currentWidth = add;
    } else {
      lines.push({ items: current, width: currentWidth });
      current = [it];
      currentWidth = it.width;
    }
  }
  if (current.length) lines.push({ items: current, width: currentWidth });

  const totalH = lines.length * rowH;
  const top = -totalH / 2;
  const boxes: ChipBox[] = [];
  lines.forEach((line, li) => {
    const lineY = top + li * rowH + rowH / 2;
    let cursor = -line.width / 2;
    for (const it of line.items) {
      boxes.push({ text: it.text, width: it.width, cx: cursor + it.width / 2, cy: lineY });
      cursor += it.width + gapX;
    }
  });
  return boxes;
}

// A row of topic/hashtag chips (from a textlist) pops in, staggered, along a
// lower band — on-screen tags for a clip. Only the full-frame `bg` rect is
// tied to the background field (defaults to the transparent sentinel so it
// composites straight onto footage); each chip is its own palette-only
// `chipBg` surface with an accent-colored border, so the row stays legible
// once the canvas fill is gone — regardless of which accent a user picks.
const PALETTES: Palette[] = [
  { id: "onyx-tags", name: "Onyx tags", colors: { chipBg: "#17171C", textColor: "#FFFFFF", accent: "#FF4D1C" } },
  { id: "paper-tags", name: "Paper tags", colors: { chipBg: "#FFFFFF", textColor: "#101014", accent: "#2E5BD6" } },
  { id: "mint-tags", name: "Mint tags", colors: { chipBg: "#FFFFFF", textColor: "#08221A", accent: "#17A34A" } },
  { id: "grape-tags", name: "Grape tags", colors: { chipBg: "#241443", textColor: "#FFFFFF", accent: "#FF7CD1" } },
];

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", TRANSPARENT_BG));
  const chipBg = pc("chipBg", "#17171C");
  const textColor = str(values.textColor, pc("textColor", "#FFFFFF"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const showHash = values.showHash !== false;
  const rawTags = asItems(values.tags, DEFAULT_TAGS).slice(0, 6);
  const tags = rawTags.map(stripHash).map((t) => (showHash ? `#${t}` : t));

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const zone = safeZone(ctx.aspect);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Sizing: shrink uniformly to the worst-case tag so every chip shares
  // one font size, then wrap into centered rows. ---
  const family = fonts.family("body");
  const measure = (s: string, sz: number): number => fonts.measure(s, { family, weight: 700, size: sz });

  const maxRowW = Math.min(w - zone.left - zone.right, minDim * 0.94);
  const baseFont = Math.round(minDim * 0.034);
  const padX = Math.round(baseFont * 0.85);
  let chipFont = baseFont;
  for (const tag of tags) {
    const maxChipTextW = maxRowW - padX * 2;
    const fit = shrinkToFit(tag, measure, { maxWidth: maxChipTextW, baseSize: chipFont, minSize: Math.round(baseFont * 0.55) });
    chipFont = Math.min(chipFont, fit);
  }
  const padY = Math.round(chipFont * 0.56);
  const chipH = chipFont + padY * 2;
  const gapX = Math.round(chipFont * 0.5);
  const rowGap = Math.round(chipFont * 0.42);
  const rowH = chipH + rowGap;
  const strokeW = Math.max(1.5, chipFont * 0.06);

  const items = tags.map((text) => ({ text, width: measure(text, chipFont) + padX * 2 }));
  const boxes = packRow(items, maxRowW, gapX, rowH);
  const blockH = boxes.length ? Math.max(...boxes.map((b) => b.cy)) - Math.min(...boxes.map((b) => b.cy)) + chipH : chipH;

  const marginBottom = Math.round(minDim * 0.032);
  const cx = w / 2;
  const bandBottomY = h - zone.bottom - marginBottom;
  const bandCenterY = bandBottomY - blockH / 2;

  boxes.forEach((box, i) => {
    const chip = new Container();
    chip.addChild(new Graphics().roundRect(-box.width / 2, -chipH / 2, box.width, chipH, chipH / 2).fill(chipBg));
    chip.addChild(
      new Graphics()
        .roundRect(-box.width / 2, -chipH / 2, box.width, chipH, chipH / 2)
        .stroke({ color: accent, width: strokeW, alpha: 0.9 }),
    );
    chip.addChild(makeText(fonts, { text: box.text, role: "body", weight: 700, size: chipFont, color: textColor, anchor: 0.5 }));
    chip.position.set(cx + box.cx, bandCenterY + box.cy);
    chip.scale.set(0);
    chip.alpha = 0;
    root.addChild(chip);

    const start = 0.15 + i * 0.12;
    timeline
      .to(chip, { prop: "alpha", from: 0, to: 1, start, duration: 0.22, ease: outQuad })
      .to(chip, { prop: "scale.x", from: 0, to: 1, start, duration: 0.5, ease: makeOutBack(1.8) })
      .to(chip, { prop: "scale.y", from: 0, to: 1, start, duration: 0.5, ease: makeOutBack(1.8) });
  });

  return { timeline, duration: 3.8 };
}

export const topicChips: TemplateDefinition = {
  id: "topic-chips",
  name: "Topic Chips",
  tagline: "A row of on-screen topic tags pops in along a lower band.",
  category: "overlay",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 2.7,
  fontRoles: { tags: "body" },
  palettes: PALETTES,
  fields: [
    { key: "tags", type: "textlist", label: "Topics", default: DEFAULT_TAGS, minItems: 2, maxItems: 6, maxLength: 22 },
    { key: "showHash", type: "toggle", label: "Leading #", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
