import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  outBack,
  spring,
  type Aspect,
  type BuiltTemplate,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { makeIcon } from "../shared/icons";
import { pointerCursor } from "../shared/ui";
import { groupThousands, parseTargetNumber } from "../shared/format";

const str = (v: unknown, fallback: string): string => (typeof v === "string" && v.length > 0 ? v : fallback);
const clamp01 = (u: number): number => (u < 0 ? 0 : u > 1 ? 1 : u);

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

const PALETTES: Palette[] = [
  { id: "light", name: "Light", colors: { background: "#FFFFFF", textColor: "#101014", accent: "#FF4D1C", muted: "#ECECEC", onAccent: "#FFFFFF" } },
  { id: "dark", name: "Dark", colors: { background: "#101014", textColor: "#FFFFFF", accent: "#FF4D1C", muted: "#26262C", onAccent: "#FFFFFF" } },
  { id: "blush", name: "Blush", colors: { background: "#FFF0F3", textColor: "#2A0A14", accent: "#FF2E5B", muted: "#FBD9E1", onAccent: "#FFFFFF" } },
  { id: "night-ember", name: "Night ember", colors: { background: "#0E1116", textColor: "#FFFFFF", accent: "#FF6A3D", muted: "#232A33", onAccent: "#FFFFFF" } },
];

