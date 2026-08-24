import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
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

// A broadcast news lower-third: a stacked kicker + headline bar slide in from
// the left, staggered, with an optional pulsing "LIVE" flag box. Only the
// full-frame `bg` rect is tied to the background field (defaults to the
// transparent sentinel so it composites straight onto footage); the bars use
// their own palette-only `barBg`/`accent` surfaces so the graphic survives as
// overlay content once the canvas fill is gone. `accentText` is a fixed,
// contrast-checked palette color for text/dots sitting on the `accent` fill
// (not user-editable, so the kicker/flag stay legible under any accent pick).
const PALETTES: Palette[] = [
  { id: "newsroom-navy", name: "Newsroom navy", colors: { barBg: "#101014", textColor: "#FFFFFF", accent: "#E1131A", accentText: "#FFFFFF" } },
  { id: "wire-blue", name: "Wire blue", colors: { barBg: "#0B1F4D", textColor: "#FFFFFF", accent: "#1650C0", accentText: "#FFFFFF" } },
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
  const kickerTxt = str(values.kicker, "Breaking News").toUpperCase();
  const headline = str(values.headline, "Local team wins championship in overtime thriller");
  const flagTxt = str(values.flagLabel, "Live").toUpperCase();
  const showFlag = values.showFlag !== false;

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const zone = safeZone(ctx.aspect);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Flag box geometry first (fixed, content-independent budget for the bars). ---
  const flagPadX = Math.round(minDim * 0.018);
  const flagDotR = Math.round(minDim * 0.009);
  const flagGap = Math.round(minDim * 0.014);
  const flagLabelSize = showFlag ? fitSize(fonts, flagTxt, "display", 700, Math.round(minDim * 0.022), minDim * 0.14) : 0;
  const flagLabelW = showFlag
    ? fonts.measure(flagTxt, { family: fonts.family("display"), weight: 700, size: flagLabelSize, letterSpacing: flagLabelSize * 0.05 })
    : 0;
  const flagW = showFlag ? Math.max(minDim * 0.075, flagDotR * 2 + flagGap + flagLabelW + flagPadX * 2) : 0;
  const gapFlagBar = showFlag ? Math.round(minDim * 0.016) : 0;

  // --- Bar text sizing (shrink to fit the width left after the flag). ---
  const outerMaxW = w - zone.left - zone.right;
  const barMaxW = Math.max(120, outerMaxW - flagW - gapFlagBar);

  const headlinePadX = Math.round(minDim * 0.026);
  const headlinePadY = Math.round(minDim * 0.017);
  const kickerPadX = Math.round(minDim * 0.022);
  const kickerPadY = Math.round(minDim * 0.009);

  const headlineSize = fitSize(fonts, headline, "display", 700, Math.round(minDim * 0.043), barMaxW - headlinePadX * 2);
  const kickerSize = fitSize(fonts, kickerTxt, "body", 700, Math.round(minDim * 0.021), barMaxW - kickerPadX * 2);

  const headlineW = fonts.measure(headline, { family: fonts.family("display"), weight: 700, size: headlineSize });
  const kickerW = fonts.measure(kickerTxt, { family: fonts.family("body"), weight: 700, size: kickerSize, letterSpacing: kickerSize * 0.06 });

  const headlineBarW = Math.min(barMaxW, headlineW + headlinePadX * 2);
  const headlineBarH = headlineSize + headlinePadY * 2;
  const kickerBarW = Math.min(barMaxW, kickerW + kickerPadX * 2);
  const kickerBarH = kickerSize + kickerPadY * 2;

  // --- Vertical stack, anchored lower-left. Kicker sits flush above the headline bar. ---
  const marginBottom = Math.round(minDim * 0.03);
  const stackBottomY = h - zone.bottom - marginBottom;
  const headlineCenterY = stackBottomY - headlineBarH / 2;
  const kickerCenterY = stackBottomY - headlineBarH - kickerBarH / 2;

  const barLeftX = zone.left + (showFlag ? flagW + gapFlagBar : 0);
  const flagH = kickerBarH + headlineBarH;
  const flagCenterX = zone.left + flagW / 2;
  const flagCenterY = stackBottomY - flagH / 2;

  // --- Headline bar (leads the stagger). ---
  const headlineRestX = barLeftX + headlineBarW / 2;
  const headlineRow = new Container();
  headlineRow.position.set(headlineRestX - headlineBarW, headlineCenterY);
  root.addChild(headlineRow);
  headlineRow.addChild(new Graphics().roundRect(-headlineBarW / 2, -headlineBarH / 2, headlineBarW, headlineBarH, Math.round(headlineBarH * 0.12)).fill(barBg));
  const headlineText = makeText(fonts, {
    text: headline,
    role: "display",
    weight: 700,
    size: headlineSize,
    color: textColor,
    anchor: { x: 0, y: 0.5 },
  });
  headlineText.position.set(-headlineBarW / 2 + headlinePadX, 0);
  headlineRow.addChild(headlineText);
  timeline.to(headlineRow, { prop: "x", from: headlineRestX - headlineBarW, to: headlineRestX, start: 0.0, duration: 0.45, ease: outExpo });

  // --- Kicker accent block (follows). ---
  const kickerRestX = barLeftX + kickerBarW / 2;
  const kickerRow = new Container();
  kickerRow.position.set(kickerRestX - kickerBarW, kickerCenterY);
  root.addChild(kickerRow);
  kickerRow.addChild(new Graphics().roundRect(-kickerBarW / 2, -kickerBarH / 2, kickerBarW, kickerBarH, Math.round(kickerBarH * 0.14)).fill(accent));
  const kickerText = makeText(fonts, {
    text: kickerTxt,
    role: "body",
    weight: 700,
    size: kickerSize,
    color: accentText,
    anchor: { x: 0, y: 0.5 },
    letterSpacing: kickerSize * 0.06,
  });
  kickerText.position.set(-kickerBarW / 2 + kickerPadX, 0);
  kickerRow.addChild(kickerText);
  timeline.to(kickerRow, { prop: "x", from: kickerRestX - kickerBarW, to: kickerRestX, start: 0.12, duration: 0.42, ease: outExpo });

  // --- Flag box (toggleable): the last piece to land, with a pulsing dot. ---
  let flagDot: Graphics | undefined;
  const flagStart = 0.22;
  const flagDur = 0.5;
  const flagLandTime = flagStart + flagDur;
  if (showFlag) {
    const flagBox = new Container();
    flagBox.position.set(flagCenterX - flagW, flagCenterY);
    root.addChild(flagBox);
    flagBox.addChild(new Graphics().roundRect(-flagW / 2, -flagH / 2, flagW, flagH, Math.round(flagH * 0.1)).fill(accent));

    const rowY = flagDotR * 0.1;
    const dotX = -flagW / 2 + flagPadX + flagDotR;
    flagDot = new Graphics().circle(0, 0, flagDotR).fill(accentText);
    flagDot.position.set(dotX, rowY);
    flagBox.addChild(flagDot);

    const flagLabelText = makeText(fonts, {
      text: flagTxt,
      role: "display",
      weight: 700,
      size: flagLabelSize,
      color: accentText,
      anchor: { x: 0, y: 0.5 },
      letterSpacing: flagLabelSize * 0.05,
    });
    flagLabelText.position.set(dotX + flagDotR + flagGap, rowY);
    flagBox.addChild(flagLabelText);

    timeline.to(flagBox, { prop: "x", from: flagCenterX - flagW, to: flagCenterX, start: flagStart, duration: flagDur, ease: makeOutBack(1.5) });
  }

  // --- Pulsing flag dot (guarded by showFlag) ---
  const PULSE_PERIOD = 1.0;
  const update = (t: number): void => {
    if (!flagDot) return;
    if (t < flagLandTime) {
      flagDot.alpha = 1;
      flagDot.scale.set(1);
      return;
    }
    const u = ((t - flagLandTime) % PULSE_PERIOD) / PULSE_PERIOD;
    flagDot.scale.set(1 + 0.3 * Math.sin(u * Math.PI));
    flagDot.alpha = 0.65 + 0.35 * Math.sin(u * Math.PI); // gentle breathe, never fully invisible
  };

  return { timeline, duration: 4.5, update };
}

export const newsLowerThird: TemplateDefinition = {
  id: "news-lower-third",
  name: "News Lower Third",
  tagline: "A stacked broadcast bar slides in with a kicker and a live flag.",
  category: "overlay",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 3.2,
  fontRoles: { headline: "display", kicker: "body", flagLabel: "display" },
  palettes: PALETTES,
  fields: [
    { key: "kicker", type: "text", label: "Kicker", default: "Breaking News", maxLength: 28, shrinkToFit: true },
    { key: "headline", type: "text", label: "Headline", default: "Local team wins championship in overtime thriller", maxLength: 60, shrinkToFit: true },
    { key: "flagLabel", type: "text", label: "Flag label", default: "Live", maxLength: 10, optional: true, shrinkToFit: true },
    { key: "showFlag", type: "toggle", label: "Live flag box", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
