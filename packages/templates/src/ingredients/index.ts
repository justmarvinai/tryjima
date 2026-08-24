import { Container, Graphics, Sprite, type Texture } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  outQuint,
  spring,
  makeOutBack,
  safeRect,
  type Aspect,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
  type Values,
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

/** Largest size ≤ size0 at which `text` fits `maxWidth` on one crisp line. */
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

// A product with a "what's inside" callout list — labeled dots on a spine.
const PALETTES: Palette[] = [
  { id: "studio-white", name: "Studio white", colors: { background: "#F4F2EC", accent: "#0E9F6E", textColor: "#14140F", muted: "#6B6B60", onAccent: "#FFFFFF" } },
  { id: "citrus", name: "Citrus", colors: { background: "#FFF6E6", accent: "#B45309", textColor: "#2B1A05", muted: "#7A6650", onAccent: "#FFFFFF" } },
  { id: "splash-blue", name: "Splash blue", colors: { background: "#E9F1FC", accent: "#1E6FE0", textColor: "#0B1A2E", muted: "#5A6A82", onAccent: "#FFFFFF" } },
  { id: "ink-mint", name: "Ink mint", colors: { background: "#14181A", accent: "#38E8B0", textColor: "#FFFFFF", muted: "#93A29B", onAccent: "#0A140F" } },
];

interface Ingredient {
  label: string;
  sub: string;
}

function parseItem(raw: string): Ingredient {
  const parts = raw.split("|").map((s) => s.trim());
  return { label: parts[0] && parts[0].length > 0 ? parts[0] : "—", sub: parts[1] ?? "" };
}

const DEFAULT_ITEMS = ["Aloe Vera|Soothes", "Vitamin E|Nourishes", "Shea Butter|Softens", "Green Tea|Protects"];

/** The product: contain-fit image, or a designed bottle silhouette. */
function productNode(pw: number, ph: number, tex: Texture | null, accent: string, onAccent: string): Container {
  const c = new Container();
  if (tex) {
    const s = new Sprite(tex);
    s.anchor.set(0.5);
    s.scale.set(Math.min(pw / tex.width, ph / tex.height));
    c.addChild(s);
  } else {
    const bw = pw * 0.62;
    const bh = ph * 0.92;
    c.addChild(new Graphics().roundRect(-bw / 2, -bh / 2 + bh * 0.08, bw, bh * 0.92, bw * 0.24).fill(accent));
    c.addChild(new Graphics().roundRect(-bw * 0.18, -bh / 2 - bh * 0.02, bw * 0.36, bh * 0.15, bw * 0.08).fill(accent));
    c.addChild(new Graphics().roundRect(-bw / 2 + bw * 0.12, -bh / 2 + bh * 0.18, bw * 0.2, bh * 0.58, bw * 0.1).fill({ color: onAccent, alpha: 0.22 }));
    c.addChild(new Graphics().roundRect(-bw / 2 + bw * 0.1, bh * 0.06, bw * 0.8, bh * 0.26, bw * 0.06).fill({ color: onAccent, alpha: 0.16 }));
  }
  return c;
}

