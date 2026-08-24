import { Container, Graphics, Sprite } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outCubic,
  spring,
  type Aspect,
  type BuiltTemplate,
  type MakeTextOptions,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
  type Values,
} from "@jima/engine";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const asItems = (v: unknown, fallback: string[]): string[] => {
  if (Array.isArray(v)) {
    const arr = v.filter((s): s is string => typeof s === "string" && s.length > 0);
    if (arr.length) return arr;
  }
  return fallback;
};

const DEFAULT_COLORS = ["#FF4D1C", "#2E7DF6", "#101014", "#D8F34D"];
const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const normHex = (s: string, fb: string): string => (HEX.test(s.trim()) ? s.trim() : fb);

const PALETTES: Palette[] = [
  { id: "studio-white", name: "Studio white", colors: { background: "#F4F2EC", textColor: "#14140F", accent: "#FF4D1C", muted: "#6B6B60" } },
  { id: "electric-violet", name: "Electric violet", colors: { background: "#F1ECFB", textColor: "#180F2E", accent: "#6D3BEA", muted: "#6A5E85" } },
  { id: "splash-blue", name: "Splash blue", colors: { background: "#E9F1FC", textColor: "#0B1A2E", accent: "#1E6FE0", muted: "#5A6A82" } },
  { id: "ink", name: "Ink", colors: { background: "#101014", textColor: "#FFFFFF", accent: "#FF6A3C", muted: "#A7ADB8" } },
];

interface CVCfg {
  boxWF: number;
  boxHF: number;
  centerYF: number;
  nameF: number;
  swRF: number;
}

const CVCFG: Record<Aspect, CVCfg> = {
  "1:1": { boxWF: 0.5, boxHF: 0.42, centerYF: 0.4, nameF: 0.064, swRF: 0.03 },
  "4:5": { boxWF: 0.54, boxHF: 0.42, centerYF: 0.4, nameF: 0.066, swRF: 0.03 },
  "9:16": { boxWF: 0.6, boxHF: 0.4, centerYF: 0.4, nameF: 0.074, swRF: 0.032 },
  "16:9": { boxWF: 0.32, boxHF: 0.5, centerYF: 0.4, nameF: 0.05, swRF: 0.02 },
};

function colorList(values: Values): string[] {
  return asItems(values.colors, DEFAULT_COLORS)
    .slice(0, 6)
    .map((c, i) => normHex(c, DEFAULT_COLORS[i % DEFAULT_COLORS.length]!));
}

function computeDuration(values: Values): number {
  return 1.0 + colorList(values).length * 0.5 + 1.0;
}

