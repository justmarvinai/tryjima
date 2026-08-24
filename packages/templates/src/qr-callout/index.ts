import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outExpo,
  outQuad,
  makeOutBack,
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

/** Largest size <= size0 at which `text` fits `maxWidth` (crisp, single-line). */
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
  return w > maxWidth ? Math.max(10, Math.floor(size0 * (maxWidth / w))) : size0;
}

const N = 21; // module grid (QR version-1 size); purely decorative here.
const QUIET = 2; // white quiet border, in modules.

/** Three corner finder origins (top-left, top-right, bottom-left), in modules. */
const FINDERS: Array<[number, number]> = [
  [0, 0],
  [0, N - 7],
  [N - 7, 0],
];

function inFinderZone(r: number, c: number): boolean {
  // 8x8 exclusion (7x7 finder + 1 separator module) at three corners.
  if (r < 8 && c < 8) return true;
  if (r < 8 && c >= N - 8) return true;
  if (r >= N - 8 && c < 8) return true;
  return false;
}

// A corner QR call-to-action card. Only the full-frame `bg` rect is tied to the
// background field (blanked by transparent export); the card uses its own
// palette-only `cardBg` (with a soft shadow) so it survives as overlay content.
// The QR panel is a fixed white-on-dark surface (`qrBg`/`qrModule`) regardless
// of the brand palette, so the code always reads as scannable art. The module
// pattern is generated deterministically from the seeded `ctx.rng`.
const PALETTES: Palette[] = [
  { id: "cloud", name: "Cloud", colors: { background: "#EEF1F6", cardBg: "#FFFFFF", textColor: "#0B0B0F", accent: "#2E5BD6", qrBg: "#FFFFFF", qrModule: "#0E0E12" } },
  { id: "mint", name: "Mint", colors: { background: "#E7F5EE", cardBg: "#FFFFFF", textColor: "#0B1F16", accent: "#046A4E", qrBg: "#FFFFFF", qrModule: "#0E0E12" } },
  { id: "sunset", name: "Sunset", colors: { background: "#FFF1E8", cardBg: "#FFFFFF", textColor: "#2A1408", accent: "#D2551A", qrBg: "#FFFFFF", qrModule: "#0E0E12" } },
  { id: "ink", name: "Ink", colors: { background: "#0D0D11", cardBg: "#191921", textColor: "#FFFFFF", accent: "#7CC4FF", qrBg: "#FFFFFF", qrModule: "#0E0E12" } },
];

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, rng } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#EEF1F6"));
  const cardBg = pc("cardBg", "#FFFFFF");
  const textColor = str(values.textColor, pc("textColor", "#0B0B0F"));
  const accent = str(values.accent, pc("accent", "#2E5BD6"));
  const qrBg = pc("qrBg", "#FFFFFF");
  const qrModule = pc("qrModule", "#0E0E12");

  const caption = str(values.caption, "Scan to shop");
  const sub = str(values.sub, "jima.app/store");
  const showArrow = values.showArrow !== false;

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const zone = safeZone(ctx.aspect);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Card metrics ---
  const cardPad = Math.round(minDim * 0.028);
  const Q = Math.round(minDim * 0.17);
  const arrowSize = showArrow ? Math.round(minDim * 0.03) : 0;
  const arrowGap = showArrow ? Math.round(minDim * 0.018) : 0;
  const textGap = Math.round(minDim * 0.022);
  const textMax = minDim * 0.3;

  const captionSize = fitSize(fonts, caption, "display", 700, Math.round(minDim * 0.032), textMax);
  const subSize = fitSize(fonts, sub, "mono", 500, Math.round(minDim * 0.022), textMax);
  const captionW = fonts.measure(caption, { family: fonts.family("display"), weight: 700, size: captionSize });
  const subW = fonts.measure(sub, { family: fonts.family("mono"), weight: 500, size: subSize });
  const textColW = Math.max(captionW, subW);
  const gapCS = Math.round(minDim * 0.012);
  const textBlockH = captionSize + gapCS + subSize;

  const cardW = cardPad * 2 + Q + arrowGap + arrowSize + textGap + textColW;
  const cardH = cardPad * 2 + Q;
  const cardRadius = Math.round(minDim * 0.028);

  const marginEdge = Math.round(minDim * 0.03);
  const cardCenterX = w - zone.right - marginEdge - cardW / 2;
  const cardCenterY = h - zone.bottom - marginEdge - cardH / 2;

  const card = new Container();
  card.position.set(cardCenterX, cardCenterY);
  card.scale.set(0);
  root.addChild(card);

  // Soft shadow + card surface.
  const e = Math.round(minDim * 0.008);
  const off = Math.round(minDim * 0.012);
  card.addChild(
    new Graphics()
      .roundRect(-cardW / 2 - e, -cardH / 2 - e + off, cardW + e * 2, cardH + e * 2, cardRadius + e)
      .fill({ color: "#000000", alpha: 0.2 }),
  );
  card.addChild(new Graphics().roundRect(-cardW / 2, -cardH / 2, cardW, cardH, cardRadius).fill(cardBg));

  // --- QR panel (white surface + modules) ---
  const panelCX = -cardW / 2 + cardPad + Q / 2;
  const panel = new Container();
  panel.position.set(panelCX, 0);
  card.addChild(panel);
  panel.addChild(new Graphics().roundRect(-Q / 2, -Q / 2, Q, Q, Math.round(minDim * 0.012)).fill(qrBg));

  const m = Q / (N + 2 * QUIET);
  const modR = Math.max(0.5, m * 0.16);
  const cellX = (c: number): number => -Q / 2 + (QUIET + c) * m;
  const cellY = (r: number): number => -Q / 2 + (QUIET + r) * m;

  const revealBase = 0.34;

  // Finder squares (revealed first, quickly).
  const finders = new Graphics();
  finders.alpha = 0;
  panel.addChild(finders);
  for (const [r0, c0] of FINDERS) {
    const ox = cellX(c0);
    const oy = cellY(r0);
    finders
      .roundRect(ox, oy, 7 * m, 7 * m, modR * 2)
      .fill(qrModule)
      .roundRect(ox + m, oy + m, 5 * m, 5 * m, modR * 1.5)
      .fill(qrBg)
      .roundRect(ox + 2 * m, oy + 2 * m, 3 * m, 3 * m, modR)
      .fill(qrModule);
  }
  timeline.to(finders, { prop: "alpha", from: 0, to: 1, start: revealBase, duration: 0.22, ease: outQuad });

  // Data + timing modules, grouped into diagonal bands for a staggered sweep.
  const bands = new Map<number, Graphics>();
  const bandOf = (b: number): Graphics => {
    let g = bands.get(b);
    if (!g) {
      g = new Graphics();
      g.alpha = 0;
      bands.set(b, g);
      panel.addChild(g);
    }
    return g;
  };
  const drawModule = (r: number, c: number): void => {
    const g = bandOf(r + c);
    g.roundRect(cellX(c) + m * 0.05, cellY(r) + m * 0.05, m * 0.9, m * 0.9, modR).fill(qrModule);
  };

  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (inFinderZone(r, c)) continue;
      // Fixed timing rows (index 6) for a QR-authentic look.
      if (r === 6 || c === 6) {
        if ((r + c) % 2 === 0) drawModule(r, c);
        continue;
      }
      if (rng.next() < 0.5) drawModule(r, c);
    }
  }
  for (const [b, g] of bands) {
    const start = revealBase + 0.02 + b * 0.01;
    timeline.to(g, { prop: "alpha", from: 0, to: 1, start, duration: 0.22, ease: outQuad });
  }

  // --- Arrow (left-pointing chevron, toward the QR) ---
  const textLeft = -cardW / 2 + cardPad + Q + arrowGap + arrowSize + textGap;
  const textStart = 0.62;
  const slideFrom = Math.round(minDim * 0.024);
  if (showArrow) {
    const arrowCX = -cardW / 2 + cardPad + Q + arrowGap + arrowSize / 2;
    const arrow = new Graphics()
      .poly([0.28 * arrowSize, -0.34 * arrowSize, -0.26 * arrowSize, 0, 0.28 * arrowSize, 0.34 * arrowSize], false)
      .stroke({ color: accent, width: Math.max(2, arrowSize * 0.16), cap: "round", join: "round" });
    arrow.position.set(arrowCX + slideFrom, 0);
    arrow.alpha = 0;
    card.addChild(arrow);
    timeline
      .to(arrow, { prop: "alpha", from: 0, to: 1, start: textStart, duration: 0.35, ease: outQuad })
      .to(arrow, { prop: "x", from: arrowCX + slideFrom, to: arrowCX, start: textStart, duration: 0.5, ease: outExpo });
  }

  // --- Caption + sub (slide in from the right) ---
  const captionCY = -textBlockH / 2 + captionSize / 2;
  const subCY = textBlockH / 2 - subSize / 2;

  const captionText = makeText(fonts, {
    text: caption,
    role: "display",
    weight: 700,
    size: captionSize,
    color: textColor,
    anchor: { x: 0, y: 0.5 },
  });
  captionText.position.set(textLeft + slideFrom, captionCY);
  captionText.alpha = 0;
  card.addChild(captionText);

  const subText = makeText(fonts, {
    text: sub,
    role: "mono",
    weight: 500,
    size: subSize,
    color: textColor,
    anchor: { x: 0, y: 0.5 },
  });
  subText.alpha = 0;
  subText.position.set(textLeft + slideFrom, subCY);
  card.addChild(subText);

  timeline
    .to(captionText, { prop: "alpha", from: 0, to: 1, start: textStart, duration: 0.4, ease: outQuad })
    .to(captionText, { prop: "x", from: textLeft + slideFrom, to: textLeft, start: textStart, duration: 0.5, ease: outExpo })
    .to(subText, { prop: "alpha", from: 0, to: 0.66, start: textStart + 0.08, duration: 0.4, ease: outQuad })
    .to(subText, { prop: "x", from: textLeft + slideFrom, to: textLeft, start: textStart + 0.08, duration: 0.5, ease: outExpo });

  // --- Card scale-in (leads everything) ---
  timeline
    .to(card, { prop: "scale.x", from: 0, to: 1, start: 0, duration: 0.44, ease: makeOutBack(1.5) })
    .to(card, { prop: "scale.y", from: 0, to: 1, start: 0, duration: 0.44, ease: makeOutBack(1.5) });

  return { timeline, duration: 4.0 };
}

export const qrCallout: TemplateDefinition = {
  id: "qr-callout",
  name: "QR Callout",
  tagline: "A corner card pops in and a QR code sweeps in, module by module.",
  category: "overlay",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 2.2,
  fontRoles: { caption: "display", sub: "mono" },
  palettes: PALETTES,
  fields: [
    { key: "caption", type: "text", label: "Caption", default: "Scan to shop", maxLength: 22, shrinkToFit: true },
    { key: "sub", type: "text", label: "Sub line", default: "jima.app/store", maxLength: 26, shrinkToFit: true },
    { key: "showArrow", type: "toggle", label: "Arrow", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