function resolveItems(values: Values): Ingredient[] {
  return asList(values.items, DEFAULT_ITEMS).slice(0, 4).map(parseItem);
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, images } = ctx;
  const aspect: Aspect = ctx.aspect;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F4F2EC"));
  const accent = str(values.accent, pc("accent", "#0E9F6E"));
  const textColor = str(values.textColor, pc("textColor", "#14140F"));
  const muted = pc("muted", "#6B6B60");
  const onAccent = pc("onAccent", "#FFFFFF");

  const product = str(values.product, "Aero Serum");
  const heading = str(values.heading, "What's inside");
  const items = resolveItems(values);
  const showSpine = values.showSpine !== false;

  const W = size.width;
  const H = size.height;
  const minDim = Math.min(W, H);
  const zone = safeRect(ctx.aspect);
  const cx = zone.x + zone.width / 2;
  const zoneRight = zone.x + zone.width;

  const bgRect = new Graphics().rect(0, 0, W, H).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  const horizontal = aspect === "16:9" || aspect === "1:1";
  const n = items.length;

  // Text metrics.
  const kickerSize = Math.round(minDim * 0.026);
  const nameSize0 = Math.round(minDim * (horizontal ? 0.05 : 0.056));
  const labelSize0 = Math.round(minDim * (horizontal ? 0.038 : 0.044));
  const subSize = Math.round(labelSize0 * 0.62);
  const dotR = labelSize0 * 0.36;
  const rowGap = minDim * 0.03;

  // Per-row heights (label + optional sub).
  const rowHs = items.map((it) => labelSize0 * 1.08 + (it.sub ? subSize * 1.15 + minDim * 0.004 : 0));
  const rowsH = rowHs.reduce((a, b) => a + b, 0) + (n - 1) * rowGap;

  // Layout anchors resolved per orientation.
  let productCx: number;
  let productCy: number;
  let pw: number;
  let ph: number;
  let dotCx: number;
  let labelX: number;
  let labelMaxW: number;
  let rowsTop: number;
  let nameCx: number;
  let nameAnchor: 0 | 0.5;
  let nameW: number;
  let headBlockTop: number;

  const kickerH = kickerSize * 1.3;
  const gapKN = minDim * 0.012;

  if (horizontal) {
    pw = minDim * 0.26;
    ph = minDim * 0.44;
    productCx = zone.x + pw * 0.5 + minDim * 0.02;
    productCy = zone.y + zone.height / 2;
    const colStartX = productCx + pw * 0.5 + minDim * 0.09;
    dotCx = colStartX + dotR;
    labelX = dotCx + dotR + minDim * 0.024;
    labelMaxW = zoneRight - labelX;
    nameCx = colStartX;
    nameAnchor = 0;
    const nameSize = fitSize(fonts, product, "display", 700, nameSize0, zoneRight - colStartX);
    nameW = nameSize;
    const nameH = nameSize * 1.12;
    const blockH = kickerH + gapKN + nameH + minDim * 0.05 + rowsH;
    headBlockTop = zone.y + (zone.height - blockH) / 2;
    rowsTop = headBlockTop + kickerH + gapKN + nameH + minDim * 0.05;
  } else {
    pw = minDim * 0.3;
    ph = minDim * 0.36;
    const colW = zone.width * 0.72;
    const colX = cx - colW / 2;
    dotCx = colX + dotR;
    labelX = dotCx + dotR + minDim * 0.024;
    labelMaxW = colX + colW - labelX;
    nameCx = cx;
    nameAnchor = 0.5;
    nameW = fitSize(fonts, product, "display", 700, nameSize0, zone.width * 0.86);
    const nameH = nameW * 1.12;
    const gapNP = minDim * 0.04;
    const gapPR = minDim * 0.05;
    const stackH = kickerH + gapKN + nameH + gapNP + ph + gapPR + rowsH;
    headBlockTop = zone.y + (zone.height - stackH) / 2;
    productCx = cx;
    productCy = headBlockTop + kickerH + gapKN + nameH + gapNP + ph / 2;
    rowsTop = productCy + ph / 2 + gapPR;
  }

  const nameSize = fitSize(fonts, product, "display", 700, nameSize0, horizontal ? zoneRight - nameCx : zone.width * 0.86);

  // --- Product ---
  const prod = productNode(pw, ph, images.image ?? null, accent, onAccent);
  prod.position.set(productCx, productCy);
  prod.alpha = 0;
  prod.scale.set(0.8);
  root.addChild(prod);
  timeline
    .to(prod, { prop: "alpha", from: 0, to: 1, start: 0.15, duration: 0.4, ease: outQuad })
    .to(prod, { prop: "y", from: productCy + minDim * 0.03, to: productCy, start: 0.15, duration: 0.8, ease: spring(0.5) })
    .to(prod, { prop: "scale.x", from: 0.8, to: 1, start: 0.15, duration: 0.8, ease: spring(0.5) })
    .to(prod, { prop: "scale.y", from: 0.8, to: 1, start: 0.15, duration: 0.8, ease: spring(0.5) });

  // --- Kicker + product name ---
  // Kicker uses textColor (not accent) so it always clears 4.5:1 on any bg —
  // some brand accents (light greens/blues) fail as text on a light background.
  const kicker = makeText(fonts, { text: heading.toUpperCase(), role: "body", weight: 700, size: kickerSize, color: textColor, anchor: { x: nameAnchor, y: 0 }, align: nameAnchor === 0 ? "left" : "center", letterSpacing: 2 });
  kicker.position.set(nameCx, headBlockTop);
  kicker.alpha = 0;
  root.addChild(kicker);
  const nameText = makeText(fonts, { text: product, role: "display", weight: 700, size: nameSize, color: textColor, anchor: { x: nameAnchor, y: 0 }, align: nameAnchor === 0 ? "left" : "center" });
  nameText.position.set(nameCx, headBlockTop + kickerH + gapKN);
  nameText.alpha = 0;
  root.addChild(nameText);
  timeline
    .to(kicker, { prop: "alpha", from: 0, to: 1, start: 0.45, duration: 0.4, ease: outQuad })
    .to(kicker, { prop: "y", from: headBlockTop + minDim * 0.012, to: headBlockTop, start: 0.45, duration: 0.5, ease: outQuint })
    .to(nameText, { prop: "alpha", from: 0, to: 1, start: 0.58, duration: 0.4, ease: outQuad })
    .to(nameText, { prop: "y", from: headBlockTop + kickerH + gapKN + minDim * 0.014, to: headBlockTop + kickerH + gapKN, start: 0.58, duration: 0.55, ease: outExpo });

  // Row center Y positions.
  const rowCys: number[] = [];
  {
    let y = rowsTop;
    for (let i = 0; i < n; i++) {
      const hRow = rowHs[i] ?? labelSize0;
      rowCys.push(y + hRow / 2);
      y += hRow + rowGap;
    }
  }

  // --- Spine (decorative connector, toggleable) ---
  if (showSpine && n > 0) {
    const firstY = rowCys[0] ?? rowsTop;
    const lastY = rowCys[n - 1] ?? rowsTop;
    const spineTopY = horizontal ? Math.min(firstY, productCy) : Math.min(firstY, productCy + ph / 2 + minDim * 0.02);
    const spineW = Math.max(2, minDim * 0.006);
    const spine = new Graphics().roundRect(-spineW / 2, 0, spineW, lastY - spineTopY, spineW / 2).fill({ color: accent, alpha: 0.5 });
    spine.position.set(dotCx, spineTopY);
    spine.scale.set(1, 0);
    root.addChild(spine);
    if (horizontal) {
      const stubW = dotCx - (productCx + pw * 0.42);
      if (stubW > 0) {
        const stub = new Graphics().roundRect(0, -spineW / 2, stubW, spineW, spineW / 2).fill({ color: accent, alpha: 0.5 });
        stub.position.set(productCx + pw * 0.42, productCy);
        stub.scale.set(0, 1);
        root.addChild(stub);
        timeline.to(stub, { prop: "scale.x", from: 0, to: 1, start: 0.7, duration: 0.4, ease: outQuad });
      }
    }
    timeline.to(spine, { prop: "scale.y", from: 0, to: 1, start: 0.78, duration: 0.55, ease: outQuint });
  }

  // --- Ingredient rows ---
  items.forEach((it, i) => {
    const rowCy = rowCys[i] ?? rowsTop;
    const start = 0.95 + i * 0.14;

    const dot = new Container();
    dot.position.set(dotCx, rowCy);
    dot.addChild(new Graphics().circle(0, 0, dotR).fill(accent));
    dot.addChild(new Graphics().circle(0, 0, dotR * 0.42).fill({ color: onAccent, alpha: 0.85 }));
    dot.scale.set(0);
    root.addChild(dot);
    timeline
      .to(dot, { prop: "scale.x", from: 0, to: 1, start, duration: 0.5, ease: makeOutBack(2) })
      .to(dot, { prop: "scale.y", from: 0, to: 1, start, duration: 0.5, ease: makeOutBack(2) });

    const labelFit = fitSize(fonts, it.label, "display", 700, labelSize0, labelMaxW);
    const hasSub = it.sub.length > 0;
    const labelText = makeText(fonts, { text: it.label, role: "display", weight: 700, size: labelFit, color: textColor, anchor: { x: 0, y: hasSub ? 0 : 0.5 } });
    labelText.position.set(labelX, hasSub ? rowCy - (rowHs[i] ?? labelSize0) / 2 : rowCy);
    labelText.alpha = 0;
    root.addChild(labelText);
    timeline
      .to(labelText, { prop: "alpha", from: 0, to: 1, start: start + 0.06, duration: 0.4, ease: outQuad })
      .to(labelText, { prop: "x", from: labelX + minDim * 0.02, to: labelX, start: start + 0.06, duration: 0.5, ease: outExpo });

    if (hasSub) {
      const subFit = fitSize(fonts, it.sub, "body", 500, subSize, labelMaxW);
      const subText = makeText(fonts, { text: it.sub, role: "body", weight: 500, size: subFit, color: muted, anchor: { x: 0, y: 0 } });
      subText.position.set(labelX, rowCy - (rowHs[i] ?? labelSize0) / 2 + labelFit * 1.08);
      subText.alpha = 0;
      root.addChild(subText);
      timeline.to(subText, { prop: "alpha", from: 0, to: 1, start: start + 0.14, duration: 0.4, ease: outQuad });
    }
  });

  return { timeline, duration: 4.4 };
}

export const ingredients: TemplateDefinition = {
  id: "ingredients",
  name: "Ingredients",
  tagline: "A product with a what's-inside list of labeled ingredient dots.",
  category: "product",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "4:5",
  loopable: false,
  posterTime: 3.0,
  fontRoles: { product: "display" },
  palettes: PALETTES,
  fields: [
    { key: "image", type: "image", label: "Product image", default: "", optional: true, help: "Replaces the silhouette; a transparent PNG works best." },
    { key: "product", type: "text", label: "Product", default: "Aero Serum", maxLength: 26, shrinkToFit: true },
    { key: "heading", type: "text", label: "Heading", default: "What's inside", maxLength: 22, shrinkToFit: true },
    {
      key: "items",
      type: "textlist",
      label: "Ingredients",
      default: DEFAULT_ITEMS,
      minItems: 3,
      maxItems: 4,
      maxLength: 26,
      help: 'One per line as "name|note", e.g. "Aloe Vera|Soothes".',
    },
    { key: "showSpine", type: "toggle", label: "Connector spine", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
