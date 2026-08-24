import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outQuint,
  spring,
  makeOutBack,
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
const on = (v: unknown): boolean => v !== false;

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

function relLum(hex: string): number {
  const h = hex.replace("#", "");
  const n = h.length >= 6 ? h.slice(0, 6) : h.padEnd(6, h.slice(-1) || "0");
  const c = [0, 2, 4].map((i) => {
    const v = parseInt(n.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
}
const contrastRatio = (a: string, b: string): number => {
  const la = relLum(a);
  const lb = relLum(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};
const readableOn = (bg: string): string =>
  contrastRatio("#FFFFFF", bg) >= contrastRatio("#111318", bg) * 0.9 ? "#FFFFFF" : "#111318";

// Celebratory palettes. Headline / names stay in textColor (>= 4.5:1 on bg); the
// accent drives the milestone badge + confetti burst.
const PALETTES: Palette[] = [
  { id: "gold-cream", name: "Gold + cream", colors: { background: "#FDF6EA", textColor: "#2A1D0A", accent: "#B98A1E" } },
  { id: "rose", name: "Rose", colors: { background: "#FFEDF1", textColor: "#3A0F20", accent: "#D8446E" } },
  { id: "teal", name: "Teal", colors: { background: "#E7F6F3", textColor: "#0C2E2A", accent: "#0E9C86" } },
  { id: "plum-night", name: "Plum night", colors: { background: "#1E1230", textColor: "#F7ECFF", accent: "#C77BFF" } },
];

// Festive confetti (decorative; accent is blended in so a recolor still ties in).
const CONFETTI = ["#FFC24B", "#4FC3F7", "#7CDB8A", "#FF6AD5", "#FF5C7A"];

const DURATION = 4.6;

interface Confetto {
  g: Graphics;
  ox: number;
  oy: number;
  vx: number;
  vy: number;
  rot0: number;
  spin: number;
  delay: number;
  life: number;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, rng } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FDF6EA"));
  const textColor = str(values.textColor, pc("textColor", "#2A1D0A"));
  const accent = str(values.accent, pc("accent", "#B98A1E"));
  const accentInk = readableOn(accent);

  const occasion = str(values.occasion, "Happy Anniversary");
  const names = str(values.names, "Alex & Sam");
  const yearsRaw = (typeof values.years === "string" ? values.years : "5").trim() || "5";
  const showConfetti = on(values.showConfetti);

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const cx = w / 2;
  const zone = safeRect(ctx.aspect);
  const maxW = zone.width * 0.92;

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Confetti burst (behind the text) — pure projectile update(t) ---
  const originX = cx;
  const originY = zone.y + zone.height * 0.32;
  const confetti: Confetto[] = [];
  if (showConfetti) {
    const N = 48;
    for (let i = 0; i < N; i++) {
      const col = rng.next() < 0.5 ? accent : (CONFETTI[rng.int(0, CONFETTI.length - 1)] ?? accent);
      const long = rng.next() < 0.5;
      const cw = minDim * rng.range(0.018, 0.032);
      const ch = long ? cw * 0.42 : cw;
      const g = new Graphics().roundRect(-cw / 2, -ch / 2, cw, ch, Math.min(cw, ch) * 0.3).fill(col);
      g.alpha = 0;
      root.addChild(g);
      const ang = rng.range(-Math.PI * 0.92, -Math.PI * 0.08);
      const speed = minDim * rng.range(0.5, 1.2);
      confetti.push({
        g,
        ox: originX + minDim * rng.range(-0.06, 0.06),
        oy: originY + minDim * rng.range(-0.03, 0.03),
        vx: Math.cos(ang) * speed,
        vy: Math.sin(ang) * speed,
        rot0: rng.range(0, Math.PI * 2),
        spin: rng.range(-7, 7),
        delay: rng.range(0, 0.22),
        life: rng.range(1.8, 2.8),
      });
    }
  }
  const grav = minDim * 1.3;
  const update = (t: number): void => {
    for (const p of confetti) {
      const tau = t - p.delay;
      if (tau <= 0) {
        p.g.alpha = 0;
        continue;
      }
      p.g.position.set(p.ox + p.vx * tau, p.oy + p.vy * tau + 0.5 * grav * tau * tau);
      p.g.rotation = p.rot0 + p.spin * tau;
      const fadeIn = Math.min(1, tau / 0.12);
      const fadeOut = tau > p.life ? Math.max(0, 1 - (tau - p.life) / 0.5) : 1;
      p.g.alpha = 0.95 * fadeIn * fadeOut;
    }
  };

  // --- Vertical stack: occasion · [big years badge] · names ---
  const gap = minDim * 0.045;
  const badgeR = minDim * 0.135;
  const occFont = fitSize(fonts, occasion, "body", 600, Math.round(minDim * 0.04), maxW);
  const namesFont = fitSize(fonts, names, "display", 700, Math.round(minDim * 0.066), maxW * 0.95);
  const namesH = Math.round(namesFont * 1.1);

  const totalH = occFont + gap + badgeR * 2 + gap + namesH;
  let cursorY = zone.y + zone.height / 2 - totalH / 2;

  // Occasion (kicker).
  const occY = cursorY + occFont / 2;
  const occText = makeText(fonts, { text: occasion, role: "body", weight: 600, size: occFont, color: textColor, anchor: 0.5, letterSpacing: 2 });
  occText.position.set(cx, occY);
  occText.alpha = 0;
  root.addChild(occText);
  timeline
    .to(occText, { prop: "alpha", from: 0, to: 0.9, start: 0.1, duration: 0.45, ease: outQuad })
    .to(occText, { prop: "y", from: occY - 10, to: occY, start: 0.1, duration: 0.5, ease: outQuint });
  cursorY += occFont + gap;

  // Big "N Years" badge.
  const badgeCy = cursorY + badgeR;
  const badge = new Container();
  badge.position.set(cx, badgeCy);
  badge.scale.set(0);
  root.addChild(badge);
  badge.addChild(new Graphics().circle(0, 0, badgeR + Math.max(3, badgeR * 0.06)).fill(bg));
  badge.addChild(new Graphics().circle(0, 0, badgeR).fill(accent));
  const yearFont = fitSize(fonts, yearsRaw, "display", 700, Math.round(badgeR * 1.15), badgeR * 1.35);
  const yearsText = makeText(fonts, { text: yearsRaw, role: "display", weight: 700, size: yearFont, color: accentInk, anchor: 0.5 });
  yearsText.position.set(0, -badgeR * 0.14);
  badge.addChild(yearsText);
  badge.addChild(makeText(fonts, { text: "YEARS", role: "body", weight: 700, size: Math.round(badgeR * 0.24), color: accentInk, anchor: 0.5, letterSpacing: 3 })).position.set(0, badgeR * 0.52);
  timeline
    .to(badge, { prop: "scale.x", from: 0, to: 1, start: 0.35, duration: 0.7, ease: makeOutBack(1.9) })
    .to(badge, { prop: "scale.y", from: 0, to: 1, start: 0.35, duration: 0.7, ease: makeOutBack(1.9) });
  cursorY += badgeR * 2 + gap;

  // Names.
  const namesCy = cursorY + namesH / 2;
  const namesText = makeText(fonts, { text: names, role: "display", weight: 700, size: namesFont, color: textColor, anchor: 0.5, align: "center" });
  namesText.position.set(cx, namesCy + 14);
  namesText.alpha = 0;
  root.addChild(namesText);
  timeline
    .to(namesText, { prop: "alpha", from: 0, to: 1, start: 0.72, duration: 0.4, ease: outQuad })
    .to(namesText, { prop: "y", from: namesCy + 14, to: namesCy, start: 0.72, duration: 0.6, ease: spring(0.5) });

  return { timeline, duration: DURATION, update };
}

export const anniversaryCard: TemplateDefinition = {
  id: "anniversary-card",
  name: "Anniversary Card",
  tagline: "A milestone-years badge pops in a confetti burst as the names settle.",
  category: "event",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 2.6,
  fontRoles: { occasion: "body", names: "display" },
  palettes: PALETTES,
  fields: [
    { key: "occasion", type: "text", label: "Occasion", default: "Happy Anniversary", maxLength: 30, shrinkToFit: true },
    { key: "years", type: "text", label: "Years", default: "5", maxLength: 3, shrinkToFit: true },
    { key: "names", type: "text", label: "Names", default: "Alex & Sam", maxLength: 26, shrinkToFit: true },
    { key: "showConfetti", type: "toggle", label: "Confetti burst", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
