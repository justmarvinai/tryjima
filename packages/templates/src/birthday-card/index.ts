import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
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
  size0: number,
  maxWidth: number,
): number {
  if (text.length === 0 || maxWidth <= 0) return size0;
  const w = fonts.measure(text, { family: fonts.family(role), weight, size: size0 });
  return w > maxWidth ? Math.max(11, Math.floor((size0 * maxWidth) / w)) : size0;
}

function wrapAndFit(
  fonts: FontRegistry,
  text: string,
  role: FontRole,
  weight: number,
  size0: number,
  maxWidth: number,
  maxLines: number,
): { lines: string[]; size: number } {
  const family = fonts.family(role);
  const measure = (s: string, sz: number): number => fonts.measure(s, { family, weight, size: sz });
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return { lines: [""], size: size0 };
  const lines: string[] = [];
  let cur = "";
  for (const word of words) {
    const next = cur ? `${cur} ${word}` : word;
    if (!cur || measure(next, size0) <= maxWidth) cur = next;
    else {
      lines.push(cur);
      cur = word;
    }
  }
  if (cur) lines.push(cur);
  let packed = lines;
  if (packed.length > maxLines) {
    packed = [...packed.slice(0, maxLines - 1), packed.slice(maxLines - 1).join(" ")];
  }
  let size = size0;
  for (let guard = 0; guard < 8; guard++) {
    const widest = Math.max(...packed.map((l) => measure(l, size)));
    if (widest <= maxWidth || widest === 0) break;
    size = Math.max(13, Math.floor(size * (maxWidth / widest)));
  }
  return { lines: packed, size };
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
// Pick the ink (white / near-black) with the most contrast on `bg`, preferring
// white unless near-black is clearly better — keeps the number badge legible.
const readableOn = (bg: string): string =>
  contrastRatio("#FFFFFF", bg) >= contrastRatio("#111318", bg) * 0.9 ? "#FFFFFF" : "#111318";

// Warm, celebratory palettes. Headline + name stay in the dark/light `textColor`
// (always >= 4.5:1); the accent drives the number badge + confetti.
const PALETTES: Palette[] = [
  { id: "confetti-cream", name: "Confetti cream", colors: { background: "#FFF6EA", textColor: "#2A1608", accent: "#FF5C7A" } },
  { id: "peach-pop", name: "Peach pop", colors: { background: "#FFEDE4", textColor: "#3A1300", accent: "#FF7A3D" } },
  { id: "mint-party", name: "Mint party", colors: { background: "#E9F8F0", textColor: "#0C2A1E", accent: "#17A86A" } },
  { id: "grape-fizz", name: "Grape fizz", colors: { background: "#201033", textColor: "#FBEFFF", accent: "#FF6AD5" } },
];

// Festive confetti colors (decorative — independent of the brand accent, but the
// accent is mixed in so a recolor still ties the burst to the card).
const CONFETTI = ["#FFC24B", "#4FC3F7", "#7CDB8A", "#FF6AD5", "#FF5C7A"];

const DURATION = 4.4;

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
  const bg = str(values.background, pc("background", "#FFF6EA"));
  const textColor = str(values.textColor, pc("textColor", "#2A1608"));
  const accent = str(values.accent, pc("accent", "#FF5C7A"));
  const accentInk = readableOn(accent);

  const occasion = str(values.occasion, "Happy Birthday");
  const nm = str(values.name, "Maya");
  const numberRaw = typeof values.number === "string" ? values.number.trim() : "30";
  const showConfetti = on(values.showConfetti);
  const showBadge = on(values.showBadge);
  const hasBadge = showBadge && numberRaw.length > 0;

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
  const originY = zone.y + zone.height * 0.3;
  const confetti: Confetto[] = [];
  if (showConfetti) {
    const N = 46;
    for (let i = 0; i < N; i++) {
      const col = rng.next() < 0.5 ? accent : (CONFETTI[rng.int(0, CONFETTI.length - 1)] ?? accent);
      const long = rng.next() < 0.5;
      const cw = minDim * rng.range(0.018, 0.032);
      const ch = long ? cw * 0.42 : cw;
      const g = new Graphics().roundRect(-cw / 2, -ch / 2, cw, ch, Math.min(cw, ch) * 0.3).fill(col);
      g.alpha = 0;
      root.addChild(g);
      const ang = rng.range(-Math.PI * 0.92, -Math.PI * 0.08); // sprays upward + out
      const speed = minDim * rng.range(0.5, 1.2);
      confetti.push({
        g,
        ox: originX + minDim * rng.range(-0.05, 0.05),
        oy: originY + minDim * rng.range(-0.03, 0.03),
        vx: Math.cos(ang) * speed,
        vy: Math.sin(ang) * speed,
        rot0: rng.range(0, Math.PI * 2),
        spin: rng.range(-7, 7),
        delay: rng.range(0, 0.22),
        life: rng.range(1.7, 2.7),
      });
    }
  }
  const grav = minDim * 1.3; // px / s^2
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

  // --- Vertical stack: [number badge] · occasion · name ---
  const gap = minDim * 0.04;
  const badgeR = minDim * 0.075;
  const badgeH = hasBadge ? badgeR * 2 : 0;

  const occFont0 = Math.round(minDim * 0.088);
  const { lines: occLines, size: occFont } = wrapAndFit(fonts, occasion, "display", 700, occFont0, maxW, 2);
  const occLH = Math.round(occFont * 1.05);
  const occH = occLines.length * occLH;

  const nameFont = fitSize(fonts, nm, "display", 700, Math.round(minDim * 0.062), maxW * 0.9);
  const nameH = Math.round(nameFont * 1.1);

  const totalH = badgeH + (hasBadge ? gap : 0) + occH + gap + nameH;
  let cursorY = zone.y + zone.height / 2 - totalH / 2;

  // Number badge.
  if (hasBadge) {
    const badgeCy = cursorY + badgeR;
    const badge = new Container();
    badge.position.set(cx, badgeCy);
    badge.scale.set(0);
    root.addChild(badge);
    badge.addChild(new Graphics().circle(0, 0, badgeR + Math.max(3, badgeR * 0.08)).fill(bg));
    badge.addChild(new Graphics().circle(0, 0, badgeR).fill(accent));
    const numFont = fitSize(fonts, numberRaw, "display", 700, Math.round(badgeR * 1.05), badgeR * 1.5);
    badge.addChild(makeText(fonts, { text: numberRaw, role: "display", weight: 700, size: numFont, color: accentInk, anchor: 0.5 }));
    timeline
      .to(badge, { prop: "scale.x", from: 0, to: 1, start: 0.1, duration: 0.6, ease: makeOutBack(2) })
      .to(badge, { prop: "scale.y", from: 0, to: 1, start: 0.1, duration: 0.6, ease: makeOutBack(2) });
    cursorY += badgeH + gap;
  }

  // Occasion headline.
  const occCy = cursorY + occH / 2;
  const occText = makeText(fonts, {
    text: occLines.join("\n"),
    role: "display",
    weight: 700,
    size: occFont,
    color: textColor,
    anchor: 0.5,
    align: "center",
    lineHeight: occLH,
  });
  occText.position.set(cx, occCy);
  occText.alpha = 0;
  occText.scale.set(0.6);
  root.addChild(occText);
  timeline
    .to(occText, { prop: "alpha", from: 0, to: 1, start: 0.22, duration: 0.35, ease: outQuad })
    .to(occText, { prop: "scale.x", from: 0.6, to: 1, start: 0.22, duration: 0.75, ease: spring(0.42) })
    .to(occText, { prop: "scale.y", from: 0.6, to: 1, start: 0.22, duration: 0.75, ease: spring(0.42) });
  cursorY += occH + gap;

  // Name.
  const nameCy = cursorY + nameH / 2;
  const nameText = makeText(fonts, { text: nm, role: "display", weight: 700, size: nameFont, color: textColor, anchor: 0.5, align: "center" });
  nameText.position.set(cx, nameCy + 14);
  nameText.alpha = 0;
  root.addChild(nameText);
  timeline
    .to(nameText, { prop: "alpha", from: 0, to: 1, start: 0.5, duration: 0.4, ease: outQuad })
    .to(nameText, { prop: "y", from: nameCy + 14, to: nameCy, start: 0.5, duration: 0.55, ease: spring(0.5) });

  return { timeline, duration: DURATION, update };
}

export const birthdayCard: TemplateDefinition = {
  id: "birthday-card",
  name: "Birthday Card",
  tagline: "A confetti burst pops as the greeting and name spring into place.",
  category: "event",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 2.2,
  fontRoles: { occasion: "display", name: "display" },
  palettes: PALETTES,
  fields: [
    { key: "occasion", type: "text", label: "Occasion", default: "Happy Birthday", maxLength: 28, shrinkToFit: true },
    { key: "name", type: "text", label: "Name", default: "Maya", maxLength: 22, shrinkToFit: true },
    { key: "number", type: "text", label: "Number badge", default: "30", maxLength: 4, optional: true, shrinkToFit: true },
    { key: "showConfetti", type: "toggle", label: "Confetti", default: true },
    { key: "showBadge", type: "toggle", label: "Number badge", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
