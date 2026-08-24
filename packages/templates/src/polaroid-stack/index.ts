import { Container, Graphics, Sprite, type Texture } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  spring,
  type Aspect,
  type BuiltTemplate,
  type MakeTextOptions,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
  type Values,
} from "@jima/engine";

const DEG = Math.PI / 180;

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const asList = (v: unknown, fb: string[]): string[] => {
  if (Array.isArray(v)) {
    const a = v.filter((x): x is string => typeof x === "string" && x.length > 0);
    if (a.length) return a;
  }
  return fb;
};

const DEFAULT_CAPTIONS = ["Golden hour", "The crew", "Day one"];

const PALETTES: Palette[] = [
  { id: "sunset", name: "Sunset", colors: { background: "#F4E9DB", accent: "#FF6A3C", textColor: "#3A2E28", card: "#FFFFFF", muted: "#B9A793", placeholder: "#ECE4DA" } },
  { id: "rosewood", name: "Rosewood", colors: { background: "#F6E7EC", accent: "#E85B7A", textColor: "#3A2630", card: "#FFFFFF", muted: "#C7A9B2", placeholder: "#EFE1E6" } },
  { id: "harbor", name: "Harbor", colors: { background: "#E7EFF6", accent: "#2E7DF6", textColor: "#24303A", card: "#FFFFFF", muted: "#A6B4C0", placeholder: "#E2E9F0" } },
  { id: "noir", name: "Noir", colors: { background: "#16151A", accent: "#D8F34D", textColor: "#2E2A32", card: "#FFFFFF", muted: "#B9AEA6", placeholder: "#ECE7E1" } },
];

interface PolaCfg {
  cardWF: number;
  cyF: number;
}

const POLA: Record<Aspect, PolaCfg> = {
  "1:1": { cardWF: 0.44, cyF: 0.52 },
  "4:5": { cardWF: 0.46, cyF: 0.5 },
  "9:16": { cardWF: 0.58, cyF: 0.46 },
  "16:9": { cardWF: 0.28, cyF: 0.55 },
};

/** A small "picture" glyph for empty polaroids. */
function imageGlyph(s: number, color: string): Graphics {
  const g = new Graphics();
  g.roundRect(-0.5 * s, -0.42 * s, s, 0.84 * s, 0.12 * s).stroke({ color, width: Math.max(2, 0.055 * s) });
  g.circle(-0.18 * s, -0.14 * s, 0.1 * s).fill(color);
  g.poly([-0.44 * s, 0.34 * s, -0.12 * s, -0.04 * s, 0.06 * s, 0.14 * s, 0.28 * s, -0.12 * s, 0.46 * s, 0.34 * s]).fill(color);
  return g;
}

/** Crisp-fit: re-make one size smaller if it would overflow maxWidth. */
function fitText(fonts: TemplateContext["fonts"], opts: MakeTextOptions, maxWidth: number) {
  const t = makeText(fonts, opts);
  if (maxWidth > 0 && t.width > maxWidth) {
    const shrunk = Math.max(8, Math.floor(opts.size * (maxWidth / t.width)));
    if (shrunk < opts.size) return makeText(fonts, { ...opts, size: shrunk });
  }
  return t;
}

function makePolaroid(
  fonts: TemplateContext["fonts"],
  tex: Texture | null,
  caption: string,
  cardW: number,
  cardH: number,
  border: number,
  photoSide: number,
  captionColor: string,
  cardC: string,
  muted: string,
  accent: string,
  placeholder: string,
  showAccentDot: boolean,
): Container {
  const card = new Container();
  const r = cardW * 0.02;
  const photoTop = -cardH / 2 + border;
  const photoCy = photoTop + photoSide / 2;

  card.addChild(new Graphics().roundRect(-cardW / 2, -cardH / 2 + cardH * 0.03, cardW, cardH, r).fill({ color: 0x000000, alpha: 0.16 }));
  card.addChild(new Graphics().roundRect(-cardW / 2, -cardH / 2, cardW, cardH, r).fill(cardC));

  if (tex) {
    const holder = new Container();
    const s = new Sprite(tex);
    s.anchor.set(0.5);
    const cover = Math.max(photoSide / tex.width, photoSide / tex.height);
    s.scale.set(cover);
    s.position.set(0, photoCy);
    const mask = new Graphics().roundRect(-photoSide / 2, photoTop, photoSide, photoSide, photoSide * 0.02).fill(0xffffff);
    holder.addChild(s, mask);
    s.mask = mask;
    card.addChild(holder);
  } else {
    card.addChild(new Graphics().roundRect(-photoSide / 2, photoTop, photoSide, photoSide, photoSide * 0.02).fill(placeholder));
    const glyph = imageGlyph(photoSide * 0.3, muted);
    glyph.position.set(0, photoCy);
    card.addChild(glyph);
  }

  // Caption strip (body font, centered under the photo).
  const capSize = Math.round(cardW * 0.108);
  const cap = fitText(
    fonts,
    { text: caption, role: "body", weight: 600, size: capSize, color: captionColor, anchor: 0.5, align: "center" },
    photoSide * 1.02,
  );
  cap.position.set(0, photoTop + photoSide + (cardH / 2 - (photoTop + photoSide)) / 2);
  card.addChild(cap);

  // Accent "pin" on the top border.
  if (showAccentDot) {
    const pinR = cardW * 0.035;
    const pin = new Graphics().circle(0, 0, pinR).fill(accent);
    pin.circle(-pinR * 0.32, -pinR * 0.32, pinR * 0.32).fill({ color: 0xffffff, alpha: 0.5 });
    pin.position.set(0, -cardH / 2 + border * 0.42);
    card.addChild(pin);
  }

  return card;
}

