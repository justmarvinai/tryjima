import { Container, Graphics, type Text } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  makeOutBack,
  outQuad,
  outExpo,
  outCubic,
  shrinkToFit,
  safeRect,
  type BuiltTemplate,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { groupThousands } from "../shared/format";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;

/** Rough perceived luminance of a #rrggbb color (0..1). */
function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 1;
  const n = parseInt(m[1]!, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

interface Stat {
  value: number;
  decimals: number;
  suffix: string;
}

/** Parse a compact stat like "1.2K", "980", "24.8M" into an animatable value. */
function parseStat(raw: string): Stat {
  const m = /^\s*(\d[\d,]*)(\.(\d+))?\s*([a-zA-Z]*)\s*$/.exec(raw);
  if (!m) return { value: 0, decimals: 0, suffix: "" };
  const intPart = m[1]!.replace(/,/g, "");
  const decPart = m[3] ?? "";
  const suffix = m[4] ?? "";
  const value = Number(intPart + (decPart ? "." + decPart : ""));
  return { value: Number.isFinite(value) ? value : 0, decimals: decPart.length, suffix };
}

/** Format a mid-count value, preserving the stat's decimal precision + suffix. */
function formatStat(s: Stat, frac: number): string {
  const v = s.value * frac;
  if (s.decimals > 0) return v.toFixed(s.decimals) + s.suffix;
  return groupThousands(Math.round(v)) + s.suffix;
}

/** A minimal open-eye glyph (lens + punched pupil), centered at (0,0). */
function eyeGlyph(size: number, color: string, holeColor: string): Graphics {
  const s = size;
  return new Graphics()
    .moveTo(-0.52 * s, 0)
    .quadraticCurveTo(0, -0.4 * s, 0.52 * s, 0)
    .quadraticCurveTo(0, 0.4 * s, -0.52 * s, 0)
    .closePath()
    .fill(color)
    .circle(0, 0, 0.17 * s)
    .fill(holeColor);
}

const PALETTES: Palette[] = [
  { id: "midnight", name: "Midnight", colors: { background: "#0B0B0F", textColor: "#FFFFFF", accent: "#FF3B30" } },
  { id: "daylight", name: "Daylight", colors: { background: "#FFFFFF", textColor: "#101014", accent: "#FF3B30" } },
  { id: "berry", name: "Berry", colors: { background: "#1B0620", textColor: "#FFFFFF", accent: "#FF2E9E" } },
  { id: "electric", name: "Electric", colors: { background: "#0E1020", textColor: "#FFFFFF", accent: "#7C5CFF" } },
];

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#0B0B0F"));
  const textColor = str(values.textColor, pc("textColor", "#FFFFFF"));
  const accent = str(values.accent, pc("accent", "#FF3B30"));
  const onAccent = luminance(accent) < 0.5 ? "#FFFFFF" : "#101014";

  const label = str(values.label, "LIVE");
  const viewersRaw = str(values.viewers, "1.2K");
  const showViewers = on(values.showViewers);
  const showDot = on(values.showDot);
  const showRing = on(values.showRing);

  const bgRect = new Graphics().rect(0, 0, size.width, size.height).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();
  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const safe = safeRect(ctx.aspect);
  const cx = w / 2;

  // --- Pill sizing (content-width, like a real "LIVE" badge) ---
  const pillH = minDim * 0.09;
  const dotR = pillH * 0.15;
  const padX = pillH * 0.5;
  const gapDotLabel = pillH * 0.24;
  const labelBase = Math.round(pillH * 0.42);
  const familyDisplay = fonts.family("display");
  const measureLabel = (s: string, sz: number): number =>
    fonts.measure(s, { family: familyDisplay, weight: 800, size: sz, letterSpacing: sz * 0.03 });
  const labelSize = shrinkToFit(label, measureLabel, {
    maxWidth: minDim * 0.5,
    baseSize: labelBase,
    minSize: Math.round(labelBase * 0.55),
  });
  const labelW = measureLabel(label, labelSize);
  const contentW = (showDot ? dotR * 2 + gapDotLabel : 0) + labelW;
  const pillW = contentW + padX * 2;

  // --- Viewers row sizing ---
  const eyeSize = pillH * 0.6;
  const viewersTextSize = Math.round(pillH * 0.4);
  const gapEyeText = eyeSize * 0.3;
  const viewersRowH = Math.max(eyeSize, viewersTextSize * 1.2);

  // --- Vertical stack: pill (+ ring), then the viewers row, centered in the safe area ---
  const gapClusterViewers = minDim * 0.075;
  const totalH = pillH + (showViewers ? gapClusterViewers + viewersRowH : 0);
  const top = safe.y + Math.max(0, (safe.height - totalH) / 2);
  const pillCenterY = top + pillH / 2;
  const viewersCenterY = top + pillH + gapClusterViewers + viewersRowH / 2;

  // --- Expanding ring (behind the pill; repeats a few soft pulses) ---
  if (showRing) {
    const ring = new Graphics()
      .roundRect(-pillW / 2, -pillH / 2, pillW, pillH, pillH / 2)
      .stroke({ color: accent, width: Math.max(2, pillH * 0.05) });
    ring.position.set(cx, pillCenterY);
    ring.alpha = 0;
    root.addChild(ring);

    const RING_START = 0.5;
    const RING_PERIOD = 1.0;
    const RING_CYCLES = 3;
    for (let i = 0; i < RING_CYCLES; i++) {
      const s0 = RING_START + i * RING_PERIOD;
      const d = RING_PERIOD * 0.94;
      const fadeIn = d * 0.15;
      // Each cycle fades fully in from 0 before fading back out, so the
      // earliest tween's `from` is 0 (matching the ring's true rest state) —
      // no discontinuity before the first cycle or between cycles.
      timeline
        .to(ring, { prop: "alpha", from: 0, to: 0.5, start: s0, duration: fadeIn, ease: outQuad })
        .to(ring, { prop: "alpha", from: 0.5, to: 0, start: s0 + fadeIn, duration: d - fadeIn, ease: outQuad })
        .to(ring, { prop: "scale.x", from: 1, to: 1.4, start: s0, duration: d, ease: outExpo })
        .to(ring, { prop: "scale.y", from: 1, to: 1.4, start: s0, duration: d, ease: outExpo });
    }
  }

  // --- Pill (fill + dot + label) ---
  const pill = new Container();
  pill.addChild(new Graphics().roundRect(-pillW / 2, -pillH / 2, pillW, pillH, pillH / 2).fill(accent));
  const contentLeft = -contentW / 2;

  let dot: Graphics | null = null;
  if (showDot) {
    dot = new Graphics().circle(0, 0, dotR).fill(onAccent);
    dot.position.set(contentLeft + dotR, 0);
    pill.addChild(dot);
  }

  const labelText = makeText(fonts, {
    text: label,
    role: "display",
    weight: 800,
    size: labelSize,
    color: onAccent,
    anchor: { x: 0, y: 0.5 },
    letterSpacing: labelSize * 0.03,
  });
  labelText.position.set(contentLeft + (showDot ? dotR * 2 + gapDotLabel : 0), pillH * 0.02);
  pill.addChild(labelText);

  pill.position.set(cx, pillCenterY);
  pill.alpha = 0;
  pill.scale.set(0.5);
  root.addChild(pill);

  timeline
    .to(pill, { prop: "alpha", from: 0, to: 1, start: 0.06, duration: 0.3, ease: outQuad })
    .to(pill, { prop: "scale.x", from: 0.5, to: 1, start: 0.06, duration: 0.55, ease: makeOutBack(1.9) })
    .to(pill, { prop: "scale.y", from: 0.5, to: 1, start: 0.06, duration: 0.55, ease: makeOutBack(1.9) });

  // Dot "recording" pulse — a slow alpha breathe, once the pop settles.
  if (dot) {
    const capturedDot = dot;
    const DOT_START = 0.7;
    const DOT_PERIOD = 0.8;
    const DOT_CYCLES = 3;
    for (let i = 0; i < DOT_CYCLES; i++) {
      const s0 = DOT_START + i * DOT_PERIOD;
      timeline
        .to(capturedDot, { prop: "alpha", from: 1, to: 0.32, start: s0, duration: DOT_PERIOD * 0.5, ease: outQuad })
        .to(capturedDot, { prop: "alpha", from: 0.32, to: 1, start: s0 + DOT_PERIOD * 0.5, duration: DOT_PERIOD * 0.5, ease: outQuad });
    }
  }

  // --- Viewers row: eye glyph + count that ticks up + "watching" ---
  let tickNode: Text | null = null;
  let tickStat: Stat = { value: 0, decimals: 0, suffix: "" };
  const winStart = 0.75;
  const winEnd = 1.75;

  if (showViewers) {
    const stat = parseStat(viewersRaw);
    tickStat = stat;
    const targetLabel = `${formatStat(stat, 1)} watching`;
    const familyBody = fonts.family("body");
    const measureBody = (s: string, sz: number): number => fonts.measure(s, { family: familyBody, weight: 600, size: sz });
    const availTextW = safe.width * 0.86 - eyeSize - gapEyeText;
    const vSize = shrinkToFit(targetLabel, measureBody, {
      maxWidth: availTextW,
      baseSize: viewersTextSize,
      minSize: Math.round(viewersTextSize * 0.55),
    });
    const targetW = measureBody(targetLabel, vSize);
    const rowW = eyeSize + gapEyeText + targetW;
    const rowLeft = -rowW / 2;

    const row = new Container();
    const eye = eyeGlyph(eyeSize, textColor, bg);
    eye.position.set(rowLeft + eyeSize / 2, 0);
    row.addChild(eye);

    const countText = makeText(fonts, {
      text: `${formatStat(stat, 0)} watching`,
      role: "body",
      weight: 600,
      size: vSize,
      color: textColor,
      anchor: { x: 0, y: 0.5 },
    });
    countText.position.set(rowLeft + eyeSize + gapEyeText, 0);
    row.addChild(countText);
    tickNode = countText;

    const riseAmt = minDim * 0.02;
    row.position.set(cx, viewersCenterY + riseAmt);
    row.alpha = 0;
    root.addChild(row);
    timeline
      .to(row, { prop: "alpha", from: 0, to: 1, start: 0.55, duration: 0.4, ease: outQuad })
      .to(row, { prop: "y", from: viewersCenterY + riseAmt, to: viewersCenterY, start: 0.55, duration: 0.55, ease: outExpo });
  }

  const capturedTick = tickNode;
  const capturedStat = tickStat;
  const update = capturedTick
    ? (t: number): void => {
        const u = t <= winStart ? 0 : t >= winEnd ? 1 : (t - winStart) / (winEnd - winStart);
        capturedTick.text = `${formatStat(capturedStat, outCubic(u))} watching`;
      }
    : undefined;

  const duration = 3.4;
  return update ? { timeline, duration, update } : { timeline, duration };
}

export const liveBadge: TemplateDefinition = {
  id: "live-badge",
  name: "Live Badge",
  tagline: "A pulsing LIVE badge pops in with a climbing viewer count.",
  category: "social",
  aspects: ["9:16", "1:1", "4:5", "16:9"],
  defaultAspect: "9:16",
  loopable: false,
  posterTime: 2.4,
  fontRoles: { label: "display", viewers: "body" },
  palettes: PALETTES,
  fields: [
    { key: "label", type: "text", label: "Badge text", default: "LIVE", maxLength: 10, shrinkToFit: true },
    { key: "viewers", type: "text", label: "Viewers", default: "1.2K", maxLength: 10, help: "Counts up. Use K/M for compact (1.2K)." },
    { key: "showViewers", type: "toggle", label: "Viewer count", default: true },
    { key: "showDot", type: "toggle", label: "Pulsing dot", default: true },
    { key: "showRing", type: "toggle", label: "Expanding ring", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Badge color", default: "", optional: true },
  ],
  build,
};
