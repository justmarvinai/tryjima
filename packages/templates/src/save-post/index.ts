import { Container, Graphics, type Text } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  outCubic,
  spring,
  makeOutBack,
  safeRect,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { makeIcon } from "../shared/icons";
import { groupThousands } from "../shared/format";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;

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

interface Stat {
  value: number;
  decimals: number;
  suffix: string;
}
/** Parse a compact count like "1,204", "24.5K", "97" into an animatable value. */
function parseStat(raw: string): Stat {
  const m = /^\s*(\d[\d,]*)(\.(\d+))?\s*([a-zA-Z%]*)\s*$/.exec(raw);
  if (!m) return { value: 0, decimals: 0, suffix: "" };
  const intPart = (m[1] ?? "0").replace(/,/g, "");
  const decPart = m[3] ?? "";
  const suffix = m[4] ?? "";
  const value = Number(intPart + (decPart ? "." + decPart : ""));
  return { value: Number.isFinite(value) ? value : 0, decimals: decPart.length, suffix };
}
function formatStat(s: Stat, frac: number): string {
  const v = s.value * frac;
  if (s.decimals > 0) return v.toFixed(s.decimals) + s.suffix;
  return groupThousands(Math.round(v)) + s.suffix;
}

// A bookmark save micro-interaction. Only the full-frame `bg` rect is tied to
// the background field (blanked by transparent export); the button + toast use
// their own palette-only `cardBg` so they survive as overlay content.
const PALETTES: Palette[] = [
  { id: "light", name: "Light", colors: { background: "#EEF1F6", cardBg: "#FFFFFF", textColor: "#101014", accent: "#FF4D1C" } },
  { id: "midnight", name: "Midnight", colors: { background: "#0C0C10", cardBg: "#1B1E27", textColor: "#FFFFFF", accent: "#FF6A3D" } },
  { id: "sky", name: "Sky", colors: { background: "#EAF3FF", cardBg: "#FFFFFF", textColor: "#0B2447", accent: "#2E7DF6" } },
  { id: "grape-night", name: "Grape night", colors: { background: "#150F24", cardBg: "#221833", textColor: "#FFFFFF", accent: "#B58BFF" } },
];

