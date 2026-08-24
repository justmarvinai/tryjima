import { Container, Graphics, Sprite, type Texture } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  inOutQuad,
  outExpo,
  outQuad,
  outQuint,
  safeRect,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { radialGlowTexture } from "../shared/glow";

// Studio Pedestal — a product stands on a lit plinth in front of a soft
// cyclorama while the whole scene creeps forward in one slow, continuous
// push-in. The camera move is the motion; everything else just settles into it.

const DURATION = 4.8;
/** Final camera scale. The layout is authored in the pre-image of the safe rect. */
const PUSH = 1.06;

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;

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

// Considered neutrals with one confident accent — premium studio, never a
// discount blowout. `plinth`/`floor` are their own keys so the plinth survives
// a recolored background.
const PALETTES: Palette[] = [
  {
    id: "studio-linen",
    name: "Studio linen",
    colors: {
      background: "#F5F2ED",
      floor: "#EFEAE2",
      plinth: "#E3DCD0",
      plinthTop: "#FFFFFF",
      glow: "#FFFFFF",
      textColor: "#1B1815",
      muted: "#67615B",
      accent: "#A8492A",
    },
  },
  {
    id: "cool-gallery",
    name: "Cool gallery",
    colors: {
      background: "#EEF1F4",
      floor: "#E7EBF0",
      plinth: "#DAE0E8",
      plinthTop: "#FFFFFF",
      glow: "#FFFFFF",
      textColor: "#141920",
      muted: "#59636E",
      accent: "#2F5EA8",
    },
  },
  {
    id: "sage-atelier",
    name: "Sage atelier",
    colors: {
      background: "#E8EDE7",
      floor: "#E1E7DF",
      plinth: "#D5DED2",
      plinthTop: "#FFFFFF",
      glow: "#FFFFFF",
      textColor: "#151F19",
      muted: "#546258",
      accent: "#2F6B4E",
    },
  },
  {
    id: "noir-studio",
    name: "Noir studio",
    colors: {
      background: "#131417",
      floor: "#0E0F12",
      plinth: "#202329",
      plinthTop: "#33373F",
      glow: "#4A505C",
      textColor: "#F1F2F4",
      muted: "#9AA0A8",
      accent: "#C8A96A",
    },
  },
];

/**
 * A clean bottle silhouette standing on y = 0 (its base), `h` tall and `w` wide.
 * Used when no product image is supplied.
 */
