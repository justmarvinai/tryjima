import { Container, Graphics, Sprite } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  spring,
  type BuiltTemplate,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";

const str = (v: unknown, fallback: string): string => (typeof v === "string" && v.length > 0 ? v : fallback);
const clamp01 = (u: number): number => (u < 0 ? 0 : u > 1 ? 1 : u);

const PALETTES: Palette[] = [
  { id: "white-ink", name: "White + ink", colors: { background: "#FFFFFF", textColor: "#101014", accent: "#FF4D1C" } },
  { id: "accent-wash", name: "Accent wash", colors: { background: "#FF4D1C", textColor: "#FFFFFF", accent: "#FFFFFF" } },
  { id: "duo-split", name: "Duo split", colors: { background: "#101014", textColor: "#FFFFFF", accent: "#D8F34D" } },
  { id: "soft-gradient", name: "Soft gradient", colors: { background: "#F3EEFF", textColor: "#2A1A5E", accent: "#7C5CFF" } },
];

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, images, rng } = ctx;
  const pc = (k: string, d: string) => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const brandText = str(values.brandText, "jima");
  const tagline = str(values.tagline, "");
  const burst = str(values.burst, "shapes");

  root.addChild(new Graphics().rect(0, 0, size.width, size.height).fill(bg));

  const timeline = new JimaTimeline();
  const cx = size.width / 2;
  const cy = size.height * 0.44;
  const minDim = Math.min(size.width, size.height);

  // Burst shapes (behind the logo) or ring.
  const shapes: { g: Graphics; vx: number; vy: number; rot: number }[] = [];
  if (burst === "shapes") {
    const kinds = ["circle", "tri", "rect"] as const;
    for (let i = 0; i < 12; i++) {
      const g = new Graphics();
      const s = minDim * rng.range(0.018, 0.035);
      const kind = rng.pick(kinds);
      const color = rng.pick([accent, textColor]);
      if (kind === "circle") g.circle(0, 0, s).fill(color);
      else if (kind === "rect") g.rect(-s, -s, s * 2, s * 2).fill(color);
      else g.poly([0, -s, s, s, -s, s]).fill(color);
      g.position.set(cx, cy);
      g.visible = false;
      root.addChild(g);
      const angle = rng.range(0, Math.PI * 2);
      const speed = rng.range(0.4, 0.9) * minDim;
      shapes.push({ g, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, rot: rng.range(-8, 8) });
    }
  } else if (burst === "ring") {
    const ring = new Graphics().circle(0, 0, minDim * 0.3).stroke({ color: accent, width: Math.max(3, minDim * 0.01) });
    ring.position.set(cx, cy);
    ring.scale.set(0.2);
    ring.alpha = 0;
    root.addChild(ring);
    timeline
      .to(ring, { prop: "scale.x", from: 0.2, to: 1.4, start: 0.55, duration: 0.8, ease: outExpo })
      .to(ring, { prop: "scale.y", from: 0.2, to: 1.4, start: 0.55, duration: 0.8, ease: outExpo })
      .to(ring, { prop: "alpha", from: 0.8, to: 0, start: 0.55, duration: 0.8, ease: outQuad });
  }

  // Logo (image) or brand text.
  const logoHolder = new Container();
  logoHolder.position.set(cx, cy);
  root.addChild(logoHolder);
  const tex = images.logo ?? null;
  if (tex) {
    const s = new Sprite(tex);
    s.anchor.set(0.5);
    const box = minDim * 0.42;
    s.scale.set(Math.min(box / tex.width, box / tex.height));
    logoHolder.addChild(s);
  } else {
    logoHolder.addChild(makeText(fonts, { text: brandText, role: "display", weight: 700, size: Math.round(size.width * 0.14), color: textColor, anchor: 0.5 }));
  }
  logoHolder.scale.set(0);
  timeline
    .to(logoHolder, { prop: "scale.x", from: 0, to: 1, start: 0, duration: 0.8, ease: spring(0.45) })
    .to(logoHolder, { prop: "scale.y", from: 0, to: 1, start: 0, duration: 0.8, ease: spring(0.45) })
    // micro float during hold
    .to(logoHolder, { prop: "y", from: cy, to: cy - 3, start: 1.4, duration: 1.05, ease: outQuad })
    .to(logoHolder, { prop: "y", from: cy - 3, to: cy + 3, start: 2.45, duration: 1.05, ease: outQuad });

  if (tagline.length > 0) {
    const size2 = Math.round(size.width * 0.032);
    const tag = makeText(fonts, { text: tagline, role: "body", weight: 500, size: size2, color: textColor, anchor: 0.5, letterSpacing: 2 });
    tag.position.set(cx, cy + size.width * 0.11);
    tag.alpha = 0;
    root.addChild(tag);
    timeline
      .to(tag, { prop: "alpha", from: 0, to: 0.9, start: 0.9, duration: 0.5, ease: outQuad })
      .to(tag, { prop: "style.letterSpacing", from: size2 * 0.5, to: 2, start: 0.9, duration: 0.6, ease: outExpo });
  }

  const BURST = 0.55;
  const LIFE = 0.9;
  const G = 2.0 * minDim;
  const update = (t: number) => {
    for (const c of shapes) {
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

  return { timeline, duration: 3.5, update };
}

export const logoSting: TemplateDefinition = {
  id: "logo-sting",
  name: "Logo Sting",
  tagline: "A logo lands with an elastic pop and a burst.",
  category: "brand",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 1.6,
  palettes: PALETTES,
  fields: [
    { key: "logo", type: "image", label: "Logo", default: "", optional: true, help: "Transparent PNG. Falls back to the brand text." },
    { key: "brandText", type: "text", label: "Brand text", default: "jima", maxLength: 24 },
    { key: "tagline", type: "text", label: "Tagline", default: "motion for everyone", maxLength: 48, optional: true },
    { key: "burst", type: "select", label: "Burst", default: "shapes", options: [{ value: "shapes", label: "Shapes" }, { value: "ring", label: "Ring" }, { value: "none", label: "None" }] },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
