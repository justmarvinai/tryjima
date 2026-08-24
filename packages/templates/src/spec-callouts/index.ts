import { Container, Graphics, Sprite, type Texture } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outQuint,
  outExpo,
  makeOutBack,
  spring,
  type Aspect,
  type BuiltTemplate,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
  type Values,
} from "@jima/engine";

const DEG = Math.PI / 180;

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const asItems = (v: unknown, fallback: string[]): string[] => {
  if (Array.isArray(v)) {
    const arr = v.filter((s): s is string => typeof s === "string" && s.length > 0);
    if (arr.length) return arr;
  }
  return fallback;
};

const DEFAULT_SPECS = ["48MP camera", "5000mAh battery", "IP68 rated", "120Hz display"];

const PALETTES: Palette[] = [
  { id: "studio-white", name: "Studio white", colors: { background: "#F4F2EC", cardColor: "#FFFFFF", accent: "#FF4D1C", textColor: "#14140F", muted: "#6B6B60" } },
  { id: "electric-violet", name: "Electric violet", colors: { background: "#F1ECFB", cardColor: "#FFFFFF", accent: "#6D3BEA", textColor: "#180F2E", muted: "#6A5E85" } },
  { id: "splash-blue", name: "Splash blue", colors: { background: "#E9F1FC", cardColor: "#FFFFFF", accent: "#1E6FE0", textColor: "#0B1A2E", muted: "#5A6A82" } },
  { id: "ink-lime", name: "Ink lime", colors: { background: "#15171C", cardColor: "#21252C", accent: "#C7F24A", textColor: "#FFFFFF", muted: "#8A93A0" } },
];

// Radial spoke angles (degrees, screen coords: 0°=right, 90°=down), chosen so
// callouts land on clean diagonals around the product — distinct from
// feature-callouts' two straight vertical rails.
const ANGLE_SETS: Record<number, number[]> = {
  2: [-45, 135],
  3: [-90, 30, 150],
  4: [-45, 45, 135, 225],
};

const FRAME_IN = 0.15;
const CALLOUT_START = 1.0;
const CALLOUT_STAGGER = 0.4;
const NAME_GAP = 0.7;
const NAME_DUR = 0.6;
const HOLD = 1.0;

function specsList(values: Values): string[] {
  return asItems(values.specs, DEFAULT_SPECS).slice(0, 4);
}

function computeDuration(values: Values): number {
  const n = Math.max(2, Math.min(4, specsList(values).length));
  const lastStart = CALLOUT_START + (n - 1) * CALLOUT_STAGGER;
  const nameStart = lastStart + NAME_GAP;
  return nameStart + NAME_DUR + HOLD;
}

/** Largest size ≤ size0 (down to minSize) at which `text` fits `maxWidth` on one line. */
function fitOneLine(
  fonts: TemplateContext["fonts"],
  text: string,
  role: FontRole,
  weight: number,
  size0: number,
  maxWidth: number,
  minSize = 12,
): number {
  const family = fonts.family(role);
  let size = size0;
  while (size > minSize && fonts.measure(text, { family, weight, size }) > maxWidth) size -= 1;
  return size;
}

/** A circular product frame: cover-fit masked image, or a designed placeholder. */
function circleFrame(r: number, tex: Texture | null, cardColor: string, accent: string): Container {
  const c = new Container();
  c.addChild(new Graphics().circle(0, r * 0.06, r).fill({ color: 0x000000, alpha: 0.12 }));
  c.addChild(new Graphics().circle(0, 0, r).fill(cardColor));
  if (tex) {
    const s = new Sprite(tex);
    s.anchor.set(0.5);
    const cover = Math.max((r * 2) / tex.width, (r * 2) / tex.height);
    s.scale.set(cover);
    const mask = new Graphics().circle(0, 0, r).fill(0xffffff);
    c.addChild(s, mask);
    s.mask = mask;
  } else {
    c.addChild(new Graphics().circle(0, 0, r * 0.64).fill({ color: accent, alpha: 0.14 }));
    const bw = r * 0.52;
    const bh = r * 0.76;
    c.addChild(new Graphics().roundRect(-bw / 2, -bh / 2, bw, bh, bw * 0.22).fill(accent));
    c.addChild(new Graphics().roundRect(-bw / 2, -bh / 2, bw, bh * 0.32, bw * 0.22).fill({ color: 0xffffff, alpha: 0.22 }));
  }
  c.addChild(new Graphics().circle(0, 0, r).stroke({ color: accent, width: Math.max(2, r * 0.022), alpha: 0.5 }));
  return c;
}

