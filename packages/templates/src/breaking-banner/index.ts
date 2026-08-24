import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  makeOutBack,
  safeZone,
  TRANSPARENT_BG,
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
): number {
  if (text.length === 0 || maxWidth <= 0) return size0;
  const w = fonts.measure(text, { family: fonts.family(role), weight, size: size0 });
  return w > maxWidth ? Math.max(10, Math.floor(size0 * (maxWidth / w))) : size0;
}

// A broadcast "BREAKING" lower-third — a pulsing red kicker chip perched on a
// headline bar that slides up from the bottom edge. Only the full-frame `bg`
// rect is tied to the background field (defaults to the transparent sentinel so
// it composites straight onto footage); the bar/kicker use their own
// palette-only surfaces (with a soft shadow) so the graphic survives once the
// canvas fill is gone. `accentText` is a fixed, contrast-checked color for text
// sitting on the `accent` chip (not user-editable, so the kicker stays legible
// under any accent pick).
const PALETTES: Palette[] = [
  { id: "broadcast", name: "Broadcast", colors: { barBg: "#101014", textColor: "#FFFFFF", accent: "#E1131A", accentText: "#FFFFFF" } },
  { id: "paper", name: "Paper", colors: { barBg: "#FFFFFF", textColor: "#101014", accent: "#E1131A", accentText: "#FFFFFF" } },
  { id: "navy", name: "Navy", colors: { barBg: "#0B1F4D", textColor: "#FFFFFF", accent: "#E1131A", accentText: "#FFFFFF" } },
  { id: "ink", name: "Ink", colors: { barBg: "#17171C", textColor: "#F5F0E6", accent: "#FF3B30", accentText: "#FFFFFF" } },
];

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", TRANSPARENT_BG));
  const barBg = pc("barBg", "#101014");
  const textColor = str(values.textColor, pc("textColor", "#FFFFFF"));
  const accent = str(values.accent, pc("accent", "#E1131A"));
  const accentText = pc("accentText", "#FFFFFF");
  const kicker = str(values.kicker, "Breaking").toUpperCase();
  const headline = str(values.headline, "Markets rally as tech stocks surge to new highs");
  const showDot = values.showDot !== false;

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const zone = safeZone(ctx.aspect);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Headline bar geometry (full safe width). ---
  const barW = w - zone.left - zone.right;
  const barPadX = Math.round(minDim * 0.03);
  const barPadY = Math.round(minDim * 0.022);
  const headlineSize = fitSize(fonts, headline, "display", 700, Math.round(minDim * 0.04), barW - barPadX * 2);
  const barH = headlineSize + barPadY * 2;
  const barRadius = Math.round(minDim * 0.014);

  // --- Kicker chip geometry (a tab above the bar's top-left). ---
  const kPadX = Math.round(minDim * 0.02);
  const kPadY = Math.round(minDim * 0.01);
  const dotR = showDot ? Math.round(minDim * 0.008) : 0;
  const dotGap = showDot ? Math.round(minDim * 0.012) : 0;
  const kickerSize = fitSize(fonts, kicker, "display", 700, Math.round(minDim * 0.023), minDim * 0.5);
  const kickerTextW = fonts.measure(kicker, { family: fonts.family("display"), weight: 700, size: kickerSize, letterSpacing: kickerSize * 0.06 });
  const kickerH = kickerSize + kPadY * 2;
  const kickerW = kPadX * 2 + dotR * 2 + dotGap + kickerTextW;
  const kickerRadius = Math.round(kickerH * 0.24);

  // --- Layout: bottom-anchored, bar centered, kicker on its top-left. ---
  const margin = Math.round(minDim * 0.03);
  const stackBottomY = h - zone.bottom - margin;
  const barCX = w / 2;
  const barCY = stackBottomY - barH / 2;
  const barLeft = barCX - barW / 2;
  const overlap = Math.round(kickerH * 0.28);
  const kickerCX = barLeft + Math.round(minDim * 0.02) + kickerW / 2;
  const kickerCY = barCY - barH / 2 - kickerH / 2 + overlap;

  const banner = new Container();
  const slideOffset = barH + minDim * 0.06;
  banner.position.set(0, slideOffset);
  banner.alpha = 0;
  root.addChild(banner);

  // --- Headline bar surface (+ soft shadow). ---
  const bar = new Container();
  bar.position.set(barCX, barCY);
  banner.addChild(bar);
  const e = Math.round(barRadius * 0.5);
  const shOff = Math.round(barRadius * 0.6);
  bar.addChild(
    new Graphics()
      .roundRect(-barW / 2 - e, -barH / 2 - e + shOff, barW + e * 2, barH + e * 2, barRadius + e)
      .fill({ color: "#000000", alpha: 0.2 }),
  );
  bar.addChild(new Graphics().roundRect(-barW / 2, -barH / 2, barW, barH, barRadius).fill(barBg));

  const headlineText = makeText(fonts, {
    text: headline,
    role: "display",
    weight: 700,
    size: headlineSize,
    color: textColor,
    anchor: { x: 0, y: 0.5 },
  });
  headlineText.position.set(-barW / 2 + barPadX, 0);
  bar.addChild(headlineText);

  // --- Kicker chip (accent) with a pulsing dot. ---
  const kickerBox = new Container();
  kickerBox.position.set(kickerCX, kickerCY);
  banner.addChild(kickerBox);
  kickerBox.addChild(new Graphics().roundRect(-kickerW / 2, -kickerH / 2, kickerW, kickerH, kickerRadius).fill(accent));

  let dot: Graphics | undefined;
  let textLeft = -kickerW / 2 + kPadX;
  if (showDot) {
    dot = new Graphics().circle(0, 0, dotR).fill(accentText);
    dot.position.set(textLeft + dotR, 0);
    kickerBox.addChild(dot);
    textLeft += dotR * 2 + dotGap;
  }
  const kickerText = makeText(fonts, {
    text: kicker,
    role: "display",
    weight: 700,
    size: kickerSize,
    color: accentText,
    anchor: { x: 0, y: 0.5 },
    letterSpacing: kickerSize * 0.06,
  });
  kickerText.position.set(textLeft, 0);
  kickerBox.addChild(kickerText);

  // --- Entrance: the whole banner slides up + fades; the kicker gives a pop. ---
  const enterStart = 0.1;
  const enterDur = 0.55;
  timeline
    .to(banner, { prop: "position.y", from: slideOffset, to: 0, start: enterStart, duration: enterDur, ease: outExpo })
    .to(banner, { prop: "alpha", from: 0, to: 1, start: enterStart, duration: 0.3, ease: outQuad });
  const popStart = enterStart + enterDur * 0.65;
  kickerBox.scale.set(0.7);
  timeline
    .to(kickerBox, { prop: "scale.x", from: 0.7, to: 1, start: popStart, duration: 0.42, ease: makeOutBack(2) })
    .to(kickerBox, { prop: "scale.y", from: 0.7, to: 1, start: popStart, duration: 0.42, ease: makeOutBack(2) });

  // --- Pulsing dot (toggleable, pure fn of t). ---
  const landTime = enterStart + enterDur;
  const PULSE_PERIOD = 0.9;
  const update = (t: number): void => {
    if (!dot) return;
    if (t < landTime) {
      dot.scale.set(1);
      dot.alpha = 1;
      return;
    }
    const u = ((t - landTime) % PULSE_PERIOD) / PULSE_PERIOD;
    dot.scale.set(1 + 0.32 * Math.sin(u * Math.PI));
    dot.alpha = 0.6 + 0.4 * Math.sin(u * Math.PI);
  };

  return { timeline, duration: 4.5, update };
}

export const breakingBanner: TemplateDefinition = {
  id: "breaking-banner",
  name: "Breaking Banner",
  tagline: "A red BREAKING kicker pulses as the headline bar slides up.",
  category: "overlay",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 2.4,
  fontRoles: { kicker: "display", headline: "display" },
  palettes: PALETTES,
  fields: [
    { key: "kicker", type: "text", label: "Kicker", default: "Breaking", maxLength: 18, shrinkToFit: true },
    { key: "headline", type: "text", label: "Headline", default: "Markets rally as tech stocks surge to new highs", maxLength: 64, shrinkToFit: true },
    { key: "showDot", type: "toggle", label: "Pulsing dot", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
