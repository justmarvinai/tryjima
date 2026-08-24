import { Container, Graphics, Sprite } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  makeOutBack,
  outQuad,
  spring,
  linear,
  type Aspect,
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
  { id: "studio", name: "Studio", colors: { background: "#F4F1EC", accent: "#FF4D1C", textColor: "#101014", muted: "#5B5B68", onAccent: "#FFFFFF" } },
  { id: "grape", name: "Grape", colors: { background: "#F3EEFF", accent: "#7C5CFF", textColor: "#241452", muted: "#6B6088", onAccent: "#FFFFFF" } },
  { id: "sky", name: "Sky", colors: { background: "#EAF2FB", accent: "#2E5BD6", textColor: "#0F1B2A", muted: "#52607A", onAccent: "#FFFFFF" } },
  { id: "ink", name: "Ink", colors: { background: "#101014", accent: "#FF6A3C", textColor: "#FFFFFF", muted: "#A7ADB8", onAccent: "#FFFFFF" } },
];

interface P3Cfg {
  ringRF: number;
  prodCyF: number;
  nameF: number;
}

const P3CFG: Record<Aspect, P3Cfg> = {
  "1:1": { ringRF: 0.3, prodCyF: 0.44, nameF: 0.066 },
  "4:5": { ringRF: 0.3, prodCyF: 0.44, nameF: 0.064 },
  "9:16": { ringRF: 0.32, prodCyF: 0.44, nameF: 0.072 },
  "16:9": { ringRF: 0.34, prodCyF: 0.46, nameF: 0.05 },
};

const DUR = 4.2;

/** Crisp-fit: re-make one size smaller if it would overflow maxWidth. */
function fitText(fonts: TemplateContext["fonts"], opts: MakeTextOptions, maxWidth: number) {
  const t = makeText(fonts, opts);
  if (maxWidth > 0 && t.width > maxWidth) {
    const shrunk = Math.max(8, Math.floor(opts.size * (maxWidth / t.width)));
    if (shrunk < opts.size) return makeText(fonts, { ...opts, size: shrunk });
  }
  return t;
}

