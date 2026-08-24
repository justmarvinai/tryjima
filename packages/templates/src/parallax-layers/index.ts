import { Container, Graphics, Sprite, type Texture } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outQuint,
  outExpo,
  inOutQuart,
  inOutQuad,
  safeRect,
  type Aspect,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";

const DEG = Math.PI / 180;
const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;

/** Largest size <= size at which `text` fits maxWidth (crisp, single-line). */
function fitSize(
  fonts: FontRegistry,
  text: string,
  role: FontRole,
  weight: number,
  size: number,
  maxWidth: number,
): number {
  if (text.length === 0 || maxWidth <= 0) return size;
  const w = fonts.measure(text, { family: fonts.family(role), weight, size });
  return w > maxWidth ? Math.max(11, Math.floor((size * maxWidth) / w)) : size;
}

// A camera-pan story: three rounded cards at different depths slide in at
// different speeds (near moves fastest), settle into a composed lockup, and the
// headline lands beside it. Depth comes from size + speed only — no blur.
const PALETTES: Palette[] = [
  {
    id: "porcelain",
    name: "Porcelain",
    colors: {
      background: "#F5F2EC", textColor: "#201D18", accent: "#E8593F", layerBack: "#E5DFD3",
      layerMid: "#D5CCBB", cardColor: "#FFFFFF", muted: "#A89F90",
    },
  },
  {
    id: "lagoon",
    name: "Lagoon",
    colors: {
      background: "#E7F1F4", textColor: "#0E2B33", accent: "#0E9BAA", layerBack: "#D2E6EA",
      layerMid: "#BCDAE0", cardColor: "#FFFFFF", muted: "#84ACB5",
    },
  },
  {
    id: "lilac",
    name: "Lilac",
    colors: {
      background: "#F2EEFB", textColor: "#251A47", accent: "#7C5CFF", layerBack: "#E3DCF6",
      layerMid: "#D1C6EE", cardColor: "#FFFFFF", muted: "#A192CE",
    },
  },
  {
    id: "noir",
    name: "Noir",
    colors: {
      background: "#14131A", textColor: "#F5F3FA", accent: "#FFB13C", layerBack: "#232230",
      layerMid: "#2F2D40", cardColor: "#3A3750", muted: "#8C8798",
    },
  },
];

/** A small "picture" glyph for the feature card's drawn fallback. */
function imageGlyph(s: number, color: string): Graphics {
  const g = new Graphics();
  g.circle(-0.18 * s, -0.14 * s, 0.11 * s).fill(color);
  g.poly([-0.46 * s, 0.36 * s, -0.12 * s, -0.06 * s, 0.06 * s, 0.14 * s, 0.3 * s, -0.12 * s, 0.46 * s, 0.36 * s]).fill(color);
  return g;
}

interface Cfg {
  sceneCxF: number; // scene center x as a fraction of safe width (from safe left)
  sceneCyF: number; // scene center y as a fraction of safe height (from safe top)
  sceneSF: number; // scene size as a fraction of min(safe w, safe h)
  textBeside: boolean; // 16:9 puts the headline in a left column
}
const CFG: Record<Aspect, Cfg> = {
  "16:9": { sceneCxF: 0.71, sceneCyF: 0.5, sceneSF: 0.92, textBeside: true },
  "1:1": { sceneCxF: 0.5, sceneCyF: 0.34, sceneSF: 0.62, textBeside: false },
  "4:5": { sceneCxF: 0.5, sceneCyF: 0.33, sceneSF: 0.58, textBeside: false },
  "9:16": { sceneCxF: 0.5, sceneCyF: 0.3, sceneSF: 0.52, textBeside: false },
};