function bottleSilhouette(w: number, h: number, accent: string): Container {
  const c = new Container();
  const bodyH = h * 0.6;
  const shoulderH = h * 0.14;
  const neckH = h * 0.14;
  const capH = h * 0.12;
  const neckW = w * 0.3;
  const capW = w * 0.4;
  const bodyTop = -bodyH;
  const neckTop = bodyTop - shoulderH - neckH;

  const g = new Graphics();
  g.roundRect(-w / 2, bodyTop, w, bodyH, w * 0.16).fill(accent);
  // The shoulder starts below the body's corner radius so it never spikes past
  // the silhouette.
  g.poly([
    -w * 0.5,
    bodyTop + w * 0.22,
    w * 0.5,
    bodyTop + w * 0.22,
    neckW / 2,
    bodyTop - shoulderH,
    -neckW / 2,
    bodyTop - shoulderH,
  ]).fill(accent);
  g.rect(-neckW / 2, neckTop, neckW, neckH + h * 0.012).fill(accent);
  g.roundRect(-capW / 2, neckTop - capH, capW, capH + h * 0.02, capW * 0.16).fill(accent);
  // Darken the cap so it reads as a separate machined part.
  g.roundRect(-capW / 2, neckTop - capH, capW, capH + h * 0.02, capW * 0.16).fill({ color: 0x000000, alpha: 0.22 });
  c.addChild(g);

  const detail = new Graphics();
  detail.rect(-w / 2, bodyTop + bodyH * 0.36, w, bodyH * 0.28).fill({ color: 0xffffff, alpha: 0.16 });
  detail
    .roundRect(-w * 0.34, bodyTop + bodyH * 0.2, w * 0.085, bodyH * 0.44, w * 0.043)
    .fill({ color: 0xffffff, alpha: 0.2 });
  const mask = new Graphics().roundRect(-w / 2, bodyTop, w, bodyH, w * 0.16).fill(0xffffff);
  c.addChild(detail, mask);
  detail.mask = mask;
  return c;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, images } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F5F2ED"));
  const floorCol = pc("floor", "#EFEAE2");
  const plinthCol = pc("plinth", "#E3DCD0");
  const plinthTopCol = pc("plinthTop", "#FFFFFF");
  const glowCol = pc("glow", "#FFFFFF");
  const textColor = str(values.textColor, pc("textColor", "#1B1815"));
  const muted = pc("muted", "#67615B");
  const accent = str(values.accent, pc("accent", "#A8492A"));

  const kicker = str(values.kicker, "New this season").toUpperCase();
  const product = str(values.product, "Aera Diffuser");
  const price = str(values.price, "$128");
  const hasPrice = price.length > 0;
  const showFloor = values.showFloor !== false;
  const showGlow = values.showGlow !== false;
  const showShadow = values.showShadow !== false;
  const showRule = values.showRule !== false && hasPrice;

  const W = size.width;
  const H = size.height;
  const minDim = Math.min(W, H);
  const wide = ctx.aspect === "16:9";
  const zone = safeRect(ctx.aspect);

  // Author inside the pre-image of the safe rect under the push, so the fully
  // pushed-in frame still respects the platform safe zone.
  const inv = 1 / PUSH;
  const fcx = W / 2;
  const fcy = H / 2;
  const L = {
    x: fcx - (fcx - zone.x) * inv,
    y: fcy - (fcy - zone.y) * inv,
    width: zone.width * inv,
    height: zone.height * inv,
  };

  const bgRect = new Graphics().rect(0, 0, W, H).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- The camera. One long, eased-in-and-out push over the whole shot. ---
  const stage = new Container();
  stage.position.set(fcx, fcy);
  stage.pivot.set(fcx, fcy);
  root.addChild(stage);
  timeline
    .to(stage, { prop: "scale.x", from: 1, to: PUSH, start: 0, duration: DURATION, ease: inOutQuad })
    .to(stage, { prop: "scale.y", from: 1, to: PUSH, start: 0, duration: DURATION, ease: inOutQuad });

  // --- Metrics ---
  const boxH = wide
    ? Math.min(L.height * 0.58, minDim * 0.46)
    : Math.min(L.height * 0.34, minDim * 0.44);
  const boxW = boxH * 0.8;
  const plinthRx = boxW * 0.62;
  const plinthH = boxH * 0.3;
  const capRy = plinthRx * 0.16;

  const textW = wide ? L.width * 0.38 : L.width * 0.92;
  const kickSize = fitSize(fonts, kicker, "body", 600, Math.round(minDim * 0.024), textW);
  const nameSize = fitSize(fonts, product, "display", 700, Math.round(minDim * 0.058), textW);
  const priceSize = fitSize(fonts, price, "display", 600, Math.round(minDim * 0.036), textW * 0.8);
  const kickH = kickSize * 1.7;
  const nameH = nameSize * 1.25;
  const priceH = priceSize * 1.45;
  const ruleGap = minDim * 0.028;
  const textH = kickH + nameH + (hasPrice ? ruleGap * 2 + priceH : 0);

  let prodCx: number;
  let plinthTopY: number;
  let textAnchorX: number;
  let textTop: number;
  if (wide) {
    prodCx = L.x + L.width * 0.29;
    const blockH = boxH + plinthH + capRy;
    plinthTopY = L.y + (L.height - blockH) / 2 + boxH;
    textAnchorX = L.x + L.width * 0.565;
    textTop = L.y + (L.height - textH) / 2;
  } else {
    prodCx = L.x + L.width / 2;
    const gapCT = minDim * 0.075;
    const blockH = boxH + plinthH + capRy + gapCT + textH;
    const top = L.y + (L.height - blockH) / 2;
    plinthTopY = top + boxH;
    textAnchorX = prodCx;
    textTop = top + boxH + plinthH + capRy + gapCT;
  }
  const floorY = plinthTopY - boxH * 0.22;

  // --- Cyclorama floor (drawn well past the frame so the push never reveals an edge) ---
  if (showFloor) {
    const floor = new Graphics()
      .rect(-W * 0.25, floorY, W * 1.5, H * 1.5 - floorY)
      .fill(floorCol);
    floor.alpha = 0;
    stage.addChild(floor);
    timeline.to(floor, { prop: "alpha", from: 0, to: 1, start: 0, duration: 0.85, ease: outQuad });
  }

  // --- Soft key light behind the product ---
  if (showGlow) {
    const glowWrap = new Container();
    glowWrap.position.set(prodCx, plinthTopY - boxH * 0.52);
    glowWrap.alpha = 0;
    glowWrap.scale.set(0.82);
    const glow = new Sprite(radialGlowTexture());
    glow.anchor.set(0.5);
    glow.tint = glowCol;
    glow.width = glow.height = Math.max(boxW, boxH) * 2.4;
    glowWrap.addChild(glow);
    stage.addChild(glowWrap);
    timeline
      .to(glowWrap, { prop: "alpha", from: 0, to: 0.5, start: 0.1, duration: 1.3, ease: outQuad })
      .to(glowWrap, { prop: "scale.x", from: 0.82, to: 1, start: 0.1, duration: 1.7, ease: outExpo })
      .to(glowWrap, { prop: "scale.y", from: 0.82, to: 1, start: 0.1, duration: 1.7, ease: outExpo });
  }

  // --- Plinth (lit elliptical top over a straight body) ---
  const plinth = new Container();
  plinth.position.set(prodCx, plinthTopY);
  const pg = new Graphics();
  pg.ellipse(0, plinthH, plinthRx, capRy).fill(plinthCol);
  pg.rect(-plinthRx, 0, plinthRx * 2, plinthH).fill(plinthCol);
  pg.ellipse(0, 0, plinthRx, capRy).fill(plinthTopCol);
  plinth.addChild(pg);
  plinth.alpha = 0;
  stage.addChild(plinth);
  timeline
    .to(plinth, { prop: "alpha", from: 0, to: 1, start: 0.08, duration: 0.65, ease: outQuad })
    .to(plinth, { prop: "y", from: plinthTopY + minDim * 0.03, to: plinthTopY, start: 0.08, duration: 1.15, ease: outExpo });

  // --- Contact shadow (soft, sits on the plinth top under the product) ---
  if (showShadow) {
    const shWrap = new Container();
    shWrap.position.set(prodCx, plinthTopY + capRy * 0.2);
    shWrap.alpha = 0;
    const sh = new Sprite(radialGlowTexture());
    sh.anchor.set(0.5);
    sh.tint = "#000000";
    sh.width = boxW * 1.25;
    sh.height = capRy * 2.4;
    shWrap.addChild(sh);
    stage.addChild(shWrap);
    timeline.to(shWrap, { prop: "alpha", from: 0, to: 0.22, start: 0.55, duration: 0.95, ease: outQuad });
  }

  // --- Product ---
  const prod = new Container();
  prod.position.set(prodCx, plinthTopY);
  const inner = new Container();
  prod.addChild(inner);
  const tex: Texture | null = images.image ?? null;
  if (tex) {
    const s = new Sprite(tex);
    s.anchor.set(0.5, 1);
    s.scale.set(Math.min(boxW / tex.width, boxH / tex.height));
    inner.addChild(s);
  } else {
    inner.addChild(bottleSilhouette(boxW, boxH, accent));
  }
  prod.alpha = 0;
  stage.addChild(prod);
  timeline
    .to(prod, { prop: "alpha", from: 0, to: 1, start: 0.42, duration: 0.75, ease: outQuad })
    .to(prod, { prop: "y", from: plinthTopY + minDim * 0.045, to: plinthTopY, start: 0.42, duration: 1.4, ease: outExpo })
    .to(inner, { prop: "scale.x", from: 0.955, to: 1, start: 0.42, duration: 1.45, ease: outExpo })
    .to(inner, { prop: "scale.y", from: 0.955, to: 1, start: 0.42, duration: 1.45, ease: outExpo });

  // --- Type ---
  const anchorX = wide ? 0 : 0.5;
  const alignMode = wide ? "left" : "center";

  const kickY = textTop + kickH * 0.5;
  const kickText = makeText(fonts, {
    text: kicker,
    role: "body",
    weight: 600,
    size: kickSize,
    color: muted,
    anchor: { x: anchorX, y: 0.5 },
    align: alignMode,
    letterSpacing: kickSize * 0.14,
  });
  kickText.position.set(textAnchorX, kickY);
  kickText.alpha = 0;
  stage.addChild(kickText);
  timeline
    .to(kickText, { prop: "alpha", from: 0, to: 1, start: 0.95, duration: 0.6, ease: outQuad })
    .to(kickText, { prop: "y", from: kickY + minDim * 0.014, to: kickY, start: 0.95, duration: 0.85, ease: outQuint });

  const nameY = textTop + kickH + nameH * 0.5;
  const nameText = makeText(fonts, {
    text: product,
    role: "display",
    weight: 700,
    size: nameSize,
    color: textColor,
    anchor: { x: anchorX, y: 0.5 },
    align: alignMode,
    letterSpacing: -nameSize * 0.018,
  });
  nameText.position.set(textAnchorX, nameY);
  nameText.alpha = 0;
  stage.addChild(nameText);
  timeline
    .to(nameText, { prop: "alpha", from: 0, to: 1, start: 1.15, duration: 0.65, ease: outQuad })
    .to(nameText, { prop: "y", from: nameY + minDim * 0.022, to: nameY, start: 1.15, duration: 1.0, ease: outExpo });

  if (showRule) {
    const ruleW = wide ? textW * 0.52 : Math.min(textW * 0.34, minDim * 0.18);
    const ruleY = textTop + kickH + nameH + ruleGap;
    const rg = new Graphics()
      .rect(wide ? 0 : -ruleW / 2, 0, ruleW, Math.max(1.5, minDim * 0.0018))
      .fill({ color: muted, alpha: 0.45 });
    rg.position.set(textAnchorX, ruleY);
    rg.alpha = 0;
    stage.addChild(rg);
    timeline
      .to(rg, { prop: "alpha", from: 0, to: 1, start: 1.5, duration: 0.5, ease: outQuad })
      .to(rg, { prop: "scale.x", from: 0, to: 1, start: 1.5, duration: 1.05, ease: outExpo });
  }

  if (hasPrice) {
    const priceY = textTop + kickH + nameH + ruleGap * 2 + priceH * 0.5;
    const priceText = makeText(fonts, {
      text: price,
      role: "display",
      weight: 600,
      size: priceSize,
      color: accent,
      anchor: { x: anchorX, y: 0.5 },
      align: alignMode,
    });
    priceText.position.set(textAnchorX, priceY);
    priceText.alpha = 0;
    stage.addChild(priceText);
    timeline
      .to(priceText, { prop: "alpha", from: 0, to: 1, start: 1.72, duration: 0.65, ease: outQuad })
      .to(priceText, { prop: "y", from: priceY + minDim * 0.018, to: priceY, start: 1.72, duration: 0.95, ease: outExpo });
  }

  return { timeline, duration: DURATION };
}

export const studioPedestal: TemplateDefinition = {
  id: "studio-pedestal",
  name: "Studio Pedestal",
  tagline: "A product rests on a lit plinth while the camera drifts slowly closer.",
  category: "product",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "4:5",
  loopable: false,
  posterTime: 3.6,
  fontRoles: { product: "display", price: "display", kicker: "body" },
  palettes: PALETTES,
  fields: [
    {
      key: "image",
      type: "image",
      label: "Product image",
      default: "",
      optional: true,
      help: "A cut-out product on a plain background works best — it stands on the plinth.",
    },
    { key: "kicker", type: "text", label: "Eyebrow", default: "New this season", maxLength: 28, shrinkToFit: true },
    { key: "product", type: "text", label: "Product", default: "Aera Diffuser", maxLength: 28, shrinkToFit: true },
    { key: "price", type: "text", label: "Price", default: "$128", maxLength: 14, optional: true, shrinkToFit: true },
    { key: "showFloor", type: "toggle", label: "Studio horizon", default: true },
    { key: "showGlow", type: "toggle", label: "Key light", default: true },
    { key: "showShadow", type: "toggle", label: "Contact shadow", default: true },
    { key: "showRule", type: "toggle", label: "Hairline rule", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