/** A small circular-refresh glyph (ring + arrowhead) implying rotation. */
function rotateGlyph(s: number, color: string): Graphics {
  const g = new Graphics();
  g.circle(0, 0, s * 0.42).stroke({ color, width: Math.max(2, s * 0.14) });
  g.poly([s * 0.42 - s * 0.16, -s * 0.34, s * 0.42 + s * 0.18, -s * 0.34, s * 0.42, -s * 0.02]).fill(color);
  return g;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, images } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F4F1EC"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const onAccent = pc("onAccent", "#FFFFFF");
  const name = str(values.name, "The New One");
  // Optional badge: respect an explicit empty string (hide) vs. unset (default).
  const badgeRaw = typeof values.badge === "string" ? values.badge : "360° VIEW";
  const badge = badgeRaw.trim().toUpperCase();
  const showGlow = values.glow !== false;

  const W = size.width;
  const H = size.height;
  const cx = W / 2;
  root.addChild(new Graphics().rect(0, 0, W, H).fill(bg));

  const cfg = P3CFG[ctx.aspect];
  const ringR = Math.min(W, H) * cfg.ringRF;
  const prodCy = H * cfg.prodCyF;
  const box = ringR * 1.28;

  const timeline = new JimaTimeline();

  // --- Soft stage circle behind the product ---
  if (showGlow) {
    const stage = new Graphics().circle(0, 0, ringR * 1.06).fill({ color: accent, alpha: 0.08 });
    stage.position.set(cx, prodCy);
    stage.alpha = 0;
    root.addChild(stage);
    timeline.to(stage, { prop: "alpha", from: 0, to: 1, start: 0.1, duration: 0.6, ease: outQuad });
  }

  // --- Turntable ring: faint full track + a rotating accent "comet" ---
  const track = new Graphics().circle(0, 0, ringR).stroke({ color: textColor, width: Math.max(2, Math.min(W, H) * 0.008), alpha: 0.14 });
  track.position.set(cx, prodCy);
  track.alpha = 0;
  root.addChild(track);

  const spinner = new Container();
  spinner.position.set(cx, prodCy);
  const beadR = ringR * 0.07;
  for (let k = 0; k < 6; k++) {
    const a = -k * 0.16;
    const bead = new Graphics().circle(Math.cos(a) * ringR, Math.sin(a) * ringR, beadR * (1 - k * 0.13)).fill(accent);
    bead.alpha = 1 - k * 0.13;
    spinner.addChild(bead);
  }
  spinner.alpha = 0;
  root.addChild(spinner);
  timeline
    .to(track, { prop: "alpha", from: 0, to: 1, start: 0.2, duration: 0.6, ease: outQuad })
    .to(spinner, { prop: "alpha", from: 0, to: 1, start: 0.3, duration: 0.6, ease: outQuad })
    // Continuous slow rotation (pure linear tween across the whole clip).
    .to(spinner, { prop: "rotation", from: 0, to: Math.PI * 2 * 1.4, start: 0.4, duration: DUR - 0.4, ease: linear });

  // --- Contact shadow under the product ---
  const shadow = new Graphics().ellipse(0, 0, ringR * 0.62, ringR * 0.13).fill({ color: 0x000000, alpha: 0.14 });
  shadow.position.set(cx, prodCy + ringR * 0.92);
  shadow.alpha = 0;
  root.addChild(shadow);
  timeline.to(shadow, { prop: "alpha", from: 0, to: 1, start: 0.5, duration: 0.5, ease: outQuad });

  // --- Product (gentle sway + bob) ---
  const prodWrap = new Container();
  prodWrap.position.set(cx, prodCy);
  const riser = new Container();
  riser.alpha = 0;
  riser.scale.set(0.82);
  prodWrap.addChild(riser);
  root.addChild(prodWrap);

  const tex = images.product ?? null;
  if (tex) {
    const s = new Sprite(tex);
    s.anchor.set(0.5);
    s.scale.set(Math.min(box / tex.width, box / tex.height));
    riser.addChild(s);
  } else {
    const pw = box * 0.44;
    const ph = box * 0.72;
    const r = pw * 0.18;
    riser.addChild(new Graphics().roundRect(-pw / 2, -ph / 2, pw, ph, r).fill(accent));
    riser.addChild(new Graphics().roundRect(-pw / 2 + pw * 0.14, -ph / 2 + pw * 0.14, pw * 0.72, ph * 0.4, r * 0.7).fill({ color: 0xffffff, alpha: 0.16 }));
    riser.addChild(new Graphics().circle(0, ph * 0.18, pw * 0.2).fill({ color: 0xffffff, alpha: 0.18 }));
  }
  timeline
    .to(riser, { prop: "alpha", from: 0, to: 1, start: 0.35, duration: 0.35, ease: outQuad })
    .to(riser, { prop: "scale.x", from: 0.82, to: 1, start: 0.35, duration: 0.8, ease: spring(0.55) })
    .to(riser, { prop: "scale.y", from: 0.82, to: 1, start: 0.35, duration: 0.8, ease: spring(0.55) });
  // Sway (settles upright at the end) + gentle bob.
  timeline
    .to(prodWrap, { prop: "rotation", from: 0, to: -2.4 * DEG, start: 1.4, duration: 1.0, ease: outQuad })
    .to(prodWrap, { prop: "rotation", from: -2.4 * DEG, to: 2.4 * DEG, start: 2.4, duration: 1.4, ease: outQuad })
    .to(prodWrap, { prop: "rotation", from: 2.4 * DEG, to: 0, start: 3.8, duration: 0.4, ease: outQuad })
    .to(prodWrap, { prop: "y", from: prodCy, to: prodCy - H * 0.009, start: 1.4, duration: 1.2, ease: outQuad })
    .to(prodWrap, { prop: "y", from: prodCy - H * 0.009, to: prodCy, start: 2.6, duration: 1.6, ease: outQuad });

  // --- "360° VIEW" badge (top chip) ---
  if (badge.length > 0) {
    const badgeCy = ctx.aspect === "9:16" ? 250 : H * 0.11;
    const bSize = Math.round(Math.min(W, H) * 0.03);
    const chip = new Container();
    const glyph = rotateGlyph(bSize * 1.2, onAccent);
    const bLabel = makeText(fonts, { text: badge, role: "display", weight: 700, size: bSize, color: onAccent, anchor: { x: 0, y: 0.5 }, letterSpacing: 1 });
    const padX = bSize * 0.9;
    const glyphW = bSize * 1.2;
    const gapX = bSize * 0.5;
    const innerW = glyphW + gapX + bLabel.width;
    const chipW = innerW + padX * 2;
    const chipH = bSize * 2.0;
    chip.addChild(new Graphics().roundRect(-chipW / 2, -chipH / 2, chipW, chipH, chipH / 2).fill(accent));
    glyph.position.set(-chipW / 2 + padX + glyphW / 2, 0);
    bLabel.position.set(-chipW / 2 + padX + glyphW + gapX, 0);
    chip.addChild(glyph, bLabel);
    chip.position.set(cx, badgeCy);
    chip.scale.set(0);
    root.addChild(chip);
    timeline
      .to(chip, { prop: "scale.x", from: 0, to: 1, start: 0.5, duration: 0.6, ease: makeOutBack(1.7) })
      .to(chip, { prop: "scale.y", from: 0, to: 1, start: 0.5, duration: 0.6, ease: makeOutBack(1.7) });
  }

  // --- Product name (below the turntable) ---
  const nameY = prodCy + ringR + Math.min(W, H) * 0.1;
  const nameSize = Math.round(W * cfg.nameF);
  const nameText = fitText(
    fonts,
    { text: name, role: "display", weight: 700, size: nameSize, color: textColor, anchor: 0.5, align: "center" },
    W * 0.8,
  );
  nameText.position.set(cx, nameY);
  nameText.alpha = 0;
  root.addChild(nameText);
  timeline
    .to(nameText, { prop: "alpha", from: 0, to: 1, start: 1.5, duration: 0.5, ease: outQuad })
    .to(nameText, { prop: "y", from: nameY + 18, to: nameY, start: 1.5, duration: 0.6, ease: outQuad });

  return { timeline, duration: DUR };
}

export const product360: TemplateDefinition = {
  id: "product-360",
  name: "Product 360",
  tagline: "A product spins on a turntable ring for a 360° reveal.",
  category: "product",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 2.6,
  palettes: PALETTES,
  fields: [
    { key: "product", type: "image", label: "Product image", default: "", optional: true, help: "Transparent PNG works best; the whole product is shown." },
    { key: "name", type: "text", label: "Name", default: "The New One", maxLength: 28, shrinkToFit: true },
    { key: "badge", type: "text", label: "Badge", default: "360° VIEW", maxLength: 14, optional: true },
    { key: "glow", type: "toggle", label: "Glow", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
