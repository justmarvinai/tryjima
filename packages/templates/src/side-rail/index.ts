import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outQuint,
  outExpo,
  inOutCubic,
  safeRect,
  TRANSPARENT_BG,
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

const asList = (v: unknown, fallback: string[]): string[] => {
  if (Array.isArray(v)) {
    const arr = v.filter((s): s is string => typeof s === "string" && s.length > 0);
    if (arr.length) return arr;
  }
  return fallback;
};

/** Largest size <= size0 at which `text` fits `maxWidth` (crisp, single-line). */
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
  return w > maxWidth ? Math.max(10, Math.floor(size0 * (maxWidth / w))) : size0;
}

/**
 * A layered soft shadow: several concentric rounded rects at a very low alpha,
 * so the falloff ramps smoothly instead of banding into a grey outline the way
 * one thick layer does.
 */
function softShadow(
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
  spread: number,
  offsetY: number,
): Graphics {
  const g = new Graphics();
  const layers = 7;
  for (let i = layers; i >= 1; i--) {
    const f = i / layers;
    const e = spread * f;
    g.roundRect(x - e, y - e + offsetY * f, w + e * 2, h + e * 2, radius + e).fill({
      color: "#000000",
      alpha: 0.02,
    });
  }
  return g;
}

// A slim VERTICAL rail docks to the left or right edge and two to four labels
// slide in along it, one after another, while an accent marker glides down the
// rail and comes to rest beside the last one. Every other overlay in the
// library runs horizontally; the vertical orientation is the whole point.
//
// Transparent export: only the full-frame `bg` rect is tied to the background
// field (it defaults to the transparent sentinel). The rail and the label chips
// carry their own palette-only `railBg` / `chipBg` surfaces plus soft shadows,
// so the stack still reads once the canvas fill is gone.
const PALETTES: Palette[] = [
  { id: "ink", name: "Ink", colors: { railBg: "#0E1014", chipBg: "#0E1014", textColor: "#FFFFFF", accent: "#FF6A3D" } },
  { id: "paper", name: "Paper", colors: { railBg: "#0B0F14", chipBg: "#FFFFFF", textColor: "#0B0F14", accent: "#2E5BD6" } },
  { id: "moss", name: "Moss", colors: { railBg: "#0A2018", chipBg: "#0A2018", textColor: "#FFFFFF", accent: "#5FE0A8" } },
  { id: "plum", name: "Plum", colors: { railBg: "#171029", chipBg: "#171029", textColor: "#FFFFFF", accent: "#C6A8FF" } },
];

const DEFAULT_ITEMS = ["Discovery", "Design sprint", "Handover"];

const CHIP_START = 0.55;
const CHIP_STAGGER = 0.24;
const CHIP_DUR = 0.75;
const HOLD = 2.0;

function itemsOf(values: Values): string[] {
  return asList(values.items, DEFAULT_ITEMS).slice(0, 4);
}

