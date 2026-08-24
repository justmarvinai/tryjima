import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outExpo,
  outQuad,
  spring,
  type Aspect,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
  type Values,
} from "@jima/engine";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const asItems = (v: unknown, fallback: string[]): string[] => {
  if (Array.isArray(v)) {
    const arr = v.filter((s): s is string => typeof s === "string" && s.length > 0);
    if (arr.length) return arr;
  }
  return fallback;
};

function fitSize(
  fonts: FontRegistry,
  text: string,
  role: FontRole,
  weight: number,
  size: number,
  maxWidth: number,
): number {
  const w = fonts.measure(text, { family: fonts.family(role), weight, size });
  return w > maxWidth ? Math.max(9, Math.floor((size * maxWidth) / w)) : size;
}

const PALETTES: Palette[] = [
  { id: "ink", name: "Ink", colors: { background: "#FFFFFF", textColor: "#101014", accent: "#FF4D1C" } },
  { id: "cobalt", name: "Cobalt", colors: { background: "#EEF3FF", textColor: "#0B1F4D", accent: "#2E7DF6" } },
  { id: "mint", name: "Mint", colors: { background: "#ECFDF3", textColor: "#0B3B26", accent: "#17A34A" } },
  { id: "midnight", name: "Midnight", colors: { background: "#101014", textColor: "#FFFFFF", accent: "#D8F34D" } },
];

const DEFAULT_NAMES = ["Northwind", "Acme", "Globex", "Umbrella", "Initech", "Hooli"];

function names(values: Values): string[] {
  return asItems(values.names, DEFAULT_NAMES).slice(0, 8);
}

function computeDuration(values: Values): number {
  return 0.8 + names(values).length * 0.18 + 1.4;
}

