import { Container, Graphics, Sprite, type Texture } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outExpo,
  outQuad,
  outQuint,
  safeRect,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
  type Values,
} from "@jima/engine";
import { radialGlowTexture } from "../shared/glow";

// Float — the product never lands. It bobs and drifts weightlessly over a soft
// shadow that breathes in counterpoint (smaller and lighter as the product
// rises), while thin leader lines draw feature labels out into the space.

const DURATION = 5.0;
const TWO_PI = Math.PI * 2;
/** Vertical bob: two full cycles across the shot, so t=0 and t=DURATION rest level. */
const BOB_PERIOD = 2.5;
/** Lateral drift + bank: exactly one cycle, so the drift also closes on itself. */
const DRIFT_PERIOD = 5.0;

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;

const asList = (v: unknown, fallback: string[]): string[] => {
  if (Array.isArray(v)) {
    const arr = v.filter((s): s is string => typeof s === "string" && s.length > 0);
    if (arr.length) return arr;
  }
  return fallback;
};

/** Largest size ≤ size0 at which `text` fits `maxWidth` on one crisp line. */
function fitSize(
  fonts: FontRegistry,
  text: string,
  role: FontRole,
  weight: number,
  size0: number,
  maxWidth: number,
): number {
  if (text.length === 0 || maxWidth <= 0) return size0;
  const w = fonts.measure(text, { family: fonts.family(role), weight, size: size0 });
  return w > maxWidth ? Math.max(11, Math.floor((size0 * maxWidth) / w)) : size0;
}

const DEFAULT_FEATURES = ["Aluminium body", "Refillable core", "72-hour scent"];

const PALETTES: Palette[] = [
  {
    id: "studio-linen",
    name: "Studio linen",
    colors: { background: "#F5F2ED", textColor: "#1B1815", muted: "#67615B", accent: "#A8492A", glow: "#C98E6E" },
  },
  {
    id: "cool-gallery",
    name: "Cool gallery",
    colors: { background: "#EEF1F4", textColor: "#141920", muted: "#59636E", accent: "#2F5EA8", glow: "#7FA6DC" },
  },
  {
    id: "sage-atelier",
    name: "Sage atelier",
    colors: { background: "#E8EDE7", textColor: "#151F19", muted: "#546258", accent: "#2F6B4E", glow: "#7FB39A" },
  },
  {
    id: "noir-studio",
    name: "Noir studio",
    colors: { background: "#131417", textColor: "#F1F2F4", muted: "#9AA0A8", accent: "#C8A96A", glow: "#6E6244" },
  },
];

/** A soft rounded tin, centered on its own origin. Used when no image is set. */
function tinSilhouette(w: number, h: number, accent: string): Container {
  const c = new Container();
  const r = Math.min(w, h) * 0.3;
  c.addChild(new Graphics().roundRect(-w / 2, -h / 2, w, h, r).fill(accent));
  // Bands are clipped to the tin so they can never spill past its corners.
  const detail = new Graphics();
  detail.rect(-w / 2, -h / 2, w, h * 0.28).fill({ color: 0xffffff, alpha: 0.13 });
  detail.rect(-w / 2, h * 0.32, w, h * 0.18).fill({ color: 0x000000, alpha: 0.08 });
  detail.circle(0, h * 0.05, w * 0.19).stroke({ color: 0xffffff, width: Math.max(1.5, w * 0.016), alpha: 0.34 });
  detail.circle(0, h * 0.05, w * 0.075).fill({ color: 0xffffff, alpha: 0.3 });
  const mask = new Graphics().roundRect(-w / 2, -h / 2, w, h, r).fill(0xffffff);
  c.addChild(detail, mask);
  detail.mask = mask;
  return c;
}

