import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outExpo,
  outQuad,
  spring,
  type Aspect,
  type BuiltTemplate,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";

// Peel Sticker — a die-cut sticker slaps onto the frame, its corner still
// lifted, and settles down with a little wobble. The corner curl and its cast
// shadow are what sell it as a physical object rather than a rectangle.
//
// `sticker-pop` (social) is a scale-up pop. Nothing in the library peels: the
// lifted corner is drawn as a real folded triangle with a lighter "back of the
// paper" face, and it flattens as the sticker settles.

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;
const num = (v: unknown, fallback: number): number => (typeof v === "number" && Number.isFinite(v) ? v : fallback);

const PALETTES: Palette[] = [
  { id: "sunny", name: "Sunny", colors: { background: "#141519", textColor: "#17150E", accent: "#FBBF24" } },
  { id: "mint", name: "Mint", colors: { background: "#101416", textColor: "#0C201A", accent: "#4ADE80" } },
  { id: "bubblegum", name: "Bubblegum", colors: { background: "#161014", textColor: "#2A0F1D", accent: "#F472B6" } },
  { id: "paper", name: "Paper", colors: { background: "#F5F4F0", textColor: "#FFFFFF", accent: "#EF4444" } },
];

interface Layout {
  sizeFrac: number;
  labelFrac: number;
}

function layout(aspect: Aspect): Layout {
  switch (aspect) {
    case "16:9":
      return { sizeFrac: 0.24, labelFrac: 0.03 };
    case "9:16":
      return { sizeFrac: 0.44, labelFrac: 0.048 };
    case "4:5":
      return { sizeFrac: 0.4, labelFrac: 0.044 };
    case "1:1":
    default:
      return { sizeFrac: 0.4, labelFrac: 0.044 };
  }
}

