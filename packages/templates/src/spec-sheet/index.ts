import { Container, Graphics, Sprite, type Texture } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outQuint,
  outExpo,
  makeOutBack,
  spring,
  type Aspect,
  type BuiltTemplate,
  type FontRole,
  type MakeTextOptions,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
  type Values,
} from "@jima/engine";
import { makeIcon, type IconName } from "../shared/icons";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const asItems = (v: unknown, fallback: string[]): string[] => {
  if (Array.isArray(v)) {
    const arr = v.filter((s): s is string => typeof s === "string" && s.length > 0);
    if (arr.length) return arr;
  }
  return fallback;
};

const DEFAULT_SPECS = ["Battery | 20 hrs", "Weight | 145 g", "Rating | IPX4", "Storage | 128 GB", "Warranty | 1 year"];
// Bullet-style icons cycle in a fixed, deterministic order — a clean stand-in
// since the icon set has no literal battery/scale/warranty glyphs.
const ICON_CYCLE: IconName[] = ["bolt", "check", "star", "plus", "folder"];

const PALETTES: Palette[] = [
  { id: "studio-white", name: "Studio white", colors: { background: "#F4F2EC", cardColor: "#FFFFFF", accent: "#FF4D1C", textColor: "#14140F", muted: "#6B6B60", divider: "#E4E1D8" } },
  { id: "cool-blue", name: "Cool blue", colors: { background: "#E9F1FC", cardColor: "#FFFFFF", accent: "#1E6FE0", textColor: "#0B1A2E", muted: "#5A6A82", divider: "#D6E2F1" } },
  { id: "slate-lime", name: "Slate lime", colors: { background: "#14171C", cardColor: "#20242C", accent: "#C7F24A", textColor: "#FFFFFF", muted: "#98A0AD", divider: "#333A44" } },
  { id: "violet-cream", name: "Violet cream", colors: { background: "#F2EEFB", cardColor: "#FFFFFF", accent: "#6D3BEA", textColor: "#180F2E", muted: "#6A5E85", divider: "#E4DCF5" } },
];

const ROWS_START = 0.95;
const ROW_STAGGER = 0.38;
const ROW_X_DUR = 0.55;
const HOLD = 1.1;

interface ParsedSpec {
  label: string;
  value: string | null;
}

function parseSpec(s: string): ParsedSpec {
  const idx = s.indexOf("|");
  if (idx === -1) return { label: s.trim(), value: null };
  const label = s.slice(0, idx).trim();
  const value = s.slice(idx + 1).trim();
  return { label: label.length ? label : s.trim(), value: value.length ? value : null };
}

function specsList(values: Values): ParsedSpec[] {
  return asItems(values.specs, DEFAULT_SPECS).slice(0, 5).map(parseSpec);
}

function computeDuration(values: Values): number {
  const n = Math.max(2, Math.min(5, specsList(values).length));
  return ROWS_START + (n - 1) * ROW_STAGGER + ROW_X_DUR + HOLD;
}

/** Content band, matching sibling templates' 9:16 platform-UI safe zone handling. */
function band(aspect: Aspect, w: number, h: number): { top: number; bottom: number; left: number; right: number } {
  if (aspect === "9:16") return { top: 230, bottom: h - 410, left: 64, right: w - 64 };
  const m = Math.round(Math.min(w, h) * 0.07);
  return { top: m, bottom: h - m, left: m, right: w - m };
}

/** Largest size ≤ size0 (down to minSize) at which `text` fits `maxWidth` on one line. */
function fitOneLine(
  fonts: TemplateContext["fonts"],
  text: string,
  role: FontRole,
  weight: number,
  size0: number,
  maxWidth: number,
  minSize = 12,
): number {
  const family = fonts.family(role);
  let size = size0;
  while (size > minSize && fonts.measure(text, { family, weight, size }) > maxWidth) size -= 1;
  return size;
}

