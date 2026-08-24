import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outQuint,
  outExpo,
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

const DEG = Math.PI / 180;
const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;
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
  return w > maxWidth ? Math.max(10, Math.floor((size * maxWidth) / w)) : size;
}

// A desktop-OS moment: three app windows spring open from different corners,
// overlap into a tidy cascade, the front window's content draws itself in, and
// a headline chip stamps underneath. Traffic-light dots stay macOS-semantic.
const TRAFFIC = ["#FF5F57", "#FEBC2E", "#28C840"] as const;

const PALETTES: Palette[] = [
  {
    id: "slate",
    name: "Slate",
    colors: {
      background: "#EEF1F6", cardColor: "#FFFFFF", barColor: "#F2F4F8", cardInk: "#1A1F27",
      textColor: "#14181F", accent: "#3B6EF5", muted: "#98A2B3", skeleton: "#E7EAF0",
      chipBg: "#14181F", chipText: "#FFFFFF",
    },
  },
  {
    id: "peach",
    name: "Peach",
    colors: {
      background: "#FDF1E7", cardColor: "#FFFFFF", barColor: "#FAF3EC", cardInk: "#38260F",
      textColor: "#38260F", accent: "#F4762C", muted: "#C2A98F", skeleton: "#F0E7DC",
      chipBg: "#38260F", chipText: "#FFF6EC",
    },
  },
  {
    id: "sage",
    name: "Sage",
    colors: {
      background: "#EBF4EC", cardColor: "#FFFFFF", barColor: "#F0F6F1", cardInk: "#16301D",
      textColor: "#16301D", accent: "#2E9E5B", muted: "#94B49D", skeleton: "#E3EEE5",
      chipBg: "#16301D", chipText: "#EFFAF2",
    },
  },
  {
    id: "graphite",
    name: "Graphite",
    colors: {
      background: "#121419", cardColor: "#1E222B", barColor: "#262B36", cardInk: "#E9EDF4",
      textColor: "#EFF2F7", accent: "#5B8CFF", muted: "#7C8698", skeleton: "#2E3442",
      chipBg: "#E9EDF4", chipText: "#14181F",
    },
  },
];

const DEFAULT_WINDOWS = ["Notes", "Board", "Preview"];

/** A small "picture" glyph for the front window's media block. */
function imageGlyph(s: number, color: string): Graphics {
  const g = new Graphics();
  g.circle(-0.18 * s, -0.12 * s, 0.1 * s).fill(color);
  g.poly([-0.46 * s, 0.34 * s, -0.12 * s, -0.06 * s, 0.06 * s, 0.12 * s, 0.3 * s, -0.14 * s, 0.46 * s, 0.34 * s]).fill(color);
  return g;
}

interface WinColors {
  cardColor: string;
  barColor: string;
  cardInk: string;
  muted: string;
  skeleton: string;
  accent: string;
}

interface MadeWindow {
  node: Container;
  inner: Container;
}

/**
 * A window whose transform origin sits at (ax, ay) window-fractions — so each
 * one can scale open from a slightly different corner.
 */
function makeWindow(
  fonts: FontRegistry,
  titleLabel: string,
  w0: number,
  h0: number,
  ax: number,
  ay: number,
  colors: WinColors,
  withShadow: boolean,
): MadeWindow {
  const node = new Container();
  const inner = new Container();
  inner.position.set((0.5 - ax) * w0, (0.5 - ay) * h0);
  node.addChild(inner);

  const r = w0 * 0.032;
  const tb = h0 * 0.125;
  if (withShadow) {
    inner.addChild(new Graphics().roundRect(-w0 / 2, -h0 / 2 + h0 * 0.035, w0, h0, r).fill({ color: "#000000", alpha: 0.16 }));
  }
  inner.addChild(new Graphics().roundRect(-w0 / 2, -h0 / 2, w0, h0, r).fill(colors.cardColor));
  // Title bar (top corners rounded only — patch the bar's lower rounding).
  inner.addChild(new Graphics().roundRect(-w0 / 2, -h0 / 2, w0, tb + r, r).fill(colors.barColor));
  inner.addChild(new Graphics().rect(-w0 / 2, -h0 / 2 + tb, w0, r).fill(colors.cardColor));
  inner.addChild(new Graphics().roundRect(-w0 / 2, -h0 / 2, w0, h0, r).stroke({ color: colors.cardInk, width: Math.max(1, w0 * 0.0035), alpha: 0.1 }));

  const dotR = Math.max(3.5, w0 * 0.011);
  const dotsG = new Graphics();
  TRAFFIC.forEach((c, i) => {
    dotsG.circle(-w0 / 2 + w0 * 0.045 + i * dotR * 3.1, -h0 / 2 + tb / 2, dotR).fill(c);
  });
  inner.addChild(dotsG);

  const tSize = fitSize(fonts, titleLabel, "body", 600, Math.round(tb * 0.42), w0 * 0.42);
  const tText = makeText(fonts, { text: titleLabel, role: "body", weight: 600, size: tSize, color: colors.cardInk, anchor: { x: 0.5, y: 0.5 } });
  tText.position.set(0, -h0 / 2 + tb / 2);
  tText.alpha = 0.75;
  inner.addChild(tText);

  return { node, inner };
}