const BOOKMARK_PTS = (S: number): number[] => [
  -0.28 * S, -0.44 * S, 0.28 * S, -0.44 * S, 0.28 * S, 0.44 * S, 0, 0.22 * S, -0.28 * S, 0.44 * S,
];

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#EEF1F6"));
  const cardBg = pc("cardBg", "#FFFFFF");
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));

  const label = str(values.label, "Saved");
  const showCount = values.showCount !== false;
  const showBurst = values.showBurst !== false;
  const stat = parseStat(str(values.count, "1,204"));

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const cx = w / 2;
  const safe = safeRect(ctx.aspect);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  const buttonR = Math.round(minDim * 0.108);
  const bmSize = buttonR * 1.15;

  // --- Toast pill sizing ---
  const maxLabelW = Math.min(safe.width * 0.6, minDim * 0.52);
  const toastFont = fitSize(fonts, label, "display", 700, Math.round(minDim * 0.037), maxLabelW);
  const labelW = fonts.measure(label, { family: fonts.family("display"), weight: 700, size: toastFont });
  const checkSize = toastFont * 1.05;
  const toastPadX = Math.round(minDim * 0.032);
  const toastGap = Math.round(minDim * 0.016);
  const toastW = toastPadX * 2 + checkSize + toastGap + labelW;
  const toastH = Math.round(Math.max(checkSize, toastFont) * 1.95);

  const countFont = Math.round(minDim * 0.044);
  const countH = countFont * 1.1;

  const gap1 = Math.round(minDim * 0.055); // button -> toast
  const gap2 = Math.round(minDim * 0.03); // toast -> count

  const total = 2 * buttonR + gap1 + toastH + (showCount ? gap2 + countH : 0);
  const top = safe.y + Math.max(0, (safe.height - total) / 2);

  const buttonCy = top + buttonR;
  const toastCy = top + 2 * buttonR + gap1 + toastH / 2;
  const countCy = toastCy + toastH / 2 + gap2 + countH / 2;

  // --- Save button (track circle + bookmark that fills with accent) ---
  const button = new Container();
  button.position.set(cx, buttonCy);
  button.scale.set(0);
  root.addChild(button);
  // soft shadow
  button.addChild(new Graphics().circle(0, buttonR * 0.06, buttonR).fill({ color: "#000000", alpha: 0.14 }));
  button.addChild(new Graphics().circle(0, 0, buttonR).fill(cardBg));
  // empty (outline) bookmark, always present under the fill
  button.addChild(
    new Graphics()
      .poly(BOOKMARK_PTS(bmSize), true)
      .stroke({ color: textColor, width: Math.max(3, bmSize * 0.05), join: "round", cap: "round", alpha: 0.32 }),
  );
  timeline
    .to(button, { prop: "scale.x", from: 0, to: 1, start: 0.05, duration: 0.55, ease: spring(0.5) })
    .to(button, { prop: "scale.y", from: 0, to: 1, start: 0.05, duration: 0.55, ease: spring(0.5) });

  // Accent-filled bookmark pops on top — the "saved" moment.
  const FILL_AT = 0.42;
  const filled = new Graphics().poly(BOOKMARK_PTS(bmSize * 1.05), true).fill(accent);
  filled.position.set(cx, buttonCy);
  filled.scale.set(0);
  root.addChild(filled);
  timeline
    .to(filled, { prop: "scale.x", from: 0, to: 1, start: FILL_AT, duration: 0.5, ease: makeOutBack(2.2) })
    .to(filled, { prop: "scale.y", from: 0, to: 1, start: FILL_AT, duration: 0.5, ease: makeOutBack(2.2) })
    // little confirmation beat once it lands
    .to(filled, { prop: "scale.x", from: 1, to: 1.12, start: FILL_AT + 0.6, duration: 0.14, ease: outQuad })
    .to(filled, { prop: "scale.y", from: 1, to: 1.12, start: FILL_AT + 0.6, duration: 0.14, ease: outQuad })
    .to(filled, { prop: "scale.x", from: 1.12, to: 1, start: FILL_AT + 0.74, duration: 0.26, ease: outQuad })
    .to(filled, { prop: "scale.y", from: 1.12, to: 1, start: FILL_AT + 0.74, duration: 0.26, ease: outQuad });

  // Accent ripple ring on save.
  if (showBurst) {
    const ring = new Graphics().circle(0, 0, buttonR * 0.92).stroke({ color: accent, width: Math.max(3, buttonR * 0.06) });
    ring.position.set(cx, buttonCy);
    ring.alpha = 0;
    ring.scale.set(0.55);
    root.addChild(ring);
    timeline
      .to(ring, { prop: "alpha", from: 0, to: 0.55, start: FILL_AT + 0.02, duration: 0.12, ease: outQuad })
      .to(ring, { prop: "alpha", from: 0.55, to: 0, start: FILL_AT + 0.14, duration: 0.4, ease: outQuad })
      .to(ring, { prop: "scale.x", from: 0.55, to: 1.8, start: FILL_AT + 0.02, duration: 0.52, ease: outExpo })
      .to(ring, { prop: "scale.y", from: 0.55, to: 1.8, start: FILL_AT + 0.02, duration: 0.52, ease: outExpo });
  }

  // --- "Saved" toast ---
  const toast = new Container();
  toast.position.set(cx, toastCy);
  toast.alpha = 0;
  root.addChild(toast);
  const te = Math.round(toastH * 0.05);
  toast.addChild(
    new Graphics()
      .roundRect(-toastW / 2 - te, -toastH / 2 - te + te * 1.6, toastW + te * 2, toastH + te * 2, toastH / 2)
      .fill({ color: "#000000", alpha: 0.14 }),
  );
  toast.addChild(new Graphics().roundRect(-toastW / 2, -toastH / 2, toastW, toastH, toastH / 2).fill(cardBg));
  const check = makeIcon("check", checkSize, { color: accent });
  check.position.set(-toastW / 2 + toastPadX + checkSize / 2, 0);
  toast.addChild(check);
  const labelText = makeText(fonts, {
    text: label,
    role: "display",
    weight: 700,
    size: toastFont,
    color: textColor,
    anchor: { x: 0, y: 0.5 },
  });
  labelText.position.set(-toastW / 2 + toastPadX + checkSize + toastGap, 0);
  toast.addChild(labelText);
  timeline
    .to(toast, { prop: "alpha", from: 0, to: 1, start: 0.62, duration: 0.35, ease: outQuad })
    .to(toast, { prop: "y", from: toastCy + minDim * 0.03, to: toastCy, start: 0.62, duration: 0.55, ease: outExpo });

  // --- Count that ticks up ---
  let countText: Text | null = null;
  const CS = 0.72;
  const CE = 2.0;
  if (showCount) {
    countText = makeText(fonts, {
      text: formatStat(stat, 0),
      role: "display",
      weight: 700,
      size: countFont,
      color: textColor,
      anchor: 0.5,
    });
    countText.position.set(cx, countCy);
    countText.alpha = 0;
    root.addChild(countText);
    timeline.to(countText, { prop: "alpha", from: 0, to: 0.72, start: CS, duration: 0.4, ease: outQuad });
  }

  const captured = countText;
  const update = (t: number): void => {
    if (!captured) return;
    const u = t <= CS ? 0 : t >= CE ? 1 : (t - CS) / (CE - CS);
    captured.text = formatStat(stat, outCubic(u));
  };

  return { timeline, duration: 3.6, update };
}

export const savePost: TemplateDefinition = {
  id: "save-post",
  name: "Save Post",
  tagline: "A bookmark fills with a little pop as a Saved toast and count appear.",
  category: "social",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "9:16",
  loopable: false,
  posterTime: 2.4,
  fontRoles: { label: "display", count: "display" },
  palettes: PALETTES,
  fields: [
    { key: "label", type: "text", label: "Toast label", default: "Saved", maxLength: 20, shrinkToFit: true },
    { key: "count", type: "text", label: "Save count", default: "1,204", maxLength: 10, help: "Counts up. Use K/M for compact (12.4K).", shrinkToFit: true },
    { key: "showCount", type: "toggle", label: "Show count", default: true },
    { key: "showBurst", type: "toggle", label: "Save ripple", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
