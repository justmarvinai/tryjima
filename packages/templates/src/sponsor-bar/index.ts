import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outExpo,
  outQuint,
  makeOutBack,
  safeZone,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;

/** Largest size <= size0 at which `text` fits `maxWidth` (crisp, single-line). */
function fitSize(
  fonts: FontRegistry,
  text: string,
  role: FontRole,
  weight: number,
  size0: number,
  maxWidth: number,
  letterSpacing = 0,
): number {
  if (text.length === 0 || maxWidth <= 0) return size0;
  const w = fonts.measure(text, { family: fonts.family(role), weight, size: size0, letterSpacing });
  return w > maxWidth ? Math.max(10, Math.floor(size0 * (maxWidth / w))) : size0;
}

// A "Sponsored by" lower-third: a small kicker over a logo lockup (initials mark
// + brand name) that slides and fades in as a unit. Only the full-frame `bg`
// rect is tied to the background field (blanked by transparent export); the card
// uses its own palette-only `cardBg` (with a soft shadow) so it survives as
// overlay content. `accentText` is a fixed, contrast-checked color for the
// initials on the accent mark, so they stay legible under any accent pick.
const PALETTES: Palette[] = [
  { id: "cloud", name: "Cloud", colors: { background: "#EEF1F6", cardBg: "#FFFFFF", textColor: "#0B0B0F", accent: "#1D4ED8", accentText: "#FFFFFF" } },
  { id: "paper", name: "Paper", colors: { background: "#F4F1EA", cardBg: "#FFFFFF", textColor: "#17130D", accent: "#B31232", accentText: "#FFFFFF" } },
  { id: "forest", name: "Forest", colors: { background: "#EAF3EC", cardBg: "#FFFFFF", textColor: "#0C1F14", accent: "#046A4E", accentText: "#FFFFFF" } },
  { id: "ink", name: "Ink", colors: { background: "#0D0D11", cardBg: "#1A1A21", textColor: "#FFFFFF", accent: "#F2A93B", accentText: "#101014" } },
];

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#EEF1F6"));
  const cardBg = pc("cardBg", "#FFFFFF");
  const textColor = str(values.textColor, pc("textColor", "#0B0B0F"));
  const accent = str(values.accent, pc("accent", "#1D4ED8"));
  const accentText = pc("accentText", "#FFFFFF");

  const kickerTxt = str(values.kicker, "Sponsored by").toUpperCase();
  const brand = str(values.brand, "Aura Labs");
  const initialsRaw = str(values.initials, "A");
  const initials = initialsRaw.slice(0, 3);
  const showMark = values.showMark !== false;

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const zone = safeZone(ctx.aspect);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  const padX = Math.round(minDim * 0.03);
  const padY = Math.round(minDim * 0.026);
  const rowGap = Math.round(minDim * 0.012);
  const markGap = showMark ? Math.round(minDim * 0.018) : 0;

  const brandSize0 = Math.round(minDim * 0.044);
  const kickerSize0 = Math.round(minDim * 0.02);
  const kickerLS = kickerSize0 * 0.16;
  const markSize = showMark ? Math.round(brandSize0 * 1.5) : 0;

  const innerMaxW = w - zone.left - zone.right - padX * 2;
  const brandMaxW = Math.max(60, innerMaxW - (showMark ? markSize + markGap : 0));

  const brandSize = fitSize(fonts, brand, "display", 700, brandSize0, brandMaxW);
  const brandW = fonts.measure(brand, { family: fonts.family("display"), weight: 700, size: brandSize });
  const rowW = (showMark ? markSize + markGap : 0) + brandW;

  const kickerSize = fitSize(fonts, kickerTxt, "body", 700, kickerSize0, innerMaxW, kickerLS);
  const kickerW = fonts.measure(kickerTxt, { family: fonts.family("body"), weight: 700, size: kickerSize, letterSpacing: kickerLS });

  const rowH = Math.max(markSize, brandSize);
  const contentW = Math.max(kickerW, rowW);
  const contentH = kickerSize + rowGap + rowH;

  const cardW = padX * 2 + contentW;
  const cardH = padY * 2 + contentH;
  const cardRadius = Math.round(minDim * 0.022);

  const marginBottom = Math.round(minDim * 0.03);
  const restCX = zone.left + cardW / 2;
  const restCY = h - zone.bottom - marginBottom - cardH / 2;

  const card = new Container();
  const fromY = restCY + minDim * 0.05;
  card.position.set(restCX, fromY);
  card.alpha = 0;
  root.addChild(card);

  // Soft shadow + card surface.
  const e = Math.round(minDim * 0.006);
  const off = Math.round(minDim * 0.01);
  card.addChild(
    new Graphics()
      .roundRect(-cardW / 2 - e, -cardH / 2 - e + off, cardW + e * 2, cardH + e * 2, cardRadius + e)
      .fill({ color: "#000000", alpha: 0.18 }),
  );
  card.addChild(new Graphics().roundRect(-cardW / 2, -cardH / 2, cardW, cardH, cardRadius).fill(cardBg));

  const contentLeft = -cardW / 2 + padX;

  // --- Kicker (top line) ---
  const kickerCY = -contentH / 2 + kickerSize / 2;
  const kickerText = makeText(fonts, {
    text: kickerTxt,
    role: "body",
    weight: 700,
    size: kickerSize,
    color: accent,
    anchor: { x: 0, y: 0.5 },
    letterSpacing: kickerLS,
  });
  kickerText.position.set(contentLeft, kickerCY);
  card.addChild(kickerText);

  // --- Lockup row (mark + brand) ---
  const rowCY = contentH / 2 - rowH / 2;
  let lockupX = contentLeft;
  let mark: Container | undefined;
  if (showMark) {
    mark = new Container();
    mark.position.set(lockupX + markSize / 2, rowCY);
    mark.scale.set(0.6);
    card.addChild(mark);
    const markRadius = Math.round(markSize * 0.26);
    mark.addChild(new Graphics().roundRect(-markSize / 2, -markSize / 2, markSize, markSize, markRadius).fill(accent));
    const initSize = fitSize(fonts, initials, "display", 700, Math.round(markSize * 0.52), markSize * 0.74);
    const initText = makeText(fonts, { text: initials, role: "display", weight: 700, size: initSize, color: accentText, anchor: 0.5 });
    mark.addChild(initText);
    lockupX += markSize + markGap;
  }

  const brandText = makeText(fonts, {
    text: brand,
    role: "display",
    weight: 700,
    size: brandSize,
    color: textColor,
    anchor: { x: 0, y: 0.5 },
  });
  brandText.position.set(lockupX, rowCY);
  card.addChild(brandText);

  // --- Entrance: the whole card rises + fades in as one unit; the mark pops. ---
  timeline
    .to(card, { prop: "alpha", from: 0, to: 1, start: 0, duration: 0.42, ease: outExpo })
    .to(card, { prop: "position.y", from: fromY, to: restCY, start: 0, duration: 0.6, ease: outQuint });
  if (mark) {
    timeline
      .to(mark, { prop: "scale.x", from: 0.6, to: 1, start: 0.2, duration: 0.55, ease: makeOutBack(2) })
      .to(mark, { prop: "scale.y", from: 0.6, to: 1, start: 0.2, duration: 0.55, ease: makeOutBack(2) });
  }

  return { timeline, duration: 3.8 };
}

export const sponsorBar: TemplateDefinition = {
  id: "sponsor-bar",
  name: "Sponsor Bar",
  tagline: "A sponsored-by kicker and logo lockup slide in as one unit.",
  category: "overlay",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 2.0,
  fontRoles: { kicker: "body", brand: "display", initials: "display" },
  palettes: PALETTES,
  fields: [
    { key: "kicker", type: "text", label: "Kicker", default: "Sponsored by", maxLength: 24, shrinkToFit: true },
    { key: "brand", type: "text", label: "Brand", default: "Aura Labs", maxLength: 26, shrinkToFit: true },
    { key: "initials", type: "text", label: "Mark initials", default: "A", maxLength: 3, shrinkToFit: true },
    { key: "showMark", type: "toggle", label: "Logo mark", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