/** Crisp-fit: re-make one size smaller if it would overflow maxWidth. */
function fitText(fonts: TemplateContext["fonts"], opts: MakeTextOptions, maxWidth: number) {
  const t = makeText(fonts, opts);
  if (maxWidth > 0 && t.width > maxWidth) {
    const shrunk = Math.max(8, Math.floor(opts.size * (maxWidth / t.width)));
    if (shrunk < opts.size) return makeText(fonts, { ...opts, size: shrunk });
  }
  return t;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, images } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F4F2EC"));
  const textColor = str(values.textColor, pc("textColor", "#14140F"));
  const accent = pc("accent", "#FF4D1C");
  const muted = pc("muted", "#6B6B60");
  const name = str(values.name, "Aero Bottle");
  const colors = colorList(values);
  const n = colors.length;

  const W = size.width;
  const H = size.height;
  const cx = W / 2;
  root.addChild(new Graphics().rect(0, 0, W, H).fill(bg));

  const cfg = CVCFG[ctx.aspect];
  const boxW = W * cfg.boxWF;
  const boxH = H * cfg.boxHF;
  const centerY = H * cfg.centerYF;

  const timeline = new JimaTimeline();

  const T_INTRO = 1.0;
  const PER = 0.5;
  const xfade = 0.34;

  // --- Backdrop color panels (stacked; crossfade forward) ---
  const panelsC = new Container();
  root.addChild(panelsC);
  panelsC.alpha = 0;
  timeline.to(panelsC, { prop: "alpha", from: 0, to: 1, start: 0.2, duration: 0.5, ease: outQuad });

  const panelW = boxW * 1.14;
  const panelH = boxH * 1.16;
  const panelR = Math.min(panelW, panelH) * 0.14;
  const shadow = new Graphics().roundRect(-panelW / 2, -panelH / 2 + panelH * 0.04, panelW, panelH, panelR).fill({ color: 0x000000, alpha: 0.08 });
  shadow.position.set(cx, centerY);
  panelsC.addChild(shadow);

  const panels: Graphics[] = [];
  for (let i = 0; i < n; i++) {
    const p = new Graphics().roundRect(-panelW / 2, -panelH / 2, panelW, panelH, panelR).fill(colors[i] ?? accent);
    p.position.set(cx, centerY);
    p.alpha = i === 0 ? 1 : 0;
    panelsC.addChild(p);
    panels.push(p);
  }

  // --- Product (contain-fit) with a subtle pop on each color change ---
  const prod = new Container();
  prod.position.set(cx, centerY);
  prod.alpha = 0;
  prod.scale.set(0.85);
  root.addChild(prod);
  const tex = images.product ?? null;
  if (tex) {
    const s = new Sprite(tex);
    s.anchor.set(0.5);
    s.scale.set(Math.min((boxW * 0.9) / tex.width, (boxH * 0.9) / tex.height));
    prod.addChild(s);
  } else {
    const pw = boxW * 0.4;
    const ph = boxH * 0.66;
    const r = pw * 0.18;
    prod.addChild(new Graphics().roundRect(-pw / 2, -ph / 2, pw, ph, r).fill({ color: 0xffffff, alpha: 0.9 }));
    prod.addChild(new Graphics().roundRect(-pw / 2 + pw * 0.14, -ph / 2 + pw * 0.14, pw * 0.72, ph * 0.4, r * 0.7).fill({ color: 0x000000, alpha: 0.06 }));
    prod.addChild(new Graphics().circle(0, ph * 0.18, pw * 0.2).fill({ color: 0x000000, alpha: 0.05 }));
  }
  timeline
    .to(prod, { prop: "alpha", from: 0, to: 1, start: 0.3, duration: 0.35, ease: outQuad })
    .to(prod, { prop: "scale.x", from: 0.85, to: 1, start: 0.3, duration: 0.8, ease: spring(0.55) })
    .to(prod, { prop: "scale.y", from: 0.85, to: 1, start: 0.3, duration: 0.8, ease: spring(0.55) });

  // --- Name + "Available in N colors" label ---
  const gap = Math.min(W, H) * 0.05;
  const nameSize = Math.round(W * cfg.nameF);
  const nameY = centerY + boxH * 0.5 + gap + nameSize * 0.5;
  const nameText = fitText(
    fonts,
    { text: name, role: "display", weight: 700, size: nameSize, color: textColor, anchor: 0.5, align: "center" },
    W * 0.82,
  );
  nameText.position.set(cx, nameY);
  nameText.alpha = 0;
  root.addChild(nameText);

  const capSize = Math.round(nameSize * 0.5);
  const capY = nameY + nameSize * 0.5 + capSize * 0.9;
  const capText = makeText(fonts, { text: `Available in ${n} color${n === 1 ? "" : "s"}`, role: "body", weight: 500, size: capSize, color: muted, anchor: 0.5, align: "center" });
  capText.position.set(cx, capY);
  capText.alpha = 0;
  root.addChild(capText);
  timeline
    .to(nameText, { prop: "alpha", from: 0, to: 1, start: 0.9, duration: 0.45, ease: outQuad })
    .to(nameText, { prop: "y", from: nameY + 16, to: nameY, start: 0.9, duration: 0.5, ease: outCubic })
    .to(capText, { prop: "alpha", from: 0, to: 1, start: 1.05, duration: 0.45, ease: outQuad });

  // --- Swatch row + traveling selection ring ---
  const swR = Math.max(6, W * cfg.swRF);
  const swPitch = swR * 3;
  const swW = (n - 1) * swPitch;
  const swXrel = (i: number): number => -swW / 2 + i * swPitch;
  const swatchY = capY + capSize * 0.6 + swR + gap * 0.6;
  const swatchesC = new Container();
  swatchesC.position.set(cx, swatchY);
  swatchesC.alpha = 0;
  swatchesC.scale.set(0.7);
  root.addChild(swatchesC);
  timeline
    .to(swatchesC, { prop: "alpha", from: 0, to: 1, start: 0.5, duration: 0.4, ease: outQuad })
    .to(swatchesC, { prop: "scale.x", from: 0.7, to: 1, start: 0.5, duration: 0.7, ease: spring(0.5) })
    .to(swatchesC, { prop: "scale.y", from: 0.7, to: 1, start: 0.5, duration: 0.7, ease: spring(0.5) });

  // Selection ring travels between swatches.
  const ring = new Graphics().circle(0, 0, swR * 1.34).stroke({ color: textColor, width: Math.max(2, swR * 0.18) });
  ring.position.set(swXrel(0), 0);
  swatchesC.addChild(ring);
  for (let i = 1; i < n; i++) {
    const at = T_INTRO + i * PER - xfade / 2;
    timeline.to(ring, { prop: "x", from: swXrel(i - 1), to: swXrel(i), start: at, duration: 0.4, ease: outCubic });
  }

  for (let i = 0; i < n; i++) {
    const sw = new Container();
    sw.position.set(swXrel(i), 0);
    sw.addChild(new Graphics().circle(0, 0, swR).fill(colors[i] ?? accent).stroke({ color: textColor, width: Math.max(1, swR * 0.05), alpha: 0.18 }));
    sw.scale.set(i === 0 ? 1.26 : 1);
    swatchesC.addChild(sw);

    // Highlight scale: active during this color's window.
    if (i >= 1) {
      const inAt = T_INTRO + i * PER - xfade / 2;
      timeline
        .to(sw, { prop: "scale.x", from: 1, to: 1.26, start: inAt, duration: 0.3, ease: spring(0.5) })
        .to(sw, { prop: "scale.y", from: 1, to: 1.26, start: inAt, duration: 0.3, ease: spring(0.5) });
    }
    if (i < n - 1) {
      const outAt = T_INTRO + (i + 1) * PER - xfade / 2;
      timeline
        .to(sw, { prop: "scale.x", from: 1.26, to: 1, start: outAt, duration: 0.3, ease: outCubic })
        .to(sw, { prop: "scale.y", from: 1.26, to: 1, start: outAt, duration: 0.3, ease: outCubic });
    }

    // Backdrop panel + product pop on entering this color.
    if (i >= 1) {
      const at = T_INTRO + i * PER - xfade / 2;
      timeline.to(panels[i]!, { prop: "alpha", from: 0, to: 1, start: at, duration: xfade, ease: outQuad });
      timeline.to(panels[i - 1]!, { prop: "alpha", from: 1, to: 0, start: at + xfade * 0.6, duration: xfade, ease: outQuad });
      timeline
        .to(prod, { prop: "scale.x", from: 1, to: 1.05, start: at, duration: 0.16, ease: outQuad })
        .to(prod, { prop: "scale.y", from: 1, to: 1.05, start: at, duration: 0.16, ease: outQuad })
        .to(prod, { prop: "scale.x", from: 1.05, to: 1, start: at + 0.16, duration: 0.24, ease: outCubic })
        .to(prod, { prop: "scale.y", from: 1.05, to: 1, start: at + 0.16, duration: 0.24, ease: outCubic });
    }
  }

  return { timeline, duration: computeDuration(values) };
}

export const colorVariants: TemplateDefinition = {
  id: "color-variants",
  name: "Color Variants",
  tagline: "A product cycles its color swatches, backdrop shifting to match.",
  category: "product",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "4:5",
  loopable: false,
  posterTime: 2.8,
  estimateDuration: computeDuration,
  palettes: PALETTES,
  fields: [
    { key: "product", type: "image", label: "Product image", default: "", optional: true, help: "Transparent PNG works best against the color backdrop." },
    { key: "name", type: "text", label: "Name", default: "Aero Bottle", maxLength: 28, shrinkToFit: true },
    { key: "colors", type: "textlist", label: "Colors", default: DEFAULT_COLORS, minItems: 2, maxItems: 6, maxLength: 9, help: "Hex colors, e.g. #FF4D1C." },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
  ],
  build,
};
