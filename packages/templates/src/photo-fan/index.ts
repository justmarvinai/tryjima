import { Container, Graphics, Sprite, type Texture } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outQuint,
  makeOutBack,
  type Aspect,
  type BuiltTemplate,
  type FontRegistry,
  type MakeTextOptions,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";

const DEG = Math.PI / 180;
const N = 5;
const CARD_RATIO = 0.72; // width / height

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;

const PALETTES: Palette[] = [
  { id: "sunset", name: "Sunset", colors: { background: "#F4E9DB", accent: "#FF6A3C", textColor: "#3A2E28", muted: "#B9A793", placeholder: "#ECE4DA" } },
  { id: "rosewood", name: "Rosewood", colors: { background: "#F6E7EC", accent: "#E85B7A", textColor: "#3A2630", muted: "#C7A9B2", placeholder: "#EFE1E6" } },
  { id: "harbor", name: "Harbor", colors: { background: "#E7EFF6", accent: "#2E7DF6", textColor: "#24303A", muted: "#A6B4C0", placeholder: "#E2E9F0" } },
  { id: "ink", name: "Ink", colors: { background: "#16151A", accent: "#D8F34D", textColor: "#F4F1EA", muted: "#8A8690", placeholder: "#26242C" } },
];

interface FanCfg {
  cardWF: number;
  pivotYF: number;
  spreadDeg: number;
}

// Fan geometry verified per-aspect so the outer cards' rotated corners stay
// clear of every aspect's safe margin (see design notes: margins ≥ ~15%).
const FAN: Record<Aspect, FanCfg> = {
  "1:1": { cardWF: 0.33, pivotYF: 0.64, spreadDeg: 28 },
  "4:5": { cardWF: 0.33, pivotYF: 0.6, spreadDeg: 28 },
  "9:16": { cardWF: 0.37, pivotYF: 0.56, spreadDeg: 26 },
  "16:9": { cardWF: 0.19, pivotYF: 0.62, spreadDeg: 24 },
};

/** A small "picture" glyph for empty photo cards. */
function imageGlyph(s: number, color: string): Graphics {
  const g = new Graphics();
  g.roundRect(-0.5 * s, -0.42 * s, s, 0.84 * s, 0.12 * s).stroke({ color, width: Math.max(2, 0.055 * s) });
  g.circle(-0.18 * s, -0.14 * s, 0.1 * s).fill(color);
  g.poly([-0.44 * s, 0.34 * s, -0.12 * s, -0.04 * s, 0.06 * s, 0.14 * s, 0.28 * s, -0.12 * s, 0.46 * s, 0.34 * s]).fill(color);
  return g;
}

/** Crisp-fit: re-make one size smaller if it would overflow maxWidth. */
function fitText(fonts: FontRegistry, opts: MakeTextOptions, maxWidth: number) {
  const t = makeText(fonts, opts);
  if (maxWidth > 0 && t.width > maxWidth) {
    const shrunk = Math.max(8, Math.floor(opts.size * (maxWidth / t.width)));
    if (shrunk < opts.size) return makeText(fonts, { ...opts, size: shrunk });
  }
  return t;
}

/**
 * A single fan card, pivoted at its own bottom-center — placed at the shared
 * hinge point and rotated, it reads as one card in a hand-fanned stack.
 */
