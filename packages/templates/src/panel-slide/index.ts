import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outQuint,
  spring,
  safeRect,
  type Aspect,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;

function fitSize(fonts: FontRegistry, text: string, role: FontRole, weight: number, size: number, maxWidth: number): number {
  if (text.length === 0 || maxWidth <= 0) return size;
  const w = fonts.measure(text, { family: fonts.family(role), weight, size });
  return w > maxWidth ? Math.max(11, Math.floor((size * maxWidth) / w)) : size;
}

// Colored panels slide in from alternating sides to assemble a card, then a
// light title plate lands on top. The title always sits on the light plate
// (>= 4.5:1); the colored panels are the accent (in tonal bands), no text.
const PALETTES: Palette[] = [
  { id: "punch", name: "Punch", colors: { background: "#F5F6F8", textColor: "#15161C", accent: "#FF4D6D", cardBg: "#FFFFFF" } },
  { id: "marine", name: "Marine", colors: { background: "#EEF4FB", textColor: "#0C2140", accent: "#1E88E5", cardBg: "#FFFFFF" } },
  { id: "forest", name: "Forest", colors: { background: "#EEF9F0", textColor: "#0C2A18", accent: "#2FA84F", cardBg: "#FFFFFF" } },
  { id: "sun", name: "Sun", colors: { background: "#FFF6E9", textColor: "#2A1B05", accent: "#F5A013", cardBg: "#FFFFFF" } },
];

function titleFrac(aspect: Aspect): number {
  return aspect === "16:9" ? 0.05 : aspect === "9:16" ? 0.066 : 0.06;
}

