import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  spring,
  outBack,
  outQuad,
  outExpo,
  type BuiltTemplate,
  type MakeTextOptions,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";

const DEG = Math.PI / 180;

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;

const PALETTES: Palette[] = [
  { id: "ember", name: "Ember", colors: { background: "#FFF3EE", accent: "#C2380F", onAccent: "#FFFFFF" } },
  { id: "midnight", name: "Midnight", colors: { background: "#101014", accent: "#C2380F", onAccent: "#FFFFFF" } },
  { id: "royal", name: "Royal", colors: { background: "#EEF2FF", accent: "#3455E6", onAccent: "#FFFFFF" } },
  { id: "berry", name: "Berry", colors: { background: "#FFEEF6", accent: "#C21473", onAccent: "#FFFFFF" } },
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
  const bg = str(values.background, pc("background", "#FFF3EE"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const onAccent = str(values.onAccent, pc("onAccent", "#FFFFFF"));
  const percentRaw = str(values.percent, "50%");
  const labelRaw = str(values.label, "OFF EVERYTHING").toUpperCase();
  const showStar = values.showStar !== false;

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const cx = w / 2;
  const cy = h * 0.48;
  const R = minDim * 0.32;

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();
  const STAMP = 0.3;

  // --- Impact ring (expands + fades on the pop) ---
  const ring = new Graphics().circle(0, 0, R).stroke({ color: accent, width: Math.max(3, R * 0.03) });
  ring.position.set(cx, cy);
  ring.scale.set(0.7);
  ring.alpha = 0;
  root.addChild(ring);
  timeline
    .to(ring, { prop: "alpha", from: 0, to: 0.8, start: STAMP, duration: 0.1, ease: outQuad })
    .to(ring, { prop: "alpha", from: 0.8, to: 0, start: STAMP + 0.1, duration: 0.55, ease: outQuad })
    .to(ring, { prop: "scale.x", from: 0.7, to: 1.8, start: STAMP, duration: 0.65, ease: outExpo })
    .to(ring, { prop: "scale.y", from: 0.7, to: 1.8, start: STAMP, duration: 0.65, ease: outExpo });

  // --- Badge (starburst + seal disc + big percent + small label) ---
  const badge = new Container();
  badge.position.set(cx, cy);
  badge.scale.set(0);
  badge.rotation = -34 * DEG;
  badge.alpha = 0;
  root.addChild(badge);

  if (showStar) {
    const starLayer = new Container();
    starLayer.rotation = 0;
    starLayer.addChild(new Graphics().star(0, 0, 18, R, R * 0.8).fill(accent));
    badge.addChild(starLayer);
    timeline.to(starLayer, { prop: "rotation", from: 0, to: 130 * DEG, start: STAMP + 0.85, duration: 2.75, ease: outQuad });
  }
  badge.addChild(new Graphics().circle(0, 0, R * 0.84).fill(accent));
  badge.addChild(new Graphics().circle(0, 0, R * 0.72).stroke({ color: onAccent, width: Math.max(2, R * 0.022), alpha: 0.9 }));

  const percentSize = Math.round(R * 0.58);
  const percentText = fitText(
    fonts,
    { text: percentRaw, role: "display", weight: 700, size: percentSize, color: onAccent, anchor: 0.5, align: "center" },
    R * 1.5,
  );
  percentText.position.set(0, -R * 0.12);
  badge.addChild(percentText);

  const labelSize = Math.round(R * 0.145);
  const labelText = fitText(
    fonts,
    { text: labelRaw, role: "body", weight: 700, size: labelSize, color: onAccent, anchor: 0.5, align: "center", letterSpacing: 1 },
    R * 1.4,
  );
  labelText.position.set(0, R * 0.36);
  labelText.alpha = 0;
  badge.addChild(labelText);

  timeline
    .to(badge, { prop: "alpha", from: 0, to: 1, start: STAMP, duration: 0.14, ease: outQuad })
    .to(badge, { prop: "scale.x", from: 0, to: 1, start: STAMP, duration: 0.78, ease: spring(0.4) })
    .to(badge, { prop: "scale.y", from: 0, to: 1, start: STAMP, duration: 0.78, ease: spring(0.4) })
    .to(badge, { prop: "rotation", from: -34 * DEG, to: 0, start: STAMP, duration: 0.72, ease: outBack })
    .to(labelText, { prop: "alpha", from: 0, to: 1, start: STAMP + 0.5, duration: 0.3, ease: outQuad });

  // Gentle idle "breathe" pulses so the hold doesn't feel static, timed to
  // settle back to rest well before the poster frame / final hold.
  timeline
    .to(badge, { prop: "scale.x", from: 1, to: 1.04, start: 1.55, duration: 0.35, ease: outQuad })
    .to(badge, { prop: "scale.x", from: 1.04, to: 1, start: 1.9, duration: 0.4, ease: outQuad })
    .to(badge, { prop: "scale.y", from: 1, to: 1.04, start: 1.55, duration: 0.35, ease: outQuad })
    .to(badge, { prop: "scale.y", from: 1.04, to: 1, start: 1.9, duration: 0.4, ease: outQuad })
    .to(badge, { prop: "scale.x", from: 1, to: 1.04, start: 3.1, duration: 0.35, ease: outQuad })
    .to(badge, { prop: "scale.x", from: 1.04, to: 1, start: 3.45, duration: 0.4, ease: outQuad })
    .to(badge, { prop: "scale.y", from: 1, to: 1.04, start: 3.1, duration: 0.35, ease: outQuad })
    .to(badge, { prop: "scale.y", from: 1.04, to: 1, start: 3.45, duration: 0.4, ease: outQuad });

  return { timeline, duration: 4.0 };
}

export const discountBurst: TemplateDefinition = {
  id: "discount-burst",
  name: "Discount Burst",
  tagline: "A starburst seal pops and spins in with a big percent off.",
  category: "promo",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 2.6,
  palettes: PALETTES,
  fields: [
    { key: "percent", type: "text", label: "Percent", default: "50%", maxLength: 8, shrinkToFit: true },
    { key: "label", type: "text", label: "Label", default: "OFF EVERYTHING", maxLength: 26, shrinkToFit: true },
    { key: "showStar", type: "toggle", label: "Starburst spikes", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
    { key: "onAccent", type: "color", label: "Badge text", default: "", optional: true },
  ],
  build,
};
