import { Container, Graphics, Sprite } from "pixi.js";
import {
  JimaTimeline,
  isImageRef,
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

// Packaging — a box in three-quarter view, its front and side faces built as
// separate parallelograms, turning slightly so you read it as an object. For
// launches where the packaging *is* the product photo.
//
// `unbox-reveal` opens a box. This one never opens: it presents the printed
// carton, which is what a packaging designer actually wants to post.

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;

const PALETTES: Palette[] = [
  { id: "studio", name: "Studio", colors: { background: "#EFEDE7", textColor: "#15161A", accent: "#C9603F" } },
  { id: "ink", name: "Ink", colors: { background: "#111216", textColor: "#F4F5F7", accent: "#F2B33D" } },
  { id: "sage", name: "Sage", colors: { background: "#EBF1EC", textColor: "#111D15", accent: "#3F7D63" } },
  { id: "cobalt", name: "Cobalt", colors: { background: "#EDF0F8", textColor: "#101526", accent: "#2554D4" } },
];

interface Layout {
  boxFrac: number;
  titleFrac: number;
  centerFrac: number;
}

function layout(aspect: Aspect): Layout {
  switch (aspect) {
    case "16:9":
      return { boxFrac: 0.24, titleFrac: 0.042, centerFrac: 0.44 };
    case "9:16":
      return { boxFrac: 0.46, titleFrac: 0.054, centerFrac: 0.42 };
    case "4:5":
      return { boxFrac: 0.42, titleFrac: 0.05, centerFrac: 0.43 };
    case "1:1":
    default:
      return { boxFrac: 0.4, titleFrac: 0.048, centerFrac: 0.43 };
  }
}

const BOX_AT = 0.3;
const DURATION = 5.2;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, images } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#EFEDE7"));
  const textColor = str(values.textColor, pc("textColor", "#15161A"));
  const accent = str(values.accent, pc("accent", "#C9603F"));
  const brand = str(values.brand, "FIKA");
  const product = str(values.product, "Filter blend");
  const meta = str(values.meta, "").trim();
  const showShadow = on(values.showShadow);

  root.addChild(new Graphics().rect(0, 0, size.width, size.height).fill(bg));

  const L = layout(ctx.aspect);
  const cx = size.width / 2;
  const cy = size.height * L.centerFrac;
  const W = Math.min(size.width * L.boxFrac, size.height * 0.3);
  const H = W * 1.45;
  const D = W * 0.42; // depth, projected
  const skew = D * 0.42; // how far the side face rises
  const titleSize = Math.round(size.width * L.titleFrac);

  const timeline = new JimaTimeline();
  const box = new Container();
  box.position.set(cx, cy);
  root.addChild(box);

  if (showShadow) {
    for (let i = 7; i >= 1; i--) {
      const f = i / 7;
      box.addChild(
        new Graphics()
          .ellipse(D * 0.3, H * 0.56, W * (0.5 + 0.06 * f), H * (0.05 + 0.012 * f))
          .fill({ color: "#000000", alpha: 0.045 }),
      );
    }
  }

  // Front face
  const front = new Graphics().rect(-W / 2, -H / 2, W, H).fill(accent);
  // Side face: a parallelogram sheared upward to the right.
  const side = new Graphics()
    .poly([W / 2, -H / 2, W / 2 + D, -H / 2 - skew, W / 2 + D, H / 2 - skew, W / 2, H / 2])
    .fill(accent);
  // Darkened with a black overlay rather than a tint, so the carton colour
  // stays exactly what the user picked and only the light changes.
  const sideShade = new Graphics()
    .poly([W / 2, -H / 2, W / 2 + D, -H / 2 - skew, W / 2 + D, H / 2 - skew, W / 2, H / 2])
    .fill({ color: "#000000", alpha: 0.22 });
  // Top face
  const top = new Graphics()
    .poly([-W / 2, -H / 2, W / 2, -H / 2, W / 2 + D, -H / 2 - skew, -W / 2 + D, -H / 2 - skew])
    .fill({ color: "#FFFFFF", alpha: 0.16 });
  const topBase = new Graphics()
    .poly([-W / 2, -H / 2, W / 2, -H / 2, W / 2 + D, -H / 2 - skew, -W / 2 + D, -H / 2 - skew])
    .fill(accent);

  box.addChild(topBase, top, side, sideShade, front);

  // --- Printed front: image or a wordmark + rule ---
  const face = new Container();
  box.addChild(face);
  const tex = isImageRef(values.artwork) ? images.artwork : null;
  if (tex) {
    const sp = new Sprite(tex);
    const sc = Math.max(W / sp.texture.width, H / sp.texture.height);
    sp.scale.set(sc);
    sp.anchor.set(0.5);
    const clip = new Graphics().rect(-W / 2, -H / 2, W, H).fill("#FFFFFF");
    face.addChild(sp, clip);
    sp.mask = clip;
  } else {
    const b = makeText(fonts, {
      text: brand.toUpperCase(),
      role: "display",
      weight: 800,
      size: W * 0.17,
      color: bg,
      anchor: 0.5,
      letterSpacing: W * 0.02,
    });
    if (b.width > W * 0.76) b.scale.set((W * 0.76) / b.width);
    b.y = -H * 0.18;
    face.addChild(b);
    face.addChild(new Graphics().rect(-W * 0.22, -H * 0.06, W * 0.44, Math.max(2, W * 0.012)).fill({ color: bg, alpha: 0.7 }));
    const p = makeText(fonts, {
      text: product,
      role: "body",
      weight: 600,
      size: W * 0.085,
      color: bg,
      anchor: 0.5,
    });
    if (p.width > W * 0.8) p.scale.set((W * 0.8) / p.width);
    p.alpha = 0.85;
    p.y = H * 0.04;
    face.addChild(p);
  }

  // The turn: a small rotation settling to rest, which is all a carton needs.
  box.alpha = 0;
  timeline
    .to(box, { prop: "alpha", from: 0, to: 1, start: BOX_AT, duration: 0.4, ease: outQuad })
    .to(box, { prop: "y", from: cy + H * 0.14, to: cy, start: BOX_AT, duration: 0.95, ease: outExpo })
    .to(box, { prop: "rotation", from: 0.055, to: 0, start: BOX_AT, duration: 1.2, ease: outExpo })
    .to(box, { prop: "scale.x", from: 0.92, to: 1, start: BOX_AT, duration: 1.0, ease: outExpo })
    .to(box, { prop: "scale.y", from: 0.92, to: 1, start: BOX_AT, duration: 1.0, ease: outExpo });

  // --- Type ---
  const titleY = cy + H * 0.62 + titleSize * 0.5;
  const t = makeText(fonts, { text: product, role: "display", weight: 800, size: titleSize, color: textColor, anchor: 0.5 });
  const maxW = size.width * 0.86;
  if (t.width > maxW) t.scale.set(maxW / t.width);
  t.position.set(cx, titleY);
  t.alpha = 0;
  root.addChild(t);
  timeline
    .to(t, { prop: "alpha", from: 0, to: 1, start: BOX_AT + 0.6, duration: 0.4, ease: outQuad })
    .to(t, { prop: "y", from: titleY + titleSize * 0.3, to: titleY, start: BOX_AT + 0.6, duration: 0.8, ease: outExpo });

  if (meta.length > 0) {
    const m = makeText(fonts, { text: meta, role: "body", weight: 600, size: titleSize * 0.5, color: textColor, anchor: 0.5 });
    const my = titleY + titleSize * 0.85;
    m.alpha = 0;
    m.position.set(cx, my);
    root.addChild(m);
    timeline
      .to(m, { prop: "alpha", from: 0, to: 0.66, start: BOX_AT + 0.85, duration: 0.5, ease: outQuad })
      .to(m, { prop: "y", from: my + titleSize * 0.18, to: my, start: BOX_AT + 0.85, duration: 0.8, ease: outQuint });
  }

  return { timeline, duration: DURATION };
}

export const packagingMockup: TemplateDefinition = {
  id: "packaging-mockup",
  name: "Packaging",
  tagline: "A printed carton in three-quarter view, turning gently to rest.",
  category: "showcase",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "4:5",
  loopable: false,
  posterTime: 3.4,
  fontRoles: { brand: "display", meta: "body" },
  palettes: PALETTES,
  fields: [
    { key: "artwork", type: "image", label: "Front artwork", default: null, optional: true },
    { key: "brand", type: "text", label: "Brand on the box", default: "FIKA", maxLength: 16 },
    { key: "product", type: "text", label: "Product", default: "Filter blend", maxLength: 30, shrinkToFit: true },
    { key: "meta", type: "text", label: "Meta", default: "250 g · whole bean", maxLength: 40, optional: true },
    { key: "showShadow", type: "toggle", label: "Contact shadow", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Carton", default: "", optional: true },
  ],
  build,
};
