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
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { layoutWords } from "../shared/words";

// Text Swing — every word is a little sign hanging from a hinge pin. Signs
// swing down around their top pivot with a pendulum settle (two-to-three
// diminishing swings), then the whole row sways once in the breeze and rests.
// The motion is rotation about a visible hinge — not a drop or a bounce.

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;

const PALETTES: Palette[] = [
  {
    id: "signpainter",
    name: "Signpainter",
    colors: { background: "#F7F4EC", plateColor: "#20262F", plateText: "#FFF8E7", textColor: "#20262F", accent: "#D9A441" },
  },
  {
    id: "porcelain-blue",
    name: "Porcelain blue",
    colors: { background: "#EEF3FB", plateColor: "#1D4ED8", plateText: "#FFFFFF", textColor: "#14294A", accent: "#E8A13C" },
  },
  {
    id: "market-green",
    name: "Market green",
    colors: { background: "#F1F6EF", plateColor: "#1F5133", plateText: "#FDFBF3", textColor: "#1C3A28", accent: "#C89B3C" },
  },
  {
    id: "noir-brass",
    name: "Noir brass",
    colors: { background: "#131318", plateColor: "#F2EFE8", plateText: "#16161C", textColor: "#F2EFE8", accent: "#E0A82E" },
  },
];

interface Layout {
  fontFrac: number; // of canvas width
  maxWidthFrac: number; // of safe-rect width
  centerFrac: number; // of safe-rect height
}

function layoutOf(aspect: Aspect): Layout {
  switch (aspect) {
    case "16:9":
      return { fontFrac: 0.062, maxWidthFrac: 0.82, centerFrac: 0.44 };
    case "9:16":
      return { fontFrac: 0.092, maxWidthFrac: 0.94, centerFrac: 0.42 };
    case "4:5":
      return { fontFrac: 0.085, maxWidthFrac: 0.9, centerFrac: 0.42 };
    case "1:1":
    default:
      return { fontFrac: 0.084, maxWidthFrac: 0.9, centerFrac: 0.43 };
  }
}

const PAD_EM = 0.38; // plate side padding, in em
const SPACE_EM = 0.98; // word gap so neighbouring plates never touch

/** Shrink so the widest word + its plate padding fits maxWidth. */
function fitFont(fonts: FontRegistry, text: string, size0: number, maxWidth: number): number {
  const family = fonts.family("display");
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return size0;
  const widest = Math.max(...words.map((w) => fonts.measure(w, { family, weight: 700, size: size0 })));
  const need = widest + 2 * PAD_EM * size0;
  if (need <= maxWidth) return size0;
  return Math.max(16, Math.floor((size0 * maxWidth) / need));
}

