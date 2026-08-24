import { Container, Graphics, Sprite } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  shrinkToFit,
  outQuad,
  outQuint,
  inOutQuad,
  makeOutBack,
  type Aspect,
  type BuiltTemplate,
  type FontRegistry,
  type MakeTextOptions,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;

const CARD = "#FFFFFF";
const CHROME_BAR = "#EFF1F4";
const UI_BLOCK = "#E7EAEF";
const URL_INK = "#3A3D44";
const SCROLL_FRAC = 0.14;

const PALETTES: Palette[] = [
  { id: "ember", name: "Ember", colors: { background: "#FFF4EE", accent: "#FF4D1C", textColor: "#101014", muted: "#C9A99A" } },
  { id: "grape", name: "Grape", colors: { background: "#F3EEFF", accent: "#7C5CFF", textColor: "#241452", muted: "#B7ACD6" } },
  { id: "sky", name: "Sky", colors: { background: "#EAF2FB", accent: "#2E5BD6", textColor: "#0F1B2A", muted: "#A6B9D6" } },
  { id: "mint", name: "Mint", colors: { background: "#E9F7EF", accent: "#12B76A", textColor: "#06301F", muted: "#9AC7AE" } },
];

interface BCfg {
  winWF: number;
  winHF: number;
  cyF: number;
}

const BCFG: Record<Aspect, BCfg> = {
  "16:9": { winWF: 0.78, winHF: 0.66, cyF: 0.47 },
  "1:1": { winWF: 0.82, winHF: 0.62, cyF: 0.46 },
  "4:5": { winWF: 0.82, winHF: 0.56, cyF: 0.44 },
  "9:16": { winWF: 0.84, winHF: 0.44, cyF: 0.4 },
};

/** A small "picture" glyph for the placeholder hero block. */
function imageGlyph(s: number, color: string): Graphics {
  const g = new Graphics();
  g.roundRect(-0.5 * s, -0.42 * s, s, 0.84 * s, 0.12 * s).stroke({ color, width: Math.max(2, 0.055 * s) });
  g.circle(-0.18 * s, -0.14 * s, 0.1 * s).fill(color);
  g.poly([-0.44 * s, 0.34 * s, -0.12 * s, -0.04 * s, 0.06 * s, 0.14 * s, 0.28 * s, -0.12 * s, 0.46 * s, 0.34 * s]).fill(color);
  return g;
}

