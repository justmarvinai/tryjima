import { Container, Graphics, Sprite, type Texture } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  inOutCubic,
  inOutQuad,
  outExpo,
  outQuad,
  safeRect,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { makeIcon } from "../shared/icons";

// Product Story — three beats, no cuts. The problem opens as a ring with a gap
// missing; the product arrives and stays; the result closes that same ring with
// a check and lands the CTA. Every scene change is a soft dissolve with drift.

const DURATION = 5.4;
const DEG = Math.PI / 180;

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;

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

/** Up to two trimmed lines from a textarea value. */
function twoLines(v: unknown, fallback: string): string[] {
  const s = typeof v === "string" && v.length > 0 ? v : fallback;
  const out = s
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .slice(0, 2);
  return out.length > 0 ? out : [fallback];
}

const longestOf = (arr: string[]): string => arr.reduce((a, b) => (a.length > b.length ? a : b), "");

const PALETTES: Palette[] = [
  {
    id: "studio-linen",
    name: "Studio linen",
    colors: { background: "#F5F2ED", textColor: "#1B1815", muted: "#67615B", accent: "#A8492A", onAccent: "#FFFFFF" },
  },
  {
    id: "cool-gallery",
    name: "Cool gallery",
    colors: { background: "#EEF1F4", textColor: "#141920", muted: "#59636E", accent: "#2F5EA8", onAccent: "#FFFFFF" },
  },
  {
    id: "sage-atelier",
    name: "Sage atelier",
    colors: { background: "#E8EDE7", textColor: "#151F19", muted: "#546258", accent: "#2F6B4E", onAccent: "#FFFFFF" },
  },
  {
    id: "noir-studio",
    name: "Noir studio",
    colors: { background: "#131417", textColor: "#F1F2F4", muted: "#9AA0A8", accent: "#C8A96A", onAccent: "#17140D" },
  },
];

/** A soft tube silhouette centered on its origin. Used when no image is set. */
function tubeSilhouette(w: number, h: number, accent: string): Container {
  const c = new Container();
  const crimpH = h * 0.08;
  const capH = h * 0.14;
  const bodyTop = -h / 2 + crimpH;
  const bodyH = h - crimpH - capH;
  const g = new Graphics();
  g.roundRect(-w / 2, bodyTop, w, bodyH, w * 0.18).fill(accent);
  g.roundRect(-w * 0.46, -h / 2, w * 0.92, crimpH * 1.5, crimpH * 0.4).fill(accent);
  g.roundRect(-w * 0.46, -h / 2, w * 0.92, crimpH * 1.5, crimpH * 0.4).fill({ color: 0x000000, alpha: 0.14 });
  g.roundRect(-w * 0.26, h / 2 - capH, w * 0.52, capH, w * 0.08).fill(accent);
  g.roundRect(-w * 0.26, h / 2 - capH, w * 0.52, capH, w * 0.08).fill({ color: 0x000000, alpha: 0.2 });
  c.addChild(g);
  const detail = new Graphics();
  detail.rect(-w / 2, bodyTop + bodyH * 0.3, w, bodyH * 0.26).fill({ color: 0xffffff, alpha: 0.16 });
  c.addChild(detail);
  return c;
}

