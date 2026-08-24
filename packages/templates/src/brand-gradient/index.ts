import { Container, Graphics, Sprite } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
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

/** Largest size <= size0 at which `text` fits maxWidth (crisp, single-line). */
function fitSize(
  fonts: FontRegistry,
  text: string,
  role: FontRole,
  weight: number,
  size0: number,
  maxWidth: number,
  trackingEm = 0,
): number {
  if (text.length === 0 || maxWidth <= 0) return size0;
  const w = fonts.measure(text, {
    family: fonts.family(role),
    weight,
    size: size0,
    letterSpacing: trackingEm * size0,
  });
  return w > maxWidth ? Math.max(11, Math.floor((size0 * maxWidth) / w)) : size0;
}

/** Rough perceived luminance of a #rrggbb color (0..1). */
function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 1;
  const n = parseInt(m[1] ?? "ffffff", 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}

// A living mesh gradient: several very large, heavily-overlapping soft radial
// blobs drift and breathe behind a crisp centred lockup. Only the full-frame
// `bg` rect carries the background field; the blobs use their own palette keys
// so the field stays a designed object rather than page chrome.
const PALETTES: Palette[] = [
  {
    id: "aurora",
    name: "Aurora",
    colors: { background: "#F5F6FA", textColor: "#14161C", accent: "#6C63FF", accentB: "#3FC7B4", accentC: "#FF8FA3" },
  },
  {
    id: "porcelain",
    name: "Porcelain",
    colors: { background: "#FFFFFF", textColor: "#0F1317", accent: "#0E7C66", accentB: "#79C6B4", accentC: "#EFC275" },
  },
  {
    id: "ink",
    name: "Ink",
    colors: { background: "#0B0D13", textColor: "#F2F5FA", accent: "#7C5CFF", accentB: "#2DD4BF", accentC: "#F472B6" },
  },
  {
    id: "sunrise",
    name: "Sunrise",
    colors: { background: "#FFF6F0", textColor: "#2A160C", accent: "#FF7A45", accentB: "#FFC46B", accentC: "#FF9EB1" },
  },
];

/** Relative anchor points for the blob field — a composed, non-random spread. */
const BLOB_SPOTS: readonly (readonly [number, number])[] = [
  [0.2, 0.24],
  [0.79, 0.19],
  [0.64, 0.74],
  [0.23, 0.8],
  [0.5, 0.47],
];

interface Blob {
  sprite: Sprite;
  x: number;
  y: number;
  ampX: number;
  ampY: number;
  freqX: number;
  freqY: number;
  phaseX: number;
  phaseY: number;
  baseScale: number;
  pulse: number;
  pulseFreq: number;
  pulsePhase: number;
}

function nameFrac(aspect: Aspect): number {
  switch (aspect) {
    case "16:9":
      return 0.132;
    case "1:1":
      return 0.122;
    case "4:5":
      return 0.118;
    case "9:16":
      return 0.112;
  }
}