/** Crisp-fit: re-make one size smaller if it would overflow maxWidth. */
function fitText(fonts: TemplateContext["fonts"], opts: MakeTextOptions, maxWidth: number) {
  const t = makeText(fonts, opts);
  if (maxWidth > 0 && t.width > maxWidth) {
    const shrunk = Math.max(8, Math.floor(opts.size * (maxWidth / t.width)));
    if (shrunk < opts.size) return makeText(fonts, { ...opts, size: shrunk });
  }
  return t;
}

/** A rounded icon chip: a tinted square behind a centered makeIcon glyph. */
function iconChip(icon: IconName, side: number, accent: string, cardColor: string): Container {
  const chip = new Container();
  chip.addChild(new Graphics().roundRect(-side / 2, -side / 2, side, side, side * 0.28).fill({ color: accent, alpha: 0.14 }));
  chip.addChild(makeIcon(icon, side * 0.56, { color: accent, holeColor: cardColor }));
  return chip;
}

/** Hero product frame: cover-fit masked image, or a designed silhouette placeholder. */
function productFrame(w: number, h: number, r: number, tex: Texture | null, cardColor: string, accent: string): Container {
  const c = new Container();
  const shadow = new Graphics().roundRect(-w / 2, -h / 2, w, h, r).fill({ color: 0x000000, alpha: 0.1 });
  shadow.position.set(0, h * 0.03);
  c.addChild(shadow);
  c.addChild(new Graphics().roundRect(-w / 2, -h / 2, w, h, r).fill(cardColor));
  if (tex) {
    const s = new Sprite(tex);
    s.anchor.set(0.5);
    const cover = Math.max(w / tex.width, h / tex.height);
    s.scale.set(cover);
    const mask = new Graphics().roundRect(-w / 2, -h / 2, w, h, r).fill(0xffffff);
    c.addChild(s, mask);
    s.mask = mask;
  } else {
    const minDim = Math.min(w, h);
    c.addChild(new Graphics().circle(0, 0, minDim * 0.36).fill({ color: accent, alpha: 0.12 }));
    c.addChild(new Graphics().circle(0, 0, minDim * 0.25).fill({ color: accent, alpha: 0.2 }));
    const bw = minDim * 0.3;
    const bh = minDim * 0.42;
    c.addChild(new Graphics().roundRect(-bw / 2, -bh / 2, bw, bh, bw * 0.2).fill(accent));
    c.addChild(new Graphics().roundRect(-bw / 2, -bh / 2, bw, bh * 0.34, bw * 0.2).fill({ color: 0xffffff, alpha: 0.2 }));
  }
  return c;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, images } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F4F2EC"));
  const cardColor = pc("cardColor", "#FFFFFF");
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const textColor = str(values.textColor, pc("textColor", "#14140F"));
  const muted = pc("muted", "#6B6B60");
  const dividerColor = pc("divider", "#E4E1D8");

  const name = str(values.name, "Nova X1");
  const specs = specsList(values);
  const showDivider = values.showDivider !== false;

  const W = size.width;
  const H = size.height;
  const tex = images.product ?? null;

  const bgRect = new Graphics().rect(0, 0, W, H).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();
  const horizontal = ctx.aspect === "16:9";
  const b = band(ctx.aspect, W, H);
  const bw = b.right - b.left;
  const bh = b.bottom - b.top;

  let frameW: number;
  let frameH: number;
  let frameCx: number;
  let frameCy: number;
  let colLeft: number;
  let colRight: number;
  let nameX: number;
  let nameAnchorX: number;
  let nameSize0: number;
  let nameMaxW: number;
  let specSize0: number;
  let nameY: number;
  let rowsTop: number;
  let gap1: number;

  if (horizontal) {
    frameW = bw * 0.34;
    frameH = bh * 0.82;
    frameCx = b.left + frameW / 2;
    colLeft = b.left + frameW + bw * 0.11;
    colRight = b.right;
    nameX = colLeft;
    nameAnchorX = 0;
    nameSize0 = Math.round(W * 0.042);
    nameMaxW = colRight - colLeft;
    specSize0 = Math.round(W * 0.024);
    gap1 = bh * 0.05;
    const rowH0 = specSize0 * 2.3;
    const blockH = nameSize0 * 1.35 + gap1 + specs.length * rowH0;
    const blockTop = (b.top + b.bottom) / 2 - blockH / 2;
    nameY = blockTop;
    rowsTop = blockTop + nameSize0 * 1.35 + gap1;
    frameCy = (b.top + b.bottom) / 2;
  } else {
    frameW = Math.min(bw * 0.58, bh * 0.38);
    frameH = frameW;
    frameCx = (b.left + b.right) / 2;
    colLeft = b.left + bw * 0.02;
    colRight = b.right - bw * 0.02;
    nameX = frameCx;
    nameAnchorX = 0.5;
    nameSize0 = Math.round(W * 0.058);
    nameMaxW = bw * 0.92;
    specSize0 = Math.round(W * 0.036);
    gap1 = bh * 0.05;
    const gap2 = bh * 0.045;
    const rowH0 = specSize0 * 2.3;
    const totalH = frameH + gap1 + nameSize0 * 1.35 + gap2 + specs.length * rowH0;
    const startY = b.top + Math.max(0, (bh - totalH) / 2);
    frameCy = startY + frameH / 2;
    nameY = startY + frameH + gap1;
    rowsTop = nameY + nameSize0 * 1.35 + gap2;
  }

  const colW = colRight - colLeft;
  const iconSide = specSize0 * 1.7;
  let specSize = specSize0;
  for (const s of specs) {
    if (s.value !== null) {
      specSize = Math.min(specSize, fitOneLine(fonts, s.label, "body", 500, specSize0, colW * 0.42));
      specSize = Math.min(specSize, fitOneLine(fonts, s.value, "display", 700, specSize0, colW * 0.32));
    } else {
      specSize = Math.min(specSize, fitOneLine(fonts, s.label, "body", 600, specSize0, colW - iconSide - specSize0 * 0.6));
    }
  }
  const rowH = specSize0 * 2.3;

  // --- Hero product frame ---
  const frame = productFrame(frameW, frameH, Math.min(frameW, frameH) * 0.08, tex, cardColor, accent);
  frame.position.set(frameCx, frameCy);
  frame.scale.set(0.9);
  frame.alpha = 0;
  root.addChild(frame);
  timeline
    .to(frame, { prop: "alpha", from: 0, to: 1, start: 0.1, duration: 0.4, ease: outQuad })
    .to(frame, { prop: "scale.x", from: 0.9, to: 1, start: 0.1, duration: 0.7, ease: spring(0.55) })
    .to(frame, { prop: "scale.y", from: 0.9, to: 1, start: 0.1, duration: 0.7, ease: spring(0.55) });

  // --- Product name ---
  const nameText = fitText(
    fonts,
    { text: name, role: "display", weight: 700, size: nameSize0, color: textColor, anchor: { x: nameAnchorX, y: 0 }, align: nameAnchorX === 0 ? "left" : "center" },
    nameMaxW,
  );
  nameText.position.set(nameX, nameY);
  nameText.alpha = 0;
  root.addChild(nameText);
  timeline
    .to(nameText, { prop: "alpha", from: 0, to: 1, start: 0.55, duration: 0.4, ease: outQuad })
    .to(nameText, { prop: "y", from: nameY + 14, to: nameY, start: 0.55, duration: 0.55, ease: outExpo });

  // --- One divider between the hero side and the spec column ---
  if (showDivider) {
    if (horizontal) {
      const dividerX = (frameCx + frameW / 2 + colLeft) / 2;
      const divH = bh * 0.72;
      const divider = new Graphics().roundRect(-Math.max(1, bw * 0.0015), -divH / 2, Math.max(2, bw * 0.003), divH, 2).fill(dividerColor);
      divider.position.set(dividerX, (b.top + b.bottom) / 2);
      divider.scale.set(1, 0);
      root.addChild(divider);
      timeline.to(divider, { prop: "scale.y", from: 0, to: 1, start: 0.5, duration: 0.5, ease: outExpo });
    } else {
      const dividerY = frameCy + frameH / 2 + gap1 / 2;
      const divider = new Graphics().roundRect(0, -Math.max(1, bh * 0.0015), colRight - colLeft, Math.max(2, bh * 0.003), 2).fill(dividerColor);
      divider.position.set(colLeft, dividerY);
      divider.scale.set(0, 1);
      root.addChild(divider);
      timeline.to(divider, { prop: "scale.x", from: 0, to: 1, start: 0.5, duration: 0.5, ease: outExpo });
    }
  }

  // --- Spec rows: icon chip + label + value, staggered in ---
  specs.forEach((spec, i) => {
    const rowCy = rowsTop + i * rowH + rowH * 0.5;
    const row = new Container();
    row.position.set(0, rowCy);
    row.alpha = 0;
    root.addChild(row);
    const start = ROWS_START + i * ROW_STAGGER;

    const icon = ICON_CYCLE[i % ICON_CYCLE.length] ?? "star";
    const chip = iconChip(icon, iconSide, accent, cardColor);
    chip.position.set(colLeft + iconSide / 2, 0);
    chip.scale.set(0);
    row.addChild(chip);
    timeline
      .to(chip, { prop: "scale.x", from: 0, to: 1, start: start + 0.08, duration: 0.4, ease: makeOutBack(1.8) })
      .to(chip, { prop: "scale.y", from: 0, to: 1, start: start + 0.08, duration: 0.4, ease: makeOutBack(1.8) });

    const textX = colLeft + iconSide + specSize * 0.5;
    if (spec.value !== null) {
      const labelText = makeText(fonts, { text: spec.label, role: "body", weight: 500, size: specSize, color: muted, anchor: { x: 0, y: 0.5 } });
      labelText.position.set(textX, 0);
      row.addChild(labelText);
      const valueText = makeText(fonts, { text: spec.value, role: "display", weight: 700, size: specSize, color: textColor, anchor: { x: 1, y: 0.5 } });
      valueText.position.set(colRight, 0);
      row.addChild(valueText);
    } else {
      const labelText = makeText(fonts, { text: spec.label, role: "body", weight: 600, size: specSize, color: textColor, anchor: { x: 0, y: 0.5 } });
      labelText.position.set(textX, 0);
      row.addChild(labelText);
    }

    timeline
      .to(row, { prop: "alpha", from: 0, to: 1, start, duration: 0.4, ease: outQuad })
      .to(row, { prop: "x", from: 20, to: 0, start, duration: ROW_X_DUR, ease: outQuint });
  });

  return { timeline, duration: computeDuration(values) };
}

export const specSheet: TemplateDefinition = {
  id: "spec-sheet",
  name: "Spec Sheet",
  tagline: "A product spec sheet with icon-led rows that stagger in.",
  category: "tech",
  aspects: ["16:9", "1:1", "4:5", "9:16"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 3.15,
  fontRoles: { name: "display" },
  estimateDuration: computeDuration,
  palettes: PALETTES,
  fields: [
    { key: "product", type: "image", label: "Product image", default: "", optional: true, help: "Fills the hero frame; a clean product photo or transparent PNG works best." },
    { key: "name", type: "text", label: "Name", default: "Nova X1", maxLength: 28, shrinkToFit: true },
    { key: "specs", type: "textlist", label: "Specs", default: DEFAULT_SPECS, minItems: 2, maxItems: 5, maxLength: 30, help: 'Use "Label | Value" for an icon + label + value row.' },
    { key: "showDivider", type: "toggle", label: "Divider", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