interface BeatText {
  label: string;
  lines: string[];
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, images } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F5F2ED"));
  const textColor = str(values.textColor, pc("textColor", "#1B1815"));
  const muted = pc("muted", "#67615B");
  const accent = str(values.accent, pc("accent", "#A8492A"));
  const onAccent = pc("onAccent", "#FFFFFF");

  const beats: BeatText[] = [
    { label: str(values.label1, "The problem"), lines: twoLines(values.beat1, "Mornings always\nfelt like a rush.") },
    { label: str(values.label2, "The product"), lines: twoLines(values.beat2, "Meet Aera —\na 30-second ritual.") },
    { label: str(values.label3, "The result"), lines: twoLines(values.beat3, "Calm mornings,\nevery single day.") },
  ];
  const cta = str(values.cta, "Shop Aera");
  const showWash = values.showWash !== false;
  const showProgress = values.showProgress !== false;
  const showRing = values.showRing !== false;

  const W = size.width;
  const H = size.height;
  const minDim = Math.min(W, H);
  const zone = safeRect(ctx.aspect);
  const cx = zone.x + zone.width / 2;

  const bgRect = new Graphics().rect(0, 0, W, H).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // A whisper of accent that warms as the story resolves.
  if (showWash) {
    const wash = new Graphics().rect(0, 0, W, H).fill(accent);
    wash.alpha = 0;
    root.addChild(wash);
    timeline
      .to(wash, { prop: "alpha", from: 0, to: 0.04, start: 2.0, duration: 1.0, ease: inOutQuad })
      .to(wash, { prop: "alpha", from: 0.04, to: 0.08, start: 3.6, duration: 1.1, ease: inOutQuad });
  }

  // --- Shared geometry (identical across beats, so dissolves stay calm) ---
  const R = Math.min(zone.width * 0.24, zone.height * 0.19, minDim * 0.2);
  const eyebrowCy = zone.y + zone.height * 0.06;
  const motifCy = zone.y + zone.height * 0.36;
  const headCy = zone.y + zone.height * 0.7;
  const ctaCy = zone.y + zone.height * 0.86;
  const progressCy = zone.y + zone.height * 0.965;
  const drift = minDim * 0.028;

  const eyebrowSize = Math.round(minDim * 0.023);
  const headSize0 = Math.round(minDim * 0.062);
  const headMax = zone.width * 0.9;

  /** Eyebrow + two-line headline for one beat, in a fresh scene container. */
  function makeScene(index: number, beat: BeatText): Container {
    const scene = new Container();
    scene.alpha = 0;
    root.addChild(scene);

    const label = `0${index + 1} · ${beat.label}`.toUpperCase();
    const labSize = fitSize(fonts, label, "body", 600, eyebrowSize, zone.width * 0.9);
    const lab = makeText(fonts, {
      text: label,
      role: "body",
      weight: 600,
      size: labSize,
      color: muted,
      anchor: 0.5,
      align: "center",
      letterSpacing: labSize * 0.18,
    });
    lab.position.set(cx, eyebrowCy);
    scene.addChild(lab);

    const headSize = fitSize(fonts, longestOf(beat.lines), "display", 700, headSize0, headMax);
    const head = makeText(fonts, {
      text: beat.lines.join("\n"),
      role: "display",
      weight: 700,
      size: headSize,
      color: textColor,
      anchor: 0.5,
      align: "center",
      lineHeight: headSize * 1.14,
      letterSpacing: -headSize * 0.018,
    });
    head.position.set(cx, headCy);
    scene.addChild(head);
    return scene;
  }

  const IN = [0.15, 2.0, 3.6];
  const OUT = [1.55, 3.15];

  const scenes = beats.map((b, i) => makeScene(i, b));

  scenes.forEach((scene, i) => {
    const inAt = IN[i] ?? 0;
    scene.y = drift;
    timeline
      .to(scene, { prop: "alpha", from: 0, to: 1, start: inAt, duration: i === 2 ? 0.75 : 0.7, ease: outQuad })
      .to(scene, { prop: "y", from: drift, to: 0, start: inAt, duration: i === 2 ? 1.05 : 1.0, ease: outExpo });
    const outAt = OUT[i];
    if (outAt !== undefined) {
      timeline
        .to(scene, { prop: "alpha", from: 1, to: 0, start: outAt, duration: 0.6, ease: inOutQuad })
        .to(scene, { prop: "y", from: 0, to: -drift * 0.7, start: outAt, duration: 0.8, ease: inOutQuad });
    }
  });

  const sceneA = scenes[0];
  const sceneC = scenes[2];

  // --- Beat 1 motif: a ring with a gap where the answer should be ---
  if (showRing && sceneA) {
    const gapCenter = -45 * DEG;
    const half = 32 * DEG;
    const openRing = new Graphics();
    openRing
      .arc(0, 0, R, gapCenter + half, gapCenter + Math.PI * 2 - half)
      .stroke({ color: muted, width: Math.max(3, R * 0.055), cap: "round", alpha: 0.85 });
    openRing.position.set(cx, motifCy);
    sceneA.addChildAt(openRing, 0);
    timeline
      .to(openRing, { prop: "scale.x", from: 0.9, to: 1, start: 0.15, duration: 1.2, ease: outExpo })
      .to(openRing, { prop: "scale.y", from: 0.9, to: 1, start: 0.15, duration: 1.2, ease: outExpo });
  }

  // --- The product: arrives with beat 2 and never leaves ---
  const prodH = R * 2.0;
  const prodW = prodH * 0.42;
  const prodNode = new Container();
  prodNode.position.set(cx, motifCy);
  prodNode.alpha = 0;
  root.addChild(prodNode);
  const prodVis = new Container();
  prodNode.addChild(prodVis);
  const tex: Texture | null = images.image ?? null;
  if (tex) {
    const s = new Sprite(tex);
    s.anchor.set(0.5);
    s.scale.set(Math.min((R * 1.5) / tex.width, prodH / tex.height));
    prodVis.addChild(s);
  } else {
    prodVis.addChild(tubeSilhouette(prodW, prodH, accent));
  }
  timeline
    .to(prodNode, { prop: "alpha", from: 0, to: 1, start: 2.05, duration: 0.7, ease: outQuad })
    .to(prodNode, { prop: "scale.x", from: 0.9, to: 1, start: 2.05, duration: 1.1, ease: outExpo })
    .to(prodNode, { prop: "scale.y", from: 0.9, to: 1, start: 2.05, duration: 1.1, ease: outExpo })
    // Beat 3 settles it inside the closed ring.
    .to(prodNode, { prop: "scale.x", from: 1, to: 0.675, start: 3.55, duration: 1.0, ease: inOutCubic })
    .to(prodNode, { prop: "scale.y", from: 1, to: 0.675, start: 3.55, duration: 1.0, ease: inOutCubic });

  // --- Beat 3 motif: the ring closes, a check lands on the gap ---
  if (sceneC) {
    if (showRing) {
      const closed = new Graphics()
        .circle(0, 0, R)
        .stroke({ color: accent, width: Math.max(3, R * 0.055), cap: "round" });
      closed.position.set(cx, motifCy);
      closed.scale.set(0.86);
      sceneC.addChildAt(closed, 0);
      timeline
        .to(closed, { prop: "scale.x", from: 0.86, to: 1, start: 3.75, duration: 1.0, ease: outExpo })
        .to(closed, { prop: "scale.y", from: 0.86, to: 1, start: 3.75, duration: 1.0, ease: outExpo });

      const badgeR = R * 0.24;
      const badge = new Container();
      badge.position.set(cx + Math.cos(-45 * DEG) * R, motifCy + Math.sin(-45 * DEG) * R);
      badge.addChild(new Graphics().circle(0, 0, badgeR).fill(accent));
      badge.addChild(makeIcon("check", badgeR * 1.05, { color: onAccent }));
      badge.scale.set(0);
      sceneC.addChild(badge);
      timeline
        .to(badge, { prop: "scale.x", from: 0, to: 1, start: 4.15, duration: 0.7, ease: outExpo })
        .to(badge, { prop: "scale.y", from: 0, to: 1, start: 4.15, duration: 0.7, ease: outExpo });
    }

    if (cta.length > 0) {
      const ctaSize = fitSize(fonts, cta, "display", 700, Math.round(minDim * 0.032), zone.width * 0.6);
      const ctaText = makeText(fonts, {
        text: cta,
        role: "display",
        weight: 700,
        size: ctaSize,
        color: onAccent,
        anchor: 0.5,
        align: "center",
      });
      const pillH = ctaSize * 2.3;
      const pillW = Math.min(zone.width * 0.8, ctaText.width + ctaSize * 2.6);
      const pill = new Container();
      pill.addChild(new Graphics().roundRect(-pillW / 2, -pillH / 2, pillW, pillH, pillH / 2).fill(accent));
      pill.addChild(ctaText);
      pill.position.set(cx, ctaCy);
      pill.alpha = 0;
      sceneC.addChild(pill);
      timeline
        .to(pill, { prop: "alpha", from: 0, to: 1, start: 4.2, duration: 0.7, ease: outQuad })
        .to(pill, { prop: "y", from: ctaCy + minDim * 0.024, to: ctaCy, start: 4.2, duration: 0.95, ease: outExpo });
    }
  }

  // --- Beat progress (persists across the dissolves) ---
  if (showProgress) {
    const dashW = minDim * 0.052;
    const dashH = Math.max(3, minDim * 0.005);
    const dashGap = minDim * 0.018;
    const totalW = 3 * dashW + 2 * dashGap;
    const rowLeft = cx - totalW / 2;
    const fillStart = [0.15, 2.0, 3.6];
    const fillDur = [1.5, 1.2, 1.2];
    for (let i = 0; i < 3; i++) {
      const dx = rowLeft + i * (dashW + dashGap);
      const base = new Graphics()
        .roundRect(0, -dashH / 2, dashW, dashH, dashH / 2)
        .fill({ color: muted, alpha: 0.28 });
      base.position.set(dx, progressCy);
      base.alpha = 0;
      root.addChild(base);
      timeline.to(base, { prop: "alpha", from: 0, to: 1, start: 0.1, duration: 0.5, ease: outQuad });

      const fill = new Graphics().roundRect(0, -dashH / 2, dashW, dashH, dashH / 2).fill(accent);
      fill.position.set(dx, progressCy);
      fill.scale.set(0, 1);
      root.addChild(fill);
      timeline.to(fill, {
        prop: "scale.x",
        from: 0,
        to: 1,
        start: fillStart[i] ?? 0,
        duration: fillDur[i] ?? 1.2,
        ease: inOutCubic,
      });
    }
  }

  return { timeline, duration: DURATION };
}

