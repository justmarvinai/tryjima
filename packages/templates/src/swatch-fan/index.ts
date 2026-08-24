import { Container, Graphics, Sprite, type Texture } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  inOutCubic,
  inOutQuad,
  outExpo,
  outQuad,
  outQuint,
  safeRect,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
  type Values,
} from "@jima/engine";

// Swatch Fan — colour chips open out of a closed stack in a smooth arc, like a
// paint deck being fanned. One chip is drawn out of the fan and the product
// takes its colour. The arc is the mechanic: no grids, no toggles.

const DURATION = 5.0;
const DEG = Math.PI / 180;
const SPREAD = 52 * DEG;

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;

const num = (v: unknown, fallback: number): number =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;

const asList = (v: unknown, fallback: string[]): string[] => {
  if (Array.isArray(v)) {
    const arr = v.filter((s): s is string => typeof s === "string" && s.length > 0);
    if (arr.length) return arr;
  }
  return fallback;
};

/** Largest size ≤ size0 at which `text` fits `maxWidth` on one crisp line. */
function fitSize(
  fonts: FontRegistry,
  text: string,
  role: FontRole,
  weight: number,
  size0: number,
  maxWidth: number,
): number {
  if (text.length === 0 || maxWidth <= 0) return size0;
  const w = fonts.measure(text, { family: fonts.family(role), weight, size: size0 });
  return w > maxWidth ? Math.max(11, Math.floor((size0 * maxWidth) / w)) : size0;
}

const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

const DEFAULT_SWATCHES = [
  "Graphite|#2B2F33",
  "Clay|#B4603C",
  "Terracotta|#C2724A",
  "Sea Glass|#7FA396",
  "Bone|#DED5C6",
];

interface Swatch {
  name: string;
  color: string;
}

function parseSwatches(values: Values, fallbackColor: string): Swatch[] {
  return asList(values.swatches, DEFAULT_SWATCHES)
    .slice(0, 6)
    .map((raw) => {
      const parts = raw.split("|").map((s) => s.trim());
      const name = parts[0];
      const hex = parts[1] ?? "";
      return {
        name: name && name.length > 0 ? name : "Colour",
        color: HEX.test(hex) ? hex : fallbackColor,
      };
    });
}

const PALETTES: Palette[] = [
  {
    id: "studio-linen",
    name: "Studio linen",
    colors: { background: "#F5F2ED", panelBg: "#FFFFFF", textColor: "#1B1815", muted: "#67615B", accent: "#A8492A" },
  },
  {
    id: "cool-gallery",
    name: "Cool gallery",
    colors: { background: "#EEF1F4", panelBg: "#FFFFFF", textColor: "#141920", muted: "#59636E", accent: "#2F5EA8" },
  },
  {
    id: "sage-atelier",
    name: "Sage atelier",
    colors: { background: "#E8EDE7", panelBg: "#FFFFFF", textColor: "#151F19", muted: "#546258", accent: "#2F6B4E" },
  },
  {
    id: "noir-studio",
    name: "Noir studio",
    colors: { background: "#131417", panelBg: "#1E2126", textColor: "#F1F2F4", muted: "#9AA0A8", accent: "#C8A96A" },
  },
];