/** Columns per aspect (rows derived from count). Grid ~3×2 / 4×2. */
function colsFor(aspect: Aspect, n: number): number {
  const wide = aspect === "16:9";
  const tall = aspect === "9:16" || aspect === "4:5";
  const max = wide ? 4 : tall ? 2 : 3;
  return Math.min(max, n);
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const aspect = ctx.aspect;
  const list = names(values);
  const n = list.length;

  root.addChild(new Graphics().rect(0, 0, w, h).fill(bg));
  const timeline = new JimaTimeline();

  const topSafe = aspect === "9:16" ? 220 : Math.round(minDim * 0.06);
  const botSafe = aspect === "9:16" ? 400 : Math.round(minDim * 0.06);
  const cx = w / 2;

  // --- Heading ---
  const headingRaw = str(values.heading, "Trusted by teams at");
  const headSize = fitSize(fonts, headingRaw, "display", 700, Math.round(minDim * 0.05), w * 0.86);
  const headY = topSafe + headSize * 0.9;
  const heading = makeText(fonts, { text: headingRaw, role: "display", weight: 700, size: headSize, color: textColor, anchor: 0.5, align: "center" });
  heading.position.set(cx, headY);
  heading.alpha = 0;
  root.addChild(heading);
  timeline
    .to(heading, { prop: "alpha", from: 0, to: 1, start: 0, duration: 0.4, ease: outQuad })
    .to(heading, { prop: "y", from: headY - 14, to: headY, start: 0, duration: 0.5, ease: outExpo });

  const showAccentBar = values.accentBar !== false;
  if (showAccentBar) {
    const ruleW = headSize * 2.2;
    const rule = new Graphics().roundRect(-ruleW / 2, -1.5, ruleW, Math.max(3, headSize * 0.08), 2).fill(accent);
    rule.position.set(cx, headY + headSize * 0.9);
    rule.scale.set(0, 1);
    root.addChild(rule);
    timeline.to(rule, { prop: "scale.x", from: 0, to: 1, start: 0.25, duration: 0.4, ease: outExpo });
  }

  // --- Chip grid ---
  const cols = colsFor(aspect, n);
  const rows = Math.ceil(n / cols);
  const gridTop = headY + headSize * 1.6;
  const gridBottom = h - botSafe;
  const gridH = gridBottom - gridTop;
  const availW = w * 0.88;
  const cellW = availW / cols;
  const cellH = gridH / rows;

  const chipH = Math.min(cellH * 0.62, minDim * 0.13);
  const chipR = chipH / 2;
  const labelSize0 = Math.round(chipH * 0.42);
  const padX = chipH * 0.55;

  const START0 = 0.8;
  const STAG = 0.18;

  list.forEach((name, i) => {
    const r = Math.floor(i / cols);
    const c = i % cols;
    // Center the last (possibly short) row.
    const inRow = Math.min(cols, n - r * cols);
    const rowOriginX = cx - (cellW * inRow) / 2;
    const cellCX = rowOriginX + cellW * (c + 0.5);
    const cellCY = gridTop + cellH * (r + 0.5);

    const accented = i < Math.min(2, n - 1);
    const dotR = accented ? chipH * 0.15 : 0;
    const dotReserve = accented ? dotR * 2 + chipH * 0.22 : 0;

    const chip = new Container();
    chip.position.set(cellCX, cellCY);
    chip.alpha = 0;
    chip.scale.set(0.8);
    root.addChild(chip);

    const maxTextW = cellW * 0.92 - padX * 2 - dotReserve;
    const labelSize = fitSize(fonts, name, "display", 700, labelSize0, maxTextW);
    const label = makeText(fonts, { text: name, role: "display", weight: 700, size: labelSize, color: textColor, anchor: 0.5 });
    const chipW = Math.min(cellW * 0.94, label.width + padX * 2 + dotReserve);

    const card = new Graphics().roundRect(-chipW / 2, -chipH / 2, chipW, chipH, chipR).fill({ color: textColor, alpha: 0.05 });
    if (accented) {
      card.roundRect(-chipW / 2, -chipH / 2, chipW, chipH, chipR).stroke({ color: accent, width: Math.max(2, chipH * 0.05), alpha: 0.9 });
    } else {
      card.roundRect(-chipW / 2, -chipH / 2, chipW, chipH, chipR).stroke({ color: textColor, width: Math.max(1, chipH * 0.03), alpha: 0.14 });
    }
    chip.addChild(card);

    if (accented) {
      const dotX = -chipW / 2 + padX * 0.75 + dotR;
      const dot = new Graphics().circle(0, 0, dotR).fill(accent);
      dot.position.set(dotX, 0);
      chip.addChild(dot);
      // Center the label in the space to the right of the dot.
      const textLeft = dotX + dotR + chipH * 0.14;
      const textRight = chipW / 2 - padX * 0.75;
      label.position.set((textLeft + textRight) / 2, 0);
    } else {
      label.position.set(0, 0);
    }
    chip.addChild(label);

    const start = START0 + i * STAG;
    timeline
      .to(chip, { prop: "alpha", from: 0, to: 1, start, duration: 0.35, ease: outQuad })
      .to(chip, { prop: "scale.x", from: 0.8, to: 1, start, duration: 0.6, ease: spring(0.5) })
      .to(chip, { prop: "scale.y", from: 0.8, to: 1, start, duration: 0.6, ease: spring(0.5) });
  });

  return { timeline, duration: computeDuration(values) };
}

export const logoWall: TemplateDefinition = {
  id: "logo-wall",
  name: "Logo Wall",
  tagline: "A social-proof wall of client name chips pops in.",
  category: "brand",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 2.8,
  estimateDuration: computeDuration,
  palettes: PALETTES,
  fields: [
    { key: "heading", type: "text", label: "Heading", default: "Trusted by teams at", maxLength: 40, shrinkToFit: true },
    { key: "names", type: "textlist", label: "Client names", default: DEFAULT_NAMES, minItems: 3, maxItems: 8, maxLength: 18 },
    { key: "accentBar", type: "toggle", label: "Accent bar", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
