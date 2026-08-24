import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  safeRect,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const asList = (v: unknown, fallback: string[]): string[] => {
  if (Array.isArray(v)) {
    const arr = v.filter((s): s is string => typeof s === "string" && s.length > 0);
    if (arr.length) return arr;
  }
  return fallback;
};

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

/** Normalize a user hex string to "#RRGGBB" (uppercase) or null if invalid. */
function normHex(raw: string): string | null {
  let s = raw.trim().replace(/^#/, "").toUpperCase();
  if (/^[0-9A-F]{3}$/.test(s)) s = s.split("").map((c) => c + c).join("");
  return /^[0-9A-F]{6}$/.test(s) ? `#${s}` : null;
}

// A brand palette reveal: swatches slide in with their hex labels + the brand
// name. The chosen swatch colors are user content; labels/brand stay in the
// palette text color so they always clear 4.5:1 on the background.
const PALETTES: Palette[] = [
  { id: "cloud", name: "Cloud", colors: { background: "#F4F6FA", textColor: "#0F1420", accent: "#3B4FD6" } },
  { id: "paper", name: "Paper", colors: { background: "#FFFFFF", textColor: "#141821", accent: "#111827" } },
  { id: "cream", name: "Cream", colors: { background: "#FBF6EF", textColor: "#241A12", accent: "#C2410C" } },
  { id: "midnight", name: "Midnight", colors: { background: "#0C1018", textColor: "#F2F5FA", accent: "#6EA8FE" } },
];

const DEFAULT_SWATCHES = ["#3B4FD6", "#12A150", "#F5A623", "#E11D74", "#0F1420"];

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F4F6FA"));
  const textColor = str(values.textColor, pc("textColor", "#0F1420"));
  const accent = str(values.accent, pc("accent", "#3B4FD6"));

  const brand = str(values.brand, "Jima Motion");
  const showHex = values.showHex !== false;
  const swatches = asList(values.swatches, DEFAULT_SWATCHES)
    .slice(0, 6)
    .map((s) => normHex(s) ?? "#CCCCCC");
  const n = Math.max(1, swatches.length);

  const w = size.width;
  const h = size.height;
  const zone = safeRect(ctx.aspect);
  const cx = zone.x + zone.width / 2;
  const minDim = Math.min(w, h);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Brand name + kicker rule ---
  const brandSize = fitSize(fonts, brand, "display", 700, Math.round(minDim * 0.06), zone.width * 0.9);
  const brandY = zone.y + zone.height * 0.17;
  const brandText = makeText(fonts, { text: brand, role: "display", weight: 700, size: brandSize, color: textColor, anchor: 0.5 });
  brandText.position.set(cx, brandY);
  brandText.alpha = 0;
  root.addChild(brandText);
  timeline
    .to(brandText, { prop: "alpha", from: 0, to: 1, start: 0.1, duration: 0.45, ease: outQuad })
    .to(brandText, { prop: "y", from: brandY - 12, to: brandY, start: 0.1, duration: 0.5, ease: outExpo });

  const kickerY = brandY + brandSize * 0.9;
  const kicker = makeText(fonts, { text: "BRAND PALETTE", role: "body", weight: 600, size: Math.round(minDim * 0.02), color: textColor, anchor: 0.5, letterSpacing: 4 });
  kicker.position.set(cx, kickerY);
  kicker.alpha = 0;
  root.addChild(kicker);
  timeline.to(kicker, { prop: "alpha", from: 0, to: 0.65, start: 0.35, duration: 0.5, ease: outQuad });

  // --- Swatch row ---
  const gap = minDim * 0.025;
  const rowW = zone.width * 0.92;
  const swW = Math.min((rowW - gap * (n - 1)) / n, minDim * 0.2);
  const swH = Math.min(swW * 1.35, zone.height * 0.42);
  const totalW = swW * n + gap * (n - 1);
  const rowLeft = cx - totalW / 2;
  const rowCy = zone.y + zone.height * 0.58;
  const labelSize = Math.min(Math.round(swW * 0.2), Math.round(minDim * 0.026));

  swatches.forEach((hex, i) => {
    const scx = rowLeft + i * (swW + gap) + swW / 2;
    const holder = new Container();
    holder.position.set(scx, rowCy);
    holder.alpha = 0;
    root.addChild(holder);

    const e = Math.round(swW * 0.03);
    const off = Math.round(swW * 0.05);
    holder.addChild(new Graphics().roundRect(-swW / 2 - e, -swH / 2 - e + off, swW + e * 2, swH + e * 2, swW * 0.16 + e).fill({ color: "#000000", alpha: 0.1 }));
    holder.addChild(new Graphics().roundRect(-swW / 2, -swH / 2, swW, swH, swW * 0.16).fill(hex));
    // Hairline border so near-background swatches still read.
    holder.addChild(new Graphics().roundRect(-swW / 2, -swH / 2, swW, swH, swW * 0.16).stroke({ color: textColor, width: Math.max(1, swW * 0.006), alpha: 0.12 }));

    if (showHex) {
      const label = makeText(fonts, { text: hex, role: "mono", weight: 400, size: labelSize, color: textColor, anchor: 0.5 });
      label.position.set(0, swH / 2 + labelSize * 1.1);
      holder.addChild(label);
    }

    const start = 0.5 + i * 0.11;
    timeline
      .to(holder, { prop: "alpha", from: 0, to: 1, start, duration: 0.4, ease: outQuad })
      .to(holder, { prop: "y", from: rowCy + swH * 0.35, to: rowCy, start, duration: 0.55, ease: outExpo });
  });

  // Baseline accent rule under the row.
  const ruleW = totalW;
  const ruleY = rowCy + swH / 2 + (showHex ? labelSize * 2.4 : minDim * 0.05);
  const rule = new Graphics().roundRect(-ruleW / 2, -Math.max(1.5, minDim * 0.003), ruleW, Math.max(3, minDim * 0.006), 3).fill(accent);
  rule.position.set(cx, ruleY);
  rule.scale.set(0, 1);
  root.addChild(rule);
  timeline.to(rule, { prop: "scale.x", from: 0, to: 1, start: 0.6 + n * 0.11, duration: 0.6, ease: outExpo });

  return { timeline, duration: 4.2 };
}

export const brandPalette: TemplateDefinition = {
  id: "brand-palette",
  name: "Brand Palette",
  tagline: "Brand swatches slide in with their hex labels.",
  category: "brand",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 2.8,
  fontRoles: { brand: "display" },
  palettes: PALETTES,
  fields: [
    { key: "brand", type: "text", label: "Brand", default: "Jima Motion", maxLength: 24, shrinkToFit: true },
    {
      key: "swatches",
      type: "textlist",
      label: "Swatches (hex)",
      default: DEFAULT_SWATCHES,
      minItems: 3,
      maxItems: 6,
      maxLength: 8,
      help: 'One hex per line, e.g. "#3B4FD6".',
    },
    { key: "showHex", type: "toggle", label: "Hex labels", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
