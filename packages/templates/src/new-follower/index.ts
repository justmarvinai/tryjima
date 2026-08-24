import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  spring,
  safeRect,
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

const DEFAULT_HANDLES = ["@ava.codes", "@leo.design", "@mia.travels"];

// accent/onAccent pairs verified ≥4.5:1 for the "Follow back" chip text.
const PALETTES: Palette[] = [
  { id: "daylight", name: "Daylight", colors: { background: "#EEF1F6", cardBg: "#FFFFFF", textColor: "#101014", muted: "#6B7280", accent: "#1E56C4", onAccent: "#FFFFFF" } },
  { id: "midnight", name: "Midnight", colors: { background: "#0C0C10", cardBg: "#1C1C22", textColor: "#FFFFFF", muted: "#9098A6", accent: "#C2410C", onAccent: "#FFFFFF" } },
  { id: "mint", name: "Mint", colors: { background: "#E7F7EF", cardBg: "#FFFFFF", textColor: "#08221A", muted: "#4F6960", accent: "#0F7A55", onAccent: "#FFFFFF" } },
  { id: "blush", name: "Blush", colors: { background: "#FCEDF3", cardBg: "#FFFFFF", textColor: "#3A0A28", muted: "#8A6478", accent: "#B01D5C", onAccent: "#FFFFFF" } },
];

// A small fixed hue bank for avatar dots — purely decorative fills (no text
// sits on them), so they're free to vary independent of the palette.
const AVATAR_HUES = ["#1E56C4", "#6D28D9", "#0F7A55", "#C2410C", "#B01D5C"];

const ARRIVE_START = 0.2;
const ARRIVE_GAP = 0.55;
const SLIDE_DUR = 0.8;
const POP_EXTRA = 0.35;
const HOLD = 0.9;

function handlesOf(values: Values): string[] {
  return asItems(values.handles, DEFAULT_HANDLES).slice(0, 3);
}

function computeDuration(values: Values): number {
  const n = Math.max(2, handlesOf(values).length);
  const lastStart = ARRIVE_START + (n - 1) * ARRIVE_GAP;
  return lastStart + SLIDE_DUR + POP_EXTRA + HOLD;
}

