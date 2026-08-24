import { Container, Graphics, Sprite, type Texture } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  makeInBack,
  spring,
  linear,
  safeRect,
  type Aspect,
  type BuiltTemplate,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { makeIcon, type IconName } from "../shared/icons";
import { radialGlowTexture } from "../shared/glow";

const DEG = Math.PI / 180;

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;

/** Rough perceived luminance of a #rrggbb color (0..1). */
function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 1;
  const n = parseInt(m[1]!, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/**
 * Mix a #rrggbb color toward white by `amt` (0..1). Used to derive the TV's
 * plastic bezel shade from the (user-editable) background so the frame always
 * reads as a distinct object, even if someone picks a custom background color.
 */
function lighten(hex: string, amt: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1]!, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const mix = (c: number) => Math.round(c + (255 - c) * amt);
  return `#${[mix(r), mix(g), mix(b)].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

const PALETTES: Palette[] = [
  { id: "crt-green", name: "CRT Green", colors: { background: "#0A0D0B", frameGlow: "#39FF6A", captionPill: "#DB3329", textColor: "#F2FBF4", imageBack: "#0F1C15" } },
  { id: "vhs-purple", name: "VHS Purple", colors: { background: "#0B0812", frameGlow: "#C24DFF", captionPill: "#D6335C", textColor: "#F6EFFF", imageBack: "#170F26" } },
  { id: "arcade-blue", name: "Arcade Blue", colors: { background: "#060B12", frameGlow: "#33D6FF", captionPill: "#D13F32", textColor: "#EAF6FF", imageBack: "#0B1620" } },
  { id: "amber-terminal", name: "Amber Terminal", colors: { background: "#120D06", frameGlow: "#FFB020", captionPill: "#D6392F", textColor: "#FFF3DE", imageBack: "#1D150A" } },
];

// Fixed, deterministic app-icon row — six bright, varied tile colors paired
// with a recognizable glyph each, like a phone's home-screen dock.
const ICON_ROW: { name: IconName; color: string }[] = [
  { name: "bolt", color: "#FF6B35" },
  { name: "star", color: "#FFC93C" },
  { name: "heart", color: "#FF3B7F" },
  { name: "play", color: "#2F8FFF" },
  { name: "bookmark", color: "#8B5CF6" },
  { name: "plane", color: "#22C55E" },
];

interface FrameLayout {
  cx: number;
  frameW: number;
  frameH: number;
  frameCy: number;
  dayY: number;
}

/** The TV frame's box + the "Day N" label slot beneath it, from the aspect's safe rect. */
function frameLayoutFor(aspect: Aspect): FrameLayout {
  const safe = safeRect(aspect);
  const frameHFrac = aspect === "16:9" ? 0.86 : aspect === "9:16" ? 0.72 : aspect === "4:5" ? 0.76 : 0.78;
  const ratio = aspect === "16:9" ? 0.68 : aspect === "9:16" ? 0.94 : aspect === "4:5" ? 0.94 : 0.9;
  const frameH = safe.height * frameHFrac;
  const frameW = Math.min(frameH * ratio, safe.width);
  const frameCy = safe.y + frameH / 2;
  const dayY = safe.y + frameH + (safe.height - frameH) / 2;
  return { cx: safe.x + safe.width / 2, frameW, frameH, frameCy, dayY };
}

/** Shrink a single-line display-weight size so `text` fits `maxWidth`. */
function fitOne(fonts: TemplateContext["fonts"], text: string, weight: number, size0: number, maxWidth: number): number {
  const wdt = fonts.measure(text, { family: fonts.family("display"), weight, size: size0 });
  if (wdt <= maxWidth || wdt === 0) return size0;
  return Math.max(14, Math.floor(size0 * (maxWidth / wdt)));
}

/** Faint translucent horizontal bands across a screen-sized rect. */
function drawScanlines(w: number, h: number): Graphics {
  const g = new Graphics();
  const step = Math.max(3, h * 0.02);
  for (let y = -h / 2; y < h / 2; y += step) {
    g.rect(-w / 2, y, w, Math.max(1, step * 0.4)).fill({ color: "#000000", alpha: 0.16 });
  }
  return g;
}

/** One rounded app-icon tile: soft shadow + bright fill + gloss cap + white glyph. */
function iconTile(sizePx: number, bg: string, name: IconName): Container {
  const c = new Container();
  const r = sizePx * 0.26;
  c.addChild(new Graphics().roundRect(-sizePx / 2, -sizePx / 2 + sizePx * 0.07, sizePx, sizePx, r).fill({ color: "#000000", alpha: 0.24 }));
  c.addChild(new Graphics().roundRect(-sizePx / 2, -sizePx / 2, sizePx, sizePx, r).fill(bg));
  c.addChild(new Graphics().roundRect(-sizePx / 2, -sizePx / 2, sizePx, sizePx * 0.34, sizePx * 0.2).fill({ color: "#FFFFFF", alpha: 0.2 }));
  c.addChild(makeIcon(name, sizePx * 0.52, { color: "#FFFFFF" }));
  return c;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, images } = ctx;
  const pcol = (key: string, d: string): string => palette.colors[key] ?? d;
  const bg = str(values.background, pcol("background", "#0A0D0B"));
  const frameGlow = str(values.frameGlow, pcol("frameGlow", "#39FF6A"));
  const captionPillColor = str(values.captionPill, pcol("captionPill", "#DB3329"));
  const textColor = str(values.textColor, pcol("textColor", "#F2FBF4"));
  const imageBack = str(values.imageBack, pcol("imageBack", "#0F1C15"));
  const caption = str(values.caption, "Stop Working Hard");
  const day = str(values.day, "Day 7");
  const showIcons = values.showIcons !== false;
  const showScanlines = values.showScanlines !== false;

  const w = size.width;
  const h = size.height;
  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();
  const DUR = 4.8;

  const L = frameLayoutFor(ctx.aspect);
  const { frameW, frameH } = L;
  const minFrame = Math.min(frameW, frameH);
  const bezelT = minFrame * 0.05;
  const frameR = minFrame * 0.075;
  const screenW = frameW - bezelT * 2;
  const screenH = frameH - bezelT * 2;
  const screenR = Math.max(2, frameR - bezelT * 0.6);
  const bezelColor = lighten(bg, 0.16);

  // --- The TV frame itself (bezel + glow + screen), as one animated unit ---
  const frameWrap = new Container();
  frameWrap.label = "tv-frame";
  frameWrap.position.set(L.cx, L.frameCy);
  frameWrap.alpha = 0;
  frameWrap.scale.set(0.96);
  root.addChild(frameWrap);
  timeline
    .to(frameWrap, { prop: "alpha", from: 0, to: 1, start: 0, duration: 0.3, ease: outQuad })
    .to(frameWrap, { prop: "scale.x", from: 0.96, to: 1, start: 0, duration: 0.45, ease: outQuad })
    .to(frameWrap, { prop: "scale.y", from: 0.96, to: 1, start: 0, duration: 0.45, ease: outQuad });

  // Soft glow halo behind the frame — breathes (alpha only) via update(t).
  const halo = new Sprite(radialGlowTexture());
  halo.anchor.set(0.5);
  halo.tint = frameGlow;
  halo.width = frameW * 1.55;
  halo.height = frameH * 1.55;
  halo.alpha = 0.3;
  frameWrap.addChild(halo);

  // Plastic bezel.
  frameWrap.addChild(new Graphics().roundRect(-frameW / 2, -frameH / 2, frameW, frameH, frameR).fill(bezelColor));

  // Glowing rim — redrawn every frame so it can breathe (width + alpha).
  const borderGlow = new Graphics();
  frameWrap.addChild(borderGlow);

  // Screen backdrop (visible behind a transparent image, or standing alone as
  // the placeholder background).
  frameWrap.addChild(new Graphics().roundRect(-screenW / 2, -screenH / 2, screenW, screenH, screenR).fill(imageBack));

  // Screen content — the subject image (or a placeholder) plus scanlines,
  // masked to the screen rect and revealed with a CRT "power on" unfold.
  const screenContent = new Container();
  frameWrap.addChild(screenContent);

  const imageHolder = new Container();
  screenContent.addChild(imageHolder);
  const tex: Texture | null = images.image ?? null;
  if (tex) {
    const sprite = new Sprite(tex);
    sprite.anchor.set(0.5);
    const cover = Math.max(screenW / tex.width, screenH / tex.height);
    sprite.scale.set(cover);
    imageHolder.addChild(sprite);
  } else {
    const minScreen = Math.min(screenW, screenH);
    const iconColor = luminance(imageBack) < 0.5 ? "#4E6156" : "#8A968F";
    imageHolder.addChild(new Graphics().circle(0, 0, minScreen * 0.32).fill({ color: frameGlow, alpha: 0.1 }));
    imageHolder.addChild(new Graphics().circle(0, 0, minScreen * 0.22).fill({ color: frameGlow, alpha: 0.16 }));
    imageHolder.addChild(makeIcon("user", minScreen * 0.3, { color: iconColor }));
  }
  // Gentle, continuous Ken-Burns creep on the subject (never fully idle).
  timeline
    .to(imageHolder, { prop: "scale.x", from: 1.0, to: 1.05, start: 0.2, duration: DUR - 0.2, ease: linear })
    .to(imageHolder, { prop: "scale.y", from: 1.0, to: 1.05, start: 0.2, duration: DUR - 0.2, ease: linear });

  if (showScanlines) {
    screenContent.addChild(drawScanlines(screenW, screenH));
  }

  // CRT power-on: the screen mask unfolds from a thin horizontal line.
  const screenMask = new Graphics().roundRect(-screenW / 2, -screenH / 2, screenW, screenH, screenR).fill(0xffffff);
  screenMask.scale.set(1, 0.04);
  frameWrap.addChild(screenMask);
  screenContent.mask = screenMask;
  timeline.to(screenMask, { prop: "scale.y", from: 0.04, to: 1, start: 0.22, duration: 0.42, ease: outExpo });

  // --- Top row: colorful app icons pop in, staggered ---
  if (showIcons) {
    const iconSize = screenW * 0.105;
    const gap = iconSize * 0.4;
    const rowW = ICON_ROW.length * iconSize + (ICON_ROW.length - 1) * gap;
    const rowX0 = -rowW / 2 + iconSize / 2;
    const rowY = -screenH / 2 + iconSize * 0.95;
    const tiles: Container[] = [];
    ICON_ROW.forEach((spec, i) => {
      const tile = iconTile(iconSize, spec.color, spec.name);
      tile.position.set(rowX0 + i * (iconSize + gap), rowY);
      tile.scale.set(0);
      tile.alpha = 0;
      frameWrap.addChild(tile);
      tiles.push(tile);
    });
    timeline
      .stagger(tiles, { prop: "alpha", from: 0, to: 1, start: 0.62, duration: 0.3, ease: outQuad }, { each: 0.085 })
      .stagger(tiles, { prop: "scale.x", from: 0, to: 1, start: 0.62, duration: 0.58, ease: spring(0.45) }, { each: 0.085 })
      .stagger(tiles, { prop: "scale.y", from: 0, to: 1, start: 0.62, duration: 0.58, ease: spring(0.45) }, { each: 0.085 });
  }

  // --- Caption pill: stamps in near the bottom of the screen ---
  const FINAL_ROT = -4 * DEG;
  const pillSize0 = Math.round(screenW * 0.078);
  const pillMaxW = screenW * 0.84;
  const pillSize = fitOne(fonts, caption, 700, pillSize0, pillMaxW);
  const pillLabel = makeText(fonts, { text: caption, role: "display", weight: 700, size: pillSize, color: "#FFFFFF", anchor: 0.5, align: "center" });
  const pillPadX = pillSize * 0.85;
  const pillPadY = pillSize * 0.6;
  const pillW = pillLabel.width + pillPadX * 2;
  const pillH = pillSize + pillPadY * 2;
  const pillCy = screenH / 2 - pillH * 0.85;

  const pillC = new Container();
  pillC.addChild(new Graphics().roundRect(-pillW / 2, -pillH / 2 + pillH * 0.06, pillW, pillH, pillH / 2).fill({ color: "#000000", alpha: 0.28 }));
  pillC.addChild(new Graphics().roundRect(-pillW / 2, -pillH / 2, pillW, pillH, pillH / 2).fill(captionPillColor));
  pillC.addChild(pillLabel);
  pillC.position.set(0, pillCy);
  pillC.rotation = -14 * DEG;
  pillC.scale.set(2.3);
  pillC.alpha = 0;
  frameWrap.addChild(pillC);

  const STAMP = 1.85;
  timeline
    .to(pillC, { prop: "alpha", from: 0, to: 1, start: STAMP, duration: 0.08, ease: outQuad })
    .to(pillC, { prop: "scale.x", from: 2.3, to: 1, start: STAMP, duration: 0.34, ease: makeInBack(1.7) })
    .to(pillC, { prop: "scale.y", from: 2.3, to: 1, start: STAMP, duration: 0.34, ease: makeInBack(1.7) })
    .to(pillC, { prop: "rotation", from: -14 * DEG, to: 6 * DEG, start: STAMP, duration: 0.2, ease: outExpo })
    .to(pillC, { prop: "rotation", from: 6 * DEG, to: -6 * DEG, start: STAMP + 0.2, duration: 0.1, ease: outQuad })
    .to(pillC, { prop: "rotation", from: -6 * DEG, to: -2 * DEG, start: STAMP + 0.3, duration: 0.1, ease: outQuad })
    .to(pillC, { prop: "rotation", from: -2 * DEG, to: FINAL_ROT, start: STAMP + 0.4, duration: 0.14, ease: outQuad });

  // --- "Day N" label, fades up below the frame ---
  const daySize0 = Math.round(Math.min(w, h) * 0.042);
  const daySize = fitOne(fonts, day, 700, daySize0, w * 0.84);
  const dayText = makeText(fonts, { text: day, role: "display", weight: 700, size: daySize, color: textColor, anchor: 0.5, align: "center", letterSpacing: 0.5 });
  const DAY_AT = STAMP + 0.55;
  dayText.position.set(L.cx, L.dayY + 18);
  dayText.alpha = 0;
  root.addChild(dayText);
  timeline
    .to(dayText, { prop: "alpha", from: 0, to: 1, start: DAY_AT, duration: 0.5, ease: outQuad })
    .to(dayText, { prop: "y", from: L.dayY + 18, to: L.dayY, start: DAY_AT, duration: 0.55, ease: outExpo });

  // --- Continuous: the border glow softly breathes (pure function of t) ---
  const GLOW_PERIOD = 2.3;
  const ringUnit = minFrame * 0.012;
  const update = (t: number): void => {
    const breathe = (Math.sin((t / GLOW_PERIOD) * Math.PI * 2) + 1) / 2; // 0..1
    halo.alpha = 0.3 + 0.22 * breathe;
    borderGlow.clear();
    borderGlow
      .roundRect(-frameW / 2, -frameH / 2, frameW, frameH, frameR)
      .stroke({ color: frameGlow, width: ringUnit * (3.4 + 1.2 * breathe), alpha: 0.1 + 0.06 * breathe });
    borderGlow
      .roundRect(-frameW / 2, -frameH / 2, frameW, frameH, frameR)
      .stroke({ color: frameGlow, width: ringUnit * (1.8 + 0.5 * breathe), alpha: 0.28 + 0.12 * breathe });
    borderGlow
      .roundRect(-frameW / 2, -frameH / 2, frameW, frameH, frameR)
      .stroke({ color: frameGlow, width: ringUnit * 0.9, alpha: 0.8 + 0.2 * breathe });
  };

  return { timeline, duration: DUR, update };
}

export const retroTv: TemplateDefinition = {
  id: "retro-tv",
  name: "Retro TV",
  tagline: "A glowing CRT frame powers on around your clip, app icons and a stamped caption.",
  category: "social",
  aspects: ["16:9", "1:1", "4:5", "9:16"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 3.4,
  palettes: PALETTES,
  fields: [
    { key: "image", type: "image", label: "Image", default: "", optional: true, help: "Fills the screen; a portrait or selfie-style photo works best." },
    { key: "caption", type: "text", label: "Caption", default: "Stop Working Hard", maxLength: 28, shrinkToFit: true },
    { key: "day", type: "text", label: "Day label", default: "Day 7", maxLength: 24 },
    { key: "showIcons", type: "toggle", label: "App icon row", default: true },
    { key: "showScanlines", type: "toggle", label: "Scanlines", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "frameGlow", type: "color", label: "Frame glow", default: "", optional: true },
    { key: "captionPill", type: "color", label: "Caption pill", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "imageBack", type: "color", label: "Image back", default: "", optional: true },
  ],
  build,
};