const SLAP_AT = 0.35;
const SETTLE_AT = 0.95;
const DURATION = 4.2;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#141519"));
  const textColor = str(values.textColor, pc("textColor", "#17150E"));
  const accent = str(values.accent, pc("accent", "#FBBF24"));
  const line1 = str(values.line1, "NEW");
  const line2 = str(values.line2, "").trim();
  const px = num(values.x, 0.72);
  const py = num(values.y, 0.28);
  const tiltDeg = num(values.tilt, -9);
  const showCurl = on(values.showCurl);

  root.addChild(new Graphics().rect(0, 0, size.width, size.height).fill(bg));

  const L = layout(ctx.aspect);
  const w = Math.min(size.width, size.height) * L.sizeFrac;
  const h = w * 0.72;
  const cx = size.width * Math.max(0.15, Math.min(0.85, px));
  const cy = size.height * Math.max(0.14, Math.min(0.86, py));
  const r = w * 0.14;

  const timeline = new JimaTimeline();
  const holder = new Container();
  holder.position.set(cx, cy);
  holder.rotation = (tiltDeg * Math.PI) / 180;
  root.addChild(holder);

  // Cast shadow — offset down-right, and it *tightens* as the sticker lands,
  // which is the strongest single cue that the thing is settling onto a surface.
  const shadow = new Graphics()
    .roundRect(-w / 2, -h / 2, w, h, r)
    .fill({ color: "#000000", alpha: 0.28 });
  shadow.position.set(w * 0.06, h * 0.09);
  holder.addChild(shadow);
  timeline
    .to(shadow, { prop: "x", from: w * 0.16, to: w * 0.035, start: SETTLE_AT, duration: 0.7, ease: outExpo })
    .to(shadow, { prop: "y", from: h * 0.24, to: h * 0.05, start: SETTLE_AT, duration: 0.7, ease: outExpo })
    .to(shadow, { prop: "alpha", from: 0.34, to: 0.22, start: SETTLE_AT, duration: 0.7, ease: outQuad });

  // The sticker face, with a white die-cut border like a real vinyl cut.
  const face = new Container();
  holder.addChild(face);
  // The die-cut rim is the backing paper, so it is white whatever the type
  // colour is — filling it with `textColor` made it vanish on dark palettes.
  const DIE_CUT = "#FFFFFF";
  const border = Math.max(3, w * 0.028);
  face.addChild(
    new Graphics()
      .roundRect(-w / 2 - border, -h / 2 - border, w + border * 2, h + border * 2, r + border)
      .fill(DIE_CUT),
  );
  face.addChild(new Graphics().roundRect(-w / 2, -h / 2, w, h, r).fill(accent));

  // --- Type ---
  const labelSize = Math.round(size.width * L.labelFrac);
  const big = makeText(fonts, {
    text: line1.toUpperCase(),
    role: "display",
    weight: 800,
    size: labelSize * 1.5,
    color: textColor,
    anchor: 0.5,
    letterSpacing: labelSize * 0.02,
  });
  const maxW = w * 0.78;
  if (big.width > maxW) big.scale.set(maxW / big.width);
  big.y = line2 ? -labelSize * 0.42 : 0;
  face.addChild(big);

  if (line2.length > 0) {
    const small = makeText(fonts, {
      text: line2.toUpperCase(),
      role: "body",
      weight: 700,
      size: labelSize * 0.55,
      color: textColor,
      anchor: 0.5,
      letterSpacing: labelSize * 0.06,
    });
    if (small.width > maxW) small.scale.set(maxW / small.width);
    small.y = labelSize * 0.72;
    small.alpha = 0.82;
    face.addChild(small);
  }

  // --- The lifted corner: a folded triangle at bottom-right, showing the
  // paler back of the sheet, that flattens as the sticker settles. ---
  if (showCurl) {
    const c = w * 0.22;
    const curl = new Container();
    curl.position.set(w / 2, h / 2);
    holder.addChild(curl);

    // Underside of the peel — lighter than the face, and it catches the light.
    const under = new Graphics()
      .poly([0, 0, -c, 0, 0, -c])
      .fill({ color: DIE_CUT, alpha: 0.95 });
    // A soft shadow the curl throws on the sticker itself.
    const curlShadow = new Graphics()
      .poly([0, 0, -c * 1.18, 0, 0, -c * 1.18])
      .fill({ color: "#000000", alpha: 0.18 });
    curl.addChild(curlShadow, under);

    // Flattening = the triangle shrinking to nothing against the corner.
    timeline
      // It settles to a third rather than to nothing: a sticker with one
      // corner still lifted is the whole look, and flattening it away leaves a
      // plain rounded rectangle.
      .to(curl, { prop: "scale.x", from: 1, to: 0.34, start: SETTLE_AT + 0.15, duration: 0.9, ease: outExpo })
      .to(curl, { prop: "scale.y", from: 1, to: 0.34, start: SETTLE_AT + 0.15, duration: 0.9, ease: outExpo });
  }

  // --- The slap: down from above, overshooting, then a rotational wobble ---
  holder.alpha = 0;
  timeline
    .to(holder, { prop: "alpha", from: 0, to: 1, start: SLAP_AT, duration: 0.15, ease: outQuad })
    .to(holder, { prop: "scale.x", from: 1.55, to: 1, start: SLAP_AT, duration: 0.55, ease: outExpo })
    .to(holder, { prop: "scale.y", from: 1.55, to: 1, start: SLAP_AT, duration: 0.55, ease: outExpo })
    .to(holder, { prop: "y", from: cy - h * 0.4, to: cy, start: SLAP_AT, duration: 0.55, ease: outExpo })
    .to(holder, {
      prop: "rotation",
      from: ((tiltDeg - 11) * Math.PI) / 180,
      to: (tiltDeg * Math.PI) / 180,
      start: SLAP_AT + 0.1,
      duration: 1.3,
      ease: spring(0.42, 3.4),
    });

  // A quick shine sweeping across the face just after it lands.
  const shine = new Graphics()
    .poly([-w * 0.12, -h * 0.8, w * 0.12, -h * 0.8, w * 0.32, h * 0.8, w * 0.08, h * 0.8])
    .fill({ color: "#FFFFFF", alpha: 0.28 });
  const shineClip = new Graphics().roundRect(-w / 2, -h / 2, w, h, r).fill("#FFFFFF");
  face.addChild(shine, shineClip);
  shine.mask = shineClip;
  shine.x = -w * 0.9;
  timeline
    .to(shine, { prop: "x", from: -w * 0.9, to: w * 0.9, start: SETTLE_AT + 0.2, duration: 0.75, ease: outQuad })
    .to(shine, { prop: "alpha", from: 0.3, to: 0, start: SETTLE_AT + 0.55, duration: 0.4, ease: outQuad });

  return { timeline, duration: DURATION };
}

export const peelSticker: TemplateDefinition = {
  id: "peel-sticker",
  name: "Peel Sticker",
  tagline: "A die-cut sticker slaps on with its corner still lifted, then flattens down.",
  category: "overlay",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "9:16",
  loopable: false,
  posterTime: 2.6,
  fontRoles: { line1: "display", line2: "body" },
  palettes: PALETTES,
  fields: [
    { key: "line1", type: "text", label: "Sticker text", default: "NEW", maxLength: 14 },
    { key: "line2", type: "text", label: "Second line", default: "in stock", maxLength: 18, optional: true },
    { key: "x", type: "slider", label: "Position across", default: 0.72, min: 0.15, max: 0.85, step: 0.02 },
    { key: "y", type: "slider", label: "Position down", default: 0.28, min: 0.14, max: 0.86, step: 0.02 },
    { key: "tilt", type: "slider", label: "Tilt", default: -9, min: -25, max: 25, step: 1 },
    { key: "showCurl", type: "toggle", label: "Lifted corner", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Die-cut & type", default: "", optional: true },
    { key: "accent", type: "color", label: "Sticker", default: "", optional: true },
  ],
  build,
};
