import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  spring,
  safeZone,
  TRANSPARENT_BG,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { makeIcon } from "../shared/icons";

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

// A slim bottom subscribe reminder bar — a bell glyph, a label + handle, and a
// chevron arrow that nudges. Only the full-frame `bg` rect is tied to the
// background field (defaults to the transparent sentinel so it composites
// straight onto footage); the bar uses its own palette-only `barBg` (with a
// soft shadow) so the reminder survives once the canvas fill is gone.
const PALETTES: Palette[] = [
  { id: "youtube", name: "YouTube", colors: { barBg: "#FFFFFF", textColor: "#0F0F0F", accent: "#FF0033" } },
  { id: "dark", name: "Dark", colors: { barBg: "#17171C", textColor: "#FFFFFF", accent: "#FF3355" } },
  { id: "ember", name: "Ember", colors: { barBg: "#FFFFFF", textColor: "#101014", accent: "#FF4D1C" } },
  { id: "night", name: "Night", colors: { barBg: "#141A28", textColor: "#FFFFFF", accent: "#FF5470" } },
];

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", TRANSPARENT_BG));
  const barBg = pc("barBg", "#FFFFFF");
  const textColor = str(values.textColor, pc("textColor", "#0F0F0F"));
  const accent = str(values.accent, pc("accent", "#FF0033"));
  const label = str(values.label, "Subscribe for more");
  const handle = str(values.handle, "@jimastudio");
  const showBell = values.showBell !== false;

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const zone = safeZone(ctx.aspect);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Geometry ---
  const padX = Math.round(minDim * 0.03);
  const padY = Math.round(minDim * 0.02);
  const bellSize = showBell ? Math.round(minDim * 0.044) : 0;
  const bellGap = showBell ? Math.round(minDim * 0.02) : 0;
  const arrowH = Math.round(minDim * 0.036);
  const arrowW = Math.round(arrowH * 0.6);
  const arrowGap = Math.round(minDim * 0.022);
  const handleGap = handle.length > 0 ? Math.round(minDim * 0.014) : 0;

  const availW = (w - zone.left - zone.right) - padX * 2 - bellSize - bellGap - arrowW - arrowGap;
  const handleSize = handle.length > 0 ? fitSize(fonts, handle, "body", 500, Math.round(minDim * 0.026), availW * 0.42) : 0;
  const handleW = handle.length > 0 ? fonts.measure(handle, { family: fonts.family("body"), weight: 500, size: handleSize }) : 0;
  const labelBudget = Math.max(80, availW - handleW - handleGap);
  const labelSize = fitSize(fonts, label, "display", 700, Math.round(minDim * 0.03), labelBudget);
  const labelW = fonts.measure(label, { family: fonts.family("display"), weight: 700, size: labelSize });

  const innerW = bellSize + bellGap + labelW + handleGap + handleW + arrowGap + arrowW;
  const barW = padX * 2 + innerW;
  const barH = padY * 2 + Math.max(bellSize, labelSize, arrowH);
  const barRadius = Math.round(barH / 2);

  const margin = Math.round(minDim * 0.03);
  const barCX = w / 2;
  const barCY = h - zone.bottom - margin - barH / 2;

  const bar = new Container();
  const slideOffset = barH + minDim * 0.06;
  bar.position.set(barCX, barCY + slideOffset);
  bar.alpha = 0;
  root.addChild(bar);

  const e = Math.round(barH * 0.05);
  const shOff = Math.round(barH * 0.08);
  bar.addChild(
    new Graphics()
      .roundRect(-barW / 2 - e, -barH / 2 - e + shOff, barW + e * 2, barH + e * 2, barRadius + e)
      .fill({ color: "#000000", alpha: 0.18 }),
  );
  bar.addChild(new Graphics().roundRect(-barW / 2, -barH / 2, barW, barH, barRadius).fill(barBg));

  let cursorX = -innerW / 2;

  // --- Bell glyph (toggleable), pops in and swings. ---
  let bell: Container | undefined;
  if (showBell) {
    bell = new Container();
    bell.position.set(cursorX + bellSize / 2, 0);
    bell.scale.set(0);
    bar.addChild(bell);
    bell.addChild(makeIcon("bell", bellSize, { color: accent }));
    cursorX += bellSize + bellGap;
  }

  // --- Label + handle. ---
  const labelText = makeText(fonts, { text: label, role: "display", weight: 700, size: labelSize, color: textColor, anchor: { x: 0, y: 0.5 } });
  labelText.position.set(cursorX, 0);
  bar.addChild(labelText);
  cursorX += labelW + handleGap;

  if (handle.length > 0) {
    const handleText = makeText(fonts, { text: handle, role: "body", weight: 500, size: handleSize, color: textColor, anchor: { x: 0, y: 0.5 } });
    handleText.alpha = 0.66;
    handleText.position.set(cursorX, 0);
    bar.addChild(handleText);
    cursorX += handleW;
  }

  // --- Chevron arrow that nudges forward (pure fn of t). ---
  const arrowBaseX = cursorX + arrowGap + arrowW / 2;
  const arrow = new Container();
  arrow.position.set(arrowBaseX, 0);
  arrow.addChild(
    new Graphics()
      .moveTo(-arrowW / 2, -arrowH / 2)
      .lineTo(arrowW / 2, 0)
      .lineTo(-arrowW / 2, arrowH / 2)
      .stroke({ color: accent, width: Math.max(2.5, arrowW * 0.22), cap: "round", join: "round" }),
  );
  arrow.alpha = 0;
  bar.addChild(arrow);

  // --- Entrance: the bar slides up + fades; bell pops; arrow fades in. ---
  const enterStart = 0.1;
  const enterDur = 0.55;
  const landTime = enterStart + enterDur;
  timeline
    .to(bar, { prop: "position.y", from: barCY + slideOffset, to: barCY, start: enterStart, duration: enterDur, ease: outExpo })
    .to(bar, { prop: "alpha", from: 0, to: 1, start: enterStart, duration: 0.3, ease: outQuad })
    .to(arrow, { prop: "alpha", from: 0, to: 1, start: 0.45, duration: 0.4, ease: outQuad });
  if (bell) {
    timeline
      .to(bell, { prop: "scale.x", from: 0, to: 1, start: 0.3, duration: 0.5, ease: spring(0.42) })
      .to(bell, { prop: "scale.y", from: 0, to: 1, start: 0.3, duration: 0.5, ease: spring(0.42) });
  }

  // --- Live nudge + bell swing (pure fn of t). ---
  const nudgeAmp = minDim * 0.012;
  const NUDGE_PERIOD = 1.1;
  const update = (t: number): void => {
    if (t < landTime) return;
    const tau = t - landTime;
    const u = (tau % NUDGE_PERIOD) / NUDGE_PERIOD;
    arrow.position.x = arrowBaseX + nudgeAmp * (0.5 - 0.5 * Math.cos(u * Math.PI * 2));
    if (bell) bell.rotation = 0.14 * Math.sin(tau * 5.2) * Math.max(0, 1 - (tau % NUDGE_PERIOD) / (NUDGE_PERIOD * 0.6));
  };

  return { timeline, duration: 4.4, update };
}

export const subscribeReminder: TemplateDefinition = {
  id: "subscribe-reminder",
  name: "Subscribe Reminder",
  tagline: "A slim subscribe bar with a bell and an arrow that nudges.",
  category: "overlay",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 2.4,
  fontRoles: { label: "display", handle: "body" },
  palettes: PALETTES,
  fields: [
    { key: "label", type: "text", label: "Label", default: "Subscribe for more", maxLength: 32, shrinkToFit: true },
    { key: "handle", type: "text", label: "Handle", default: "@jimastudio", maxLength: 24, optional: true, shrinkToFit: true },
    { key: "showBell", type: "toggle", label: "Bell glyph", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
