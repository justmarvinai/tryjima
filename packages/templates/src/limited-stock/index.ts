import { Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  inQuad,
  type BuiltTemplate,
  type MakeTextOptions,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const num = (v: unknown, fallback: number): number => (typeof v === "number" ? v : fallback);

const PALETTES: Palette[] = [
  { id: "ember", name: "Ember", colors: { background: "#101014", textColor: "#FFFFFF", accent: "#FF4D1C" } },
  { id: "lime-ink", name: "Lime ink", colors: { background: "#101014", textColor: "#FFFFFF", accent: "#D8F34D" } },
  { id: "berry", name: "Berry", colors: { background: "#1A0A14", textColor: "#FFFFFF", accent: "#FF2E9E" } },
  { id: "electric", name: "Electric", colors: { background: "#0A0A1E", textColor: "#FFFFFF", accent: "#2E7DF6" } },
];

/** Create text, shrinking one size if it would overflow `maxWidth` (crisp, never upscaled). */
function fitText(fonts: TemplateContext["fonts"], opts: MakeTextOptions, maxWidth: number) {
  const t = makeText(fonts, opts);
  if (maxWidth > 0 && t.width > maxWidth) {
    const shrunk = Math.max(8, Math.floor(opts.size * (maxWidth / t.width)));
    if (shrunk < opts.size) return makeText(fonts, { ...opts, size: shrunk });
  }
  return t;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#101014"));
  const textColor = str(values.textColor, pc("textColor", "#FFFFFF"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const headline = str(values.headline, "Almost gone");
  const leftLabel = str(values.leftLabel, "Only 3 left");
  const showBar = values.showBar !== false;
  const stockLevel = Math.max(5, Math.min(40, num(values.stockLevel, 15)));
  const stockFrac = stockLevel / 100;

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const cx = w / 2;

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Layout: headline → bar (optional) → "left" line, vertically centered ---
  const headSize = Math.round(minDim * 0.095);
  const labelSize = Math.round(minDim * 0.052);
  const barW = w * 0.7;
  const barH = Math.max(16, minDim * 0.05);
  const gapA = minDim * 0.08;
  const gapB = minDim * 0.075;
  const headH = headSize * 1.15;
  const labelH = labelSize * 1.3;
  const midGap = showBar ? barH + gapB : gapB;
  const totalH = headH + gapA + midGap + labelH;

  const top = h * 0.5 - totalH / 2;
  const headY = top + headH / 2;
  const barY = top + headH + gapA + barH / 2;
  const labelY = top + headH + gapA + midGap + labelH / 2;

  // --- Headline (slams in) ---
  const head = fitText(
    fonts,
    { text: headline, role: "display", weight: 700, size: headSize, color: textColor, anchor: 0.5, align: "center" },
    w * 0.86,
  );
  head.position.set(cx, headY);
  head.alpha = 0;
  root.addChild(head);
  timeline
    .to(head, { prop: "alpha", from: 0, to: 1, start: 0.15, duration: 0.2, ease: outQuad })
    .to(head, { prop: "scale.x", from: 1.32, to: 1, start: 0.15, duration: 0.4, ease: outExpo })
    .to(head, { prop: "scale.y", from: 1.32, to: 1, start: 0.15, duration: 0.4, ease: outExpo });

  // --- Stock bar: fills, then depletes down to the low stock level ---
  if (showBar) {
    const barX = cx - barW / 2;
    const track = new Graphics().roundRect(0, 0, barW, barH, barH / 2).fill({ color: textColor, alpha: 0.16 });
    track.position.set(barX, barY - barH / 2);
    track.scale.set(0, 1);
    root.addChild(track);
    timeline.to(track, { prop: "scale.x", from: 0, to: 1, start: 0.7, duration: 0.4, ease: outExpo });

    const fill = new Graphics().roundRect(0, 0, barW, barH, barH / 2).fill(accent);
    fill.position.set(barX, barY - barH / 2);
    fill.scale.set(0, 1);
    root.addChild(fill);
    timeline
      .to(fill, { prop: "scale.x", from: 0, to: 1, start: 0.85, duration: 0.35, ease: outExpo })
      .to(fill, { prop: "scale.x", from: 1, to: stockFrac, start: 1.3, duration: 1.6, ease: inQuad });
  }

  // --- "Only X left" line, with a couple of urgency pulses ---
  const label = fitText(
    fonts,
    { text: leftLabel, role: "display", weight: 700, size: labelSize, color: accent, anchor: 0.5, align: "center" },
    w * 0.82,
  );
  label.position.set(cx, labelY);
  label.alpha = 0;
  root.addChild(label);
  timeline
    .to(label, { prop: "alpha", from: 0, to: 1, start: 1.6, duration: 0.5, ease: outQuad })
    .to(label, { prop: "y", from: labelY + 14, to: labelY, start: 1.6, duration: 0.55, ease: outExpo })
    .to(label, { prop: "scale.x", from: 1, to: 1.07, start: 2.3, duration: 0.3, ease: outQuad })
    .to(label, { prop: "scale.x", from: 1.07, to: 1, start: 2.6, duration: 0.35, ease: outQuad })
    .to(label, { prop: "scale.y", from: 1, to: 1.07, start: 2.3, duration: 0.3, ease: outQuad })
    .to(label, { prop: "scale.y", from: 1.07, to: 1, start: 2.6, duration: 0.35, ease: outQuad })
    .to(label, { prop: "scale.x", from: 1, to: 1.07, start: 3.3, duration: 0.3, ease: outQuad })
    .to(label, { prop: "scale.x", from: 1.07, to: 1, start: 3.6, duration: 0.35, ease: outQuad })
    .to(label, { prop: "scale.y", from: 1, to: 1.07, start: 3.3, duration: 0.3, ease: outQuad })
    .to(label, { prop: "scale.y", from: 1.07, to: 1, start: 3.6, duration: 0.35, ease: outQuad });

  return { timeline, duration: 4.2 };
}

export const limitedStock: TemplateDefinition = {
  id: "limited-stock",
  name: "Limited Stock",
  tagline: "An urgency bar drains down as the stock line lands.",
  category: "promo",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 3.0,
  palettes: PALETTES,
  fields: [
    { key: "headline", type: "text", label: "Headline", default: "Almost gone", maxLength: 28, shrinkToFit: true },
    { key: "leftLabel", type: "text", label: "Stock line", default: "Only 3 left", maxLength: 26, shrinkToFit: true },
    { key: "stockLevel", type: "slider", label: "Stock remaining (%)", default: 15, min: 5, max: 40, step: 1 },
    { key: "showBar", type: "toggle", label: "Stock bar", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