function makeFanCard(
  tex: Texture | null,
  cardW: number,
  cardH: number,
  muted: string,
  placeholderC: string,
  borderC: string,
  showShadow: boolean,
): Container {
  const card = new Container();
  card.pivot.set(0, cardH / 2);
  const r = cardW * 0.055;

  if (showShadow) {
    const dx = cardW * 0.035;
    const dy = cardH * 0.03;
    card.addChild(new Graphics().roundRect(-cardW / 2 + dx, -cardH + dy, cardW, cardH, r).fill({ color: 0x000000, alpha: 0.22 }));
  }

  if (tex) {
    const holder = new Container();
    const sprite = new Sprite(tex);
    sprite.anchor.set(0.5);
    const cover = Math.max(cardW / tex.width, cardH / tex.height);
    sprite.scale.set(cover);
    sprite.position.set(0, -cardH / 2);
    const mask = new Graphics().roundRect(-cardW / 2, -cardH, cardW, cardH, r).fill(0xffffff);
    holder.addChild(sprite, mask);
    sprite.mask = mask;
    card.addChild(holder);
  } else {
    card.addChild(new Graphics().roundRect(-cardW / 2, -cardH, cardW, cardH, r).fill(placeholderC));
    const glyph = imageGlyph(Math.min(cardW, cardH) * 0.3, muted);
    glyph.position.set(0, -cardH / 2);
    card.addChild(glyph);
  }
  card.addChild(new Graphics().roundRect(-cardW / 2, -cardH, cardW, cardH, r).stroke({ color: borderC, width: Math.max(1.5, cardW * 0.01), alpha: 0.55 }));
  return card;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, images, rng } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F4E9DB"));
  const accent = str(values.accent, pc("accent", "#FF6A3C"));
  const textColor = str(values.textColor, pc("textColor", "#3A2E28"));
  const muted = pc("muted", "#B9A793");
  const placeholderC = pc("placeholder", "#ECE4DA");
  const caption = str(values.caption, "Behind the scenes");
  const showShadow = values.showShadow !== false;

  const w = size.width;
  const h = size.height;

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const cfg = FAN[ctx.aspect];
  const fx = w / 2;
  const fy = h * cfg.pivotYF;
  const cardW = w * cfg.cardWF;
  const cardH = cardW / CARD_RATIO;
  const mid = (N - 1) / 2;
  const spread = cfg.spreadDeg * DEG;

  const timeline = new JimaTimeline();

  const photos: (Texture | null)[] = [
    images.photo1 ?? null,
    images.photo2 ?? null,
    images.photo3 ?? null,
    images.photo4 ?? null,
    images.photo5 ?? null,
  ];

  for (let i = 0; i < N; i++) {
    const finalRot = ((i - mid) / mid) * spread + rng.range(-1.5, 1.5) * DEG;
    const card = makeFanCard(photos[i] ?? null, cardW, cardH, muted, placeholderC, accent, showShadow);
    card.position.set(fx, fy);
    card.rotation = 0;
    card.scale.set(0.55);
    card.alpha = 0;
    root.addChild(card);

    const start = 0.3 + i * 0.16;
    timeline
      .to(card, { prop: "alpha", from: 0, to: 1, start, duration: 0.4, ease: outQuad })
      .to(card, { prop: "rotation", from: 0, to: finalRot, start, duration: 0.65, ease: makeOutBack(1.7) })
      .to(card, { prop: "scale.x", from: 0.55, to: 1, start, duration: 0.65, ease: makeOutBack(1.7) })
      .to(card, { prop: "scale.y", from: 0.55, to: 1, start, duration: 0.65, ease: makeOutBack(1.7) });
  }

  // Caption below the fan's hinge, clamped clear of each aspect's safe zone.
  if (caption.length > 0) {
    const botSafe = ctx.aspect === "9:16" ? 400 : Math.round(Math.min(w, h) * 0.06);
    const capSize = Math.round(w * (ctx.aspect === "16:9" ? 0.03 : 0.038));
    const capY = Math.min(h * 0.9, h - botSafe - capSize * 0.7);
    const capText = fitText(
      fonts,
      { text: caption, role: "body", weight: 600, size: capSize, color: textColor, anchor: 0.5, align: "center" },
      w * 0.8,
    );
    capText.position.set(fx, capY);
    capText.alpha = 0;
    root.addChild(capText);
    timeline
      .to(capText, { prop: "alpha", from: 0, to: 1, start: 1.8, duration: 0.5, ease: outQuad })
      .to(capText, { prop: "y", from: capY + 14, to: capY, start: 1.8, duration: 0.55, ease: outQuint });
  }

  return { timeline, duration: 3.6 };
}

export const photoFan: TemplateDefinition = {
  id: "photo-fan",
  name: "Photo Fan",
  tagline: "A hand of photos fans out from a single point.",
  category: "photo",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "4:5",
  loopable: false,
  posterTime: 2.5,
  fontRoles: { caption: "body" },
  palettes: PALETTES,
  fields: [
    { key: "photo1", type: "image", label: "Photo 1", default: "", optional: true },
    { key: "photo2", type: "image", label: "Photo 2", default: "", optional: true },
    { key: "photo3", type: "image", label: "Photo 3", default: "", optional: true },
    { key: "photo4", type: "image", label: "Photo 4", default: "", optional: true },
    { key: "photo5", type: "image", label: "Photo 5", default: "", optional: true },
    { key: "caption", type: "text", label: "Caption", default: "Behind the scenes", maxLength: 40, optional: true, shrinkToFit: true },
    { key: "showShadow", type: "toggle", label: "Drop shadow", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