/** A mug silhouette in one flat colour, optically centered on its origin. */
function mugSilhouette(mw: number, mh: number, color: string): Container {
  const c = new Container();
  const g = new Graphics();
  g.circle(mw * 0.42, mh * 0.02, mh * 0.22).stroke({ color, width: mh * 0.075 });
  g.roundRect(-mw * 0.34, -mh * 0.42, mw * 0.68, mh * 0.84, mw * 0.1).fill(color);
  g.roundRect(-mw * 0.34, -mh * 0.42, mw * 0.68, mh * 0.12, mw * 0.06).fill({ color: 0xffffff, alpha: 0.22 });
  g.roundRect(-mw * 0.34, mh * 0.3, mw * 0.68, mh * 0.12, mw * 0.06).fill({ color: 0x000000, alpha: 0.1 });
  g.x = -mw * 0.169;
  c.addChild(g);
  return c;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, images } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F5F2ED"));
  const panelBg = pc("panelBg", "#FFFFFF");
  const textColor = str(values.textColor, pc("textColor", "#1B1815"));
  const muted = pc("muted", "#67615B");
  const accent = str(values.accent, pc("accent", "#A8492A"));

  const kicker = str(values.kicker, "Five finishes").toUpperCase();
  const product = str(values.product, "Marlow Mug");
  const swatches = parseSwatches(values, accent);
  const n = swatches.length;
  const sel = Math.min(n - 1, Math.max(0, Math.round(num(values.selected, 3)) - 1));
  const fromIdx = sel === 0 ? n - 1 : 0;
  const colorFrom = swatches[fromIdx]?.color ?? accent;
  const chosen = swatches[sel];
  const colorTo = chosen?.color ?? accent;
  const colorName = chosen?.name ?? "Colour";
  const showPanel = values.showPanel !== false;
  const showChipRing = values.showChipRing !== false;
  const showColorDot = values.showColorDot !== false;

  const W = size.width;
  const H = size.height;
  const minDim = Math.min(W, H);
  const wide = ctx.aspect === "16:9";
  const zone = safeRect(ctx.aspect);

  const bgRect = new Graphics().rect(0, 0, W, H).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Metrics ---
  const S = wide
    ? Math.min(zone.width * 0.32, zone.height * 0.66)
    : Math.min(zone.width * 0.62, zone.height * 0.34, minDim * 0.42);
  const chipLen = S * (wide ? 0.44 : 0.62);
  const chipW = S * (wide ? 0.062 : 0.085);
  const hingeGap = chipW * 0.55;
  const hingeR = chipW * 0.55;
  const fanH = chipLen + hingeGap + hingeR * 1.8;

  const textW = wide ? zone.width * 0.38 : zone.width * 0.9;
  const kickSize = fitSize(fonts, kicker, "body", 600, Math.round(minDim * 0.024), textW);
  const nameSize = fitSize(fonts, product, "display", 700, Math.round(minDim * 0.052), textW);
  const cnameSize = fitSize(fonts, colorName, "display", 600, Math.round(minDim * 0.034), textW * 0.8);
  const kickH = kickSize * 1.7;
  const nameH = nameSize * 1.3;
  const cnameH = cnameSize * 1.7;
  const gapA = minDim * (wide ? 0.05 : 0.045);
  const gapB = minDim * 0.06;
  const gapC = minDim * 0.035;

  let panelCx: number;
  let panelCy: number;
  let colAnchorX: number;
  let hingeX: number;
  let blockTop: number;
  const anchorX = wide ? 0 : 0.5;
  const alignMode = wide ? "left" : "center";

  if (wide) {
    panelCx = zone.x + zone.width * 0.27;
    panelCy = zone.y + zone.height / 2;
    colAnchorX = zone.x + zone.width * 0.55;
    hingeX = colAnchorX + zone.width * 0.38 * 0.34;
    const blockH = kickH + nameH + gapA + fanH + gapC + cnameH;
    blockTop = zone.y + (zone.height - blockH) / 2;
  } else {
    panelCx = zone.x + zone.width / 2;
    colAnchorX = panelCx;
    hingeX = panelCx;
    const blockH = kickH + nameH + gapA + S + gapB + fanH + gapC + cnameH;
    blockTop = zone.y + (zone.height - blockH) / 2;
    panelCy = blockTop + kickH + nameH + gapA + S / 2;
  }
  const fanTop = wide ? blockTop + kickH + nameH + gapA : blockTop + kickH + nameH + gapA + S + gapB;
  const hingeY = fanTop + chipLen + hingeGap;
  const cnameCy = fanTop + fanH + gapC + cnameH * 0.5;

  const tex: Texture | null = images.image ?? null;
  const hasImage = tex !== null;

  // --- Product panel (recolours when a photo stands in for the silhouette) ---
  const panelWrap = new Container();
  panelWrap.position.set(panelCx, panelCy);
  panelWrap.alpha = 0;
  panelWrap.scale.set(0.94);
  root.addChild(panelWrap);
  const panelR = S * 0.1;
  if (showPanel) {
    panelWrap.addChild(
      new Graphics()
        .roundRect(-S / 2, -S / 2 + S * 0.02, S, S, panelR)
        .fill({ color: 0x000000, alpha: 0.07 }),
    );
    panelWrap.addChild(
      new Graphics().roundRect(-S / 2, -S / 2, S, S, panelR).fill(hasImage ? colorFrom : panelBg),
    );
    if (hasImage) {
      const panelB = new Graphics().roundRect(-S / 2, -S / 2, S, S, panelR).fill(colorTo);
      panelB.alpha = 0;
      panelWrap.addChild(panelB);
      timeline.to(panelB, { prop: "alpha", from: 0, to: 1, start: 2.6, duration: 0.75, ease: inOutCubic });
    }
  }
  timeline
    .to(panelWrap, { prop: "alpha", from: 0, to: 1, start: 0.1, duration: 0.5, ease: outQuad })
    .to(panelWrap, { prop: "scale.x", from: 0.94, to: 1, start: 0.1, duration: 0.9, ease: outExpo })
    .to(panelWrap, { prop: "scale.y", from: 0.94, to: 1, start: 0.1, duration: 0.9, ease: outExpo });

  // --- Product (silhouette recolours; a photo keeps its own colours) ---
  const productWrap = new Container();
  productWrap.position.set(panelCx, panelCy);
  productWrap.alpha = 0;
  root.addChild(productWrap);
  if (tex) {
    const s = new Sprite(tex);
    s.anchor.set(0.5);
    const inner = S * 0.78;
    s.scale.set(Math.min(inner / tex.width, inner / tex.height));
    productWrap.addChild(s);
  } else {
    const mw = S * 0.6;
    const mh = S * 0.64;
    productWrap.addChild(mugSilhouette(mw, mh, colorFrom));
    const mugB = mugSilhouette(mw, mh, colorTo);
    mugB.alpha = 0;
    productWrap.addChild(mugB);
    timeline.to(mugB, { prop: "alpha", from: 0, to: 1, start: 2.6, duration: 0.75, ease: inOutCubic });
  }
  timeline
    .to(productWrap, { prop: "alpha", from: 0, to: 1, start: 0.35, duration: 0.5, ease: outQuad })
    .to(productWrap, { prop: "y", from: panelCy + S * 0.05, to: panelCy, start: 0.35, duration: 0.95, ease: outExpo });

  // --- Head type ---
  const kickY = blockTop + kickH * 0.5;
  const kickText = makeText(fonts, {
    text: kicker,
    role: "body",
    weight: 600,
    size: kickSize,
    color: muted,
    anchor: { x: anchorX, y: 0.5 },
    align: alignMode,
    letterSpacing: kickSize * 0.16,
  });
  kickText.position.set(colAnchorX, kickY);
  kickText.alpha = 0;
  root.addChild(kickText);
  timeline
    .to(kickText, { prop: "alpha", from: 0, to: 1, start: 0.15, duration: 0.6, ease: outQuad })
    .to(kickText, { prop: "y", from: kickY + minDim * 0.014, to: kickY, start: 0.15, duration: 0.85, ease: outQuint });

  const nameY = blockTop + kickH + nameH * 0.5;
  const nameText = makeText(fonts, {
    text: product,
    role: "display",
    weight: 700,
    size: nameSize,
    color: textColor,
    anchor: { x: anchorX, y: 0.5 },
    align: alignMode,
    letterSpacing: -nameSize * 0.018,
  });
  nameText.position.set(colAnchorX, nameY);
  nameText.alpha = 0;
  root.addChild(nameText);
  timeline
    .to(nameText, { prop: "alpha", from: 0, to: 1, start: 0.32, duration: 0.65, ease: outQuad })
    .to(nameText, { prop: "y", from: nameY + minDim * 0.022, to: nameY, start: 0.32, duration: 1.0, ease: outExpo });

  // --- The fan: every chip starts stacked upright, then arcs open ---
  const fan = new Container();
  fan.position.set(hingeX, hingeY);
  root.addChild(fan);
  const lift = chipLen * 0.13;

  swatches.forEach((sw, i) => {
    const angle = n === 1 ? 0 : -SPREAD + (i / (n - 1)) * 2 * SPREAD;
    const chip = new Container();
    chip.alpha = 0;
    fan.addChild(chip);

    const chipInner = new Container();
    chip.addChild(chipInner);
    chipInner.addChild(
      new Graphics()
        .roundRect(-chipW / 2, -(hingeGap + chipLen), chipW, chipLen, chipW * 0.45)
        .fill(sw.color)
        .roundRect(-chipW / 2, -(hingeGap + chipLen), chipW, chipLen, chipW * 0.45)
        .stroke({ color: textColor, width: Math.max(1, chipW * 0.03), alpha: 0.12 }),
    );

    const inStart = 0.9 + i * 0.04;
    timeline.to(chip, { prop: "alpha", from: 0, to: 1, start: inStart, duration: 0.3, ease: outQuad });
    timeline.to(chip, {
      prop: "rotation",
      from: 0,
      to: angle,
      start: 0.95 + i * 0.075,
      duration: 0.95,
      ease: outQuint,
    });

    if (i === sel) {
      if (showChipRing) {
        const pad = chipW * 0.26;
        const ring = new Graphics()
          .roundRect(
            -chipW / 2 - pad,
            -(hingeGap + chipLen) - pad,
            chipW + pad * 2,
            chipLen + pad * 2,
            (chipW + pad * 2) * 0.45,
          )
          .stroke({ color: textColor, width: Math.max(1.2, chipW * 0.06), alpha: 0.55 });
        ring.alpha = 0;
        chipInner.addChild(ring);
        timeline.to(ring, { prop: "alpha", from: 0, to: 1, start: 2.35, duration: 0.5, ease: outQuad });
      }
      timeline.to(chipInner, { prop: "y", from: 0, to: -lift, start: 2.35, duration: 0.8, ease: outExpo });
    } else {
      timeline.to(chip, { prop: "alpha", from: 1, to: 0.42, start: 2.35, duration: 0.6, ease: inOutQuad });
    }
  });

  const pin = new Graphics()
    .circle(0, 0, hingeR)
    .fill(panelBg)
    .circle(0, 0, hingeR)
    .stroke({ color: textColor, width: Math.max(1, hingeR * 0.16), alpha: 0.3 });
  pin.alpha = 0;
  fan.addChild(pin);
  timeline.to(pin, { prop: "alpha", from: 0, to: 1, start: 0.85, duration: 0.4, ease: outQuad });

  // --- Chosen colour name ---
  const cnameRow = new Container();
  cnameRow.position.set(colAnchorX, cnameCy);
  cnameRow.alpha = 0;
  root.addChild(cnameRow);
  const dotR = cnameSize * 0.34;
  const dotGap = cnameSize * 0.5;
  const cnameText = makeText(fonts, {
    text: colorName,
    role: "display",
    weight: 600,
    size: cnameSize,
    color: textColor,
    anchor: { x: 0, y: 0.5 },
    align: "left",
  });
  const rowW = (showColorDot ? dotR * 2 + dotGap : 0) + cnameText.width;
  const rowLeft = wide ? 0 : -rowW / 2;
  if (showColorDot) {
    const dot = new Graphics()
      .circle(rowLeft + dotR, 0, dotR)
      .fill(colorTo)
      .circle(rowLeft + dotR, 0, dotR)
      .stroke({ color: textColor, width: Math.max(1, dotR * 0.1), alpha: 0.18 });
    cnameRow.addChild(dot);
  }
  cnameText.position.set(rowLeft + (showColorDot ? dotR * 2 + dotGap : 0), 0);
  cnameRow.addChild(cnameText);
  timeline
    .to(cnameRow, { prop: "alpha", from: 0, to: 1, start: 2.95, duration: 0.7, ease: outQuad })
    .to(cnameRow, { prop: "y", from: cnameCy + minDim * 0.016, to: cnameCy, start: 2.95, duration: 0.95, ease: outExpo });

  return { timeline, duration: DURATION };
}

