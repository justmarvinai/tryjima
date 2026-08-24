import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outQuint,
  outExpo,
  safeRect,
  TRANSPARENT_BG,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;

/** Largest size <= size0 at which `text` fits `maxWidth` (crisp, single-line). */
function fitSize(
  fonts: FontRegistry,
  text: string,
  role: FontRole,
  weight: number,
  size0: number,
  maxWidth: number,
  trackingRatio = 0,
): number {
  if (text.length === 0 || maxWidth <= 0) return size0;
  const w = fonts.measure(text, {
    family: fonts.family(role),
    weight,
    size: size0,
    letterSpacing: size0 * trackingRatio,
  });
  return w > maxWidth ? Math.max(10, Math.floor(size0 * (maxWidth / w))) : size0;
}

interface Morph {
  node: Container;
  capR: Graphics;
  mid: Graphics;
}

/**
 * A pill built from two caps and a unit-wide middle, so its width can be
 * animated (capR.x + mid.scale.x on the same ease) without ever distorting the
 * round ends — which is what a plain scale.x on a rounded rect would do.
 *
 * `halfCaps` draws the caps as half-discs that butt exactly against the middle
 * instead of overlapping it: required for translucent fills (the shadow), where
 * overlapping pieces would double their alpha and leave visible seams.
 */
function morphPill(
  height: number,
  grow: number,
  fill: { color: string; alpha?: number },
  offsetY: number,
  halfCaps: boolean,
): Morph {
  const node = new Container();
  const r = height / 2 + grow;
  const capL = new Graphics();
  const capR = new Graphics();
  if (halfCaps) {
    capL.arc(0, offsetY, r, Math.PI / 2, Math.PI * 1.5).fill(fill);
    capR.arc(0, offsetY, r, -Math.PI / 2, Math.PI / 2).fill(fill);
  } else {
    capL.circle(0, offsetY, r).fill(fill);
    capR.circle(0, offsetY, r).fill(fill);
  }
  const mid = new Graphics().rect(0, offsetY - r, 1, r * 2).fill(fill);
  mid.scale.set(0, 1);
  node.addChild(capL, mid, capR);
  return { node, capR, mid };
}

// A small accent dot stretches sideways into a rounded pill, and the label
// fades in on the tail of the expansion. The dot→pill width morph is the whole
// mechanic (the dot survives as a bullet inside the finished pill), which is
// what separates this from the chips that simply pop into place.
//
// Transparent export: only the full-frame `bg` rect is tied to the background
// field (it defaults to the transparent sentinel); the pill owns its own
// palette-only `pillBg` surface and a soft shadow that grows with it, so it
// reads over footage once the canvas fill is gone.
const PALETTES: Palette[] = [
  { id: "ink", name: "Ink", colors: { pillBg: "#0E1014", textColor: "#FFFFFF", accent: "#FF6A3D" } },
  { id: "paper", name: "Paper", colors: { pillBg: "#FFFFFF", textColor: "#0B0F14", accent: "#2E5BD6" } },
  { id: "moss", name: "Moss", colors: { pillBg: "#0A2018", textColor: "#FFFFFF", accent: "#5FE0A8" } },
  { id: "sand", name: "Sand", colors: { pillBg: "#FBF6EC", textColor: "#241C10", accent: "#B45309" } },
];

