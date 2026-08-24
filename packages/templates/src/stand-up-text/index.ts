import { Container, Graphics, type Text } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outCubic,
  outQuint,
  outExpo,
  makeOutBack,
  safeRect,
  type Aspect,
  type BuiltTemplate,
  type FontRegistry,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";

// Stand Up — the headline starts lying flat on the floor in fake perspective
// (compressed and sheared with skew + scale, feet planted on a stage line),
// then rises to face the camera while its cast shadow shrinks to a small
// contact puddle. A rise-from-the-ground perspective move — not a flip.

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;

const PALETTES: Palette[] = [
  { id: "gallery-white", name: "Gallery white", colors: { background: "#FFFFFF", textColor: "#17171C", accent: "#FF4D1C" } },
  { id: "cream-espresso", name: "Cream espresso", colors: { background: "#F6EFE3", textColor: "#2B1D12", accent: "#C96F2F" } },
  { id: "mint-forest", name: "Mint forest", colors: { background: "#E9F5EC", textColor: "#123B26", accent: "#17A05E" } },
  { id: "indigo-night", name: "Indigo night", colors: { background: "#151420", textColor: "#F2F0FF", accent: "#8B7CFF" } },
];

interface Layout {
  fontFrac: number; // of canvas width
  maxWidthFrac: number;
  floorFrac: number; // of safe-rect height — where the "floor" line sits
}

function layoutOf(aspect: Aspect): Layout {
  switch (aspect) {
    case "16:9":
      return { fontFrac: 0.095, maxWidthFrac: 0.72, floorFrac: 0.6 };
    case "9:16":
      return { fontFrac: 0.12, maxWidthFrac: 0.82, floorFrac: 0.56 };
    case "4:5":
      return { fontFrac: 0.115, maxWidthFrac: 0.8, floorFrac: 0.57 };
    case "1:1":
    default:
      return { fontFrac: 0.112, maxWidthFrac: 0.8, floorFrac: 0.58 };
  }
}

/** Greedy-wrap into <= 2 lines, then shrink so the widest line fits maxWidth. */
function wrapAndFit(
  fonts: FontRegistry,
  text: string,
  size0: number,
  maxWidth: number,
): { joined: string; size: number; width: number } {
  const family = fonts.family("display");
  const measure = (s: string, sz: number): number => fonts.measure(s, { family, weight: 700, size: sz });
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return { joined: "", size: size0, width: 0 };
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
  if (packed.length > 2) packed = [packed[0]!, packed.slice(1).join(" ")];
  let size = size0;
  let widest = 0;
  for (let guard = 0; guard < 8; guard++) {
    widest = Math.max(...packed.map((l) => measure(l, size)));
    if (widest <= maxWidth || widest === 0) break;
    size = Math.max(14, Math.floor(size * (maxWidth / widest)));
  }
  return { joined: packed.join("\n"), size, width: widest };
}