const SWING_START = 0.35;
const SWING_DUR = 1.2;
const BREEZE_AT = 2.95;
const DURATION = 4.3;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, rng } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F7F4EC"));
  const plateColor = str(values.plateColor, pc("plateColor", "#20262F"));
  const plateText = pc("plateText", "#FFF8E7");
  const textColor = str(values.textColor, pc("textColor", "#20262F"));
  const accent = str(values.accent, pc("accent", "#D9A441"));
  const headline = str(values.headline, "Big news swings in");
  const subline = typeof values.subline === "string" ? values.subline : "";
  const showPlates = on(values.showPlates);
  const showNails = on(values.showNails);

  const w = size.width;
  const h = size.height;
  const zone = safeRect(ctx.aspect);
  const L = layoutOf(ctx.aspect);
  const cx = w / 2;

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  const maxWidth = zone.width * L.maxWidthFrac;
  let fs = fitFont(fonts, headline, Math.round(w * L.fontFrac), maxWidth);
  const lineHeightOf = (s: number): number => Math.round(s * 2.15);
  const centerY = zone.y + zone.height * L.centerFrac;

  let boxes = layoutWords(headline, fonts, {
    role: "display",
    weight: 700,
    fontSize: fs,
    lineHeight: lineHeightOf(fs),
    maxWidth,
    align: "center",
    anchorX: cx,
    centerY,
    spaceWidthEm: SPACE_EM,
  });
  // Keep the block to <= 3 rows of signs (shrink and re-lay if needed).
  for (let guard = 0; guard < 2; guard++) {
    const lines = boxes.length ? Math.max(...boxes.map((b) => b.line)) + 1 : 1;
    if (lines <= 3) break;
    fs = Math.max(16, Math.floor(fs * 0.84));
    boxes = layoutWords(headline, fonts, {
      role: "display",
      weight: 700,
      fontSize: fs,
      lineHeight: lineHeightOf(fs),
      maxWidth,
      align: "center",
      anchorX: cx,
      centerY,
      spaceWidthEm: SPACE_EM,
    });
  }

  const plateH = fs * 1.42;
  const padX = fs * PAD_EM;
  const n = boxes.length;
  const stagger = n > 1 ? Math.min(0.24, 1.2 / (n - 1)) : 0;

  const signsLayer = new Container();
  signsLayer.label = "signs";
  root.addChild(signsLayer);
  const nailsLayer = new Container();
  nailsLayer.label = "nails";
  root.addChild(nailsLayer);

  boxes.forEach((box, i) => {
    const hingeX = box.cx;
    const hingeY = box.cy - plateH / 2;

    // The swinging sign: pivot at the hinge (container origin), plate + word
    // hang below it.
    const sign = new Container();
    sign.position.set(hingeX, hingeY);
    sign.alpha = 0;
    signsLayer.addChild(sign);

    if (showPlates) {
      const plateW = box.width + padX * 2;
      const r = fs * 0.16;
      const shadow = new Graphics()
        .roundRect(-plateW / 2, fs * 0.1, plateW, plateH, r)
        .fill({ color: "#000000", alpha: 0.14 });
      sign.addChild(shadow);
      sign.addChild(new Graphics().roundRect(-plateW / 2, 0, plateW, plateH, r).fill(plateColor));
    }

    const word = makeText(fonts, {
      text: box.text,
      role: "display",
      weight: 700,
      size: fs,
      color: showPlates ? plateText : textColor,
      anchor: 0.5,
    });
    word.position.set(0, plateH / 2);
    sign.addChild(word);

    // Static hinge pin drawn over the sign — the fixed point it swings around.
    if (showNails) {
      const pinR = Math.max(4, fs * 0.085);
      const pin = new Container();
      pin.position.set(hingeX, hingeY);
      pin.scale.set(0);
      pin.addChild(new Graphics().circle(0, 0, pinR).fill(accent));
      pin.addChild(new Graphics().circle(0, 0, pinR * 0.4).fill({ color: "#000000", alpha: 0.38 }));
      nailsLayer.addChild(pin);
      const pinStart = 0.08 + i * 0.05;
      timeline
        .to(pin, { prop: "scale.x", from: 0, to: 1, start: pinStart, duration: 0.35, ease: makeOutBack(2.2) })
        .to(pin, { prop: "scale.y", from: 0, to: 1, start: pinStart, duration: 0.35, ease: makeOutBack(2.2) });
    }

    // Pendulum drop: from nearly horizontal, alternating sides, with a
    // diminishing-oscillation settle around the hinge.
    const dir = i % 2 === 0 ? -1 : 1;
    const fromRot = dir * rng.range(1.15, 1.45);
    const start = SWING_START + i * stagger;
    timeline
      .to(sign, { prop: "alpha", from: 0, to: 1, start, duration: 0.12, ease: outQuad })
      .to(sign, { prop: "rotation", from: fromRot, to: 0, start, duration: SWING_DUR, ease: spring(0.42, 2.4) });

    // One soft shared breeze after everything has settled, then rest.
    const sway = dir * 0.014;
    timeline
      .to(sign, { prop: "rotation", from: 0, to: sway, start: BREEZE_AT, duration: 0.4, ease: outQuad })
      .to(sign, { prop: "rotation", from: sway, to: 0, start: BREEZE_AT + 0.4, duration: 0.5, ease: outQuad });
  });

  // --- Subline under the last row of signs ---
  if (subline.length > 0 && boxes.length > 0) {
    const maxCy = Math.max(...boxes.map((b) => b.cy));
    const subSize = Math.max(15, Math.round(fs * 0.3));
    const subY = maxCy + plateH / 2 + subSize * 1.5;
    const sub = makeText(fonts, {
      text: subline,
      role: "body",
      weight: 500,
      size: subSize,
      color: textColor,
      anchor: 0.5,
    });
    sub.position.set(cx, subY);
    sub.alpha = 0;
    root.addChild(sub);
    timeline
      .to(sub, { prop: "alpha", from: 0, to: 0.92, start: 2.8, duration: 0.5, ease: outQuad })
      .to(sub, { prop: "y", from: subY + 14, to: subY, start: 2.8, duration: 0.55, ease: outQuint });
  }

  return { timeline, duration: DURATION };
}

export const textSwing: TemplateDefinition = {
  id: "text-swing",
  name: "Text Swing",
  tagline: "Words swing down on hinged sign plates and settle like shop signs.",
  category: "announcement",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 4.0,
  fontRoles: { headline: "display", subline: "body" },
  palettes: PALETTES,
  fields: [
    { key: "headline", type: "text", label: "Headline", default: "Big news swings in", maxLength: 48, shrinkToFit: true },
    { key: "subline", type: "text", label: "Subline", default: "Doors open Friday", maxLength: 60, optional: true },
    { key: "showPlates", type: "toggle", label: "Sign plates", default: true },
    { key: "showNails", type: "toggle", label: "Hinge pins", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "plateColor", type: "color", label: "Sign plate", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Hinge pins", default: "", optional: true },
  ],
  build,
};
