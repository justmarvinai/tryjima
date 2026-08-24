import { Container, Graphics, FillGradient } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  spring,
  makeOutBack,
  safeRect,
  type Aspect,
  type BuiltTemplate,
  type FontRegistry,
  type MakeTextOptions,
  type Palette,
  type Rng,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;

// Frame fills are photographic content — deterministic per frame, vivid on any
// sheet color.
const GRADS: [string, string][] = [
  ["#FF9E7A", "#FF6F91"],
  ["#7AC0FF", "#5B7BFF"],
  ["#9F7AEA", "#C77DFF"],
  ["#5FD6A6", "#37B98C"],
  ["#FFC46B", "#FF8A4C"],
  ["#66D2E0", "#3FA9C9"],
  ["#F58AB0", "#C86DD7"],
  ["#8FB0D8", "#5C7EA8"],
];

const PALETTES: Palette[] = [
  { id: "darkroom", name: "Darkroom", colors: { background: "#17171B", textColor: "#F4F4F6", accent: "#FF5A36", frameBorder: "#33333C", numColor: "#C9C9D2" } },
  { id: "kraft", name: "Kraft", colors: { background: "#E8E2D5", textColor: "#201C17", accent: "#D8412F", frameBorder: "#C7BFB0", numColor: "#4A4437" } },
  { id: "slate", name: "Slate", colors: { background: "#22272D", textColor: "#EAF0F5", accent: "#38C7FF", frameBorder: "#363D45", numColor: "#AEBDC9" } },
  { id: "ivory", name: "Ivory", colors: { background: "#F3F0E9", textColor: "#14110D", accent: "#7C5CFF", frameBorder: "#DAD4C6", numColor: "#4A463C" } },
];

interface GridCfg {
  cols: number;
  rows: number;
}
const GRID: Record<Aspect, GridCfg> = {
  "1:1": { cols: 3, rows: 3 },
  "4:5": { cols: 3, rows: 4 },
  "9:16": { cols: 3, rows: 4 },
  "16:9": { cols: 4, rows: 3 },
};

/** Crisp-fit: re-make one size smaller if it would overflow maxWidth. */
function fitText(fonts: FontRegistry, opts: MakeTextOptions, maxWidth: number) {
  const t = makeText(fonts, opts);
  if (maxWidth > 0 && t.width > maxWidth) {
    const shrunk = Math.max(8, Math.floor(opts.size * (maxWidth / t.width)));
    if (shrunk < opts.size) return makeText(fonts, { ...opts, size: shrunk });
  }
  return t;
}

function gradFill(c0: string, c1: string): FillGradient {
  return new FillGradient({
    type: "linear",
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
    colorStops: [
      { offset: 0, color: c0 },
      { offset: 1, color: c1 },
    ],
    textureSpace: "local",
  });
}