/** Shrink a single-line size so `text` fits `maxWidth`. */
function fitOne(fonts: FontRegistry, text: string, role: FontRole, weight: number, size0: number, maxWidth: number): number {
  const wdt = fonts.measure(text, { family: fonts.family(role), weight, size: size0 });
  if (wdt <= maxWidth || wdt === 0) return size0;
  return Math.max(10, Math.floor(size0 * (maxWidth / wdt)));
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, rng } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#EEF1F6"));
  const cardBg = pc("cardBg", "#FFFFFF");
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const muted = pc("muted", "#6B7280");
  const accent = str(values.accent, pc("accent", "#1E56C4"));
  const onAccent = pc("onAccent", "#FFFFFF");

  const handles = handlesOf(values);
  const n = handles.length;
  const showFollowBack = values.showFollowBack !== false;

  const w = size.width;
  const h = size.height;
  const cx = w / 2;
  const minDim = Math.min(w, h);
  const safe = safeRect(ctx.aspect);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Toast card geometry ---
  const cardW = Math.min(safe.width * 0.92, minDim * 0.86);
  const cardH = Math.round(cardW * 0.245);
  const pad = Math.round(cardH * 0.2);
  const avatarR = cardH * 0.32;
  const cardR = cardH * 0.26;

  const chipLabel = "Follow back";
  const chipFontSize = Math.round(cardH * 0.18);
  const chipLabelWidth = fonts.measure(chipLabel, { family: fonts.family("display"), weight: 700, size: chipFontSize });
  const chipPadX = chipFontSize * 0.7;
  const chipW = showFollowBack ? chipLabelWidth + chipPadX * 2 : 0;
  const chipH = Math.round(cardH * 0.42);

  const handleLeft = -cardW / 2 + pad + avatarR * 2 + pad * 0.75;
  const rightBoundary = cardW / 2 - pad - (showFollowBack ? chipW + pad * 0.6 : 0);
  const handleFontBase = Math.round(cardH * 0.24);
  const handleMaxW = Math.max(handleFontBase * 2, rightBoundary - handleLeft);

  // --- Stack depth: newest (last handle) is the front/top card ---
  const PEEK = Math.round(minDim * 0.03);
  const SCALE_STEP = 0.05;
  const ALPHA_STEP = 0.2;
  const frontCy = safe.y + safe.height / 2;
  const dropDist = cardH * 2.6;

  handles.forEach((handleRaw, i) => {
    const depth = n - 1 - i; // 0 = front (newest/last to arrive)
    const restY = frontCy + depth * PEEK;
    const restScale = 1 - depth * SCALE_STEP;
    const restAlpha = Math.max(0.5, 1 - depth * ALPHA_STEP);
    const isFront = depth === 0;

    const toast = new Container();
    toast.label = i === n - 1 ? "toast-front" : "toast";
    root.addChild(toast);

    // Soft shadow.
    const e = cardH * 0.02;
    toast.addChild(
      new Graphics()
        .roundRect(-cardW / 2 - e, -cardH / 2 - e + cardH * 0.05, cardW + e * 2, cardH + e * 2, cardR + e)
        .fill({ color: "#000000", alpha: 0.14 }),
    );
    toast.addChild(new Graphics().roundRect(-cardW / 2, -cardH / 2, cardW, cardH, cardR).fill(cardBg));

    // Avatar dot.
    const avatarColor = rng.pick(AVATAR_HUES);
    const avatarX = -cardW / 2 + pad + avatarR;
    const avatarG = new Graphics().circle(avatarX, 0, avatarR).fill(avatarColor);
    toast.addChild(avatarG);
    toast.addChild(new Graphics().circle(avatarX, 0, avatarR).stroke({ color: cardBg, width: Math.max(2, avatarR * 0.1) }));

    // Handle.
    const handleSize = fitOne(fonts, handleRaw, "body", 700, handleFontBase, handleMaxW);
    const handleNode = makeText(fonts, { text: handleRaw, role: "body", weight: 700, size: handleSize, color: textColor, anchor: { x: 0, y: 0.5 } });
    handleNode.position.set(handleLeft, -cardH * 0.08);
    toast.addChild(handleNode);

    const subSize = Math.round(handleSize * 0.62);
    const subNode = makeText(fonts, { text: "started following you", role: "body", weight: 500, size: subSize, color: muted, anchor: { x: 0, y: 0.5 } });
    subNode.position.set(handleLeft, cardH * 0.2);
    toast.addChild(subNode);

    // Follow-back chip.
    if (showFollowBack) {
      const chip = new Container();
      chip.addChild(new Graphics().roundRect(-chipW / 2, -chipH / 2, chipW, chipH, chipH / 2).fill(accent));
      const label = makeText(fonts, { text: chipLabel, role: "display", weight: 700, size: chipFontSize, color: onAccent, anchor: 0.5 });
      chip.addChild(label);
      chip.position.set(cardW / 2 - pad - chipW / 2, 0);
      toast.addChild(chip);
    }

    // Highlight ring — only ever shown on the front toast's pop beat.
    const ring = new Graphics()
      .roundRect(-cardW / 2 - 6, -cardH / 2 - 6, cardW + 12, cardH + 12, cardR + 6)
      .stroke({ color: accent, width: Math.max(3, cardH * 0.025) });
    ring.alpha = 0;
    toast.addChild(ring);

    // --- Arrival: slides down from off-screen, settles into its stack slot ---
    const start = ARRIVE_START + i * ARRIVE_GAP;
    toast.position.set(cx, restY - dropDist);
    toast.alpha = 0;
    toast.scale.set(restScale * 0.9);
    timeline
      .to(toast, { prop: "alpha", from: 0, to: restAlpha, start, duration: 0.3, ease: outQuad })
      .to(toast, { prop: "y", from: restY - dropDist, to: restY, start, duration: SLIDE_DUR, ease: spring(0.55) })
      .to(toast, { prop: "scale.x", from: restScale * 0.9, to: restScale, start, duration: SLIDE_DUR, ease: spring(0.5) })
      .to(toast, { prop: "scale.y", from: restScale * 0.9, to: restScale, start, duration: SLIDE_DUR, ease: spring(0.5) });

    if (isFront) {
      const popAt = start + SLIDE_DUR;
      timeline
        .to(toast, { prop: "scale.x", from: restScale, to: restScale * 1.06, start: popAt, duration: 0.14, ease: outQuad })
        .to(toast, { prop: "scale.x", from: restScale * 1.06, to: restScale, start: popAt + 0.14, duration: 0.24, ease: outQuad })
        .to(toast, { prop: "scale.y", from: restScale, to: restScale * 1.06, start: popAt, duration: 0.14, ease: outQuad })
        .to(toast, { prop: "scale.y", from: restScale * 1.06, to: restScale, start: popAt + 0.14, duration: 0.24, ease: outQuad })
        .to(ring, { prop: "alpha", from: 0, to: 0.9, start: popAt, duration: 0.1, ease: outQuad })
        .to(ring, { prop: "alpha", from: 0.9, to: 0, start: popAt + 0.1, duration: 0.45, ease: outQuad })
        .to(ring, { prop: "scale.x", from: 1, to: 1.08, start: popAt, duration: 0.55, ease: outExpo })
        .to(ring, { prop: "scale.y", from: 1, to: 1.08, start: popAt, duration: 0.55, ease: outExpo });
    }
  });

  return { timeline, duration: computeDuration(values) };
}

export const newFollower: TemplateDefinition = {
  id: "new-follower",
  name: "New Follower",
  tagline: "New-follower toasts slide in from the top and stack — the latest pops.",
  category: "social",
  aspects: ["9:16", "1:1", "4:5", "16:9"],
  defaultAspect: "9:16",
  loopable: false,
  posterTime: 2.4,
  estimateDuration: computeDuration,
  fontRoles: { handles: "body" },
  palettes: PALETTES,
  fields: [
    { key: "handles", type: "textlist", label: "Handles", default: DEFAULT_HANDLES, minItems: 2, maxItems: 3, maxLength: 22 },
    { key: "showFollowBack", type: "toggle", label: "Follow-back chip", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
