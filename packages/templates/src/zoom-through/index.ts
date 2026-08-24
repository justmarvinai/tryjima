import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outQuint,
  inOutQuad,
  safeRect,
  type Aspect,
  type BuiltTemplate,
  type EaseFn,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;

/**
 * Largest size <= size at which `text` fits maxWidth on one line. `tracking` is
 * letter-spacing as a fraction of the font size, so the shrink stays exact.
 */
function fitSize(
  fonts: FontRegistry,
  text: string,
  role: FontRole,
  weight: number,
  size: number,
  maxWidth: number,
  tracking = 0,
): number {
  if (text.length === 0 || maxWidth <= 0) return size;
  const w = fonts.measure(text, {
    family: fonts.family(role),
    weight,
    size,
    letterSpacing: size * tracking,
  });
  return w > maxWidth ? Math.max(11, Math.floor((size * maxWidth) / w)) : size;
}

const TITLE_TRACK = -0.012;
const SUB_TRACK = 0.1;

/**
 * Remaps a linear scale tween onto an exponential ramp, so the camera's
 * *perceived* approach speed follows `base` instead of the raw scale number.
 * Pure and deterministic — it only ever reads its own arguments.
 */
function zoomEase(from: number, to: number, base: EaseFn): EaseFn {
  const ratio = to / from;
  const span = to - from;
  return (u) => (from * Math.pow(ratio, base(u)) - from) / span;
}

// A single unbroken forward move: nested apertures rush past the camera as it
// flies through them, decelerating onto the settled title. No cuts, no flashes.
const PALETTES: Palette[] = [
  { id: "frost", name: "Frost", colors: { background: "#F7F9FC", textColor: "#101722", accent: "#2E6BF0" } },
  { id: "clay", name: "Clay", colors: { background: "#FAF4EE", textColor: "#241812", accent: "#C25A2B" } },
  { id: "moss", name: "Moss", colors: { background: "#F1F5EF", textColor: "#16210F", accent: "#4E8A2E" } },
  { id: "void", name: "Void", colors: { background: "#0B0D11", textColor: "#F5F7FA", accent: "#9AB8FF" } },
];

function titleFrac(aspect: Aspect): number {
  return aspect === "16:9" ? 0.08 : aspect === "9:16" ? 0.106 : 0.096;
}

// Depth of each aperture as a fraction of the frame: the nearest one leaves the
// frame at camera scale 1, the farthest at 1 / 0.21.
const DEPTHS = [1, 0.46, 0.21];
const CAM_FROM = 0.22;
const CAM_TO = 5.6;
const TITLE_FROM = 0.5;

