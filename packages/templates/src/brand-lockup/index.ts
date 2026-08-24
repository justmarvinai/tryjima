import { Container, Graphics, Sprite } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  makeOutBack,
  outQuad,
  outQuint,
  outExpo,
  safeZone,
  type BuiltTemplate,
  type FontRegistry,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { ICON_NAMES, makeIcon, type IconName } from "../shared/icons";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;

const PALETTES: Palette[] = [
  { id: "ink-white", name: "Ink on white", colors: { background: "#FFFFFF", textColor: "#101014", accent: "#FF4D1C", onAccent: "#FFFFFF" } },
  { id: "graphite-mint", name: "Graphite + mint", colors: { background: "#14171A", textColor: "#FFFFFF", accent: "#4FE0B3", onAccent: "#14171A" } },
  { id: "cream-indigo", name: "Cream + indigo", colors: { background: "#F6F1E4", textColor: "#2A2260", accent: "#5B4FE0", onAccent: "#FFFFFF" } },
  { id: "blush-noir", name: "Blush + noir", colors: { background: "#FFEFEA", textColor: "#2B1210", accent: "#E0475B", onAccent: "#FFFFFF" } },
];

/** Greedy-wrap into <= maxLines lines (display, weight 700), shrinking so the widest line fits. */
function wrapAndFit(
  fonts: FontRegistry,
  text: string,
  size0: number,
  maxWidth: number,
  maxLines: number,
): { lines: string[]; size: number } {
  const family = fonts.family("display");
  const measure = (s: string, sz: number): number => fonts.measure(s, { family, weight: 700, size: sz });
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
    size = Math.max(16, Math.floor(size * (maxWidth / widest)));
  }
  return { lines: packed, size };
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, images } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const onAccent = pc("onAccent", "#FFFFFF");

  const brand = str(values.brand, "Your Brand");
  const tagline = str(values.tagline, "Motion, made simple.");
  const markIconName = str(values.markIcon, "bolt") as IconName;
  const showTagline = on(values.showTagline);

  const W = size.width;
  const H = size.height;
  const minDim = Math.min(W, H);
  const cx = W / 2;
  const cy = H * 0.42;
  const DUR = 3.8;

  // --- Background (full-frame, first child so transparent export can blank it) ---
  const bgRect = new Graphics().rect(-W / 2, -H / 2, W, H).fill(bg);
  bgRect.position.set(W / 2, H / 2);
  bgRect.label = "bg";
  bgRect.scale.set(1.02);
  root.addChild(bgRect);

  const timeline = new JimaTimeline();
  timeline
    .to(bgRect, { prop: "scale.x", from: 1.02, to: 1, start: 0, duration: 0.4, ease: outQuad })
    .to(bgRect, { prop: "scale.y", from: 1.02, to: 1, start: 0, duration: 0.4, ease: outQuad });

  const zone = safeZone(ctx.aspect);
  const safeW = W - zone.left - zone.right;

  const markSize = minDim * 0.2;
  const gapMW = minDim * 0.05;
  const joinX = cx;
  const markCenterX = joinX - gapMW / 2 - markSize / 2;
  const wordmarkLeftX = joinX + gapMW / 2;

  // --- Wordmark (shrink-to-fit the space remaining beside the mark) ---
  const maxWordmarkWidth = Math.max(minDim * 0.3, safeW - markSize - gapMW - minDim * 0.02);
  const size0 = Math.round(minDim * 0.1);
  const { lines, size: wordmarkSize } = wrapAndFit(fonts, brand, size0, maxWordmarkWidth, 2);
  const wordmarkLH = Math.round(wordmarkSize * 1.08);
  const wordmarkText = makeText(fonts, {
    text: lines.join("\n"),
    role: "display",
    weight: 700,
    size: wordmarkSize,
    color: textColor,
    anchor: { x: 0, y: 0.5 },
    align: "left",
    lineHeight: wordmarkLH,
  });

  const slideDist = W * 0.32;
  const SLIDE_START = 0.15;
  const SLIDE_DUR = 0.6;
  const JOIN_T = SLIDE_START + SLIDE_DUR;

  // --- Mark: a badge holding either an uploaded logo or a chosen icon ---
  const markHolder = new Container();
  const badgeR = markSize * 0.26;
  const badge = new Graphics().roundRect(-markSize / 2, -markSize / 2, markSize, markSize, badgeR).fill(accent);
  markHolder.addChild(badge);

  const logoTex = images.logo ?? null;
  if (logoTex) {
    const sprite = new Sprite(logoTex);
    sprite.anchor.set(0.5);
    const inner = markSize * 0.68;
    const cover = inner / Math.min(logoTex.width, logoTex.height);
    sprite.scale.set(cover);
    const maskG = new Graphics().roundRect(-markSize / 2, -markSize / 2, markSize, markSize, badgeR).fill(0xffffff);
    markHolder.addChild(sprite, maskG);
    sprite.mask = maskG;
  } else {
    markHolder.addChild(makeIcon(markIconName, markSize * 0.52, { color: onAccent, holeColor: accent }));
  }

  markHolder.position.set(markCenterX - slideDist, cy);
  markHolder.alpha = 0;
  root.addChild(markHolder);
  timeline
    .to(markHolder, { prop: "alpha", from: 0, to: 1, start: SLIDE_START, duration: 0.4, ease: outQuad })
    .to(markHolder, { prop: "x", from: markCenterX - slideDist, to: markCenterX, start: SLIDE_START, duration: SLIDE_DUR, ease: makeOutBack(1.25) });

  // --- Wordmark: slides in from the right ---
  wordmarkText.position.set(wordmarkLeftX + slideDist, cy);
  wordmarkText.alpha = 0;
  root.addChild(wordmarkText);
  timeline
    .to(wordmarkText, { prop: "alpha", from: 0, to: 1, start: SLIDE_START, duration: 0.4, ease: outQuad })
    .to(wordmarkText, { prop: "x", from: wordmarkLeftX + slideDist, to: wordmarkLeftX, start: SLIDE_START, duration: SLIDE_DUR, ease: makeOutBack(1.25) });

  // --- The "lock": a flash + a vertical line sweep right at the join ---
  const rowHalfH = Math.max(markSize / 2, wordmarkText.height / 2);
  const joinLineH = rowHalfH * 1.5;
  const joinLine = new Graphics().roundRect(-1.5, -joinLineH / 2, 3, joinLineH, 1.5).fill(accent);
  joinLine.position.set(joinX, cy);
  joinLine.scale.set(1, 0);
  joinLine.alpha = 0;
  root.addChild(joinLine);
  timeline
    .to(joinLine, { prop: "alpha", from: 0, to: 0.9, start: JOIN_T, duration: 0.05, ease: outQuad })
    .to(joinLine, { prop: "scale.y", from: 0, to: 1, start: JOIN_T, duration: 0.16, ease: outQuad })
    .to(joinLine, { prop: "alpha", from: 0.9, to: 0, start: JOIN_T + 0.18, duration: 0.4, ease: outQuad });

  const flash = new Graphics().circle(0, 0, markSize * 0.16).fill(accent);
  flash.position.set(joinX, cy);
  flash.scale.set(0.6);
  flash.alpha = 0;
  root.addChild(flash);
  timeline
    .to(flash, { prop: "alpha", from: 0, to: 0.85, start: JOIN_T, duration: 0.05, ease: outQuad })
    .to(flash, { prop: "alpha", from: 0.85, to: 0, start: JOIN_T + 0.05, duration: 0.45, ease: outQuad })
    .to(flash, { prop: "scale.x", from: 0.6, to: 2.4, start: JOIN_T, duration: 0.5, ease: outExpo })
    .to(flash, { prop: "scale.y", from: 0.6, to: 2.4, start: JOIN_T, duration: 0.5, ease: outExpo });

  // --- Tagline + a growing underline (optional) ---
  if (showTagline && tagline.length > 0) {
    const leftX = markCenterX - markSize / 2;
    const rightX = wordmarkLeftX + wordmarkText.width;
    const midX = (leftX + rightX) / 2;

    let tagSize = Math.round(wordmarkSize * 0.26);
    const tagMaxWidth = 2 * Math.max(40, Math.min(midX - zone.left, W - zone.right - midX));
    const tagFamily = fonts.family("body");
    const tagWidth0 = fonts.measure(tagline, { family: tagFamily, weight: 500, size: tagSize, letterSpacing: 1 });
    if (tagWidth0 > tagMaxWidth) tagSize = Math.max(10, Math.floor(tagSize * (tagMaxWidth / tagWidth0)));
    const tagY = cy + rowHalfH + tagSize * 1.5;
    const tagYFrom = tagY + 14;
    const tagText = makeText(fonts, { text: tagline, role: "body", weight: 500, size: tagSize, color: textColor, anchor: 0.5, align: "center", letterSpacing: 1 });
    tagText.position.set(midX, tagYFrom);
    tagText.alpha = 0;
    root.addChild(tagText);
    const TAG_START = JOIN_T + 0.35;
    timeline
      .to(tagText, { prop: "alpha", from: 0, to: 1, start: TAG_START, duration: 0.45, ease: outQuad })
      .to(tagText, { prop: "y", from: tagYFrom, to: tagY, start: TAG_START, duration: 0.5, ease: outQuint });

    const ulW = Math.max(tagText.width * 0.9, tagSize * 3);
    const ulH = Math.max(2, Math.round(tagSize * 0.09));
    const underline = new Graphics().roundRect(0, 0, ulW, ulH, ulH / 2).fill(accent);
    underline.position.set(midX - ulW / 2, tagY + tagSize * 0.9);
    underline.scale.set(0, 1);
    root.addChild(underline);
    timeline.to(underline, { prop: "scale.x", from: 0, to: 1, start: TAG_START + 0.25, duration: 0.45, ease: outExpo });
  }

  return { timeline, duration: DUR };
}

export const brandLockup: TemplateDefinition = {
  id: "brand-lockup",
  name: "Brand Lockup",
  tagline: "A mark and wordmark slide in from opposite sides and lock at center.",
  category: "brand",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 2.7,
  fontRoles: { brand: "display", tagline: "body" },
  palettes: PALETTES,
  fields: [
    { key: "brand", type: "text", label: "Wordmark", default: "Your Brand", maxLength: 24, shrinkToFit: true },
    { key: "tagline", type: "text", label: "Tagline", default: "Motion, made simple.", maxLength: 40, optional: true },
    {
      key: "markIcon",
      type: "select",
      label: "Mark icon",
      default: "bolt",
      options: ICON_NAMES.map((n) => ({ value: n, label: n.charAt(0).toUpperCase() + n.slice(1) })),
    },
    { key: "logo", type: "image", label: "Logo (optional)", default: "", optional: true, help: "Transparent PNG. Replaces the icon in the mark badge." },
    { key: "showTagline", type: "toggle", label: "Tagline", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