const PAN_START = 0.15;
const PAN_DUR = 1.85;
const TEXT_START = 2.15;
const DURATION = 4.0;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, images } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F5F2EC"));
  const textColor = str(values.textColor, pc("textColor", "#201D18"));
  const accent = str(values.accent, pc("accent", "#E8593F"));
  const layerBack = pc("layerBack", "#E5DFD3");
  const layerMid = pc("layerMid", "#D5CCBB");
  const cardColor = pc("cardColor", "#FFFFFF");
  const muted = pc("muted", "#A89F90");

  const title = str(values.title, "Depth, in motion");
  const subtitle = str(values.subtitle, "Every layer moves at its own speed.");
  const showShapes = on(values.showShapes);
  const showRule = on(values.showRule);
  const photo: Texture | null = images.image ?? null;

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const cfg = CFG[ctx.aspect];
  const safe = safeRect(ctx.aspect);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Scene: layered cards that pan at depth-dependent speeds ---
  const sceneCx = safe.x + safe.width * cfg.sceneCxF;
  const sceneCy = safe.y + safe.height * cfg.sceneCyF;
  const S = Math.min(safe.width, safe.height) * cfg.sceneSF;

  const scene = new Container();
  scene.position.set(sceneCx, sceneCy);
  scene.scale.set(1.05);
  root.addChild(scene);
  timeline
    .to(scene, { prop: "scale.x", from: 1.05, to: 1, start: PAN_START, duration: PAN_DUR, ease: inOutQuad })
    .to(scene, { prop: "scale.y", from: 1.05, to: 1, start: PAN_START, duration: PAN_DUR, ease: inOutQuad });

  interface LayerSpec {
    node: Container;
    finalX: number;
    travel: number; // px the layer covers during the pan (near layers travel more)
    fadeAt: number;
  }
  const layers: LayerSpec[] = [];
  const addLayer = (node: Container, finalX: number, finalY: number, travelF: number, fadeAt: number): void => {
    node.position.set(finalX + w * travelF, finalY);
    node.alpha = 0;
    scene.addChild(node);
    layers.push({ node, finalX, travel: w * travelF, fadeAt });
  };

  // Back layer — the largest, slowest card.
  const backS = S * 0.66;
  const back = new Container();
  back.addChild(new Graphics().roundRect(-backS / 2, -backS / 2, backS, backS, backS * 0.14).fill(layerBack));
  back.rotation = -4 * DEG;
  addLayer(back, -S * 0.14, -S * 0.1, 0.05, PAN_START);

  // Mid layer.
  const midS = S * 0.5;
  const mid = new Container();
  mid.addChild(new Graphics().roundRect(-midS / 2, -midS / 2, midS, midS, midS * 0.16).fill(layerMid));
  mid.addChild(new Graphics().circle(midS * 0.16, -midS * 0.14, midS * 0.2).fill({ color: cardColor, alpha: 0.5 }));
  mid.rotation = 3 * DEG;
  addLayer(mid, S * 0.19, 0, 0.11, PAN_START + 0.1);

  // Front feature card — fastest, carries the photo (or a drawn mini-scene).
  const cardW = S * 0.5;
  const cardH = S * 0.62;
  const cardR = cardW * 0.1;
  const front = new Container();
  front.addChild(new Graphics().roundRect(-cardW / 2, -cardH / 2 + cardH * 0.04, cardW, cardH, cardR).fill({ color: "#000000", alpha: 0.16 }));
  front.addChild(new Graphics().roundRect(-cardW / 2, -cardH / 2, cardW, cardH, cardR).fill(cardColor));
  const inset = cardW * 0.06;
  const mediaW = cardW - inset * 2;
  const mediaH = cardH - inset * 2;
  const holder = new Container();
  const mask = new Graphics().roundRect(-mediaW / 2, -mediaH / 2, mediaW, mediaH, cardR * 0.7).fill(0xffffff);
  if (photo) {
    const sprite = new Sprite(photo);
    sprite.anchor.set(0.5);
    const cover = Math.max(mediaW / photo.width, mediaH / photo.height);
    sprite.scale.set(cover);
    holder.addChild(sprite);
  } else {
    // Drawn fallback: a tiny layered landscape (an echo of the parallax story).
    holder.addChild(new Graphics().rect(-mediaW / 2, -mediaH / 2, mediaW, mediaH).fill({ color: accent, alpha: 0.14 }));
    holder.addChild(new Graphics().circle(mediaW * 0.22, -mediaH * 0.22, mediaW * 0.14).fill(accent));
    holder.addChild(new Graphics().ellipse(-mediaW * 0.3, mediaH * 0.52, mediaW * 0.6, mediaH * 0.3).fill({ color: muted, alpha: 0.55 }));
    holder.addChild(new Graphics().ellipse(mediaW * 0.34, mediaH * 0.62, mediaW * 0.7, mediaH * 0.34).fill({ color: accent, alpha: 0.5 }));
    const glyph = imageGlyph(mediaW * 0.3, cardColor);
    glyph.position.set(-mediaW * 0.02, -mediaH * 0.02);
    holder.addChild(glyph);
  }
  holder.mask = mask;
  front.addChild(holder, mask);
  front.rotation = -2 * DEG;
  addLayer(front, -S * 0.03, S * 0.17, 0.19, PAN_START + 0.2);

  // Floating accent shapes — the nearest "layer", so it travels the farthest.
  if (showShapes) {
    const deco = new Container();
    const ring = new Graphics().circle(0, 0, S * 0.075).stroke({ color: accent, width: Math.max(3, S * 0.02) });
    ring.position.set(S * 0.34, -S * 0.34);
    const dot = new Graphics().circle(0, 0, S * 0.035).fill(accent);
    dot.position.set(-S * 0.4, S * 0.34);
    const pill = new Graphics().roundRect(-S * 0.07, -S * 0.024, S * 0.14, S * 0.048, S * 0.024).fill({ color: muted, alpha: 0.85 });
    pill.position.set(-S * 0.38, -S * 0.3);
    pill.rotation = -12 * DEG;
    deco.addChild(ring, dot, pill);
    addLayer(deco, 0, 0, 0.27, PAN_START + 0.55);
  }

  for (const layer of layers) {
    timeline
      .to(layer.node, { prop: "x", from: layer.finalX + layer.travel, to: layer.finalX, start: PAN_START, duration: PAN_DUR, ease: inOutQuart })
      .to(layer.node, { prop: "alpha", from: 0, to: 1, start: layer.fadeAt, duration: 0.5, ease: outQuad });
  }

  // --- Headline block ---
  const centered = !cfg.textBeside;
  const maxTextW = centered ? safe.width * 0.88 : safe.width * 0.36;
  const titleSize = fitSize(fonts, title, "display", 700, Math.round(minDim * (centered ? 0.055 : 0.052)), maxTextW);
  const subSize = fitSize(fonts, subtitle, "body", 500, Math.round(minDim * 0.026), maxTextW);
  const ruleW = minDim * 0.055;
  const ruleH = Math.max(4, minDim * 0.008);

  const textX = centered ? w / 2 : safe.x + safe.width * 0.02;
  const anchorX = centered ? 0.5 : 0;
  let cursorY: number;
  if (centered) {
    const sceneBottom = sceneCy + S * 0.52;
    cursorY = sceneBottom + safe.height * 0.075;
  } else {
    const blockH = (showRule ? ruleH + minDim * 0.03 : 0) + titleSize + minDim * 0.028 + subSize;
    cursorY = safe.y + safe.height * 0.5 - blockH / 2;
  }

  if (showRule) {
    const rule = new Graphics().roundRect(0, 0, ruleW, ruleH, ruleH / 2).fill(accent);
    rule.position.set(centered ? w / 2 - ruleW / 2 : textX, cursorY);
    rule.scale.x = 0;
    root.addChild(rule);
    timeline.to(rule, { prop: "scale.x", from: 0, to: 1, start: TEXT_START - 0.15, duration: 0.5, ease: outExpo });
    cursorY += ruleH + minDim * 0.03;
  }

  const titleY = cursorY + titleSize * 0.55;
  const titleText = makeText(fonts, { text: title, role: "display", weight: 700, size: titleSize, color: textColor, anchor: { x: anchorX, y: 0.5 }, align: centered ? "center" : "left" });
  titleText.position.set(textX, titleY + 18);
  titleText.alpha = 0;
  root.addChild(titleText);
  timeline
    .to(titleText, { prop: "alpha", from: 0, to: 1, start: TEXT_START, duration: 0.45, ease: outQuad })
    .to(titleText, { prop: "y", from: titleY + 18, to: titleY, start: TEXT_START, duration: 0.6, ease: outQuint });

  if (subtitle.length > 0) {
    const subY = titleY + titleSize * 0.62 + minDim * 0.028 + subSize * 0.5;
    const subText = makeText(fonts, { text: subtitle, role: "body", weight: 500, size: subSize, color: textColor, anchor: { x: anchorX, y: 0.5 }, align: centered ? "center" : "left" });
    subText.position.set(textX, subY + 14);
    subText.alpha = 0;
    root.addChild(subText);
    timeline
      .to(subText, { prop: "alpha", from: 0, to: 0.8, start: TEXT_START + 0.2, duration: 0.45, ease: outQuad })
      .to(subText, { prop: "y", from: subY + 14, to: subY, start: TEXT_START + 0.2, duration: 0.55, ease: outQuint });
  }

  return { timeline, duration: DURATION };
}

export const parallaxLayers: TemplateDefinition = {
  id: "parallax-layers",
  name: "Parallax Layers",
  tagline: "Cards at different depths glide in at different speeds and lock up.",
  category: "showcase",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 3.3,
  fontRoles: { title: "display", subtitle: "body" },
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Headline", default: "Depth, in motion", maxLength: 30, shrinkToFit: true },
    { key: "subtitle", type: "text", label: "Subline", default: "Every layer moves at its own speed.", maxLength: 48, shrinkToFit: true },
    { key: "image", type: "image", label: "Feature image", default: "", optional: true, help: "Fills the front card; a drawn scene stands in when empty." },
    { key: "showShapes", type: "toggle", label: "Floating shapes", default: true },
    { key: "showRule", type: "toggle", label: "Accent rule", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
