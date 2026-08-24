import { Container, Graphics, Sprite } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  makeOutBack,
  outQuint,
  outQuad,
  spring,
  type Aspect,
  type BuiltTemplate,
  type MakeTextOptions,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { radialGlowTexture } from "../shared/glow";

const DEG = Math.PI / 180;
const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;

const PALETTES: Palette[] = [
  { id: "studio", name: "Studio", colors: { background: "#F4F1EC", accent: "#FF4D1C", textColor: "#101014", muted: "#5B5B68", onAccent: "#FFFFFF" } },
  { id: "grape", name: "Grape", colors: { background: "#F3EEFF", accent: "#7C5CFF", textColor: "#241452", muted: "#6B6088", onAccent: "#FFFFFF" } },
  { id: "sky", name: "Sky", colors: { background: "#EAF2FB", accent: "#2E5BD6", textColor: "#0F1B2A", muted: "#52607A", onAccent: "#FFFFFF" } },
  { id: "ink", name: "Ink", colors: { background: "#101014", accent: "#FF6A3C", textColor: "#FFFFFF", muted: "#A7ADB8", onAccent: "#FFFFFF" } },
];

interface PCfg {
  boxWF: number;
  boxHF: number;
  prodYF: number;
  fontF: number;
}

const PCFG: Record<Aspect, PCfg> = {
  "1:1": { boxWF: 0.5, boxHF: 0.4, prodYF: 0.4, fontF: 0.062 },
  "4:5": { boxWF: 0.52, boxHF: 0.36, prodYF: 0.38, fontF: 0.058 },
  "9:16": { boxWF: 0.6, boxHF: 0.3, prodYF: 0.4, fontF: 0.066 },
  "16:9": { boxWF: 0.32, boxHF: 0.46, prodYF: 0.4, fontF: 0.05 },
};

