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

// A numbered "key point" callout strip — a number chip, a short line, and an
// accent underline that wipes in. Only the full-frame `bg` rect is tied to the
// background field (defaults to the transparent sentinel so it composites
// straight onto footage); the panel/chip use their own palette-only surfaces
// (with a soft shadow) so the callout survives once the canvas fill is gone.
// `onAccent` is a fixed, contrast-checked color for the number on the `accent`
// chip.
const PALETTES: Palette[] = [
  { id: "ink", name: "Ink", colors: { panelBg: "#101014", textColor: "#FFFFFF", accent: "#FF4D1C", onAccent: "#101014" } },
  { id: "paper", name: "Paper", colors: { panelBg: "#FFFFFF", textColor: "#101014", accent: "#2E5BD6", onAccent: "#FFFFFF" } },
  { id: "mint", name: "Mint", colors: { panelBg: "#FFFFFF", textColor: "#0B1F16", accent: "#0F7A55", onAccent: "#FFFFFF" } },
  { id: "grape", name: "Grape", colors: { panelBg: "#221838", textColor: "#FFFFFF", accent: "#C08BFF", onAccent: "#1A1030" } },
];

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", TRANSPARENT_BG));
  const panelBg = pc("panelBg", "#101014");
  const textColor = str(values.textColor, pc("textColor", "#FFFFFF"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const onAccent = pc("onAccent", "#101014");
  const number = str(values.number, "01");
  const text = str(values.text, "Batch similar tasks to keep your focus");
  const showChip = values.showChip !== false;
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
  const padX = Math.round(minDim * 0.03);
  const padY = Math.round(minDim * 0.026);
  const chipSize = showChip ? Math.round(minDim * 0.072) : 0;
  const chipGap = showChip ? Math.round(minDim * 0.024) : 0;

  const textSize0 = Math.round(minDim * 0.036);
  const ruleH = showRule ? Math.max(3, Math.round(minDim * 0.006)) : 0;
  const ruleGap = showRule ? Math.round(minDim * 0.014) : 0;

  const maxTextW = Math.max(140, w * 0.62 - chipSize - chipGap);
  const textSize = fitSize(fonts, text, "display", 700, textSize0, maxTextW);
  const textW = fonts.measure(text, { family: fonts.family("display"), weight: 700, size: textSize });

  const numSize = fitSize(fonts, number, "display", 700, Math.round(chipSize * 0.5), chipSize * 0.8);

  const textColH = textSize + (showRule ? ruleGap + ruleH : 0);
  const contentH = Math.max(chipSize, textColH);
  const panelW = padX * 2 + chipSize + chipGap + textW;
  const panelH = padY * 2 + contentH;
  const panelRadius = Math.round(minDim * 0.016);

  const margin = Math.round(minDim * 0.03);
  const restX = zone.left + margin + panelW / 2;
  const restY = h - zone.bottom - margin - panelH / 2;
  const startX = restX - minDim * 0.12;

  const panel = new Container();
  panel.position.set(startX, restY);
  panel.alpha = 0;
  root.addChild(panel);

  const e = Math.round(panelRadius * 0.4);
  const shOff = Math.round(panelRadius * 0.55);
  panel.addChild(
    new Graphics()
      .roundRect(-panelW / 2 - e, -panelH / 2 - e + shOff, panelW + e * 2, panelH + e * 2, panelRadius + e)
      .fill({ color: "#000000", alpha: 0.18 }),
  );
  panel.addChild(new Graphics().roundRect(-panelW / 2, -panelH / 2, panelW, panelH, panelRadius).fill(panelBg));

  // --- Number chip (toggleable), pops in. ---
  let chip: Container | undefined;
  if (showChip) {
    const chipCX = -panelW / 2 + padX + chipSize / 2;
    chip = new Container();
    chip.position.set(chipCX, 0);
    chip.scale.set(0);
    panel.addChild(chip);
    chip.addChild(new Graphics().roundRect(-chipSize / 2, -chipSize / 2, chipSize, chipSize, Math.round(chipSize * 0.26)).fill(accent));
    chip.addChild(makeText(fonts, { text: number, role: "display", weight: 700, size: numSize, color: onAccent, anchor: 0.5 }));
  }

  // --- Text column: line + accent underline. ---
  const textX = -panelW / 2 + padX + chipSize + chipGap;
  const lineCY = showRule ? -textColH / 2 + textSize / 2 : 0;
  const lineText = makeText(fonts, { text, role: "display", weight: 700, size: textSize, color: textColor, anchor: { x: 0, y: 0.5 } });
  lineText.position.set(textX, lineCY);
  lineText.alpha = 0;
  panel.addChild(lineText);

  let rule: Graphics | undefined;
  if (showRule) {
    const ruleWidth = Math.min(textW, minDim * 0.14);
    const ruleY = textColH / 2 - ruleH / 2;
    rule = new Graphics().roundRect(0, -ruleH / 2, ruleWidth, ruleH, ruleH / 2).fill(accent);
    rule.position.set(textX, ruleY);
    rule.scale.set(0, 1);
    panel.addChild(rule);
  }

  // --- Entrance: panel slides in, chip pops, line and rule reveal. ---
  const enterStart = 0.1;
  const enterDur = 0.5;
  timeline
    .to(panel, { prop: "x", from: startX, to: restX, start: enterStart, duration: enterDur, ease: outExpo })
    .to(panel, { prop: "alpha", from: 0, to: 1, start: enterStart, duration: 0.3, ease: outQuad })
    .to(lineText, { prop: "alpha", from: 0, to: 1, start: 0.34, duration: 0.4, ease: outQuad })
    .to(lineText, { prop: "x", from: textX - 12, to: textX, start: 0.34, duration: 0.5, ease: outExpo });
  if (chip) {
    timeline
      .to(chip, { prop: "scale.x", from: 0, to: 1, start: 0.26, duration: 0.5, ease: makeOutBack(2) })
      .to(chip, { prop: "scale.y", from: 0, to: 1, start: 0.26, duration: 0.5, ease: makeOutBack(2) });
  }
  if (rule) {
    timeline.to(rule, { prop: "scale.x", from: 0, to: 1, start: 0.55, duration: 0.5, ease: outExpo });
  }

  return { timeline, duration: 4.2 };
}

export const keyPoint: TemplateDefinition = {
  id: "key-point",
  name: "Key Point",
  tagline: "A numbered callout strip with a chip and an accent underline.",
  category: "overlay",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 2.4,
  fontRoles: { number: "display", text: "display" },
  palettes: PALETTES,
  fields: [
    { key: "number", type: "text", label: "Number", default: "01", maxLength: 3, shrinkToFit: true },
    { key: "text", type: "text", label: "Key point", default: "Batch similar tasks to keep your focus", maxLength: 52, shrinkToFit: true },
    { key: "showChip", type: "toggle", label: "Number chip", default: true },
    { key: "showRule", type: "toggle", label: "Accent underline", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
