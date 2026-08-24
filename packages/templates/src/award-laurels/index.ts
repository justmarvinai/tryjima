import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  makeOutBack,
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

// Two laurel branches grow leaf-by-leaf around an award lockup. Text stays in
// the palette's text color (kept ≥4.5:1 on every background); laurels + rule use
// the accent, which is decorative.
const PALETTES: Palette[] = [
  { id: "cream", name: "Cream", colors: { background: "#FBF6EF", textColor: "#241A12", accent: "#C2410C" } },
  { id: "cloud", name: "Cloud", colors: { background: "#F4F6FA", textColor: "#0F1420", accent: "#3B4FD6" } },
  { id: "mint", name: "Mint", colors: { background: "#EAF7F0", textColor: "#0B241A", accent: "#0A6B3A" } },
  { id: "midnight", name: "Midnight", colors: { background: "#0C1018", textColor: "#F2F5FA", accent: "#D8B45A" } },
];

interface Leaf {
  node: Container;
  order: number;
}

/**
 * Build one laurel branch as leaves along an outward-bowing curve. Both branches
 * meet at the bottom and top, forming a closed wreath; leaves fan radially out.
 */
function buildBranch(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  side: 1 | -1,
  color: string,
  leafLen: number,
): Leaf[] {
  const leaves: Leaf[] = [];
  const count = 7;
  for (let i = 0; i < count; i++) {
    const f = i / (count - 1); // 0 = bottom, 1 = top
    const px = cx + side * rx * Math.sin(f * Math.PI); // 0 at ends, max at middle
    const py = cy + ry * (1 - 2 * f); // bottom (cy+ry) -> top (cy-ry)
    const leaf = new Container();
    leaf.position.set(px, py);
    // Point the leaf radially outward from the wreath center.
    leaf.rotation = Math.atan2(py - cy, px - cx);
    const ll = leafLen * (0.7 + 0.3 * Math.sin(f * Math.PI));
    leaf.addChild(new Graphics().ellipse(ll * 0.5, 0, ll * 0.5, ll * 0.26).fill(color));
    leaf.scale.set(0);
    leaves.push({ node: leaf, order: i });
  }
  return leaves;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FBF6EF"));
  const textColor = str(values.textColor, pc("textColor", "#241A12"));
  const accent = str(values.accent, pc("accent", "#C2410C"));

  const title = str(values.title, "Winner").toUpperCase();
  const year = str(values.year, "2026");
  const category = str(values.category, "Best Design").toUpperCase();
  const showLaurels = values.showLaurels !== false;

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

  // --- Laurel branches ---
  if (showLaurels) {
    const rx = minDim * 0.19;
    const ry = minDim * 0.24;
    const leafLen = minDim * 0.075;
    const branches: Leaf[] = [
      ...buildBranch(cx, cy, rx, ry, -1, accent, leafLen),
      ...buildBranch(cx, cy, rx, ry, 1, accent, leafLen),
    ];
    branches.forEach((lf) => {
      root.addChild(lf.node);
      const start = 0.25 + lf.order * 0.07;
      timeline
        .to(lf.node, { prop: "scale.x", from: 0, to: 1, start, duration: 0.42, ease: makeOutBack(2) })
        .to(lf.node, { prop: "scale.y", from: 0, to: 1, start, duration: 0.42, ease: makeOutBack(2) });
    });
  }

  // --- Center lockup: title / year / category ---
  const titleSize = fitSize(fonts, title, "body", 700, Math.round(minDim * 0.038), zone.width * 0.5);
  const titleY = cy - minDim * 0.13;
  const titleText = makeText(fonts, { text: title, role: "body", weight: 700, size: titleSize, color: textColor, anchor: 0.5, letterSpacing: 4 });
  titleText.position.set(cx, titleY);
  titleText.alpha = 0;
  root.addChild(titleText);
  timeline
    .to(titleText, { prop: "alpha", from: 0, to: 1, start: 0.7, duration: 0.4, ease: outQuad })
    .to(titleText, { prop: "y", from: titleY - 10, to: titleY, start: 0.7, duration: 0.45, ease: outExpo });

  const yearSize = fitSize(fonts, year, "display", 700, Math.round(minDim * 0.14), zone.width * 0.44);
  const yearText = makeText(fonts, { text: year, role: "display", weight: 700, size: yearSize, color: textColor, anchor: 0.5 });
  yearText.position.set(cx, cy);
  yearText.alpha = 0;
  yearText.scale.set(0.8);
  root.addChild(yearText);
  timeline
    .to(yearText, { prop: "alpha", from: 0, to: 1, start: 0.95, duration: 0.4, ease: outQuad })
    .to(yearText, { prop: "scale.x", from: 0.8, to: 1, start: 0.95, duration: 0.6, ease: makeOutBack(1.6) })
    .to(yearText, { prop: "scale.y", from: 0.8, to: 1, start: 0.95, duration: 0.6, ease: makeOutBack(1.6) });

  // Accent rule under the year.
  const ruleY = cy + minDim * 0.1;
  const ruleW = minDim * 0.12;
  const rule = new Graphics().roundRect(-ruleW / 2, 0, ruleW, Math.max(3, minDim * 0.008), 3).fill(accent);
  rule.position.set(cx, ruleY);
  rule.scale.set(0, 1);
  root.addChild(rule);
  timeline.to(rule, { prop: "scale.x", from: 0, to: 1, start: 1.25, duration: 0.4, ease: outExpo });

  const catSize = fitSize(fonts, category, "body", 600, Math.round(minDim * 0.026), zone.width * 0.5);
  const catY = ruleY + minDim * 0.06;
  const catText = makeText(fonts, { text: category, role: "body", weight: 600, size: catSize, color: textColor, anchor: 0.5, letterSpacing: 2 });
  catText.position.set(cx, catY);
  catText.alpha = 0;
  root.addChild(catText);
  timeline
    .to(catText, { prop: "alpha", from: 0, to: 0.9, start: 1.4, duration: 0.4, ease: outQuad })
    .to(catText, { prop: "y", from: catY + 8, to: catY, start: 1.4, duration: 0.4, ease: outExpo });

  return { timeline, duration: 4.2 };
}

export const awardLaurels: TemplateDefinition = {
  id: "award-laurels",
  name: "Award Laurels",
  tagline: "Laurel branches grow around an award year and category.",
  category: "brand",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 2.8,
  fontRoles: { year: "display" },
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Title", default: "Winner", maxLength: 18, shrinkToFit: true },
    { key: "year", type: "text", label: "Year", default: "2026", maxLength: 8, shrinkToFit: true },
    { key: "category", type: "text", label: "Category", default: "Best Design", maxLength: 28, shrinkToFit: true },
    { key: "showLaurels", type: "toggle", label: "Laurel branches", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
