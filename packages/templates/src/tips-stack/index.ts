import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuint,
  outQuad,
  makeOutBack,
  type Aspect,
  type BuiltTemplate,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
  type Values,
} from "@jima/engine";

const str = (v: unknown, fallback: string): string => (typeof v === "string" && v.length > 0 ? v : fallback);
const asItems = (v: unknown, fallback: string[]): string[] => {
  if (Array.isArray(v)) {
    const arr = v.filter((s): s is string => typeof s === "string" && s.length > 0);
    if (arr.length) return arr;
  }
  return fallback;
};

const DEFAULT_ITEMS = ["Hook them in 3 seconds", "Add captions", "End with a clear CTA"];
const PER_ITEM = 1.0;

const PALETTES: Palette[] = [
  { id: "notebook", name: "Notebook", colors: { background: "#FFFFFF", textColor: "#101014", accent: "#FF4D1C" } },
  { id: "citrus", name: "Citrus", colors: { background: "#FFF8E6", textColor: "#2A2410", accent: "#F59E0B" } },
  { id: "slate", name: "Slate", colors: { background: "#EEF1F5", textColor: "#0F1B2A", accent: "#2E5BD6" } },
  { id: "bubblegum", name: "Bubblegum", colors: { background: "#FFEEF6", textColor: "#3A0A28", accent: "#FF2E9E" } },
];

function computeDuration(values: Values): number {
  const items = asItems(values.items, DEFAULT_ITEMS);
  return Math.max(4, Math.min(10, 1.0 + items.length * PER_ITEM + 1.4));
}

function fontFrac(aspect: Aspect): number {
  return aspect === "16:9" ? 0.05 : aspect === "9:16" ? 0.062 : 0.056;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string) => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const title = str(values.title, "3 rules for better posts");
  const marker = str(values.marker, "check");
  const items = asItems(values.items, DEFAULT_ITEMS).slice(0, 5);
  const showAccentBar = values.accentBar !== false;

  root.addChild(new Graphics().rect(0, 0, size.width, size.height).fill(bg));

  const timeline = new JimaTimeline();
  const fontSize = Math.round(size.width * fontFrac(ctx.aspect));
  const marginX = size.width * 0.1;
  const titleSize = Math.round(fontSize * 1.25);

  // Title + underline.
  const titleText = makeText(fonts, { text: title, role: "display", weight: 700, size: titleSize, color: textColor, anchor: { x: 0, y: 0 } });
  const titleY = size.height * 0.16;
  titleText.position.set(marginX, titleY);
  titleText.alpha = 0;
  root.addChild(titleText);
  timeline
    .to(titleText, { prop: "alpha", from: 0, to: 1, start: 0.0, duration: 0.4, ease: outQuad })
    .to(titleText, { prop: "x", from: marginX - 20, to: marginX, start: 0.0, duration: 0.5, ease: outQuint });

  if (showAccentBar) {
    const ruleW = titleSize * 2.4;
    const rule = new Graphics().roundRect(0, 0, ruleW, Math.max(3, titleSize * 0.09), 3).fill(accent);
    rule.position.set(marginX, titleY + titleSize * 1.3);
    rule.scale.set(0, 1);
    root.addChild(rule);
    timeline.to(rule, { prop: "scale.x", from: 0, to: 1, start: 0.3, duration: 0.4, ease: outQuint });
  }

  // Rows.
  const rowH = (size.height * 0.58) / Math.max(items.length, 1);
  const rowTop = size.height * 0.34 + rowH / 2;
  const chipR = fontSize * 0.6;

  items.forEach((item, i) => {
    const rowY = rowTop + i * rowH;
    const row = new Container();
    row.position.set(marginX, rowY);
    row.alpha = 0;
    root.addChild(row);

    // Marker chip.
    const chip = new Container();
    chip.position.set(chipR, 0);
    chip.addChild(new Graphics().circle(0, 0, chipR).fill(accent));
    if (marker === "number") {
      chip.addChild(makeText(fonts, { text: String(i + 1), role: "display", weight: 700, size: Math.round(chipR * 1.05), color: "#FFFFFF", anchor: 0.5 }));
    } else if (marker === "arrow") {
      chip.addChild(makeText(fonts, { text: "→", role: "body", weight: 600, size: Math.round(chipR * 1.15), color: "#FFFFFF", anchor: 0.5 }));
    } else {
      const check = new Graphics().poly([-chipR * 0.4, 0, -chipR * 0.1, chipR * 0.35, chipR * 0.45, -chipR * 0.35], false).stroke({ color: "#FFFFFF", width: Math.max(2, chipR * 0.18), cap: "round", join: "round" });
      chip.addChild(check);
    }
    chip.scale.set(0);
    row.addChild(chip);

    const label = makeText(fonts, { text: item, role: "body", weight: 500, size: fontSize, color: textColor, anchor: { x: 0, y: 0.5 } });
    label.position.set(chipR * 2.4, 0);
    row.addChild(label);

    const start = 1.0 + i * PER_ITEM;
    timeline
      .to(row, { prop: "alpha", from: 0, to: 1, start, duration: 0.4, ease: outQuad })
      .to(row, { prop: "x", from: marginX + 28, to: marginX, start, duration: 0.5, ease: outQuint })
      .to(chip, { prop: "scale.x", from: 0, to: 1, start: start + 0.1, duration: 0.4, ease: makeOutBack(2) })
      .to(chip, { prop: "scale.y", from: 0, to: 1, start: start + 0.1, duration: 0.4, ease: makeOutBack(2) });
  });

  return { timeline, duration: computeDuration(values) };
}

export const tipsStack: TemplateDefinition = {
  id: "tips-stack",
  name: "Tips Stack",
  tagline: "A checklist that builds one item at a time.",
  category: "educational",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "4:5",
  loopable: false,
  posterTime: 3.6,
  estimateDuration: computeDuration,
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Title", default: "3 rules for better posts", maxLength: 48 },
    { key: "items", type: "textlist", label: "Items", default: DEFAULT_ITEMS, minItems: 2, maxItems: 5, maxLength: 60 },
    { key: "marker", type: "select", label: "Marker", default: "check", options: [{ value: "check", label: "Check" }, { value: "number", label: "Number" }, { value: "arrow", label: "Arrow" }] },
    { key: "accentBar", type: "toggle", label: "Accent bar", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
