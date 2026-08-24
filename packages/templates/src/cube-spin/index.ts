import { Container, Graphics, Sprite } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outQuint,
  inOutQuart,
  makeOutBack,
  safeRect,
  type Aspect,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { radialGlowTexture } from "../shared/glow";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;
const clamp01 = (u: number): number => (u < 0 ? 0 : u > 1 ? 1 : u);
const asList = (v: unknown, fallback: string[]): string[] => {
  if (Array.isArray(v)) {
    const arr = v.filter((s): s is string => typeof s === "string" && s.length > 0);
    if (arr.length) return arr;
  }
  return fallback;
};

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

// A faux-3D cube of app screens: skewed-quad faces with shading spin in three
// crisp 90° steps — cover, then three mini screens, each with its own accent
// and a label chip that swaps in below. No real 3D — scale.x + skew + shade.
const PALETTES: Palette[] = [
  {
    id: "frost",
    name: "Frost",
    colors: {
      background: "#EDF1F7", textColor: "#101728", accent: "#3B6EF5", accent2: "#12B76A",
      accent3: "#FF8A3C", screenBg: "#FFFFFF", inkColor: "#101728", muted: "#8A93A6",
      chipBg: "#101728", chipText: "#FFFFFF",
    },
  },
  {
    id: "mint",
    name: "Mint",
    colors: {
      background: "#E9F7EF", textColor: "#06301F", accent: "#12B76A", accent2: "#0E9BAA",
      accent3: "#E8890C", screenBg: "#FFFFFF", inkColor: "#06301F", muted: "#7FA692",
      chipBg: "#0C2A1E", chipText: "#ECFDF3",
    },
  },
  {
    id: "plum",
    name: "Plum",
    colors: {
      background: "#F3EEFB", textColor: "#2A1650", accent: "#7C5CFF", accent2: "#E85B7A",
      accent3: "#0FA3B1", screenBg: "#FFFFFF", inkColor: "#2A1650", muted: "#9C8FC4",
      chipBg: "#2A1650", chipText: "#F3EEFB",
    },
  },
  {
    id: "carbon",
    name: "Carbon",
    colors: {
      background: "#101319", textColor: "#F2F4F8", accent: "#5B8CFF", accent2: "#3DDC84",
      accent3: "#FFB13C", screenBg: "#1B2029", inkColor: "#F2F4F8", muted: "#8891A6",
      chipBg: "#E8ECF4", chipText: "#101319",
    },
  },
];

const DEFAULT_LABELS = ["Plan", "Track", "Ship"];

const STEP_STARTS = [0.85, 1.9, 2.95] as const;
const STEP_DUR = 0.75;
const SKEW_MAX = 0.16;
const SHADE_MAX = 0.32;
const DURATION = 4.4;

type FaceKind = "cover" | "list" | "chart" | "media";

