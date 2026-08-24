import { Container, Graphics, Sprite, type Texture } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  safeZone,
  outQuad,
  outQuint,
  inQuad,
  spring,
  makeOutBack,
  type BuiltTemplate,
  type MakeTextOptions,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { makeIcon } from "../shared/icons";
import { verticalScrimTexture } from "../shared/scrim";

const DEG = Math.PI / 180;
const N = 4; // photo cards in the stack (3 swipes leave the last one standing)
const CARD_RATIO = 0.74; // width / height

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const asList = (v: unknown, fb: string[]): string[] => {
  if (Array.isArray(v)) {
    const a = v.filter((x): x is string => typeof x === "string" && x.length > 0);
    if (a.length) return a;
  }
  return fb;
};

const DEFAULT_NAMES = ["Alex · 27", "Jordan · 24", "Sam · 29", "Casey · 26"];
// Fixed neutral for the cue glyphs themselves — some palette accent/muted
// tones (e.g. a bright lime accent or a pale muted tan) read poorly against a
// white button when used as the glyph fill; the ring stroke still carries the
// palette color, at low visual stakes since it's a thin decorative outline.
const ICON_INK = "#3A3A42";

// textColor defaults to white in every palette: the only text (the name tag)
// always sits on a dark bottom-scrim over the photo, never on `background`.
const PALETTES: Palette[] = [
  { id: "sunset", name: "Sunset", colors: { background: "#F4E9DB", accent: "#FF6A3C", textColor: "#FFFFFF", muted: "#B9A793", placeholder: "#ECE4DA" } },
  { id: "rosewood", name: "Rosewood", colors: { background: "#F6E7EC", accent: "#E85B7A", textColor: "#FFFFFF", muted: "#C7A9B2", placeholder: "#EFE1E6" } },
  { id: "harbor", name: "Harbor", colors: { background: "#E7EFF6", accent: "#2E7DF6", textColor: "#FFFFFF", muted: "#A6B4C0", placeholder: "#E2E9F0" } },
  { id: "ink", name: "Ink", colors: { background: "#16151A", accent: "#D8F34D", textColor: "#FFFFFF", muted: "#8A8690", placeholder: "#26242C" } },
];

/** A small "picture" glyph for empty cards. */
function imageGlyph(s: number, color: string): Graphics {
  const g = new Graphics();
  g.roundRect(-0.5 * s, -0.42 * s, s, 0.84 * s, 0.12 * s).stroke({ color, width: Math.max(2, 0.055 * s) });
  g.circle(-0.18 * s, -0.14 * s, 0.1 * s).fill(color);
  g.poly([-0.44 * s, 0.34 * s, -0.12 * s, -0.04 * s, 0.06 * s, 0.14 * s, 0.28 * s, -0.12 * s, 0.46 * s, 0.34 * s]).fill(color);
  return g;
}

