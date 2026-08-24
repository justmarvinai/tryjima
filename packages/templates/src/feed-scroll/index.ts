import { Container, Graphics, Sprite, FillGradient } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  fitBox,
  outQuad,
  outExpo,
  inOutQuint,
  safeRect,
  type Aspect,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { makeIcon } from "../shared/icons";
import { verticalScrimTexture } from "../shared/scrim";

// Feed Scroll — a column of social post cards glides upward inside a soft
// viewport on one long inOutQuint, decelerating to rest with the chosen post
// framed dead centre; that card then lifts a hair as its neighbours dim back.
// A feed of posts, not a website in a phone (that's phone-scroll's job).

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;
const num = (v: unknown, fallback: number): number => (typeof v === "number" && isFinite(v) ? v : fallback);

function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 1;
  const n = parseInt(m[1]!, 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}
const inkOn = (hex: string): string => (luminance(hex) < 0.56 ? "#FFFFFF" : "#14161B");

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
  return w > maxWidth ? Math.max(10, Math.floor((size0 * maxWidth) / w)) : size0;
}

// Muted editorial photo tones for the post media — content, not chrome.
const MEDIA_GRADS: [string, string][] = [
  ["#C9D5E2", "#9FB3C8"],
  ["#E4D6C8", "#C4A98F"],
  ["#CADDD3", "#9CBFAF"],
  ["#D9D0E5", "#B3A3CB"],
  ["#E6D3CC", "#C79E93"],
  ["#CCDADD", "#9FB6BB"],
];

const PALETTES: Palette[] = [
  { id: "porcelain", name: "Porcelain", colors: { background: "#EFEEEB", surface: "#F7F6F4", cardColor: "#FFFFFF", textColor: "#16181D", accent: "#1F6F5C", muted: "#DFDDD8" } },
  { id: "mist", name: "Mist", colors: { background: "#E4E9F1", surface: "#F2F5FA", cardColor: "#FFFFFF", textColor: "#101722", accent: "#2A55A5", muted: "#DAE1EC" } },
  { id: "sand", name: "Sand", colors: { background: "#EFE7DA", surface: "#F8F3EB", cardColor: "#FFFFFF", textColor: "#241D15", accent: "#9C4D1C", muted: "#E4DACB" } },
  { id: "ink", name: "Ink", colors: { background: "#08090C", surface: "#12141A", cardColor: "#1B1F27", textColor: "#F3F5F8", accent: "#86D3B6", muted: "#2C323C" } },
];

/** Viewport width as a fraction of the short edge — phone-column proportions. */
function viewportFrac(aspect: Aspect): number {
  switch (aspect) {
    case "16:9":
      return 0.52;
    case "1:1":
      return 0.62;
    case "4:5":
      return 0.66;
    case "9:16":
      return 0.82;
  }
}

const N_CARDS = 4;
const STAGE_AT = 0.05;
const SCROLL_AT = 0.5;
const SCROLL_DUR = 2.3;
const DIM_AT = 2.75;
const LIFT_AT = 2.8;
const DURATION = 4.8;