const DURATION = 4.8;
const TAU = Math.PI * 2;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, rng } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F5F6FA"));
  const textColor = str(values.textColor, pc("textColor", "#14161C"));
  const accent = str(values.accent, pc("accent", "#6C63FF"));
  const accentB = str(values.accentB, pc("accentB", "#3FC7B4"));
  const accentC = str(values.accentC, pc("accentC", "#FF8FA3"));

  const eyebrow = str(values.eyebrow, "Studio").toUpperCase();
  const name = str(values.name, "Northlight");
  const tagline = str(values.tagline, "Design that keeps moving");
  const showFrame = values.showFrame !== false;
  const showRule = values.showRule !== false;
  const drift = values.showDrift !== false;

  const w = size.width;
  const h = size.height;
  const cx = w / 2;
  const minDim = Math.min(w, h);
  const maxDim = Math.max(w, h);
  const zone = safeRect(ctx.aspect);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- The gradient field: big soft radials, layered until they read as mesh ---
  const field = new Container();
  field.position.set(cx, h / 2);
  field.alpha = 0;
  root.addChild(field);

  // Darker backdrops need a brighter wash to feel lit; light ones stay airy.
  const fieldAlpha = luminance(bg) < 0.5 ? 0.44 : 0.36;
  const tints = [accent, accentB, accentC, accentB, accent];
  const glowTex = radialGlowTexture();
  const blobs: Blob[] = BLOB_SPOTS.map((spot, i) => {
    const sprite = new Sprite(glowTex);
    sprite.anchor.set(0.5);
    sprite.tint = tints[i] ?? accent;
    sprite.alpha = fieldAlpha * rng.range(0.78, 1);
    const d = maxDim * rng.range(0.82, 1.22);
    sprite.width = d;
    sprite.height = d;
    const bx = (spot[0] - 0.5) * w;
    const by = (spot[1] - 0.5) * h;
    sprite.position.set(bx, by);
    field.addChild(sprite);
    return {
      sprite,
      x: bx,
      y: by,
      ampX: minDim * rng.range(0.035, 0.085),
      ampY: minDim * rng.range(0.03, 0.075),
      freqX: rng.range(0.045, 0.1),
      freqY: rng.range(0.04, 0.095),
      phaseX: rng.range(0, TAU),
      phaseY: rng.range(0, TAU),
      baseScale: sprite.scale.x,
      pulse: rng.range(0.03, 0.07),
      pulseFreq: rng.range(0.05, 0.11),
      pulsePhase: rng.range(0, TAU),
    };
  });

  timeline
    .to(field, { prop: "alpha", from: 0, to: 1, start: 0, duration: 1.3, ease: outQuad })
    .to(field, { prop: "scale.x", from: 1.08, to: 1, start: 0, duration: 2.6, ease: outExpo })
    .to(field, { prop: "scale.y", from: 1.08, to: 1, start: 0, duration: 2.6, ease: outExpo });

  // --- Inset hairline frame (optional, sits above the field) ---
  if (showFrame) {
    const inset = Math.round(minDim * 0.045);
    const frame = new Graphics()
      .rect(inset, inset, w - inset * 2, h - inset * 2)
      .stroke({ color: textColor, width: Math.max(1, minDim * 0.0016), alignment: 0.5 });
    frame.alpha = 0;
    root.addChild(frame);
    timeline.to(frame, { prop: "alpha", from: 0, to: 0.3, start: 0.5, duration: 1.1, ease: outQuad });
  }

  // --- Centred lockup ---
  const eyebrowSize = Math.round(minDim * 0.026);
  const nameSize = fitSize(fonts, name, "display", 700, Math.round(minDim * nameFrac(ctx.aspect)), zone.width * 0.84, -0.012);
  const taglineSize = fitSize(fonts, tagline, "body", 400, Math.round(minDim * 0.037), zone.width * 0.74);

  const gapEyebrow = nameSize * 0.44;
  const ruleH = Math.max(2, Math.round(minDim * 0.0024));
  const gapRule = nameSize * 0.36;
  const gapTagline = nameSize * 0.3;
  const blockH =
    eyebrowSize * 1.1 +
    gapEyebrow +
    nameSize * 1.02 +
    (showRule ? gapRule + ruleH : 0) +
    gapTagline +
    taglineSize * 1.2;

  const blockCy = zone.y + zone.height / 2;
  const content = new Container();
  content.position.set(cx, blockCy);
  root.addChild(content);
  timeline
    .to(content, { prop: "scale.x", from: 1.035, to: 1, start: 0, duration: 1.6, ease: outExpo })
    .to(content, { prop: "scale.y", from: 1.035, to: 1, start: 0, duration: 1.6, ease: outExpo });

  let cursor = -blockH / 2;

  const eyebrowY = cursor + eyebrowSize * 0.55;
  if (eyebrow.length > 0) {
    const eyebrowText = makeText(fonts, {
      text: eyebrow,
      role: "body",
      weight: 600,
      size: eyebrowSize,
      color: textColor,
      anchor: 0.5,
      letterSpacing: eyebrowSize * 0.22,
    });
    eyebrowText.position.set(eyebrowSize * 0.11, eyebrowY);
    eyebrowText.alpha = 0;
    content.addChild(eyebrowText);
    timeline
      .to(eyebrowText, { prop: "alpha", from: 0, to: 0.72, start: 0.25, duration: 0.6, ease: outQuad })
      .to(eyebrowText, { prop: "y", from: eyebrowY + 14, to: eyebrowY, start: 0.25, duration: 0.9, ease: outExpo });
  }
  cursor += eyebrowSize * 1.1 + gapEyebrow;

  const nameY = cursor + nameSize * 0.51;
  const nameText = makeText(fonts, {
    text: name,
    role: "display",
    weight: 700,
    size: nameSize,
    color: textColor,
    anchor: 0.5,
    align: "center",
    letterSpacing: -nameSize * 0.012,
  });
  nameText.position.set(-nameSize * 0.006, nameY);
  nameText.alpha = 0;
  content.addChild(nameText);
  timeline
    .to(nameText, { prop: "alpha", from: 0, to: 1, start: 0.4, duration: 0.7, ease: outQuad })
    .to(nameText, { prop: "y", from: nameY + 30, to: nameY, start: 0.4, duration: 1.25, ease: outExpo });
  cursor += nameSize * 1.02;

  if (showRule) {
    cursor += gapRule;
    const ruleW = Math.min(zone.width * 0.3, nameSize * 1.6);
    const rule = new Graphics().roundRect(-ruleW / 2, -ruleH / 2, ruleW, ruleH, ruleH / 2).fill(accent);
    rule.position.set(0, cursor + ruleH / 2);
    rule.scale.set(0, 1);
    content.addChild(rule);
    timeline.to(rule, { prop: "scale.x", from: 0, to: 1, start: 0.85, duration: 0.95, ease: outExpo });
    cursor += ruleH;
  }

  cursor += gapTagline;
  const taglineY = cursor + taglineSize * 0.6;
  if (tagline.length > 0) {
    const taglineText = makeText(fonts, {
      text: tagline,
      role: "body",
      weight: 400,
      size: taglineSize,
      color: textColor,
      anchor: 0.5,
      align: "center",
    });
    taglineText.position.set(0, taglineY);
    taglineText.alpha = 0;
    content.addChild(taglineText);
    timeline
      .to(taglineText, { prop: "alpha", from: 0, to: 0.86, start: 0.72, duration: 0.7, ease: outQuad })
      .to(taglineText, { prop: "y", from: taglineY + 20, to: taglineY, start: 0.72, duration: 1.15, ease: outExpo });
  }

  // The field is a pure function of t: every blob is a slow sine drift plus a
  // slower breathing scale, so re-seeking lands on identical pixels.
  const update = (t: number): void => {
    for (const b of blobs) {
      if (drift) {
        b.sprite.position.set(
          b.x + b.ampX * Math.sin(TAU * b.freqX * t + b.phaseX),
          b.y + b.ampY * Math.sin(TAU * b.freqY * t + b.phaseY),
        );
        const s = b.baseScale * (1 + b.pulse * Math.sin(TAU * b.pulseFreq * t + b.pulsePhase));
        b.sprite.scale.set(s);
      } else {
        b.sprite.position.set(b.x, b.y);
        b.sprite.scale.set(b.baseScale);
      }
    }
  };

  return { timeline, duration: DURATION, update };
}

export const brandGradient: TemplateDefinition = {
  id: "brand-gradient",
  name: "Brand Gradient",
  tagline: "A soft mesh gradient breathes behind your name and tagline.",
  category: "brand",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 3.4,
  fontRoles: { name: "display", tagline: "body", eyebrow: "body" },
  palettes: PALETTES,
  fields: [
    { key: "eyebrow", type: "text", label: "Eyebrow", default: "Studio", maxLength: 24, shrinkToFit: true },
    { key: "name", type: "text", label: "Brand name", default: "Northlight", maxLength: 22, shrinkToFit: true },
    { key: "tagline", type: "text", label: "Tagline", default: "Design that keeps moving", maxLength: 46, shrinkToFit: true },
    { key: "showDrift", type: "toggle", label: "Gradient drift", default: true },
    { key: "showFrame", type: "toggle", label: "Hairline frame", default: true },
    { key: "showRule", type: "toggle", label: "Accent rule", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Gradient 1", default: "", optional: true },
    { key: "accentB", type: "color", label: "Gradient 2", default: "", optional: true },
    { key: "accentC", type: "color", label: "Gradient 3", default: "", optional: true },
  ],
  build,
};
