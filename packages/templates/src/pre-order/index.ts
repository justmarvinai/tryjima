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

// Pre-order — the thing does not exist yet, and that is the pitch: a PRE-ORDER
// flag, the ship date on its own line, and a claimed-so-far bar that fills to
// show how fast the run is going.
//
// `waitlist-card` collects names for something with no date. This has a date
// and a price, which changes the ask from "tell me when" to "buy it now".

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;
const num = (v: unknown, fallback: number): number => (typeof v === "number" && Number.isFinite(v) ? v : fallback);

const PALETTES: Palette[] = [
  { id: "ink", name: "Ink", colors: { background: "#111216", textColor: "#F4F5F7", accent: "#FBBF24" } },
  { id: "paper", name: "Paper", colors: { background: "#F6F5F1", textColor: "#15161A", accent: "#E0483C" } },
  { id: "sea", name: "Sea", colors: { background: "#0B1A20", textColor: "#E9F5F8", accent: "#22D3EE" } },
  { id: "moss", name: "Moss", colors: { background: "#0F1A13", textColor: "#EBF6EE", accent: "#4ADE80" } },
];

interface Layout {
  artFrac: number;
  titleFrac: number;
  topFrac: number;
}

function layout(aspect: Aspect): Layout {
  switch (aspect) {
    case "16:9":
      return { artFrac: 0.26, titleFrac: 0.05, topFrac: 0.14 };
    case "9:16":
      return { artFrac: 0.56, titleFrac: 0.064, topFrac: 0.15 };
    case "4:5":
      return { artFrac: 0.5, titleFrac: 0.058, topFrac: 0.13 };
    case "1:1":
    default:
      return { artFrac: 0.42, titleFrac: 0.056, topFrac: 0.13 };
  }
}

