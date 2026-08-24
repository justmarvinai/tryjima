import { Container, Graphics, FillGradient } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  inOutQuad,
  spring,
  safeRect,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;

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

// Neutral device chrome (fixed regardless of palette, like sibling device
// mockups) — only background / screen / text / accent follow the palette.
const BEZEL = "#15161B";
const NOTCH = "#0A0B0F";

// Photographic gradient pairs for the faux media blocks — content, not chrome,
// so they stay vivid on light or dark UI. Picked deterministically per block.
const PHOTO_GRADS: [string, string][] = [
  ["#FF9E7A", "#FF6F91"],
  ["#7AC0FF", "#5B7BFF"],
  ["#9F7AEA", "#C77DFF"],
  ["#5FD6A6", "#37B98C"],
  ["#FFC46B", "#FF8A4C"],
  ["#66D2E0", "#3FA9C9"],
];

const PALETTES: Palette[] = [
  { id: "aura", name: "Aura", colors: { background: "#F1ECFB", screen: "#FFFFFF", textColor: "#241452", accent: "#7C5CFF", muted: "#E6DFF5", onAccent: "#FFFFFF" } },
  { id: "sky", name: "Sky", colors: { background: "#E7F0FB", screen: "#FFFFFF", textColor: "#0F1B2A", accent: "#2E5BD6", muted: "#DEE8F6", onAccent: "#FFFFFF" } },
  { id: "mint", name: "Mint", colors: { background: "#E4F6EE", screen: "#FFFFFF", textColor: "#06301F", accent: "#12A66A", muted: "#D8EFE4", onAccent: "#FFFFFF" } },
  { id: "ink", name: "Ink", colors: { background: "#0E0E13", screen: "#191921", textColor: "#F5F5F8", accent: "#FF6A3C", muted: "#2A2A34", onAccent: "#FFFFFF" } },
];

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