function discFrac(aspect: Aspect): number {
  return aspect === "16:9" ? 0.15 : aspect === "9:16" ? 0.17 : 0.18;
}
function discCyFrac(aspect: Aspect): number {
  return aspect === "16:9" ? 0.5 : aspect === "9:16" ? 0.44 : 0.46;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, rng } = ctx;
  const pc = (k: string, d: string) => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const muted = pc("muted", "#ECECEC");
  const onAccent = pc("onAccent", "#FFFFFF");
  const isDark = luminance(bg) < 0.5;
  const restIcon = isDark ? "#7A7A82" : "#C2C6CC";
  const subColor = isDark ? "#AAB0B8" : "#606A72";
  const label = str(values.label, "Like this video");
  const target = parseTargetNumber(str(values.likes, "24000"));
  const showSparkles = values.sparkles !== false;

  root.addChild(new Graphics().rect(0, 0, size.width, size.height).fill(bg));

  const timeline = new JimaTimeline();
  const cx = size.width / 2;
  const minDim = Math.min(size.width, size.height);
  const discR = minDim * discFrac(ctx.aspect);
  const cy = size.height * discCyFrac(ctx.aspect);
  const clickAt = 1.1;

  // Expanding ring that fires on the like.
  const ring = new Graphics().circle(0, 0, discR).stroke({ color: accent, width: Math.max(3, minDim * 0.012) });
  ring.position.set(cx, cy);
  ring.scale.set(0.6);
  ring.alpha = 0;
  root.addChild(ring);
  timeline
    .to(ring, { prop: "scale.x", from: 0.6, to: 1.8, start: clickAt, duration: 0.7, ease: outExpo })
    .to(ring, { prop: "scale.y", from: 0.6, to: 1.8, start: clickAt, duration: 0.7, ease: outExpo })
    .to(ring, { prop: "alpha", from: 0.9, to: 0, start: clickAt, duration: 0.7, ease: outQuad });

  // Like button: a rest (muted) disc + an active (accent) disc, toggled on click.
  const button = new Container();
  button.position.set(cx, cy);
  const restLayer = new Container();
  restLayer.addChild(new Graphics().circle(0, 0, discR).fill(muted));
  restLayer.addChild(makeIcon("thumb", discR * 1.15, { color: restIcon }));
  const activeLayer = new Container();
  activeLayer.addChild(new Graphics().circle(0, 0, discR).fill(accent));
  activeLayer.addChild(makeIcon("thumb", discR * 1.15, { color: onAccent }));
  activeLayer.visible = false;
  button.addChild(restLayer, activeLayer);
  button.scale.set(0);
  root.addChild(button);
  // Entrance spring, then click dip → overshoot settle.
  timeline
    .to(button, { prop: "scale.x", from: 0, to: 1, start: 0.1, duration: 0.7, ease: spring(0.45) })
    .to(button, { prop: "scale.y", from: 0, to: 1, start: 0.1, duration: 0.7, ease: spring(0.45) })
    .to(button, { prop: "scale.x", from: 1, to: 0.86, start: clickAt, duration: 0.09, ease: outQuad })
    .to(button, { prop: "scale.y", from: 1, to: 0.86, start: clickAt, duration: 0.09, ease: outQuad })
    .to(button, { prop: "scale.x", from: 0.86, to: 1, start: clickAt + 0.09, duration: 0.5, ease: spring(0.35) })
    .to(button, { prop: "scale.y", from: 0.86, to: 1, start: clickAt + 0.09, duration: 0.5, ease: spring(0.35) });
  timeline.set(restLayer, "visible", false, clickAt + 0.03);
  timeline.set(activeLayer, "visible", true, clickAt + 0.03);

  // Label above the button.
  const labelSize = Math.round(size.width * (ctx.aspect === "16:9" ? 0.036 : 0.05));
  const labelText = makeText(fonts, { text: label, role: "display", weight: 700, size: labelSize, color: textColor, anchor: 0.5, align: "center" });
  const labelY = cy - discR - labelSize * 1.1;
  labelText.position.set(cx, labelY);
  labelText.alpha = 0;
  root.addChild(labelText);
  timeline
    .to(labelText, { prop: "alpha", from: 0, to: 1, start: 0.25, duration: 0.5, ease: outQuad })
    .to(labelText, { prop: "y", from: labelY - 18, to: labelY, start: 0.25, duration: 0.6, ease: outExpo });

  // Count + "likes" below the button.
  const countSize = Math.round(size.width * (ctx.aspect === "16:9" ? 0.06 : 0.09));
  const countText = makeText(fonts, { text: groupThousands(0), role: "display", weight: 700, size: countSize, color: textColor, anchor: 0.5 });
  const countY = cy + discR + countSize * 0.95;
  countText.position.set(cx, countY);
  countText.alpha = 0;
  root.addChild(countText);
  const likesLabel = makeText(fonts, { text: "likes", role: "body", weight: 500, size: Math.round(countSize * 0.4), color: subColor, anchor: 0.5 });
  likesLabel.position.set(cx, countY + countSize * 0.75);
  likesLabel.alpha = 0;
  root.addChild(likesLabel);
  timeline
    .to(countText, { prop: "alpha", from: 0, to: 1, start: 0.35, duration: 0.4, ease: outQuad })
    .to(likesLabel, { prop: "alpha", from: 0, to: 1, start: 0.5, duration: 0.4, ease: outQuad });

  // "+1" that pops and floats up on the like.
  const plusOne = makeText(fonts, { text: "+1", role: "display", weight: 700, size: Math.round(countSize * 0.8), color: accent, anchor: 0.5 });
  const p1x = cx + discR * 0.62;
  const p1y0 = cy - discR * 0.1;
  plusOne.position.set(p1x, p1y0);
  plusOne.alpha = 0;
  plusOne.scale.set(0.4);
  root.addChild(plusOne);
  timeline
    .to(plusOne, { prop: "alpha", from: 0, to: 1, start: clickAt + 0.02, duration: 0.14, ease: outQuad })
    .to(plusOne, { prop: "alpha", from: 1, to: 0, start: clickAt + 0.5, duration: 0.5, ease: outQuad })
    .to(plusOne, { prop: "y", from: p1y0, to: p1y0 - discR * 1.1, start: clickAt + 0.02, duration: 1.0, ease: outExpo })
    .to(plusOne, { prop: "scale.x", from: 0.4, to: 1, start: clickAt + 0.02, duration: 0.4, ease: outBack })
    .to(plusOne, { prop: "scale.y", from: 0.4, to: 1, start: clickAt + 0.02, duration: 0.4, ease: outBack });

  // Pointer cursor moves in from the lower-right and taps.
  const cur = pointerCursor(minDim * 0.09, "#FFFFFF", "#101014");
  const curFrom = { x: cx + discR * 1.5, y: cy + discR * 1.9 };
  const curTo = { x: cx + discR * 0.18, y: cy + discR * 0.22 };
  cur.position.set(curFrom.x, curFrom.y);
  cur.alpha = 0;
  root.addChild(cur);
  timeline
    .to(cur, { prop: "alpha", from: 0, to: 1, start: 0.45, duration: 0.3, ease: outQuad })
    .to(cur, { prop: "x", from: curFrom.x, to: curTo.x, start: 0.45, duration: 0.6, ease: outExpo })
    .to(cur, { prop: "y", from: curFrom.y, to: curTo.y, start: 0.45, duration: 0.6, ease: outExpo })
    .to(cur, { prop: "scale.x", from: 1, to: 0.82, start: clickAt, duration: 0.09, ease: outQuad })
    .to(cur, { prop: "scale.y", from: 1, to: 0.82, start: clickAt, duration: 0.09, ease: outQuad })
    .to(cur, { prop: "scale.x", from: 0.82, to: 1, start: clickAt + 0.09, duration: 0.16, ease: outBack })
    .to(cur, { prop: "scale.y", from: 0.82, to: 1, start: clickAt + 0.09, duration: 0.16, ease: outBack })
    .to(cur, { prop: "alpha", from: 1, to: 0, start: clickAt + 0.5, duration: 0.35, ease: outQuad });

  // Confetti burst of small accent dots on the like.
  const dots: { g: Graphics; vx: number; vy: number }[] = [];
  if (showSparkles) {
    for (let i = 0; i < 12; i++) {
      const s = minDim * rng.range(0.01, 0.022);
      const g = new Graphics().circle(0, 0, s).fill(rng.pick([accent, textColor]));
      g.position.set(cx, cy);
      g.visible = false;
      root.addChild(g);
      const a = (i / 12) * Math.PI * 2 + rng.range(-0.25, 0.25);
      const speed = rng.range(0.45, 0.8) * minDim;
      dots.push({ g, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed });
    }
  }

  const BURST = clickAt;
  const LIFE = 0.8;
  const GRAV = 1.5 * minDim;
  const countStart = 0.5;
  const countEnd = clickAt + 0.35;
  const update = (t: number) => {
    const u = t <= countStart ? 0 : t >= countEnd ? 1 : (t - countStart) / (countEnd - countStart);
    const eased = 1 - Math.pow(1 - u, 3);
    countText.text = groupThousands(Math.round(target * eased));
    for (const d of dots) {
      const tau = t - BURST;
      if (tau < 0 || tau > LIFE) {
        d.g.visible = false;
        continue;
      }
      d.g.visible = true;
      d.g.x = cx + d.vx * tau;
      d.g.y = cy + d.vy * tau + 0.5 * GRAV * tau * tau;
      d.g.alpha = 1 - clamp01(tau / LIFE);
    }
  };

  return { timeline, duration: 3.4, update };
}

export const likeSpark: TemplateDefinition = {
  id: "like-spark",
  name: "Like Spark",
  tagline: "A tap lights up the like button — count ticks and confetti flies.",
  category: "social",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 1.8,
  palettes: PALETTES,
  fields: [
    { key: "label", type: "text", label: "Label", default: "Like this video", maxLength: 30, shrinkToFit: true },
    { key: "likes", type: "text", label: "Likes", default: "24000", maxLength: 12, help: "Digits — counts up.", shrinkToFit: true },
    { key: "sparkles", type: "toggle", label: "Sparkles", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