/** A placeholder "web page": hero block, headline bar, paragraph lines, CTA. */
function placeholderPage(sx: number, sy: number, sw: number, sh: number, accent: string, muted: string): Container {
  const c = new Container();
  const heroH = sh * 0.38;
  c.addChild(new Graphics().roundRect(sx, sy, sw, heroH, sw * 0.015).fill({ color: accent, alpha: 0.14 }));
  const glyph = imageGlyph(Math.min(sw, heroH) * 0.24, muted);
  glyph.position.set(sx + sw / 2, sy + heroH / 2);
  c.addChild(glyph);
  let y = sy + heroH + sh * 0.09;
  c.addChild(new Graphics().roundRect(sx, y, sw * 0.55, sh * 0.055, sh * 0.02).fill(UI_BLOCK));
  y += sh * 0.095;
  for (const wdt of [0.82, 0.62]) {
    c.addChild(new Graphics().roundRect(sx, y, sw * wdt, sh * 0.035, sh * 0.017).fill(UI_BLOCK));
    y += sh * 0.06;
  }
  y += sh * 0.025;
  c.addChild(new Graphics().roundRect(sx, y, sw * 0.28, sh * 0.06, sh * 0.03).fill(accent));
  return c;
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

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, images } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFF4EE"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const muted = pc("muted", "#C9A99A");
  const url = str(values.url, "www.yoursite.com");
  const caption = str(values.caption, "No install. No sign-up. Just your browser.");
  const showDots = values.showDots !== false;

  const w = size.width;
  const h = size.height;

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const cfg = BCFG[ctx.aspect];
  const cx = w / 2;
  const cy = h * cfg.cyF;
  const winW = w * cfg.winWF;
  const winH = h * cfg.winHF;
  const bodyR = Math.min(winW, winH) * 0.035;
  const barH = winH * 0.115;
  const pad = winW * 0.014;

  const timeline = new JimaTimeline();

  const windowGroup = new Container();
  windowGroup.position.set(cx, cy);
  windowGroup.alpha = 0;
  windowGroup.scale.set(0.9);
  root.addChild(windowGroup);
  timeline
    .to(windowGroup, { prop: "alpha", from: 0, to: 1, start: 0, duration: 0.45, ease: outQuad })
    .to(windowGroup, { prop: "scale.x", from: 0.9, to: 1, start: 0, duration: 0.55, ease: makeOutBack(1.4) })
    .to(windowGroup, { prop: "scale.y", from: 0.9, to: 1, start: 0, duration: 0.55, ease: makeOutBack(1.4) });

  windowGroup.addChild(new Graphics().roundRect(-winW / 2, -winH / 2 + winH * 0.025, winW, winH, bodyR).fill({ color: 0x000000, alpha: 0.18 }));
  windowGroup.addChild(
    new Graphics().roundRect(-winW / 2, -winH / 2, winW, winH, bodyR).fill(CARD).stroke({ color: 0x000000, alpha: 0.08, width: Math.max(1, winW * 0.0025) }),
  );

  // Traffic-light dots (toggle) + address pill.
  const dotR = barH * 0.15;
  const gap = dotR * 2.7;
  const dotX0 = -winW / 2 + pad + winW * 0.028;
  const dotY = -winH / 2 + barH * 0.52;
  if (showDots) {
    windowGroup.addChild(new Graphics().circle(dotX0, dotY, dotR).fill("#FF5F56"));
    windowGroup.addChild(new Graphics().circle(dotX0 + gap, dotY, dotR).fill("#FFBD2E"));
    windowGroup.addChild(new Graphics().circle(dotX0 + gap * 2, dotY, dotR).fill("#27C93F"));
  }
  const pillX0 = dotX0 + gap * 2 + winW * 0.045;
  const pillW = winW * 0.56;
  const pillH = barH * 0.5;
  windowGroup.addChild(new Graphics().roundRect(pillX0, dotY - pillH / 2, pillW, pillH, pillH / 2).fill(CHROME_BAR));

  const urlBaseSize = Math.round(barH * 0.32);
  const urlTextMaxW = pillW - pillH * 0.95;
  const measureUrl = (s: string, sz: number): number => fonts.measure(s, { family: fonts.family("mono"), weight: 500, size: sz });
  const urlSize = shrinkToFit(url, measureUrl, { maxWidth: urlTextMaxW, baseSize: urlBaseSize, minSize: Math.round(urlBaseSize * 0.55) });
  const urlNode = makeText(fonts, { text: "", role: "mono", weight: 500, size: urlSize, color: URL_INK, anchor: { x: 0, y: 0.5 } });
  urlNode.position.set(pillX0 + pillH * 0.55, dotY);
  windowGroup.addChild(urlNode);

  windowGroup.addChild(
    new Graphics().rect(-winW / 2 + pad, -winH / 2 + barH, winW - 2 * pad, Math.max(1, winH * 0.0025)).fill({ color: 0x000000, alpha: 0.08 }),
  );

  // Content area: masked wrapper (reveal) → inner (scroll), sized taller than
  // the visible rect so the scroll never exposes an empty gap.
  const csx = -winW / 2 + pad;
  const csy = -winH / 2 + barH;
  const csw = winW - 2 * pad;
  const csh = winH - barH - pad;
  const cshVirtual = csh * (1 + SCROLL_FRAC);

  const contentWrap = new Container();
  contentWrap.alpha = 0;
  contentWrap.scale.set(0.97);
  windowGroup.addChild(contentWrap);

  const contentInner = new Container();
  const contentMask = new Graphics().roundRect(csx, csy, csw, csh, Math.min(winW, winH) * 0.018).fill(0xffffff);
  contentWrap.addChild(contentInner, contentMask);
  contentInner.mask = contentMask;

  const tex = images.page ?? null;
  if (tex) {
    const sprite = new Sprite(tex);
    sprite.anchor.set(0.5, 0);
    const cover = Math.max(csw / tex.width, cshVirtual / tex.height);
    sprite.scale.set(cover);
    sprite.position.set(csx + csw / 2, csy);
    contentInner.addChild(sprite);
  } else {
    contentInner.addChild(placeholderPage(csx, csy, csw, cshVirtual, accent, muted));
  }

  const TYPE_START = 0.65;
  const TYPE_BUDGET = 1.2;
  const REVEAL_START = TYPE_START + TYPE_BUDGET + 0.25;
  const SCROLL_START = REVEAL_START + 0.7;

  timeline
    .to(contentWrap, { prop: "alpha", from: 0, to: 1, start: REVEAL_START, duration: 0.5, ease: outQuad })
    .to(contentWrap, { prop: "scale.x", from: 0.97, to: 1, start: REVEAL_START, duration: 0.5, ease: outQuad })
    .to(contentWrap, { prop: "scale.y", from: 0.97, to: 1, start: REVEAL_START, duration: 0.5, ease: outQuad })
    .to(contentInner, { prop: "y", from: 0, to: -csh * SCROLL_FRAC, start: SCROLL_START, duration: 1.4, ease: inOutQuad });

  const speed = TYPE_BUDGET / Math.max(1, url.length);
  const update = (t: number): void => {
    const elapsed = t - TYPE_START;
    const shown = elapsed <= 0 ? 0 : Math.min(url.length, Math.floor(elapsed / speed));
    const typing = t >= TYPE_START && shown < url.length;
    const blinkOn = typing && t % 0.9 < 0.5;
    urlNode.text = url.slice(0, shown) + (blinkOn ? "|" : "");
  };

  // Caption below the window, clamped clear of each aspect's safe zone.
  if (caption.length > 0) {
    const botSafe = ctx.aspect === "9:16" ? 400 : Math.round(Math.min(w, h) * 0.06);
    const capSize = Math.round(w * (ctx.aspect === "16:9" ? 0.028 : 0.036));
    const capY = Math.min(h * 0.9, h - botSafe - capSize * 0.7);
    const capText = fitText(
      fonts,
      { text: caption, role: "body", weight: 500, size: capSize, color: textColor, anchor: 0.5, align: "center" },
      w * 0.82,
    );
    capText.position.set(cx, capY);
    capText.alpha = 0;
    root.addChild(capText);
    timeline
      .to(capText, { prop: "alpha", from: 0, to: 0.9, start: REVEAL_START + 0.2, duration: 0.5, ease: outQuad })
      .to(capText, { prop: "y", from: capY + 14, to: capY, start: REVEAL_START + 0.2, duration: 0.55, ease: outQuint });
  }

  return { timeline, duration: 4.7, update };
}

export const browserWindow: TemplateDefinition = {
  id: "browser-window",
  name: "Browser Window",
  tagline: "A browser window types in a URL and reveals the page.",
  category: "tech",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 3.6,
  fontRoles: { url: "mono", caption: "body" },
  palettes: PALETTES,
  fields: [
    { key: "url", type: "text", label: "URL", default: "www.yoursite.com", maxLength: 32 },
    { key: "page", type: "image", label: "Page image", default: "", optional: true, help: "Fills the content area; shows a hero + lines mock when empty." },
    { key: "caption", type: "text", label: "Caption", default: "No install. No sign-up. Just your browser.", maxLength: 54, optional: true, shrinkToFit: true },
    { key: "showDots", type: "toggle", label: "Traffic-light dots", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
