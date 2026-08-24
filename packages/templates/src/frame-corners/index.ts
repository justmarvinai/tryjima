import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outQuint,
  safeRect,
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

/** Like `str`, but an explicit empty string is kept (clears the label chip). */
const strOpt = (v: unknown, fallback: string): string => (typeof v === "string" ? v : fallback);

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

// The recording dot is semantically red (like a camera's REC lamp) regardless of
// the chosen brand palette; purely decorative.
const REC_COLOR = "#E5484D";

// Four viewfinder-style corner brackets draw themselves around the frame edge,
// then a small label chip docks into the top-left corner and the whole frame
// breathes very gently. The center stays fully transparent — this template
// exists to frame the user's own footage. Only the full-frame `bg` rect is tied
// to the background field (defaults to the transparent sentinel); brackets use
// the `accent` color with a dark halo behind each arm, and the chip has its own
// palette-only `chipBg` + soft shadow, so everything reads over any footage.
const PALETTES: Palette[] = [
  { id: "noir", name: "Noir", colors: { accent: "#17171C", chipBg: "#17171C", textColor: "#FFFFFF" } },
  { id: "crisp-white", name: "Crisp white", colors: { accent: "#FFFFFF", chipBg: "#FFFFFF", textColor: "#0B0B0F" } },
  { id: "amber", name: "Amber", colors: { accent: "#FFB020", chipBg: "#201703", textColor: "#FFD98A" } },
  { id: "emerald", name: "Emerald", colors: { accent: "#12B76A", chipBg: "#FFFFFF", textColor: "#0B1F16" } },
];

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", TRANSPARENT_BG));
  const chipBg = pc("chipBg", "#17171C");
  const textColor = str(values.textColor, pc("textColor", "#FFFFFF"));
  const accent = str(values.accent, pc("accent", "#17171C"));

  const label = strOpt(values.label, "On Location");
  const showTicks = values.showTicks !== false;
  const showDot = values.showDot !== false;

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const rect = safeRect(ctx.aspect);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // Breathe group pivots on the frame center so the whole rig scales together.
  const group = new Container();
  group.position.set(w / 2, h / 2);
  root.addChild(group);

  const armLen = Math.round(Math.min(rect.width, rect.height) * 0.16);
  const strokeW = Math.max(6, Math.round(minDim * 0.012));
  const halo = Math.max(2, Math.round(strokeW * 0.22));

  /** One bracket arm: dark halo underneath + accent bar, drawn from (0,0) in +x/+y. */
  const makeArm = (horizontal: boolean): Graphics => {
    const g = new Graphics();
    const aw = horizontal ? armLen : strokeW;
    const ah = horizontal ? strokeW : armLen;
    g.roundRect(-halo, -halo, aw + halo * 2, ah + halo * 2, strokeW / 2 + halo).fill({ color: "#000000", alpha: 0.22 });
    g.roundRect(0, 0, aw, ah, strokeW / 2).fill(accent);
    return g;
  };

  // Corners, clockwise from top-left; mirroring makes every arm grow outward
  // from its corner vertex under a simple scale 0 -> 1.
  const corners: { x: number; y: number; sx: number; sy: number }[] = [
    { x: rect.x, y: rect.y, sx: 1, sy: 1 },
    { x: rect.x + rect.width, y: rect.y, sx: -1, sy: 1 },
    { x: rect.x + rect.width, y: rect.y + rect.height, sx: -1, sy: -1 },
    { x: rect.x, y: rect.y + rect.height, sx: 1, sy: -1 },
  ];
  corners.forEach((c, i) => {
    const corner = new Container();
    corner.position.set(c.x - w / 2, c.y - h / 2);
    corner.scale.set(c.sx, c.sy);
    group.addChild(corner);

    const armH = makeArm(true);
    armH.scale.set(0, 1);
    corner.addChild(armH);
    const armV = makeArm(false);
    armV.scale.set(1, 0);
    corner.addChild(armV);

    const start = 0.12 + i * 0.13;
    timeline
      .to(armH, { prop: "scale.x", from: 0, to: 1, start, duration: 0.5, ease: outQuint })
      .to(armV, { prop: "scale.y", from: 0, to: 1, start, duration: 0.5, ease: outQuint });
  });

  // --- Mid-edge viewfinder ticks (decorative). ---
  if (showTicks) {
    const tickLen = strokeW * 2.4;
    const tickW = strokeW * 0.9;
    const midX = rect.x + rect.width / 2 - w / 2;
    const midY = rect.y + rect.height / 2 - h / 2;
    const topY = rect.y - h / 2;
    const bottomY = rect.y + rect.height - h / 2;
    const leftX = rect.x - w / 2;
    const rightX = rect.x + rect.width - w / 2;
    const ticks = new Graphics();
    ticks
      .roundRect(midX - tickW / 2, topY, tickW, tickLen, tickW / 2)
      .roundRect(midX - tickW / 2, bottomY - tickLen, tickW, tickLen, tickW / 2)
      .roundRect(leftX, midY - tickW / 2, tickLen, tickW, tickW / 2)
      .roundRect(rightX - tickLen, midY - tickW / 2, tickLen, tickW, tickW / 2)
      .fill(accent);
    ticks.alpha = 0;
    group.addChild(ticks);
    timeline.to(ticks, { prop: "alpha", from: 0, to: 0.9, start: 0.85, duration: 0.35, ease: outQuad });
  }

  // --- Label chip docked into the top-left corner notch. ---
  let dot: Graphics | undefined;
  const CHIP_T = 1.1;
  const DOT_T = 1.5;
  if (label.length > 0) {
    const textSize = fitSize(fonts, label, "body", 600, Math.round(minDim * 0.024), rect.width * 0.5);
    const dotR = showDot ? Math.max(4, Math.round(minDim * 0.009)) : 0;
    const dotGap = showDot ? Math.round(minDim * 0.012) : 0;
    const padX = Math.round(minDim * 0.02);
    const padY = Math.round(minDim * 0.014);
    const textW = fonts.measure(label, { family: fonts.family("body"), weight: 600, size: textSize });
    const chipW = Math.round(padX * 2 + (showDot ? dotR * 2 + dotGap : 0) + textW);
    const chipH = Math.round(padY * 2 + Math.max(dotR * 2, textSize));
    const chipRadius = Math.round(chipH * 0.3);

    const chipGap = Math.round(minDim * 0.018);
    const chipCX = rect.x + strokeW + chipGap + chipW / 2 - w / 2;
    const chipCY = rect.y + strokeW + chipGap + chipH / 2 - h / 2;

    const chip = new Container();
    chip.position.set(chipCX, chipCY);
    chip.alpha = 0;
    group.addChild(chip);

    const e = Math.round(chipH * 0.04);
    const off = Math.round(chipH * 0.07);
    chip.addChild(
      new Graphics()
        .roundRect(-chipW / 2 - e, -chipH / 2 - e + off, chipW + e * 2, chipH + e * 2, chipRadius + e)
        .fill({ color: "#000000", alpha: 0.18 }),
    );
    chip.addChild(new Graphics().roundRect(-chipW / 2, -chipH / 2, chipW, chipH, chipRadius).fill(chipBg));

    let cursorX = -chipW / 2 + padX;
    if (showDot) {
      dot = new Graphics().circle(0, 0, dotR).fill(REC_COLOR);
      dot.position.set(cursorX + dotR, 0);
      dot.alpha = 0;
      chip.addChild(dot);
      cursorX += dotR * 2 + dotGap;
    }
    const labelText = makeText(fonts, {
      text: label,
      role: "body",
      weight: 600,
      size: textSize,
      color: textColor,
      anchor: { x: 0, y: 0.5 },
    });
    labelText.position.set(cursorX, 0);
    chip.addChild(labelText);

    const drop = Math.round(minDim * 0.018);
    timeline
      .to(chip, { prop: "alpha", from: 0, to: 1, start: CHIP_T, duration: 0.3, ease: outQuad })
      .to(chip, { prop: "y", from: chipCY - drop, to: chipCY, start: CHIP_T, duration: 0.45, ease: outQuint });
  }

  // --- Gentle breathing + REC-dot pulse (pure functions of t). ---
  const BREATHE_T = 1.25;
  const update = (t: number): void => {
    const tau = Math.max(0, t - BREATHE_T);
    const ramp = Math.min(1, tau / 0.7);
    const s = 1 + 0.006 * ramp * Math.sin(tau * 2.2);
    group.scale.set(s);
    if (dot) {
      const dt = Math.max(0, t - DOT_T);
      const dRamp = Math.min(1, dt / 0.35);
      dot.alpha = dRamp * (0.45 + 0.55 * (0.5 + 0.5 * Math.sin(dt * 2.6)));
    }
  };

  return { timeline, duration: 4.0, update };
}

export const frameCorners: TemplateDefinition = {
  id: "frame-corners",
  name: "Frame Corners",
  tagline: "Corner brackets draw themselves around your footage and gently breathe.",
  category: "overlay",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 2.6,
  fontRoles: { label: "body" },
  palettes: PALETTES,
  fields: [
    { key: "label", type: "text", label: "Label", default: "On Location", maxLength: 22, optional: true, shrinkToFit: true },
    { key: "showTicks", type: "toggle", label: "Edge ticks", default: true },
    { key: "showDot", type: "toggle", label: "Recording dot", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Brackets", default: "", optional: true },
  ],
  build,
};