// Flat-on-the-floor pose (fake perspective) and its resting values.
const FLAT_SCALE_Y = 0.3;
const FLAT_SKEW = 0.55;
const SHADOW_FLAT_LEN = 0.5;
const SHADOW_END_LEN = 0.13;
const RISE_AT = 0.75;
const RISE_DUR = 0.95;
const DURATION = 4.0;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#17171C"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const headline = str(values.headline, "Stand for something");
  const subline = typeof values.subline === "string" ? values.subline : "";
  const showStage = on(values.showStage);

  const w = size.width;
  const h = size.height;
  const zone = safeRect(ctx.aspect);
  const L = layoutOf(ctx.aspect);
  const cx = w / 2;
  const floorY = zone.y + zone.height * L.floorFrac;

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const { joined, size: fs, width: blockW } = wrapAndFit(fonts, headline, Math.round(w * L.fontFrac), zone.width * L.maxWidthFrac);
  const lineHeight = Math.round(fs * 1.05);
  const timeline = new JimaTimeline();

  // The whole lockup lives in one container so the "weight lands" dip can
  // nudge everything together.
  const content = new Container();
  content.label = "content";
  root.addChild(content);

  const makeCopy = (color: string): Text =>
    makeText(fonts, {
      text: joined,
      role: "display",
      weight: 700,
      size: fs,
      color,
      align: "center",
      anchor: { x: 0.5, y: 1 },
      lineHeight,
    });

  // --- Stage line the text stands on (decorative) ---
  if (showStage) {
    const stageW = Math.min(blockW * 1.14, zone.width);
    const stageH = Math.max(4, fs * 0.09);
    const stage = new Graphics().roundRect(-stageW / 2, -stageH / 2, stageW, stageH, stageH / 2).fill(accent);
    stage.position.set(cx, floorY + fs * 0.12);
    stage.scale.set(0, 1);
    content.addChild(stage);
    timeline.to(stage, { prop: "scale.x", from: 0, to: 1, start: 0.15, duration: 0.5, ease: outExpo });
  }

  // --- Cast shadow: mirrored below the floor line, shrinking as it rises ---
  const shadow = makeCopy(textColor);
  shadow.position.set(cx, floorY + fs * 0.07);
  shadow.scale.y = -SHADOW_FLAT_LEN; // negative = mirrored downward
  shadow.skew.x = -0.62;
  shadow.alpha = 0;
  content.addChild(shadow);
  timeline
    .to(shadow, { prop: "alpha", from: 0, to: 0.28, start: 0.1, duration: 0.35, ease: outQuad })
    .to(shadow, { prop: "alpha", from: 0.28, to: 0.14, start: RISE_AT, duration: RISE_DUR, ease: outQuint })
    .to(shadow, { prop: "scale.y", from: -SHADOW_FLAT_LEN, to: -SHADOW_END_LEN, start: RISE_AT, duration: RISE_DUR, ease: outQuint })
    .to(shadow, { prop: "skew.x", from: -0.62, to: -0.18, start: RISE_AT, duration: RISE_DUR - 0.05, ease: outQuint });

  // --- The headline: flat in perspective, then standing up to camera ---
  const main = makeCopy(textColor);
  main.position.set(cx, floorY);
  main.scale.y = FLAT_SCALE_Y;
  main.skew.x = FLAT_SKEW;
  main.alpha = 0;
  content.addChild(main);
  timeline
    .to(main, { prop: "alpha", from: 0, to: 0.85, start: 0.1, duration: 0.32, ease: outQuad })
    .to(main, { prop: "alpha", from: 0.85, to: 1, start: RISE_AT, duration: 0.45, ease: outQuad })
    .to(main, { prop: "scale.y", from: FLAT_SCALE_Y, to: 1, start: RISE_AT, duration: RISE_DUR, ease: makeOutBack(1.35) })
    .to(main, { prop: "skew.x", from: FLAT_SKEW, to: 0, start: RISE_AT, duration: RISE_DUR - 0.05, ease: outQuint });

  // A tiny full-frame dip as the headline snaps upright — the weight lands.
  timeline
    .to(content, { prop: "y", from: 0, to: fs * 0.05, start: 1.42, duration: 0.1, ease: outQuad })
    .to(content, { prop: "y", from: fs * 0.05, to: 0, start: 1.52, duration: 0.34, ease: outCubic });

  // --- Subline fades in under the stage ---
  if (subline.length > 0) {
    const subSize = Math.max(15, Math.round(fs * 0.19));
    const subY = floorY + fs * 0.68;
    const sub = makeText(fonts, {
      text: subline,
      role: "body",
      weight: 500,
      size: subSize,
      color: textColor,
      anchor: { x: 0.5, y: 0 },
    });
    sub.position.set(cx, subY);
    sub.alpha = 0;
    content.addChild(sub);
    timeline
      .to(sub, { prop: "alpha", from: 0, to: 0.9, start: 2.15, duration: 0.5, ease: outQuad })
      .to(sub, { prop: "y", from: subY + 14, to: subY, start: 2.15, duration: 0.55, ease: outQuint });
  }

  return { timeline, duration: DURATION };
}

export const standUpText: TemplateDefinition = {
  id: "stand-up-text",
  name: "Stand Up",
  tagline: "The headline rises off the floor to face the camera, shadow and all.",
  category: "statement",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 3.2,
  fontRoles: { headline: "display", subline: "body" },
  palettes: PALETTES,
  fields: [
    { key: "headline", type: "text", label: "Headline", default: "Stand for something", maxLength: 36, shrinkToFit: true },
    { key: "subline", type: "text", label: "Subline", default: "Rise above the feed", maxLength: 52, optional: true },
    { key: "showStage", type: "toggle", label: "Stage line", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Stage line", default: "", optional: true },
  ],
  build,
};