const ZOOM_START = 0.12;
const ZOOM_DUR = 2.1;
const DURATION = 4.6;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F7F9FC"));
  const textColor = str(values.textColor, pc("textColor", "#101722"));
  const accent = str(values.accent, pc("accent", "#2E6BF0"));
  const title = str(values.title, "Zoom Through");
  // Optional: an empty string from the editor must stay empty, not fall back.
  const subtitle = str(values.subtitle, "");
  const shape = str(values.shape, "rect");
  const showAperture = on(values.showAperture);
  const showUnderline = on(values.showUnderline);

  const w = size.width;
  const h = size.height;
  const cx = w / 2;
  const minDim = Math.min(w, h);
  const zone = safeRect(ctx.aspect);
  const cy = zone.y + zone.height * 0.5;

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();
  // inOutQuad, not a quint: the flight must never sit still and then lurch —
  // a quad peaks at only 2x its average speed, so the pass stays even.
  const camEase = zoomEase(CAM_FROM, CAM_TO, inOutQuad);

  // --- The apertures we fly through ---------------------------------------
  if (showAperture) {
    const tunnel = new Container();
    tunnel.position.set(cx, cy);
    tunnel.scale.set(CAM_FROM);
    root.addChild(tunnel);

    const baseStroke = Math.max(3, minDim * 0.0075);
    const baseRadius = minDim * 0.11;
    const ringR = Math.hypot(w, h) / 2;

    DEPTHS.forEach((frac, i) => {
      // Stroke + radius scale with depth so every aperture looks identical at
      // the moment it reaches the frame edge — a real tunnel, not stacked boxes.
      const stroke = { color: accent, width: baseStroke * frac, alpha: 0.85 - i * 0.18 };
      const g = new Graphics();
      if (shape === "ring") {
        g.circle(0, 0, ringR * frac).stroke(stroke);
      } else {
        const hw = (w / 2) * frac;
        const hh = (h / 2) * frac;
        g.roundRect(-hw, -hh, hw * 2, hh * 2, baseRadius * frac).stroke(stroke);
      }
      g.label = `aperture-${i}`;
      tunnel.addChild(g);
    });

    timeline
      .to(tunnel, { prop: "scale.x", from: CAM_FROM, to: CAM_TO, start: ZOOM_START, duration: ZOOM_DUR, ease: camEase })
      .to(tunnel, { prop: "scale.y", from: CAM_FROM, to: CAM_TO, start: ZOOM_START, duration: ZOOM_DUR, ease: camEase })
      .to(tunnel, {
        prop: "alpha",
        from: 1,
        to: 0,
        start: ZOOM_START + ZOOM_DUR * 0.8,
        duration: ZOOM_DUR * 0.26,
        ease: inOutQuad,
      });
  }

  // --- The title lockup, riding the same forward move ----------------------
  const maxW = zone.width * (ctx.aspect === "16:9" ? 0.62 : 0.84);
  const titleSize = fitSize(fonts, title, "display", 700, Math.round(w * titleFrac(ctx.aspect)), maxW, TITLE_TRACK);
  const hasSub = subtitle.length > 0;
  const subSize = fitSize(fonts, subtitle, "body", 500, Math.round(titleSize * 0.27), maxW * 0.9, SUB_TRACK);
  const ruleH = Math.max(2, minDim * 0.0045);
  // Generous: a Pixi text box centres on its line box, so descenders reach
  // ~0.6em below centre — the rule has to clear that, not just half the size.
  const ruleGap = titleSize * 0.45;
  const subGap = subSize * 0.95;

  const blockH =
    titleSize + (showUnderline ? ruleGap + ruleH : 0) + (hasSub ? subGap + subSize : 0);

  const camera = new Container();
  camera.label = "camera";
  camera.position.set(cx, cy);
  camera.scale.set(TITLE_FROM);
  camera.alpha = 0;
  root.addChild(camera);

  let cursor = -blockH / 2;
  const titleY = cursor + titleSize / 2;
  cursor += titleSize;
  const titleText = makeText(fonts, {
    text: title,
    role: "display",
    weight: 700,
    size: titleSize,
    color: textColor,
    anchor: 0.5,
    align: "center",
    letterSpacing: titleSize * TITLE_TRACK,
  });
  titleText.position.set(0, titleY);
  camera.addChild(titleText);

  const titleEase = zoomEase(TITLE_FROM, 1, inOutQuad);
  timeline
    .to(camera, { prop: "scale.x", from: TITLE_FROM, to: 1, start: ZOOM_START, duration: ZOOM_DUR, ease: titleEase })
    .to(camera, { prop: "scale.y", from: TITLE_FROM, to: 1, start: ZOOM_START, duration: ZOOM_DUR, ease: titleEase })
    .to(camera, { prop: "alpha", from: 0, to: 1, start: ZOOM_START + ZOOM_DUR * 0.42, duration: 0.62, ease: outQuad });

  if (showUnderline) {
    const ruleW = Math.min(maxW * 0.5, minDim * 0.14);
    const ruleY = cursor + ruleGap + ruleH / 2;
    cursor += ruleGap + ruleH;
    const rule = new Graphics().roundRect(-ruleW / 2, -ruleH / 2, ruleW, ruleH, ruleH / 2).fill(accent);
    rule.position.set(0, ruleY);
    rule.scale.x = 0;
    camera.addChild(rule);
    timeline.to(rule, {
      prop: "scale.x",
      from: 0,
      to: 1,
      start: ZOOM_START + ZOOM_DUR * 0.82,
      duration: 0.75,
      ease: outQuint,
    });
  }

  if (hasSub) {
    const subY = cursor + subGap + subSize / 2;
    const s = makeText(fonts, {
      text: subtitle,
      role: "body",
      weight: 500,
      size: subSize,
      color: textColor,
      anchor: 0.5,
      align: "center",
      letterSpacing: subSize * SUB_TRACK,
    });
    s.position.set(0, subY + minDim * 0.01);
    s.alpha = 0;
    camera.addChild(s);
    const subStart = ZOOM_START + ZOOM_DUR * 0.72;
    timeline
      .to(s, { prop: "alpha", from: 0, to: 0.84, start: subStart, duration: 0.6, ease: outQuad })
      .to(s, { prop: "y", from: subY + minDim * 0.01, to: subY, start: subStart, duration: 0.8, ease: outQuint });
  }

  return { timeline, duration: DURATION };
}

export const zoomThrough: TemplateDefinition = {
  id: "zoom-through",
  name: "Zoom Through",
  tagline: "One unbroken forward move flies through open apertures and settles on your title.",
  category: "intro",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 3.6,
  fontRoles: { title: "display", subtitle: "body" },
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Title", default: "Zoom Through", maxLength: 28, shrinkToFit: true },
    { key: "subtitle", type: "text", label: "Subtitle", default: "one long breath", maxLength: 44, optional: true, shrinkToFit: true },
    {
      key: "shape",
      type: "select",
      label: "Aperture shape",
      default: "rect",
      options: [
        { value: "rect", label: "Rounded rectangle" },
        { value: "ring", label: "Ring" },
      ],
    },
    { key: "showAperture", type: "toggle", label: "Apertures", default: true },
    { key: "showUnderline", type: "toggle", label: "Accent underline", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