/** Crisp-fit: re-make one size smaller if it would overflow maxWidth. */
function fitText(fonts: TemplateContext["fonts"], opts: MakeTextOptions, maxWidth: number) {
  const t = makeText(fonts, opts);
  if (maxWidth > 0 && t.width > maxWidth) {
    const shrunk = Math.max(8, Math.floor(opts.size * (maxWidth / t.width)));
    if (shrunk < opts.size) return makeText(fonts, { ...opts, size: shrunk });
  }
  return t;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, images } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F4F1EC"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const muted = pc("muted", "#5B5B68");
  const onAccent = pc("onAccent", "#FFFFFF");
  const name = str(values.name, "The New One");
  const tagline = str(values.tagline, "Designed to move");
  const price = str(values.price, "$49");

  root.addChild(new Graphics().rect(0, 0, size.width, size.height).fill(bg));

  const cfg = PCFG[ctx.aspect];
  const w = size.width;
  const h = size.height;
  const cx = w / 2;
  const boxW = w * cfg.boxWF;
  const boxH = h * cfg.boxHF;
  const prodY = h * cfg.prodYF;
  const groundY = prodY + boxH * 0.5;
  const fontSize = Math.round(w * cfg.fontF);

  const timeline = new JimaTimeline();

  // Soft radial spotlight behind the product.
  const showGlow = values.glow !== false;
  if (showGlow) {
    const spot = new Sprite(radialGlowTexture());
    spot.anchor.set(0.5);
    spot.tint = accent;
    spot.width = spot.height = Math.max(boxW, boxH) * 2.3;
    spot.position.set(cx, prodY);
    spot.alpha = 0;
    root.addChild(spot);
    timeline.to(spot, { prop: "alpha", from: 0, to: 0.16, start: 0.1, duration: 0.8, ease: outQuad });
  }

  // Pedestal (wide soft plinth) + reactive contact shadow.
  const pedestal = new Graphics().ellipse(0, 0, boxW * 0.62, boxH * 0.06).fill({ color: 0x000000, alpha: 0.05 });
  pedestal.position.set(cx, groundY);
  pedestal.alpha = 0;
  root.addChild(pedestal);
  const shadow = new Graphics().ellipse(0, 0, boxW * 0.42, boxH * 0.05).fill({ color: 0x000000, alpha: 0.16 });
  shadow.position.set(cx, groundY);
  shadow.alpha = 0;
  root.addChild(shadow);
  timeline
    .to(pedestal, { prop: "alpha", from: 0, to: 1, start: 0.7, duration: 0.5, ease: outQuad })
    .to(shadow, { prop: "alpha", from: 0, to: 1, start: 0.8, duration: 0.5, ease: outQuad });

  // Product floater (continuous bob) → riser (entrance) → visual.
  const floater = new Container();
  floater.position.set(cx, prodY);
  const riser = new Container();
  riser.alpha = 0;
  riser.scale.set(0.9);
  floater.addChild(riser);
  root.addChild(floater);

  const tex = images.product ?? null;
  if (tex) {
    const s = new Sprite(tex);
    s.anchor.set(0.5);
    // Contain-fit so the whole product shows.
    const fit = Math.min(boxW / tex.width, boxH / tex.height);
    s.scale.set(fit);
    riser.addChild(s);
  } else {
    // Designed rounded product-shape card.
    const pw = boxW * 0.58;
    const ph = boxH * 0.86;
    const r = pw * 0.16;
    riser.addChild(new Graphics().roundRect(-pw / 2, -ph / 2, pw, ph, r).fill(accent));
    riser.addChild(new Graphics().roundRect(-pw / 2 + pw * 0.14, -ph / 2 + pw * 0.14, pw * 0.72, ph * 0.44, r * 0.7).fill({ color: 0xffffff, alpha: 0.14 }));
    riser.addChild(new Graphics().circle(0, ph * 0.16, pw * 0.2).fill({ color: 0xffffff, alpha: 0.18 }));
  }
  timeline
    .to(riser, { prop: "alpha", from: 0, to: 1, start: 0.4, duration: 0.35, ease: outQuad })
    .to(riser, { prop: "y", from: -h * 0.1, to: 0, start: 0.4, duration: 0.8, ease: spring(0.6) })
    .to(riser, { prop: "scale.x", from: 0.9, to: 1, start: 0.4, duration: 0.8, ease: outQuint })
    .to(riser, { prop: "scale.y", from: 0.9, to: 1, start: 0.4, duration: 0.8, ease: outQuint });

  // Name.
  const nameY = groundY + fontSize * 1.15;
  const nameText = fitText(
    fonts,
    { text: name, role: "display", weight: 700, size: fontSize, color: textColor, anchor: 0.5, align: "center" },
    w * 0.8,
  );
  nameText.position.set(cx, nameY);
  nameText.alpha = 0;
  root.addChild(nameText);
  timeline
    .to(nameText, { prop: "alpha", from: 0, to: 1, start: 1.4, duration: 0.4, ease: outQuad })
    .to(nameText, { prop: "y", from: nameY + 20, to: nameY, start: 1.4, duration: 0.5, ease: outQuint });

  // Tagline (optional).
  let cursorY = nameY + fontSize * 0.92;
  if (tagline.length > 0) {
    const tagText = fitText(
      fonts,
      { text: tagline, role: "body", weight: 500, size: Math.round(fontSize * 0.52), color: muted, anchor: 0.5, align: "center" },
      w * 0.78,
    );
    tagText.position.set(cx, cursorY);
    tagText.alpha = 0;
    root.addChild(tagText);
    timeline
      .to(tagText, { prop: "alpha", from: 0, to: 1, start: 1.7, duration: 0.4, ease: outQuad })
      .to(tagText, { prop: "y", from: cursorY + 16, to: cursorY, start: 1.7, duration: 0.5, ease: outQuint });
    cursorY += fontSize * 1.2;
  }

  // Price chip (optional).
  if (price.length > 0) {
    const priceSize = Math.round(fontSize * 0.62);
    const priceW = fonts.measure(price, { family: fonts.family("display"), weight: 700, size: priceSize }) + priceSize * 1.3;
    const priceH = priceSize * 1.7;
    const chip = new Container();
    chip.addChild(new Graphics().roundRect(-priceW / 2, -priceH / 2, priceW, priceH, priceH / 2).fill(accent));
    chip.addChild(makeText(fonts, { text: price, role: "display", weight: 700, size: priceSize, color: onAccent, anchor: 0.5 }));
    chip.position.set(cx, cursorY);
    chip.scale.set(0);
    chip.rotation = -8 * DEG;
    root.addChild(chip);
    timeline
      .to(chip, { prop: "scale.x", from: 0, to: 1, start: 2.0, duration: 0.5, ease: makeOutBack(1.8) })
      .to(chip, { prop: "scale.y", from: 0, to: 1, start: 2.0, duration: 0.5, ease: makeOutBack(1.8) })
      .to(chip, { prop: "rotation", from: -8 * DEG, to: 0, start: 2.0, duration: 0.5, ease: makeOutBack(1.8) });
  }

  // Continuous gentle bob (pure in t) after the entrance settles. The float
  // owns floater.y + shadow.scale; the timeline owns shadow.alpha (no overlap).
  const FLOAT_AT = 1.2;
  const PERIOD = 2.6;
  const amp = h * 0.012;
  const update = (t: number): void => {
    const tau = t - FLOAT_AT;
    if (tau <= 0) {
      floater.y = prodY;
      shadow.scale.set(1, 1);
      return;
    }
    const env = Math.min(1, tau / 0.9);
    const bob = Math.sin((tau / PERIOD) * Math.PI * 2) * amp * env;
    floater.y = prodY + bob;
    const lift = (-bob / amp) * env; // +1 fully lifted, -1 fully settled
    const s = 1 - 0.1 * lift;
    shadow.scale.set(s, s);
  };

  return { timeline, duration: 4.0, update };
}

export const productShowcase: TemplateDefinition = {
  id: "product-showcase",
  name: "Product Showcase",
  tagline: "A hero product floats on a spotlit pedestal.",
  category: "showcase",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 2.6,
  palettes: PALETTES,
  fields: [
    { key: "product", type: "image", label: "Product image", default: "", optional: true, help: "Transparent PNG works best; the whole product is shown." },
    { key: "name", type: "text", label: "Name", default: "The New One", maxLength: 30, shrinkToFit: true },
    { key: "tagline", type: "text", label: "Tagline", default: "Designed to move", maxLength: 44, optional: true },
    { key: "price", type: "text", label: "Price", default: "$49", maxLength: 12, optional: true },
    { key: "glow", type: "toggle", label: "Glow", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
