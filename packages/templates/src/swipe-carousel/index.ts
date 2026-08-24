import { Container, Graphics, Sprite, type Texture } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  makeOutBack,
  outQuad,
  outQuint,
  outExpo,
  shrinkToFit,
  safeRect,
  type Aspect,
  type BuiltTemplate,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { pointerCursor } from "../shared/ui";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;

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

/** A small "picture" glyph (frame + sun + mountains) for empty slots. */
function photoGlyph(s: number, color: string): Graphics {
  const g = new Graphics();
  g.roundRect(-0.5 * s, -0.42 * s, s, 0.84 * s, 0.12 * s).stroke({ color, width: Math.max(2, 0.055 * s) });
  g.circle(-0.18 * s, -0.14 * s, 0.1 * s).fill(color);
  g.poly([-0.44 * s, 0.34 * s, -0.12 * s, -0.04 * s, 0.06 * s, 0.14 * s, 0.28 * s, -0.12 * s, 0.46 * s, 0.34 * s]).fill(color);
  return g;
}

const PALETTES: Palette[] = [
  { id: "cloud", name: "Cloud", colors: { background: "#F3F4F7", cardBg: "#FFFFFF", muted: "#C7CCD6", textColor: "#101014", accent: "#7C5CFF" } },
  { id: "midnight", name: "Midnight", colors: { background: "#101014", cardBg: "#1D1D24", muted: "#3A3A44", textColor: "#FFFFFF", accent: "#FF6A3D" } },
  { id: "mint", name: "Mint", colors: { background: "#EAFBF3", cardBg: "#FFFFFF", muted: "#BFE7D7", textColor: "#08221A", accent: "#12B886" } },
  { id: "sunset", name: "Sunset", colors: { background: "#241226", cardBg: "#34163A", muted: "#5C3A66", textColor: "#FFFFFF", accent: "#FF5B72" } },
];

interface CardCfg {
  cwF: number;
  ratio: number;
  cyF: number;
}

const CARD_CFG: Record<Aspect, CardCfg> = {
  "1:1": { cwF: 0.48, ratio: 1.12, cyF: 0.46 },
  "4:5": { cwF: 0.5, ratio: 1.2, cyF: 0.45 },
  "9:16": { cwF: 0.54, ratio: 1.15, cyF: 0.43 },
  "16:9": { cwF: 0.27, ratio: 1.15, cyF: 0.48 },
};