function resolveFeatures(values: Values): string[] {
  return asList(values.features, DEFAULT_FEATURES).slice(0, 3);
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, images } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F5F2ED"));
  const textColor = str(values.textColor, pc("textColor", "#1B1815"));
  const muted = pc("muted", "#67615B");
  const accent = str(values.accent, pc("accent", "#A8492A"));
  const glowCol = pc("glow", "#C98E6E");

  const kicker = str(values.kicker, "Weightless").toUpperCase();
  const product = str(values.product, "Orbit Tin");
  const caption = str(values.caption, "From $46");
  const features = resolveFeatures(values);
  const showLeaders = values.showLeaders !== false && features.length > 0;
  const showShadow = values.showShadow !== false;
  const showGlow = values.showGlow !== false;

  const W = size.width;
  const H = size.height;
  const minDim = Math.min(W, H);
  const zone = safeRect(ctx.aspect);
  const cx = zone.x + zone.width / 2;

  const bgRect = new Graphics().rect(0, 0, W, H).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Metrics ---
  const boxH = Math.min(zone.height * 0.38, minDim * 0.32);
  const boxW = boxH * 0.92;
  const bobAmp = minDim * 0.022;
  const driftAmp = minDim * 0.012;
  const lead = minDim * 0.085;
  const labelPad = minDim * 0.016;

  const kickSize = fitSize(fonts, kicker, "body", 600, Math.round(minDim * 0.024), zone.width * 0.9);
  const nameSize = fitSize(fonts, product, "display", 700, Math.round(minDim * 0.056), zone.width * 0.92);
  const footSize = fitSize(fonts, caption, "body", 600, Math.round(minDim * 0.03), zone.width * 0.8);
  const kickH = kickSize * 1.7;
  const nameH = nameSize * 1.3;
  const gapHead = minDim * 0.055;
  const shadowH = boxH * 0.15;
  const gapFoot = minDim * 0.05;
  const footH = caption.length > 0 ? footSize * 1.7 : 0;

  const stackH = kickH + nameH + gapHead + bobAmp + boxH + shadowH + gapFoot + footH;
  const top = zone.y + (zone.height - stackH) / 2;
  const prodCy = top + kickH + nameH + gapHead + bobAmp + boxH / 2;
  const shadowCy = prodCy + boxH / 2 + shadowH * 0.45;
  const footCy = top + stackH - footH * 0.5;

  // --- Head type ---
  const kickY = top + kickH * 0.5;
  const kickText = makeText(fonts, {
    text: kicker,
    role: "body",
    weight: 600,
    size: kickSize,
    color: muted,
    anchor: 0.5,
    align: "center",
    letterSpacing: kickSize * 0.16,
  });
  kickText.position.set(cx, kickY);
  kickText.alpha = 0;
  root.addChild(kickText);
  timeline
    .to(kickText, { prop: "alpha", from: 0, to: 1, start: 0.05, duration: 0.6, ease: outQuad })
    .to(kickText, { prop: "y", from: kickY + minDim * 0.014, to: kickY, start: 0.05, duration: 0.85, ease: outQuint });

  const nameY = top + kickH + nameH * 0.5;
  const nameText = makeText(fonts, {
    text: product,
    role: "display",
    weight: 700,
    size: nameSize,
    color: textColor,
    anchor: 0.5,
    align: "center",
    letterSpacing: -nameSize * 0.018,
  });
  nameText.position.set(cx, nameY);
  nameText.alpha = 0;
  root.addChild(nameText);
  timeline
    .to(nameText, { prop: "alpha", from: 0, to: 1, start: 0.2, duration: 0.65, ease: outQuad })
    .to(nameText, { prop: "y", from: nameY + minDim * 0.022, to: nameY, start: 0.2, duration: 1.0, ease: outExpo });

  // --- Breathing shadow (wrapper fades; inner breathes in update) ---
  const shadowWrap = new Container();
  shadowWrap.position.set(cx, shadowCy);
  shadowWrap.alpha = 0;
  const shadowInner = new Container();
  shadowWrap.addChild(shadowInner);
  if (showShadow) {
    const sh = new Sprite(radialGlowTexture());
    sh.anchor.set(0.5);
    sh.tint = "#000000";
    sh.width = boxW * 1.2;
    sh.height = shadowH * 2.1;
    shadowInner.addChild(sh);
    root.addChild(shadowWrap);
    timeline.to(shadowWrap, { prop: "alpha", from: 0, to: 0.32, start: 0.45, duration: 1.0, ease: outQuad });
  }

  // --- Float rig: wrap (placement) → riser (entrance) → bobber (pure drift) ---
  const floatWrap = new Container();
  floatWrap.position.set(cx, prodCy);
  root.addChild(floatWrap);
  const riser = new Container();
  riser.alpha = 0;
  floatWrap.addChild(riser);
  const bobber = new Container();
  riser.addChild(bobber);

  if (showGlow) {
    const glow = new Sprite(radialGlowTexture());
    glow.anchor.set(0.5);
    glow.tint = glowCol;
    glow.width = glow.height = Math.max(boxW, boxH) * 2.1;
    glow.alpha = 0.16;
    bobber.addChild(glow);
  }

  const prodVis = new Container();
  bobber.addChild(prodVis);
  const tex: Texture | null = images.image ?? null;
  if (tex) {
    const s = new Sprite(tex);
    s.anchor.set(0.5);
    s.scale.set(Math.min(boxW / tex.width, boxH / tex.height));
    prodVis.addChild(s);
  } else {
    prodVis.addChild(tinSilhouette(boxW * 0.78, boxH * 0.72, accent));
  }

  timeline
    .to(riser, { prop: "alpha", from: 0, to: 1, start: 0.25, duration: 0.7, ease: outQuad })
    .to(riser, { prop: "y", from: minDim * 0.1, to: 0, start: 0.25, duration: 1.5, ease: outExpo })
    .to(prodVis, { prop: "scale.x", from: 0.94, to: 1, start: 0.25, duration: 1.5, ease: outExpo })
    .to(prodVis, { prop: "scale.y", from: 0.94, to: 1, start: 0.25, duration: 1.5, ease: outExpo });

  // --- Feature labels on thin leader lines (ride along with the float) ---
  if (showLeaders) {
    const anchorX = boxW * 0.37;
    const labelSize0 = Math.round(minDim * 0.026);
    const labelMax = zone.width / 2 - (anchorX + lead + labelPad) - minDim * 0.012;
    const lineW = Math.max(1.2, minDim * 0.0016);
    const dotR = Math.max(2.5, minDim * 0.0055);
    const offsets = [-boxH * 0.2, boxH * 0.01, boxH * 0.22];

    features.forEach((raw, i) => {
      const sx = i % 2 === 0 ? -1 : 1;
      const oy = offsets[i] ?? 0;
      const co = new Container();
      co.position.set(sx * anchorX, oy);
      bobber.addChild(co);
      const start = 1.15 + i * 0.16;

      const line = new Graphics()
        .rect(sx < 0 ? -lead : 0, -lineW / 2, lead, lineW)
        .fill({ color: muted, alpha: 0.75 });
      line.scale.set(0, 1);
      co.addChild(line);
      timeline.to(line, { prop: "scale.x", from: 0, to: 1, start: start + 0.06, duration: 0.75, ease: outQuint });

      const dot = new Graphics().circle(0, 0, dotR).fill(accent);
      dot.scale.set(0);
      co.addChild(dot);
      timeline
        .to(dot, { prop: "scale.x", from: 0, to: 1, start, duration: 0.55, ease: outExpo })
        .to(dot, { prop: "scale.y", from: 0, to: 1, start, duration: 0.55, ease: outExpo });

      const labelSize = fitSize(fonts, raw, "body", 600, labelSize0, labelMax);
      const label = makeText(fonts, {
        text: raw,
        role: "body",
        weight: 600,
        size: labelSize,
        color: textColor,
        anchor: { x: sx < 0 ? 1 : 0, y: 0.5 },
        align: sx < 0 ? "right" : "left",
      });
      const labelX = sx * (lead + labelPad);
      label.position.set(labelX, 0);
      label.alpha = 0;
      co.addChild(label);
      timeline
        .to(label, { prop: "alpha", from: 0, to: 1, start: start + 0.2, duration: 0.6, ease: outQuad })
        .to(label, {
          prop: "x",
          from: labelX + sx * minDim * 0.02,
          to: labelX,
          start: start + 0.2,
          duration: 0.9,
          ease: outExpo,
        });
    });
  }

  // --- Caption ---
  if (caption.length > 0) {
    const footText = makeText(fonts, {
      text: caption,
      role: "body",
      weight: 600,
      size: footSize,
      color: accent,
      anchor: 0.5,
      align: "center",
    });
    footText.position.set(cx, footCy);
    footText.alpha = 0;
    root.addChild(footText);
    timeline
      .to(footText, { prop: "alpha", from: 0, to: 1, start: 2.4, duration: 0.7, ease: outQuad })
      .to(footText, { prop: "y", from: footCy + minDim * 0.016, to: footCy, start: 2.4, duration: 0.95, ease: outExpo });
  }

  // Pure drift: the product bobs and banks; the shadow answers in counterpoint.
  const update = (t: number): void => {
    const env = outQuad(Math.min(1, t / 1.3));
    const bob = Math.sin((TWO_PI * t) / BOB_PERIOD) * env;
    const drift = Math.sin((TWO_PI * t) / DRIFT_PERIOD) * env;
    bobber.y = -bobAmp * bob;
    bobber.x = driftAmp * drift;
    bobber.rotation = 0.018 * drift;
    shadowInner.scale.set(1 - 0.13 * bob, 1 - 0.1 * bob);
    shadowInner.alpha = 0.8 - 0.2 * bob;
  };

  return { timeline, duration: DURATION, update };
}