export const swatchFan: TemplateDefinition = {
  id: "swatch-fan",
  name: "Swatch Fan",
  tagline: "Colour chips fan open like a paint deck, then the product takes the chosen one.",
  category: "product",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 4.2,
  fontRoles: { product: "display", kicker: "body" },
  palettes: PALETTES,
  fields: [
    {
      key: "image",
      type: "image",
      label: "Product image",
      default: "",
      optional: true,
      help: "Optional — with a photo the panel behind it takes the chosen colour instead.",
    },
    { key: "kicker", type: "text", label: "Eyebrow", default: "Five finishes", maxLength: 26, shrinkToFit: true },
    { key: "product", type: "text", label: "Product", default: "Marlow Mug", maxLength: 26, shrinkToFit: true },
    {
      key: "swatches",
      type: "textlist",
      label: "Colours",
      default: DEFAULT_SWATCHES,
      minItems: 3,
      maxItems: 6,
      maxLength: 26,
      help: 'One per line as "Name|#HEX", e.g. "Clay|#B4603C".',
    },
    { key: "selected", type: "slider", label: "Chosen colour", default: 3, min: 1, max: 6, step: 1 },
    { key: "showPanel", type: "toggle", label: "Product panel", default: true },
    { key: "showChipRing", type: "toggle", label: "Selection outline", default: true },
    { key: "showColorDot", type: "toggle", label: "Colour dot", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
