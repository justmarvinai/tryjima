import { Container, Graphics, Sprite } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  inQuad,
  linear,
  outExpo,
  outQuad,
  outQuint,
  safeRect,
  type Aspect,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { verticalScrimTexture } from "../shared/scrim";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;

function fitSize(fonts: FontRegistry, text: string, role: FontRole, weight: number, size: number, maxWidth: number): number {
  if (text.length === 0 || maxWidth <= 0) return size;
  const w = fonts.measure(text, { family: fonts.family(role), weight, size });
  return w > maxWidth ? Math.max(11, Math.floor((size * maxWidth) / w)) : size;
}

/** One corner bracket: two bars meeting at (x, y), arms extending sx/sy. */
function bracket(x: number, y: number, sx: number, sy: number, len: number, th: number, color: string): Graphics {
  const g = new Graphics();
  g.rect(sx > 0 ? x : x - len, sy > 0 ? y : y - th, len, th).fill(color);
  g.rect(sx > 0 ? x : x - th, sy > 0 ? y : y - len, th, len).fill(color);
  return g;
}

// An editorial photo-flash montage: three full-frame photo-placeholder plates
// punch in on a fast rhythm with a white flash and a shutter-bar blink between
// cuts, then the title card lands on a final flash and holds. Exactly three
// flashes, 0.6s apart (no strobe abuse). End frame is title-on-background.
const PALETTES: Palette[] = [
  { id: "editorial", name: "Editorial", colors: { background: "#F6F3EE", textColor: "#221D16", accent: "#D95F2B", photo1: "#E3B587", photo2: "#8FA8BD", photo3: "#C98B9B" } },
  { id: "gallery", name: "Gallery", colors: { background: "#F2F4F7", textColor: "#131A24", accent: "#2E66D8", photo1: "#9FB6D6", photo2: "#C9CFDA", photo3: "#7E93B8" } },
  { id: "sunset-roll", name: "Sunset roll", colors: { background: "#FBF2EA", textColor: "#2A160C", accent: "#E0603C", photo1: "#EFA663", photo2: "#E27D57", photo3: "#B65A4E" } },
  { id: "darkroom", name: "Darkroom", colors: { background: "#16141A", textColor: "#F4F1EA", accent: "#E8574F", photo1: "#3A3F52", photo2: "#54455C", photo3: "#2E4A4E" } },
];

function titleFrac(aspect: Aspect): number {
  return aspect === "16:9" ? 0.082 : aspect === "9:16" ? 0.108 : 0.098;
}

