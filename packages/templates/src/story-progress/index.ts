import { Container, Graphics, Sprite } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  linear,
  spring,
  fitBox,
  safeRect,
  type BuiltTemplate,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
  type Values,
} from "@jima/engine";
import { makeIcon } from "../shared/icons";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const num = (v: unknown, fallback: number): number => (typeof v === "number" ? v : fallback);
const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

const PALETTES: Palette[] = [
  { id: "midnight", name: "Midnight", colors: { background: "#0E0E12", textColor: "#FFFFFF", accent: "#FF4D1C", imageBack: "#26262C" } },
  { id: "berry", name: "Berry", colors: { background: "#2A0820", textColor: "#FFFFFF", accent: "#FF2E9E", imageBack: "#3D1230" } },
  { id: "ocean-deep", name: "Ocean deep", colors: { background: "#08182C", textColor: "#FFFFFF", accent: "#38C7FF", imageBack: "#123049" } },
  { id: "forest", name: "Forest", colors: { background: "#0F1408", textColor: "#FFFFFF", accent: "#84CC16", imageBack: "#1C2410" } },
];

function segmentsOf(values: Values): number {
  return Math.round(clamp(num(values.segments, 5), 3, 7));
}

const PROGRESS_START = 0.3;
const SEG_DUR = 0.62;
const HOLD = 0.7;