export const productStory: TemplateDefinition = {
  id: "product-story",
  name: "Product Story",
  tagline: "Three beats — the problem, the product, the result — dissolving into each other.",
  category: "promo",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "9:16",
  loopable: false,
  posterTime: 5.2,
  fontRoles: { beat1: "display", beat2: "display", beat3: "display", cta: "display" },
  palettes: PALETTES,
  fields: [
    {
      key: "image",
      type: "image",
      label: "Product image",
      default: "",
      optional: true,
      help: "A cut-out product works best — it carries the last two beats.",
    },
    { key: "label1", type: "text", label: "Beat 1 label", default: "The problem", maxLength: 20, shrinkToFit: true },
    {
      key: "beat1",
      type: "textarea",
      label: "Beat 1",
      default: "Mornings always\nfelt like a rush.",
      maxLength: 60,
      maxLines: 2,
    },
    { key: "label2", type: "text", label: "Beat 2 label", default: "The product", maxLength: 20, shrinkToFit: true },
    {
      key: "beat2",
      type: "textarea",
      label: "Beat 2",
      default: "Meet Aera —\na 30-second ritual.",
      maxLength: 60,
      maxLines: 2,
    },
    { key: "label3", type: "text", label: "Beat 3 label", default: "The result", maxLength: 20, shrinkToFit: true },
    {
      key: "beat3",
      type: "textarea",
      label: "Beat 3",
      default: "Calm mornings,\nevery single day.",
      maxLength: 60,
      maxLines: 2,
    },
    { key: "cta", type: "text", label: "Call to action", default: "Shop Aera", maxLength: 20, optional: true, shrinkToFit: true },
    { key: "showRing", type: "toggle", label: "Ring motif", default: true },
    { key: "showProgress", type: "toggle", label: "Beat markers", default: true },
    { key: "showWash", type: "toggle", label: "Accent wash", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
