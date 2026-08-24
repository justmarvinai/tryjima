import { Container, FillGradient, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outQuint,
  outExpo,
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

const num = (v: unknown, fallback: number): number =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

/** Largest size <= size0 at which `text` fits `maxWidth` (crisp, single-line). */
function fitSize(
  fonts: FontRegistry,
  text: string,
  role: FontRole,
  weight: number,
  size0: number,
  maxWidth: number,
  trackingRatio = 0,
): number {
  if (text.length === 0 || maxWidth <= 0) return size0;
  const w = fonts.measure(text, {
    family: fonts.family(role),
    weight,
    size: size0,
    letterSpacing: size0 * trackingRatio,
  });
  return w > maxWidth ? Math.max(10, Math.floor(size0 * (maxWidth / w))) : size0;
}

/** `#RGB` / `#RRGGBB` / `#RRGGBBAA` → a `rgba(r,g,b,a)` string for gradient stops. */
function rgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const six = h.length === 3 ? `${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}` : h.slice(0, 6);
  const n = Number.parseInt(six, 16);
  if (!Number.isFinite(n)) return `rgba(0,0,0,${alpha})`;
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

// A gradient scrim rises from the bottom edge — clear at the top, near-solid at
// the bottom — carrying a title and subtitle up with it. It is the standard way
// to make type legible over footage, and nothing else in the library does it as
// a standalone overlay.
//
// Transparent export: only the full-frame `bg` rect is tied to the background
// field (it defaults to the transparent sentinel). The scrim owns its own
// palette-only `scrimColor`, so it exports with its alpha ramp intact and
// composites straight onto footage. The ramp's stops are computed from where
// the text block actually sits, so the type always lands on the near-solid part
// no matter how tall the safe area pushes it (9:16 especially).
const PALETTES: Palette[] = [
  { id: "ink", name: "Ink", colors: { scrimColor: "#05070A", textColor: "#FFFFFF", accent: "#7FD1FF" } },
  { id: "espresso", name: "Espresso", colors: { scrimColor: "#170F0A", textColor: "#FFF6EC", accent: "#F0A868" } },
  { id: "forest", name: "Forest", colors: { scrimColor: "#04150F", textColor: "#FFFFFF", accent: "#5FE0A8" } },
  { id: "plum", name: "Plum", colors: { scrimColor: "#120A1E", textColor: "#FFFFFF", accent: "#C6A8FF" } },
];

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", TRANSPARENT_BG));
  const scrimColor = pc("scrimColor", "#05070A");
  const textColor = str(values.textColor, pc("textColor", "#FFFFFF"));
  const accent = str(values.accent, pc("accent", "#7FD1FF"));

  const title = str(values.title, "The long way north");
  const subtitle = str(values.subtitle, "Episode 4 — crossing the fjords");
  const centered = str(values.align, "left") === "center";
  const heightFrac = clamp(num(values.scrimHeight, 0.44), 0.28, 0.62);
  const showRule = values.showRule !== false;
  const showDot = values.showDot !== false;

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const rect = safeRect(ctx.aspect);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Type block, hung off the bottom of the safe rect. ---
  const TITLE_TRACK = -0.014;
  const dotR = showDot ? Math.max(3, Math.round(minDim * 0.006)) : 0;
  const dotGap = showDot ? Math.round(minDim * 0.014) : 0;
  const maxTitleW = rect.width;
  const maxSubW = Math.max(60, rect.width - dotR * 2 - dotGap);

  const titleSize = fitSize(fonts, title, "display", 700, Math.round(minDim * 0.056), maxTitleW, TITLE_TRACK);
  const subSize =
    subtitle.length > 0 ? fitSize(fonts, subtitle, "body", 500, Math.round(minDim * 0.028), maxSubW) : 0;

  const subW =
    subtitle.length > 0 ? fonts.measure(subtitle, { family: fonts.family("body"), weight: 500, size: subSize }) : 0;

  const rowGap = subtitle.length > 0 ? Math.round(minDim * 0.02) : 0;
  const ruleH = Math.max(3, Math.round(minDim * 0.0038));
  const ruleW = Math.round(minDim * 0.085);
  const ruleGap = Math.round(minDim * 0.028);

  const bottomY = rect.y + rect.height;
  const subY = subtitle.length > 0 ? bottomY - subSize / 2 : bottomY;
  const titleY =
    subtitle.length > 0 ? subY - subSize / 2 - rowGap - titleSize / 2 : bottomY - titleSize / 2;
  const ruleY = titleY - titleSize / 2 - ruleGap;
  const blockTopY = showRule ? ruleY - ruleH : titleY - titleSize * 0.62;

  // --- Scrim geometry: tall enough that the block always sits on the solid
  // part, then a ramp shaped around where the block actually starts. ---
  const needed = h - (blockTopY - minDim * 0.16);
  const scrimH = Math.round(clamp(Math.max(h * heightFrac, needed), h * 0.2, h * 0.8));
  const restTop = h - scrimH;
  const fTop = clamp((blockTopY - restTop) / scrimH, 0.2, 0.62);

  const ramp = new FillGradient({
    type: "linear",
    start: { x: 0, y: 0 },
    end: { x: 0, y: 1 },
    colorStops: [
      { offset: 0, color: rgba(scrimColor, 0) },
      { offset: fTop * 0.5, color: rgba(scrimColor, 0.14) },
      { offset: fTop * 0.85, color: rgba(scrimColor, 0.44) },
      { offset: fTop, color: rgba(scrimColor, 0.72) },
      { offset: Math.min(0.96, fTop + 0.22), color: rgba(scrimColor, 0.92) },
      { offset: 1, color: rgba(scrimColor, 0.97) },
    ],
    textureSpace: "local",
  });

  // Everything rides one container, so the scrim and the type rise together.
  const lift = new Container();
  root.addChild(lift);

  const scrim = new Graphics().rect(0, restTop, w, scrimH).fill(ramp);
  scrim.alpha = 0;
  lift.addChild(scrim);
  timeline.to(scrim, { prop: "alpha", from: 0, to: 1, start: 0, duration: 0.85, ease: outQuad });

  const liftBy = minDim * 0.075;
  timeline.to(lift, { prop: "y", from: liftBy, to: 0, start: 0, duration: 1.3, ease: outExpo });

  const anchorX = centered ? rect.x + rect.width / 2 : rect.x;
  const drift = minDim * 0.024;

  // --- Accent rule above the title (toggleable). ---
  if (showRule) {
    const x0 = centered ? -ruleW / 2 : 0;
    const rule = new Graphics().roundRect(x0, -ruleH / 2, ruleW, ruleH, ruleH / 2).fill(accent);
    rule.position.set(anchorX, ruleY);
    rule.scale.set(0, 1);
    lift.addChild(rule);
    timeline.to(rule, { prop: "scale.x", from: 0, to: 1, start: 0.45, duration: 0.85, ease: outExpo });
  }

  // --- Title ---
  const titleText = makeText(fonts, {
    text: title,
    role: "display",
    weight: 700,
    size: titleSize,
    color: textColor,
    letterSpacing: titleSize * TITLE_TRACK,
    align: centered ? "center" : "left",
    anchor: { x: centered ? 0.5 : 0, y: 0.5 },
  });
  titleText.position.set(anchorX, titleY);
  titleText.alpha = 0;
  lift.addChild(titleText);
  timeline
    .to(titleText, { prop: "alpha", from: 0, to: 1, start: 0.5, duration: 0.6, ease: outQuad })
    .to(titleText, { prop: "y", from: titleY + drift, to: titleY, start: 0.5, duration: 0.95, ease: outQuint });

  // --- Subtitle row (optional dot + text), laid out as one group so centering
  // stays true whether or not the dot is on. ---
  if (subtitle.length > 0) {
    const rowW = dotR * 2 + dotGap + subW;
    const rowX = centered ? anchorX - rowW / 2 : anchorX;

    const row = new Container();
    row.position.set(rowX, subY);
    row.alpha = 0;
    lift.addChild(row);

    if (showDot) {
      const dot = new Graphics().circle(0, 0, dotR).fill(accent);
      dot.position.set(dotR, 0);
      row.addChild(dot);
    }
    const subText = makeText(fonts, {
      text: subtitle,
      role: "body",
      weight: 500,
      size: subSize,
      color: textColor,
      anchor: { x: 0, y: 0.5 },
    });
    subText.position.set(dotR * 2 + dotGap, 0);
    row.addChild(subText);

    timeline
      .to(row, { prop: "alpha", from: 0, to: 0.86, start: 0.66, duration: 0.6, ease: outQuad })
      .to(row, { prop: "y", from: subY + drift, to: subY, start: 0.66, duration: 0.95, ease: outQuint });
  }

  return { timeline, duration: 4.2 };
}

export const softScrim: TemplateDefinition = {
  id: "soft-scrim",
  name: "Soft Scrim",
  tagline: "A soft gradient scrim rises from the bottom edge and carries a title and subtitle up with it.",
  category: "overlay",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 2.8,
  fontRoles: { title: "display", subtitle: "body" },
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Title", default: "The long way north", maxLength: 34, shrinkToFit: true },
    { key: "subtitle", type: "text", label: "Subtitle", default: "Episode 4 — crossing the fjords", maxLength: 48, optional: true, shrinkToFit: true },
    {
      key: "align",
      type: "select",
      label: "Alignment",
      default: "left",
      options: [
        { value: "left", label: "Left" },
        { value: "center", label: "Center" },
      ],
    },
    { key: "scrimHeight", type: "slider", label: "Scrim height", default: 0.44, min: 0.28, max: 0.62, step: 0.02 },
    { key: "showRule", type: "toggle", label: "Accent rule", default: true },
    { key: "showDot", type: "toggle", label: "Subtitle dot", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
