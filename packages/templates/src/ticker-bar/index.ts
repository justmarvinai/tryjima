import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outExpo,
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

/** Shrink a single-line size so `text` fits `maxWidth`. */
function fitSize(
  fonts: FontRegistry,
  text: string,
  role: FontRole,
  weight: number,
  size0: number,
  maxWidth: number,
): number {
  const w = fonts.measure(text, { family: fonts.family(role), weight, size: size0 });
  return w > maxWidth ? Math.max(10, Math.floor(size0 * (maxWidth / w))) : size0;
}

// A broadcast news-ticker strip, full-bleed and flush along the bottom edge —
// unlike the inset lower-third/CTA cards elsewhere in this family, it's meant
// to read as authentic chyron chrome, so it spans edge-to-edge. Only the
// full-frame `bg` rect is tied to the background field (defaults to the
// transparent sentinel so it composites straight onto footage); the strip
// uses its own palette-only `barBg`/`accent` surfaces so the graphic survives
// once the canvas fill is gone. The marquee's scroll offset is a pure
// function of `t` in the `update` hook (never a bounded timeline tween — it
// has to run forever, not across a fixed span), built from two back-to-back
// copies of a long repeated headline so the wrap is seamless at any frame.
const PALETTES: Palette[] = [
  { id: "newsroom-red", name: "Newsroom red", colors: { barBg: "#101014", textColor: "#FFFFFF", accent: "#E1131A", accentText: "#FFFFFF" } },
  { id: "wire-cobalt", name: "Wire cobalt", colors: { barBg: "#0B1F4D", textColor: "#FFFFFF", accent: "#2E7DF6", accentText: "#101014" } },
  { id: "paper-ink", name: "Paper ink", colors: { barBg: "#FFFFFF", textColor: "#101014", accent: "#FF4D1C", accentText: "#101014" } },
  { id: "midnight-gold", name: "Midnight gold", colors: { barBg: "#15151B", textColor: "#F5F0E6", accent: "#D4A017", accentText: "#101014" } },
];

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", TRANSPARENT_BG));
  const barBg = pc("barBg", "#101014");
  const textColor = str(values.textColor, pc("textColor", "#FFFFFF"));
  const accent = str(values.accent, pc("accent", "#E1131A"));
  const accentText = pc("accentText", "#FFFFFF");
  const flagTxt = str(values.flagLabel, "Live").toUpperCase();
  const headline = str(
    values.headline,
    "Breaking: this is your customizable news ticker — edit the headline to match your story.",
  );
  const showFlag = values.showFlag !== false;

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Geometry: full-bleed bar flush against the bottom edge. ---
  const barH = Math.round(minDim * 0.088);
  const flagPadX = Math.round(minDim * 0.026);
  const flagDotR = Math.round(minDim * 0.009);
  const flagGap = Math.round(minDim * 0.014);
  const flagLabelSize = showFlag ? fitSize(fonts, flagTxt, "display", 700, Math.round(minDim * 0.03), minDim * 0.16) : 0;
  const flagLabelW = showFlag
    ? fonts.measure(flagTxt, { family: fonts.family("display"), weight: 700, size: flagLabelSize, letterSpacing: flagLabelSize * 0.04 })
    : 0;
  const flagW = showFlag ? Math.max(minDim * 0.11, flagDotR * 2 + flagGap + flagLabelW + flagPadX * 2) : 0;
  const flagSlant = Math.round(barH * 0.32);

  const tickerGap = Math.round(minDim * 0.02);
  const tickerPadRight = Math.round(minDim * 0.026);
  const tickerX0 = showFlag ? flagW + tickerGap : tickerPadRight;
  const tickerViewportW = Math.max(60, w - tickerX0 - tickerPadRight);
  const tickerSize = Math.round(minDim * 0.03);

  // --- Bar surface + flag/marquee, grouped so they slide up together. ---
  const barGroup = new Container();
  barGroup.position.set(0, h);
  root.addChild(barGroup);

  barGroup.addChild(new Graphics().rect(0, 0, w, barH).fill(barBg));

  // --- Flag block (slanted trailing edge), toggleable. ---
  let flagDot: Graphics | undefined;
  if (showFlag) {
    barGroup.addChild(new Graphics().poly([0, 0, flagW, 0, flagW - flagSlant, barH, 0, barH]).fill(accent));

    const rowY = barH / 2;
    const dotX = flagPadX + flagDotR;
    flagDot = new Graphics().circle(0, 0, flagDotR).fill(accentText);
    flagDot.position.set(dotX, rowY);
    barGroup.addChild(flagDot);

    const flagLabelText = makeText(fonts, {
      text: flagTxt,
      role: "display",
      weight: 700,
      size: flagLabelSize,
      color: accentText,
      anchor: { x: 0, y: 0.5 },
      letterSpacing: flagLabelSize * 0.04,
    });
    flagLabelText.position.set(dotX + flagDotR + flagGap, rowY);
    barGroup.addChild(flagLabelText);
  }

  // --- Marquee: a masked viewport holding two back-to-back copies of a lap
  // long enough to always cover the viewport, so the modulo wrap in `update`
  // never shows a gap. ---
  const viewport = new Container();
  viewport.position.set(tickerX0, barH / 2);
  barGroup.addChild(viewport);

  const maskG = new Graphics().rect(0, -barH / 2, tickerViewportW, barH).fill(0xffffff);
  viewport.addChild(maskG);

  const unit = `${headline}      •      `;
  const unitW = fonts.measure(unit, { family: fonts.family("display"), weight: 500, size: tickerSize });
  const reps = Math.max(1, Math.ceil((tickerViewportW * 1.05) / Math.max(1, unitW)));
  const lapText = unit.repeat(reps);
  const lapW = fonts.measure(lapText, { family: fonts.family("display"), weight: 500, size: tickerSize });

  const reel = new Container();
  viewport.addChild(reel);
  reel.mask = maskG;
  for (const copyX of [0, lapW]) {
    const copy = makeText(fonts, {
      text: lapText,
      role: "display",
      weight: 500,
      size: tickerSize,
      color: textColor,
      anchor: { x: 0, y: 0.5 },
    });
    copy.position.set(copyX, 0);
    reel.addChild(copy);
  }

  // --- Entrance: the whole strip slides up from below the frame. ---
  const enterStart = 0.1;
  const enterDur = 0.55;
  const enterLand = enterStart + enterDur;
  timeline.to(barGroup, { prop: "y", from: h, to: h - barH, start: enterStart, duration: enterDur, ease: outExpo });

  // --- Scroll offset + flag-dot pulse: pure functions of t (no tween — the
  // scroll must run for the entire clip, not across a bounded span). ---
  const SCROLL_SPEED = minDim * 0.3; // px/s
  const PULSE_PERIOD = 1.0;
  const update = (t: number): void => {
    reel.x = -((t * SCROLL_SPEED) % lapW);
    if (!flagDot) return;
    if (t < enterLand) {
      flagDot.alpha = 1;
      flagDot.scale.set(1);
      return;
    }
    const u = ((t - enterLand) % PULSE_PERIOD) / PULSE_PERIOD;
    flagDot.scale.set(1 + 0.3 * Math.sin(u * Math.PI));
    flagDot.alpha = 0.65 + 0.35 * Math.sin(u * Math.PI);
  };

  return { timeline, duration: 5.0, update };
}

export const tickerBar: TemplateDefinition = {
  id: "ticker-bar",
  name: "Ticker Bar",
  tagline: "A broadcast news ticker scrolls headlines along the bottom edge.",
  category: "overlay",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 3.5,
  fontRoles: { headline: "display", flagLabel: "display" },
  palettes: PALETTES,
  fields: [
    { key: "flagLabel", type: "text", label: "Flag label", default: "LIVE", maxLength: 12, optional: true, shrinkToFit: true },
    {
      key: "headline",
      type: "text",
      label: "Ticker headline",
      default: "Breaking: this is your customizable news ticker — edit the headline to match your story.",
      maxLength: 160,
    },
    { key: "showFlag", type: "toggle", label: "Flag box", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
