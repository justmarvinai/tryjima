import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  outCubic,
  spring,
  safeRect,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { groupThousands, parseTargetNumber } from "../shared/format";

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

// A creator goal card. Only the full-frame `bg` rect is tied to the background
// field; the card uses its own palette-only `cardBg` so it survives transparent
// export. All text is drawn in `textColor` (never on the accent) so contrast
// holds for any accent the user picks — accent drives the progress fill + trim.
const PALETTES: Palette[] = [
  { id: "light", name: "Light", colors: { background: "#EEF1F6", cardBg: "#FFFFFF", textColor: "#101014", accent: "#17C964", track: "#E6E8EE" } },
  { id: "midnight", name: "Midnight", colors: { background: "#0C0C10", cardBg: "#1B1E27", textColor: "#FFFFFF", accent: "#33E2A0", track: "#262A34" } },
  { id: "sky", name: "Sky", colors: { background: "#EAF3FF", cardBg: "#FFFFFF", textColor: "#0B2447", accent: "#2E7DF6", track: "#DCE9FB" } },
  { id: "grape-night", name: "Grape night", colors: { background: "#150F24", cardBg: "#221833", textColor: "#FFFFFF", accent: "#B084F5", track: "#2E2340" } },
];

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#EEF1F6"));
  const cardBg = pc("cardBg", "#FFFFFF");
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const accent = str(values.accent, pc("accent", "#17C964"));
  const track = pc("track", "#E6E8EE");

  const title = str(values.title, "Follower goal");
  const showPercent = values.showPercent !== false;
  const showIcon = values.showIcon !== false;
  const current = parseTargetNumber(str(values.current, "8,240"));
  const target = Math.max(1, parseTargetNumber(str(values.target, "10,000")));
  const ratio = Math.max(0, Math.min(1, current / target));

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const cx = w / 2;
  const safe = safeRect(ctx.aspect);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Card + content sizing ---
  const cardW = Math.min(safe.width, minDim * 1.02);
  const cardPadX = Math.round(minDim * 0.06);
  const cardPadY = Math.round(minDim * 0.058);
  const contentW = cardW - 2 * cardPadX;
  const barW = contentW;

  const titleFont = fitSize(fonts, title, "display", 700, Math.round(minDim * 0.037), contentW * 0.9);
  const titleH = titleFont * 1.2;

  const finalCurrent = groupThousands(current);
  const targetPart = ` / ${groupThousands(target)}`;
  const bigFont = fitSize(fonts, finalCurrent + targetPart, "display", 700, Math.round(minDim * 0.08), contentW);
  const bigH = bigFont * 1.12;

  const barH = Math.round(minDim * 0.03);
  const lineFont = Math.round(minDim * 0.03);
  const lineH = lineFont * 1.2;

  const g1 = Math.round(minDim * 0.03); // title -> big
  const g2 = Math.round(minDim * 0.045); // big -> bar
  const g3 = Math.round(minDim * 0.036); // bar -> line

  const contentH = titleH + g1 + bigH + g2 + barH + g3 + lineH;
  const cardH = contentH + 2 * cardPadY;
  const cardCy = safe.y + safe.height / 2;
  const contentTop = cardCy - contentH / 2;

  // Card surface (with soft shadow)
  const card = new Container();
  card.position.set(cx, cardCy);
  card.alpha = 0;
  card.scale.set(0.92);
  root.addChild(card);
  const ce = Math.round(minDim * 0.014);
  card.addChild(
    new Graphics()
      .roundRect(-cardW / 2 - ce, -cardH / 2 - ce + ce * 1.4, cardW + ce * 2, cardH + ce * 2, minDim * 0.03 + ce)
      .fill({ color: "#000000", alpha: 0.14 }),
  );
  card.addChild(new Graphics().roundRect(-cardW / 2, -cardH / 2, cardW, cardH, minDim * 0.03).fill(cardBg));
  timeline
    .to(card, { prop: "alpha", from: 0, to: 1, start: 0.04, duration: 0.4, ease: outQuad })
    .to(card, { prop: "scale.x", from: 0.92, to: 1, start: 0.04, duration: 0.6, ease: spring(0.6) })
    .to(card, { prop: "scale.y", from: 0.92, to: 1, start: 0.04, duration: 0.6, ease: spring(0.6) });

  const leftX = cx - contentW / 2;

  // --- Title (optional small accent target glyph) ---
  const titleCy = contentTop + titleH / 2;
  let titleX = leftX;
  if (showIcon) {
    const gr = titleFont * 0.5;
    const glyph = new Graphics();
    glyph.circle(0, 0, gr).stroke({ color: accent, width: Math.max(2, gr * 0.22) });
    glyph.circle(0, 0, gr * 0.52).stroke({ color: accent, width: Math.max(2, gr * 0.22) });
    glyph.circle(0, 0, gr * 0.16).fill(accent);
    glyph.position.set(leftX + gr, titleCy);
    glyph.alpha = 0;
    root.addChild(glyph);
    timeline.to(glyph, { prop: "alpha", from: 0, to: 1, start: 0.24, duration: 0.4, ease: outQuad });
    titleX = leftX + gr * 2 + titleFont * 0.36;
  }
  const titleText = makeText(fonts, { text: title, role: "display", weight: 700, size: titleFont, color: textColor, anchor: { x: 0, y: 0.5 } });
  titleText.position.set(titleX, titleCy);
  titleText.alpha = 0;
  root.addChild(titleText);
  timeline
    .to(titleText, { prop: "alpha", from: 0, to: 1, start: 0.16, duration: 0.4, ease: outQuad })
    .to(titleText, { prop: "y", from: titleCy + 10, to: titleCy, start: 0.16, duration: 0.5, ease: outExpo });

  // --- Big "current / target" (current ticks; right-anchored so it never reflows) ---
  const bigCy = contentTop + titleH + g1 + bigH / 2;
  const familyDisplay = fonts.family("display");
  const wc = fonts.measure(finalCurrent, { family: familyDisplay, weight: 700, size: bigFont });
  const wt = fonts.measure(targetPart, { family: familyDisplay, weight: 600, size: bigFont });
  const groupW = wc + wt;
  const groupLeft = cx - groupW / 2;
  const currentRight = groupLeft + wc;

  const currentText = makeText(fonts, { text: groupThousands(0), role: "display", weight: 700, size: bigFont, color: textColor, anchor: { x: 1, y: 0.5 } });
  currentText.position.set(currentRight, bigCy);
  currentText.alpha = 0;
  currentText.scale.set(0.9);
  root.addChild(currentText);
  const targetText = makeText(fonts, { text: targetPart, role: "display", weight: 600, size: bigFont, color: textColor, anchor: { x: 0, y: 0.5 } });
  targetText.alpha = 0.5;
  targetText.position.set(currentRight, bigCy);
  root.addChild(targetText);
  timeline
    .to(currentText, { prop: "alpha", from: 0, to: 1, start: 0.3, duration: 0.4, ease: outQuad })
    .to(currentText, { prop: "scale.x", from: 0.9, to: 1, start: 0.3, duration: 0.5, ease: outExpo })
    .to(currentText, { prop: "scale.y", from: 0.9, to: 1, start: 0.3, duration: 0.5, ease: outExpo })
    .to(targetText, { prop: "alpha", from: 0, to: 0.5, start: 0.4, duration: 0.4, ease: outQuad });

  // --- Progress bar ---
  const FILL_START = 0.6;
  const FILL_END = 1.7;
  const barCy = contentTop + titleH + g1 + bigH + g2 + barH / 2;
  const barLeft = cx - barW / 2;

  const trackG = new Graphics().roundRect(0, 0, barW, barH, barH / 2).fill(track);
  trackG.position.set(barLeft, barCy - barH / 2);
  trackG.alpha = 0;
  root.addChild(trackG);
  timeline.to(trackG, { prop: "alpha", from: 0, to: 1, start: 0.42, duration: 0.4, ease: outQuad });

  const fillG = new Graphics().roundRect(0, 0, barW, barH, barH / 2).fill(accent);
  fillG.position.set(barLeft, barCy - barH / 2);
  fillG.scale.set(0, 1);
  root.addChild(fillG);
  timeline.to(fillG, { prop: "scale.x", from: 0, to: ratio, start: FILL_START, duration: FILL_END - FILL_START, ease: outExpo });

  // Moving highlight riding the fill's leading edge, fading out at rest.
  const hlW = barH * 0.85;
  const hl = new Graphics().roundRect(-hlW / 2, -barH * 0.36, hlW, barH * 0.72, barH * 0.3).fill({ color: "#FFFFFF", alpha: 0.55 });
  hl.position.set(barLeft + barH * 0.6, barCy);
  hl.alpha = 0;
  root.addChild(hl);
  const hlEndX = barLeft + Math.max(barH * 0.6, ratio * barW - barH * 0.5);
  timeline
    .to(hl, { prop: "x", from: barLeft + barH * 0.6, to: hlEndX, start: FILL_START, duration: FILL_END - FILL_START, ease: outExpo })
    .to(hl, { prop: "alpha", from: 0, to: 0.6, start: FILL_START, duration: 0.2, ease: outQuad })
    .to(hl, { prop: "alpha", from: 0.6, to: 0, start: FILL_END - 0.25, duration: 0.25, ease: outQuad });

  // --- Bottom line: "82% · 1,760 to go" ---
  const lineCy = contentTop + titleH + g1 + bigH + g2 + barH + g3 + lineH / 2;
  const lineText = makeText(fonts, { text: "", role: "body", weight: 600, size: lineFont, color: textColor, anchor: 0.5, align: "center" });
  lineText.position.set(cx, lineCy);
  lineText.alpha = 0;
  root.addChild(lineText);
  timeline.to(lineText, { prop: "alpha", from: 0, to: 0.74, start: 0.72, duration: 0.45, ease: outQuad });

  const fmtLine = (frac: number): string => {
    const cur = current * frac;
    const pct = Math.round((cur / target) * 100);
    const remain = Math.max(0, Math.round(target - cur));
    const tail = `${groupThousands(remain)} to go`;
    return showPercent ? `${pct}% · ${tail}` : tail;
  };
  lineText.text = fmtLine(0);

  const update = (t: number): void => {
    const u = t <= FILL_START ? 0 : t >= FILL_END ? 1 : (t - FILL_START) / (FILL_END - FILL_START);
    const eased = outCubic(u);
    currentText.text = groupThousands(Math.round(current * eased));
    lineText.text = fmtLine(eased);
  };

  return { timeline, duration: 3.6, update };
}

export const goalTracker: TemplateDefinition = {
  id: "goal-tracker",
  name: "Goal Tracker",
  tagline: "A goal card fills its progress bar to the ratio while the count climbs.",
  category: "social",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 2.6,
  fontRoles: { title: "display", current: "display", target: "display" },
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Title", default: "Follower goal", maxLength: 28, shrinkToFit: true },
    { key: "current", type: "text", label: "Current", default: "8,240", maxLength: 12, help: "Digits — counts up to this.", shrinkToFit: true },
    { key: "target", type: "text", label: "Target", default: "10,000", maxLength: 12, help: "Digits — the goal.", shrinkToFit: true },
    { key: "showPercent", type: "toggle", label: "Show percent", default: true },
    { key: "showIcon", type: "toggle", label: "Target icon", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
