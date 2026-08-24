import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  spring,
  type Aspect,
  type BuiltTemplate,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { makeIcon, type IconName } from "../shared/icons";

const str = (v: unknown, fallback: string): string => (typeof v === "string" && v.length > 0 ? v : fallback);
const clamp01 = (u: number): number => (u < 0 ? 0 : u > 1 ? 1 : u);

const PALETTES: Palette[] = [
  { id: "punch", name: "Punch", colors: { background: "#FFFFFF", textColor: "#101014", accent: "#FF4D1C", onAccent: "#FFFFFF" } },
  { id: "night", name: "Night", colors: { background: "#101014", textColor: "#FFFFFF", accent: "#D8F34D", onAccent: "#101014" } },
  { id: "grape", name: "Grape", colors: { background: "#F3EEFF", textColor: "#2A1A5E", accent: "#7C5CFF", onAccent: "#FFFFFF" } },
  { id: "sky", name: "Sky", colors: { background: "#E8F4FF", textColor: "#0B2447", accent: "#2E7DF6", onAccent: "#FFFFFF" } },
];

const ICON_CHOICES: IconName[] = ["star", "heart", "thumb", "bell", "check", "bolt", "plus", "cart", "comment", "pin"];

function discFrac(aspect: Aspect): number {
  return aspect === "16:9" ? 0.2 : aspect === "9:16" ? 0.26 : 0.28;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, rng } = ctx;
  const pc = (k: string, d: string) => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const onAccent = str(values.onAccent, pc("onAccent", "#FFFFFF"));
  const symbol = str(values.symbol, "star") as IconName;
  const label = str(values.label, "Follow for more");
  const sublabel = str(values.sublabel, "");
  const showBurst = str(values.burst, "dots") !== "none";

  root.addChild(new Graphics().rect(0, 0, size.width, size.height).fill(bg));

  const timeline = new JimaTimeline();
  const cx = size.width / 2;
  const cy = size.height * (sublabel ? 0.4 : 0.42);
  const minDim = Math.min(size.width, size.height);
  const discR = minDim * discFrac(ctx.aspect);

  // Burst dots (behind the disc).
  const dots: { g: Graphics; vx: number; vy: number }[] = [];
  if (showBurst) {
    for (let i = 0; i < 10; i++) {
      const s = minDim * rng.range(0.012, 0.024);
      const g = new Graphics().circle(0, 0, s).fill(rng.pick([accent, textColor]));
      g.position.set(cx, cy);
      g.visible = false;
      root.addChild(g);
      const a = (i / 10) * Math.PI * 2 + rng.range(-0.3, 0.3);
      const speed = rng.range(0.5, 0.85) * minDim;
      dots.push({ g, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed });
    }
  }

  // Expanding ring.
  const ring = new Graphics().circle(0, 0, discR).stroke({ color: accent, width: Math.max(3, minDim * 0.012) });
  ring.position.set(cx, cy);
  ring.scale.set(0.4);
  ring.alpha = 0;
  root.addChild(ring);
  timeline
    .to(ring, { prop: "scale.x", from: 0.5, to: 1.7, start: 0.45, duration: 0.8, ease: outExpo })
    .to(ring, { prop: "scale.y", from: 0.5, to: 1.7, start: 0.45, duration: 0.8, ease: outExpo })
    .to(ring, { prop: "alpha", from: 0.85, to: 0, start: 0.45, duration: 0.8, ease: outQuad });

  // Disc + icon.
  const disc = new Container();
  disc.position.set(cx, cy);
  disc.addChild(new Graphics().circle(0, 0, discR).fill(accent));
  disc.addChild(makeIcon(symbol, discR * 1.15, { color: onAccent, holeColor: accent }));
  disc.scale.set(0);
  root.addChild(disc);
  timeline
    .to(disc, { prop: "scale.x", from: 0, to: 1, start: 0.1, duration: 0.85, ease: spring(0.42) })
    .to(disc, { prop: "scale.y", from: 0, to: 1, start: 0.1, duration: 0.85, ease: spring(0.42) })
    .to(disc, { prop: "y", from: cy, to: cy - 4, start: 1.5, duration: 1.0, ease: outQuad })
    .to(disc, { prop: "y", from: cy - 4, to: cy + 4, start: 2.5, duration: 1.0, ease: outQuad });

  // Label + sublabel.
  const labelSize = Math.round(size.width * (ctx.aspect === "16:9" ? 0.05 : 0.07));
  const labelText = makeText(fonts, { text: label, role: "display", weight: 700, size: labelSize, color: textColor, anchor: 0.5, align: "center" });
  const labelY = cy + discR + labelSize * 1.1;
  labelText.position.set(cx, labelY);
  labelText.alpha = 0;
  root.addChild(labelText);
  timeline
    .to(labelText, { prop: "alpha", from: 0, to: 1, start: 0.7, duration: 0.5, ease: outQuad })
    .to(labelText, { prop: "y", from: labelY + 22, to: labelY, start: 0.7, duration: 0.6, ease: outExpo });

  if (sublabel.length > 0) {
    const subSize = Math.round(labelSize * 0.5);
    const sub = makeText(fonts, { text: sublabel, role: "body", weight: 500, size: subSize, color: textColor, anchor: 0.5, align: "center" });
    const subY = labelY + labelSize * 0.9;
    sub.position.set(cx, subY);
    sub.alpha = 0;
    root.addChild(sub);
    timeline
      .to(sub, { prop: "alpha", from: 0, to: 0.75, start: 0.95, duration: 0.5, ease: outQuad })
      .to(sub, { prop: "y", from: subY + 14, to: subY, start: 0.95, duration: 0.6, ease: outExpo });
  }

  const BURST = 0.35;
  const LIFE = 0.85;
  const G = 1.6 * minDim;
  const update = (t: number) => {
    for (const d of dots) {
      const tau = t - BURST;
      if (tau < 0 || tau > LIFE) {
        d.g.visible = false;
        continue;
      }
      d.g.visible = true;
      d.g.x = cx + d.vx * tau;
      d.g.y = cy + d.vy * tau + 0.5 * G * tau * tau;
      d.g.alpha = 1 - clamp01(tau / LIFE);
    }
  };

  return { timeline, duration: 3.4, update };
}

export const iconPop: TemplateDefinition = {
  id: "icon-pop",
  name: "Icon Pop",
  tagline: "A bold icon springs in with a ring burst.",
  category: "brand",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 1.4,
  palettes: PALETTES,
  fields: [
    {
      key: "symbol",
      type: "select",
      label: "Icon",
      default: "star",
      options: ICON_CHOICES.map((n) => ({ value: n, label: n.charAt(0).toUpperCase() + n.slice(1) })),
    },
    { key: "label", type: "text", label: "Label", default: "Follow for more", maxLength: 40, shrinkToFit: true },
    { key: "sublabel", type: "text", label: "Sublabel", default: "New posts every week", maxLength: 60, optional: true },
    { key: "burst", type: "select", label: "Burst", default: "dots", options: [{ value: "dots", label: "Dots" }, { value: "none", label: "None" }] },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
