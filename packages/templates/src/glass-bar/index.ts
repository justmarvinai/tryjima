import { Container, FillGradient, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outQuint,
  outExpo,
  inOutQuad,
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

/**
 * A layered soft shadow: several concentric rounded rects at a very low alpha,
 * so the falloff ramps smoothly instead of banding into a grey outline the way
 * one or two thick layers do.
 */
function softShadow(w: number, h: number, radius: number, spread: number, offsetY: number): Graphics {
  const g = new Graphics();
  const layers = 8;
  for (let i = layers; i >= 1; i--) {
    const f = i / layers;
    const e = spread * f;
    g.roundRect(-w / 2 - e, -h / 2 - e + offsetY * f, w + e * 2, h + e * 2, radius + e).fill({
      color: "#000000",
      alpha: 0.019,
    });
  }
  return g;
}

// A frosted-glass lower third: a translucent panel glides in and settles while
// the name and role fade up inside it. The frosting is faked with layered
// semi-transparent fills (a vertical tint gradient over a base wash) plus a
// light hairline along the top edge and a slow sheen that sweeps across once.
//
// Transparent export: only the full-frame `bg` rect is tied to the background
// field (it defaults to the transparent sentinel), so the panel — which owns
// its own palette-only `glassBg` / `glassEdge` surface and a soft shadow —
// survives as the overlay content and composites straight onto footage.
const PALETTES: Palette[] = [
  { id: "smoke", name: "Smoke", colors: { glassBg: "#0E1116", glassEdge: "#FFFFFF", textColor: "#FFFFFF", accent: "#7FD1FF" } },
  { id: "frost", name: "Frost", colors: { glassBg: "#FFFFFF", glassEdge: "#FFFFFF", textColor: "#0B0F14", accent: "#2E5BD6" } },
  { id: "moss", name: "Moss", colors: { glassBg: "#0A2018", glassEdge: "#DFF7EA", textColor: "#FFFFFF", accent: "#5FE0A8" } },
  { id: "plum", name: "Plum", colors: { glassBg: "#171029", glassEdge: "#EDE7FF", textColor: "#FFFFFF", accent: "#C6A8FF" } },
];

const SHEEN_START = 0.85;
const SHEEN_DUR = 1.35;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", TRANSPARENT_BG));
  const glassBg = pc("glassBg", "#0E1116");
  const glassEdge = pc("glassEdge", "#FFFFFF");
  const textColor = str(values.textColor, pc("textColor", "#FFFFFF"));
  const accent = str(values.accent, pc("accent", "#7FD1FF"));

  const name = str(values.name, "Mara Lindqvist");
  const role = str(values.role, "Head of Brand Studio");
  const placement = str(values.placement, "bottom-left");
  const showEdge = values.showEdge !== false;
  const showSheen = values.showSheen !== false;
  const showAccentBar = values.showAccentBar !== false;

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const rect = safeRect(ctx.aspect);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Geometry: fixed paddings first, so the fit pass has a stable budget. ---
  const pad = Math.round(minDim * 0.034);
  const barW = showAccentBar ? Math.max(3, Math.round(minDim * 0.007)) : 0;
  const barGap = showAccentBar ? Math.round(minDim * 0.026) : 0;
  const maxPanelW = rect.width;
  const maxTextW = Math.max(120, maxPanelW - pad * 2 - barW - barGap);

  const NAME_TRACK = -0.012;
  const ROLE_TRACK = 0.02;
  const nameSize = fitSize(fonts, name, "display", 700, Math.round(minDim * 0.048), maxTextW, NAME_TRACK);
  const roleSize =
    role.length > 0 ? fitSize(fonts, role, "body", 500, Math.round(minDim * 0.026), maxTextW, ROLE_TRACK) : 0;
  const rowGap = role.length > 0 ? Math.round(minDim * 0.012) : 0;

  const nameW = fonts.measure(name, {
    family: fonts.family("display"),
    weight: 700,
    size: nameSize,
    letterSpacing: nameSize * NAME_TRACK,
  });
  const roleW =
    role.length > 0
      ? fonts.measure(role, {
          family: fonts.family("body"),
          weight: 500,
          size: roleSize,
          letterSpacing: roleSize * ROLE_TRACK,
        })
      : 0;
  const textW = Math.max(nameW, roleW);

  const contentH = role.length > 0 ? nameSize + rowGap + roleSize : nameSize;
  const panelW = Math.min(maxPanelW, pad * 2 + barW + barGap + textW);
  const panelH = pad * 2 + contentH;
  const radius = Math.round(panelH * 0.22);

  const cy =
    placement === "top-left" ? rect.y + panelH / 2 : rect.y + rect.height - panelH / 2;
  const cx =
    placement === "bottom-center" ? rect.x + rect.width / 2 : rect.x + panelW / 2;

  const glass = new Container();
  glass.position.set(cx, cy);
  glass.alpha = 0;
  root.addChild(glass);

  // --- Surface: soft shadow → base wash → tint gradient → sheen → hairlines. ---
  glass.addChild(softShadow(panelW, panelH, radius, Math.round(minDim * 0.024), Math.round(minDim * 0.011)));

  const wash = new FillGradient({
    type: "linear",
    start: { x: 0, y: 0 },
    end: { x: 0, y: 1 },
    colorStops: [
      { offset: 0, color: rgba(glassBg, 0.8) },
      { offset: 0.55, color: rgba(glassBg, 0.72) },
      { offset: 1, color: rgba(glassBg, 0.64) },
    ],
    textureSpace: "local",
  });
  glass.addChild(new Graphics().roundRect(-panelW / 2, -panelH / 2, panelW, panelH, radius).fill(wash));

  const tint = new FillGradient({
    type: "linear",
    start: { x: 0, y: 0 },
    end: { x: 0, y: 1 },
    colorStops: [
      { offset: 0, color: rgba(glassEdge, 0.16) },
      { offset: 0.5, color: rgba(glassEdge, 0.03) },
      { offset: 1, color: rgba(glassEdge, 0) },
    ],
    textureSpace: "local",
  });
  glass.addChild(new Graphics().roundRect(-panelW / 2, -panelH / 2, panelW, panelH, radius).fill(tint));

  // A single slow light sweep, clipped to the panel — the "glass catching the
  // light" beat. Toggleable.
  if (showSheen) {
    const bandW = Math.max(40, Math.round(panelW * 0.34));
    const skew = panelH * 0.35;
    const sheenFill = new FillGradient({
      type: "linear",
      start: { x: 0, y: 0 },
      end: { x: 1, y: 0 },
      colorStops: [
        { offset: 0, color: rgba(glassEdge, 0) },
        { offset: 0.5, color: rgba(glassEdge, 0.22) },
        { offset: 1, color: rgba(glassEdge, 0) },
      ],
      textureSpace: "local",
    });
    const sheen = new Graphics()
      .poly([
        -bandW / 2 + skew,
        -panelH,
        bandW / 2 + skew,
        -panelH,
        bandW / 2 - skew,
        panelH,
        -bandW / 2 - skew,
        panelH,
      ])
      .fill(sheenFill);
    sheen.alpha = 0;
    glass.addChild(sheen);

    const clip = new Graphics().roundRect(-panelW / 2, -panelH / 2, panelW, panelH, radius).fill("#FFFFFF");
    glass.addChild(clip);
    sheen.mask = clip;

    const travel = panelW / 2 + bandW;
    timeline
      .to(sheen, { prop: "x", from: -travel, to: travel, start: SHEEN_START, duration: SHEEN_DUR, ease: inOutQuad })
      .to(sheen, { prop: "alpha", from: 0, to: 1, start: SHEEN_START, duration: 0.4, ease: outQuad })
      .to(sheen, {
        prop: "alpha",
        from: 1,
        to: 0,
        start: SHEEN_START + SHEEN_DUR - 0.4,
        duration: 0.4,
        ease: outQuad,
      });
  }

  // Hairline edges: a full outline plus a brighter cap along the top, which is
  // what sells "glass" more than any blur would.
  if (showEdge) {
    const edge = new Container();
    edge.alpha = 0;
    const lw = Math.max(1, Math.round(minDim * 0.0016));
    edge.addChild(
      new Graphics()
        .roundRect(-panelW / 2 + lw / 2, -panelH / 2 + lw / 2, panelW - lw, panelH - lw, radius)
        .stroke({ color: glassEdge, width: lw, alpha: 0.3 }),
    );
    edge.addChild(
      new Graphics()
        .moveTo(-panelW / 2 + radius * 0.7, -panelH / 2 + lw)
        .lineTo(panelW / 2 - radius * 0.7, -panelH / 2 + lw)
        .stroke({ color: glassEdge, width: lw * 1.6, alpha: 0.5, cap: "round" }),
    );
    glass.addChild(edge);
    timeline.to(edge, { prop: "alpha", from: 0, to: 1, start: 0.5, duration: 0.6, ease: outQuad });
  }

  // --- Contents ---
  const textX = -panelW / 2 + pad + barW + barGap;
  const nameY = role.length > 0 ? -contentH / 2 + nameSize / 2 : 0;
  const roleY = role.length > 0 ? contentH / 2 - roleSize / 2 : 0;
  const drift = minDim * 0.018;

  if (showAccentBar) {
    const bar = new Graphics()
      .roundRect(-barW / 2, -contentH / 2, barW, contentH, barW / 2)
      .fill(accent);
    bar.position.set(-panelW / 2 + pad + barW / 2, 0);
    bar.scale.set(1, 0);
    glass.addChild(bar);
    timeline.to(bar, { prop: "scale.y", from: 0, to: 1, start: 0.38, duration: 0.7, ease: outExpo });
  }

  const nameText = makeText(fonts, {
    text: name,
    role: "display",
    weight: 700,
    size: nameSize,
    color: textColor,
    letterSpacing: nameSize * NAME_TRACK,
    anchor: { x: 0, y: 0.5 },
  });
  nameText.position.set(textX, nameY);
  nameText.alpha = 0;
  glass.addChild(nameText);
  timeline
    .to(nameText, { prop: "alpha", from: 0, to: 1, start: 0.42, duration: 0.5, ease: outQuad })
    .to(nameText, { prop: "y", from: nameY + drift, to: nameY, start: 0.42, duration: 0.85, ease: outQuint });

  if (role.length > 0) {
    const roleText = makeText(fonts, {
      text: role,
      role: "body",
      weight: 500,
      size: roleSize,
      color: textColor,
      letterSpacing: roleSize * ROLE_TRACK,
      anchor: { x: 0, y: 0.5 },
    });
    roleText.position.set(textX, roleY);
    roleText.alpha = 0;
    glass.addChild(roleText);
    timeline
      .to(roleText, { prop: "alpha", from: 0, to: 0.78, start: 0.56, duration: 0.5, ease: outQuad })
      .to(roleText, { prop: "y", from: roleY + drift, to: roleY, start: 0.56, duration: 0.85, ease: outQuint });
  }

  // --- Entrance: one long, unhurried glide + fade for the whole panel. ---
  const glideFrom = cx - minDim * 0.06;
  timeline
    .to(glass, { prop: "x", from: glideFrom, to: cx, start: 0, duration: 1.15, ease: outExpo })
    .to(glass, { prop: "alpha", from: 0, to: 1, start: 0, duration: 0.55, ease: outQuad });

  return { timeline, duration: 4.4 };
}

export const glassBar: TemplateDefinition = {
  id: "glass-bar",
  name: "Glass Bar",
  tagline: "A frosted glass panel glides in and settles while a name and role fade up inside it.",
  category: "overlay",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 3.0,
  fontRoles: { name: "display", role: "body" },
  palettes: PALETTES,
  fields: [
    { key: "name", type: "text", label: "Name", default: "Mara Lindqvist", maxLength: 32, shrinkToFit: true },
    { key: "role", type: "text", label: "Role", default: "Head of Brand Studio", maxLength: 44, optional: true, shrinkToFit: true },
    {
      key: "placement",
      type: "select",
      label: "Placement",
      default: "bottom-left",
      options: [
        { value: "bottom-left", label: "Bottom left" },
        { value: "bottom-center", label: "Bottom center" },
        { value: "top-left", label: "Top left" },
      ],
    },
    { key: "showAccentBar", type: "toggle", label: "Accent bar", default: true },
    { key: "showEdge", type: "toggle", label: "Glass edge", default: true },
    { key: "showSheen", type: "toggle", label: "Light sweep", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
