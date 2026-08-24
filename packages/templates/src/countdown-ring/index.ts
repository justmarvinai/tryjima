import { Container, Graphics } from "pixi.js";
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
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;

function fitSize(fonts: FontRegistry, text: string, role: FontRole, weight: number, size: number, maxWidth: number): number {
  if (text.length === 0 || maxWidth <= 0) return size;
  const w = fonts.measure(text, { family: fonts.family(role), weight, size });
  return w > maxWidth ? Math.max(11, Math.floor((size * maxWidth) / w)) : size;
}

// A ring counts 3-2-1 (an arc sweeps each second behind a big digit) then
// bursts to the title. Light stage throughout; the digit and title stay in the
// dark text color (>= 4.5:1), the accent drives the ring and shockwave.
const PALETTES: Palette[] = [
  { id: "ignite", name: "Ignite", colors: { background: "#FAF6F2", textColor: "#1A1210", accent: "#F5451F" } },
  { id: "cobalt", name: "Cobalt", colors: { background: "#EEF3FC", textColor: "#0E1E44", accent: "#2C6BE8" } },
  { id: "mint", name: "Mint", colors: { background: "#EDFAF2", textColor: "#0C2A1C", accent: "#12A85E" } },
  { id: "grape", name: "Grape", colors: { background: "#F6F1FB", textColor: "#22103A", accent: "#8A3CD6" } },
];

function titleFrac(aspect: Aspect): number {
  return aspect === "16:9" ? 0.088 : aspect === "9:16" ? 0.114 : 0.104;
}

const SEG_DUR = 0.7;
const COUNTS = 3;
const COUNT_END = SEG_DUR * COUNTS;
const START_ANGLE = -Math.PI / 2;
const DURATION = 4.3;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FAF6F2"));
  const textColor = str(values.textColor, pc("textColor", "#1A1210"));
  const accent = str(values.accent, pc("accent", "#F5451F"));
  const title = str(values.title, "We're Live");
  const showRing = on(values.showRing);

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const cx = w / 2;
  const zone = safeRect(ctx.aspect);
  const centerY = zone.y + zone.height * 0.45;

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  const ringR = minDim * 0.17;
  const baseW = Math.max(4, ringR * 0.05);
  const sweepW = Math.max(6, ringR * 0.095);

  // --- Ring group (base track + sweeping arc) ---
  const ringGroup = new Container();
  ringGroup.position.set(cx, centerY);
  root.addChild(ringGroup);

  let arc: Graphics | null = null;
  if (showRing) {
    ringGroup.addChild(new Graphics().circle(0, 0, ringR).stroke({ color: accent, width: baseW, alpha: 0.16 }));
    arc = new Graphics();
    ringGroup.addChild(arc);
    // Burst the ring outward once the count finishes.
    timeline
      .to(ringGroup, { prop: "scale.x", from: 1, to: 1.5, start: COUNT_END, duration: 0.32, ease: outQuad })
      .to(ringGroup, { prop: "scale.y", from: 1, to: 1.5, start: COUNT_END, duration: 0.32, ease: outQuad })
      .to(ringGroup, { prop: "alpha", from: 1, to: 0, start: COUNT_END, duration: 0.3, ease: outQuad });

    // Shockwave ring.
    const shock = new Graphics().circle(0, 0, ringR).stroke({ color: accent, width: sweepW });
    shock.position.set(cx, centerY);
    shock.alpha = 0;
    shock.scale.set(0.6);
    root.addChild(shock);
    timeline
      .to(shock, { prop: "scale.x", from: 0.6, to: 2.3, start: COUNT_END - 0.03, duration: 0.55, ease: outQuad })
      .to(shock, { prop: "scale.y", from: 0.6, to: 2.3, start: COUNT_END - 0.03, duration: 0.55, ease: outQuad })
      .to(shock, { prop: "alpha", from: 0.55, to: 0, start: COUNT_END - 0.03, duration: 0.55, ease: outQuad });
  }

  // --- Countdown digit ---
  const digitSize = Math.round(minDim * 0.16);
  const digit = makeText(fonts, { text: String(COUNTS), role: "display", weight: 700, size: digitSize, color: textColor, anchor: 0.5, align: "center" });
  digit.position.set(cx, centerY);
  digit.alpha = 0;
  root.addChild(digit);
  for (let i = 0; i < COUNTS; i++) {
    const value = COUNTS - i;
    const segStart = i * SEG_DUR;
    timeline.set(digit, "text", String(value), segStart);
    timeline
      .to(digit, { prop: "alpha", from: 0, to: 1, start: segStart, duration: 0.16, ease: outQuad })
      .to(digit, { prop: "scale.x", from: 0.55, to: 1, start: segStart, duration: 0.36, ease: makeOutBack(1.9) })
      .to(digit, { prop: "scale.y", from: 0.55, to: 1, start: segStart, duration: 0.36, ease: makeOutBack(1.9) });
  }
  timeline.to(digit, { prop: "alpha", from: 1, to: 0, start: COUNT_END - 0.06, duration: 0.16, ease: outQuad });

  // --- Title (punches in as the ring bursts) ---
  const maxW = zone.width * (ctx.aspect === "16:9" ? 0.62 : 0.86);
  const titleSize = fitSize(fonts, title, "display", 700, Math.round(w * titleFrac(ctx.aspect)), maxW);
  const titleText = makeText(fonts, { text: title, role: "display", weight: 700, size: titleSize, color: textColor, anchor: 0.5, align: "center" });
  titleText.position.set(cx, centerY);
  titleText.alpha = 0;
  titleText.scale.set(0.5);
  root.addChild(titleText);
  const titleStart = COUNT_END + 0.02;
  timeline
    .to(titleText, { prop: "alpha", from: 0, to: 1, start: titleStart, duration: 0.3, ease: outQuad })
    .to(titleText, { prop: "scale.x", from: 0.5, to: 1, start: titleStart, duration: 0.6, ease: spring(0.4) })
    .to(titleText, { prop: "scale.y", from: 0.5, to: 1, start: titleStart, duration: 0.6, ease: spring(0.4) });

  const update = (t: number): void => {
    if (!arc) return;
    arc.clear();
    if (t < COUNT_END) {
      const seg = Math.min(COUNTS - 1, Math.floor(t / SEG_DUR));
      const u = Math.min(1, (t - seg * SEG_DUR) / SEG_DUR);
      arc.arc(0, 0, ringR, START_ANGLE, START_ANGLE + u * Math.PI * 2).stroke({ color: accent, width: sweepW, cap: "round" });
    } else {
      arc.circle(0, 0, ringR).stroke({ color: accent, width: sweepW });
    }
  };

  return { timeline, duration: DURATION, update };
}

export const countdownRing: TemplateDefinition = {
  id: "countdown-ring",
  name: "Countdown Ring",
  tagline: "A ring counts three, two, one, then bursts to reveal the title.",
  category: "intro",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "9:16",
  loopable: false,
  posterTime: 3.4,
  fontRoles: { title: "display" },
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Title", default: "We're Live", maxLength: 24, shrinkToFit: true },
    { key: "showRing", type: "toggle", label: "Countdown ring", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
