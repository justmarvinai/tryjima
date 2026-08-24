import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
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

type Corner = "top-left" | "top-right" | "bottom-left" | "bottom-right";

// A compact pill "tag" pops into a corner of the frame — a smaller, snappier
// cousin of name-tag/topic-bug meant for quick badges ("New Episode", "Ep. 12
// Live now"). Only the full-frame `bg` rect is tied to the background field
// (defaults to the transparent sentinel so the tag composites straight onto
// footage); the pill surface uses its own palette-only `tagBg` so it stays a
// distinct, readable card once the canvas fill is gone.
const PALETTES: Palette[] = [
  { id: "cloud", name: "Cloud", colors: { tagBg: "#FFFFFF", textColor: "#101014", accent: "#FF4D1C" } },
  { id: "midnight", name: "Midnight", colors: { tagBg: "#17171C", textColor: "#FFFFFF", accent: "#33D9C4" } },
  { id: "mint", name: "Mint", colors: { tagBg: "#FFFFFF", textColor: "#08221A", accent: "#17A34A" } },
  { id: "grape", name: "Grape", colors: { tagBg: "#241443", textColor: "#FFFFFF", accent: "#FF7CD1" } },
];

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", TRANSPARENT_BG));
  const tagBg = pc("tagBg", "#FFFFFF");
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const label = str(values.label, "New Episode");
  const sublabel = str(values.sublabel, "Every Tuesday");
  const corner = str(values.corner, "top-left") as Corner;
  const showDot = values.showDot !== false;

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const zone = safeZone(ctx.aspect);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Geometry ---
  const dotR = Math.round(minDim * 0.02);
  const padX = Math.round(minDim * 0.026);
  const padY = Math.round(minDim * 0.018);
  const dotGap = Math.round(minDim * 0.018);
  const rowGap = Math.round(minDim * 0.006);

  const dotBlockW = showDot ? dotR * 2 + dotGap : 0;
  const maxTextW = Math.max(100, w * 0.5 - dotBlockW);

  const labelSize = fitSize(fonts, label, "display", 700, Math.round(minDim * 0.032), maxTextW);
  const subSize = sublabel.length > 0 ? fitSize(fonts, sublabel, "body", 500, Math.round(minDim * 0.02), maxTextW) : 0;

  const labelW = fonts.measure(label, { family: fonts.family("display"), weight: 700, size: labelSize });
  const subW = sublabel.length > 0 ? fonts.measure(sublabel, { family: fonts.family("body"), weight: 500, size: subSize }) : 0;
  const textBlockW = Math.max(labelW, subW);

  const textRowsH = sublabel.length > 0 ? labelSize + rowGap + subSize : labelSize;
  const contentH = Math.max(showDot ? dotR * 2 : 0, textRowsH);
  const tagW = padX * 2 + dotBlockW + textBlockW;
  const tagH = padY * 2 + contentH;
  const tagRadius = Math.round(tagH * 0.32);

  const isTop = corner === "top-left" || corner === "top-right";
  const isLeft = corner === "top-left" || corner === "bottom-left";

  const marginY = Math.round(minDim * 0.022);
  const restX = isLeft ? zone.left + tagW / 2 : w - zone.right - tagW / 2;
  const restY = isTop ? zone.top + marginY + tagH / 2 : h - zone.bottom - marginY - tagH / 2;
  const slideDist = minDim * 0.16;
  const startX = isLeft ? restX - slideDist : restX + slideDist;

  const tag = new Container();
  tag.position.set(startX, restY);
  tag.alpha = 0;
  root.addChild(tag);

  // Soft shadow so the tag reads as a distinct surface over any footage.
  const e = Math.round(tagH * 0.04);
  const off = Math.round(tagH * 0.07);
  tag.addChild(
    new Graphics()
      .roundRect(-tagW / 2 - e, -tagH / 2 - e + off, tagW + e * 2, tagH + e * 2, tagRadius + e)
      .fill({ color: "#000000", alpha: 0.18 }),
  );
  tag.addChild(new Graphics().roundRect(-tagW / 2, -tagH / 2, tagW, tagH, tagRadius).fill(tagBg));

  let cursorX = -tagW / 2 + padX;
  let dot: Graphics | undefined;
  if (showDot) {
    const dotX = cursorX + dotR;
    dot = new Graphics().circle(0, 0, dotR).fill(accent);
    dot.position.set(dotX, 0);
    tag.addChild(dot);
    cursorX += dotR * 2 + dotGap;
  }

  const textX = cursorX;
  const blockH = textRowsH;
  const labelY = sublabel.length > 0 ? -blockH / 2 + labelSize / 2 : 0;
  const subY = sublabel.length > 0 ? blockH / 2 - subSize / 2 : 0;

  const labelText = makeText(fonts, {
    text: label,
    role: "display",
    weight: 700,
    size: labelSize,
    color: textColor,
    anchor: { x: 0, y: 0.5 },
  });
  labelText.position.set(textX, labelY);
  tag.addChild(labelText);

  if (sublabel.length > 0) {
    const subText = makeText(fonts, {
      text: sublabel,
      role: "body",
      weight: 500,
      size: subSize,
      color: textColor,
      anchor: { x: 0, y: 0.5 },
    });
    subText.alpha = 0.72;
    subText.position.set(textX, subY);
    tag.addChild(subText);
  }

  // --- Entrance: slides in from the corner's outer edge with a snappy overshoot. ---
  const enterStart = 0.08;
  const enterDur = 0.5;
  timeline
    .to(tag, { prop: "x", from: startX, to: restX, start: enterStart, duration: enterDur, ease: makeOutBack(1.7) })
    .to(tag, { prop: "alpha", from: 0, to: 1, start: enterStart, duration: 0.26, ease: outQuad });

  // --- Pulsing dot (toggleable): a soft, continuous breathing pulse through the hold. ---
  const pulseStart = enterStart + enterDur;
  const PULSE_PERIOD = 1.2;
  const update = (t: number): void => {
    if (!dot) return;
    if (t < pulseStart) {
      dot.scale.set(1);
      dot.alpha = 1;
      return;
    }
    const u = ((t - pulseStart) % PULSE_PERIOD) / PULSE_PERIOD;
    dot.scale.set(1 + 0.28 * Math.sin(u * Math.PI));
    dot.alpha = 0.7 + 0.3 * Math.cos(u * Math.PI * 2);
  };

  return { timeline, duration: 4.0, update };
}

export const cornerTag: TemplateDefinition = {
  id: "corner-tag",
  name: "Corner Tag",
  tagline: "A compact pill badge slides into any corner with a soft pulse.",
  category: "overlay",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 2.6,
  fontRoles: { label: "display", sublabel: "body" },
  palettes: PALETTES,
  fields: [
    { key: "label", type: "text", label: "Label", default: "New Episode", maxLength: 26, shrinkToFit: true },
    { key: "sublabel", type: "text", label: "Sublabel", default: "Every Tuesday", maxLength: 34, optional: true, shrinkToFit: true },
    {
      key: "corner",
      type: "select",
      label: "Corner",
      default: "top-left",
      options: [
        { value: "top-left", label: "Top left" },
        { value: "top-right", label: "Top right" },
        { value: "bottom-left", label: "Bottom left" },
        { value: "bottom-right", label: "Bottom right" },
      ],
    },
    { key: "showDot", type: "toggle", label: "Pulsing dot", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
