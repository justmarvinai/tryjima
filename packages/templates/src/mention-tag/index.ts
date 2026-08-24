import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  makeOutBack,
  outQuad,
  spring,
  shrinkToFit,
  safeRect,
  type BuiltTemplate,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";

const DEG = Math.PI / 180;
const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;

const PALETTES: Palette[] = [
  { id: "light", name: "Light", colors: { background: "#FFFFFF", textColor: "#101014", accent: "#FF4D1C" } },
  { id: "dark", name: "Dark", colors: { background: "#101014", textColor: "#FFFFFF", accent: "#FF4D1C" } },
  { id: "berry", name: "Berry", colors: { background: "#FFEEF6", textColor: "#3A0A28", accent: "#FF2E9E" } },
  { id: "grape-night", name: "Grape night", colors: { background: "#14101F", textColor: "#FFFFFF", accent: "#6B4FE0" } },
];

/** WCAG-2 relative luminance of a #rrggbb color (0..1). */
function relLuminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})/i.exec(hex.trim());
  if (!m) return 1;
  const n = parseInt(m[1]!, 16);
  const lin = (c: number): number => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
}
function contrastOf(l1: number, l2: number): number {
  return l1 >= l2 ? (l1 + 0.05) / (l2 + 0.05) : (l2 + 0.05) / (l1 + 0.05);
}
/** Whichever of near-black / white actually contrasts best against a fill (WCAG-checked, not assumed). */
function bestTextOn(bgHex: string): string {
  const L = relLuminance(bgHex);
  return contrastOf(L, 1) >= contrastOf(L, relLuminance("#101014")) ? "#FFFFFF" : "#101014";
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const onAccent = bestTextOn(accent);
  const showAvatar = values.showAvatar !== false;
  const handle = str(values.handle, "@friend");

  const bgRect = new Graphics().rect(0, 0, size.width, size.height).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();
  const minDim = Math.min(size.width, size.height);
  const safe = safeRect(ctx.aspect);
  const cx = size.width / 2;
  const cy = safe.y + safe.height / 2;

  const family = fonts.family("display");
  const measure = (s: string, sz: number): number => fonts.measure(s, { family, weight: 700, size: sz });

  const pillH = Math.round(minDim * 0.16);
  const avatarR = Math.round(pillH * 0.28);
  const fontBase = Math.round(pillH * 0.34);
  const padLeft = Math.round(pillH * 0.22);
  const padRight = Math.round(pillH * 0.28);
  const gapAT = Math.round(pillH * 0.18);
  const avatarSpace = showAvatar ? avatarR * 2 + gapAT : 0;

  const maxPillW = Math.min(safe.width * 0.88, minDim * 0.86);
  const maxTextW = Math.max(40, maxPillW - padLeft - avatarSpace - padRight);
  const fontSize = shrinkToFit(handle, measure, { maxWidth: maxTextW, baseSize: fontBase, minSize: Math.round(fontBase * 0.5) });
  const textW = measure(handle, fontSize);
  const pillW = padLeft + avatarSpace + textW + padRight;

  const chip = new Container();
  chip.addChild(new Graphics().roundRect(-pillW / 2, -pillH / 2, pillW, pillH, pillH / 2).fill(accent));

  let dot: Graphics | null = null;
  if (showAvatar) {
    const avatarX = -pillW / 2 + padLeft + avatarR;
    dot = new Graphics().circle(0, 0, avatarR).fill(textColor);
    dot.position.set(avatarX, 0);
    dot.scale.set(0);
    chip.addChild(dot);
  }

  const textX = -pillW / 2 + padLeft + avatarSpace;
  const handleText = makeText(fonts, { text: handle, role: "display", weight: 700, size: fontSize, color: onAccent, anchor: { x: 0, y: 0.5 } });
  handleText.position.set(textX, 0);
  chip.addChild(handleText);

  // Flies in from below with a rotational "flick" and pops on landing.
  const rotFrom = -10 * DEG;
  chip.position.set(cx, cy + 60);
  chip.alpha = 0;
  chip.scale.set(0.4);
  chip.rotation = rotFrom;
  root.addChild(chip);
  timeline
    .to(chip, { prop: "alpha", from: 0, to: 1, start: 0.08, duration: 0.28, ease: outQuad })
    .to(chip, { prop: "scale.x", from: 0.4, to: 1, start: 0.08, duration: 0.6, ease: spring(0.4) })
    .to(chip, { prop: "scale.y", from: 0.4, to: 1, start: 0.08, duration: 0.6, ease: spring(0.4) })
    .to(chip, { prop: "rotation", from: rotFrom, to: 0, start: 0.08, duration: 0.6, ease: spring(0.4) })
    .to(chip, { prop: "y", from: cy + 60, to: cy, start: 0.08, duration: 0.6, ease: spring(0.4) });

  // The avatar dot gets its own small bonus pop as the chip settles.
  if (dot) {
    timeline
      .to(dot, { prop: "scale.x", from: 0, to: 1, start: 0.3, duration: 0.4, ease: makeOutBack(2) })
      .to(dot, { prop: "scale.y", from: 0, to: 1, start: 0.3, duration: 0.4, ease: makeOutBack(2) });
  }

  return { timeline, duration: 3.6 };
}

export const mentionTag: TemplateDefinition = {
  id: "mention-tag",
  name: "Mention Tag",
  tagline: "An @mention chip flies in with an avatar dot and pops into place.",
  category: "social",
  aspects: ["9:16", "1:1", "4:5", "16:9"],
  defaultAspect: "9:16",
  loopable: false,
  posterTime: 2.2,
  palettes: PALETTES,
  fields: [
    { key: "handle", type: "text", label: "Handle", default: "@friend", maxLength: 24, shrinkToFit: true },
    { key: "showAvatar", type: "toggle", label: "Show avatar", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
