import { Container, Graphics, Sprite, type Texture } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outQuint,
  outExpo,
  makeOutBack,
  spring,
  type BuiltTemplate,
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

const DEFAULT_SPECS = ["Battery | 24 hrs", "Weight | 180 g", "Waterproof | IP68", "Warranty | 2 years"];

const PALETTES: Palette[] = [
  { id: "studio-white", name: "Studio white", colors: { background: "#F4F2EC", cardColor: "#FFFFFF", accent: "#FF4D1C", textColor: "#14140F", muted: "#6B6B60", divider: "#E4E1D8" } },
  { id: "cool-blue", name: "Cool blue", colors: { background: "#E9F1FC", cardColor: "#FFFFFF", accent: "#1E6FE0", textColor: "#0B1A2E", muted: "#5A6A82", divider: "#D6E2F1" } },
  { id: "slate-lime", name: "Slate lime", colors: { background: "#14171C", cardColor: "#20242C", accent: "#C7F24A", textColor: "#FFFFFF", muted: "#98A0AD", divider: "#333A44" } },
  { id: "violet-cream", name: "Violet cream", colors: { background: "#F2EEFB", cardColor: "#FFFFFF", accent: "#6D3BEA", textColor: "#180F2E", muted: "#6A5E85", divider: "#E4DCF5" } },
];

function computeDuration(values: Values): number {
  const n = Math.max(2, Math.min(5, asItems(values.specs, DEFAULT_SPECS).length));
  return 1.2 + n * 0.4 + 1.2;
}

/** Largest size ≤ size0 (down to minSize) at which `text` fits `maxWidth` on one line. */
function fitOneLine(
  fonts: TemplateContext["fonts"],
  text: string,
  role: FontRole,
  weight: number,
  size0: number,
  maxWidth: number,
  minSize = 14,
): number {
  const family = fonts.family(role);
  let size = size0;
  while (size > minSize && fonts.measure(text, { family, weight, size }) > maxWidth) size -= 1;
  return size;
}

function parseSpec(s: string): { label: string; value: string | null } {
  const idx = s.indexOf("|");
  if (idx === -1) return { label: s.trim(), value: null };
  const label = s.slice(0, idx).trim();
  const value = s.slice(idx + 1).trim();
  return { label: label.length ? label : s.trim(), value: value.length ? value : null };
}

/** Greedy-wrap into ≤ maxLines lines, then shrink so the widest line fits. */
function wrapAndFit(
  fonts: TemplateContext["fonts"],
  text: string,
  role: FontRole,
  weight: number,
  size0: number,
  maxWidth: number,
  maxLines: number,
): { lines: string[]; size: number } {
  const family = fonts.family(role);
  const measure = (s: string, sz: number): number => fonts.measure(s, { family, weight, size: sz });
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return { lines: [""], size: size0 };
  const lines: string[] = [];
  let cur = "";
  for (const word of words) {
    const next = cur ? `${cur} ${word}` : word;
    if (!cur || measure(next, size0) <= maxWidth) cur = next;
    else {
      lines.push(cur);
      cur = word;
    }
  }
  if (cur) lines.push(cur);
  let packed = lines;
  if (packed.length > maxLines) {
    packed = [...packed.slice(0, maxLines - 1), packed.slice(maxLines - 1).join(" ")];
  }
  let size = size0;
  for (let guard = 0; guard < 8; guard++) {
    const widest = Math.max(...packed.map((l) => measure(l, size)));
    if (widest <= maxWidth || widest === 0) break;
    size = Math.max(12, Math.floor(size * (maxWidth / widest)));
  }
  return { lines: packed, size };
}