const ART_AT = 0.25;
const FLAG_AT = 0.65;
const BAR_AT = 1.3;
const DURATION = 5.2;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, images } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#111216"));
  const textColor = str(values.textColor, pc("textColor", "#F4F5F7"));
  const accent = str(values.accent, pc("accent", "#FBBF24"));
  const product = str(values.product, "The Field Notebook");
  const price = str(values.price, "€24");
  const ship = str(values.ship, "Ships 14 March");
  const claimed = Math.max(0, Math.min(100, num(values.claimed, 68)));
  const claimLabel = str(values.claimLabel, "of the first run claimed").trim();
  const showBar = on(values.showBar);

  root.addChild(new Graphics().rect(0, 0, size.width, size.height).fill(bg));

  const L = layout(ctx.aspect);
  const cx = size.width / 2;
  const art = Math.min(size.width * L.artFrac, size.height * 0.36);
  const artCy = size.height * L.topFrac + art / 2;
  const titleSize = Math.round(size.width * L.titleFrac);

  const timeline = new JimaTimeline();

  // --- Product art ---
  const holder = new Container();
  holder.position.set(cx, artCy);
  root.addChild(holder);
  const tex = isImageRef(values.image) ? images.image : null;
  const radius = art * 0.08;
  if (tex) {
    const sp = new Sprite(tex);
    const scale = Math.max(art / sp.texture.width, art / sp.texture.height);
    sp.scale.set(scale);
    sp.anchor.set(0.5);
    const clip = new Graphics().roundRect(-art / 2, -art / 2, art, art, radius).fill("#FFFFFF");
    holder.addChild(sp, clip);
    sp.mask = clip;
  } else {
    holder.addChild(
      new Graphics()
        .roundRect(-art / 2, -art / 2, art, art, radius)
        .fill({ color: textColor, alpha: 0.07 })
        .stroke({ color: textColor, width: Math.max(2, art * 0.006), alpha: 0.2 }),
    );
    // A generic "not made yet" mark: an outlined box with a dashed lid.
    holder.addChild(
      new Graphics()
        .roundRect(-art * 0.22, -art * 0.16, art * 0.44, art * 0.34, art * 0.03)
        .stroke({ color: accent, width: Math.max(2, art * 0.012), alpha: 0.8 }),
    );
  }
  holder.alpha = 0;
  timeline
    .to(holder, { prop: "alpha", from: 0, to: 1, start: ART_AT, duration: 0.4, ease: outQuad })
    .to(holder, { prop: "y", from: artCy + art * 0.12, to: artCy, start: ART_AT, duration: 0.85, ease: outExpo })
    .to(holder, { prop: "scale.x", from: 0.9, to: 1, start: ART_AT, duration: 0.8, ease: outExpo })
    .to(holder, { prop: "scale.y", from: 0.9, to: 1, start: ART_AT, duration: 0.8, ease: outExpo });

  // --- PRE-ORDER flag, tilted over the art's corner ---
  const flagSize = Math.round(titleSize * 0.36);
  const flagLabel = makeText(fonts, {
    text: "PRE-ORDER",
    role: "body",
    weight: 800,
    size: flagSize,
    color: bg,
    anchor: 0.5,
    letterSpacing: flagSize * 0.14,
  });
  const fw = flagLabel.width + flagSize * 1.8;
  const fh = flagSize * 2.3;
  const flag = new Container();
  flag.addChild(new Graphics().roundRect(-fw / 2, -fh / 2, fw, fh, flagSize * 0.3).fill(accent), flagLabel);
  flag.position.set(cx + art * 0.34, artCy - art * 0.42);
  flag.rotation = -0.12;
  flag.scale.set(0);
  root.addChild(flag);
  timeline
    .to(flag, { prop: "scale.x", from: 0, to: 1, start: FLAG_AT, duration: 0.5, ease: outBack })
    .to(flag, { prop: "scale.y", from: 0, to: 1, start: FLAG_AT, duration: 0.5, ease: outBack });

  // --- Name, price, ship date ---
  const nameY = artCy + art / 2 + titleSize * 0.9;
  const n = makeText(fonts, { text: product, role: "display", weight: 800, size: titleSize, color: textColor, anchor: 0.5 });
  const maxW = size.width * 0.86;
  if (n.width > maxW) n.scale.set(maxW / n.width);
  n.position.set(cx, nameY);
  n.alpha = 0;
  root.addChild(n);
  timeline
    .to(n, { prop: "alpha", from: 0, to: 1, start: FLAG_AT + 0.1, duration: 0.4, ease: outQuad })
    .to(n, { prop: "y", from: nameY + titleSize * 0.35, to: nameY, start: FLAG_AT + 0.1, duration: 0.8, ease: outExpo });

  const priceY = nameY + titleSize * 0.9;
  const p = makeText(fonts, { text: price, role: "display", weight: 800, size: titleSize * 0.86, color: accent, anchor: 0.5 });
  p.position.set(cx, priceY);
  p.alpha = 0;
  root.addChild(p);
  timeline
    .to(p, { prop: "alpha", from: 0, to: 1, start: FLAG_AT + 0.28, duration: 0.35, ease: outQuad })
    .to(p, { prop: "scale.x", from: 0.8, to: 1, start: FLAG_AT + 0.28, duration: 0.6, ease: outBack })
    .to(p, { prop: "scale.y", from: 0.8, to: 1, start: FLAG_AT + 0.28, duration: 0.6, ease: outBack });

  const shipSize = Math.round(titleSize * 0.4);
  const shipY = priceY + titleSize * 0.75;
  const shipHolder = new Container();
  const shipText = makeText(fonts, { text: ship, role: "body", weight: 700, size: shipSize, color: textColor, anchor: 0.5 });
  const sw = shipText.width + shipSize * 2;
  const sh = shipSize * 2.1;
  shipHolder.addChild(
    new Graphics()
      .roundRect(-sw / 2, -sh / 2, sw, sh, sh / 2)
      .stroke({ color: textColor, width: Math.max(2, size.width * 0.0016), alpha: 0.3 }),
    shipText,
  );
  shipHolder.position.set(cx, shipY);
  shipHolder.alpha = 0;
  root.addChild(shipHolder);
  timeline
    .to(shipHolder, { prop: "alpha", from: 0, to: 0.9, start: FLAG_AT + 0.45, duration: 0.4, ease: outQuad })
    .to(shipHolder, { prop: "y", from: shipY + shipSize * 0.5, to: shipY, start: FLAG_AT + 0.45, duration: 0.75, ease: outQuint });

  // --- Claimed bar ---
  if (showBar) {
    const barW = size.width * 0.62;
    const barH = Math.max(8, size.width * 0.013);
    const barY = shipY + shipSize * 2.6;
    root.addChild(
      new Graphics().roundRect(cx - barW / 2, barY, barW, barH, barH / 2).fill({ color: textColor, alpha: 0.14 }),
    );
    const fill = new Graphics().roundRect(0, 0, barW * (claimed / 100), barH, barH / 2).fill(accent);
    fill.pivot.set(0, 0);
    fill.position.set(cx - barW / 2, barY);
    fill.scale.x = 0;
    root.addChild(fill);
    timeline.to(fill, { prop: "scale.x", from: 0, to: 1, start: BAR_AT, duration: 1.0, ease: outQuint });

    const lab = makeText(fonts, {
      text: `${Math.round(claimed)}% ${claimLabel}`,
      role: "body",
      weight: 600,
      size: shipSize * 0.9,
      color: textColor,
      anchor: 0.5,
    });
    lab.alpha = 0;
    lab.position.set(cx, barY + barH + shipSize * 1.1);
    root.addChild(lab);
    timeline.to(lab, { prop: "alpha", from: 0, to: 0.62, start: BAR_AT + 0.4, duration: 0.5, ease: outQuad });
  }

  return { timeline, duration: DURATION };
}

export const preOrder: TemplateDefinition = {
  id: "pre-order",
  name: "Pre-order",
  tagline: "A pre-order flag, the ship date, and a bar showing how much of the run is gone.",
  category: "product",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "4:5",
  loopable: false,
  posterTime: 3.6,
  fontRoles: { product: "display", ship: "body" },
  palettes: PALETTES,
  fields: [
    { key: "image", type: "image", label: "Product photo", default: null, optional: true },
    { key: "product", type: "text", label: "Product", default: "The Field Notebook", maxLength: 34, shrinkToFit: true },
    { key: "price", type: "text", label: "Price", default: "€24", maxLength: 14 },
    { key: "ship", type: "text", label: "Ship date", default: "Ships 14 March", maxLength: 28 },
    { key: "claimed", type: "slider", label: "Claimed %", default: 68, min: 0, max: 100, step: 1 },
    { key: "claimLabel", type: "text", label: "Bar label", default: "of the first run claimed", maxLength: 40 },
    { key: "showBar", type: "toggle", label: "Claimed bar", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