/** A simple "×" glyph (reject), stroked, centered at origin. */
function makeXIcon(size: number, color: string): Graphics {
  const k = size * 0.32;
  return new Graphics()
    .moveTo(-k, -k)
    .lineTo(k, k)
    .moveTo(k, -k)
    .lineTo(-k, k)
    .stroke({ color, width: Math.max(2, size * 0.13), cap: "round" });
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

/** A dating-app style photo card: cover-fit photo (or placeholder) + a bottom-scrim name tag. */
function makeCard(
  fonts: TemplateContext["fonts"],
  tex: Texture | null,
  name: string,
  cardW: number,
  cardH: number,
  placeholderC: string,
  muted: string,
  accent: string,
  nameColor: string,
): Container {
  const card = new Container();
  const r = cardW * 0.06;
  card.addChild(new Graphics().roundRect(-cardW / 2, -cardH / 2 + cardH * 0.045, cardW, cardH, r).fill({ color: 0x000000, alpha: 0.2 }));

  const holder = new Container();
  const mask = new Graphics().roundRect(-cardW / 2, -cardH / 2, cardW, cardH, r).fill(0xffffff);
  if (tex) {
    const sprite = new Sprite(tex);
    sprite.anchor.set(0.5);
    const cover = Math.max(cardW / tex.width, cardH / tex.height);
    sprite.scale.set(cover);
    holder.addChild(sprite);
  } else {
    holder.addChild(new Graphics().roundRect(-cardW / 2, -cardH / 2, cardW, cardH, r).fill(placeholderC));
    const glyph = imageGlyph(Math.min(cardW, cardH) * 0.26, muted);
    glyph.position.set(0, -cardH * 0.08);
    holder.addChild(glyph);
  }
  holder.mask = mask;
  card.addChild(holder, mask);

  if (name.length > 0) {
    const scrimH = cardH * 0.3;
    const scrimHolder = new Container();
    const scrim = new Sprite(verticalScrimTexture());
    scrim.tint = "#08080B";
    scrim.width = cardW;
    scrim.height = scrimH;
    scrim.position.set(-cardW / 2, cardH / 2 - scrimH);
    scrim.alpha = 0.88;
    const scrimMask = new Graphics().roundRect(-cardW / 2, -cardH / 2, cardW, cardH, r).fill(0xffffff);
    scrimHolder.addChild(scrim, scrimMask);
    scrim.mask = scrimMask;
    card.addChild(scrimHolder);

    const nameText = fitText(
      fonts,
      { text: name, role: "display", weight: 700, size: Math.round(cardW * 0.076), color: nameColor, anchor: { x: 0, y: 1 } },
      cardW * 0.86,
    );
    nameText.position.set(-cardW / 2 + cardW * 0.07, cardH / 2 - cardH * 0.06);
    card.addChild(nameText);
  }

  card.addChild(new Graphics().roundRect(-cardW / 2, -cardH / 2, cardW, cardH, r).stroke({ color: accent, width: Math.max(1.5, cardW * 0.008), alpha: 0.4 }));
  return card;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, images, rng } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F4E9DB"));
  const accent = str(values.accent, pc("accent", "#FF6A3C"));
  const textColor = str(values.textColor, pc("textColor", "#FFFFFF"));
  const muted = pc("muted", "#B9A793");
  const placeholderC = pc("placeholder", "#ECE4DA");
  const names = asList(values.names, DEFAULT_NAMES);
  const showCue = values.showSwipeCue !== false;

  const w = size.width;
  const h = size.height;

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  // Vertically center [stack + optional cue row] within the aspect's safe band.
  const zone = safeZone(ctx.aspect);
  const bandTop = zone.top;
  const bandBottom = h - zone.bottom;
  const bandH = bandBottom - bandTop;
  const cx = w / 2;

  let cardH = bandH * 0.72;
  let cardW = cardH * CARD_RATIO;
  const maxCardW = w * 0.55;
  if (cardW > maxCardW) {
    cardW = maxCardW;
    cardH = cardW / CARD_RATIO;
  }
  const cueR = cardW * 0.11;
  const CUE_GAP_F = 0.08;
  const cueBlockH = showCue ? bandH * CUE_GAP_F + cueR * 2 : 0;
  const totalH = cardH + cueBlockH;
  const contentTop = bandTop + Math.max(0, (bandH - totalH) / 2);
  const cy = contentTop + cardH / 2;
  const cueY = contentTop + cardH + bandH * CUE_GAP_F + cueR;

  const PEEK_Y = cardH * 0.05;
  const PEEK_SCALE = 0.045;
  const depthPos = (depth: number): { y: number; scale: number } => {
    const d = Math.max(0, depth);
    return { y: cy - d * PEEK_Y, scale: 1 - d * PEEK_SCALE };
  };

  const timeline = new JimaTimeline();
  const photos: (Texture | null)[] = [images.photo1 ?? null, images.photo2 ?? null, images.photo3 ?? null, images.photo4 ?? null];

  const SWIPE0_START = 0.7;
  const GAP = 0.75;
  const SWIPE_DUR = 0.5;
  const PROMOTE_DUR = 0.5;
  const swipeStarts = Array.from({ length: N - 1 }, (_, k) => SWIPE0_START + k * GAP);

  const cards: Container[] = [];
  for (let i = 0; i < N; i++) {
    const restRot = i === 0 ? 0 : rng.range(-3, 3) * DEG;
    const start0 = depthPos(i);
    const card = makeCard(fonts, photos[i] ?? null, names[i] ?? "", cardW, cardH, placeholderC, muted, accent, textColor);
    card.position.set(cx, start0.y);
    card.scale.set(start0.scale);
    card.rotation = restRot;
    card.alpha = 0;
    cards.push(card);

    // Entrance: pops in at its own resting depth (alpha + scale only — never
    // touches y/rotation, so later promote/swipe tweens never double-write).
    timeline
      .to(card, { prop: "alpha", from: 0, to: 1, start: 0, duration: 0.4, ease: outQuad })
      .to(card, { prop: "scale.x", from: start0.scale * 0.85, to: start0.scale, start: 0, duration: 0.45, ease: spring(0.5) })
      .to(card, { prop: "scale.y", from: start0.scale * 0.85, to: start0.scale, start: 0, duration: 0.45, ease: spring(0.5) });

    // Promotions: one step closer to front each time an earlier card swipes.
    for (let k = 0; k < i && k < N - 1; k++) {
      const fromDepth = i - k;
      const toDepth = i - k - 1;
      const from = depthPos(fromDepth);
      const to = depthPos(toDepth);
      const start = swipeStarts[k]!;
      timeline
        .to(card, { prop: "y", from: from.y, to: to.y, start, duration: PROMOTE_DUR, ease: spring(0.55) })
        .to(card, { prop: "scale.x", from: from.scale, to: to.scale, start, duration: PROMOTE_DUR, ease: spring(0.55) })
        .to(card, { prop: "scale.y", from: from.scale, to: to.scale, start, duration: PROMOTE_DUR, ease: spring(0.55) });
      if (toDepth === 0 && restRot !== 0) {
        timeline.to(card, { prop: "rotation", from: restRot, to: 0, start, duration: PROMOTE_DUR, ease: outQuint });
      }
    }

    // Swipe-out: every card except the last flicks away once it reaches front.
    if (i < N - 1) {
      const dir = i % 2 === 0 ? 1 : -1;
      const start = swipeStarts[i]!;
      const front = depthPos(0);
      timeline
        .to(card, { prop: "x", from: cx, to: cx + dir * w * 0.8, start, duration: SWIPE_DUR, ease: inQuad })
        .to(card, { prop: "y", from: front.y, to: front.y - cardH * 0.16, start, duration: SWIPE_DUR, ease: outQuad })
        .to(card, { prop: "rotation", from: 0, to: dir * 22 * DEG, start, duration: SWIPE_DUR, ease: inQuad })
        .to(card, { prop: "alpha", from: 1, to: 0, start, duration: SWIPE_DUR, ease: inQuad });
    }
  }
  // Add back-to-front so the logically-frontmost card always renders on top —
  // this also happens to be correct while a card is mid-swipe over the one
  // it's revealing (it should visually pass over it).
  for (let i = N - 1; i >= 0; i--) root.addChild(cards[i]!);

  // --- Swipe cue: reject (×) / like (heart) buttons, pulsing with each swipe ---
  if (showCue) {
    const gapX = cardW * 0.36;
    const reject = new Container();
    reject.addChild(new Graphics().circle(0, 0, cueR).fill("#FFFFFF"));
    reject.addChild(new Graphics().circle(0, 0, cueR).stroke({ color: muted, width: Math.max(2, cueR * 0.09), alpha: 0.65 }));
    reject.addChild(makeXIcon(cueR * 0.95, ICON_INK));
    reject.position.set(cx - gapX, cueY);
    reject.scale.set(0);
    reject.alpha = 0;

    const like = new Container();
    like.addChild(new Graphics().circle(0, 0, cueR).fill("#FFFFFF"));
    like.addChild(new Graphics().circle(0, 0, cueR).stroke({ color: accent, width: Math.max(2, cueR * 0.09), alpha: 0.75 }));
    like.addChild(makeIcon("heart", cueR * 1.05, { color: ICON_INK }));
    like.position.set(cx + gapX, cueY);
    like.scale.set(0);
    like.alpha = 0;

    root.addChild(reject, like);
    timeline
      .to(reject, { prop: "alpha", from: 0, to: 1, start: 0.15, duration: 0.35, ease: outQuad })
      .to(reject, { prop: "scale.x", from: 0, to: 1, start: 0.15, duration: 0.4, ease: makeOutBack(1.8) })
      .to(reject, { prop: "scale.y", from: 0, to: 1, start: 0.15, duration: 0.4, ease: makeOutBack(1.8) })
      .to(like, { prop: "alpha", from: 0, to: 1, start: 0.22, duration: 0.35, ease: outQuad })
      .to(like, { prop: "scale.x", from: 0, to: 1, start: 0.22, duration: 0.4, ease: makeOutBack(1.8) })
      .to(like, { prop: "scale.y", from: 0, to: 1, start: 0.22, duration: 0.4, ease: makeOutBack(1.8) });

    // Punctuate every swipe: right-flicks pulse the heart, left-flicks the ×.
    swipeStarts.forEach((st, i) => {
      const dir = i % 2 === 0 ? 1 : -1;
      const target = dir > 0 ? like : reject;
      timeline
        .to(target, { prop: "scale.x", from: 1, to: 1.22, start: st, duration: 0.14, ease: outQuad })
        .to(target, { prop: "scale.x", from: 1.22, to: 1, start: st + 0.14, duration: 0.24, ease: outQuad })
        .to(target, { prop: "scale.y", from: 1, to: 1.22, start: st, duration: 0.14, ease: outQuad })
        .to(target, { prop: "scale.y", from: 1.22, to: 1, start: st + 0.14, duration: 0.24, ease: outQuad });
    });
  }

  return { timeline, duration: 4.0 };
}

export const photoStackSwipe: TemplateDefinition = {
  id: "photo-stack-swipe",
  name: "Photo Stack Swipe",
  tagline: "A stack of photos swipes away, dating-app style.",
  category: "photo",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "4:5",
  loopable: false,
  posterTime: 2.9,
  fontRoles: { names: "display" },
  palettes: PALETTES,
  fields: [
    { key: "photo1", type: "image", label: "Photo 1", default: "", optional: true },
    { key: "photo2", type: "image", label: "Photo 2", default: "", optional: true },
    { key: "photo3", type: "image", label: "Photo 3", default: "", optional: true },
    { key: "photo4", type: "image", label: "Photo 4", default: "", optional: true, help: "The last card — it stays on top when the swiping ends." },
    { key: "names", type: "textlist", label: "Name tags", default: DEFAULT_NAMES, minItems: 4, maxItems: 4, maxLength: 20, help: "One per card, shown over the bottom of each photo." },
    { key: "showSwipeCue", type: "toggle", label: "Swipe buttons", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Name tag text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
