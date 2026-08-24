import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
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

/** Greedy-wrap into <= maxLines lines, then shrink so the widest line fits. */
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
// white unless near-black is clearly better — keeps the header legible.
const readableOn = (bg: string): string =>
  contrastRatio("#FFFFFF", bg) >= contrastRatio("#111318", bg) * 0.9 ? "#FFFFFF" : "#111318";

// The room background varies; the badge card itself is always a light stock so
// the name stays crisp and high-contrast. Header strip + lanyard take the accent.
const PALETTES: Palette[] = [
  { id: "classic-red", name: "Classic red", colors: { background: "#E9ECF2", cardColor: "#FFFFFF", textColor: "#14181F", accent: "#C62828", clip: "#AEB4BF" } },
  { id: "midnight", name: "Midnight", colors: { background: "#0F1218", cardColor: "#FFFFFF", textColor: "#14181F", accent: "#1E5FD0", clip: "#8B93A2" } },
  { id: "forest", name: "Forest", colors: { background: "#EAF1EC", cardColor: "#FFFFFF", textColor: "#14181F", accent: "#1B7A46", clip: "#AEB4BF" } },
  { id: "plum", name: "Plum", colors: { background: "#F2ECF6", cardColor: "#FFFFFF", textColor: "#14181F", accent: "#6D2E96", clip: "#AEB4BF" } },
];

