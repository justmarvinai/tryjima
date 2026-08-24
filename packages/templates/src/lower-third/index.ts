import type { Text } from "pixi.js";
import { Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outQuint,
  outExpo,
  safeZone,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;

/** Shrink a single-line size so `text` fits `maxWidth` (never wraps a name/role). */
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

// A broadcast-style lower third: minimal chrome (an accent block + floating
// text), designed to be dropped over footage via transparent export — the
// only opaque surface is the full-frame `bg` rect, which the exporter blanks.
const PALETTES: Palette[] = [
  { id: "ink-white", name: "Ink on white", colors: { background: "#FFFFFF", textColor: "#101014", accent: "#FF4D1C" } },
  { id: "midnight-ember", name: "Midnight ember", colors: { background: "#101014", textColor: "#FFFFFF", accent: "#FF4D1C" } },
  { id: "paper-cobalt", name: "Paper cobalt", colors: { background: "#F1F4F9", textColor: "#16233A", accent: "#3B5BA5" } },
  { id: "violet-night", name: "Violet night", colors: { background: "#1B1030", textColor: "#FFFFFF", accent: "#B08BFF" } },
];

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const name = str(values.name, "Jordan Ellis");
  const role = str(values.role, "Creative Director");
  const showAccent = values.showAccent !== false;

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const zone = safeZone(ctx.aspect);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Geometry (fixed fractions first, so the fit-to-width pass below has a
  // stable max width to shrink into — no circular sizing). ---
  const blockSize = Math.round(minDim * 0.044);
  const gap = Math.round(blockSize * 0.42);
  const leftX = zone.left;
  const textX = leftX + blockSize + gap;
  const maxTextW = Math.max(80, w - textX - zone.right);

  const nameSize = fitSize(fonts, name, "display", 700, Math.round(minDim * 0.05), maxTextW);
  const roleSize =
    role.length > 0 ? fitSize(fonts, role, "body", 500, Math.round(minDim * 0.027), maxTextW) : 0;

  const pad = Math.round(minDim * 0.02);
  const bottomLine = h - zone.bottom - pad;
  const nameY = role.length > 0 ? bottomLine - roleSize / 2 - minDim * 0.014 - nameSize / 2 : bottomLine - nameSize / 2;
  const roleY = role.length > 0 ? bottomLine - roleSize / 2 : nameY;
  const stackCenterY = role.length > 0 ? (nameY + roleY) / 2 : nameY;

  // --- Accent block: wipes in left-to-right, beside the text stack. ---
  const block = new Graphics()
    .roundRect(0, 0, blockSize, blockSize, Math.round(blockSize * 0.22))
    .fill(accent);
  block.position.set(leftX, stackCenterY - blockSize / 2);
  block.scale.set(0, 1);
  root.addChild(block);
  timeline.to(block, { prop: "scale.x", from: 0, to: 1, start: 0.0, duration: 0.42, ease: outExpo });

  // --- Name: slides up + fades in beside the block. ---
  const nameText = makeText(fonts, {
    text: name,
    role: "display",
    weight: 700,
    size: nameSize,
    color: textColor,
    anchor: { x: 0, y: 0.5 },
  });
  nameText.position.set(textX, nameY);
  nameText.alpha = 0;
  root.addChild(nameText);
  timeline
    .to(nameText, { prop: "alpha", from: 0, to: 1, start: 0.24, duration: 0.4, ease: outQuad })
    .to(nameText, { prop: "y", from: nameY + minDim * 0.02, to: nameY, start: 0.24, duration: 0.5, ease: outQuint });

  // --- Role (optional): slides up + fades in just after the name. ---
  if (role.length > 0) {
    const roleText: Text = makeText(fonts, {
      text: role,
      role: "body",
      weight: 500,
      size: roleSize,
      color: textColor,
      anchor: { x: 0, y: 0.5 },
    });
    roleText.position.set(textX, roleY);
    roleText.alpha = 0;
    root.addChild(roleText);
    timeline
      .to(roleText, { prop: "alpha", from: 0, to: 0.8, start: 0.38, duration: 0.4, ease: outQuad })
      .to(roleText, { prop: "y", from: roleY + minDim * 0.02, to: roleY, start: 0.38, duration: 0.5, ease: outQuint });
  }

  // --- Accent tick: draws under the name once it lands (toggleable). ---
  if (showAccent) {
    const tickH = Math.max(3, Math.round(nameSize * 0.07));
    const tickY = nameY + nameSize * 0.55;
    const tickW = Math.max(24, nameText.width);
    const tick = new Graphics().roundRect(0, 0, tickW, tickH, tickH / 2).fill(accent);
    tick.position.set(textX, tickY);
    tick.scale.set(0, 1);
    root.addChild(tick);
    timeline.to(tick, { prop: "scale.x", from: 0, to: 1, start: 0.85, duration: 0.4, ease: outExpo });
  }

  return { timeline, duration: 4.5 };
}

export const lowerThird: TemplateDefinition = {
  id: "lower-third",
  name: "Lower Third",
  tagline: "A broadcast name + role bar for the lower-left, built for overlay export.",
  category: "overlay",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 2.6,
  fontRoles: { name: "display", role: "body" },
  palettes: PALETTES,
  fields: [
    { key: "name", type: "text", label: "Name", default: "Jordan Ellis", maxLength: 40, shrinkToFit: true },
    { key: "role", type: "text", label: "Role", default: "Creative Director", maxLength: 48, optional: true, shrinkToFit: true },
    { key: "showAccent", type: "toggle", label: "Accent tick", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
