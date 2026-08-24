import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  outQuint,
  spring,
  makeOutBack,
  safeRect,
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

// A subscription box: the lid lifts and item chips fan out, over a $X/mo price.
const PALETTES: Palette[] = [
  { id: "kraft", name: "Kraft", colors: { background: "#F4F2EC", box: "#E8E2D6", boxDark: "#CFC7B6", chipBg: "#FFFFFF", accent: "#C2380F", textColor: "#14140F", onAccent: "#FFFFFF" } },
  { id: "violet", name: "Violet", colors: { background: "#F2EEFB", box: "#E4DCF5", boxDark: "#CDC0EC", chipBg: "#FFFFFF", accent: "#6D3BEA", textColor: "#180F2E", onAccent: "#FFFFFF" } },
  { id: "splash-blue", name: "Splash blue", colors: { background: "#E9F1FC", box: "#D6E2F1", boxDark: "#BBD0EA", chipBg: "#FFFFFF", accent: "#1750B5", textColor: "#0B1A2E", onAccent: "#FFFFFF" } },
  { id: "ink-lime", name: "Ink lime", colors: { background: "#15171C", box: "#2A2F38", boxDark: "#1C2027", chipBg: "#2A2F38", accent: "#C7F24A", textColor: "#FFFFFF", onAccent: "#14161A" } },
];

const DEFAULT_ITEMS = ["Coffee", "Notebook", "Socks", "Snacks"];