interface Cfg {
  hf: number;
}
const CFG: Record<string, Cfg> = {
  "1:1": { hf: 0.88 },
  "4:5": { hf: 0.86 },
  "9:16": { hf: 0.9 },
  "16:9": { hf: 0.88 },
};

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, rng } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F1ECFB"));
  const screenBg = pc("screen", "#FFFFFF");
  const textColor = str(values.textColor, pc("textColor", "#241452"));
  const accent = str(values.accent, pc("accent", "#7C5CFF"));
  const muted = pc("muted", "#E6DFF5");
  const onAccent = pc("onAccent", "#FFFFFF");
  const appName = str(values.appName, "Aura");
  const showStatusBar = values.showStatusBar !== false;
  const showNotch = values.showNotch !== false;

  const w = size.width;
  const h = size.height;

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const safe = safeRect(ctx.aspect);
  const cfg = CFG[ctx.aspect] ?? CFG["1:1"]!;
  const deviceH = Math.min(h * cfg.hf, safe.height * 0.99);
  const deviceW = Math.min(deviceH * 0.48, safe.width * 0.99);
  const cx = w / 2;
  const cy = safe.y + safe.height / 2;

  const timeline = new JimaTimeline();

  // Entrance-scaled wrapper; phone body drawn centered at (0,0) in its space.
  const phone = new Container();
  phone.position.set(cx, cy);
  phone.alpha = 0;
  phone.scale.set(0.92);
  root.addChild(phone);

  const bezel = deviceW * 0.045;
  const bodyR = deviceW * 0.14;
  phone.addChild(new Graphics().roundRect(-deviceW / 2, -deviceH / 2 + deviceH * 0.02, deviceW, deviceH, bodyR).fill({ color: 0x000000, alpha: 0.2 }));
  phone.addChild(new Graphics().roundRect(-deviceW / 2, -deviceH / 2, deviceW, deviceH, bodyR).fill(BEZEL));

  const sx = -deviceW / 2 + bezel;
  const sy = -deviceH / 2 + bezel;
  const sw = deviceW - 2 * bezel;
  const sh = deviceH - 2 * bezel;
  const sr = Math.max(4, bodyR - bezel * 0.5);
  phone.addChild(new Graphics().roundRect(sx, sy, sw, sh, sr).fill(screenBg));

  const statusH = showStatusBar ? deviceH * 0.05 : 0;
  const headerH = deviceH * 0.088;
  const contentTop = sy + statusH + headerH;

  // --- Scrolling faux app page (drawn in screen-local coords; y-translated) ---
  const page = new Container();
  phone.addChild(page);
  const pad = sw * 0.06;
  const L = sx + pad;
  const iw = sw - pad * 2;
  let y = contentTop + pad * 0.6;
  const bar = (bx: number, by: number, bw: number, bh: number, color: string, alpha = 1): void => {
    page.addChild(new Graphics().roundRect(bx, by, bw, bh, Math.min(bh, bw) * 0.5).fill({ color, alpha }));
  };
  const media = (mx: number, my: number, mw: number, mh: number, r: number): void => {
    const [c0, c1] = rng.pick(PHOTO_GRADS);
    page.addChild(new Graphics().roundRect(mx, my, mw, mh, r).fill(linGrad(c0, c1)));
  };

  // 1) Hero banner (accent gradient) with a tag pill, headline bars, a button.
  const heroH = sw * 0.64;
  page.addChild(new Graphics().roundRect(L, y, iw, heroH, iw * 0.055).fill(linGrad(accent, accent)));
  page.addChild(new Graphics().roundRect(L, y, iw, heroH, iw * 0.055).fill({ color: "#000000", alpha: 0.08 }));
  bar(L + iw * 0.06, y + heroH * 0.12, iw * 0.26, heroH * 0.1, onAccent, 0.35);
  bar(L + iw * 0.06, y + heroH * 0.32, iw * 0.7, heroH * 0.11, onAccent, 0.95);
  bar(L + iw * 0.06, y + heroH * 0.48, iw * 0.5, heroH * 0.11, onAccent, 0.95);
  page.addChild(new Graphics().roundRect(L + iw * 0.06, y + heroH * 0.68, iw * 0.34, heroH * 0.16, heroH * 0.08).fill({ color: onAccent, alpha: 0.95 }));
  y += heroH + sw * 0.07;

  // 2) Section label + a row of category chips.
  bar(L, y, iw * 0.36, sw * 0.05, textColor, 0.85);
  y += sw * 0.05 + sw * 0.045;
  const chipW = (iw - sw * 0.06) / 3;
  for (let i = 0; i < 3; i++) {
    page.addChild(new Graphics().roundRect(L + i * (chipW + sw * 0.03), y, chipW, sw * 0.11, sw * 0.055).fill({ color: i === 0 ? accent : muted, alpha: 1 }));
  }
  y += sw * 0.11 + sw * 0.07;

  // 3) Featured media block with a play disc.
  const featH = sw * 0.52;
  media(L, y, iw, featH, iw * 0.05);
  page.addChild(new Graphics().circle(L + iw / 2, y + featH / 2, featH * 0.16).fill({ color: "#FFFFFF", alpha: 0.9 }));
  page.addChild(new Graphics().poly([-featH * 0.045, -featH * 0.07, featH * 0.075, 0, -featH * 0.045, featH * 0.07].map((v, k) => (k % 2 === 0 ? v + L + iw / 2 : v + y + featH / 2))).fill(accent));
  y += featH + sw * 0.06;

  // 4) Body text lines.
  for (const wd of [0.92, 0.82, 0.6]) {
    bar(L, y, iw * wd, sw * 0.038, textColor, 0.22);
    y += sw * 0.038 + sw * 0.035;
  }
  y += sw * 0.03;

  // 5) 2x2 card grid (media thumb + two lines each) on soft sub-panels.
  const gGap = sw * 0.05;
  const cardW = (iw - gGap) / 2;
  const cardH = sw * 0.56;
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 2; c++) {
      const gx = L + c * (cardW + gGap);
      const gy = y + r * (cardH + gGap);
      page.addChild(new Graphics().roundRect(gx, gy, cardW, cardH, cardW * 0.08).fill({ color: muted, alpha: 0.6 }));
      media(gx + cardW * 0.08, gy + cardH * 0.08, cardW * 0.84, cardH * 0.52, cardW * 0.06);
      bar(gx + cardW * 0.08, gy + cardH * 0.7, cardW * 0.72, cardH * 0.08, textColor, 0.5);
      bar(gx + cardW * 0.08, gy + cardH * 0.85, cardW * 0.5, cardH * 0.07, textColor, 0.24);
    }
  }
  y += cardH * 2 + gGap + sw * 0.07;

  // 6) CTA banner (accent) — a rich, designed final section.
  const ctaH = sw * 0.42;
  page.addChild(new Graphics().roundRect(L, y, iw, ctaH, iw * 0.06).fill(linGrad(accent, accent)));
  bar(L + iw * 0.07, y + ctaH * 0.26, iw * 0.56, ctaH * 0.14, onAccent, 0.95);
  bar(L + iw * 0.07, y + ctaH * 0.5, iw * 0.4, ctaH * 0.1, onAccent, 0.5);
  page.addChild(new Graphics().roundRect(L + iw * 0.62, y + ctaH * 0.3, iw * 0.3, ctaH * 0.4, ctaH * 0.2).fill({ color: onAccent, alpha: 0.95 }));
  y += ctaH + pad * 0.6;

  const contentBottom = y;
  const maxScroll = Math.max(0, contentBottom - (sy + sh));

  // Clip the page to the rounded screen (bottom corners clip; header covers top).
  const pageMask = new Graphics().roundRect(sx, sy, sw, sh, sr).fill(0xffffff);
  phone.addChild(pageMask);
  page.mask = pageMask;

  const SCROLL_START = 0.95;
  const SCROLL_DUR = 2.6;
  timeline.to(page, { prop: "y", from: 0, to: -maxScroll, start: SCROLL_START, duration: SCROLL_DUR, ease: inOutQuad });

  // --- Fixed sticky header (app name + avatar dot), on top of the page ---
  phone.addChild(new Graphics().rect(sx, sy + statusH, sw, headerH).fill(screenBg));
  phone.addChild(new Graphics().rect(sx, sy + statusH + headerH - Math.max(1, sh * 0.002), sw, Math.max(1, sh * 0.002)).fill({ color: textColor, alpha: 0.08 }));
  const nameSize = fitSize(fonts, appName, "display", 700, headerH * 0.4, sw * 0.5);
  const nameText = makeText(fonts, { text: appName, role: "display", weight: 700, size: nameSize, color: textColor, anchor: { x: 0, y: 0.5 } });
  nameText.position.set(sx + pad, sy + statusH + headerH / 2);
  phone.addChild(nameText);
  phone.addChild(new Graphics().circle(sx + sw - pad - headerH * 0.24, sy + statusH + headerH / 2, headerH * 0.24).fill(accent));

  // --- Fixed status bar (time + wifi + battery), on top ---
  if (showStatusBar) {
    const midY = sy + statusH * 0.56;
    const timeText = makeText(fonts, { text: "9:41", role: "display", weight: 700, size: statusH * 0.44, color: textColor, anchor: { x: 0, y: 0.5 } });
    timeText.position.set(sx + pad, midY);
    phone.addChild(timeText);
    // wifi arcs + battery on the right
    const bx = sx + sw - pad;
    phone.addChild(new Graphics().roundRect(bx - statusH * 0.5, midY - statusH * 0.16, statusH * 0.44, statusH * 0.32, statusH * 0.08).stroke({ color: textColor, width: Math.max(1.5, statusH * 0.05) }));
    phone.addChild(new Graphics().roundRect(bx - statusH * 0.46, midY - statusH * 0.11, statusH * 0.3, statusH * 0.22, statusH * 0.05).fill(textColor));
    phone.addChild(new Graphics().roundRect(bx - statusH * 0.04, midY - statusH * 0.07, statusH * 0.05, statusH * 0.14, statusH * 0.02).fill(textColor));
    for (let i = 0; i < 3; i++) {
      const bh2 = statusH * (0.14 + i * 0.1);
      phone.addChild(new Graphics().roundRect(bx - statusH * 1.0 + i * statusH * 0.16, midY + statusH * 0.16 - bh2, statusH * 0.1, bh2, statusH * 0.03).fill(textColor));
    }
  }

  // --- Notch / dynamic island ---
  if (showNotch) {
    const nW = sw * 0.34;
    const nH = statusH > 0 ? statusH * 0.66 : sh * 0.032;
    phone.addChild(new Graphics().roundRect(-nW / 2, sy + (statusH > 0 ? statusH * 0.24 : sh * 0.012), nW, nH, nH / 2).fill(NOTCH));
  }

  timeline
    .to(phone, { prop: "alpha", from: 0, to: 1, start: 0.12, duration: 0.4, ease: outQuad })
    .to(phone, { prop: "scale.x", from: 0.92, to: 1, start: 0.12, duration: 0.7, ease: spring(0.55) })
    .to(phone, { prop: "scale.y", from: 0.92, to: 1, start: 0.12, duration: 0.7, ease: spring(0.55) });

  return { timeline, duration: 4.3 };
}

export const phoneScroll: TemplateDefinition = {
  id: "phone-scroll",
  name: "Phone Scroll",
  tagline: "A phone screen scrolls through an app, settling on a hold frame.",
  category: "tech",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "9:16",
  loopable: false,
  posterTime: 3.6,
  fontRoles: { appName: "display" },
  palettes: PALETTES,
  fields: [
    { key: "appName", type: "text", label: "App name", default: "Aura", maxLength: 18, shrinkToFit: true },
    { key: "showStatusBar", type: "toggle", label: "Status bar", default: true },
    { key: "showNotch", type: "toggle", label: "Notch", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
