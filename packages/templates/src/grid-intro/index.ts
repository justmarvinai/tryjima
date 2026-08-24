import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outQuint,
  makeOutBack,
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

// A pale mosaic of tiles flips in on a diagonal to build the title area, then a
// clean light plate lands with the title. Tiles are pale accent tints on
// off-white (a few seeded hero tiles pop); the title stays dark on the plate.
const PALETTES: Palette[] = [
  { id: "coral", name: "Coral", colors: { background: "#F7F5F3", textColor: "#171015", accent: "#FF5C6E", cardBg: "#FFFFFF" } },
  { id: "azure", name: "Azure", colors: { background: "#EFF4FB", textColor: "#0E2040", accent: "#2E86E8", cardBg: "#FFFFFF" } },
  { id: "jade", name: "Jade", colors: { background: "#EEF9F1", textColor: "#0C2A1A", accent: "#1EA664", cardBg: "#FFFFFF" } },
  { id: "amethyst", name: "Amethyst", colors: { background: "#F5F1FB", textColor: "#20123A", accent: "#8A48DE", cardBg: "#FFFFFF" } },
];

function titleFrac(aspect: Aspect): number {
  return aspect === "16:9" ? 0.058 : aspect === "9:16" ? 0.08 : 0.07;
}

const DURATION = 4.3;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, rng } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F7F5F3"));
  const textColor = str(values.textColor, pc("textColor", "#171015"));
  const accent = str(values.accent, pc("accent", "#FF5C6E"));
  const cardBg = pc("cardBg", "#FFFFFF");
  const title = str(values.title, "Grid Reveal");
  const subtitle = str(values.subtitle, "assembled to order");
  const showAccents = on(values.showAccents);

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const cx = w / 2;
  const zone = safeRect(ctx.aspect);
  const gridCy = zone.y + zone.height * 0.46;

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Grid of tiles (masked to a rounded panel) ---
  const cardW = Math.round(zone.width * (ctx.aspect === "16:9" ? 0.7 : 0.9));
  const cardH = Math.round(minDim * 0.5);
  const cell = Math.round(minDim * 0.062);
  const cols = Math.max(4, Math.round(cardW / cell));
  const rows = Math.max(3, Math.round(cardH / cell));
  const gridW = cols * cell;
  const gridH = rows * cell;
  const left = cx - gridW / 2;
  const top = gridCy - gridH / 2;
  const tile = cell * 0.86;
  const tileR = tile * 0.16;

  const gridGroup = new Container();
  root.addChild(gridGroup);
  const gmask = new Graphics().roundRect(left, top, gridW, gridH, minDim * 0.03).fill("#FFFFFF");
  gridGroup.addChild(gmask);
  gridGroup.mask = gmask;

  const each = Math.min(0.03, 0.85 / (cols + rows));
  let lastStart = 0.1;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const hero = showAccents && rng.next() < 0.14;
      const fillStyle = hero ? { color: accent, alpha: 1 } : { color: accent, alpha: rng.range(0.12, 0.32) };
      const sq = new Graphics().roundRect(-tile / 2, -tile / 2, tile, tile, tileR).fill(fillStyle);
      sq.position.set(left + c * cell + cell / 2, top + r * cell + cell / 2);
      sq.scale.set(0.7, 0);
      gridGroup.addChild(sq);
      const st = 0.1 + (c + r) * each;
      lastStart = Math.max(lastStart, st);
      timeline
        .to(sq, { prop: "scale.x", from: 0.7, to: 1, start: st, duration: 0.4, ease: makeOutBack(1.5) })
        .to(sq, { prop: "scale.y", from: 0, to: 1, start: st, duration: 0.4, ease: makeOutBack(1.5) });
    }
  }

  // --- Light title plate (guarantees contrast over the mosaic) ---
  const innerMax = cardW * 0.78;
  const titleSize = fitSize(fonts, title, "display", 700, Math.round(w * titleFrac(ctx.aspect)), innerMax);
  const hasSub = subtitle.length > 0;
  const subSize = Math.round(titleSize * 0.34);
  const subFit = hasSub ? fitSize(fonts, subtitle, "body", 500, subSize, innerMax) : subSize;
  const lineGap = subSize * 0.9;
  const totalH = titleSize + (hasSub ? lineGap + subSize : 0);

  const titleW = fonts.measure(title, { family: fonts.family("display"), weight: 700, size: titleSize });
  const subW = hasSub ? fonts.measure(subtitle, { family: fonts.family("body"), weight: 500, size: subFit }) : 0;
  const pad = minDim * 0.05;
  const plateW = Math.min(cardW * 0.94, Math.max(titleW, subW) + pad * 2);
  const plateH = totalH + pad * 1.5;
  const plateR = minDim * 0.022;

  const plate = new Container();
  plate.position.set(cx, gridCy);
  plate.scale.set(0);
  root.addChild(plate);
  const pe = Math.round(plateH * 0.04);
  plate.addChild(new Graphics().roundRect(-plateW / 2 - pe, -plateH / 2 - pe + pe * 2, plateW + pe * 2, plateH + pe * 2, plateR + pe).fill({ color: "#000000", alpha: 0.13 }));
  plate.addChild(new Graphics().roundRect(-plateW / 2, -plateH / 2, plateW, plateH, plateR).fill(cardBg));

  const plateStart = lastStart + 0.42;
  timeline
    .to(plate, { prop: "scale.x", from: 0, to: 1, start: plateStart, duration: 0.55, ease: spring(0.5) })
    .to(plate, { prop: "scale.y", from: 0, to: 1, start: plateStart, duration: 0.55, ease: spring(0.5) });

  const titleY = -totalH / 2 + titleSize / 2;
  const titleText = makeText(fonts, { text: title, role: "display", weight: 700, size: titleSize, color: textColor, anchor: 0.5, align: "center" });
  titleText.position.set(0, titleY);
  titleText.alpha = 0;
  plate.addChild(titleText);
  timeline
    .to(titleText, { prop: "alpha", from: 0, to: 1, start: plateStart + 0.28, duration: 0.4, ease: outQuad })
    .to(titleText, { prop: "y", from: titleY + 12, to: titleY, start: plateStart + 0.28, duration: 0.45, ease: outQuint });

  if (hasSub) {
    const subY = totalH / 2 - subSize / 2;
    const subText = makeText(fonts, { text: subtitle, role: "body", weight: 500, size: subFit, color: textColor, anchor: 0.5, align: "center", letterSpacing: 1 });
    subText.position.set(0, subY + 10);
    subText.alpha = 0;
    plate.addChild(subText);
    timeline
      .to(subText, { prop: "alpha", from: 0, to: 0.78, start: plateStart + 0.48, duration: 0.4, ease: outQuad })
      .to(subText, { prop: "y", from: subY + 10, to: subY, start: plateStart + 0.48, duration: 0.45, ease: outQuint });
  }

  return { timeline, duration: DURATION };
}

export const gridIntro: TemplateDefinition = {
  id: "grid-intro",
  name: "Grid Intro",
  tagline: "A mosaic of tiles flips in to build the title area, then the title lands.",
  category: "intro",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 2.8,
  fontRoles: { title: "display", subtitle: "body" },
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Title", default: "Grid Reveal", maxLength: 26, shrinkToFit: true },
    { key: "subtitle", type: "text", label: "Subtitle", default: "assembled to order", maxLength: 40, optional: true, shrinkToFit: true },
    { key: "showAccents", type: "toggle", label: "Accent tiles", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Tiles", default: "", optional: true },
  ],
  build,
};