function resolveItems(values: Values): string[] {
  return asList(values.items, DEFAULT_ITEMS).slice(0, 4);
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F4F2EC"));
  const boxColor = pc("box", "#E8E2D6");
  const boxDark = pc("boxDark", "#CFC7B6");
  const chipBg = pc("chipBg", "#FFFFFF");
  const accent = str(values.accent, pc("accent", "#C2380F"));
  const textColor = str(values.textColor, pc("textColor", "#14140F"));
  const onAccent = pc("onAccent", "#FFFFFF");

  const boxName = str(values.boxName, "The Monthly");
  const priceRaw = str(values.price, "$29");
  const items = resolveItems(values);
  const showSparkle = values.showSparkle !== false;

  const W = size.width;
  const H = size.height;
  const minDim = Math.min(W, H);
  const zone = safeRect(ctx.aspect);
  const cx = zone.x + zone.width / 2;

  const bgRect = new Graphics().rect(0, 0, W, H).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();
  const n = items.length;

  // --- Metrics + centered vertical stack ---
  const boxW = minDim * 0.36;
  const boxH = minDim * 0.3;
  const chipH = minDim * 0.088;
  const chipGap = minDim * 0.022;
  const nameSize0 = Math.round(minDim * 0.058);
  const priceSize = Math.round(minDim * 0.075);
  const moSize = Math.round(priceSize * 0.42);

  const nameSize = fitSize(fonts, boxName, "display", 700, nameSize0, zone.width * 0.9);
  const nameH = nameSize * 1.12;
  const priceH = priceSize * 1.1;
  const gapChipsBox = minDim * 0.055;
  const gapBoxName = minDim * 0.06;
  const gapNamePrice = minDim * 0.02;

  const stackH = chipH + gapChipsBox + boxH + gapBoxName + nameH + gapNamePrice + priceH;
  const top = zone.y + (zone.height - stackH) / 2;

  const chipsCy = top + chipH / 2;
  const boxCy = top + chipH + gapChipsBox + boxH / 2;
  const nameCy = boxCy + boxH / 2 + gapBoxName + nameH / 2;
  const priceCy = nameCy + nameH / 2 + gapNamePrice + priceH / 2;
  const openY = boxCy - boxH * 0.42;

  // --- Box back interior ---
  const r = boxW * 0.07;
  const back = new Container();
  back.position.set(cx, boxCy);
  back.addChild(new Graphics().roundRect(-boxW / 2, -boxH / 2, boxW, boxH, r).fill(boxDark));
  back.alpha = 0;
  root.addChild(back);

  // --- Chips (start hidden in the box, fan up to a centered row) ---
  const chipWs = items.map((label) => {
    const s = fitSize(fonts, label, "display", 700, Math.round(chipH * 0.34), minDim * 0.24);
    const w = fonts.measure(label, { family: fonts.family("display"), weight: 700, size: s });
    return { label, size: s, w: Math.min(minDim * 0.3, w + chipH * 0.7) };
  });
  const rowW = chipWs.reduce((a, c) => a + c.w, 0) + (n - 1) * chipGap;
  const scaleRow = rowW > zone.width ? zone.width / rowW : 1;
  let cursor = cx - (rowW * scaleRow) / 2;
  const chipNodes: Container[] = [];
  chipWs.forEach((c, i) => {
    const cw = c.w * scaleRow;
    const slotX = cursor + cw / 2;
    cursor += cw + chipGap * scaleRow;

    const chip = new Container();
    chip.addChild(new Graphics().roundRect(-cw / 2, -chipH / 2, cw, chipH, chipH * 0.32).fill(chipBg));
    chip.addChild(new Graphics().circle(-cw / 2 + chipH * 0.4, 0, chipH * 0.16).fill(accent));
    const lbl = makeText(fonts, { text: c.label, role: "display", weight: 700, size: c.size, color: textColor, anchor: { x: 0, y: 0.5 } });
    lbl.position.set(-cw / 2 + chipH * 0.66, 0);
    chip.addChild(lbl);
    chip.position.set(cx, openY);
    chip.alpha = 0;
    chip.scale.set(0.5);
    root.addChild(chip);
    chipNodes.push(chip);

    const start = 1.35 + i * 0.12;
    timeline
      .to(chip, { prop: "alpha", from: 0, to: 1, start, duration: 0.3, ease: outQuad })
      .to(chip, { prop: "x", from: cx, to: slotX, start, duration: 0.7, ease: spring(0.55) })
      .to(chip, { prop: "y", from: openY, to: chipsCy, start, duration: 0.7, ease: spring(0.55) })
      .to(chip, { prop: "scale.x", from: 0.5, to: 1, start, duration: 0.7, ease: spring(0.55) })
      .to(chip, { prop: "scale.y", from: 0.5, to: 1, start, duration: 0.7, ease: spring(0.55) });
  });

  // --- Box front face + accent band ---
  const front = new Container();
  front.position.set(cx, boxCy);
  const frontTop = -boxH * 0.16;
  const frontH = boxH * 0.66;
  front.addChild(new Graphics().roundRect(-boxW / 2, frontTop, boxW, frontH, r).fill(boxColor));
  const bandH = frontH * 0.26;
  front.addChild(new Graphics().rect(-boxW / 2, frontTop + frontH * 0.42, boxW, bandH).fill(accent));
  front.addChild(new Graphics().circle(0, frontTop + frontH * 0.42 + bandH / 2, bandH * 0.3).fill({ color: onAccent, alpha: 0.9 }));
  front.alpha = 0;
  root.addChild(front);

  // --- Lid ---
  const lidW = boxW * 1.08;
  const lidH = boxH * 0.2;
  const lidCy = boxCy - boxH / 2 + lidH * 0.1;
  const lid = new Container();
  lid.position.set(cx, lidCy);
  lid.addChild(new Graphics().roundRect(-lidW / 2, -lidH / 2, lidW, lidH, lidH * 0.35).fill(accent));
  lid.addChild(new Graphics().roundRect(-lidW / 2 + lidW * 0.04, -lidH / 2 + lidH * 0.12, lidW * 0.92, lidH * 0.28, lidH * 0.14).fill({ color: onAccent, alpha: 0.22 }));
  lid.alpha = 0;
  root.addChild(lid);

  const off = minDim * 0.06;
  for (const part of [back, front, lid]) {
    const fy = part === lid ? lidCy : boxCy;
    timeline
      .to(part, { prop: "alpha", from: 0, to: 1, start: 0.2, duration: 0.4, ease: outQuad })
      .to(part, { prop: "y", from: fy + off, to: fy, start: 0.2, duration: 0.6, ease: outExpo });
  }

  // Lid lifts + tilts off.
  timeline
    .to(lid, { prop: "y", from: lidCy, to: lidCy - boxH * 1.05, start: 1.0, duration: 0.8, ease: outExpo })
    .to(lid, { prop: "x", from: cx, to: cx + boxW * 0.16, start: 1.0, duration: 0.8, ease: outQuad })
    .to(lid, { prop: "rotation", from: 0, to: -0.42, start: 1.0, duration: 0.75, ease: outQuint })
    .to(lid, { prop: "alpha", from: 1, to: 0, start: 1.55, duration: 0.45, ease: outQuad });

  // Burst ring at the opening.
  if (showSparkle) {
    const ring = new Graphics().circle(0, 0, boxW * 0.42).stroke({ color: accent, width: Math.max(3, minDim * 0.011) });
    ring.position.set(cx, openY);
    ring.scale.set(0.4);
    ring.alpha = 0;
    root.addChild(ring);
    timeline
      .to(ring, { prop: "scale.x", from: 0.4, to: 1.7, start: 1.3, duration: 0.7, ease: outExpo })
      .to(ring, { prop: "scale.y", from: 0.4, to: 1.7, start: 1.3, duration: 0.7, ease: outExpo })
      .to(ring, { prop: "alpha", from: 0.85, to: 0, start: 1.3, duration: 0.7, ease: outQuad });
  }

  // --- Box name ---
  const nameText = makeText(fonts, { text: boxName, role: "display", weight: 700, size: nameSize, color: textColor, anchor: 0.5, align: "center" });
  nameText.position.set(cx, nameCy);
  nameText.alpha = 0;
  root.addChild(nameText);
  timeline
    .to(nameText, { prop: "alpha", from: 0, to: 1, start: 2.15, duration: 0.4, ease: outQuad })
    .to(nameText, { prop: "y", from: nameCy + minDim * 0.02, to: nameCy, start: 2.15, duration: 0.55, ease: outExpo });

  // --- Price "$X/mo" (big price + small suffix, centered together) ---
  const priceText = makeText(fonts, { text: priceRaw, role: "display", weight: 700, size: priceSize, color: accent, anchor: { x: 0, y: 0.5 } });
  const moText = makeText(fonts, { text: "/mo", role: "body", weight: 700, size: moSize, color: textColor, anchor: { x: 0, y: 0.5 } });
  const gapMo = minDim * 0.008;
  const combinedW = priceText.width + gapMo + moText.width;
  const pStartX = cx - combinedW / 2;
  const priceGroup = new Container();
  priceText.position.set(pStartX, priceCy);
  moText.position.set(pStartX + priceText.width + gapMo, priceCy);
  moText.alpha = 0.82;
  root.addChild(priceGroup);
  priceGroup.addChild(priceText, moText);
  priceGroup.alpha = 0;
  priceGroup.scale.set(0.8);
  priceGroup.pivot.set(cx, priceCy);
  priceGroup.position.set(cx, priceCy);
  timeline
    .to(priceGroup, { prop: "alpha", from: 0, to: 1, start: 2.4, duration: 0.35, ease: outQuad })
    .to(priceGroup, { prop: "scale.x", from: 0.8, to: 1, start: 2.4, duration: 0.55, ease: makeOutBack(1.9) })
    .to(priceGroup, { prop: "scale.y", from: 0.8, to: 1, start: 2.4, duration: 0.55, ease: makeOutBack(1.9) });

  return { timeline, duration: 4.6 };
}

export const subscriptionBox: TemplateDefinition = {
  id: "subscription-box",
  name: "Subscription Box",
  tagline: "A box lid lifts and item chips fan out over a monthly price.",
  category: "product",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 3.2,
  fontRoles: { boxName: "display" },
  palettes: PALETTES,
  fields: [
    { key: "boxName", type: "text", label: "Box name", default: "The Monthly", maxLength: 24, shrinkToFit: true },
    { key: "price", type: "text", label: "Price", default: "$29", maxLength: 10 },
    {
      key: "items",
      type: "textlist",
      label: "Inside the box",
      default: DEFAULT_ITEMS,
      minItems: 3,
      maxItems: 4,
      maxLength: 16,
      help: "One item per line — 3 or 4 short labels.",
    },
    { key: "showSparkle", type: "toggle", label: "Reveal burst", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