/** Rounded product frame with cover-fit masked image, or a designed placeholder. */
function imageFrame(w: number, h: number, r: number, tex: Texture | null, cardColor: string, accent: string): Container {
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

  const name = str(values.name, "Model X");
  const specs = asItems(values.specs, DEFAULT_SPECS).slice(0, 5).map(parseSpec);

  const W = size.width;
  const H = size.height;
  const margin = Math.round(Math.min(W, H) * 0.06);
  const tex = images.product ?? null;
  root.addChild(new Graphics().rect(0, 0, W, H).fill(bg));
  const timeline = new JimaTimeline();
  const horizontal = ctx.aspect === "16:9";

  // Resolve layout targets: frame center + dims, name anchor, spec column + rows.
  let frameCx: number;
  let frameCy: number;
  let frameW: number;
  let frameH: number;
  let nameX: number;
  let nameAnchorX: number;
  let nameSize0: number;
  let nameMaxW: number;
  let nameY: number;
  let colLeft: number;
  let colRight: number;
  let specTop: number;
  let specSize: number;

  if (horizontal) {
    frameW = W * 0.4;
    frameH = H * 0.7;
    frameCx = margin + frameW / 2;
    frameCy = H / 2;
    colLeft = frameCx + frameW / 2 + W * 0.05;
    colRight = W - margin;
    nameX = colLeft;
    nameAnchorX = 0;
    nameSize0 = Math.round(W * 0.055);
    nameMaxW = colRight - colLeft;
    specSize = Math.round(W * 0.03);
  } else {
    frameW = ctx.aspect === "9:16" ? W * 0.74 : W * 0.72;
    frameH = frameW * 0.72;
    frameCx = W / 2;
    colLeft = margin * 1.1;
    colRight = W - margin * 1.1;
    nameX = W / 2;
    nameAnchorX = 0.5;
    nameSize0 = Math.round(W * (ctx.aspect === "9:16" ? 0.07 : 0.062));
    nameMaxW = W - margin * 2;
    specSize = Math.round(W * (ctx.aspect === "9:16" ? 0.048 : 0.044));
    frameCy = 0; // set below after centering
  }

  const { lines: nameLines, size: nameSize } = wrapAndFit(fonts, name, "display", 700, nameSize0, nameMaxW, 2);
  const nameLH = Math.round(nameSize * 1.08);
  const nameBlockH = nameLines.length * nameLH;

  // Shrink the spec text uniformly so the longest label/value never overflows its column.
  const colW = colRight - colLeft;
  const specBase = specSize;
  const dotR = specBase * 0.28;
  let fitSpec = specBase;
  for (const s of specs) {
    if (s.value !== null) {
      fitSpec = Math.min(fitSpec, fitOneLine(fonts, s.label, "body", 500, specBase, colW * 0.52, 14));
      fitSpec = Math.min(fitSpec, fitOneLine(fonts, s.value, "display", 700, specBase, colW * 0.44, 14));
    } else {
      fitSpec = Math.min(fitSpec, fitOneLine(fonts, s.label, "body", 500, specBase, colW - dotR * 2 - specBase * 0.5, 14));
    }
  }
  specSize = fitSpec;
  const rowH = specBase * 2.15;

  if (horizontal) {
    // Right column block is vertically centered around H/2.
    const blockH = nameBlockH + H * 0.03 + specs.length * rowH;
    const blockTop = H / 2 - blockH / 2;
    nameY = blockTop;
    specTop = blockTop + nameBlockH + H * 0.03;
  } else {
    const top = ctx.aspect === "9:16" ? 230 : margin * 1.1;
    const bottom = ctx.aspect === "9:16" ? H - 410 : H - margin * 1.1;
    const gap1 = Math.min(W, H) * 0.05;
    const gap2 = Math.min(W, H) * 0.045;
    const totalH = frameH + gap1 + nameBlockH + gap2 + specs.length * rowH;
    const startY = (top + bottom) / 2 - totalH / 2;
    frameCy = startY + frameH / 2;
    nameY = startY + frameH + gap1;
    specTop = nameY + nameBlockH + gap2;
  }

  // --- Product image frame ---
  const frame = imageFrame(frameW, frameH, Math.min(frameW, frameH) * 0.08, tex, cardColor, accent);
  frame.position.set(frameCx, frameCy);
  frame.scale.set(0.9);
  frame.alpha = 0;
  root.addChild(frame);
  timeline
    .to(frame, { prop: "alpha", from: 0, to: 1, start: 0.15, duration: 0.4, ease: outQuad })
    .to(frame, { prop: "scale.x", from: 0.9, to: 1, start: 0.15, duration: 0.7, ease: spring(0.55) })
    .to(frame, { prop: "scale.y", from: 0.9, to: 1, start: 0.15, duration: 0.7, ease: spring(0.55) });

  // --- Product name ---
  const nameText = makeText(fonts, { text: nameLines.join("\n"), role: "display", weight: 700, size: nameSize, color: textColor, anchor: { x: nameAnchorX, y: 0 }, lineHeight: nameLH, align: nameAnchorX === 0 ? "left" : "center" });
  nameText.position.set(nameX, nameY);
  nameText.alpha = 0;
  root.addChild(nameText);
  timeline
    .to(nameText, { prop: "alpha", from: 0, to: 1, start: 0.7, duration: 0.4, ease: outQuad })
    .to(nameText, { prop: "y", from: nameY + 16, to: nameY, start: 0.7, duration: 0.6, ease: outExpo });

  // --- Spec rows ---
  const showDivider = values.divider !== false;
  const showAccentDot = values.accentDot !== false;
  specs.forEach((spec, i) => {
    const rowCy = specTop + i * rowH + rowH * 0.42;
    const row = new Container();
    row.position.set(0, rowCy);
    row.alpha = 0;
    root.addChild(row);
    const start = 1.2 + i * 0.4;

    if (spec.value !== null) {
      const labelText = makeText(fonts, { text: spec.label, role: "body", weight: 500, size: specSize, color: muted, anchor: { x: 0, y: 0.5 } });
      labelText.position.set(colLeft, 0);
      row.addChild(labelText);
      const valueText = makeText(fonts, { text: spec.value, role: "display", weight: 700, size: specSize, color: textColor, anchor: { x: 1, y: 0.5 } });
      valueText.position.set(colRight, 0);
      row.addChild(valueText);
    } else {
      if (showAccentDot) {
        const dot = new Graphics().circle(0, 0, dotR).fill(accent);
        dot.position.set(colLeft + dotR, 0);
        dot.scale.set(0);
        row.addChild(dot);
        timeline
          .to(dot, { prop: "scale.x", from: 0, to: 1, start: start + 0.1, duration: 0.4, ease: makeOutBack(2) })
          .to(dot, { prop: "scale.y", from: 0, to: 1, start: start + 0.1, duration: 0.4, ease: makeOutBack(2) });
      }
      const labelText = makeText(fonts, { text: spec.label, role: "body", weight: 500, size: specSize, color: textColor, anchor: { x: 0, y: 0.5 } });
      labelText.position.set(colLeft + dotR * 2 + specSize * 0.5, 0);
      row.addChild(labelText);
    }

    // Thin divider under the row.
    if (showDivider) {
      const divW = colRight - colLeft;
      const divider = new Graphics().roundRect(0, 0, divW, Math.max(2, specSize * 0.05), 2).fill(dividerColor);
      divider.position.set(colLeft, rowH * 0.42);
      divider.scale.set(0, 1);
      row.addChild(divider);
      timeline.to(divider, { prop: "scale.x", from: 0, to: 1, start: start + 0.05, duration: 0.5, ease: outExpo });
    }

    timeline
      .to(row, { prop: "alpha", from: 0, to: 1, start, duration: 0.4, ease: outQuad })
      .to(row, { prop: "x", from: 24, to: 0, start, duration: 0.55, ease: outQuint });
  });

  return { timeline, duration: computeDuration(values) };
}

export const specList: TemplateDefinition = {
  id: "spec-list",
  name: "Spec List",
  tagline: "A product spec sheet ticks in row by row.",
  category: "product",
  aspects: ["9:16", "1:1", "4:5", "16:9"],
  defaultAspect: "9:16",
  loopable: false,
  posterTime: 3.0,
  estimateDuration: computeDuration,
  palettes: PALETTES,
  fields: [
    { key: "product", type: "image", label: "Product image", default: "", optional: true, help: "Fills the frame; a clean product photo works best." },
    { key: "name", type: "text", label: "Name", default: "Model X", maxLength: 28, shrinkToFit: true },
    { key: "specs", type: "textlist", label: "Specs", default: DEFAULT_SPECS, minItems: 2, maxItems: 5, maxLength: 30, help: 'Use "Label | Value" for a two-column row, or plain text for a bullet.' },
    { key: "divider", type: "toggle", label: "Divider line", default: true },
    { key: "accentDot", type: "toggle", label: "Accent dot", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