const T1 = 1.15;
const T2 = 2.7;
const TRANS_DUR = 0.5;
const DURATION = 4.5;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, images } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F3F4F7"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const accent = str(values.accent, pc("accent", "#7C5CFF"));
  const cardBg = pc("cardBg", "#FFFFFF");
  const muted = pc("muted", "#C7CCD6");
  const onAccent = luminance(accent) < 0.5 ? "#FFFFFF" : "#101014";
  const caption = str(values.caption, "");
  const showDots = on(values.showDots);
  const showCue = on(values.showSwipeCue);

  const bgRect = new Graphics().rect(0, 0, size.width, size.height).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();
  const w = size.width;
  const h = size.height;
  const safe = safeRect(ctx.aspect);
  const cx = w / 2;

  const cfg = CARD_CFG[ctx.aspect];
  const cardW = w * cfg.cwF;
  const cardH = cardW * cfg.ratio;
  const cardCy = h * cfg.cyF;
  const cardR = Math.min(cardW, cardH) * 0.07;
  const spacing = cardW * 0.74;
  const peekScale = 0.86;
  const peekAlpha = 0.55;

  const cluster = new Container();
  cluster.sortableChildren = true;
  root.addChild(cluster);

  const imgs: (Texture | null)[] = [images.image1 ?? null, images.image2 ?? null, images.image3 ?? null];

  function makeCard(tex: Texture | null, index: number): Container {
    const c = new Container();
    c.addChild(new Graphics().roundRect(-cardW / 2, -cardH / 2 + cardH * 0.04, cardW, cardH, cardR).fill({ color: 0x000000, alpha: 0.16 }));
    c.addChild(new Graphics().roundRect(-cardW / 2, -cardH / 2, cardW, cardH, cardR).fill(cardBg));
    if (tex) {
      const holder = new Container();
      const sprite = new Sprite(tex);
      sprite.anchor.set(0.5);
      const cover = Math.max(cardW / tex.width, cardH / tex.height);
      sprite.scale.set(cover);
      const mask = new Graphics().roundRect(-cardW / 2, -cardH / 2, cardW, cardH, cardR).fill(0xffffff);
      holder.addChild(sprite, mask);
      sprite.mask = mask;
      c.addChild(holder);
    } else {
      const glyph = photoGlyph(Math.min(cardW, cardH) * 0.32, muted);
      glyph.position.set(0, -cardH * 0.03);
      c.addChild(glyph);
      // Numbered badge — only on empty slots, doubling as a "which slide" label.
      const badgeR = Math.min(cardW, cardH) * 0.075;
      const badge = new Container();
      badge.addChild(new Graphics().circle(0, 0, badgeR).fill(accent));
      badge.addChild(makeText(fonts, { text: String(index + 1), role: "display", weight: 700, size: badgeR * 1.05, color: onAccent, anchor: 0.5 }));
      badge.position.set(-cardW / 2 + badgeR * 1.5, -cardH / 2 + badgeR * 1.5);
      c.addChild(badge);
    }
    c.addChild(new Graphics().roundRect(-cardW / 2, -cardH / 2, cardW, cardH, cardR).stroke({ color: 0xffffff, width: Math.max(1, cardW * 0.004), alpha: 0.16 }));
    return c;
  }

  const restX = {
    hiddenLeft: cx - spacing * 2,
    left: cx - spacing,
    center: cx,
    right: cx + spacing,
    hiddenRight: cx + spacing * 2,
  };

  const cards: Container[] = imgs.map((tex, i) => {
    const c = makeCard(tex, i);
    c.position.set(cx, cardCy);
    cluster.addChild(c);
    return c;
  });

  const card0 = cards[0]!;
  const card1 = cards[1]!;
  const card2 = cards[2]!;

  // --- Initial roles: card0 centered (hero), card1 peeks right, card2 hidden ---
  card0.position.set(restX.center, cardCy);
  card0.scale.set(0.85);
  card0.alpha = 0;
  card0.zIndex = 3;
  timeline
    .to(card0, { prop: "alpha", from: 0, to: 1, start: 0.08, duration: 0.32, ease: outQuad })
    .to(card0, { prop: "scale.x", from: 0.85, to: 1, start: 0.08, duration: 0.55, ease: makeOutBack(1.6) })
    .to(card0, { prop: "scale.y", from: 0.85, to: 1, start: 0.08, duration: 0.55, ease: makeOutBack(1.6) });

  card1.position.set(restX.right, cardCy);
  card1.scale.set(0.6);
  card1.alpha = 0;
  card1.zIndex = 2;
  timeline
    .to(card1, { prop: "alpha", from: 0, to: peekAlpha, start: 0.22, duration: 0.32, ease: outQuad })
    .to(card1, { prop: "scale.x", from: 0.6, to: peekScale, start: 0.22, duration: 0.5, ease: makeOutBack(1.6) })
    .to(card1, { prop: "scale.y", from: 0.6, to: peekScale, start: 0.22, duration: 0.5, ease: makeOutBack(1.6) });

  card2.position.set(restX.hiddenRight, cardCy);
  card2.scale.set(peekScale * 0.92);
  card2.alpha = 0;
  card2.zIndex = 1;

  // --- Transition 1: card0 -> LEFT, card1 -> CENTER, card2 -> RIGHT ---
  timeline
    .to(card0, { prop: "x", from: restX.center, to: restX.left, start: T1, duration: TRANS_DUR, ease: outQuint })
    .to(card0, { prop: "scale.x", from: 1, to: peekScale, start: T1, duration: TRANS_DUR, ease: outQuad })
    .to(card0, { prop: "scale.y", from: 1, to: peekScale, start: T1, duration: TRANS_DUR, ease: outQuad })
    .to(card0, { prop: "alpha", from: 1, to: peekAlpha, start: T1, duration: TRANS_DUR, ease: outQuad })
    .to(card1, { prop: "x", from: restX.right, to: restX.center, start: T1, duration: TRANS_DUR, ease: outQuint })
    .to(card1, { prop: "scale.x", from: peekScale, to: 1, start: T1, duration: TRANS_DUR, ease: outQuad })
    .to(card1, { prop: "scale.y", from: peekScale, to: 1, start: T1, duration: TRANS_DUR, ease: outQuad })
    .to(card1, { prop: "alpha", from: peekAlpha, to: 1, start: T1, duration: TRANS_DUR, ease: outQuad })
    .to(card2, { prop: "x", from: restX.hiddenRight, to: restX.right, start: T1, duration: TRANS_DUR, ease: outQuint })
    .to(card2, { prop: "scale.x", from: peekScale * 0.92, to: peekScale, start: T1, duration: TRANS_DUR, ease: outQuad })
    .to(card2, { prop: "scale.y", from: peekScale * 0.92, to: peekScale, start: T1, duration: TRANS_DUR, ease: outQuad })
    .to(card2, { prop: "alpha", from: 0, to: peekAlpha, start: T1, duration: TRANS_DUR, ease: outQuad })
    .set(card0, "zIndex", 1, T1)
    .set(card1, "zIndex", 3, T1)
    .set(card2, "zIndex", 2, T1);

  // --- Transition 2: card0 -> hidden, card1 -> LEFT, card2 -> CENTER ---
  timeline
    .to(card0, { prop: "x", from: restX.left, to: restX.hiddenLeft, start: T2, duration: TRANS_DUR, ease: outQuint })
    .to(card0, { prop: "alpha", from: peekAlpha, to: 0, start: T2, duration: TRANS_DUR, ease: outQuad })
    .to(card1, { prop: "x", from: restX.center, to: restX.left, start: T2, duration: TRANS_DUR, ease: outQuint })
    .to(card1, { prop: "scale.x", from: 1, to: peekScale, start: T2, duration: TRANS_DUR, ease: outQuad })
    .to(card1, { prop: "scale.y", from: 1, to: peekScale, start: T2, duration: TRANS_DUR, ease: outQuad })
    .to(card1, { prop: "alpha", from: 1, to: peekAlpha, start: T2, duration: TRANS_DUR, ease: outQuad })
    .to(card2, { prop: "x", from: restX.right, to: restX.center, start: T2, duration: TRANS_DUR, ease: outQuint })
    .to(card2, { prop: "scale.x", from: peekScale, to: 1, start: T2, duration: TRANS_DUR, ease: outQuad })
    .to(card2, { prop: "scale.y", from: peekScale, to: 1, start: T2, duration: TRANS_DUR, ease: outQuad })
    .to(card2, { prop: "alpha", from: peekAlpha, to: 1, start: T2, duration: TRANS_DUR, ease: outQuad })
    .set(card1, "zIndex", 1, T2)
    .set(card2, "zIndex", 3, T2);

  // --- Page dots ---
  if (showDots) {
    const dotR = Math.min(w, h) * 0.009;
    const dotGap = dotR * 3.4;
    const dotsY = cardCy + cardH / 2 + dotR * 6;
    const dotsW = 2 * dotGap;
    const activeW = dotR * 2.7;
    const dots: Graphics[] = [];
    for (let i = 0; i < 3; i++) {
      const holder = new Container();
      holder.addChild(new Graphics().circle(0, 0, dotR).fill(muted));
      const activeDot = new Graphics().roundRect(-activeW / 2, -dotR, activeW, dotR * 2, dotR).fill(accent);
      activeDot.alpha = i === 0 ? 1 : 0;
      holder.addChild(activeDot);
      holder.position.set(cx - dotsW / 2 + i * dotGap, dotsY);
      holder.scale.set(0);
      root.addChild(holder);
      dots.push(activeDot);
      const st = 0.32 + i * 0.05;
      timeline
        .to(holder, { prop: "scale.x", from: 0, to: 1, start: st, duration: 0.4, ease: makeOutBack(2) })
        .to(holder, { prop: "scale.y", from: 0, to: 1, start: st, duration: 0.4, ease: makeOutBack(2) });
    }
    const [dot0, dot1, dot2] = dots as [Graphics, Graphics, Graphics];
    timeline
      .to(dot0, { prop: "alpha", from: 1, to: 0, start: T1, duration: 0.25, ease: outQuad })
      .to(dot1, { prop: "alpha", from: 0, to: 1, start: T1, duration: 0.25, ease: outQuad })
      .to(dot1, { prop: "alpha", from: 1, to: 0, start: T2, duration: 0.25, ease: outQuad })
      .to(dot2, { prop: "alpha", from: 0, to: 1, start: T2, duration: 0.25, ease: outQuad });
  }

  // --- Swipe cue: a small cursor nudges left, once before each transition ---
  if (showCue) {
    const cueSize = Math.min(w, h) * 0.06;
    const cueDist = cueSize * 1.1;
    const cueY = cardCy + cardH * 0.28;
    const cueX0 = cx + cardW * 0.14;
    const addCue = (start: number): void => {
      const cur = pointerCursor(cueSize, "#FFFFFF", "#101014");
      cur.rotation = -0.4;
      cur.position.set(cueX0, cueY);
      cur.alpha = 0;
      root.addChild(cur);
      timeline
        .to(cur, { prop: "alpha", from: 0, to: 0.92, start, duration: 0.15, ease: outQuad })
        .to(cur, { prop: "x", from: cueX0, to: cueX0 - cueDist, start, duration: 0.4, ease: outQuad })
        .to(cur, { prop: "alpha", from: 0.92, to: 0, start: start + 0.35, duration: 0.15, ease: outQuad });
    };
    addCue(T1 - 0.6);
    addCue(T2 - 0.6);
  }

  // --- Optional caption above the carousel ---
  if (caption.length > 0) {
    const capBase = Math.round(Math.min(w, h) * 0.052);
    const familyDisplay = fonts.family("display");
    const measureCap = (s: string, sz: number): number => fonts.measure(s, { family: familyDisplay, weight: 700, size: sz });
    const capSize = shrinkToFit(caption, measureCap, { maxWidth: safe.width * 0.86, baseSize: capBase, minSize: Math.round(capBase * 0.6) });
    const capY = Math.max(safe.y + capSize * 0.7, cardCy - cardH / 2 - capSize * 1.6);
    const capText = makeText(fonts, { text: caption, role: "display", weight: 700, size: capSize, color: textColor, anchor: 0.5, align: "center" });
    capText.position.set(cx, capY + 20);
    capText.alpha = 0;
    root.addChild(capText);
    timeline
      .to(capText, { prop: "alpha", from: 0, to: 1, start: 0.1, duration: 0.5, ease: outQuad })
      .to(capText, { prop: "y", from: capY + 20, to: capY, start: 0.1, duration: 0.55, ease: outExpo });
  }

  return { timeline, duration: DURATION };
}

export const swipeCarousel: TemplateDefinition = {
  id: "swipe-carousel",
  name: "Swipe Carousel",
  tagline: "A peeking carousel auto-advances through your slides, dots and all.",
  category: "social",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "9:16",
  loopable: false,
  posterTime: 3.3,
  fontRoles: { caption: "display" },
  palettes: PALETTES,
  fields: [
    { key: "image1", type: "image", label: "Slide 1", default: "", optional: true },
    { key: "image2", type: "image", label: "Slide 2", default: "", optional: true },
    { key: "image3", type: "image", label: "Slide 3", default: "", optional: true },
    { key: "caption", type: "text", label: "Caption", default: "", maxLength: 40, optional: true, shrinkToFit: true },
    { key: "showDots", type: "toggle", label: "Page dots", default: true },
    { key: "showSwipeCue", type: "toggle", label: "Swipe cue", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Caption color", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