const DURATION = 4.3;
const PANEL_ALPHAS = [1, 0.68, 0.5, 0.82];

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F5F6F8"));
  const textColor = str(values.textColor, pc("textColor", "#15161C"));
  const accent = str(values.accent, pc("accent", "#FF4D6D"));
  const cardBg = pc("cardBg", "#FFFFFF");
  const title = str(values.title, "Main Title");
  const subtitle = str(values.subtitle, "your subtitle here");
  const showFrame = on(values.showFrame);

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const cx = w / 2;
  const zone = safeRect(ctx.aspect);
  const cardCy = zone.y + zone.height * 0.46;

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  const cardW = Math.round(zone.width * (ctx.aspect === "16:9" ? 0.6 : 0.86));
  const cardH = Math.round(minDim * 0.46);
  const cardR = Math.round(minDim * 0.03);

  // --- Card shadow ---
  const sh = Math.round(minDim * 0.02);
  root.addChild(
    new Graphics()
      .roundRect(cx - cardW / 2 - sh, cardCy - cardH / 2 - sh + sh * 1.4, cardW + sh * 2, cardH + sh * 2, cardR + sh)
      .fill({ color: "#000000", alpha: 0.1 }),
  );

  // --- Sliding colored panels (masked to a rounded card) ---
  const cardGroup = new Container();
  cardGroup.position.set(cx, cardCy);
  root.addChild(cardGroup);

  const mask = new Graphics().roundRect(-cardW / 2, -cardH / 2, cardW, cardH, cardR).fill("#FFFFFF");
  cardGroup.addChild(mask);
  cardGroup.mask = mask;

  const strips = 4;
  const stripH = cardH / strips;
  for (let i = 0; i < strips; i++) {
    const yTop = -cardH / 2 + i * stripH;
    const fromLeft = i % 2 === 0;
    const strip = new Graphics().rect(-cardW / 2, yTop, cardW, stripH + 1).fill({ color: accent, alpha: PANEL_ALPHAS[i] ?? 1 });
    strip.position.x = fromLeft ? -cardW : cardW;
    cardGroup.addChild(strip);
    timeline.to(strip, { prop: "position.x", from: fromLeft ? -cardW : cardW, to: 0, start: 0.15 + i * 0.12, duration: 0.6, ease: outQuint });
  }

  // --- Accent frame (optional) ---
  if (showFrame) {
    const frameW = Math.max(3, minDim * 0.008);
    const frame = new Graphics().roundRect(-cardW / 2, -cardH / 2, cardW, cardH, cardR).stroke({ color: accent, width: frameW });
    frame.position.set(cx, cardCy);
    frame.alpha = 0;
    root.addChild(frame);
    timeline.to(frame, { prop: "alpha", from: 0, to: 1, start: 0.9, duration: 0.4, ease: outQuad });
  }

  // --- Light title plate ---
  const plateW = Math.round(cardW * 0.84);
  const plateH = Math.round(cardH * 0.58);
  const plateR = Math.round(minDim * 0.022);
  const plate = new Container();
  plate.position.set(cx, cardCy);
  plate.scale.set(0);
  root.addChild(plate);

  const pe = Math.round(plateH * 0.03);
  plate.addChild(new Graphics().roundRect(-plateW / 2 - pe, -plateH / 2 - pe + pe * 2, plateW + pe * 2, plateH + pe * 2, plateR + pe).fill({ color: "#000000", alpha: 0.12 }));
  plate.addChild(new Graphics().roundRect(-plateW / 2, -plateH / 2, plateW, plateH, plateR).fill(cardBg));

  const plateStart = 0.98;
  timeline
    .to(plate, { prop: "scale.x", from: 0, to: 1, start: plateStart, duration: 0.6, ease: spring(0.5) })
    .to(plate, { prop: "scale.y", from: 0, to: 1, start: plateStart, duration: 0.6, ease: spring(0.5) });

  // Title + subtitle on the plate.
  const innerW = plateW * 0.86;
  const titleSize = fitSize(fonts, title, "display", 700, Math.round(w * titleFrac(ctx.aspect)), innerW);
  const hasSub = subtitle.length > 0;
  const subSize = Math.round(titleSize * 0.34);
  const lineGap = subSize * 0.9;
  const totalH = titleSize + (hasSub ? lineGap + subSize : 0);

  const titleY = -totalH / 2 + titleSize / 2;
  const titleText = makeText(fonts, { text: title, role: "display", weight: 700, size: titleSize, color: textColor, anchor: 0.5, align: "center" });
  titleText.position.set(0, titleY);
  titleText.alpha = 0;
  plate.addChild(titleText);
  timeline
    .to(titleText, { prop: "alpha", from: 0, to: 1, start: plateStart + 0.3, duration: 0.4, ease: outQuad })
    .to(titleText, { prop: "y", from: titleY + 12, to: titleY, start: plateStart + 0.3, duration: 0.45, ease: outQuint });

  if (hasSub) {
    const subFit = fitSize(fonts, subtitle, "body", 500, subSize, innerW);
    const subY = totalH / 2 - subSize / 2;
    const subText = makeText(fonts, { text: subtitle, role: "body", weight: 500, size: subFit, color: textColor, anchor: 0.5, align: "center", letterSpacing: 1 });
    subText.position.set(0, subY + 10);
    subText.alpha = 0;
    plate.addChild(subText);
    timeline
      .to(subText, { prop: "alpha", from: 0, to: 0.78, start: plateStart + 0.5, duration: 0.4, ease: outQuad })
      .to(subText, { prop: "y", from: subY + 10, to: subY, start: plateStart + 0.5, duration: 0.45, ease: outQuint });
  }

  return { timeline, duration: DURATION };
}

export const panelSlide: TemplateDefinition = {
  id: "panel-slide",
  name: "Panel Slide",
  tagline: "Colored panels slide in from alternating sides to build a title card.",
  category: "intro",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 2.7,
  fontRoles: { title: "display", subtitle: "body" },
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Title", default: "Main Title", maxLength: 26, shrinkToFit: true },
    { key: "subtitle", type: "text", label: "Subtitle", default: "your subtitle here", maxLength: 40, optional: true, shrinkToFit: true },
    { key: "showFrame", type: "toggle", label: "Accent frame", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Panels", default: "", optional: true },
  ],
  build,
};
