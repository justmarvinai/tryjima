import { Container, Graphics, Sprite, type Texture } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outQuint,
  makeOutBack,
  spring,
  type Aspect,
  type BuiltTemplate,
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

const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const DEFAULT_COLORS = ["#2E7DF6", "#FF4D1C", "#101014", "#2F8F5B"];
const DEFAULT_NAMES = ["Ocean", "Ember", "Ink", "Sage"];

const PALETTES: Palette[] = [
  { id: "studio-white", name: "Studio white", colors: { background: "#F4F2EC", textColor: "#14140F", accent: "#FF4D1C", muted: "#6B6B60" } },
  { id: "electric-violet", name: "Electric violet", colors: { background: "#F1ECFB", textColor: "#180F2E", accent: "#6D3BEA", muted: "#6A5E85" } },
  { id: "splash-blue", name: "Splash blue", colors: { background: "#E9F1FC", textColor: "#0B1A2E", accent: "#1E6FE0", muted: "#5A6A82" } },
  { id: "ink-lime", name: "Ink lime", colors: { background: "#15171C", textColor: "#FFFFFF", accent: "#C7F24A", muted: "#8A93A0" } },
];

function colorList(values: Values): string[] {
  const raw = asItems(values.colors, DEFAULT_COLORS)
    .slice(0, 4)
    .map((c, i) => (HEX.test(c.trim()) ? c.trim() : (DEFAULT_COLORS[i % DEFAULT_COLORS.length] ?? "#2E7DF6")));
  return raw.length >= 3 ? raw : DEFAULT_COLORS.slice(0, 3);
}

function nameList(values: Values, colors: string[]): string[] {
  const raw = asItems(values.colorNames, DEFAULT_NAMES);
  return colors.map((_, i) => raw[i] ?? DEFAULT_NAMES[i] ?? `Color ${i + 1}`);
}

const T0 = 1.3;
const PER = 0.85;
const TAIL = 1.3;
const DIP = 0.16;
const RISE = 0.24;

function computeDuration(values: Values): number {
  const n = Math.max(3, Math.min(4, colorList(values).length));
  const lastSwitch = T0 + (n - 2) * PER;
  return lastSwitch + TAIL;
}

interface SWCfg {
  tileF: number;
  kickerF: number;
  nameF: number;
  swR: number;
}
const SW_CFG: Record<Aspect, SWCfg> = {
  "1:1": { tileF: 0.32, kickerF: 0.032, nameF: 0.052, swR: 0.028 },
  "4:5": { tileF: 0.32, kickerF: 0.032, nameF: 0.052, swR: 0.028 },
  "9:16": { tileF: 0.3, kickerF: 0.032, nameF: 0.054, swR: 0.028 },
  "16:9": { tileF: 0.32, kickerF: 0.03, nameF: 0.048, swR: 0.026 },
};

/** Content band (keeps clear of 9:16 platform-UI safe zones), matching sibling templates. */
function band(aspect: Aspect, w: number, h: number): { top: number; bottom: number } {
  if (aspect === "9:16") return { top: 230, bottom: h - 410 };
  const m = Math.round(Math.min(w, h) * 0.07);
  return { top: m, bottom: h - m };
}

/** Discrete swap (a `.set()`, per the SDK's documented use for tint/text changes)
 * masked by a brief alpha dip so the hard cut reads as a soft crossfade. */