function computeDuration(values: Values): number {
  const n = Math.max(1, itemsOf(values).length);
  return CHIP_START + (n - 1) * CHIP_STAGGER + CHIP_DUR + HOLD;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", TRANSPARENT_BG));
  const railBg = pc("railBg", "#0E1014");
  const chipBg = pc("chipBg", "#0E1014");
  const textColor = str(values.textColor, pc("textColor", "#FFFFFF"));
  const accent = str(values.accent, pc("accent", "#FF6A3D"));

  const items = itemsOf(values);
  const onRight = str(values.side, "left") === "right";
  const showMarker = values.showMarker !== false;
  const showShadow = values.showShadow !== false;

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const rect = safeRect(ctx.aspect);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Geometry: the rail hugs the safe edge, the chips hang off it. ---
  const railW = Math.max(4, Math.round(minDim * 0.009));
  const railGap = Math.round(minDim * 0.024);
  const chipPadX = Math.round(minDim * 0.024);
  const chipPadY = Math.round(minDim * 0.017);
  const gap = Math.round(minDim * 0.019);

  const railX = onRight ? rect.x + rect.width - railW / 2 : rect.x + railW / 2;
  const chipEdgeX = onRight ? railX - railW / 2 - railGap : railX + railW / 2 + railGap;
  const maxChipTextW = Math.max(60, rect.width - railW - railGap - chipPadX * 2 - Math.round(minDim * 0.02));

  const baseSize = Math.round(minDim * 0.034);
  const sizes = items.map((it) => fitSize(fonts, it, "body", 600, baseSize, maxChipTextW));
  const labelSize = Math.min(...sizes);
  const chipH = labelSize + chipPadY * 2;
  const chipRadius = Math.round(chipH * 0.32);

  const n = items.length;
  const stackH = n * chipH + (n - 1) * gap;
  const stackTop = rect.y + rect.height / 2 - stackH / 2;
  const chipCY = (i: number): number => stackTop + chipH / 2 + i * (chipH + gap);

  // --- The rail itself: grows down from the top of the stack. ---
  const railPad = Math.round(minDim * 0.016);
  const railH = stackH + railPad * 2;
  const railC = new Container();
  railC.position.set(railX, stackTop - railPad);
  railC.scale.set(1, 0);
  root.addChild(railC);
  if (showShadow) {
    railC.addChild(softShadow(-railW / 2, 0, railW, railH, railW / 2, railW * 0.9, railW * 0.5));
  }
  railC.addChild(new Graphics().roundRect(-railW / 2, 0, railW, railH, railW / 2).fill(railBg));
  timeline.to(railC, { prop: "scale.y", from: 0, to: 1, start: 0.1, duration: 0.9, ease: outExpo });

  // --- Marker: an accent segment that glides down the rail and rests beside
  // the last label (toggleable). ---
  const markerTravel = (n - 1) * CHIP_STAGGER + CHIP_DUR;
  if (showMarker) {
    const markerW = railW * 3;
    const markerH = Math.round(chipH * 0.8);
    const marker = new Graphics()
      .roundRect(-markerW / 2, -markerH / 2, markerW, markerH, markerW / 2)
      .fill(accent);
    marker.position.set(railX, chipCY(0));
    marker.alpha = 0;
    root.addChild(marker);
    timeline
      .to(marker, { prop: "alpha", from: 0, to: 1, start: 0.45, duration: 0.4, ease: outQuad })
      .to(marker, {
        prop: "y",
        from: chipCY(0),
        to: chipCY(n - 1),
        start: CHIP_START,
        duration: markerTravel,
        ease: inOutCubic,
      });
  }

  // --- Labels: they slide out of the rail one after another, 240ms apart, so
  // the stack reads as one flowing gesture rather than a burst. ---
  const drift = minDim * 0.05;
  items.forEach((item, i) => {
    const textW = fonts.measure(item, { family: fonts.family("body"), weight: 600, size: labelSize });
    const chipW = Math.min(rect.width - railW - railGap, chipPadX * 2 + textW);
    const x0 = onRight ? -chipW : 0;

    const chip = new Container();
    const restX = chipEdgeX;
    chip.position.set(restX, chipCY(i));
    chip.alpha = 0;
    root.addChild(chip);

    if (showShadow) {
      chip.addChild(
        softShadow(x0, -chipH / 2, chipW, chipH, chipRadius, Math.round(chipH * 0.24), Math.round(chipH * 0.1)),
      );
    }
    chip.addChild(new Graphics().roundRect(x0, -chipH / 2, chipW, chipH, chipRadius).fill(chipBg));

    const label = makeText(fonts, {
      text: item,
      role: "body",
      weight: 600,
      size: labelSize,
      color: textColor,
      anchor: { x: onRight ? 1 : 0, y: 0.5 },
    });
    label.position.set(onRight ? x0 + chipW - chipPadX : x0 + chipPadX, 0);
    chip.addChild(label);

    const start = CHIP_START + i * CHIP_STAGGER;
    const fromX = restX + (onRight ? drift : -drift);
    timeline
      .to(chip, { prop: "alpha", from: 0, to: 1, start, duration: 0.5, ease: outQuad })
      .to(chip, { prop: "x", from: fromX, to: restX, start, duration: CHIP_DUR, ease: outQuint });
  });

  return { timeline, duration: computeDuration(values) };
}

export const sideRail: TemplateDefinition = {
  id: "side-rail",
  name: "Side Rail",
  tagline: "A vertical rail docks to the edge and labels slide in along it, one after another.",
  category: "overlay",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 2.8,
  estimateDuration: computeDuration,
  fontRoles: { items: "body" },
  palettes: PALETTES,
  fields: [
    { key: "items", type: "textlist", label: "Labels", default: DEFAULT_ITEMS, minItems: 2, maxItems: 4, maxLength: 24 },
    {
      key: "side",
      type: "select",
      label: "Side",
      default: "left",
      options: [
        { value: "left", label: "Left edge" },
        { value: "right", label: "Right edge" },
      ],
    },
    { key: "showMarker", type: "toggle", label: "Accent marker", default: true },
    { key: "showShadow", type: "toggle", label: "Soft shadow", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
