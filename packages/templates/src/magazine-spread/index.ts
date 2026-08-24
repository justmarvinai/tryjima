import { Container, Graphics, FillGradient } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  makeOutBack,
  safeRect,
  type BuiltTemplate,
  type FontRegistry,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;

function fitSize(fonts: FontRegistry, text: string, role: "display" | "serif", weight: number, size: number, maxWidth: number): number {
  if (text.length === 0 || maxWidth <= 0) return size;
  const w = fonts.measure(text, { family: fonts.family(role), weight, size });
  return w > maxWidth ? Math.max(9, Math.floor((size * maxWidth) / w)) : size;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
interface Colors {
  paper: string;
  ink: string;
  accent: string;
  img1: string;
  img2: string;
  muted: string;
}

// A magazine spread opens like a book: a full-bleed image page and a text page
// (kicker, headline, drop-cap, columns) swing out from the central spine.
const PALETTES: Palette[] = [
  { id: "editorial", name: "Editorial", colors: { background: "#EDE9E3", paper: "#FBF8F3", ink: "#1A1714", accent: "#C4432B", img1: "#C4432B", img2: "#E8846B", muted: "#DAD2C6" } },
  { id: "noir", name: "Noir", colors: { background: "#14140F", paper: "#F5F2EA", ink: "#14140F", accent: "#9A6B00", img1: "#2A2A24", img2: "#4A4A3E", muted: "#DBD4C5" } },
  { id: "azure", name: "Azure", colors: { background: "#E6EEF5", paper: "#FFFFFF", ink: "#10233F", accent: "#2E5BD6", img1: "#2E5BD6", img2: "#7CC0FF", muted: "#DCE4EE" } },
  { id: "rose", name: "Rose", colors: { background: "#F6EAF0", paper: "#FFFDFB", ink: "#2A1220", accent: "#C42E6A", img1: "#D6407E", img2: "#FF9EC4", muted: "#EAD8E0" } },
];

function drawImagePage(c: Container, rect: Rect, cols: Colors, kicker: string, fonts: FontRegistry): void {
  const grad = new FillGradient({
    type: "linear",
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
    colorStops: [
      { offset: 0, color: cols.img1 },
      { offset: 1, color: cols.img2 },
    ],
    textureSpace: "local",
  });
  c.addChild(new Graphics().rect(rect.x, rect.y, rect.w, rect.h).fill(grad));
  const clip = new Graphics().rect(rect.x, rect.y, rect.w, rect.h).fill(0xffffff);
  const shapes = new Container();
  shapes.addChild(new Graphics().circle(rect.x + rect.w * 0.7, rect.y + rect.h * 0.28, rect.w * 0.4).fill({ color: "#FFFFFF", alpha: 0.16 }));
  shapes.addChild(new Graphics().circle(rect.x + rect.w * 0.24, rect.y + rect.h * 0.74, rect.w * 0.3).fill({ color: "#000000", alpha: 0.14 }));
  c.addChild(shapes, clip);
  shapes.mask = clip;
  // Small issue tag, bottom-left.
  const tagH = Math.min(rect.w, rect.h) * 0.09;
  const tag = str(kicker, "FEATURE").toUpperCase();
  const tagSize = fitSize(fonts, tag, "display", 700, Math.round(tagH * 0.4), rect.w * 0.7);
  const tw = fonts.measure(tag, { family: fonts.family("display"), weight: 700, size: tagSize });
  const pad = Math.min(rect.w, rect.h) * 0.08;
  c.addChild(new Graphics().roundRect(rect.x + pad, rect.y + rect.h - pad - tagH, tw + tagH, tagH, tagH * 0.5).fill({ color: "#000000", alpha: 0.32 }));
  const tagNode = makeText(fonts, { text: tag, role: "display", weight: 700, size: tagSize, color: "#FFFFFF", anchor: { x: 0, y: 0.5 }, letterSpacing: 2 });
  tagNode.position.set(rect.x + pad + tagH * 0.5, rect.y + rect.h - pad - tagH / 2);
  c.addChild(tagNode);
}

function drawTextPage(c: Container, rect: Rect, cols: Colors, kicker: string, headline: string, showDropCap: boolean, fonts: FontRegistry): void {
  c.addChild(new Graphics().rect(rect.x, rect.y, rect.w, rect.h).fill(cols.paper));
  const pad = Math.min(rect.w, rect.h) * 0.1;
  const ix = rect.x + pad;
  const iy = rect.y + pad;
  const iw = rect.w - pad * 2;
  const minD = Math.min(rect.w, rect.h);

  // Kicker.
  let cursorY = iy;
  if (kicker.length > 0) {
    const kSize = fitSize(fonts, kicker.toUpperCase(), "display", 700, Math.round(minD * 0.045), iw);
    const kNode = makeText(fonts, { text: kicker.toUpperCase(), role: "display", weight: 700, size: kSize, color: cols.accent, anchor: { x: 0, y: 0 }, letterSpacing: 3 });
    kNode.position.set(ix, cursorY);
    c.addChild(kNode);
    cursorY += kSize * 1.9;
  }

  // Headline (serif).
  const hSize = fitSize(fonts, headline, "serif", 600, Math.round(minD * 0.11), iw);
  const hNode = makeText(fonts, { text: headline, role: "serif", weight: 600, size: hSize, color: cols.ink, anchor: { x: 0, y: 0 } });
  hNode.position.set(ix, cursorY);
  c.addChild(hNode);
  cursorY += hSize * 1.25;

  // Accent rule.
  c.addChild(new Graphics().rect(ix, cursorY, iw * 0.34, Math.max(2, minD * 0.008)).fill(cols.accent));
  cursorY += minD * 0.05;

  // Body: drop-cap + two columns of skeleton lines.
  const bodyTop = cursorY;
  const bodyBot = rect.y + rect.h - pad;
  const bodyH = bodyBot - bodyTop;
  if (bodyH > minD * 0.1) {
    const colGap = iw * 0.07;
    const colW = (iw - colGap) / 2;
    const lineH = Math.max(minD * 0.03, bodyH * 0.09);
    const barH = lineH * 0.4;
    const perCol = Math.max(2, Math.floor(bodyH / lineH));

    let dropW = 0;
    if (showDropCap) {
      const dcLetter = (headline.replace(/\s/g, "")[0] ?? "A").toUpperCase();
      const dcSize = lineH * 2.6;
      const dc = makeText(fonts, { text: dcLetter, role: "serif", weight: 600, size: dcSize, color: cols.accent, anchor: { x: 0, y: 0 } });
      dc.position.set(ix, bodyTop - dcSize * 0.06);
      c.addChild(dc);
      dropW = dc.width + iw * 0.02;
    }

    const drawCol = (colX: number, indentFirst: number) => {
      for (let i = 0; i < perCol; i++) {
        const ly = bodyTop + i * lineH + (lineH - barH) / 2;
        const indent = i < 2 ? indentFirst : 0;
        const last = i === perCol - 1;
        const bw = (colW - indent) * (last ? 0.55 : 1);
        c.addChild(new Graphics().roundRect(colX + indent, ly, bw, barH, barH * 0.4).fill({ color: cols.muted, alpha: 0.9 }));
      }
    };
    drawCol(ix, dropW);
    drawCol(ix + colW + colGap, 0);
  }
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pcol = palette.colors;
  const pc = (k: string, d: string): string => pcol[k] ?? d;
  const bg = str(values.background, pc("background", "#EDE9E3"));
  const cols: Colors = {
    paper: pc("paper", "#FBF8F3"),
    ink: str(values.textColor, pc("ink", "#1A1714")),
    accent: str(values.accent, pc("accent", "#C4432B")),
    img1: pc("img1", "#C4432B"),
    img2: pc("img2", "#E8846B"),
    muted: pc("muted", "#DAD2C6"),
  };

  const headline = str(values.headline, "The quiet craft of motion");
  const kicker = str(values.kicker, "Feature");
  const showDropCap = values.showDropCap !== false;

  const w = size.width;
  const h = size.height;

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();
  const zone = safeRect(ctx.aspect);
  const cx = zone.x + zone.width / 2;
  const cy = zone.y + zone.height / 2;

  const stacked = ctx.aspect === "9:16" || ctx.aspect === "4:5";

  let pageW: number;
  let pageH: number;
  if (!stacked) {
    let spreadH = Math.min(zone.height * 0.92, (zone.width * 0.96) / 1.5);
    let spreadW = spreadH * 1.5;
    if (spreadW > zone.width * 0.96) {
      spreadW = zone.width * 0.96;
      spreadH = spreadW / 1.5;
    }
    pageW = spreadW / 2;
    pageH = spreadH;
  } else {
    const spreadW = zone.width * 0.94;
    const spreadH = Math.min(zone.height * 0.94, spreadW * 1.28);
    pageW = spreadW;
    pageH = spreadH / 2;
  }

  const book = new Container();
  book.position.set(cx, cy);
  book.alpha = 0;
  book.scale.set(0.97);
  root.addChild(book);
  timeline
    .to(book, { prop: "alpha", from: 0, to: 1, start: 0, duration: 0.4, ease: outQuad })
    .to(book, { prop: "scale.x", from: 0.97, to: 1, start: 0, duration: 0.6, ease: outExpo })
    .to(book, { prop: "scale.y", from: 0.97, to: 1, start: 0, duration: 0.6, ease: outExpo });

  // Shadow under the whole spread.
  if (!stacked) {
    book.addChild(new Graphics().roundRect(-pageW, -pageH / 2 + pageH * 0.02, pageW * 2, pageH, pageW * 0.02).fill({ color: "#000000", alpha: 0.2 }));
  } else {
    book.addChild(new Graphics().roundRect(-pageW / 2, -pageH + pageH * 0.02, pageW, pageH * 2, pageW * 0.02).fill({ color: "#000000", alpha: 0.2 }));
  }

  // Image page (left / top) and text page (right / bottom).
  const imgPage = new Container();
  const txtPage = new Container();
  imgPage.position.set(0, 0);
  txtPage.position.set(0, 0);
  book.addChild(imgPage, txtPage);

  if (!stacked) {
    drawImagePage(imgPage, { x: -pageW, y: -pageH / 2, w: pageW, h: pageH }, cols, kicker, fonts);
    drawTextPage(txtPage, { x: 0, y: -pageH / 2, w: pageW, h: pageH }, cols, kicker, headline, showDropCap, fonts);
    imgPage.scale.x = 0;
    txtPage.scale.x = 0;
    timeline
      .to(imgPage, { prop: "scale.x", from: 0, to: 1, start: 0.3, duration: 0.75, ease: makeOutBack(1.1) })
      .to(txtPage, { prop: "scale.x", from: 0, to: 1, start: 0.5, duration: 0.75, ease: makeOutBack(1.1) });
  } else {
    drawImagePage(imgPage, { x: -pageW / 2, y: -pageH, w: pageW, h: pageH }, cols, kicker, fonts);
    drawTextPage(txtPage, { x: -pageW / 2, y: 0, w: pageW, h: pageH }, cols, kicker, headline, showDropCap, fonts);
    imgPage.scale.y = 0;
    txtPage.scale.y = 0;
    timeline
      .to(imgPage, { prop: "scale.y", from: 0, to: 1, start: 0.3, duration: 0.75, ease: makeOutBack(1.1) })
      .to(txtPage, { prop: "scale.y", from: 0, to: 1, start: 0.5, duration: 0.75, ease: makeOutBack(1.1) });
  }

  // Spine crease (fades in once open).
  const crease = new Graphics();
  if (!stacked) {
    const cw = pageW * 0.1;
    const cGrad = new FillGradient({
      type: "linear",
      start: { x: 0, y: 0 },
      end: { x: 1, y: 0 },
      colorStops: [
        { offset: 0, color: "rgba(0,0,0,0)" },
        { offset: 0.5, color: "rgba(0,0,0,0.33)" },
        { offset: 1, color: "rgba(0,0,0,0)" },
      ],
      textureSpace: "local",
    });
    crease.rect(-cw / 2, -pageH / 2, cw, pageH).fill(cGrad);
  } else {
    const chh = pageH * 0.1;
    const cGrad = new FillGradient({
      type: "linear",
      start: { x: 0, y: 0 },
      end: { x: 0, y: 1 },
      colorStops: [
        { offset: 0, color: "rgba(0,0,0,0)" },
        { offset: 0.5, color: "rgba(0,0,0,0.33)" },
        { offset: 1, color: "rgba(0,0,0,0)" },
      ],
      textureSpace: "local",
    });
    crease.rect(-pageW / 2, -chh / 2, pageW, chh).fill(cGrad);
  }
  crease.alpha = 0;
  book.addChild(crease);
  timeline.to(crease, { prop: "alpha", from: 0, to: 1, start: 0.9, duration: 0.5, ease: outQuad });

  return { timeline, duration: 4.0 };
}

export const magazineSpread: TemplateDefinition = {
  id: "magazine-spread",
  name: "Magazine Spread",
  tagline: "A two-page magazine spread opens like a book from the spine.",
  category: "showcase",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 2.8,
  fontRoles: { headline: "serif", kicker: "display" },
  palettes: PALETTES,
  fields: [
    { key: "headline", type: "text", label: "Headline", default: "The quiet craft of motion", maxLength: 40, shrinkToFit: true },
    { key: "kicker", type: "text", label: "Kicker", default: "Feature", maxLength: 20, shrinkToFit: true },
    { key: "showDropCap", type: "toggle", label: "Drop cap", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
