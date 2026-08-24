import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
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
  letterSpacing = 0,
): number {
  if (text.length === 0 || maxWidth <= 0) return size0;
  const w = fonts.measure(text, { family: fonts.family(role), weight, size: size0, letterSpacing });
  return w > maxWidth ? Math.max(10, Math.floor(size0 * (maxWidth / w))) : size0;
}

// A clean editorial broadcast dateline lower-third — a location + date on a slim
// panel with a vertical accent rule. Only the full-frame `bg` rect is tied to
// the background field (defaults to the transparent sentinel so it composites
// straight onto footage); the panel uses its own palette-only `panelBg` (with a
// soft shadow) so the dateline survives once the canvas fill is gone.
const PALETTES: Palette[] = [
  { id: "ink", name: "Ink", colors: { panelBg: "#101014", textColor: "#FFFFFF", accent: "#FF4D1C" } },
  { id: "paper", name: "Paper", colors: { panelBg: "#FFFFFF", textColor: "#14110B", accent: "#B31232" } },
  { id: "navy", name: "Navy", colors: { panelBg: "#0B1F4D", textColor: "#FFFFFF", accent: "#4FC3F7" } },
  { id: "editorial", name: "Editorial", colors: { panelBg: "#FFFFFF", textColor: "#1A1712", accent: "#1F6F5C" } },
];

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", TRANSPARENT_BG));
  const panelBg = pc("panelBg", "#101014");
  const textColor = str(values.textColor, pc("textColor", "#FFFFFF"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const place = str(values.place, "Lisbon, Portugal").toUpperCase();
  const date = str(values.date, "Aug 14");
  const showRule = values.showRule !== false;

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const zone = safeZone(ctx.aspect);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Geometry ---
  const padX = Math.round(minDim * 0.028);
  const padY = Math.round(minDim * 0.022);
  const ruleW = showRule ? Math.max(3, Math.round(minDim * 0.008)) : 0;
  const ruleGap = showRule ? Math.round(minDim * 0.02) : 0;
  const rowGap = Math.round(minDim * 0.008);

  const placeLS = 0.08;
  const maxTextW = Math.max(120, w * 0.6);
  const placeSize = fitSize(fonts, place, "display", 700, Math.round(minDim * 0.034), maxTextW, 0);
  const dateSize = date.length > 0 ? fitSize(fonts, date, "body", 500, Math.round(minDim * 0.024), maxTextW) : 0;

  const placeW = fonts.measure(place, { family: fonts.family("display"), weight: 700, size: placeSize, letterSpacing: placeSize * placeLS });
  const dateW = date.length > 0 ? fonts.measure(date, { family: fonts.family("body"), weight: 500, size: dateSize }) : 0;
  const textBlockW = Math.max(placeW, dateW);

  const textRowsH = date.length > 0 ? placeSize + rowGap + dateSize : placeSize;
  const panelW = padX * 2 + ruleW + ruleGap + textBlockW;
  const panelH = padY * 2 + textRowsH;
  const panelRadius = Math.round(minDim * 0.012);

  const margin = Math.round(minDim * 0.03);
  const restX = zone.left + margin + panelW / 2;
  const restY = h - zone.bottom - margin - panelH / 2;
  const startY = restY + minDim * 0.05;

  const panel = new Container();
  panel.position.set(restX, startY);
  panel.alpha = 0;
  root.addChild(panel);

  const e = Math.round(panelRadius * 0.5);
  const shOff = Math.round(panelRadius * 0.7);
  panel.addChild(
    new Graphics()
      .roundRect(-panelW / 2 - e, -panelH / 2 - e + shOff, panelW + e * 2, panelH + e * 2, panelRadius + e)
      .fill({ color: "#000000", alpha: 0.18 }),
  );
  panel.addChild(new Graphics().roundRect(-panelW / 2, -panelH / 2, panelW, panelH, panelRadius).fill(panelBg));

  // --- Vertical accent rule (toggleable), grows in from the top. ---
  let rule: Graphics | undefined;
  const ruleX = -panelW / 2 + padX;
  if (showRule) {
    const ruleH = textRowsH;
    rule = new Graphics().roundRect(ruleX, -ruleH / 2, ruleW, ruleH, ruleW / 2).fill(accent);
    rule.scale.set(1, 0);
    panel.addChild(rule);
  }

  const textX = -panelW / 2 + padX + ruleW + ruleGap;
  const placeY = date.length > 0 ? -textRowsH / 2 + placeSize / 2 : 0;
  const dateY = date.length > 0 ? textRowsH / 2 - dateSize / 2 : 0;

  const placeText = makeText(fonts, { text: place, role: "display", weight: 700, size: placeSize, color: textColor, anchor: { x: 0, y: 0.5 }, letterSpacing: placeSize * placeLS });
  placeText.position.set(textX, placeY);
  placeText.alpha = 0;
  panel.addChild(placeText);

  if (date.length > 0) {
    const dateText = makeText(fonts, { text: date, role: "body", weight: 500, size: dateSize, color: textColor, anchor: { x: 0, y: 0.5 }, letterSpacing: dateSize * 0.02 });
    dateText.alpha = 0;
    dateText.position.set(textX, dateY);
    panel.addChild(dateText);
    timeline
      .to(dateText, { prop: "alpha", from: 0, to: 0.72, start: 0.5, duration: 0.4, ease: outQuad })
      .to(dateText, { prop: "x", from: textX - 12, to: textX, start: 0.5, duration: 0.5, ease: outExpo });
  }

  // --- Entrance: the panel slides up + fades; text and rule reveal after. ---
  const enterStart = 0.1;
  const enterDur = 0.5;
  timeline
    .to(panel, { prop: "position.y", from: startY, to: restY, start: enterStart, duration: enterDur, ease: outExpo })
    .to(panel, { prop: "alpha", from: 0, to: 1, start: enterStart, duration: 0.3, ease: outQuad })
    .to(placeText, { prop: "alpha", from: 0, to: 1, start: 0.32, duration: 0.4, ease: outQuad })
    .to(placeText, { prop: "x", from: textX - 12, to: textX, start: 0.32, duration: 0.5, ease: outExpo });
  if (rule) {
    timeline.to(rule, { prop: "scale.y", from: 0, to: 1, start: 0.28, duration: 0.5, ease: outExpo });
  }

  return { timeline, duration: 4.0 };
}

export const dateline: TemplateDefinition = {
  id: "dateline",
  name: "Dateline",
  tagline: "A clean editorial location + date lower-third with an accent rule.",
  category: "overlay",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 2.4,
  fontRoles: { place: "display", date: "body" },
  palettes: PALETTES,
  fields: [
    { key: "place", type: "text", label: "Location", default: "Lisbon, Portugal", maxLength: 40, shrinkToFit: true },
    { key: "date", type: "text", label: "Date", default: "Aug 14", maxLength: 24, optional: true, shrinkToFit: true },
    { key: "showRule", type: "toggle", label: "Accent rule", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
