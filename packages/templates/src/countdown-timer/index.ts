import { Container, Graphics, type Text } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outExpo,
  outQuad,
  spring,
  type Aspect,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { makePill } from "../shared/ui";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;

function fitSize(
  fonts: FontRegistry,
  text: string,
  role: FontRole,
  weight: number,
  size: number,
  maxWidth: number,
  letterSpacing = 0,
): number {
  const w = fonts.measure(text, {
    family: fonts.family(role),
    weight,
    size,
    ...(letterSpacing ? { letterSpacing } : {}),
  });
  return w > maxWidth ? Math.max(10, Math.floor((size * maxWidth) / w)) : size;
}

/** Parse a small non-negative integer from a string field. */
function toInt(v: unknown, fallback: number): number {
  const n = parseInt(str(v, ""), 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

const pad2 = (v: number): string => (v < 10 ? "0" + String(v) : String(v));

const PALETTES: Palette[] = [
  { id: "ember", name: "Ember", colors: { background: "#101014", textColor: "#FFFFFF", accent: "#FF4D1C", onAccent: "#FFFFFF" } },
  { id: "ink", name: "Ink", colors: { background: "#FFFFFF", textColor: "#101014", accent: "#FF4D1C", onAccent: "#FFFFFF" } },
  { id: "cobalt", name: "Cobalt", colors: { background: "#0A0A1E", textColor: "#FFFFFF", accent: "#2E7DF6", onAccent: "#FFFFFF" } },
  { id: "grape", name: "Grape", colors: { background: "#F4EFFF", textColor: "#241052", accent: "#7C5CFF", onAccent: "#FFFFFF" } },
];

type Unit = "days" | "hours" | "mins" | "secs";
const UNITS: { kind: Unit; label: string }[] = [
  { kind: "days", label: "DAYS" },
  { kind: "hours", label: "HRS" },
  { kind: "mins", label: "MIN" },
  { kind: "secs", label: "SEC" },
];

function centerYFrac(aspect: Aspect, hasCta: boolean): number {
  if (aspect === "9:16") return hasCta ? 0.46 : 0.5;
  return hasCta ? 0.47 : 0.52;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#101014"));
  const textColor = str(values.textColor, pc("textColor", "#FFFFFF"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const onAccent = pc("onAccent", "#FFFFFF");

  const w = size.width;
  const h = size.height;
  const cx = w / 2;
  const minDim = Math.min(w, h);
  const aspect = ctx.aspect;

  root.addChild(new Graphics().rect(0, 0, w, h).fill(bg));
  const timeline = new JimaTimeline();

  // Fixed start → total seconds. Remaining is a pure function of t.
  const startTotal =
    toInt(values.startDays, 2) * 86400 +
    toInt(values.startHours, 8) * 3600 +
    toInt(values.startMinutes, 45) * 60;

  const ctaRaw = str(values.cta, "");
  const hasCta = ctaRaw.length > 0;

  const sideMargin = aspect === "9:16" ? 64 : Math.round(minDim * 0.06);
  const availW = w - sideMargin * 2;
  const rowCY = h * centerYFrac(aspect, hasCta);

  // Tile sizing: 4 tiles + 3 colon gaps fit availW; capped so 16:9 stays tidy.
  const sepRatio = 0.3;
  let tileW = availW / (4 + 3 * sepRatio);
  tileW = Math.min(tileW, minDim * 0.2);
  const sepW = tileW * sepRatio;
  const tileH = tileW * 1.18;
  const rowW = tileW * 4 + sepW * 3;
  const originX = cx - rowW / 2;
  const numSize = Math.round(tileW * 0.46);
  const unitSize = Math.round(tileW * 0.15);
  const tileR = tileW * 0.16;

  // --- Headline (above tiles) ---
  const headRaw = str(values.headline, "Launching in");
  const headSize = fitSize(fonts, headRaw, "display", 700, Math.round(minDim * 0.058), availW * 0.95);
  const headY = rowCY - tileH / 2 - headSize * 1.0;
  const head = makeText(fonts, { text: headRaw, role: "display", weight: 700, size: headSize, color: textColor, anchor: 0.5, align: "center" });
  head.position.set(cx, headY);
  head.alpha = 0;
  root.addChild(head);
  timeline
    .to(head, { prop: "alpha", from: 0, to: 1, start: 0, duration: 0.4, ease: outQuad })
    .to(head, { prop: "y", from: headY - 16, to: headY, start: 0, duration: 0.5, ease: outExpo });

  // --- Tiles + colon separators ---
  const digits: { text: Text; kind: Unit }[] = [];
  UNITS.forEach((u, i) => {
    const tileCX = originX + tileW / 2 + i * (tileW + sepW);
    const tile = new Container();
    tile.position.set(tileCX, rowCY);
    tile.scale.set(0);
    root.addChild(tile);

    tile.addChild(new Graphics().roundRect(-tileW / 2, -tileH / 2, tileW, tileH, tileR).fill(accent));

    const numText = makeText(fonts, { text: "00", role: "display", weight: 700, size: numSize, color: onAccent, anchor: 0.5, align: "center" });
    numText.position.set(0, -tileH * 0.12);
    tile.addChild(numText);
    digits.push({ text: numText, kind: u.kind });

    const unit = makeText(fonts, { text: u.label, role: "body", weight: 600, size: unitSize, color: onAccent, anchor: 0.5, align: "center", letterSpacing: 1 });
    unit.position.set(0, tileH * 0.32);
    unit.alpha = 0.85;
    tile.addChild(unit);

    const start = 0.5 + i * 0.12;
    timeline
      .to(tile, { prop: "scale.x", from: 0, to: 1, start, duration: 0.6, ease: spring(0.45) })
      .to(tile, { prop: "scale.y", from: 0, to: 1, start, duration: 0.6, ease: spring(0.45) });

    // Colon between this tile and the next.
    if (i < UNITS.length - 1) {
      const colonX = tileCX + tileW / 2 + sepW / 2;
      const colon = makeText(fonts, { text: ":", role: "display", weight: 700, size: Math.round(numSize * 1.1), color: textColor, anchor: 0.5, align: "center" });
      colon.position.set(colonX, rowCY - tileH * 0.08);
      colon.alpha = 0;
      root.addChild(colon);
      timeline.to(colon, { prop: "alpha", from: 0, to: 0.85, start: 0.6 + i * 0.12, duration: 0.4, ease: outQuad });
    }
  });

  // --- CTA (optional, below tiles) ---
  if (hasCta) {
    const ctaSize = Math.round(minDim * 0.042);
    const ctaLabel = makeText(fonts, { text: ctaRaw, role: "display", weight: 700, size: ctaSize, color: bg, anchor: 0.5 });
    const ctaW = ctaLabel.width + ctaSize * 1.7;
    const ctaH = ctaSize * 2.0;
    const ctaC = new Container();
    const ctaY = rowCY + tileH / 2 + minDim * 0.09;
    ctaC.position.set(cx, ctaY);
    ctaC.addChild(makePill(ctaW, ctaH, accent));
    ctaC.addChild(ctaLabel);
    ctaC.scale.set(0);
    root.addChild(ctaC);
    timeline
      .to(ctaC, { prop: "scale.x", from: 0, to: 1, start: 1.2, duration: 0.55, ease: spring(0.45) })
      .to(ctaC, { prop: "scale.y", from: 0, to: 1, start: 1.2, duration: 0.55, ease: spring(0.45) });
  }

  // Countdown digits — pure function of t (no wall clock).
  const update = (t: number): void => {
    const rem = Math.max(0, Math.floor(startTotal - t));
    const days = Math.floor(rem / 86400);
    const hours = Math.floor(rem / 3600) % 24;
    const mins = Math.floor(rem / 60) % 60;
    const secs = rem % 60;
    for (const d of digits) {
      const v = d.kind === "days" ? days : d.kind === "hours" ? hours : d.kind === "mins" ? mins : secs;
      d.text.text = pad2(v);
    }
  };

  return { timeline, duration: 4.5, update };
}

export const countdownTimer: TemplateDefinition = {
  id: "countdown-timer",
  name: "Countdown Timer",
  tagline: "A launch countdown ticks down across four digit tiles.",
  category: "promo",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 2.6,
  palettes: PALETTES,
  fields: [
    { key: "headline", type: "text", label: "Headline", default: "Launching in", maxLength: 32, shrinkToFit: true },
    { key: "startDays", type: "text", label: "Start days", default: "02", maxLength: 3 },
    { key: "startHours", type: "text", label: "Start hours", default: "08", maxLength: 3 },
    { key: "startMinutes", type: "text", label: "Start minutes", default: "45", maxLength: 3 },
    { key: "cta", type: "text", label: "Button", default: "Get notified", maxLength: 20, optional: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