function computeDuration(values: Values): number {
  return PROGRESS_START + segmentsOf(values) * SEG_DUR + HOLD;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, images } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#0E0E12"));
  const textColor = str(values.textColor, pc("textColor", "#FFFFFF"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const imageBack = pc("imageBack", "#26262C");

  const handle = str(values.handle, "@yourbrand");
  const timestamp = str(values.timestamp, "now");
  const caption = str(values.caption, "Swipe up to see more →");
  const N = segmentsOf(values);
  const showHeader = values.showHeader !== false;
  const showRing = values.avatarRing !== false;

  const bgRect = new Graphics().rect(0, 0, size.width, size.height).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();
  const minDim = Math.min(size.width, size.height);
  const safe = safeRect(ctx.aspect);
  const cx = size.width / 2;

  const margin = Math.round(minDim * 0.058);
  const topY = ctx.aspect === "9:16" ? 104 : Math.round(margin * 0.8);
  const segH = Math.max(5, minDim * 0.008);
  const contentW = size.width - margin * 2;
  const segGap = contentW * 0.014;
  const segW = (contentW - segGap * (N - 1)) / N;

  // --- Segmented progress bar: tracks are static chrome; each fill tweens
  // 0->1 in its own time slot, then holds full (JimaTimeline holds a finished
  // tween's `to`), so segments light up one-by-one exactly like a real story. ---
  for (let i = 0; i < N; i++) {
    const sx = margin + i * (segW + segGap);
    root.addChild(new Graphics().roundRect(sx, topY, segW, segH, segH / 2).fill({ color: textColor, alpha: 0.28 }));
  }
  for (let i = 0; i < N; i++) {
    const sx = margin + i * (segW + segGap);
    const fill = new Graphics().roundRect(0, 0, segW, segH, segH / 2).fill(textColor);
    fill.position.set(sx, topY);
    fill.scale.set(0, 1);
    root.addChild(fill);
    timeline.to(fill, { prop: "scale.x", from: 0, to: 1, start: PROGRESS_START + i * SEG_DUR, duration: SEG_DUR, ease: linear });
  }

  // --- Header: avatar ring + handle + timestamp ---
  const avatarR = minDim * 0.042;
  const headerY = topY + segH + avatarR + minDim * 0.03;
  const avatarX = margin + avatarR;

  if (showHeader) {
    const avatarHolder = new Container();
    avatarHolder.label = "avatar";
    avatarHolder.position.set(avatarX, headerY);
    const tex = images.image ?? null;
    if (tex) {
      const s = new Sprite(tex);
      s.anchor.set(0.5);
      const cover = (2 * avatarR) / Math.min(tex.width, tex.height);
      s.scale.set(cover);
      const mask = new Graphics().circle(0, 0, avatarR).fill(0xffffff);
      avatarHolder.addChild(s, mask);
      s.mask = mask;
    } else {
      avatarHolder.addChild(new Graphics().circle(0, 0, avatarR).fill(imageBack));
      avatarHolder.addChild(makeIcon("user", avatarR * 1.05, { color: "#8A8F9A" }));
    }
    if (showRing) {
      avatarHolder.addChild(new Graphics().circle(0, 0, avatarR).stroke({ color: accent, width: Math.max(2, avatarR * 0.1) }));
    }
    avatarHolder.scale.set(0);
    root.addChild(avatarHolder);
    timeline
      .to(avatarHolder, { prop: "scale.x", from: 0, to: 1, start: 0.12, duration: 0.55, ease: spring(0.45) })
      .to(avatarHolder, { prop: "scale.y", from: 0, to: 1, start: 0.12, duration: 0.55, ease: spring(0.45) });

    const handleSize = Math.round(minDim * 0.036);
    const handleX = avatarX + avatarR + minDim * 0.028;
    const handleText = makeText(fonts, { text: handle, role: "display", weight: 700, size: handleSize, color: textColor, anchor: { x: 0, y: 0.5 } });
    handleText.position.set(handleX, headerY);
    handleText.alpha = 0;
    root.addChild(handleText);

    const tsText = makeText(fonts, { text: ` · ${timestamp}`, role: "body", weight: 500, size: Math.round(handleSize * 0.8), color: textColor, anchor: { x: 0, y: 0.5 } });
    tsText.alpha = 0;
    tsText.position.set(handleX + handleText.width, headerY + handleSize * 0.02);
    root.addChild(tsText);

    timeline
      .to(handleText, { prop: "alpha", from: 0, to: 1, start: 0.3, duration: 0.4, ease: outQuad })
      .to(handleText, { prop: "y", from: headerY + 12, to: headerY, start: 0.3, duration: 0.5, ease: outExpo })
      .to(tsText, { prop: "alpha", from: 0, to: 0.72, start: 0.36, duration: 0.4, ease: outQuad });
  }

  // --- Caption: the frame's hero text, centered in the space below the
  // header and above the bottom platform-UI safe zone ---
  if (caption.length > 0) {
    const headerBottom = showHeader ? headerY + avatarR * 1.6 : topY + segH + minDim * 0.06;
    const areaTop = Math.max(safe.y, headerBottom);
    const areaBottom = safe.y + safe.height;
    const capCenterY = areaTop + Math.max(0, areaBottom - areaTop) / 2;

    const familyDisplay = fonts.family("display");
    const measureDisplay = (s: string, sz: number): number => fonts.measure(s, { family: familyDisplay, weight: 700, size: sz });
    const capBase = Math.round(minDim * 0.062);
    const capMaxW = safe.width * 0.86;
    const { fontSize: capSize, lines: capLines } = fitBox(caption, measureDisplay, {
      maxWidth: capMaxW,
      baseSize: capBase,
      minSize: Math.round(capBase * 0.55),
      maxLines: 2,
    });
    const capLH = Math.round(capSize * 1.18);
    const capText = makeText(fonts, {
      text: capLines.join("\n"),
      role: "display",
      weight: 700,
      size: capSize,
      color: textColor,
      anchor: 0.5,
      align: "center",
      lineHeight: capLH,
    });
    capText.position.set(cx, capCenterY + 26);
    capText.alpha = 0;
    root.addChild(capText);
    timeline
      .to(capText, { prop: "alpha", from: 0, to: 1, start: 0.55, duration: 0.5, ease: outQuad })
      .to(capText, { prop: "y", from: capCenterY + 26, to: capCenterY, start: 0.55, duration: 0.65, ease: outExpo });
  }

  return { timeline, duration: computeDuration(values) };
}

export const storyProgress: TemplateDefinition = {
  id: "story-progress",
  name: "Story Progress",
  tagline: "An Instagram-style story frame — segments fill one by one.",
  category: "social",
  aspects: ["9:16", "1:1", "4:5", "16:9"],
  defaultAspect: "9:16",
  loopable: false,
  posterTime: 3.4,
  estimateDuration: computeDuration,
  fontRoles: { handle: "display", caption: "display", timestamp: "body" },
  palettes: PALETTES,
  fields: [
    { key: "handle", type: "text", label: "Handle", default: "@yourbrand", maxLength: 24, shrinkToFit: true },
    { key: "timestamp", type: "text", label: "Timestamp", default: "now", maxLength: 12 },
    { key: "caption", type: "text", label: "Caption", default: "Swipe up to see more →", maxLength: 70, optional: true, shrinkToFit: true },
    { key: "image", type: "image", label: "Avatar image", default: "", optional: true },
    { key: "segments", type: "slider", label: "Segments", default: 5, min: 3, max: 7, step: 1 },
    { key: "showHeader", type: "toggle", label: "Header", default: true },
    { key: "avatarRing", type: "toggle", label: "Avatar ring", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
