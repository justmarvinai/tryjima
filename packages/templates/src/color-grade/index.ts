import { Container, Graphics, Sprite, type Texture } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outQuint,
  outExpo,
  inOutQuad,
  inOutCubic,
  safeRect,
  type Aspect,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { radialGlowTexture } from "../shared/glow";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;

/** Largest size <= size at which `text` fits maxWidth (crisp, single-line). */
function fitSize(
  fonts: FontRegistry,
  text: string,
  role: FontRole,
  weight: number,
  size: number,
  maxWidth: number,
): number {
  if (text.length === 0 || maxWidth <= 0) return size;
  const w = fonts.measure(text, { family: fonts.family(role), weight, size });
  return w > maxWidth ? Math.max(11, Math.floor((size * maxWidth) / w)) : size;
}

// A colourist's pass, not a photo filter: one frame drifts gently while three
// tinted looks crossfade over it, the look name swaps in step and a hairline
// rule advances a third at a time.
const PALETTES: Palette[] = [
  {
    id: "studio-light",
    name: "Studio light",
    colors: {
      background: "#F4F3F0", textColor: "#16181C", accent: "#A94E26", muted: "#6E685F", card: "#E6E3DC",
      sceneSky: "#CFE0EA", sceneSun: "#F2C879", sceneSea: "#7FA8BE", sceneLand: "#4E6A78",
      gradeA: "#E8A24A", gradeB: "#3E6BB5", gradeC: "#1C3A3A", glow: "#FFE9C7",
    },
  },
  {
    id: "night-suite",
    name: "Night suite",
    colors: {
      background: "#101216", textColor: "#EFF1F5", accent: "#F0A44A", muted: "#79818E", card: "#1C2028",
      sceneSky: "#2B3A4C", sceneSun: "#E7B26A", sceneSea: "#3B5266", sceneLand: "#22303D",
      gradeA: "#E08A3C", gradeB: "#3C63A8", gradeC: "#123033", glow: "#FFD9A0",
    },
  },
  {
    id: "bleach",
    name: "Bleach",
    colors: {
      background: "#EFF2F4", textColor: "#101821", accent: "#1B6580", muted: "#5E6A75", card: "#DDE4E8",
      sceneSky: "#C9DCE6", sceneSun: "#EFD79C", sceneSea: "#86A9BB", sceneLand: "#4F6C7B",
      gradeA: "#DFA05C", gradeB: "#2F6FA8", gradeC: "#16323C", glow: "#E8F4FF",
    },
  },
  {
    id: "rosewood",
    name: "Rosewood",
    colors: {
      background: "#F7F1EE", textColor: "#21140F", accent: "#A8452F", muted: "#7A6259", card: "#EADFD9",
      sceneSky: "#E7D2C6", sceneSun: "#F0BC80", sceneSea: "#B08C7C", sceneLand: "#6E4B3F",
      gradeA: "#E5915A", gradeB: "#5A6FA8", gradeC: "#3A2020", glow: "#FFE2CC",
    },
  },
];

interface Cfg {
  mediaWF: number;
  mediaHF: number;
  labelF: number;
}
const CFG: Record<Aspect, Cfg> = {
  "16:9": { mediaWF: 0.7, mediaHF: 0.7, labelF: 0.042 },
  "1:1": { mediaWF: 1, mediaHF: 0.68, labelF: 0.042 },
  "4:5": { mediaWF: 1, mediaHF: 0.74, labelF: 0.04 },
  "9:16": { mediaWF: 1, mediaHF: 0.74, labelF: 0.038 },
};

const OVERSCAN = 1.12;
const T1 = 1.35; // warm -> cool
const T2 = 2.7; // cool -> final
const XFADE = 0.8;
const DURATION = 4.8;

const GRADE_ALPHA = [0.4, 0.4, 0.24];