export const floatProduct: TemplateDefinition = {
  id: "float-product",
  name: "Float",
  tagline: "A product drifts weightlessly while feature labels reach out on thin lines.",
  category: "product",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "4:5",
  loopable: false,
  posterTime: 3.4,
  fontRoles: { product: "display", kicker: "body", features: "body" },
  palettes: PALETTES,
  fields: [
    {
      key: "image",
      type: "image",
      label: "Product image",
      default: "",
      optional: true,
      help: "A cut-out product reads best — it floats free with no frame around it.",
    },
    { key: "kicker", type: "text", label: "Eyebrow", default: "Weightless", maxLength: 24, shrinkToFit: true },
    { key: "product", type: "text", label: "Product", default: "Orbit Tin", maxLength: 26, shrinkToFit: true },
    {
      key: "features",
      type: "textlist",
      label: "Feature labels",
      default: DEFAULT_FEATURES,
      minItems: 2,
      maxItems: 3,
      maxLength: 22,
      help: "Two or three short notes — they drift in on leader lines.",
    },
    { key: "caption", type: "text", label: "Caption", default: "From $46", maxLength: 20, optional: true, shrinkToFit: true },
    { key: "showLeaders", type: "toggle", label: "Leader lines", default: true },
    { key: "showShadow", type: "toggle", label: "Floating shadow", default: true },
    { key: "showGlow", type: "toggle", label: "Soft halo", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
