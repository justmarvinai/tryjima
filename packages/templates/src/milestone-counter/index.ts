import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outExpo,
  outQuad,
  outQuint,
  spring,
  type Aspect,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { groupThousands, parseTargetNumber } from "../shared/format";
import { makeIcon } from "../shared/icons";
import { makePill } from "../shared/ui";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const clamp01 = (u: number): number => (u < 0 ? 0 : u > 1 ? 1 : u);

// Reused, previously-shipped role combinations (badge-stamp / product-hero) so
// onAccent-on-accent text stays comfortably above the 4.5:1 end-frame bar.
const PALETTES: Palette[] = [
  { id: "ember", name: "Ember", colors: { background: "#FFFFFF", textColor: "#101014", accent: "#C2380F", onAccent: "#FFFFFF" } },
  { id: "cobalt", name: "Cobalt", colors: { background: "#EEF3FF", textColor: "#0B1F4D", accent: "#2A5AD6", onAccent: "#FFFFFF" } },
  { id: "violet", name: "Violet", colors: { background: "#F1ECFB", textColor: "#180F2E", accent: "#6D3BEA", onAccent: "#FFFFFF" } },
  { id: "berry", name: "Berry", colors: { background: "#FFEEF6", textColor: "#3A0A28", accent: "#C21473", onAccent: "#FFFFFF" } },
];

function numberFrac(aspect: Aspect): number {
  return aspect === "16:9" ? 0.15 : aspect === "9:16" ? 0.2 : 0.18;
}
function centerYFrac(aspect: Aspect): number {
  return aspect === "16:9" ? 0.36 : aspect === "9:16" ? 0.38 : 0.37;
}

