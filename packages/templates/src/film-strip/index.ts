import { Container, Graphics, Sprite, type Texture } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outQuint,
  makeOutBack,
  type BuiltTemplate,
  type FontRegistry,
  type MakeTextOptions,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";

const DEG = Math.PI / 180;

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;

const PALETTES: Palette[] = [
  { id: "noir", name: "Noir", colors: { background: "#F5F3EE", textColor: "#17131B", accent: "#FF4D1C", band: "#141014", hole: "#F5F3EE", muted: "#9A8F86", tile: "#232025" } },
  { id: "midnight", name: "Midnight", colors: { background: "#EAF2FB", textColor: "#0F1B2A", accent: "#2E5BD6", band: "#0B121C", hole: "#EAF2FB", muted: "#7C8CA3", tile: "#1A2333" } },
  { id: "violet", name: "Violet", colors: { background: "#F3EEFF", textColor: "#241452", accent: "#7C5CFF", band: "#150C29", hole: "#F3EEFF", muted: "#8A7FA8", tile: "#251845" } },
  { id: "true-black", name: "True black", colors: { background: "#101014", textColor: "#FFFFFF", accent: "#FF6A3C", band: "#1B1A1F", hole: "#332F38", muted: "#6B7280", tile: "#242229" } },
];

/** A small "picture" glyph (frame + sun + mountains) for an empty frame. */
function imageGlyph(s: number, color: string): Graphics {
  const g = new Graphics();
  g.roundRect(-0.5 * s, -0.42 * s, s, 0.84 * s, 0.12 * s).stroke({ color, width: Math.max(2, 0.055 * s) });
  g.circle(-0.18 * s, -0.14 * s, 0.1 * s).fill(color);
  g.poly([-0.44 * s, 0.34 * s, -0.12 * s, -0.04 * s, 0.06 * s, 0.14 * s, 0.28 * s, -0.12 * s, 0.46 * s, 0.34 * s]).fill(color);
  return g;
}

/** Crisp-fit: re-make one size smaller if it would overflow maxWidth. */
function fitText(fonts: FontRegistry, opts: MakeTextOptions, maxWidth: number) {
  const t = makeText(fonts, opts);
  if (maxWidth > 0 && t.width > maxWidth) {
    const shrunk = Math.max(8, Math.floor(opts.size * (maxWidth / t.width)));
    if (shrunk < opts.size) return makeText(fonts, { ...opts, size: shrunk });
  }
  return t;
}