const POP_START = 0.1;
const EXPAND_START = 0.55;
const EXPAND_DUR = 1.05;
const LABEL_START = 1.0;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", TRANSPARENT_BG));
  const pillBg = pc("pillBg", "#0E1014");
  const textColor = str(values.textColor, pc("textColor", "#FFFFFF"));
  const accent = str(values.accent, pc("accent", "#FF6A3D"));

  const label = str(values.label, "Now streaming");
  const placement = str(values.placement, "bottom");
  const showDot = values.showDot !== false;
  const showShadow = values.showShadow !== false;

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const rect = safeRect(ctx.aspect);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Geometry (all local to the LEFT cap's center, which never moves). ---
  const pillH = Math.round(minDim * 0.076);
  const capR = pillH / 2;
  const padX = Math.round(pillH * 0.44);
  const dotR = Math.round(pillH * 0.15);
  const dotGap = showDot ? Math.round(pillH * 0.3) : 0;
  const dotBlock = showDot ? dotR * 2 + dotGap : 0;

  const TRACK = 0.004;
  const labelMax = Math.max(80, rect.width - pillH - padX * 2 - dotBlock);
  const labelSize = fitSize(fonts, label, "display", 600, Math.round(pillH * 0.42), labelMax, TRACK);
  const labelW = fonts.measure(label, {
    family: fonts.family("display"),
    weight: 600,
    size: labelSize,
    letterSpacing: labelSize * TRACK,
  });

  const contentStartX = -capR + padX;
  const contentW = dotBlock + labelW;
  const span = Math.max(pillH * 0.35, contentW + padX * 2 - pillH);
  const dotCX = contentStartX + dotR;
  const labelX = contentStartX + dotBlock;

  const cx = rect.x + capR;
  const cy =
    placement === "top"
      ? rect.y + capR
      : placement === "middle"
        ? rect.y + rect.height / 2
        : rect.y + rect.height - capR;

  const pill = new Container();
  pill.position.set(cx, cy);
  pill.alpha = 0;
  pill.scale.set(0);
  root.addChild(pill);

  // --- Surfaces: two soft shadow passes, then the pill fill. All three morph
  // on the same ease, so the shadow stays glued to the shape. ---
  const morphs: Morph[] = [];
  if (showShadow) {
    // Three thin passes rather than one thick one: the falloff ramps instead of
    // banding into a grey outline around the pill.
    morphs.push(
      morphPill(pillH, Math.round(minDim * 0.013), { color: "#000000", alpha: 0.045 }, Math.round(minDim * 0.011), true),
      morphPill(pillH, Math.round(minDim * 0.008), { color: "#000000", alpha: 0.05 }, Math.round(minDim * 0.007), true),
      morphPill(pillH, Math.round(minDim * 0.003), { color: "#000000", alpha: 0.055 }, Math.round(minDim * 0.003), true),
    );
  }
  morphs.push(morphPill(pillH, 0, { color: pillBg }, 0, false));
  for (const m of morphs) {
    pill.addChild(m.node);
    timeline
      .to(m.capR, { prop: "x", from: 0, to: span, start: EXPAND_START, duration: EXPAND_DUR, ease: outExpo })
      .to(m.mid, { prop: "scale.x", from: 0, to: span, start: EXPAND_START, duration: EXPAND_DUR, ease: outExpo });
  }

  // --- The seed: the accent dot the pill grows out of. It starts as the whole
  // cap and shrinks into the bullet as the pill widens (or fades away when the
  // bullet is switched off). ---
  const seed = new Graphics().circle(0, 0, capR).fill(accent);
  pill.addChild(seed);
  const seedScale = showDot ? dotR / capR : 0;
  timeline
    .to(seed, { prop: "scale.x", from: 1, to: seedScale, start: EXPAND_START, duration: EXPAND_DUR, ease: outExpo })
    .to(seed, { prop: "scale.y", from: 1, to: seedScale, start: EXPAND_START, duration: EXPAND_DUR, ease: outExpo })
    .to(seed, { prop: "x", from: 0, to: showDot ? dotCX : 0, start: EXPAND_START, duration: EXPAND_DUR, ease: outExpo });
  if (!showDot) {
    timeline.to(seed, {
      prop: "alpha",
      from: 1,
      to: 0,
      start: EXPAND_START + EXPAND_DUR * 0.45,
      duration: 0.4,
      ease: outQuad,
    });
  }

  // --- Label: arrives on the tail of the expansion, drifting the last few px. ---
  const labelText = makeText(fonts, {
    text: label,
    role: "display",
    weight: 600,
    size: labelSize,
    color: textColor,
    letterSpacing: labelSize * TRACK,
    anchor: { x: 0, y: 0.5 },
  });
  labelText.position.set(labelX, 0);
  labelText.alpha = 0;
  pill.addChild(labelText);
  timeline
    .to(labelText, { prop: "alpha", from: 0, to: 1, start: LABEL_START, duration: 0.55, ease: outQuad })
    .to(labelText, {
      prop: "x",
      from: labelX - minDim * 0.014,
      to: labelX,
      start: LABEL_START,
      duration: 0.85,
      ease: outQuint,
    });

  // --- Entrance: the dot eases open, no bounce. ---
  timeline
    .to(pill, { prop: "alpha", from: 0, to: 1, start: POP_START, duration: 0.35, ease: outQuad })
    .to(pill, { prop: "scale.x", from: 0, to: 1, start: POP_START, duration: 0.6, ease: outExpo })
    .to(pill, { prop: "scale.y", from: 0, to: 1, start: POP_START, duration: 0.6, ease: outExpo });

  return { timeline, duration: 4.0 };
}

export const pillExpand: TemplateDefinition = {
  id: "pill-expand",
  name: "Pill",
  tagline: "A small accent dot stretches sideways into a pill and the label fades in behind it.",
  category: "overlay",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 2.6,
  fontRoles: { label: "display" },
  palettes: PALETTES,
  fields: [
    { key: "label", type: "text", label: "Label", default: "Now streaming", maxLength: 34, shrinkToFit: true },
    {
      key: "placement",
      type: "select",
      label: "Placement",
      default: "bottom",
      options: [
        { value: "bottom", label: "Bottom" },
        { value: "middle", label: "Middle" },
        { value: "top", label: "Top" },
      ],
    },
    { key: "showDot", type: "toggle", label: "Bullet dot", default: true },
    { key: "showShadow", type: "toggle", label: "Soft shadow", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