/** One cube face: a mini app screen drawn in local coords, centered at origin. */
function makeFace(kind: FaceKind, fw: number, fh: number, faceAccent: string, screenBg: string, ink: string, muted: string): { face: Container; shade: Graphics } {
  const face = new Container();
  const r = fw * 0.06;
  const g = new Graphics();
  face.addChild(g);
  const px = fw * 0.1; // inner padding
  const innerW = fw - px * 2;

  if (kind === "cover") {
    g.roundRect(-fw / 2, -fh / 2, fw, fh, r).fill(faceAccent);
    g.circle(0, -fh * 0.06, fw * 0.16).stroke({ color: "#FFFFFF", width: Math.max(3, fw * 0.02) });
    g.circle(0, -fh * 0.06, fw * 0.055).fill("#FFFFFF");
    g.roundRect(-innerW * 0.28, fh * 0.22, innerW * 0.56, fh * 0.05, fh * 0.025).fill({ color: "#FFFFFF", alpha: 0.85 });
    g.roundRect(-innerW * 0.18, fh * 0.32, innerW * 0.36, fh * 0.035, fh * 0.0175).fill({ color: "#FFFFFF", alpha: 0.5 });
  } else {
    g.roundRect(-fw / 2, -fh / 2, fw, fh, r).fill(screenBg);
    g.roundRect(-fw / 2, -fh / 2, fw, fh, r).stroke({ color: ink, width: Math.max(1.5, fw * 0.006), alpha: 0.1 });
    // Slim app top bar.
    g.circle(-fw / 2 + px, -fh / 2 + px, fw * 0.022).fill(faceAccent);
    g.roundRect(-fw / 2 + px + fw * 0.05, -fh / 2 + px - fh * 0.014, innerW * 0.34, fh * 0.028, fh * 0.014).fill({ color: muted, alpha: 0.5 });
  }

  const top = -fh / 2 + px + fh * 0.07;
  if (kind === "list") {
    for (let i = 0; i < 3; i++) {
      const y = top + fh * 0.06 + i * fh * 0.185;
      g.roundRect(-fw / 2 + px, y, innerW, fh * 0.15, fw * 0.03).fill({ color: muted, alpha: 0.14 });
      g.circle(-fw / 2 + px + fw * 0.06, y + fh * 0.075, fw * 0.032).fill({ color: faceAccent, alpha: i === 0 ? 1 : 0.45 });
      g.roundRect(-fw / 2 + px + fw * 0.12, y + fh * 0.045, innerW * 0.52, fh * 0.026, fh * 0.013).fill({ color: ink, alpha: 0.75 });
      g.roundRect(-fw / 2 + px + fw * 0.12, y + fh * 0.09, innerW * 0.36, fh * 0.02, fh * 0.01).fill({ color: muted, alpha: 0.6 });
    }
  } else if (kind === "chart") {
    const baseY = fh * 0.3;
    const plotH = fh * 0.42;
    const heights = [0.45, 0.7, 0.5, 0.9, 0.65];
    const slot = innerW / heights.length;
    heights.forEach((f, i) => {
      const bh = plotH * f;
      const bx = -fw / 2 + px + slot * (i + 0.5);
      g.roundRect(bx - slot * 0.24, baseY - bh, slot * 0.48, bh, slot * 0.14).fill({ color: faceAccent, alpha: i === heights.length - 2 ? 1 : 0.45 });
    });
    g.rect(-fw / 2 + px, baseY, innerW, Math.max(1.5, fh * 0.005)).fill({ color: muted, alpha: 0.5 });
    g.roundRect(-fw / 2 + px, top - fh * 0.01, innerW * 0.42, fh * 0.06, fh * 0.02).fill({ color: faceAccent, alpha: 0.2 });
    g.roundRect(-fw / 2 + px + innerW * 0.03, top + fh * 0.008, innerW * 0.2, fh * 0.024, fh * 0.012).fill(faceAccent);
  } else if (kind === "media") {
    const mh = fh * 0.4;
    g.roundRect(-fw / 2 + px, top, innerW, mh, fw * 0.035).fill({ color: faceAccent, alpha: 0.18 });
    const gs = mh * 0.42;
    g.circle(-gs * 0.2, top + mh / 2 - gs * 0.12, gs * 0.13).fill(faceAccent);
    g.poly([
      -gs * 0.5, top + mh / 2 + gs * 0.38, -gs * 0.14, top + mh / 2 - gs * 0.04,
      gs * 0.06, top + mh / 2 + gs * 0.16, gs * 0.3, top + mh / 2 - gs * 0.1, gs * 0.5, top + mh / 2 + gs * 0.38,
    ]).fill(faceAccent);
    g.roundRect(-fw / 2 + px, top + mh + fh * 0.05, innerW * 0.7, fh * 0.03, fh * 0.015).fill({ color: ink, alpha: 0.75 });
    g.roundRect(-fw / 2 + px, top + mh + fh * 0.1, innerW * 0.5, fh * 0.024, fh * 0.012).fill({ color: muted, alpha: 0.6 });
    g.roundRect(-fw / 2 + px, top + mh + fh * 0.16, innerW * 0.34, fh * 0.055, fh * 0.0275).fill(faceAccent);
  }

  // Shade overlay — driven per frame while the face is edge-on.
  const shade = new Graphics().roundRect(-fw / 2, -fh / 2, fw, fh, r).fill("#0A0C10");
  shade.alpha = 0;
  face.addChild(shade);
  return { face, shade };
}

