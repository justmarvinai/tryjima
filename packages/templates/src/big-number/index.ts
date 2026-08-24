import { Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outExpo,
  outQuad,
  outQuint,
  type Aspect,
  type BuiltTemplate,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { groupThousands, parseTargetNumber } from "../shared/format";

const str = (v: unknown, fallback: string): string => (typeof v === "string" && v.length > 0 ? v : fallback);
const clamp01 = (u: number): number => (u < 0 ? 0 : u > 1 ? 1 : u);

const PALETTES: Palette[] = [
  { id: "ink", name: "Ink", colors: { background: "#FFFFFF", numberColor: "#101014", accent: "#FF4D1C", labelColor: "#5B5B68" } },
  { id: "coral", name: "Coral", colors: { background: "#FFF1EC", numberColor: "#FF4D1C", accent: "#101014", labelColor: "#8A5A4A" } },
  { id: "cobalt", name: "Cobalt", colors: { background: "#EEF3FF", numberColor: "#1E3A8A", accent: "#38C7FF", labelColor: "#5566A0" } },
  { id: "emerald", name: "Emerald", colors: { background: "#ECFdF3", numberColor: "#0B6B3A", accent: "#D8F34D", labelColor: "#4A7A5E" } },
];

function numberFrac(aspect: Aspect): number {
  return aspect === "16:9" ? 0.2 : aspect === "9:16" ? 0.26 : 0.24;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, rng } = ctx;
  const pc = (k: string, d: string) => palette.colors[k] ?? d;

  const bg = str(values.background, pc("background", "#FFFFFF"));
  const numberColor = str(values.numberColor, pc("numberColor", "#101014"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const labelColor = pc("labelColor", "#5B5B68");

  const target = parseTargetNumber(str(values.value, "10,000"));
  const prefix = str(values.prefix, "");
  const suffix = str(values.suffix, "");
  const label = str(values.label, "happy customers");
  const context = str(values.context, "");
  const celebrate = values.celebrate !== false;
  const showAccentBar = values.accentBar !== false;

  root.addChild(new Graphics().rect(0, 0, size.width, size.height).fill(bg));

  const cx = size.width / 2;
  const cy = size.height * 0.44;
  const numSize = Math.round(size.width * numberFrac(ctx.aspect));
  const minDim = Math.min(size.width, size.height);

  const timeline = new JimaTimeline();

  const numberText = makeText(fonts, { text: prefix + "0" + suffix, role: "display", weight: 700, size: numSize, color: numberColor, anchor: 0.5, align: "center" });
  numberText.position.set(cx, cy);
  root.addChild(numberText);
  // Landing beat.
  timeline
    .to(numberText, { prop: "scale.x", from: 1, to: 1.06, start: 2.3, duration: 0.12, ease: outQuad })
    .to(numberText, { prop: "scale.x", from: 1.06, to: 1, start: 2.42, duration: 0.18, ease: outQuad })
    .to(numberText, { prop: "scale.y", from: 1, to: 1.06, start: 2.3, duration: 0.12, ease: outQuad })
    .to(numberText, { prop: "scale.y", from: 1.06, to: 1, start: 2.42, duration: 0.18, ease: outQuad });

  const labelText = makeText(fonts, { text: label, role: "body", weight: 600, size: Math.round(numSize * 0.24), color: labelColor, anchor: 0.5, align: "center" });
  const labelY = cy + numSize * 0.72;
  labelText.position.set(cx, labelY);
  labelText.alpha = 0;
  root.addChild(labelText);
  timeline
    .to(labelText, { prop: "alpha", from: 0, to: 1, start: 2.5, duration: 0.4, ease: outQuad })
    .to(labelText, { prop: "y", from: labelY + 12, to: labelY, start: 2.5, duration: 0.4, ease: outQuint });

  // Accent rule under the label.
  if (showAccentBar) {
    const ruleW = numSize * 1.1;
    const rule = new Graphics().roundRect(0, 0, ruleW, Math.max(3, numSize * 0.04), 3).fill(accent);
    rule.pivot.set(0, 0);
    rule.position.set(cx - ruleW / 2, labelY + numSize * 0.28);
    rule.scale.set(0, 1);
    root.addChild(rule);
    timeline.to(rule, { prop: "scale.x", from: 0, to: 1, start: 0.0, duration: 0.4, ease: outExpo });
  }

  if (context.length > 0) {
    const ctxText = makeText(fonts, { text: context, role: "body", weight: 500, size: Math.round(numSize * 0.17), color: labelColor, anchor: 0.5, align: "center" });
    const ctxY = labelY + numSize * 0.5;
    ctxText.position.set(cx, ctxY);
    ctxText.alpha = 0;
    root.addChild(ctxText);
    timeline.to(ctxText, { prop: "alpha", from: 0, to: 0.85, start: 2.8, duration: 0.4, ease: outQuad });
  }

  // Confetti (seeded burst physics, computed in update()).
  const confetti: { g: Graphics; vx: number; vy: number; rot: number }[] = [];
  if (celebrate) {
    const festive = [accent, numberColor, "#FF8A3D", "#7C5CFF"];
    const pieces = 24;
    const cSize = minDim * 0.014;
    for (let i = 0; i < pieces; i++) {
      const g = new Graphics().rect(-cSize / 2, -cSize / 2, cSize, cSize * rng.range(0.7, 1.4)).fill(rng.pick(festive));
      g.position.set(cx, cy);
      g.visible = false;
      root.addChild(g);
      const angle = rng.range(-Math.PI * 0.85, -Math.PI * 0.15);
      const speed = rng.range(0.35, 0.75) * minDim;
      confetti.push({ g, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, rot: rng.range(-7, 7) });
    }
  }
  const BURST = 2.3;
  const LIFE = 0.85;
  const G = 2.4 * minDim;

  const update = (t: number) => {
    const p = outExpo(clamp01((t - 0.3) / 2.0));
    numberText.text = prefix + groupThousands(target * p) + suffix;
    for (const c of confetti) {
      const tau = t - BURST;
      if (tau < 0 || tau > LIFE) {
        c.g.visible = false;
        continue;
      }
      c.g.visible = true;
      c.g.x = cx + c.vx * tau;
      c.g.y = cy + c.vy * tau + 0.5 * G * tau * tau;
      c.g.rotation = c.rot * tau;
      c.g.alpha = 1 - clamp01(tau / LIFE);
    }
  };

  return { timeline, duration: 4.5, update };
}

export const bigNumber: TemplateDefinition = {
  id: "big-number",
  name: "Big Number",
  tagline: "A number that counts up and lands with a bang.",
  category: "stat",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 2.6,
  palettes: PALETTES,
  fields: [
    { key: "value", type: "text", label: "Value", default: "10,000", maxLength: 12 },
    { key: "prefix", type: "text", label: "Prefix", default: "", maxLength: 4, optional: true },
    { key: "suffix", type: "text", label: "Suffix", default: "+", maxLength: 8, optional: true },
    { key: "label", type: "text", label: "Label", default: "happy customers", maxLength: 48 },
    { key: "context", type: "text", label: "Context", default: "and counting", maxLength: 60, optional: true },
    { key: "celebrate", type: "toggle", label: "Confetti", default: true },
    { key: "accentBar", type: "toggle", label: "Accent bar", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "numberColor", type: "color", label: "Number", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
