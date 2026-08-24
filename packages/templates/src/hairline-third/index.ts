import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outQuart,
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

interface LineOptions {
  text: string;
  role: FontRole;
  weight: number;
  size: number;
  color: string;
  letterSpacing: number;
}

/**
 * A line of type with an optional shadow twin behind it — a second, offset copy
 * at low alpha. With no plate under the type, that quiet lift is what keeps it
 * readable over busy footage. (Deliberately a twin rather than a `dropShadow`
 * style: the style's texture padding bleeds neighbouring glyphs into the frame
 * whenever the text is rasterised below 1× — exactly what the Studio preview
 * and the gallery posters do.)
 */
function line(fonts: FontRegistry, opts: LineOptions, lifted: boolean, offset: number): Container {
  const c = new Container();
  if (lifted) {
    const twin = makeText(fonts, { ...opts, color: "#000000", anchor: { x: 0, y: 0.5 } });
    twin.position.set(0, offset);
    twin.alpha = 0.22;
    c.addChild(twin);
  }
  c.addChild(makeText(fonts, { ...opts, anchor: { x: 0, y: 0.5 } }));
  return c;
}

// An ultra-minimal editorial lower third: one hairline rule draws itself out
// from the left, and the name (above) and role (below) fade up as the line
// sweeps past them. There is deliberately no bar, plate or chip — the restraint
// is the design, which is what sets it apart from the solid-bar lower thirds.
//
// Transparent export: only the full-frame `bg` rect is tied to the background
// field (it defaults to the transparent sentinel). The rule owns its own
// palette-only `ruleColor` (it follows the Text field when that is overridden,
// so a recolor never splits the pair) and carries a soft offset shadow, and the
// type gets an optional soft lift, so the whole third survives on footage.
// Every palette is ink-on-light: with no plate behind the type, a light palette
// would vanish on light footage. Set Text to white by hand for dark footage.
const PALETTES: Palette[] = [
  { id: "ink", name: "Ink", colors: { ruleColor: "#0B0F14", textColor: "#0B0F14", accent: "#C2410C" } },
  { id: "navy", name: "Navy", colors: { ruleColor: "#10243B", textColor: "#10243B", accent: "#1D4ED8" } },
  { id: "sage", name: "Sage", colors: { ruleColor: "#0C2A22", textColor: "#0C2A22", accent: "#047857" } },
  { id: "clay", name: "Clay", colors: { ruleColor: "#2A1206", textColor: "#2A1206", accent: "#B45309" } },
];