function dipSwap(tl: JimaTimeline, target: object, prop: string, value: unknown, at: number): void {
  tl.to(target, { prop: "alpha", from: 1, to: 0.12, start: at - DIP, duration: DIP, ease: outQuad })
    .set(target, prop, value, at)
    .to(target, { prop: "alpha", from: 0.12, to: 1, start: at, duration: RISE, ease: outQuad });
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, images } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F4F2EC"));
  const textColor = str(values.textColor, pc("textColor", "#14140F"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const muted = pc("muted", "#6B6B60");

  const name = str(values.name, "Aero Case").toUpperCase();
  const colors = colorList(values);
  const names = nameList(values, colors);
  const n = colors.length;
  const showSwatches = values.showSwatches !== false;

  const W = size.width;
  const H = size.height;
  const minDim = Math.min(W, H);
  const cx = W / 2;

  const bgRect = new Graphics().rect(0, 0, W, H).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();
  const cfg = SW_CFG[ctx.aspect];
  const b = band(ctx.aspect, W, H);
  const bandH = b.bottom - b.top;

  const tileSide = minDim * cfg.tileF;
  const kickerSize = Math.round(minDim * cfg.kickerF);
  const colorNameSize = Math.round(minDim * cfg.nameF);
  const swR = Math.max(6, minDim * cfg.swR);
  const gapA = minDim * 0.04;
  const gapB = minDim * 0.05;
  const gapC = minDim * 0.055;
  const kickerH = kickerSize * 1.3;
  const colorNameH = colorNameSize * 1.3;
  const swatchRowH = swR * 2 * 1.7;

  const totalH = kickerH + gapA + tileSide + gapB + colorNameH + gapC + swatchRowH;
  const blockTop = b.top + Math.max(0, (bandH - totalH) / 2);

  const kickerY = blockTop + kickerH * 0.5;
  const tileCy = blockTop + kickerH + gapA + tileSide / 2;
  const colorNameY = blockTop + kickerH + gapA + tileSide + gapB + colorNameH * 0.5;
  const swatchY = blockTop + kickerH + gapA + tileSide + gapB + colorNameH + gapC + swatchRowH * 0.5;

  // --- Kicker (product name) ---
  const kicker = makeText(fonts, { text: name, role: "body", weight: 600, size: kickerSize, color: muted, anchor: 0.5, align: "center", letterSpacing: 2 });
  kicker.position.set(cx, kickerY);
  kicker.alpha = 0;
  root.addChild(kicker);
  timeline
    .to(kicker, { prop: "alpha", from: 0, to: 1, start: 0.25, duration: 0.4, ease: outQuad })
    .to(kicker, { prop: "y", from: kickerY + 12, to: kickerY, start: 0.25, duration: 0.5, ease: outQuint });

  // --- Product tile: a Container tinted as one unit (Pixi v8 recursive tint),
  // drawn in white so the tint alone determines the shown color. ---
  const shadow = new Graphics().roundRect(-tileSide / 2, -tileSide / 2 + tileSide * 0.04, tileSide, tileSide, tileSide * 0.14).fill({ color: 0x000000, alpha: 0.12 });
  shadow.position.set(cx, tileCy);
  root.addChild(shadow);

  const colorLayer = new Container();
  colorLayer.position.set(cx, tileCy);
  root.addChild(colorLayer);

  const tex: Texture | null = images.product ?? null;
  colorLayer.addChild(new Graphics().circle(0, 0, tileSide * 0.62).fill({ color: 0xffffff, alpha: 0.16 }));
  if (tex) {
    const holder = new Container();
    const s = new Sprite(tex);
    s.anchor.set(0.5);
    const cover = Math.max(tileSide / tex.width, tileSide / tex.height);
    s.scale.set(cover);
    const mask = new Graphics().roundRect(-tileSide / 2, -tileSide / 2, tileSide, tileSide, tileSide * 0.14).fill(0xffffff);
    holder.addChild(s, mask);
    s.mask = mask;
    colorLayer.addChild(holder);
  } else {
    colorLayer.addChild(new Graphics().roundRect(-tileSide / 2, -tileSide / 2, tileSide, tileSide, tileSide * 0.14).fill(0xffffff));
  }
  colorLayer.tint = colors[0] ?? "#2E7DF6";
  colorLayer.scale.set(0.84);
  colorLayer.alpha = 0;
  timeline
    .to(colorLayer, { prop: "alpha", from: 0, to: 1, start: 0.15, duration: 0.4, ease: outQuad })
    .to(colorLayer, { prop: "scale.x", from: 0.84, to: 1, start: 0.15, duration: 0.75, ease: spring(0.5) })
    .to(colorLayer, { prop: "scale.y", from: 0.84, to: 1, start: 0.15, duration: 0.75, ease: spring(0.5) });

  // --- Color-name label (crossfades via a `.set()` text swap under the dip) ---
  const colorNameText = makeText(fonts, { text: names[0] ?? "", role: "display", weight: 700, size: colorNameSize, color: textColor, anchor: 0.5, align: "center" });
  colorNameText.position.set(cx, colorNameY);
  colorNameText.alpha = 0;
  root.addChild(colorNameText);
  timeline
    .to(colorNameText, { prop: "alpha", from: 0, to: 1, start: 0.75, duration: 0.4, ease: outQuad })
    .to(colorNameText, { prop: "y", from: colorNameY + 14, to: colorNameY, start: 0.75, duration: 0.5, ease: outQuint });

  // --- Swatch row (toggleable) ---
  let swNodes: Container[] = [];
  const ringNodes: Graphics[] = [];
  if (showSwatches) {
    const pitch = swR * 3.3;
    const rowW = (n - 1) * pitch;
    const swatchRow = new Container();
    swatchRow.position.set(cx, swatchY);
    swatchRow.alpha = 0;
    swatchRow.scale.set(0.7);
    root.addChild(swatchRow);
    timeline
      .to(swatchRow, { prop: "alpha", from: 0, to: 1, start: 0.45, duration: 0.4, ease: outQuad })
      .to(swatchRow, { prop: "scale.x", from: 0.7, to: 1, start: 0.45, duration: 0.65, ease: spring(0.5) })
      .to(swatchRow, { prop: "scale.y", from: 0.7, to: 1, start: 0.45, duration: 0.65, ease: spring(0.5) });

    swNodes = colors.map((c, i) => {
      const swX = -rowW / 2 + i * pitch;
      const sw = new Container();
      sw.position.set(swX, 0);
      const ring = new Graphics().circle(0, 0, swR * 1.34).stroke({ color: accent, width: Math.max(2, swR * 0.22) });
      ring.scale.set(i === 0 ? 1 : 0);
      sw.addChild(ring);
      sw.addChild(new Graphics().circle(0, 0, swR).fill(c).stroke({ color: textColor, width: Math.max(1, swR * 0.06), alpha: 0.16 }));
      sw.scale.set(i === 0 ? 1.16 : 1);
      swatchRow.addChild(sw);
      ringNodes.push(ring);
      return sw;
    });
  }

  // --- The switch sequence: discrete `.set()` swaps (tint + label text),
  // masked by a brief alpha dip so each cut reads as a soft crossfade. ---
  for (let k = 1; k < n; k++) {
    const at = T0 + (k - 1) * PER;
    const colorVal = colors[k] ?? colors[0] ?? "#2E7DF6";
    const nameVal = names[k] ?? names[0] ?? "";

    dipSwap(timeline, colorLayer, "tint", colorVal, at);
    dipSwap(timeline, colorNameText, "text", nameVal, at);

    // A small confirming pop on the tile at the moment of the switch.
    timeline
      .to(colorLayer, { prop: "scale.x", from: 1, to: 1.05, start: at, duration: 0.16, ease: outQuad })
      .to(colorLayer, { prop: "scale.x", from: 1.05, to: 1, start: at + 0.16, duration: 0.24, ease: outQuad })
      .to(colorLayer, { prop: "scale.y", from: 1, to: 1.05, start: at, duration: 0.16, ease: outQuad })
      .to(colorLayer, { prop: "scale.y", from: 1.05, to: 1, start: at + 0.16, duration: 0.24, ease: outQuad });

    if (showSwatches) {
      const prevSw = swNodes[k - 1];
      const curSw = swNodes[k];
      const prevRing = ringNodes[k - 1];
      const curRing = ringNodes[k];
      if (prevSw && curSw && prevRing && curRing) {
        timeline
          .to(prevRing, { prop: "scale.x", from: 1, to: 0, start: at, duration: 0.28, ease: outQuad })
          .to(prevRing, { prop: "scale.y", from: 1, to: 0, start: at, duration: 0.28, ease: outQuad })
          .to(prevSw, { prop: "scale.x", from: 1.16, to: 1, start: at, duration: 0.3, ease: outQuad })
          .to(prevSw, { prop: "scale.y", from: 1.16, to: 1, start: at, duration: 0.3, ease: outQuad })
          .to(curRing, { prop: "scale.x", from: 0, to: 1, start: at, duration: 0.4, ease: makeOutBack(2.0) })
          .to(curRing, { prop: "scale.y", from: 0, to: 1, start: at, duration: 0.4, ease: makeOutBack(2.0) })
          .to(curSw, { prop: "scale.x", from: 1, to: 1.16, start: at, duration: 0.4, ease: spring(0.5) })
          .to(curSw, { prop: "scale.y", from: 1, to: 1.16, start: at, duration: 0.4, ease: spring(0.5) });
      }
    }
  }

  return { timeline, duration: computeDuration(values) };
}

export const swatchSwitch: TemplateDefinition = {
  id: "swatch-switch",
  name: "Swatch Switch",
  tagline: "A product tile switches color in sequence, swatch by swatch.",
  category: "product",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 3.4,
  fontRoles: { name: "body", colorNames: "display" },
  estimateDuration: computeDuration,
  palettes: PALETTES,
  fields: [
    { key: "product", type: "image", label: "Product image", default: "", optional: true, help: "Transparent PNG works best — it tints to match each color." },
    { key: "name", type: "text", label: "Name", default: "Aero Case", maxLength: 28, shrinkToFit: true },
    { key: "colors", type: "textlist", label: "Colors", default: DEFAULT_COLORS, minItems: 3, maxItems: 4, maxLength: 9, help: "Hex colors, e.g. #2E7DF6." },
    { key: "colorNames", type: "textlist", label: "Color names", default: DEFAULT_NAMES, minItems: 3, maxItems: 4, maxLength: 16 },
    { key: "showSwatches", type: "toggle", label: "Swatch dots", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
