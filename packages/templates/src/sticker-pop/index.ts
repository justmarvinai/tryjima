import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outBack,
  makeOutBack,
  type BuiltTemplate,
  type MakeTextOptions,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;
const DEG = Math.PI / 180;

const PALETTES: Palette[] = [
  { id: "sun-pop", name: "Sun pop", colors: { background: "#FFFFFF", accent: "#FFD23F", onAccent: "#151016" } },
  { id: "lime-pop", name: "Lime pop", colors: { background: "#101014", accent: "#D8F34D", onAccent: "#101014" } },
  { id: "grape-pop", name: "Grape pop", colors: { background: "#F3EEFF", accent: "#4A32D8", onAccent: "#FFFFFF" } },
  { id: "berry-pop", name: "Berry pop", colors: { background: "#FFEEF6", accent: "#C81659", onAccent: "#FFFFFF" } },
];

/** Create text, shrinking one size if it would overflow `maxWidth` (crisp). */
function fitText(fonts: TemplateContext["fonts"], opts: MakeTextOptions, maxWidth: number) {
  const t = makeText(fonts, opts);
  if (maxWidth > 0 && t.width > maxWidth) {
    const shrunk = Math.max(12, Math.floor(opts.size * (maxWidth / t.width)));
    if (shrunk < opts.size) return makeText(fonts, { ...opts, size: shrunk });
  }
  return t;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pcol = (key: string, d: string): string => palette.colors[key] ?? d;
  const bg = str(values.background, pcol("background", "#FFFFFF"));
  const accent = str(values.accent, pcol("accent", "#FFD23F"));
  const onAccent = pcol("onAccent", "#151016");
  const text = str(values.text, "NEW!");
  const showWobble = on(values.showWobble);

  const W = size.width;
  const H = size.height;
  const minDim = Math.min(W, H);
  const DUR = 3.6;

  const bgRect = new Graphics().rect(-W / 2, -H / 2, W, H).fill(bg);
  bgRect.position.set(W / 2, H / 2);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();
  const cx = W / 2;
  const cy = H * 0.46;

  // --- Sticker label, sized to hug the text with generous padding ---
  const labelSize0 = Math.round(minDim * 0.2);
  const maxLabelW = minDim * 0.62;
  const label = fitText(
    fonts,
    { text, role: "display", weight: 700, size: labelSize0, color: onAccent, anchor: 0.5, align: "center" },
    maxLabelW,
  );

  const padX = label.style.fontSize * 0.62;
  const padY = label.style.fontSize * 0.5;
  const bw = label.width + padX * 2;
  const bh = label.height + padY * 2;
  const r = bh * 0.3;
  const ringPad = Math.max(4, bh * 0.06);
  const shadowOff = bh * 0.08;

  // --- Sticker unit: shadow → dark die-cut outline → accent face → label ---
  const sticker = new Container();
  sticker.label = "sticker";

  const shadow = new Graphics().roundRect(-bw / 2, -bh / 2, bw, bh, r).fill({ color: "#0B0B0F", alpha: 0.24 });
  shadow.position.set(shadowOff, shadowOff);
  sticker.addChild(shadow);

  const ring = new Graphics()
    .roundRect(-bw / 2 - ringPad, -bh / 2 - ringPad, bw + ringPad * 2, bh + ringPad * 2, r + ringPad)
    .fill({ color: "#101014", alpha: 0.9 });
  sticker.addChild(ring);

  const face = new Graphics().roundRect(-bw / 2, -bh / 2, bw, bh, r).fill(accent);
  sticker.addChild(face);

  label.position.set(0, 0);
  sticker.addChild(label);

  sticker.position.set(cx, cy);
  const restTilt = -4 * DEG;
  const startTilt = -20 * DEG;
  sticker.alpha = 0;
  sticker.scale.set(0);
  sticker.rotation = startTilt;
  root.addChild(sticker);

  const popStart = 0.2;
  const popDur = 0.55;
  timeline
    .to(sticker, { prop: "alpha", from: 0, to: 1, start: popStart, duration: 0.12, ease: outQuad })
    .to(sticker, { prop: "scale.x", from: 0, to: 1, start: popStart, duration: popDur, ease: makeOutBack(2.2) })
    .to(sticker, { prop: "scale.y", from: 0, to: 1, start: popStart, duration: popDur, ease: makeOutBack(2.2) })
    .to(sticker, { prop: "rotation", from: startTilt, to: restTilt, start: popStart, duration: popDur, ease: outBack });

  // --- Wobble settle: a decaying rotation oscillation around the rest tilt ---
  if (showWobble) {
    const wobbleSeq: [number, number, number][] = [
      [restTilt, restTilt + 16 * DEG, 0.12],
      [restTilt + 16 * DEG, restTilt - 11 * DEG, 0.11],
      [restTilt - 11 * DEG, restTilt + 6 * DEG, 0.09],
      [restTilt + 6 * DEG, restTilt - 3 * DEG, 0.08],
      [restTilt - 3 * DEG, restTilt, 0.08],
    ];
    let t0 = popStart + popDur;
    for (const [from, to, dur] of wobbleSeq) {
      timeline.to(sticker, { prop: "rotation", from, to, start: t0, duration: dur, ease: outQuad });
      t0 += dur;
    }
  }

  return { timeline, duration: DUR };
}

export const stickerPop: TemplateDefinition = {
  id: "sticker-pop",
  name: "Sticker Pop",
  tagline: "A sticker badge pops in with a wobble — built for overlays.",
  category: "social",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "9:16",
  loopable: false,
  posterTime: 2.2,
  fontRoles: { text: "display" },
  palettes: PALETTES,
  fields: [
    { key: "text", type: "text", label: "Text", default: "NEW!", maxLength: 16, shrinkToFit: true },
    { key: "showWobble", type: "toggle", label: "Wobble settle", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "accent", type: "color", label: "Sticker color", default: "", optional: true },
  ],
  build,
};