function captionList(values: Values): string[] {
  return asList(values.captions, DEFAULT_CAPTIONS).slice(0, 4);
}

function computeDuration(values: Values): number {
  return 1.0 + captionList(values).length * 0.4 + 1.4;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, images, rng } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F4E9DB"));
  const accent = str(values.accent, pc("accent", "#FF6A3C"));
  const captionColor = str(values.textColor, pc("textColor", "#3A2E28"));
  const cardC = pc("card", "#FFFFFF");
  const muted = pc("muted", "#B9A793");
  const placeholder = pc("placeholder", "#ECE4DA");
  const caps = captionList(values);
  const N = caps.length;
  const showAccentDot = values.accentDot !== false;

  root.addChild(new Graphics().rect(0, 0, size.width, size.height).fill(bg));

  const w = size.width;
  const h = size.height;
  const cfg = POLA[ctx.aspect];
  const cx = w / 2;
  const cy = h * cfg.cyF;
  const cardW = w * cfg.cardWF;
  const border = cardW * 0.055;
  const photoSide = cardW - border * 2;
  const captionH = cardW * 0.28;
  const cardH = border + photoSide + captionH;
  const mid = (N - 1) / 2;
  const timeline = new JimaTimeline();

  const photos: (Texture | null)[] = [
    images.photo1 ?? null,
    images.photo2 ?? null,
    images.photo3 ?? null,
    images.photo4 ?? null,
  ];

  for (let i = 0; i < N; i++) {
    const finalRot = (i - mid) * 7 * DEG + rng.range(-2, 2) * DEG;
    const finalX = cx + (i - mid) * cardW * 0.1 + rng.range(-1, 1) * cardW * 0.03;
    const finalY = cy + (i - mid) * cardH * 0.04 + rng.range(-1, 1) * cardH * 0.02;
    const startRot = finalRot + rng.range(7, 12) * DEG;
    const startY = finalY - h * 0.16;

    const card = makePolaroid(fonts, photos[i] ?? null, caps[i] ?? "", cardW, cardH, border, photoSide, captionColor, cardC, muted, accent, placeholder, showAccentDot);
    card.position.set(finalX, startY);
    card.rotation = startRot;
    card.alpha = 0;
    root.addChild(card);

    const start = 0.6 + i * 0.4;
    timeline
      .to(card, { prop: "alpha", from: 0, to: 1, start, duration: 0.4, ease: outQuad })
      .to(card, { prop: "y", from: startY, to: finalY, start, duration: 0.9, ease: spring(0.55) })
      .to(card, { prop: "rotation", from: startRot, to: finalRot, start, duration: 0.8, ease: outExpo });
  }

  return { timeline, duration: computeDuration(values) };
}

export const polaroidStack: TemplateDefinition = {
  id: "polaroid-stack",
  name: "Polaroid Stack",
  tagline: "Instant photos drop into a loose, fanned stack.",
  category: "showcase",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "4:5",
  loopable: false,
  posterTime: 2.8,
  estimateDuration: computeDuration,
  palettes: PALETTES,
  fields: [
    { key: "captions", type: "textlist", label: "Captions", default: DEFAULT_CAPTIONS, minItems: 2, maxItems: 4, maxLength: 20, help: "One caption per photo." },
    { key: "photo1", type: "image", label: "Photo 1", default: "", optional: true },
    { key: "photo2", type: "image", label: "Photo 2", default: "", optional: true },
    { key: "photo3", type: "image", label: "Photo 3", default: "", optional: true },
    { key: "photo4", type: "image", label: "Photo 4", default: "", optional: true },
    { key: "accentDot", type: "toggle", label: "Accent dot", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Caption", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