const CUTS = [0.35, 0.95, 1.55, 2.15] as const; // frame1, frame2, frame3, title card
const FLASHES = [0.95, 1.55, 2.15] as const; // exactly 3, 0.6s apart
const DURATION = 4.0;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, rng } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F6F3EE"));
  const textColor = str(values.textColor, pc("textColor", "#221D16"));
  const accent = str(values.accent, pc("accent", "#D95F2B"));
  const photoCols = [pc("photo1", "#E3B587"), pc("photo2", "#8FA8BD"), pc("photo3", "#C98B9B")];
  const title = str(values.title, "New Season");
  const subtitle = str(values.subtitle, "shot on location");
  const showMarks = on(values.showMarks);
  const showTags = on(values.showTags);

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const cx = w / 2;
  const cy = h / 2;
  const zone = safeRect(ctx.aspect);
  const cardCy = zone.y + zone.height * 0.46;

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Pre-roll: focus brackets on the empty stage (decorative) ---
  if (showMarks) {
    const focus = new Container();
    focus.position.set(cx, cardCy);
    focus.alpha = 0;
    const fs = minDim * 0.24;
    const fl = fs * 0.22;
    const fth = Math.max(3, minDim * 0.004);
    focus.addChild(bracket(-fs / 2, -fs / 2, 1, 1, fl, fth, accent));
    focus.addChild(bracket(fs / 2, -fs / 2, -1, 1, fl, fth, accent));
    focus.addChild(bracket(-fs / 2, fs / 2, 1, -1, fl, fth, accent));
    focus.addChild(bracket(fs / 2, fs / 2, -1, -1, fl, fth, accent));
    focus.addChild(new Graphics().circle(0, 0, Math.max(4, minDim * 0.006)).fill(accent));
    root.addChild(focus);
    timeline
      .to(focus, { prop: "alpha", from: 0, to: 0.7, start: 0.06, duration: 0.16, ease: outQuad })
      .to(focus, { prop: "alpha", from: 0.7, to: 0, start: 0.3, duration: 0.08, ease: outQuad });
  }

  // --- Three photo-placeholder plates, hard-cut on the beat ---
  const scrimTex = verticalScrimTexture();
  for (let i = 0; i < 3; i++) {
    const ph = new Container();
    ph.position.set(cx, cy);
    ph.alpha = 0;
    root.addChild(ph);

    const col = photoCols[i]!;
    ph.addChild(new Graphics().rect(-w / 2, -h / 2, w, h).fill(col));

    // Abstract tone-on-tone composition (varies per plate, seeded jitter).
    if (i === 0) {
      const jx = w * rng.range(-0.04, 0.04);
      const jy = h * rng.range(-0.03, 0.03);
      ph.addChild(new Graphics().circle(w * 0.16 + jx, -h * 0.1 + jy, minDim * 0.42).fill({ color: "#FFFFFF", alpha: 0.2 }));
      ph.addChild(new Graphics().circle(-w * 0.22, h * 0.16, minDim * 0.16).fill({ color: "#000000", alpha: 0.12 }));
    } else if (i === 1) {
      const band = new Container();
      band.rotation = 0.55 + rng.range(-0.1, 0.1);
      band.addChild(new Graphics().rect(-w, -minDim * 0.1, 2 * w, minDim * 0.2).fill({ color: "#FFFFFF", alpha: 0.18 }));
      band.addChild(new Graphics().rect(-w, minDim * 0.16, 2 * w, minDim * 0.07).fill({ color: "#000000", alpha: 0.1 }));
      ph.addChild(band);
    } else {
      const ox = w * rng.range(-0.1, 0.1);
      const oy = h * rng.range(-0.08, 0.08);
      const rings = new Graphics();
      for (const rr of [0.16, 0.28, 0.4]) {
        rings.circle(ox, oy, minDim * rr).stroke({ color: "#FFFFFF", alpha: 0.2, width: minDim * 0.014 });
      }
      ph.addChild(rings);
    }

    // Photographic top/bottom scrims.
    const sc = h * 0.38;
    const bot = new Sprite(scrimTex);
    bot.tint = "#000000";
    bot.alpha = 0.26;
    bot.position.set(-w / 2, h / 2 - sc);
    bot.width = w;
    bot.height = sc;
    ph.addChild(bot);
    const topS = new Sprite(scrimTex);
    topS.tint = "#000000";
    topS.alpha = 0.26;
    topS.width = w;
    topS.height = sc;
    topS.position.set(-w / 2, -h / 2 + sc);
    topS.scale.y = -topS.scale.y;
    ph.addChild(topS);

    // Corner index tag (kept inside the safe zone).
    if (showTags) {
      const tagText = makeText(fonts, { text: `0${i + 1}`, role: "mono", weight: 600, size: minDim * 0.026, color: "#FFFFFF", anchor: 0.5 });
      const tp = minDim * 0.024;
      const chipW = tagText.width + tp * 2;
      const chipH = tagText.height + tp * 1.1;
      const chip = new Container();
      chip.position.set(zone.x - cx + chipW / 2 + tp, zone.y - cy + chipH / 2 + tp);
      chip.addChild(new Graphics().roundRect(-chipW / 2, -chipH / 2, chipW, chipH, chipH * 0.28).fill({ color: "#101014", alpha: 0.85 }));
      chip.addChild(tagText);
      ph.addChild(chip);
    }

    // Hard cut on, hard cut off, with a punch-in.
    const at = CUTS[i]!;
    const off = CUTS[i + 1]!;
    timeline
      .to(ph, { prop: "alpha", from: 0, to: 1, start: at, duration: 0 })
      .to(ph, { prop: "alpha", from: 1, to: 0, start: off, duration: 0 })
      .to(ph, { prop: "scale.x", from: 1.07, to: 1, start: at, duration: 0.45, ease: outQuint })
      .to(ph, { prop: "scale.y", from: 1.07, to: 1, start: at, duration: 0.45, ease: outQuint });
  }

  // --- Title card (on the plain background) ---
  const maxW = zone.width * (ctx.aspect === "16:9" ? 0.6 : 0.84);
  const titleSize = fitSize(fonts, title, "display", 700, Math.round(w * titleFrac(ctx.aspect)), maxW);
  const hasSub = subtitle.length > 0;
  const subSize = Math.round(titleSize * 0.28);
  const lineGap = subSize * 1.05;
  const totalH = titleSize + (hasSub ? lineGap + subSize : 0);
  const tCut = CUTS[3]!;

  const titleY = cardCy - totalH / 2 + titleSize / 2;
  const titleText = makeText(fonts, { text: title, role: "display", weight: 700, size: titleSize, color: textColor, anchor: 0.5, align: "center" });
  titleText.position.set(cx, titleY);
  titleText.alpha = 0;
  titleText.scale.set(1.45);
  root.addChild(titleText);
  timeline
    .to(titleText, { prop: "alpha", from: 0, to: 1, start: tCut + 0.02, duration: 0.1, ease: outQuad })
    .to(titleText, { prop: "scale.x", from: 1.45, to: 1, start: tCut + 0.02, duration: 0.4, ease: outExpo })
    .to(titleText, { prop: "scale.y", from: 1.45, to: 1, start: tCut + 0.02, duration: 0.4, ease: outExpo });

  let subW = 0;
  if (hasSub) {
    const subY = cardCy + totalH / 2 - subSize / 2;
    const subText = makeText(fonts, { text: subtitle, role: "body", weight: 500, size: subSize, color: textColor, anchor: 0.5, align: "center", letterSpacing: 2 });
    subW = subText.width;
    subText.position.set(cx, subY + 14);
    subText.alpha = 0;
    root.addChild(subText);
    timeline
      .to(subText, { prop: "alpha", from: 0, to: 0.82, start: tCut + 0.35, duration: 0.4, ease: outQuad })
      .to(subText, { prop: "y", from: subY + 14, to: subY, start: tCut + 0.35, duration: 0.45, ease: outQuint });
  }

  // Crop marks framing the title lockup (decorative).
  if (showMarks) {
    const marks = new Container();
    marks.position.set(cx, cardCy);
    marks.alpha = 0;
    marks.scale.set(1.08);
    const pad = minDim * 0.05;
    const bw = Math.min(maxW, Math.max(titleText.width, subW)) + pad * 2;
    const bh = totalH + pad * 2;
    const ml = minDim * 0.04;
    const mth = Math.max(3, minDim * 0.005);
    marks.addChild(bracket(-bw / 2, -bh / 2, 1, 1, ml, mth, accent));
    marks.addChild(bracket(bw / 2, -bh / 2, -1, 1, ml, mth, accent));
    marks.addChild(bracket(-bw / 2, bh / 2, 1, -1, ml, mth, accent));
    marks.addChild(bracket(bw / 2, bh / 2, -1, -1, ml, mth, accent));
    root.addChild(marks);
    timeline
      .to(marks, { prop: "alpha", from: 0, to: 1, start: tCut + 0.4, duration: 0.3, ease: outQuad })
      .to(marks, { prop: "scale.x", from: 1.08, to: 1, start: tCut + 0.4, duration: 0.35, ease: outQuint })
      .to(marks, { prop: "scale.y", from: 1.08, to: 1, start: tCut + 0.4, duration: 0.35, ease: outQuint });
  }

  // --- Shutter bars blink at every cut ---
  const barH = h * 0.08;
  const topBar = new Graphics().rect(0, 0, w, barH).fill("#0B0B0E");
  topBar.y = -barH;
  const botBar = new Graphics().rect(0, 0, w, barH).fill("#0B0B0E");
  botBar.y = h;
  root.addChild(topBar);
  root.addChild(botBar);
  for (const c of CUTS) {
    timeline
      .to(topBar, { prop: "y", from: -barH, to: 0, start: c - 0.06, duration: 0.08, ease: inQuad })
      .to(topBar, { prop: "y", from: 0, to: -barH, start: c + 0.05, duration: 0.18, ease: outQuad })
      .to(botBar, { prop: "y", from: h, to: h - barH, start: c - 0.06, duration: 0.08, ease: inQuad })
      .to(botBar, { prop: "y", from: h - barH, to: h, start: c + 0.05, duration: 0.18, ease: outQuad });
  }

  // --- White flashes (exactly three, brief and spaced) ---
  const flash = new Graphics().rect(0, 0, w, h).fill("#FFFFFF");
  flash.alpha = 0;
  root.addChild(flash);
  for (const f of FLASHES) {
    timeline
      .to(flash, { prop: "alpha", from: 0, to: 0.85, start: f - 0.02, duration: 0.05, ease: linear })
      .to(flash, { prop: "alpha", from: 0.85, to: 0, start: f + 0.03, duration: 0.22, ease: outQuad });
  }

  return { timeline, duration: DURATION };
}

export const flashCut: TemplateDefinition = {
  id: "flash-cut",
  name: "Flash Cut",
  tagline: "Photo plates cut on a flash rhythm before your title card lands.",
  category: "intro",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 3.3,
  fontRoles: { title: "display", subtitle: "body" },
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Title", default: "New Season", maxLength: 24, shrinkToFit: true },
    { key: "subtitle", type: "text", label: "Subtitle", default: "shot on location", maxLength: 44, optional: true, shrinkToFit: true },
    { key: "showMarks", type: "toggle", label: "Focus & crop marks", default: true },
    { key: "showTags", type: "toggle", label: "Photo tags", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
