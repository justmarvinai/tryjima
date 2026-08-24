import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  spring,
  makeOutBack,
  safeRect,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { makeIcon } from "../shared/icons";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;

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
  return w > maxWidth ? Math.max(11, Math.floor((size0 * maxWidth) / w)) : size0;
}

// A "follow us" end card: brand + handle + a row of glyph chips. Chip surfaces
// use their own `cardBg` (survive transparent export); glyphs use the accent.
const PALETTES: Palette[] = [
  { id: "cloud", name: "Cloud", colors: { background: "#F4F6FA", textColor: "#0F1420", accent: "#3B4FD6", cardBg: "#FFFFFF" } },
  { id: "cream", name: "Cream", colors: { background: "#FBF6EF", textColor: "#241A12", accent: "#C2410C", cardBg: "#FFFFFF" } },
  { id: "blush", name: "Blush", colors: { background: "#FDEEF4", textColor: "#2A0E1C", accent: "#BE185D", cardBg: "#FFFFFF" } },
  { id: "midnight", name: "Midnight", colors: { background: "#0C1018", textColor: "#F2F5FA", accent: "#6EA8FE", cardBg: "#1B2230" } },
];

/** A simple camera glyph centered at origin, fitting a size×size box. */
function drawCamera(g: Graphics, s: number, color: string, hole: string): void {
  g.roundRect(-0.14 * s, -0.42 * s, 0.28 * s, 0.16 * s, 0.05 * s).fill(color); // viewfinder bump
  g.roundRect(-0.5 * s, -0.3 * s, 1.0 * s, 0.62 * s, 0.12 * s).fill(color); // body
  g.circle(0, 0.02 * s, 0.2 * s).fill(hole); // lens ring (punch)
  g.circle(0, 0.02 * s, 0.12 * s).fill(color); // lens center
  g.circle(0.34 * s, -0.16 * s, 0.045 * s).fill(hole); // flash dot
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F4F6FA"));
  const textColor = str(values.textColor, pc("textColor", "#0F1420"));
  const accent = str(values.accent, pc("accent", "#3B4FD6"));
  const cardBg = pc("cardBg", "#FFFFFF");

  const kicker = str(values.kicker, "Follow us").toUpperCase();
  const brand = str(values.brand, "Jima Motion");
  const handleRaw = str(values.handle, "@jimamotion");
  const handle = handleRaw.startsWith("@") ? handleRaw : `@${handleRaw}`;
  const showChips = values.showChips !== false;

  const w = size.width;
  const h = size.height;
  const zone = safeRect(ctx.aspect);
  const cx = zone.x + zone.width / 2;
  const cy = zone.y + zone.height * 0.5;
  const minDim = Math.min(w, h);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Kicker ---
  const kickerSize = fitSize(fonts, kicker, "body", 600, Math.round(minDim * 0.03), zone.width * 0.8);
  const kickerY = cy - minDim * 0.16;
  const kickerText = makeText(fonts, { text: kicker, role: "body", weight: 600, size: kickerSize, color: accent, anchor: 0.5, letterSpacing: 5 });
  kickerText.position.set(cx, kickerY);
  kickerText.alpha = 0;
  root.addChild(kickerText);
  timeline
    .to(kickerText, { prop: "alpha", from: 0, to: 1, start: 0.1, duration: 0.45, ease: outQuad })
    .to(kickerText, { prop: "y", from: kickerY - 10, to: kickerY, start: 0.1, duration: 0.5, ease: outExpo });

  // --- Brand ---
  const brandSize = fitSize(fonts, brand, "display", 700, Math.round(minDim * 0.076), zone.width * 0.9);
  const brandText = makeText(fonts, { text: brand, role: "display", weight: 700, size: brandSize, color: textColor, anchor: 0.5 });
  brandText.position.set(cx, cy - minDim * 0.05);
  brandText.alpha = 0;
  brandText.scale.set(0.86);
  root.addChild(brandText);
  timeline
    .to(brandText, { prop: "alpha", from: 0, to: 1, start: 0.3, duration: 0.45, ease: outQuad })
    .to(brandText, { prop: "scale.x", from: 0.86, to: 1, start: 0.3, duration: 0.55, ease: makeOutBack(1.6) })
    .to(brandText, { prop: "scale.y", from: 0.86, to: 1, start: 0.3, duration: 0.55, ease: makeOutBack(1.6) });

  // --- Handle ---
  const handleSize = fitSize(fonts, handle, "body", 600, Math.round(minDim * 0.036), zone.width * 0.8);
  const handleY = cy + minDim * 0.03;
  const handleText = makeText(fonts, { text: handle, role: "body", weight: 600, size: handleSize, color: textColor, anchor: 0.5 });
  handleText.position.set(cx, handleY);
  handleText.alpha = 0;
  root.addChild(handleText);
  timeline
    .to(handleText, { prop: "alpha", from: 0, to: 0.9, start: 0.7, duration: 0.45, ease: outQuad })
    .to(handleText, { prop: "y", from: handleY + 10, to: handleY, start: 0.7, duration: 0.45, ease: outExpo });

  // --- Social glyph chips ---
  if (showChips) {
    const chip = Math.round(minDim * 0.13);
    const chipR = Math.round(chip * 0.28);
    const gap = chip * 0.42;
    const rowW = chip * 3 + gap * 2;
    const rowY = handleY + minDim * 0.12;
    const glyphSize = chip * 0.5;
    const kinds = ["play", "heart", "camera"] as const;
    kinds.forEach((kind, i) => {
      const ccx = cx - rowW / 2 + chip / 2 + i * (chip + gap);
      const holder = new Container();
      holder.position.set(ccx, rowY);
      holder.scale.set(0);
      root.addChild(holder);

      const e = Math.round(chip * 0.04);
      const off = Math.round(chip * 0.06);
      holder.addChild(
        new Graphics().roundRect(-chip / 2 - e, -chip / 2 - e + off, chip + e * 2, chip + e * 2, chipR + e).fill({ color: "#000000", alpha: 0.12 }),
      );
      holder.addChild(new Graphics().roundRect(-chip / 2, -chip / 2, chip, chip, chipR).fill(cardBg));

      if (kind === "camera") {
        const g = new Graphics();
        drawCamera(g, glyphSize, accent, cardBg);
        holder.addChild(g);
      } else {
        holder.addChild(makeIcon(kind, glyphSize, { color: accent }));
      }

      const start = 1.0 + i * 0.13;
      timeline
        .to(holder, { prop: "scale.x", from: 0, to: 1, start, duration: 0.5, ease: spring(0.42) })
        .to(holder, { prop: "scale.y", from: 0, to: 1, start, duration: 0.5, ease: spring(0.42) });
    });
  }

  return { timeline, duration: 4.0 };
}

export const socialEndcard: TemplateDefinition = {
  id: "social-endcard",
  name: "Social End Card",
  tagline: "A follow-us card with brand, handle, and popping social chips.",
  category: "brand",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 2.6,
  fontRoles: { brand: "display", handle: "body" },
  palettes: PALETTES,
  fields: [
    { key: "kicker", type: "text", label: "Kicker", default: "Follow us", maxLength: 20, shrinkToFit: true },
    { key: "brand", type: "text", label: "Brand", default: "Jima Motion", maxLength: 22, shrinkToFit: true },
    { key: "handle", type: "text", label: "Handle", default: "@jimamotion", maxLength: 24, shrinkToFit: true },
    { key: "showChips", type: "toggle", label: "Social chips", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