interface Cfg {
  faceF: number; // face size as a fraction of min(safe w, safe h)
}
const CFG: Record<Aspect, Cfg> = {
  "16:9": { faceF: 0.5 },
  "1:1": { faceF: 0.52 },
  "4:5": { faceF: 0.54 },
  "9:16": { faceF: 0.56 },
};

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#EDF1F7"));
  const textColor = str(values.textColor, pc("textColor", "#101728"));
  const accent = str(values.accent, pc("accent", "#3B6EF5"));
  const accent2 = pc("accent2", "#12B76A");
  const accent3 = pc("accent3", "#FF8A3C");
  const screenBg = pc("screenBg", "#FFFFFF");
  const ink = pc("inkColor", "#101728");
  const muted = pc("muted", "#8A93A6");
  const chipBg = pc("chipBg", "#101728");
  const chipText = pc("chipText", "#FFFFFF");

  const title = str(values.title, "One product, every angle");
  const labels = asList(values.labels, DEFAULT_LABELS).slice(0, 3);
  while (labels.length < 3) labels.push(DEFAULT_LABELS[labels.length]!);
  const showShadow = on(values.showShadow);
  const showDots = on(values.showDots);

  const w = size.width;
  const h = size.height;
  const cx = w / 2;
  const minDim = Math.min(w, h);
  const safe = safeRect(ctx.aspect);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Vertical stack: cube, dots, chip, title — centered in the safe area ---
  const FW = Math.min(safe.width * 0.6, Math.min(safe.width, safe.height) * CFG[ctx.aspect].faceF);
  const FH = FW;
  const s = FW / 2;
  const titleSize = fitSize(fonts, title, "display", 700, Math.round(minDim * 0.044), safe.width * 0.86);
  const dotsGap = FH * 0.17; // clears the ground shadow band under the cube
  const chipGap = FH * 0.075;
  const chipH = Math.max(minDim * 0.045, FH * 0.13);
  const titleGap = FH * 0.09;
  const stackH = FH + dotsGap + (showDots ? minDim * 0.02 : 0) + chipGap + chipH + titleGap + titleSize;
  const cubeCy = safe.y + Math.max(0, (safe.height - stackH) / 2) + FH / 2;
  const dotsY = cubeCy + FH / 2 + dotsGap;
  const chipY = dotsY + (showDots ? minDim * 0.02 : 0) + chipGap + chipH / 2;
  const titleY = chipY + chipH / 2 + titleGap + titleSize * 0.55;

  // --- Cube group (pops in via the timeline; faces are driven per frame) ---
  const cube = new Container();
  cube.position.set(cx, cubeCy);
  cube.alpha = 0;
  cube.scale.set(0.86);
  root.addChild(cube);
  timeline
    .to(cube, { prop: "alpha", from: 0, to: 1, start: 0.05, duration: 0.4, ease: outQuad })
    .to(cube, { prop: "scale.x", from: 0.86, to: 1, start: 0.05, duration: 0.6, ease: makeOutBack(1.4) })
    .to(cube, { prop: "scale.y", from: 0.86, to: 1, start: 0.05, duration: 0.6, ease: makeOutBack(1.4) });

  // Soft ground shadow — a black-tinted radial gradient sprite (no hard edge).
  const shadow = new Sprite(radialGlowTexture());
  shadow.anchor.set(0.5);
  shadow.tint = 0x000000;
  shadow.width = FW * 1.05;
  shadow.height = FH * 0.16;
  const shadowSX = shadow.scale.x;
  shadow.position.set(cx, cubeCy + FH * 0.58);
  shadow.alpha = 0;
  if (showShadow) {
    root.addChild(shadow);
    timeline.to(shadow, { prop: "alpha", from: 0, to: 0.42, start: 0.2, duration: 0.5, ease: outQuad });
  }

  const kinds: FaceKind[] = ["cover", "list", "chart", "media"];
  const faceAccents = [accent, accent, accent2, accent3];
  const faces: { face: Container; shade: Graphics }[] = kinds.map((kind, i) =>
    makeFace(kind, FW, FH, faceAccents[i]!, screenBg, ink, muted),
  );
  for (const f of faces) {
    f.face.visible = false;
    cube.addChild(f.face);
  }

  // --- Label chips (one per screen, swapped as each step lands) ---
  const chips: Container[] = labels.map((label, i) => {
    const tSize = fitSize(fonts, label, "body", 600, Math.round(chipH * 0.44), safe.width * 0.6);
    const node = makeText(fonts, { text: label, role: "body", weight: 600, size: tSize, color: chipText, anchor: 0.5, letterSpacing: 1 });
    const cw = node.width + chipH * 1.2;
    const chip = new Container();
    chip.addChild(new Graphics().roundRect(-cw / 2, -chipH / 2, cw, chipH, chipH / 2).fill(chipBg));
    const dotR = chipH * 0.11;
    node.position.set(dotR * 1.6, 0);
    chip.addChild(new Graphics().circle(-node.width / 2 - dotR * 0.8, 0, dotR).fill(faceAccents[i + 1]!));
    chip.addChild(node);
    chip.position.set(cx, chipY);
    chip.alpha = 0;
    root.addChild(chip);
    return chip;
  });
  STEP_STARTS.forEach((stepStart, i) => {
    const at = stepStart + STEP_DUR * 0.55;
    const chip = chips[i]!;
    timeline
      .to(chip, { prop: "alpha", from: 0, to: 1, start: at, duration: 0.3, ease: outQuad })
      .to(chip, { prop: "y", from: chipY + 14, to: chipY, start: at, duration: 0.45, ease: outQuint })
      .to(chip, { prop: "scale.x", from: 0.85, to: 1, start: at, duration: 0.45, ease: makeOutBack(1.7) })
      .to(chip, { prop: "scale.y", from: 0.85, to: 1, start: at, duration: 0.45, ease: makeOutBack(1.7) });
    if (i > 0) timeline.to(chips[i - 1]!, { prop: "alpha", from: 1, to: 0, start: at - 0.1, duration: 0.25, ease: outQuad });
  });

  // --- Step progress dots ---
  if (showDots) {
    const dotR = minDim * 0.008;
    const gap = minDim * 0.03;
    for (let i = 0; i < 3; i++) {
      const dx = cx + (i - 1) * gap;
      const base = new Graphics().circle(0, 0, dotR).fill({ color: muted, alpha: 0.4 });
      base.position.set(dx, dotsY);
      base.alpha = 0;
      root.addChild(base);
      timeline.to(base, { prop: "alpha", from: 0, to: 1, start: 0.35 + i * 0.06, duration: 0.3, ease: outQuad });
      const active = new Graphics().circle(0, 0, dotR * 1.25).fill(faceAccents[i + 1]!);
      active.position.set(dx, dotsY);
      active.alpha = 0;
      root.addChild(active);
      timeline.to(active, { prop: "alpha", from: 0, to: 1, start: STEP_STARTS[i]! + STEP_DUR * 0.6, duration: 0.3, ease: outQuad });
    }
  }

  // --- Title ---
  const titleText = makeText(fonts, { text: title, role: "display", weight: 700, size: titleSize, color: textColor, anchor: 0.5, align: "center" });
  titleText.position.set(cx, titleY + 14);
  titleText.alpha = 0;
  root.addChild(titleText);
  timeline
    .to(titleText, { prop: "alpha", from: 0, to: 1, start: 0.5, duration: 0.5, ease: outQuad })
    .to(titleText, { prop: "y", from: titleY + 14, to: titleY, start: 0.5, duration: 0.6, ease: outQuint });

  // --- Per-frame cube state: pure f(t), evaluated after the timeline ---
  const setIdle = (index: number): void => {
    faces.forEach((f, i) => {
      const isFront = i === index;
      f.face.visible = isFront;
      if (isFront) {
        f.face.scale.x = 1;
        f.face.scale.y = 1;
        f.face.position.x = 0;
        f.face.skew.y = 0;
        f.shade.alpha = 0;
      }
    });
  };

  const update = (t: number): void => {
    let stepIndex = -1;
    let done = 0;
    for (let i = 0; i < STEP_STARTS.length; i++) {
      const st = STEP_STARTS[i]!;
      if (t >= st + STEP_DUR) done = i + 1;
      else if (t >= st) {
        stepIndex = i;
        break;
      }
    }
    if (stepIndex === -1) {
      setIdle(done);
      if (showShadow) shadow.scale.x = shadowSX;
      return;
    }
    const u = inOutQuart(clamp01((t - STEP_STARTS[stepIndex]!) / STEP_DUR));
    const theta = (Math.PI / 2) * u;
    const sin = Math.sin(theta);
    const cos = Math.cos(theta);
    faces.forEach((f, i) => {
      if (i === stepIndex) {
        // Outgoing face: compresses toward the right edge, tilting + darkening.
        f.face.visible = true;
        f.face.scale.x = Math.max(0.0001, cos);
        f.face.scale.y = 1;
        f.face.position.x = s * sin;
        f.face.skew.y = SKEW_MAX * sin;
        f.shade.alpha = SHADE_MAX * sin;
      } else if (i === stepIndex + 1) {
        // Incoming face: unfolds from the left edge into the light.
        f.face.visible = true;
        f.face.scale.x = Math.max(0.0001, sin);
        f.face.scale.y = 1;
        f.face.position.x = -s * cos;
        f.face.skew.y = -SKEW_MAX * cos;
        f.shade.alpha = SHADE_MAX * cos;
      } else {
        f.face.visible = false;
      }
    });
    // The silhouette widens to sqrt(2) mid-turn — the ground shadow tracks it.
    if (showShadow) shadow.scale.x = shadowSX * (sin + cos);
  };

  return { timeline, duration: DURATION, update };
}

export const cubeSpin: TemplateDefinition = {
  id: "cube-spin",
  name: "Cube Spin",
  tagline: "A shaded faux-3D cube snaps through three screens, one turn at a time.",
  category: "tech",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 4.0,
  fontRoles: { title: "display", labels: "body" },
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Title", default: "One product, every angle", maxLength: 34, shrinkToFit: true },
    { key: "labels", type: "textlist", label: "Step labels", default: DEFAULT_LABELS, minItems: 3, maxItems: 3, maxLength: 16, help: "One label per turn of the cube." },
    { key: "showShadow", type: "toggle", label: "Ground shadow", default: true },
    { key: "showDots", type: "toggle", label: "Progress dots", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