/** Content band (keeps clear of 9:16 platform-UI safe zones), matching sibling templates. */
function band(aspect: Aspect, w: number, h: number): { top: number; bottom: number; left: number; right: number } {
  if (aspect === "9:16") return { top: 230, bottom: h - 410, left: 64, right: w - 64 };
  const m = Math.round(Math.min(w, h) * 0.07);
  return { top: m, bottom: h - m, left: m, right: w - m };
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, images } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F4F2EC"));
  const cardColor = pc("cardColor", "#FFFFFF");
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const textColor = str(values.textColor, pc("textColor", "#14140F"));

  const name = str(values.name, "Aero Bottle");
  const specs = specsList(values);
  const n = specs.length;
  const showLeaders = values.showLeaders !== false;

  const W = size.width;
  const H = size.height;
  const minDim = Math.min(W, H);

  const bgRect = new Graphics().rect(0, 0, W, H).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();
  const b = band(ctx.aspect, W, H);
  const bandW = b.right - b.left;
  const bandH = b.bottom - b.top;
  const clusterCx = (b.left + b.right) / 2;

  const nameSize = Math.round(minDim * 0.062);
  const nameBlockH = nameSize * 1.3;
  const gapName = minDim * 0.045;

  const clusterAvailH = bandH - nameBlockH - gapName;
  const clusterSize = Math.min(bandW, clusterAvailH);
  const clusterCy = b.top + clusterAvailH / 2;
  const R = clusterSize * 0.17;
  const leaderLen = clusterSize * 0.16;

  // --- Product frame (radial anchor) ---
  const tex = images.product ?? null;
  const frame = circleFrame(R, tex, cardColor, accent);
  frame.position.set(clusterCx, clusterCy);
  frame.scale.set(0.82);
  frame.alpha = 0;
  root.addChild(frame);
  timeline
    .to(frame, { prop: "alpha", from: 0, to: 1, start: FRAME_IN, duration: 0.4, ease: outQuad })
    .to(frame, { prop: "scale.x", from: 0.82, to: 1, start: FRAME_IN, duration: 0.75, ease: spring(0.5) })
    .to(frame, { prop: "scale.y", from: 0.82, to: 1, start: FRAME_IN, duration: 0.75, ease: spring(0.5) });

  // --- Radial spec callouts: dot pops on the product edge, a leader spoke
  // draws outward at that angle, then the label fades in beyond its tip. ---
  const angleSet = ANGLE_SETS[n] ?? ANGLE_SETS[4]!;
  const dotR = clusterSize * 0.024;
  const leaderTh = Math.max(2, clusterSize * 0.011);
  const labelSize0 = Math.round(minDim * 0.03);
  const margin = minDim * 0.045;
  const labelGap = clusterSize * 0.035;

  specs.forEach((label, i) => {
    const deg = angleSet[i] ?? angleSet[angleSet.length - 1] ?? 0;
    const rad = deg * DEG;
    const dirX = Math.cos(rad);
    const dirY = Math.sin(rad);
    const dotX = clusterCx + dirX * R;
    const dotY = clusterCy + dirY * R;
    const tipX = clusterCx + dirX * (R + leaderLen);
    const tipY = clusterCy + dirY * (R + leaderLen);
    const lx = tipX + dirX * labelGap;
    const ly = tipY + dirY * labelGap;
    const anchorX = dirX > 0.25 ? 0 : dirX < -0.25 ? 1 : 0.5;
    const anchorY = dirY > 0.35 ? 0 : dirY < -0.35 ? 1 : 0.5;
    const maxW =
      anchorX === 0
        ? b.right - margin - lx
        : anchorX === 1
          ? lx - (b.left + margin)
          : bandW * 0.42;

    const start = CALLOUT_START + i * CALLOUT_STAGGER;

    // Leader spoke (product edge → label), radial not columnar.
    if (showLeaders) {
      const leader = new Graphics().roundRect(0, -leaderTh / 2, leaderLen, leaderTh, leaderTh / 2).fill(accent);
      leader.position.set(dotX, dotY);
      leader.rotation = rad;
      leader.scale.set(0, 1);
      root.addChild(leader);
      timeline.to(leader, { prop: "scale.x", from: 0, to: 1, start: start + 0.14, duration: 0.32, ease: outExpo });
    }

    // Dot pop (on the product edge).
    const dot = new Container();
    dot.position.set(dotX, dotY);
    dot.addChild(new Graphics().circle(0, 0, dotR).fill(accent));
    dot.addChild(new Graphics().circle(0, 0, dotR * 0.42).fill(cardColor));
    dot.scale.set(0);
    root.addChild(dot);
    timeline
      .to(dot, { prop: "scale.x", from: 0, to: 1, start, duration: 0.5, ease: makeOutBack(2.0) })
      .to(dot, { prop: "scale.y", from: 0, to: 1, start, duration: 0.5, ease: makeOutBack(2.0) });

    // Label (fades + nudges outward to rest).
    const fitSize = fitOneLine(fonts, label, "display", 700, labelSize0, Math.max(60, maxW));
    const labelText = makeText(fonts, {
      text: label,
      role: "display",
      weight: 700,
      size: fitSize,
      color: textColor,
      anchor: { x: anchorX, y: anchorY },
      align: anchorX === 0.5 ? "center" : anchorX === 0 ? "left" : "right",
    });
    const nudge = clusterSize * 0.02;
    labelText.position.set(lx + dirX * nudge, ly + dirY * nudge);
    labelText.alpha = 0;
    root.addChild(labelText);
    const labelStart = start + 0.38;
    timeline
      .to(labelText, { prop: "alpha", from: 0, to: 1, start: labelStart, duration: 0.35, ease: outQuad })
      .to(labelText, { prop: "x", from: lx + dirX * nudge, to: lx, start: labelStart, duration: 0.45, ease: outQuint })
      .to(labelText, { prop: "y", from: ly + dirY * nudge, to: ly, start: labelStart, duration: 0.45, ease: outQuint });
  });

  // --- Product name (the reveal, after every spec has landed) ---
  const lastStart = CALLOUT_START + (n - 1) * CALLOUT_STAGGER;
  const nameStart = lastStart + NAME_GAP;
  const nameY = b.top + clusterAvailH + gapName + nameSize * 0.6;
  const nameFit = fitOneLine(fonts, name, "display", 700, nameSize, bandW * 0.86, 18);
  const nameText = makeText(fonts, { text: name, role: "display", weight: 700, size: nameFit, color: textColor, anchor: 0.5, align: "center" });
  nameText.position.set(clusterCx, nameY);
  nameText.alpha = 0;
  root.addChild(nameText);
  timeline
    .to(nameText, { prop: "alpha", from: 0, to: 1, start: nameStart, duration: NAME_DUR, ease: outQuad })
    .to(nameText, { prop: "y", from: nameY + 18, to: nameY, start: nameStart, duration: NAME_DUR + 0.1, ease: outQuint })
    .to(nameText, { prop: "scale.x", from: 0.92, to: 1, start: nameStart, duration: NAME_DUR, ease: outExpo })
    .to(nameText, { prop: "scale.y", from: 0.92, to: 1, start: nameStart, duration: NAME_DUR, ease: outExpo });

  return { timeline, duration: computeDuration(values) };
}

export const specCallouts: TemplateDefinition = {
  id: "spec-callouts",
  name: "Spec Callouts",
  tagline: "Specs radiate outward from the product on diagonal leader spokes.",
  category: "product",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 3.8,
  fontRoles: { name: "display" },
  estimateDuration: computeDuration,
  palettes: PALETTES,
  fields: [
    { key: "product", type: "image", label: "Product image", default: "", optional: true, help: "Centered in the circular frame; a clean product photo or transparent PNG works best." },
    { key: "name", type: "text", label: "Name", default: "Aero Bottle", maxLength: 28, shrinkToFit: true },
    { key: "specs", type: "textlist", label: "Specs", default: DEFAULT_SPECS, minItems: 2, maxItems: 4, maxLength: 22 },
    { key: "showLeaders", type: "toggle", label: "Leader lines", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