const RULE_START = 0.15;
const RULE_DUR = 1.35;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", TRANSPARENT_BG));
  const textColor = str(values.textColor, pc("textColor", "#0B0F14"));
  const ruleColor = str(values.textColor, pc("ruleColor", "#0B0F14"));
  const accent = str(values.accent, pc("accent", "#C2410C"));

  const name = str(values.name, "Elena Marchetti");
  const role = str(values.role, "Photographer, Milan");
  const showAccent = values.showAccent !== false;
  const showLift = values.showLift !== false;

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const rect = safeRect(ctx.aspect);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Type: one large, tightly tracked name; one small, widely tracked role. ---
  const NAME_TRACK = -0.016;
  const ROLE_TRACK = 0.075;
  const maxTextW = rect.width;

  const nameSize = fitSize(fonts, name, "display", 600, Math.round(minDim * 0.062), maxTextW, NAME_TRACK);
  const roleSize =
    role.length > 0 ? fitSize(fonts, role, "body", 500, Math.round(minDim * 0.023), maxTextW, ROLE_TRACK) : 0;

  const nameW = fonts.measure(name, {
    family: fonts.family("display"),
    weight: 600,
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

  // --- Vertical rhythm, hung off the bottom of the safe rect. ---
  const gapBelow = Math.round(minDim * 0.028);
  const gapAbove = Math.round(minDim * 0.032);
  const bottomY = rect.y + rect.height;
  const roleY = role.length > 0 ? bottomY - roleSize / 2 : bottomY;
  const ruleY = role.length > 0 ? roleY - roleSize / 2 - gapBelow : bottomY;
  const nameY = ruleY - gapAbove - nameSize / 2;

  const leftX = rect.x;
  const ruleW = Math.min(rect.width, Math.max(Math.max(nameW, roleW) + minDim * 0.09, minDim * 0.34));
  const ruleH = Math.max(2, Math.round(minDim * 0.0026));

  // --- The rule: drawn once, revealed by a mask that grows out from the left,
  // so the accent lead segment never squashes. ---
  const ruleC = new Container();
  root.addChild(ruleC);

  if (showLift) {
    ruleC.addChild(new Graphics().rect(0, ruleH * 0.9, ruleW, ruleH).fill({ color: "#000000", alpha: 0.22 }));
  }
  ruleC.addChild(new Graphics().rect(0, 0, ruleW, ruleH).fill(ruleColor));
  if (showAccent) {
    ruleC.addChild(new Graphics().rect(0, 0, Math.round(ruleW * 0.14), ruleH).fill(accent));
  }
  ruleC.position.set(leftX, ruleY - ruleH / 2);

  const ruleMask = new Graphics().rect(0, -ruleH * 6, ruleW, ruleH * 13).fill("#FFFFFF");
  ruleMask.position.set(leftX, ruleY - ruleH / 2);
  ruleMask.scale.set(0, 1);
  root.addChild(ruleMask);
  ruleC.mask = ruleMask;

  // outQuart rather than outExpo: the sweep stays visible long enough for the
  // name and role to read as "the line passing them", instead of snapping to
  // full width in the first quarter second.
  timeline.to(ruleMask, { prop: "scale.x", from: 0, to: 1, start: RULE_START, duration: RULE_DUR, ease: outQuart });

  // --- Name and role fade up as the sweep passes them. ---
  const drift = minDim * 0.022;

  const nameNode = line(
    fonts,
    {
      text: name,
      role: "display",
      weight: 600,
      size: nameSize,
      color: textColor,
      letterSpacing: nameSize * NAME_TRACK,
    },
    showLift,
    Math.max(1, Math.round(nameSize * 0.055)),
  );
  nameNode.position.set(leftX, nameY);
  nameNode.alpha = 0;
  root.addChild(nameNode);
  timeline
    .to(nameNode, { prop: "alpha", from: 0, to: 1, start: 0.35, duration: 0.55, ease: outQuad })
    .to(nameNode, { prop: "y", from: nameY + drift, to: nameY, start: 0.35, duration: 0.95, ease: outQuint });

  if (role.length > 0) {
    const roleNode = line(
      fonts,
      {
        text: role,
        role: "body",
        weight: 500,
        size: roleSize,
        color: textColor,
        letterSpacing: roleSize * ROLE_TRACK,
      },
      showLift,
      Math.max(1, Math.round(roleSize * 0.075)),
    );
    roleNode.position.set(leftX, roleY);
    roleNode.alpha = 0;
    root.addChild(roleNode);
    timeline
      .to(roleNode, { prop: "alpha", from: 0, to: 0.82, start: 0.55, duration: 0.55, ease: outQuad })
      .to(roleNode, { prop: "y", from: roleY + drift, to: roleY, start: 0.55, duration: 0.95, ease: outQuint });
  }

  return { timeline, duration: 4.0 };
}

export const hairlineThird: TemplateDefinition = {
  id: "hairline-third",
  name: "Hairline",
  tagline: "A single hairline draws out from the left and the name and role fade up around it.",
  category: "overlay",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 2.6,
  fontRoles: { name: "display", role: "body" },
  palettes: PALETTES,
  fields: [
    { key: "name", type: "text", label: "Name", default: "Elena Marchetti", maxLength: 30, shrinkToFit: true },
    { key: "role", type: "text", label: "Role", default: "Photographer, Milan", maxLength: 40, optional: true, shrinkToFit: true },
    { key: "showAccent", type: "toggle", label: "Accent lead", default: true },
    { key: "showLift", type: "toggle", label: "Soft shadow", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