/** A hand-drawn "grease pencil" loop — a slightly wobbly, over-run ellipse. */
function greasePencil(rx: number, ry: number, color: string, width: number, rng: Rng): Graphics {
  const g = new Graphics();
  const steps = 44;
  const turns = 1.12;
  const a0 = -0.12 * Math.PI;
  const pts: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = a0 + turns * 2 * Math.PI * (i / steps);
    const j = 1 + (rng.next() - 0.5) * 0.07;
    pts.push(Math.cos(a) * rx * j, Math.sin(a) * ry * j);
  }
  g.poly(pts, false).stroke({ color, width, cap: "round", join: "round" });
  return g;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, rng } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#17171B"));
  const textColor = str(values.textColor, pc("textColor", "#F4F4F6"));
  const accent = str(values.accent, pc("accent", "#FF5A36"));
  const frameBorder = pc("frameBorder", "#33333C");
  const numColor = pc("numColor", "#C9C9D2");
  const title = str(values.title, "Selects");
  const showNumbers = values.showNumbers !== false;
  const showCircle = values.showCircle !== false;

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();
  const safe = safeRect(ctx.aspect);
  const cfg = GRID[ctx.aspect];
  const cols = cfg.cols;
  const rows = cfg.rows;

  // --- Title row ---
  const titleH = minDim * 0.11;
  if (title.length > 0) {
    const tSize = Math.round(minDim * 0.055);
    const sq = tSize * 0.5;
    const sqG = new Graphics().roundRect(0, -sq / 2, sq, sq, sq * 0.2).fill(accent);
    sqG.position.set(safe.x, safe.y + titleH * 0.42);
    sqG.alpha = 0;
    root.addChild(sqG);
    const label = fitText(fonts, { text: title, role: "display", weight: 800, size: tSize, color: textColor, anchor: { x: 0, y: 0.5 } }, safe.width * 0.7);
    label.position.set(safe.x + sq + tSize * 0.4, safe.y + titleH * 0.42);
    label.alpha = 0;
    root.addChild(label);
    timeline
      .to(sqG, { prop: "alpha", from: 0, to: 1, start: 0.1, duration: 0.4, ease: outQuad })
      .to(label, { prop: "alpha", from: 0, to: 1, start: 0.15, duration: 0.5, ease: outQuad })
      .to(label, { prop: "x", from: safe.x + sq + tSize * 0.4 - 12, to: safe.x + sq + tSize * 0.4, start: 0.15, duration: 0.5, ease: outQuad });
  }

  // --- Contact grid ---
  const gridTop = safe.y + titleH;
  const gridH = safe.y + safe.height - gridTop;
  const gap = minDim * 0.02;
  const cellW = (safe.width - (cols - 1) * gap) / cols;
  const cellH = (gridH - (rows - 1) * gap) / rows;
  const numH = showNumbers ? cellH * 0.16 : 0;
  const frameW = cellW;
  const frameH = cellH - numH;
  const frameR = Math.min(frameW, frameH) * 0.05;
  const count = cols * rows;

  // Deterministic "selected" frame, biased to the interior for a clean circle.
  const selCol = cols > 2 ? rng.int(1, cols - 2) : rng.int(0, cols - 1);
  const selRow = rows > 2 ? rng.int(1, rows - 2) : rng.int(0, rows - 1);
  const selIndex = selRow * cols + selCol;
  let selCenter = { x: w / 2, y: h / 2 };

  for (let i = 0; i < count; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const fx = safe.x + col * (cellW + gap) + frameW / 2;
    const fy = gridTop + row * (cellH + gap) + frameH / 2;
    const isSel = i === selIndex;
    if (isSel) selCenter = { x: fx, y: fy };

    const frame = new Container();
    frame.position.set(fx, fy);
    frame.scale.set(0);
    frame.alpha = 0;
    root.addChild(frame);

    const pair = GRADS[(i * 3 + row) % GRADS.length]!;
    frame.addChild(new Graphics().roundRect(-frameW / 2, -frameH / 2, frameW, frameH, frameR).fill(gradFill(pair[0], pair[1])));
    // A subtle band + circle so each frame reads as a distinct "shot".
    const clip = new Graphics().roundRect(-frameW / 2, -frameH / 2, frameW, frameH, frameR).fill(0xffffff);
    const deco = new Container();
    deco.addChild(new Graphics().circle(frameW * 0.22, -frameH * 0.2, frameW * 0.28).fill({ color: "#FFFFFF", alpha: 0.14 }));
    deco.addChild(new Graphics().rect(-frameW / 2, frameH * 0.18, frameW, frameH * 0.32).fill({ color: "#000000", alpha: 0.1 }));
    frame.addChild(deco, clip);
    deco.mask = clip;
    frame.addChild(
      new Graphics()
        .roundRect(-frameW / 2, -frameH / 2, frameW, frameH, frameR)
        .stroke({ color: isSel ? accent : frameBorder, width: Math.max(1.5, frameW * (isSel ? 0.014 : 0.008)), alpha: isSel ? 1 : 0.7 }),
    );

    if (showNumbers) {
      const num = String(i + 1).padStart(2, "0");
      const numText = makeText(fonts, { text: num, role: "mono", weight: 600, size: Math.max(11, numH * 0.72), color: isSel ? accent : numColor, anchor: { x: 0, y: 0.5 } });
      numText.position.set(-frameW / 2 + frameW * 0.02, frameH / 2 + numH * 0.58);
      frame.addChild(numText);
    }

    const start = 0.4 + (row + col) * 0.09;
    timeline
      .to(frame, { prop: "alpha", from: 0, to: 1, start, duration: 0.35, ease: outQuad })
      .to(frame, { prop: "scale.x", from: 0, to: 1, start, duration: 0.6, ease: spring(0.5) })
      .to(frame, { prop: "scale.y", from: 0, to: 1, start, duration: 0.6, ease: spring(0.5) });
  }

  // --- Grease-pencil circle on the selected frame ---
  if (showCircle) {
    const circle = new Container();
    circle.addChild(greasePencil(frameW * 0.64, frameH * 0.66, accent, Math.max(3, minDim * 0.007), rng));
    circle.position.set(selCenter.x, selCenter.y);
    circle.rotation = -0.06;
    circle.alpha = 0;
    circle.scale.set(1.18);
    root.addChild(circle);
    const cStart = 0.5 + (rows - 1 + cols - 1) * 0.09 + 0.45;
    timeline
      .to(circle, { prop: "alpha", from: 0, to: 1, start: cStart, duration: 0.35, ease: outQuad })
      .to(circle, { prop: "scale.x", from: 1.18, to: 1, start: cStart, duration: 0.55, ease: makeOutBack(2) })
      .to(circle, { prop: "scale.y", from: 1.18, to: 1, start: cStart, duration: 0.55, ease: makeOutBack(2) })
      .to(circle, { prop: "rotation", from: -0.06, to: 0.02, start: cStart, duration: 0.55, ease: makeOutBack(1.6) });
  }

  return { timeline, duration: 3.9 };
}

export const contactSheet: TemplateDefinition = {
  id: "contact-sheet",
  name: "Contact Sheet",
  tagline: "A photo grid reveals, then one frame gets circled in grease pencil.",
  category: "photo",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "4:5",
  loopable: false,
  posterTime: 3.3,
  fontRoles: { title: "display" },
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Title", default: "Selects", maxLength: 22, optional: true, shrinkToFit: true },
    { key: "showNumbers", type: "toggle", label: "Frame numbers", default: true },
    { key: "showCircle", type: "toggle", label: "Grease-pencil circle", default: true },
    { key: "background", type: "color", label: "Sheet", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