function linGrad(c0: string, c1: string): FillGradient {
  return new FillGradient({
    type: "linear",
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
    colorStops: [
      { offset: 0, color: c0 },
      { offset: 1, color: c1 },
    ],
    textureSpace: "local",
  });
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, rng } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#EFEEEB"));
  const surface = pc("surface", "#F7F6F4");
  const cardColor = str(values.cardColor, pc("cardColor", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#16181D"));
  const accent = str(values.accent, pc("accent", "#1F6F5C"));
  const muted = pc("muted", "#DFDDD8");

  const handle = str(values.handle, "@northlight");
  const meta = str(values.meta, "2h");
  const caption = str(values.caption, "Six weeks of quiet work, out today.");
  const likes = str(values.likes, "1,204 likes");
  const hi = Math.min(N_CARDS - 1, Math.max(1, Math.round(num(values.highlightPost, 3)) - 1));
  const showActions = on(values.showActions);
  const showFade = on(values.showFade);
  const showHighlight = on(values.showHighlight);

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const safe = safeRect(ctx.aspect);
  const cx = w / 2;

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // Seeded media tones, drawn up-front so toggles never reshuffle the stream.
  const grads: [string, string][] = [];
  for (let i = 0; i < N_CARDS; i++) grads.push(rng.pick(MEDIA_GRADS));

  // --- Viewport ---
  const vw = Math.min(safe.width, minDim * viewportFrac(ctx.aspect));
  const vh = Math.min(safe.height, vw * 1.9);
  const vr = vw * 0.075;
  const stageCy = safe.y + safe.height / 2;

  const stage = new Container();
  stage.position.set(cx, stageCy);
  stage.alpha = 0;
  stage.scale.set(0.955);
  root.addChild(stage);
  stage.addChild(
    new Graphics().roundRect(-vw / 2, -vh / 2 + vh * 0.012, vw, vh, vr).fill({ color: "#000000", alpha: 0.12 }),
  );
  stage.addChild(new Graphics().roundRect(-vw / 2, -vh / 2, vw, vh, vr).fill(surface));
  timeline
    .to(stage, { prop: "alpha", from: 0, to: 1, start: STAGE_AT, duration: 0.55, ease: outQuad })
    .to(stage, { prop: "scale.x", from: 0.955, to: 1, start: STAGE_AT, duration: 1.1, ease: outExpo })
    .to(stage, { prop: "scale.y", from: 0.955, to: 1, start: STAGE_AT, duration: 1.1, ease: outExpo });

  const clip = new Container();
  stage.addChild(clip);
  const inner = new Container();
  clip.addChild(inner);
  const clipMask = new Graphics().roundRect(-vw / 2, -vh / 2, vw, vh, vr).fill(0xffffff);
  clip.addChild(clipMask);
  inner.mask = clipMask;

  const column = new Container();
  inner.addChild(column);

  // --- Post-card metrics ---
  const cardW = vw * 0.9;
  const pad = cardW * 0.055;
  const headH = cardW * 0.135;
  const mediaH = cardW * 0.52;
  const actH = showActions ? cardW * 0.115 : 0;
  const capH = cardW * 0.155;
  const gapHM = pad * 0.7;
  const gapMA = showActions ? pad * 0.6 : 0;
  const gapAC = pad * 0.5;
  const cardH = pad + headH + gapHM + mediaH + gapMA + actH + gapAC + capH + pad;
  const cardR = cardW * 0.05;
  const innerW = cardW - pad * 2;
  const cardGap = vw * 0.045;
  const step = cardH + cardGap;

  const familyBody = fonts.family("body");
  const measureBody = (s: string, sz: number): number => fonts.measure(s, { family: familyBody, weight: 500, size: sz });

  const dimmed: Container[] = [];

  for (let i = 0; i < N_CARDS; i++) {
    const isHi = i === hi;
    const pair = grads[i] ?? MEDIA_GRADS[0]!;
    const box = new Container();
    const baseY = i * step + cardH / 2;
    box.position.set(0, baseY);
    column.addChild(box);

    const top = -cardH / 2;
    const leftX = -cardW / 2;

    if (isHi && showHighlight) {
      const glow = new Graphics()
        .roundRect(leftX, top + cardH * 0.016, cardW, cardH, cardR)
        .fill({ color: "#000000", alpha: 1 });
      glow.alpha = 0;
      box.addChild(glow);
      timeline.to(glow, { prop: "alpha", from: 0, to: 0.16, start: LIFT_AT, duration: 0.8, ease: outQuad });
    }
    box.addChild(new Graphics().roundRect(leftX, top, cardW, cardH, cardR).fill(cardColor));
    box.addChild(
      new Graphics()
        .roundRect(leftX, top, cardW, cardH, cardR)
        .stroke({ color: textColor, width: Math.max(1, cardW * 0.0025), alpha: 0.08 }),
    );

    // Header: avatar + handle (real text only on the framed post).
    const avR = headH * 0.42;
    const headCy = top + pad + headH / 2;
    box.addChild(new Graphics().circle(leftX + pad + avR, headCy, avR).fill(isHi ? accent : muted));
    if (isHi) {
      const initial = makeText(fonts, {
        text: handle.replace(/^@+/, "").charAt(0).toUpperCase() || "?",
        role: "display",
        weight: 700,
        size: Math.round(avR * 0.95),
        color: inkOn(accent),
        anchor: 0.5,
      });
      initial.position.set(leftX + pad + avR, headCy);
      box.addChild(initial);
      const tx = leftX + pad + avR * 2 + pad * 0.6;
      const hSize = fitSize(fonts, handle, "display", 700, Math.round(headH * 0.33), innerW * 0.6);
      const hText = makeText(fonts, { text: handle, role: "display", weight: 700, size: hSize, color: textColor, anchor: { x: 0, y: 0.5 } });
      hText.position.set(tx, headCy - headH * 0.17);
      box.addChild(hText);
      if (meta.length > 0) {
        const mSize = fitSize(fonts, meta, "body", 500, Math.round(headH * 0.25), innerW * 0.6);
        const mText = makeText(fonts, { text: meta, role: "body", weight: 500, size: mSize, color: textColor, anchor: { x: 0, y: 0.5 } });
        mText.position.set(tx, headCy + headH * 0.21);
        mText.alpha = 0.62;
        box.addChild(mText);
      }
    } else {
      const tx = leftX + pad + avR * 2 + pad * 0.6;
      box.addChild(new Graphics().roundRect(tx, headCy - headH * 0.3, innerW * 0.34, headH * 0.19, headH * 0.095).fill(muted));
      box.addChild(new Graphics().roundRect(tx, headCy + headH * 0.08, innerW * 0.2, headH * 0.15, headH * 0.075).fill({ color: muted, alpha: 0.75 }));
    }
    for (let d = 0; d < 3; d++) {
      box.addChild(
        new Graphics()
          .circle(leftX + cardW - pad - d * headH * 0.17, headCy, headH * 0.045)
          .fill({ color: textColor, alpha: 0.24 }),
      );
    }

    // Media block.
    const mediaY = top + pad + headH + gapHM;
    box.addChild(new Graphics().roundRect(leftX + pad, mediaY, innerW, mediaH, cardW * 0.035).fill(linGrad(pair[0], pair[1])));

    // Action row.
    if (showActions) {
      const actY = mediaY + mediaH + gapMA + actH / 2;
      const iconS = actH * 0.52;
      const names = ["heart", "comment", "share"] as const;
      names.forEach((n, k) => {
        const g = makeIcon(n, iconS, { color: isHi && k === 0 ? accent : textColor, holeColor: cardColor });
        if (!(isHi && k === 0)) g.alpha = 0.7;
        g.position.set(leftX + pad + iconS * 0.5 + k * iconS * 1.65, actY);
        box.addChild(g);
      });
      const bm = makeIcon("bookmark", iconS, { color: textColor });
      bm.alpha = 0.7;
      bm.position.set(leftX + cardW - pad - iconS * 0.5, actY);
      box.addChild(bm);
    }

    // Caption block.
    const capY = mediaY + mediaH + gapMA + actH + gapAC;
    if (isHi) {
      const lSize = Math.round(capH * 0.27);
      const lText = makeText(fonts, { text: likes, role: "display", weight: 700, size: lSize, color: textColor, anchor: { x: 0, y: 0 } });
      lText.position.set(leftX + pad, capY);
      box.addChild(lText);
      const cap = fitBox(caption, measureBody, {
        maxWidth: innerW,
        baseSize: Math.round(capH * 0.25),
        minSize: Math.round(capH * 0.16),
        maxLines: 2,
      });
      const capLH = Math.round(cap.fontSize * 1.3);
      cap.lines.forEach((ln, k) => {
        const t = makeText(fonts, { text: ln, role: "body", weight: 500, size: cap.fontSize, color: textColor, anchor: { x: 0, y: 0 } });
        t.position.set(leftX + pad, capY + capH * 0.42 + k * capLH);
        t.alpha = 0.78;
        box.addChild(t);
      });
    } else {
      box.addChild(new Graphics().roundRect(leftX + pad, capY + capH * 0.06, innerW * 0.3, capH * 0.17, capH * 0.085).fill(muted));
      box.addChild(new Graphics().roundRect(leftX + pad, capY + capH * 0.42, innerW * 0.86, capH * 0.15, capH * 0.075).fill({ color: muted, alpha: 0.8 }));
      box.addChild(new Graphics().roundRect(leftX + pad, capY + capH * 0.68, innerW * 0.52, capH * 0.15, capH * 0.075).fill({ color: muted, alpha: 0.8 }));
    }

    if (isHi) {
      if (showHighlight) {
        const ring = new Graphics()
          .roundRect(leftX, top, cardW, cardH, cardR)
          .stroke({ color: accent, width: Math.max(2, cardW * 0.006) });
        ring.alpha = 0;
        box.addChild(ring);
        timeline.to(ring, { prop: "alpha", from: 0, to: 0.9, start: LIFT_AT, duration: 0.8, ease: outQuad });
      }
      timeline
        .to(box, { prop: "scale.x", from: 1, to: 1.035, start: LIFT_AT, duration: 0.9, ease: outExpo })
        .to(box, { prop: "scale.y", from: 1, to: 1.035, start: LIFT_AT, duration: 0.9, ease: outExpo })
        .to(box, { prop: "y", from: baseY, to: baseY - vh * 0.008, start: LIFT_AT, duration: 0.9, ease: outExpo });
    } else {
      dimmed.push(box);
    }
  }

  // --- The scroll: one long eased glide that decelerates onto the framed post ---
  const colStart = -vh / 2 + vh * 0.035;
  const colEnd = -(hi * step + cardH / 2);
  column.y = colStart;
  timeline.to(column, { prop: "y", from: colStart, to: colEnd, start: SCROLL_AT, duration: SCROLL_DUR, ease: inOutQuint });

  if (showHighlight) {
    for (const d of dimmed) {
      timeline.to(d, { prop: "alpha", from: 1, to: 0.42, start: DIM_AT, duration: 0.85, ease: outQuad });
    }
  }

  // --- Soft edge fades so cards dissolve into the surface ---
  if (showFade) {
    const fadeH = vh * 0.09;
    const fadeBot = new Sprite(verticalScrimTexture());
    fadeBot.anchor.set(0.5);
    fadeBot.width = vw;
    fadeBot.height = fadeH;
    fadeBot.tint = surface;
    fadeBot.position.set(0, vh / 2 - fadeH / 2);
    inner.addChild(fadeBot);

    const fadeTop = new Sprite(verticalScrimTexture());
    fadeTop.anchor.set(0.5);
    fadeTop.width = vw;
    fadeTop.height = fadeH;
    fadeTop.tint = surface;
    fadeTop.position.set(0, -vh / 2 + fadeH / 2);
    fadeTop.scale.y = -fadeTop.scale.y;
    inner.addChild(fadeTop);
  }

  return { timeline, duration: DURATION };
}

export const feedScroll: TemplateDefinition = {
  id: "feed-scroll",
  name: "Feed Scroll",
  tagline: "A feed of post cards glides upward and settles, framing one highlighted post.",
  category: "social",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "9:16",
  loopable: false,
  posterTime: 4.1,
  fontRoles: { handle: "display", caption: "body", likes: "display", meta: "body" },
  palettes: PALETTES,
  fields: [
    { key: "handle", type: "text", label: "Handle", default: "@northlight", maxLength: 22, shrinkToFit: true },
    { key: "meta", type: "text", label: "Timestamp", default: "2h", maxLength: 12, shrinkToFit: true },
    { key: "likes", type: "text", label: "Likes line", default: "1,204 likes", maxLength: 20, shrinkToFit: true },
    { key: "caption", type: "textarea", label: "Caption", default: "Six weeks of quiet work, out today.", maxLength: 90, maxLines: 2 },
    { key: "highlightPost", type: "slider", label: "Framed post", default: 3, min: 2, max: 4, step: 1 },
    { key: "showActions", type: "toggle", label: "Action row", default: true },
    { key: "showHighlight", type: "toggle", label: "Highlight framing", default: true },
    { key: "showFade", type: "toggle", label: "Edge fades", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "cardColor", type: "color", label: "Post card", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
