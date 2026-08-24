import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  spring,
  safeZone,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { avatar } from "../shared/ui";

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

// A rounded chip pops onto a corner — a compact "who's talking" tag. Only the
// full-frame `bg` rect is tied to the background field (blanked by transparent
// export); the chip surface uses its own palette-only `chipBg` so it survives
// as the overlay content.
const PALETTES: Palette[] = [
  { id: "cloud", name: "Cloud", colors: { background: "#EEF1F6", chipBg: "#FFFFFF", textColor: "#0B0B0F", accent: "#FF4D1C" } },
  { id: "midnight", name: "Midnight", colors: { background: "#0C0C10", chipBg: "#1C1C22", textColor: "#FFFFFF", accent: "#FF4D1C" } },
  { id: "mint", name: "Mint", colors: { background: "#E7F7EF", chipBg: "#FFFFFF", textColor: "#0B1F16", accent: "#17A34A" } },
  { id: "blush", name: "Blush", colors: { background: "#FCEDF3", chipBg: "#2A0A1E", textColor: "#FFFFFF", accent: "#FF2E9E" } },
];

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#EEF1F6"));
  const chipBg = pc("chipBg", "#FFFFFF");
  const textColor = str(values.textColor, pc("textColor", "#0B0B0F"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const name = str(values.name, "Sam Rivera");
  const handleRaw = str(values.handle, "@samrivera");
  const showDot = values.showDot !== false;

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const zone = safeZone(ctx.aspect);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  const dotR = Math.round(minDim * 0.032);
  const padX = Math.round(minDim * 0.026);
  const padY = Math.round(minDim * 0.02);
  const rowGap = Math.round(minDim * 0.008);
  const dotGap = Math.round(minDim * 0.022);

  const dotBlockW = showDot ? dotR * 2 + dotGap : 0;
  const maxTextW = Math.max(120, w * 0.55 - dotBlockW);

  const nameSize = fitSize(fonts, name, "display", 700, Math.round(minDim * 0.036), maxTextW);
  const handleTxt = handleRaw.length > 0 ? (handleRaw.startsWith("@") ? handleRaw : `@${handleRaw}`) : "";
  const handleSize = handleTxt.length > 0 ? fitSize(fonts, handleTxt, "body", 600, Math.round(minDim * 0.021), maxTextW) : 0;

  const nameW = fonts.measure(name, { family: fonts.family("display"), weight: 700, size: nameSize });
  const handleW = handleTxt.length > 0 ? fonts.measure(handleTxt, { family: fonts.family("body"), weight: 600, size: handleSize }) : 0;
  const textBlockW = Math.max(nameW, handleW);

  const textRowsH = handleTxt.length > 0 ? nameSize + rowGap + handleSize : nameSize;
  const contentH = Math.max(showDot ? dotR * 2 : 0, textRowsH);
  const chipW = padX * 2 + dotBlockW + textBlockW;
  const chipH = padY * 2 + contentH;
  const chipRadius = Math.round(chipH * 0.3);

  const marginBottom = Math.round(minDim * 0.025);
  const chipCenterX = zone.left + chipW / 2;
  const chipCenterY = h - zone.bottom - marginBottom - chipH / 2;

  const chip = new Container();
  chip.position.set(chipCenterX, chipCenterY);
  chip.scale.set(0);
  root.addChild(chip);

  // Soft shadow so the chip reads as a distinct surface, even over transparent
  // export footage or a same-toned canvas background.
  const e = Math.round(chipH * 0.03);
  const off = Math.round(chipH * 0.06);
  chip.addChild(
    new Graphics()
      .roundRect(-chipW / 2 - e, -chipH / 2 - e + off, chipW + e * 2, chipH + e * 2, chipRadius + e)
      .fill({ color: "#000000", alpha: 0.16 }),
  );
  chip.addChild(new Graphics().roundRect(-chipW / 2, -chipH / 2, chipW, chipH, chipRadius).fill(chipBg));

  let cursorX = -chipW / 2 + padX;
  if (showDot) {
    // A plain accent dot — no initial glyph, so no low-contrast text-on-accent
    // pairing to defend across arbitrary user accent colors.
    const dot = avatar(fonts, { radius: dotR, bg: accent });
    dot.position.set(cursorX + dotR, 0);
    chip.addChild(dot);
    cursorX += dotR * 2 + dotGap;
  }

  const textX = cursorX;
  const blockH = textRowsH;
  const nameY = handleTxt.length > 0 ? -blockH / 2 + nameSize / 2 : 0;
  const handleY = handleTxt.length > 0 ? blockH / 2 - handleSize / 2 : 0;

  const nameText = makeText(fonts, {
    text: name,
    role: "display",
    weight: 700,
    size: nameSize,
    color: textColor,
    anchor: { x: 0, y: 0.5 },
  });
  nameText.position.set(textX, nameY);
  chip.addChild(nameText);

  if (handleTxt.length > 0) {
    const handleText = makeText(fonts, {
      text: handleTxt,
      role: "body",
      weight: 600,
      size: handleSize,
      color: textColor,
      anchor: { x: 0, y: 0.5 },
    });
    handleText.alpha = 0.72;
    handleText.position.set(textX, handleY);
    chip.addChild(handleText);
  }

  // The whole chip pops in as one unit — spring scale, gentle settle, hold.
  timeline
    .to(chip, { prop: "scale.x", from: 0, to: 1, start: 0.15, duration: 0.5, ease: spring(0.45) })
    .to(chip, { prop: "scale.y", from: 0, to: 1, start: 0.15, duration: 0.5, ease: spring(0.45) });

  return { timeline, duration: 4.0 };
}

export const nameTag: TemplateDefinition = {
  id: "name-tag",
  name: "Name Tag",
  tagline: "A rounded chip pops in with an avatar dot, a name, and a handle.",
  category: "overlay",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 2.2,
  fontRoles: { name: "display", handle: "body" },
  palettes: PALETTES,
  fields: [
    { key: "name", type: "text", label: "Name", default: "Sam Rivera", maxLength: 30, shrinkToFit: true },
    { key: "handle", type: "text", label: "Handle", default: "@samrivera", maxLength: 24, optional: true, shrinkToFit: true },
    { key: "showDot", type: "toggle", label: "Avatar dot", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