/** One filmstrip frame: an image (cover-fit + masked) or a designed placeholder. */
function makeFrame(
  tex: Texture | null,
  cw: number,
  ch: number,
  r: number,
  accent: string,
  muted: string,
  tileC: string,
  borderC: string,
): Container {
  const card = new Container();
  card.addChild(new Graphics().rect(-cw / 2, -ch / 2, cw, ch).fill(tileC));
  if (tex) {
    const holder = new Container();
    const sprite = new Sprite(tex);
    sprite.anchor.set(0.5);
    const cover = Math.max(cw / tex.width, ch / tex.height);
    sprite.scale.set(cover);
    const maskG = new Graphics().roundRect(-cw / 2, -ch / 2, cw, ch, r).fill(0xffffff);
    holder.addChild(sprite, maskG);
    sprite.mask = maskG;
    card.addChild(holder);
  } else {
    const blobWrap = new Container();
    const blob = new Graphics().circle(cw * 0.28, -ch * 0.26, Math.min(cw, ch) * 0.32).fill({ color: accent, alpha: 0.18 });
    const blobMask = new Graphics().roundRect(-cw / 2, -ch / 2, cw, ch, r).fill(0xffffff);
    blobWrap.addChild(blob, blobMask);
    blob.mask = blobMask;
    card.addChild(blobWrap);
    card.addChild(imageGlyph(Math.min(cw, ch) * 0.34, muted));
  }
  card.addChild(new Graphics().roundRect(-cw / 2, -ch / 2, cw, ch, r).stroke({ color: borderC, width: Math.max(1, cw * 0.006), alpha: 0.3 }));
  return card;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, images, rng } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F5F3EE"));
  const textColor = str(values.textColor, pc("textColor", "#17131B"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const band = pc("band", "#141014");
  const hole = pc("hole", "#F5F3EE");
  const muted = pc("muted", "#9A8F86");
  const tileC = pc("tile", "#232025");
  const caption = str(values.caption, "");
  const showSprockets = values.showSprockets !== false;

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const cx = w / 2;
  const stripCy = h * (ctx.aspect === "9:16" ? 0.42 : 0.46);
  const cellH = minDim * 0.5;
  const cellW = cellH * 1.35;
  const gap = cellW * 0.08;
  const pitch = cellW + gap;
  const sprocketBandH = cellH * 0.11;
  const photoH = cellH - sprocketBandH * 2.2;
  const r = Math.min(cellW, photoH) * 0.02;
  const N = 4;
  const hero = N - 1;

  const timeline = new JimaTimeline();

  const outer = new Container();
  outer.position.set(0, stripCy);
  outer.alpha = 0;
  outer.scale.set(0.94);
  root.addChild(outer);

  const inner = new Container();
  inner.position.set(cx, 0);
  outer.addChild(inner);

  // Dark filmstrip band, generously padded so it always covers the viewport
  // no matter where the strip has slid to.
  const bandPad = pitch;
  const bandLeft = -cellW / 2 - bandPad;
  const bandRight = hero * pitch + cellW / 2 + bandPad;
  inner.addChild(new Graphics().rect(bandLeft, -cellH / 2, bandRight - bandLeft, cellH).fill(band));

  if (showSprockets) {
    const holePitch = cellW * 0.11;
    const holeSize = sprocketBandH * 0.5;
    const holeR = holeSize * 0.28;
    const count = Math.ceil((bandRight - bandLeft) / holePitch) + 1;
    const topY = -cellH / 2 + sprocketBandH / 2;
    const botY = cellH / 2 - sprocketBandH / 2;
    for (let k = 0; k < count; k++) {
      const hx = bandLeft + holePitch * 0.6 + k * holePitch;
      inner.addChild(new Graphics().roundRect(hx - holeSize / 2, topY - holeSize / 2, holeSize, holeSize, holeR).fill(hole));
      inner.addChild(new Graphics().roundRect(hx - holeSize / 2, botY - holeSize / 2, holeSize, holeSize, holeR).fill(hole));
    }
  }

  const imgs: (Texture | null)[] = [images.image1 ?? null, images.image2 ?? null, images.image3 ?? null, images.image4 ?? null];
  for (let i = 0; i < N; i++) {
    const tilt = rng.range(-1.1, 1.1) * DEG;
    const frame = makeFrame(imgs[i] ?? null, cellW, photoH, r, accent, muted, tileC, textColor);
    frame.position.set(i * pitch, 0);
    frame.rotation = tilt;
    inner.addChild(frame);
  }

  timeline
    .to(outer, { prop: "alpha", from: 0, to: 1, start: 0.05, duration: 0.35, ease: outQuad })
    .to(outer, { prop: "scale.x", from: 0.94, to: 1, start: 0.05, duration: 0.55, ease: outQuad })
    .to(outer, { prop: "scale.y", from: 0.94, to: 1, start: 0.05, duration: 0.55, ease: outQuad })
    .to(inner, { prop: "x", from: cx, to: cx - hero * pitch, start: 0.3, duration: 1.35, ease: makeOutBack(1.1) });

  if (caption.length > 0) {
    const botSafe = ctx.aspect === "9:16" ? 400 : Math.round(minDim * 0.06);
    const capSize = Math.round(minDim * 0.036);
    const capY = Math.min(h * 0.92, h - botSafe - capSize * 0.8);
    const capText = fitText(
      fonts,
      { text: caption, role: "body", weight: 600, size: capSize, color: textColor, anchor: 0.5, align: "center" },
      w * 0.82,
    );
    capText.position.set(cx, capY);
    capText.alpha = 0;
    root.addChild(capText);
    timeline
      .to(capText, { prop: "alpha", from: 0, to: 1, start: 1.55, duration: 0.5, ease: outQuad })
      .to(capText, { prop: "y", from: capY + 14, to: capY, start: 1.55, duration: 0.55, ease: outQuint });
  }

  return { timeline, duration: 3.2 };
}

export const filmStrip: TemplateDefinition = {
  id: "film-strip",
  name: "Film Strip",
  tagline: "A cinematic reel of photos slides to a stop.",
  category: "photo",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 2.5,
  fontRoles: { caption: "body" },
  palettes: PALETTES,
  fields: [
    { key: "image1", type: "image", label: "Frame 1", default: "", optional: true },
    { key: "image2", type: "image", label: "Frame 2", default: "", optional: true },
    { key: "image3", type: "image", label: "Frame 3", default: "", optional: true },
    { key: "image4", type: "image", label: "Frame 4", default: "", optional: true },
    { key: "caption", type: "text", label: "Caption", default: "Behind the scenes", maxLength: 40, optional: true, shrinkToFit: true },
    { key: "showSprockets", type: "toggle", label: "Sprocket holes", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