const DURATION = 4.6;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#E9ECF2"));
  const cardColor = pc("cardColor", "#FFFFFF");
  const textColor = str(values.textColor, pc("textColor", "#14181F"));
  const accent = str(values.accent, pc("accent", "#C62828"));
  const clipColor = pc("clip", "#AEB4BF");
  const accentInk = readableOn(accent);

  const name = str(values.name, "Alex Rivera");
  const role = str(values.role, "Product Designer");
  const event = str(values.event, "DesignConf 2026");
  const showLanyard = on(values.showLanyard);
  const showBar = on(values.showBar);

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const cx = w / 2;
  const zone = safeRect(ctx.aspect);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Geometry: badge hangs below the clip point P, cords form a short V ---
  const badgeW = minDim * 0.4;
  const badgeH = badgeW * 1.26;
  const cordLen = badgeH * 0.13;
  const badgeCenterY = zone.y + zone.height * 0.56;
  const badgeTopY = badgeCenterY - badgeH / 2;
  const py = badgeTopY - cordLen; // clip point y
  const strapLen = Math.max(minDim * 0.05, py - zone.y);
  const r = badgeW * 0.06;

  // --- Static lanyard strap above the clip (grows down from the top) ---
  if (showLanyard) {
    const sw = badgeW * 0.13;
    const strap = new Graphics()
      .roundRect(-sw / 2, 0, sw, strapLen, sw * 0.2)
      .fill(accent);
    strap.position.set(cx, zone.y);
    strap.pivot.set(0, 0);
    strap.scale.set(1, 0);
    root.addChild(strap);
    timeline.to(strap, { prop: "scale.y", from: 0, to: 1, start: 0.05, duration: 0.5, ease: outExpo });
  }

  // --- Swinging assembly (clip + cords + badge) pivots about P ---
  const pivot = new Container();
  pivot.position.set(cx, py);
  pivot.alpha = 0;
  root.addChild(pivot);

  if (showLanyard) {
    // Two cords from the clip down to the badge's top corners.
    const cordX = badgeW * 0.32;
    const cords = new Graphics();
    cords
      .moveTo(0, 0).lineTo(-cordX, cordLen)
      .moveTo(0, 0).lineTo(cordX, cordLen)
      .stroke({ color: accent, width: Math.max(3, badgeW * 0.02), cap: "round" });
    pivot.addChild(cords);
    // Clip ring.
    pivot.addChild(new Graphics().roundRect(-badgeW * 0.05, -badgeW * 0.05, badgeW * 0.1, badgeW * 0.09, badgeW * 0.02).fill(clipColor));
  }

  const card = new Container();
  card.position.set(0, cordLen);
  pivot.addChild(card);

  // Card body + soft shadow.
  card.addChild(new Graphics().roundRect(-badgeW / 2 - badgeW * 0.015, badgeH * 0.02, badgeW + badgeW * 0.03, badgeH, r).fill({ color: "#000000", alpha: 0.16 }));
  card.addChild(new Graphics().roundRect(-badgeW / 2, 0, badgeW, badgeH, r).fill(cardColor));

  // Header strip (accent) with squared bottom edge.
  const hh = badgeH * 0.24;
  const header = new Graphics().roundRect(-badgeW / 2, 0, badgeW, hh, r).fill(accent);
  header.rect(-badgeW / 2, hh - r, badgeW, r).fill(accent);
  card.addChild(header);

  const helloFont = Math.round(hh * 0.44);
  const hello = makeText(fonts, { text: "HELLO", role: "display", weight: 700, size: helloFont, color: accentInk, anchor: 0.5, letterSpacing: 2 });
  hello.position.set(0, hh * 0.36);
  card.addChild(hello);
  const subFont = Math.round(hh * 0.2);
  const sub = makeText(fonts, { text: "my name is", role: "body", weight: 500, size: subFont, color: accentInk, anchor: 0.5, letterSpacing: 1 });
  sub.alpha = 0.9;
  sub.position.set(0, hh * 0.74);
  card.addChild(sub);

  // Name — the star of the badge.
  const nameFont0 = Math.round(badgeW * 0.15);
  const { lines: nameLines, size: nameFont } = wrapAndFit(fonts, name, "display", 700, nameFont0, badgeW * 0.86, 2);
  const nameLH = Math.round(nameFont * 1.04);
  const nameText = makeText(fonts, {
    text: nameLines.join("\n"),
    role: "display",
    weight: 700,
    size: nameFont,
    color: textColor,
    anchor: 0.5,
    align: "center",
    lineHeight: nameLH,
  });
  nameText.position.set(0, hh + (badgeH - hh) * 0.34);
  card.addChild(nameText);

  // Optional accent underline bar.
  if (showBar) {
    const barW = badgeW * 0.28;
    card.addChild(new Graphics().roundRect(-barW / 2, hh + (badgeH - hh) * 0.54, barW, Math.max(3, badgeH * 0.012), badgeH * 0.006).fill(accent));
  }

  // Role / company line.
  const roleFont = fitSize(fonts, role, "body", 600, Math.round(badgeW * 0.062), badgeW * 0.84);
  const roleText = makeText(fonts, { text: role, role: "body", weight: 600, size: roleFont, color: textColor, anchor: 0.5 });
  roleText.alpha = 0.85;
  roleText.position.set(0, hh + (badgeH - hh) * 0.66);
  card.addChild(roleText);

  // Small event label near the bottom.
  const evFont = fitSize(fonts, event.toUpperCase(), "body", 600, Math.round(badgeW * 0.046), badgeW * 0.82);
  const evText = makeText(fonts, { text: event.toUpperCase(), role: "body", weight: 600, size: evFont, color: textColor, anchor: 0.5, letterSpacing: 1.5 });
  evText.alpha = 0.85;
  evText.position.set(0, badgeH * 0.9);
  card.addChild(evText);

  timeline.to(pivot, { prop: "alpha", from: 0, to: 1, start: 0.28, duration: 0.4, ease: outQuad });

  // Pure damped pendulum: angle(t) = A·cos(ω·t)·e^(−k·t) → settles upright.
  const A = 0.22;
  const omega = Math.PI * 2 * 0.85;
  const k = 1.5;
  const update = (t: number): void => {
    pivot.rotation = A * Math.cos(omega * t) * Math.exp(-k * t);
  };

  return { timeline, duration: DURATION, update };
}

export const lanyardBadge: TemplateDefinition = {
  id: "lanyard-badge",
  name: "Lanyard Badge",
  tagline: "A conference name badge drops on a lanyard and swings to a settle.",
  category: "event",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "9:16",
  loopable: false,
  posterTime: 3.0,
  fontRoles: { name: "display" },
  palettes: PALETTES,
  fields: [
    { key: "name", type: "text", label: "Name", default: "Alex Rivera", maxLength: 24, shrinkToFit: true },
    { key: "role", type: "text", label: "Role / company", default: "Product Designer", maxLength: 30, shrinkToFit: true },
    { key: "event", type: "text", label: "Event label", default: "DesignConf 2026", maxLength: 24, shrinkToFit: true },
    { key: "showLanyard", type: "toggle", label: "Lanyard strap", default: true },
    { key: "showBar", type: "toggle", label: "Accent bar", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