/** Largest size ≤ size0 at which `text` fits maxWidth (crisp, single-line). */
function fitSize(
  fonts: FontRegistry,
  text: string,
  role: FontRole,
  weight: number,
  size: number,
  maxWidth: number,
): number {
  const w = fonts.measure(text, { family: fonts.family(role), weight, size });
  return w > maxWidth ? Math.max(18, Math.floor((size * maxWidth) / w)) : size;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, rng } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const onAccent = pc("onAccent", "#FFFFFF");

  const target = parseTargetNumber(str(values.target, "10,000"));
  const label = str(values.label, "downloads");
  const showConfetti = values.showConfetti !== false;

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const cx = w / 2;

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Number (shrink so the final grouped value never overflows) ---
  let numSize = Math.round(w * numberFrac(ctx.aspect));
  numSize = fitSize(fonts, groupThousands(target), "display", 700, numSize, w * 0.86);
  const numberCy = h * centerYFrac(ctx.aspect);

  const numberText = makeText(fonts, { text: "0", role: "display", weight: 700, size: numSize, color: textColor, anchor: 0.5, align: "center" });
  numberText.position.set(cx, numberCy);
  numberText.alpha = 0;
  root.addChild(numberText);
  timeline
    .to(numberText, { prop: "alpha", from: 0, to: 1, start: 0, duration: 0.3, ease: outQuad })
    .to(numberText, { prop: "scale.x", from: 0.9, to: 1, start: 0, duration: 0.4, ease: outQuint })
    .to(numberText, { prop: "scale.y", from: 0.9, to: 1, start: 0, duration: 0.4, ease: outQuint });

  // --- Count-up timing (shared by the number, the progress bar, and the burst) ---
  const COUNT_START = 0.35;
  const COUNT_DUR = 1.75;
  const COUNT_END = COUNT_START + COUNT_DUR;

  // Landing micro-bounce once the count lands.
  timeline
    .to(numberText, { prop: "scale.x", from: 1, to: 1.08, start: COUNT_END, duration: 0.12, ease: outQuad })
    .to(numberText, { prop: "scale.x", from: 1.08, to: 1, start: COUNT_END + 0.12, duration: 0.2, ease: outQuad })
    .to(numberText, { prop: "scale.y", from: 1, to: 1.08, start: COUNT_END, duration: 0.12, ease: outQuad })
    .to(numberText, { prop: "scale.y", from: 1.08, to: 1, start: COUNT_END + 0.12, duration: 0.2, ease: outQuad });

  // --- Label pill (below the number) ---
  const pillLabelSize = Math.round(numSize * 0.17);
  const pillTextFit = fitSize(fonts, label, "body", 700, pillLabelSize, w * 0.7);
  const pillLabel = makeText(fonts, { text: label, role: "body", weight: 700, size: pillTextFit, color: onAccent, anchor: 0.5, align: "center" });
  const pillH = Math.round(pillTextFit * 2.1);
  const pillW = pillLabel.width + pillTextFit * 1.7;
  const pillCy = numberCy + numSize * 0.66 + pillH / 2;

  const pillC = new Container();
  pillC.addChild(makePill(pillW, pillH, accent));
  pillLabel.position.set(0, 0);
  pillC.addChild(pillLabel);
  pillC.position.set(cx, pillCy);
  pillC.scale.set(0);
  root.addChild(pillC);
  timeline
    .to(pillC, { prop: "scale.x", from: 0, to: 1, start: 0.1, duration: 0.6, ease: spring(0.5) })
    .to(pillC, { prop: "scale.y", from: 0, to: 1, start: 0.1, duration: 0.6, ease: spring(0.5) });

  // --- Progress bar (fills in sync with the count) ---
  const barW = Math.min(w * 0.46, numSize * 2.4);
  const barH = Math.max(6, Math.round(minDim * 0.014));
  const barCy = pillCy + pillH / 2 + numSize * 0.22 + barH / 2;
  const barX = cx - barW / 2;
  const barY = barCy - barH / 2;

  const track = new Graphics().roundRect(0, 0, barW, barH, barH / 2).fill({ color: textColor, alpha: 0.12 });
  track.position.set(barX, barY);
  track.alpha = 0;
  root.addChild(track);
  timeline.to(track, { prop: "alpha", from: 0, to: 1, start: 0.1, duration: 0.4, ease: outQuad });

  const fill = new Graphics().roundRect(0, 0, barW, barH, barH / 2).fill(accent);
  fill.position.set(barX, barY);
  fill.scale.set(0, 1);
  root.addChild(fill);
  timeline.to(fill, { prop: "scale.x", from: 0, to: 1, start: COUNT_START, duration: COUNT_DUR, ease: outExpo });

  // --- End-of-count celebration: an impact ring + twinkling sparkle stars ---
  const BURST = COUNT_END + 0.05;
  const LIFE = 0.85;

  let ring: Graphics | null = null;
  if (showConfetti) {
    ring = new Graphics().circle(0, 0, numSize * 0.55).stroke({ color: accent, width: Math.max(3, minDim * 0.01) });
    ring.position.set(cx, numberCy);
    ring.scale.set(0.7);
    ring.alpha = 0;
    root.addChild(ring);
    timeline
      .to(ring, { prop: "scale.x", from: 0.7, to: 1.8, start: BURST, duration: 0.7, ease: outExpo })
      .to(ring, { prop: "scale.y", from: 0.7, to: 1.8, start: BURST, duration: 0.7, ease: outExpo })
      // Two sequential (non-overlapping) alpha stages: a quick flash-in from the
      // preset 0, then the fade-out — so the ring stays fully hidden pre-burst
      // instead of holding the fade-out tween's `from` the whole time before it.
      .to(ring, { prop: "alpha", from: 0, to: 0.85, start: BURST, duration: 0.06, ease: outQuad })
      .to(ring, { prop: "alpha", from: 0.85, to: 0, start: BURST + 0.06, duration: 0.64, ease: outQuad });
  }

  const sparkles: { g: Graphics; angle: number; speed: number; rot: number }[] = [];
  if (showConfetti) {
    const N = 16;
    const palette4 = [accent, textColor];
    for (let i = 0; i < N; i++) {
      const s = minDim * rng.range(0.016, 0.03);
      const g = makeIcon("star", s, { color: rng.pick(palette4) });
      g.position.set(cx, numberCy);
      g.visible = false;
      root.addChild(g);
      const angle = (i / N) * Math.PI * 2 + rng.range(-0.22, 0.22);
      const speed = rng.range(0.32, 0.72) * minDim;
      const rot = rng.range(-6, 6);
      sparkles.push({ g, angle, speed, rot });
    }
  }

  const update = (t: number): void => {
    const p = outExpo(clamp01((t - COUNT_START) / COUNT_DUR));
    numberText.text = groupThousands(target * p);
    for (const sp of sparkles) {
      const tau = t - BURST;
      if (tau < 0 || tau > LIFE) {
        sp.g.visible = false;
        continue;
      }
      sp.g.visible = true;
      const u = clamp01(tau / LIFE);
      const dist = sp.speed * tau;
      sp.g.x = cx + Math.cos(sp.angle) * dist;
      sp.g.y = numberCy + Math.sin(sp.angle) * dist;
      sp.g.rotation = sp.rot * tau;
      const twinkle = Math.sin(Math.PI * u);
      sp.g.scale.set(0.4 + 0.6 * twinkle);
      sp.g.alpha = twinkle;
    }
  };

  return { timeline, duration: 4.2, update };
}

export const milestoneCounter: TemplateDefinition = {
  id: "milestone-counter",
  name: "Milestone Counter",
  tagline: "A big number counts up to a milestone, then sparkles.",
  category: "stat",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 3.4,
  palettes: PALETTES,
  fields: [
    { key: "target", type: "text", label: "Target", default: "10,000", maxLength: 14, help: "Digits — counts up to this." },
    { key: "label", type: "text", label: "Label", default: "downloads", maxLength: 40, shrinkToFit: true },
    { key: "showConfetti", type: "toggle", label: "Confetti burst", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