/** A calm coastline that reads clearly under every tint. */
function drawScene(g: Graphics, w: number, h: number, sky: string, sun: string, sea: string, land: string): void {
  g.rect(-w / 2, -h / 2, w, h).fill(sky);
  g.circle(-w * 0.14, -h * 0.16, Math.min(w, h) * 0.13).fill(sun);
  g.ellipse(w * 0.36, h * 0.02, w * 0.42, h * 0.16).fill({ color: land, alpha: 0.35 });
  g.rect(-w / 2, h * 0.08, w, h * 0.42).fill(sea);
  g.poly([-w * 0.55, h * 0.12, -w * 0.18, -h * 0.12, w * 0.06, h * 0.12]).fill(land);
  g.rect(-w / 2, h * 0.3, w, h * 0.05).fill({ color: sun, alpha: 0.3 });
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, images } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F4F3F0"));
  const textColor = str(values.textColor, pc("textColor", "#16181C"));
  const accent = str(values.accent, pc("accent", "#A94E26"));
  const muted = pc("muted", "#6E685F");
  const cardColor = pc("card", "#E6E3DC");

  const title = str(values.title, "Golden hour");
  const gradeNames = [
    str(values.grade1, "Warm"),
    str(values.grade2, "Cool"),
    str(values.grade3, "Final look"),
  ];
  const showRule = on(values.showRule);
  const showCounter = on(values.showCounter);
  const showSwatch = on(values.showSwatch);

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const cfg = CFG[ctx.aspect];
  const safe = safeRect(ctx.aspect);
  const timeline = new JimaTimeline();

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  // --- Block metrics (vertically centred inside the safe rect) ---
  const mediaW = safe.width * cfg.mediaWF;
  const mediaH = safe.height * cfg.mediaHF;
  const eyeSize = Math.round(minDim * 0.021);
  const labelSize = Math.round(minDim * cfg.labelF);
  const counterSize = Math.round(minDim * 0.022);
  const ruleH = Math.max(3, Math.round(minDim * 0.006));
  const gapEye = minDim * 0.024;
  const gapRule = minDim * 0.035;
  const gapLabel = minDim * 0.028;

  const hasEyebrow = title.length > 0;
  const blockH =
    (hasEyebrow ? eyeSize * 1.2 + gapEye : 0) +
    mediaH +
    (showRule ? gapRule + ruleH : 0) +
    gapLabel +
    labelSize * 1.2;
  const blockTop = safe.y + (safe.height - blockH) / 2;
  const blockLeft = w / 2 - mediaW / 2;
  const blockRight = blockLeft + mediaW;

  let cursorY = blockTop;

  // --- Eyebrow: the shot name ---
  if (hasEyebrow) {
    const eyeText = makeText(fonts, {
      text: title,
      role: "body",
      weight: 600,
      size: fitSize(fonts, title, "body", 600, eyeSize, mediaW * 0.8),
      color: accent,
      anchor: { x: 0, y: 0.5 },
      letterSpacing: eyeSize * 0.14,
    });
    const eyeY = cursorY + eyeSize * 0.6;
    eyeText.position.set(blockLeft, eyeY);
    eyeText.alpha = 0;
    root.addChild(eyeText);
    timeline
      .to(eyeText, { prop: "alpha", from: 0, to: 1, start: 0.15, duration: 0.45, ease: outQuad })
      .to(eyeText, { prop: "y", from: eyeY + minDim * 0.01, to: eyeY, start: 0.15, duration: 0.6, ease: outQuint });
    cursorY += eyeSize * 1.2 + gapEye;
  }

  // --- The frame under grade ---
  const mediaCx = w / 2;
  const mediaCy = cursorY + mediaH / 2;
  const mediaR = minDim * 0.022;

  const cardGroup = new Container();
  cardGroup.position.set(mediaCx, mediaCy);
  cardGroup.alpha = 0;
  cardGroup.scale.set(0.97);
  root.addChild(cardGroup);
  timeline
    .to(cardGroup, { prop: "alpha", from: 0, to: 1, start: 0, duration: 0.5, ease: outQuad })
    .to(cardGroup, { prop: "scale.x", from: 0.97, to: 1, start: 0, duration: 0.85, ease: outExpo })
    .to(cardGroup, { prop: "scale.y", from: 0.97, to: 1, start: 0, duration: 0.85, ease: outExpo });

  const clip = new Container();
  const clipMask = new Graphics().roundRect(-mediaW / 2, -mediaH / 2, mediaW, mediaH, mediaR).fill(0xffffff);
  cardGroup.addChild(clip, clipMask);
  clip.mask = clipMask;

  const plate = new Graphics().roundRect(-mediaW / 2, -mediaH / 2, mediaW, mediaH, mediaR).fill(cardColor);
  clip.addChild(plate);

  const shotW = mediaW * OVERSCAN;
  const shotH = mediaH * OVERSCAN;
  const shot = new Container();
  const photo: Texture | null = images.image ?? null;
  if (photo) {
    const s = new Sprite(photo);
    s.anchor.set(0.5);
    s.scale.set(Math.max(shotW / photo.width, shotH / photo.height));
    shot.addChild(s);
  } else {
    const g = new Graphics();
    drawScene(g, shotW, shotH, pc("sceneSky", "#CFE0EA"), pc("sceneSun", "#F2C879"), pc("sceneSea", "#7FA8BE"), pc("sceneLand", "#4E6A78"));
    shot.addChild(g);
  }
  shot.scale.set(1.06);
  clip.addChild(shot);
  timeline
    .to(shot, { prop: "scale.x", from: 1.06, to: 1, start: 0.15, duration: 3.9, ease: inOutQuad })
    .to(shot, { prop: "scale.y", from: 1.06, to: 1, start: 0.15, duration: 3.9, ease: inOutQuad })
    .to(shot, { prop: "x", from: -mediaW * 0.012, to: mediaW * 0.01, start: 0.15, duration: 3.9, ease: inOutQuad });

  // --- Three looks, crossfaded ---
  const gradeKeys = ["gradeA", "gradeB", "gradeC"];
  const gradeDefaults = ["#E8A24A", "#3E6BB5", "#1C3A3A"];
  const gradeColors = gradeKeys.map((k, i) => pc(k, gradeDefaults[i] ?? "#000000"));
  const grades = gradeColors.map((color, i) => {
    const layer = new Container();
    layer.addChild(new Graphics().rect(-mediaW / 2, -mediaH / 2, mediaW, mediaH).fill(color));
    if (i === 2) {
      // The final look keeps a soft highlight lift instead of a flat wash.
      const lift = new Sprite(radialGlowTexture());
      lift.anchor.set(0.5);
      lift.width = mediaW * 0.95;
      lift.height = mediaH * 0.95;
      lift.tint = pc("glow", "#FFE9C7");
      lift.alpha = 0.55;
      lift.position.set(-mediaW * 0.16, -mediaH * 0.18);
      layer.addChild(lift);
    }
    layer.alpha = 0;
    clip.addChild(layer);
    return layer;
  });

  const aA = GRADE_ALPHA[0] ?? 0.4;
  const aB = GRADE_ALPHA[1] ?? 0.4;
  const aC = GRADE_ALPHA[2] ?? 0.24;
  const gA = grades[0];
  const gB = grades[1];
  const gC = grades[2];
  if (gA && gB && gC) {
    timeline
      .to(gA, { prop: "alpha", from: 0, to: aA, start: 0.2, duration: 0.55, ease: outQuad })
      .to(gA, { prop: "alpha", from: aA, to: 0, start: T1, duration: XFADE, ease: inOutCubic })
      .to(gB, { prop: "alpha", from: 0, to: aB, start: T1, duration: XFADE, ease: inOutCubic })
      .to(gB, { prop: "alpha", from: aB, to: 0, start: T2, duration: XFADE, ease: inOutCubic })
      .to(gC, { prop: "alpha", from: 0, to: aC, start: T2, duration: XFADE, ease: inOutCubic });
  }

  cursorY += mediaH;

  // --- Progress rule: a third per look ---
  if (showRule) {
    const ruleY = cursorY + gapRule;
    const track = new Graphics().roundRect(0, 0, mediaW, ruleH, ruleH / 2).fill({ color: muted, alpha: 0.35 });
    track.position.set(blockLeft, ruleY);
    track.alpha = 0;
    const fill = new Graphics().roundRect(0, 0, mediaW, ruleH, ruleH / 2).fill(accent);
    fill.position.set(blockLeft, ruleY);
    fill.scale.x = 0;
    root.addChild(track, fill);
    timeline
      .to(track, { prop: "alpha", from: 0, to: 1, start: 0.25, duration: 0.4, ease: outQuad })
      .to(fill, { prop: "scale.x", from: 0, to: 1 / 3, start: 0.35, duration: 0.7, ease: outQuint })
      .to(fill, { prop: "scale.x", from: 1 / 3, to: 2 / 3, start: T1, duration: XFADE, ease: inOutCubic })
      .to(fill, { prop: "scale.x", from: 2 / 3, to: 1, start: T2, duration: XFADE, ease: inOutCubic });
    cursorY += gapRule + ruleH;
  }

  // --- Look name + swatch, swapping in step ---
  const counterW = showCounter ? counterSize * 4.2 : 0;
  const swatchS = showSwatch ? labelSize * 0.62 : 0;
  const swatchGap = showSwatch ? labelSize * 0.42 : 0;
  const labelMaxW = mediaW - counterW - swatchS - swatchGap - minDim * 0.02;
  const labelY = cursorY + gapLabel + labelSize * 0.6;

  const IN_AT = [0.45, T1 + 0.27, T2 + 0.27];
  const OUT_AT = [T1, T2];

  gradeNames.forEach((name, i) => {
    const row = new Container();
    row.position.set(blockLeft, labelY);
    row.alpha = 0;
    root.addChild(row);

    let x = 0;
    if (showSwatch) {
      const sw = new Graphics()
        .roundRect(0, -swatchS / 2, swatchS, swatchS, swatchS * 0.28)
        .fill(gradeColors[i] ?? accent);
      row.addChild(sw);
      x += swatchS + swatchGap;
    }
    const nameText = makeText(fonts, {
      text: name,
      role: "display",
      weight: 700,
      size: fitSize(fonts, name, "display", 700, labelSize, labelMaxW),
      color: textColor,
      anchor: { x: 0, y: 0.5 },
      letterSpacing: -labelSize * 0.012,
    });
    nameText.position.set(x, 0);
    row.addChild(nameText);

    const inAt = IN_AT[i] ?? 0.45;
    timeline
      .to(row, { prop: "alpha", from: 0, to: 1, start: inAt, duration: 0.42, ease: outQuad })
      .to(row, { prop: "y", from: labelY + minDim * 0.014, to: labelY, start: inAt, duration: 0.6, ease: outQuint });
    const outAt = OUT_AT[i];
    if (outAt !== undefined) {
      timeline
        .to(row, { prop: "alpha", from: 1, to: 0, start: outAt, duration: 0.28, ease: inOutQuad })
        .to(row, { prop: "y", from: labelY, to: labelY - minDim * 0.012, start: outAt, duration: 0.28, ease: inOutQuad });
    }
  });

  if (showCounter) {
    const counter = makeText(fonts, {
      text: "01 / 03",
      role: "body",
      weight: 600,
      size: counterSize,
      color: muted,
      anchor: { x: 1, y: 0.5 },
      letterSpacing: counterSize * 0.08,
    });
    counter.position.set(blockRight, labelY);
    counter.alpha = 0;
    root.addChild(counter);
    timeline
      .to(counter, { prop: "alpha", from: 0, to: 1, start: 0.5, duration: 0.4, ease: outQuad })
      .set(counter, "text", "01 / 03", 0)
      .set(counter, "text", "02 / 03", T1 + 0.4)
      .set(counter, "text", "03 / 03", T2 + 0.4);
  }

  return { timeline, duration: DURATION };
}

export const colorGrade: TemplateDefinition = {
  id: "color-grade",
  name: "Colour Grade",
  tagline: "One frame glides through three colour looks while the grade name keeps pace.",
  category: "photo",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 4.4,
  fontRoles: { title: "body", grade1: "display", grade2: "display", grade3: "display" },
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Shot name", default: "Golden hour", maxLength: 24, shrinkToFit: true, optional: true },
    { key: "grade1", type: "text", label: "Look 1", default: "Warm", maxLength: 18, shrinkToFit: true },
    { key: "grade2", type: "text", label: "Look 2", default: "Cool", maxLength: 18, shrinkToFit: true },
    { key: "grade3", type: "text", label: "Look 3", default: "Final look", maxLength: 18, shrinkToFit: true },
    { key: "image", type: "image", label: "Frame", default: "", optional: true, help: "A drawn scene stands in when empty." },
    { key: "showRule", type: "toggle", label: "Progress rule", default: true },
    { key: "showCounter", type: "toggle", label: "Step counter", default: true },
    { key: "showSwatch", type: "toggle", label: "Look swatch", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
