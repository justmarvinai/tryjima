import { Container, Graphics, Sprite } from "pixi.js";
import {
  JimaTimeline,
  isImageRef,
  makeText,
  outBack,
  outExpo,
  outQuad,
  outQuint,
  type Aspect,
  type BuiltTemplate,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";

// Apparel — a t-shirt hangs in frame, your artwork prints onto the chest, and
// the colourway swatches step through underneath. Merch drops, band tees,
// club kit: the shape everyone recognises before they read a word.
//
// The garment is drawn as a path (shoulders, sleeves, hem) rather than an
// image, so it recolours with the swatch instantly and stays crisp at export.

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;

const PALETTES: Palette[] = [
  { id: "studio", name: "Studio", colors: { background: "#F1EFEA", textColor: "#16171B", accent: "#E0483C" } },
  { id: "ink", name: "Ink", colors: { background: "#111216", textColor: "#F4F5F7", accent: "#FBBF24" } },
  { id: "moss", name: "Moss", colors: { background: "#EEF3EC", textColor: "#111C14", accent: "#2F7D5B" } },
  { id: "night", name: "Night", colors: { background: "#0E1220", textColor: "#EEF1FA", accent: "#7DD3FC" } },
];

interface Layout {
  shirtFrac: number;
  titleFrac: number;
  centerFrac: number;
}

function layout(aspect: Aspect): Layout {
  switch (aspect) {
    case "16:9":
      return { shirtFrac: 0.34, titleFrac: 0.04, centerFrac: 0.44 };
    case "9:16":
      return { shirtFrac: 0.68, titleFrac: 0.052, centerFrac: 0.42 };
    case "4:5":
      return { shirtFrac: 0.62, titleFrac: 0.048, centerFrac: 0.43 };
    case "1:1":
    default:
      return { shirtFrac: 0.58, titleFrac: 0.046, centerFrac: 0.43 };
  }
}

const SHIRT_AT = 0.25;
const PRINT_AT = 0.9;
const SWATCH_AT = 1.5;
const DURATION = 5.2;

/** A front-view tee, drawn to a unit box of width 1 centred on x. */
function teePath(w: number, h: number): number[] {
  const sw = w * 0.5;
  const sl = w * 0.24; // sleeve drop
  return [
    -w * 0.28, -h * 0.5,        // left shoulder top
    -w * 0.1, -h * 0.44,        // neck left
    0, -h * 0.4,                // neck bottom
    w * 0.1, -h * 0.44,
    w * 0.28, -h * 0.5,
    sw, -h * 0.5 + sl * 0.6,    // right sleeve tip
    w * 0.34, -h * 0.5 + sl * 1.5,
    w * 0.3, h * 0.5,           // right hem
    -w * 0.3, h * 0.5,          // left hem
    -w * 0.34, -h * 0.5 + sl * 1.5,
    -sw, -h * 0.5 + sl * 0.6,
  ];
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, images } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F1EFEA"));
  const textColor = str(values.textColor, pc("textColor", "#16171B"));
  const accent = str(values.accent, pc("accent", "#E0483C"));
  const title = str(values.title, "Season one tee");
  const meta = str(values.meta, "").trim();
  const printText = str(values.printText, "FIKA").trim();
  const swatches = (Array.isArray(values.swatches) ? (values.swatches as unknown[]) : [])
    .map((v) => String(v ?? "").trim())
    .filter((s) => /^#[0-9a-f]{3,8}$/i.test(s))
    .slice(0, 5);
  const showSwatches = on(values.showSwatches);

  root.addChild(new Graphics().rect(0, 0, size.width, size.height).fill(bg));

  const L = layout(ctx.aspect);
  const cx = size.width / 2;
  const cy = size.height * L.centerFrac;
  const W = Math.min(size.width * L.shirtFrac, size.height * 0.46);
  const H = W * 1.12;
  const titleSize = Math.round(size.width * L.titleFrac);

  const timeline = new JimaTimeline();
  const shirt = new Container();
  shirt.position.set(cx, cy);
  root.addChild(shirt);

  const base = swatches[0] ?? "#F4F4F2";
  // A hairline outline, always: the first colourway is usually a natural or
  // white, and on a light page an unstroked garment simply disappears.
  const body = new Graphics()
    .poly(teePath(W, H))
    .fill(base)
    .stroke({ color: textColor, width: Math.max(2, W * 0.005), alpha: 0.22 });
  shirt.addChild(body);
  // A soft fold shading down the centre and under the sleeves.
  shirt.addChild(
    new Graphics()
      .poly([-W * 0.06, -H * 0.36, W * 0.03, -H * 0.36, W * 0.06, H * 0.5, -W * 0.02, H * 0.5])
      .fill({ color: "#000000", alpha: 0.05 }),
  );
  shirt.addChild(
    new Graphics()
      .poly([-W * 0.1, -H * 0.46, W * 0.1, -H * 0.46, 0, -H * 0.36])
      .stroke({ color: "#000000", width: Math.max(2, W * 0.008), alpha: 0.14 }),
  );

  // --- The print ---
  const printW = W * 0.42;
  const print = new Container();
  print.position.set(0, -H * 0.06);
  shirt.addChild(print);
  const tex = isImageRef(values.artwork) ? images.artwork : null;
  if (tex) {
    const sp = new Sprite(tex);
    const sc = Math.min(printW / sp.texture.width, printW / sp.texture.height);
    sp.scale.set(sc);
    sp.anchor.set(0.5);
    print.addChild(sp);
  } else if (printText.length > 0) {
    const t = makeText(fonts, {
      text: printText.toUpperCase(),
      role: "display",
      weight: 800,
      size: printW * 0.32,
      color: accent,
      anchor: 0.5,
      letterSpacing: printW * 0.02,
    });
    if (t.width > printW) t.scale.set(printW / t.width);
    print.addChild(t);
    print.addChild(
      new Graphics()
        .circle(0, 0, printW * 0.44)
        .stroke({ color: accent, width: Math.max(2, printW * 0.018), alpha: 0.85 }),
    );
  }
  print.alpha = 0;
  print.scale.set(0.7);
  timeline
    .to(print, { prop: "alpha", from: 0, to: 1, start: PRINT_AT, duration: 0.35, ease: outQuad })
    .to(print, { prop: "scale.x", from: 0.7, to: 1, start: PRINT_AT, duration: 0.65, ease: outBack })
    .to(print, { prop: "scale.y", from: 0.7, to: 1, start: PRINT_AT, duration: 0.65, ease: outBack });

  shirt.alpha = 0;
  timeline
    .to(shirt, { prop: "alpha", from: 0, to: 1, start: SHIRT_AT, duration: 0.4, ease: outQuad })
    .to(shirt, { prop: "y", from: cy - H * 0.14, to: cy, start: SHIRT_AT, duration: 0.95, ease: outExpo })
    .to(shirt, { prop: "rotation", from: -0.03, to: 0, start: SHIRT_AT, duration: 1.1, ease: outExpo });

  // --- Colourway swatches ---
  if (showSwatches && swatches.length > 1) {
    const r = titleSize * 0.5;
    const gap = r * 3;
    const y = cy + H * 0.62;
    swatches.forEach((hex, i) => {
      const x = cx + (i - (swatches.length - 1) / 2) * gap;
      const dot = new Container();
      dot.position.set(x, y);
      dot.addChild(new Graphics().circle(0, 0, r).fill(hex));
      dot.addChild(
        new Graphics().circle(0, 0, r).stroke({ color: textColor, width: Math.max(1, r * 0.09), alpha: 0.2 }),
      );
      if (i === 0) {
        dot.addChild(
          new Graphics().circle(0, 0, r * 1.45).stroke({ color: accent, width: Math.max(2, r * 0.14), alpha: 0.9 }),
        );
      }
      dot.scale.set(0);
      root.addChild(dot);
      const at = SWATCH_AT + i * 0.1;
      timeline
        .to(dot, { prop: "scale.x", from: 0, to: 1, start: at, duration: 0.45, ease: outBack })
        .to(dot, { prop: "scale.y", from: 0, to: 1, start: at, duration: 0.45, ease: outBack });
    });
  }

  // --- Type ---
  const titleY = cy + H * (showSwatches && swatches.length > 1 ? 0.82 : 0.66);
  const t = makeText(fonts, { text: title, role: "display", weight: 800, size: titleSize, color: textColor, anchor: 0.5 });
  const maxW = size.width * 0.86;
  if (t.width > maxW) t.scale.set(maxW / t.width);
  t.position.set(cx, titleY);
  t.alpha = 0;
  root.addChild(t);
  timeline
    .to(t, { prop: "alpha", from: 0, to: 1, start: SWATCH_AT + 0.2, duration: 0.4, ease: outQuad })
    .to(t, { prop: "y", from: titleY + titleSize * 0.3, to: titleY, start: SWATCH_AT + 0.2, duration: 0.8, ease: outExpo });

  if (meta.length > 0) {
    const m = makeText(fonts, { text: meta, role: "body", weight: 600, size: titleSize * 0.5, color: textColor, anchor: 0.5 });
    const my = titleY + titleSize * 0.85;
    m.alpha = 0;
    m.position.set(cx, my);
    root.addChild(m);
    timeline
      .to(m, { prop: "alpha", from: 0, to: 0.66, start: SWATCH_AT + 0.4, duration: 0.5, ease: outQuad })
      .to(m, { prop: "y", from: my + titleSize * 0.18, to: my, start: SWATCH_AT + 0.4, duration: 0.8, ease: outQuint });
  }

  return { timeline, duration: DURATION };
}

export const apparelMockup: TemplateDefinition = {
  id: "apparel-mockup",
  name: "Apparel",
  tagline: "A tee hangs in frame, your artwork prints on the chest, colourways step through.",
  category: "showcase",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "4:5",
  loopable: false,
  posterTime: 3.6,
  fontRoles: { title: "display", meta: "body" },
  palettes: PALETTES,
  fields: [
    { key: "artwork", type: "image", label: "Print artwork", default: null, optional: true },
    { key: "printText", type: "text", label: "Or print this text", default: "FIKA", maxLength: 16, optional: true },
    { key: "title", type: "text", label: "Title", default: "Season one tee", maxLength: 32, shrinkToFit: true },
    { key: "meta", type: "text", label: "Meta", default: "Heavyweight cotton · S–XXL", maxLength: 44, optional: true },
    {
      key: "swatches",
      type: "textlist",
      label: "Colourways (hex)",
      default: ["#F2F0EA", "#1C1D21", "#4E6E5D", "#C9603F"],
      minItems: 1,
      maxItems: 5,
      maxLength: 9,
    },
    { key: "showSwatches", type: "toggle", label: "Show colourways", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Print colour", default: "", optional: true },
  ],
  build,
};