interface Cfg {
  winWF: number; // base window width as a fraction of frame width
  ratio: number; // window width / height
}
const CFG: Record<Aspect, Cfg> = {
  "16:9": { winWF: 0.4, ratio: 1.5 },
  "1:1": { winWF: 0.6, ratio: 1.44 },
  "4:5": { winWF: 0.64, ratio: 1.4 },
  "9:16": { winWF: 0.68, ratio: 1.18 },
};

const OPEN_STARTS = [0.15, 0.5, 0.85] as const;
const LINES_START = 1.6;
const CHIP_START = 2.7;
const DURATION = 4.1;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#EEF1F6"));
  const cardColor = pc("cardColor", "#FFFFFF");
  const barColor = pc("barColor", "#F2F4F8");
  const cardInk = pc("cardInk", "#1A1F27");
  const accent = str(values.accent, pc("accent", "#3B6EF5"));
  const muted = pc("muted", "#98A2B3");
  const skeleton = pc("skeleton", "#E7EAF0");
  const chipBg = pc("chipBg", "#14181F");
  const chipTextC = pc("chipText", "#FFFFFF");

  const title = str(values.title, "All your tools, open");
  const winTitles = asList(values.windows, DEFAULT_WINDOWS).slice(0, 3);
  while (winTitles.length < 3) winTitles.push(DEFAULT_WINDOWS[winTitles.length]!);
  const showShadows = on(values.showShadows);
  const showBadge = on(values.showBadge);

  const w = size.width;
  const h = size.height;
  const cx = w / 2;
  const minDim = Math.min(w, h);
  const cfg = CFG[ctx.aspect];
  const safe = safeRect(ctx.aspect);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Cascade geometry (clamped so the whole group stays in the safe area) ---
  const chipH = Math.max(minDim * 0.058, 42);
  const chipGap = minDim * 0.04;
  let WW = Math.min(w * cfg.winWF, safe.width / 1.34);
  let WH = WW / cfg.ratio;
  const boundHMax = safe.height - chipGap - chipH;
  if (WH * 1.46 > boundHMax) {
    WH = boundHMax / 1.46;
    WW = Math.min(WW, WH * cfg.ratio);
    WH = WW / cfg.ratio;
  }
  const dx = WW * 0.16;
  const dy = WH * 0.23;
  const boundH = WH + 2 * dy;
  const top = safe.y + Math.max(0, (safe.height - (boundH + chipGap + chipH)) / 2);
  const gy = top + boundH / 2;
  const chipY = top + boundH + chipGap + chipH / 2;

  const winColors: WinColors = { cardColor, barColor, cardInk, muted, skeleton, accent };

  // Window specs back → front: size, center offset, and scale-open origin.
  const specs = [
    { s: 0.9, ox: -dx, oy: -dy, ax: 0.12, ay: 0.1 },
    { s: 0.95, ox: dx * 0.9, oy: -dy * 0.15, ax: 0.5, ay: 0.06 },
    { s: 1.0, ox: -dx * 0.35, oy: dy, ax: 0.82, ay: 0.92 },
  ] as const;

  specs.forEach((spec, i) => {
    const w0 = WW * spec.s;
    const h0 = WH * spec.s;
    const made = makeWindow(fonts, winTitles[i]!, w0, h0, spec.ax, spec.ay, winColors, showShadows);
    const win = made.node;
    // Position the ORIGIN point so the window's center lands at (ox, oy).
    win.position.set(cx + spec.ox - (0.5 - spec.ax) * w0, gy + spec.oy - (0.5 - spec.ay) * h0);
    win.alpha = 0;
    win.scale.set(0.55);
    root.addChild(win);
    const st = OPEN_STARTS[i]!;
    timeline
      .to(win, { prop: "alpha", from: 0, to: 1, start: st, duration: 0.3, ease: outQuad })
      .to(win, { prop: "scale.x", from: 0.55, to: 1, start: st, duration: 0.6, ease: makeOutBack(1.35) })
      .to(win, { prop: "scale.y", from: 0.55, to: 1, start: st, duration: 0.6, ease: makeOutBack(1.35) });

    const tb = h0 * 0.125;
    const pad = w0 * 0.06;
    const innerW = w0 - pad * 2;
    const contentTop = -h0 / 2 + tb + h0 * 0.07;

    if (i === 0) {
      // Back window: a quiet sidebar + rows skeleton.
      const g = new Graphics();
      g.roundRect(-w0 / 2 + pad, contentTop, innerW * 0.24, h0 * 0.62, w0 * 0.02).fill(skeleton);
      for (let k = 0; k < 3; k++) {
        g.roundRect(-w0 / 2 + pad + innerW * 0.3, contentTop + k * h0 * 0.16, innerW * 0.66, h0 * 0.1, w0 * 0.015).fill({ color: skeleton, alpha: 0.85 });
      }
      made.inner.addChild(g);
    } else if (i === 1) {
      // Mid window: two tiles + text bars.
      const g = new Graphics();
      const tileW = innerW * 0.47;
      g.roundRect(-w0 / 2 + pad, contentTop, tileW, h0 * 0.3, w0 * 0.02).fill({ color: accent, alpha: 0.16 });
      g.roundRect(-w0 / 2 + pad + innerW * 0.53, contentTop, tileW, h0 * 0.3, w0 * 0.02).fill(skeleton);
      g.roundRect(-w0 / 2 + pad, contentTop + h0 * 0.38, innerW * 0.8, h0 * 0.05, h0 * 0.025).fill(skeleton);
      g.roundRect(-w0 / 2 + pad, contentTop + h0 * 0.48, innerW * 0.62, h0 * 0.05, h0 * 0.025).fill({ color: skeleton, alpha: 0.85 });
      made.inner.addChild(g);
    } else {
      // Front window: content draws itself in once the cascade settles.
      if (showBadge) {
        const badge = new Graphics().circle(w0 / 2 - w0 * 0.05, -h0 / 2 + tb / 2, Math.max(4, w0 * 0.014)).fill(accent);
        made.inner.addChild(badge);
      }
      const mediaH = h0 * 0.3;
      const media = new Container();
      const mg = new Graphics().roundRect(-innerW / 2, -mediaH / 2, innerW, mediaH, w0 * 0.02).fill({ color: accent, alpha: 0.16 });
      media.addChild(mg);
      const glyph = imageGlyph(mediaH * 0.66, accent);
      media.addChild(glyph);
      media.position.set(0, contentTop + mediaH / 2);
      media.alpha = 0;
      media.scale.set(0.94);
      made.inner.addChild(media);
      timeline
        .to(media, { prop: "alpha", from: 0, to: 1, start: LINES_START + 0.45, duration: 0.4, ease: outQuad })
        .to(media, { prop: "scale.x", from: 0.94, to: 1, start: LINES_START + 0.45, duration: 0.45, ease: outQuint })
        .to(media, { prop: "scale.y", from: 0.94, to: 1, start: LINES_START + 0.45, duration: 0.45, ease: outQuint });

      const lineSpecs = [
        { wF: 0.66, hF: 0.052, color: cardInk, alpha: 0.9 },
        { wF: 0.92, hF: 0.036, color: muted, alpha: 0.7 },
        { wF: 0.78, hF: 0.036, color: muted, alpha: 0.7 },
      ];
      let ly = contentTop + mediaH + h0 * 0.075;
      lineSpecs.forEach((ls, k) => {
        const bh = h0 * ls.hF;
        const bar = new Container();
        bar.addChild(new Graphics().roundRect(0, -bh / 2, innerW * ls.wF, bh, bh / 2).fill({ color: ls.color, alpha: ls.alpha }));
        bar.position.set(-innerW / 2, ly);
        bar.scale.x = 0;
        made.inner.addChild(bar);
        timeline.to(bar, { prop: "scale.x", from: 0, to: 1, start: LINES_START + k * 0.15, duration: 0.5, ease: outExpo });
        ly += bh + h0 * 0.055;
      });
      const btnW = innerW * 0.3;
      const btnH = h0 * 0.085;
      const btn = new Container();
      btn.addChild(new Graphics().roundRect(-btnW / 2, -btnH / 2, btnW, btnH, btnH / 2).fill(accent));
      btn.addChild(new Graphics().roundRect(-btnW * 0.26, -btnH * 0.11, btnW * 0.52, btnH * 0.22, btnH * 0.11).fill("#FFFFFF"));
      btn.position.set(-innerW / 2 + btnW / 2, ly + btnH * 0.4);
      btn.alpha = 0;
      btn.scale.set(0.7);
      made.inner.addChild(btn);
      timeline
        .to(btn, { prop: "alpha", from: 0, to: 1, start: LINES_START + 0.7, duration: 0.3, ease: outQuad })
        .to(btn, { prop: "scale.x", from: 0.7, to: 1, start: LINES_START + 0.7, duration: 0.45, ease: makeOutBack(1.8) })
        .to(btn, { prop: "scale.y", from: 0.7, to: 1, start: LINES_START + 0.7, duration: 0.45, ease: makeOutBack(1.8) });
    }
  });

  // --- Headline chip stamps in below the cascade ---
  const chipInk = str(values.textColor, chipTextC);
  const chipSize = fitSize(fonts, title, "display", 700, Math.round(chipH * 0.44), safe.width * 0.8);
  const chipLabel = makeText(fonts, { text: title, role: "display", weight: 700, size: chipSize, color: chipInk, anchor: 0.5 });
  const chipW = chipLabel.width + chipH * 1.3;
  const chip = new Container();
  chip.addChild(new Graphics().roundRect(-chipW / 2, -chipH / 2 + chipH * 0.07, chipW, chipH, chipH / 2).fill({ color: "#000000", alpha: 0.14 }));
  chip.addChild(new Graphics().roundRect(-chipW / 2, -chipH / 2, chipW, chipH, chipH / 2).fill(chipBg));
  chip.addChild(chipLabel);
  chip.position.set(cx, chipY);
  chip.alpha = 0;
  chip.scale.set(1.25);
  chip.rotation = -2 * DEG;
  root.addChild(chip);
  timeline
    .to(chip, { prop: "alpha", from: 0, to: 1, start: CHIP_START, duration: 0.25, ease: outQuad })
    .to(chip, { prop: "scale.x", from: 1.25, to: 1, start: CHIP_START, duration: 0.5, ease: outQuint })
    .to(chip, { prop: "scale.y", from: 1.25, to: 1, start: CHIP_START, duration: 0.5, ease: outQuint })
    .to(chip, { prop: "rotation", from: -2 * DEG, to: 0, start: CHIP_START, duration: 0.5, ease: outQuint });

  return { timeline, duration: DURATION };
}

export const windowCascade: TemplateDefinition = {
  id: "window-cascade",
  name: "Window Cascade",
  tagline: "Three app windows spring open and settle into a tidy cascade.",
  category: "tech",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 3.5,
  fontRoles: { title: "display", windows: "body" },
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Headline chip", default: "All your tools, open", maxLength: 30, shrinkToFit: true },
    { key: "windows", type: "textlist", label: "Window titles", default: DEFAULT_WINDOWS, minItems: 3, maxItems: 3, maxLength: 16, help: "Back, middle, then front window." },
    { key: "showShadows", type: "toggle", label: "Window shadows", default: true },
    { key: "showBadge", type: "toggle", label: "Notification dot", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Chip text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
