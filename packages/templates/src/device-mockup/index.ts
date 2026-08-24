import { Container, Graphics, Sprite } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outQuint,
  spring,
  type Aspect,
  type BuiltTemplate,
  type MakeTextOptions,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { makePill } from "../shared/ui";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;

const BEZEL = "#16171C";
const SCREEN_BG = "#FFFFFF";
const UI_BLOCK = "#E7EAEF";
const UI_CARD = "#F1F3F6";
const CHROME_DOT = "#CDD2DA";
const CHROME_BAR = "#EFF1F4";

const PALETTES: Palette[] = [
  { id: "ember", name: "Ember", colors: { background: "#FFF4EE", accent: "#FF4D1C", textColor: "#101014" } },
  { id: "grape", name: "Grape", colors: { background: "#F3EEFF", accent: "#7C5CFF", textColor: "#241452" } },
  { id: "sky", name: "Sky", colors: { background: "#EAF2FB", accent: "#2E5BD6", textColor: "#0F1B2A" } },
  { id: "mint", name: "Mint", colors: { background: "#E9F7EF", accent: "#12B76A", textColor: "#06301F" } },
];

interface DCfg {
  type: "phone" | "browser";
  hf: number;
  centerYF: number;
  capYF: number;
  capF: number;
}

const DCFG: Record<Aspect, DCfg> = {
  "9:16": { type: "phone", hf: 0.55, centerYF: 0.45, capYF: 0.76, capF: 0.044 },
  "4:5": { type: "phone", hf: 0.62, centerYF: 0.46, capYF: 0.86, capF: 0.04 },
  "1:1": { type: "phone", hf: 0.68, centerYF: 0.45, capYF: 0.86, capF: 0.042 },
  "16:9": { type: "browser", hf: 0.66, centerYF: 0.45, capYF: 0.88, capF: 0.036 },
};

interface ScreenRect {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  sr: number;
}

function drawPhone(parent: Container, w: number, h: number): ScreenRect {
  const bodyR = w * 0.13;
  const bezel = w * 0.045;
  parent.addChild(new Graphics().roundRect(-w / 2, -h / 2 + h * 0.02, w, h, bodyR).fill({ color: 0x000000, alpha: 0.18 }));
  parent.addChild(new Graphics().roundRect(-w / 2, -h / 2, w, h, bodyR).fill(BEZEL));
  const sx = -w / 2 + bezel;
  const sy = -h / 2 + bezel;
  const sw = w - 2 * bezel;
  const sh = h - 2 * bezel;
  const sr = bodyR - bezel * 0.5;
  parent.addChild(new Graphics().roundRect(sx, sy, sw, sh, sr).fill(SCREEN_BG));
  // Speaker pill + camera dot on the top bezel.
  const speaker = makePill(w * 0.16, Math.max(3, w * 0.022), "#2A2C33");
  speaker.position.set(0, -h / 2 + bezel * 0.55);
  parent.addChild(speaker);
  parent.addChild(new Graphics().circle(w * 0.14, -h / 2 + bezel * 0.55, w * 0.012).fill("#2A2C33"));
  return { sx, sy, sw, sh, sr };
}

function drawBrowser(parent: Container, w: number, h: number, accent: string): ScreenRect {
  const bodyR = Math.min(w, h) * 0.045;
  const barH = h * 0.13;
  const pad = w * 0.012;
  parent.addChild(new Graphics().roundRect(-w / 2, -h / 2 + h * 0.02, w, h, bodyR).fill({ color: 0x000000, alpha: 0.16 }));
  parent.addChild(new Graphics().roundRect(-w / 2, -h / 2, w, h, bodyR).fill(SCREEN_BG).stroke({ color: 0x000000, width: Math.max(1, w * 0.004), alpha: 0.1 }));
  // Traffic-light dots.
  const dotR = h * 0.02;
  const dotY = -h / 2 + barH * 0.5;
  const dotX0 = -w / 2 + pad + w * 0.03;
  const gap = dotR * 2.8;
  parent.addChild(new Graphics().circle(dotX0, dotY, dotR).fill(accent));
  parent.addChild(new Graphics().circle(dotX0 + gap, dotY, dotR).fill(CHROME_DOT));
  parent.addChild(new Graphics().circle(dotX0 + gap * 2, dotY, dotR).fill(CHROME_DOT));
  // Address pill.
  const pill = makePill(w * 0.5, barH * 0.46, CHROME_BAR);
  pill.position.set(dotX0 + gap * 2 + w * 0.29, dotY);
  parent.addChild(pill);
  parent.addChild(new Graphics().roundRect(dotX0 + gap * 2 + w * 0.09, dotY - barH * 0.06, w * 0.16, barH * 0.12, barH * 0.06).fill({ color: 0x000000, alpha: 0.12 }));
  // Divider.
  parent.addChild(new Graphics().rect(-w / 2 + pad, -h / 2 + barH, w - 2 * pad, Math.max(1, h * 0.003)).fill({ color: 0x000000, alpha: 0.08 }));
  const sx = -w / 2 + pad;
  const sy = -h / 2 + barH;
  const sw = w - 2 * pad;
  const sh = h - barH - pad;
  const sr = Math.min(w, h) * 0.02;
  parent.addChild(new Graphics().roundRect(sx, sy, sw, sh, sr).fill(SCREEN_BG));
  return { sx, sy, sw, sh, sr };
}

function placeholderUI(rect: ScreenRect, accent: string): Container {
  const { sx, sy, sw, sh } = rect;
  const c = new Container();
  const headerH = sh * 0.18;
  c.addChild(new Graphics().rect(sx, sy, sw, headerH).fill(accent));
  c.addChild(new Graphics().circle(sx + sw * 0.13, sy + headerH * 0.5, headerH * 0.28).fill({ color: 0xffffff, alpha: 0.95 }));
  c.addChild(new Graphics().roundRect(sx + sw * 0.26, sy + headerH * 0.4, sw * 0.42, headerH * 0.2, headerH * 0.1).fill({ color: 0xffffff, alpha: 0.9 }));
  let y = sy + headerH + sh * 0.09;
  const rowH = sh * 0.05;
  for (const wdt of [0.72, 0.86, 0.6]) {
    c.addChild(new Graphics().roundRect(sx + sw * 0.1, y, sw * wdt, rowH, rowH * 0.5).fill(UI_BLOCK));
    y += sh * 0.1;
  }
  c.addChild(new Graphics().roundRect(sx + sw * 0.1, y + sh * 0.02, sw * 0.8, sh * 0.2, sh * 0.03).fill(UI_CARD));
  c.addChild(new Graphics().roundRect(sx + sw * 0.1, y + sh * 0.28, sw * 0.42, sh * 0.07, sh * 0.035).fill(accent));
  return c;
}

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
  const bg = str(values.background, pc("background", "#FFF4EE"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const caption = str(values.caption, "Try it free in your browser");

  root.addChild(new Graphics().rect(0, 0, size.width, size.height).fill(bg));

  const cfg = DCFG[ctx.aspect];
  const w = size.width;
  const h = size.height;
  const cx = w / 2;
  const cy = h * cfg.centerYF;
  const deviceH = h * cfg.hf;
  const deviceW = cfg.type === "phone" ? deviceH * 0.5 : deviceH * 1.6;

  const timeline = new JimaTimeline();

  // floatWrap (continuous float) → riser (entrance) → device visuals.
  const floatWrap = new Container();
  floatWrap.position.set(cx, cy);
  const riser = new Container();
  riser.alpha = 0;
  riser.scale.set(0.9);
  floatWrap.addChild(riser);
  root.addChild(floatWrap);

  const rect = cfg.type === "phone" ? drawPhone(riser, deviceW, deviceH) : drawBrowser(riser, deviceW, deviceH, accent);

  // Screen content (screenshot or placeholder UI), clipped to the screen rect.
  const tex = images.screenshot ?? null;
  let screenContent: Container;
  if (tex) {
    const holder = new Container();
    const sprite = new Sprite(tex);
    sprite.anchor.set(0.5);
    const cover = Math.max(rect.sw / tex.width, rect.sh / tex.height);
    sprite.scale.set(cover);
    sprite.position.set(rect.sx + rect.sw / 2, rect.sy + rect.sh / 2);
    holder.addChild(sprite);
    screenContent = holder;
  } else {
    screenContent = placeholderUI(rect, accent);
  }
  const mask = new Graphics().roundRect(rect.sx, rect.sy, rect.sw, rect.sh, rect.sr).fill(0xffffff);
  riser.addChild(screenContent, mask);
  screenContent.mask = mask;

  timeline
    .to(riser, { prop: "alpha", from: 0, to: 1, start: 0.2, duration: 0.4, ease: outQuad })
    .to(riser, { prop: "y", from: 40, to: 0, start: 0.2, duration: 0.8, ease: outQuint })
    .to(riser, { prop: "scale.x", from: 0.9, to: 1, start: 0.2, duration: 0.8, ease: spring(0.55) })
    .to(riser, { prop: "scale.y", from: 0.9, to: 1, start: 0.2, duration: 0.8, ease: spring(0.55) });

  // Optional caption below the device.
  if (caption.length > 0) {
    const capY = h * cfg.capYF;
    const capText = fitText(
      fonts,
      { text: caption, role: "body", weight: 600, size: Math.round(w * cfg.capF), color: textColor, anchor: 0.5, align: "center" },
      w * 0.82,
    );
    capText.position.set(cx, capY);
    capText.alpha = 0;
    root.addChild(capText);
    timeline
      .to(capText, { prop: "alpha", from: 0, to: 1, start: 1.1, duration: 0.5, ease: outQuad })
      .to(capText, { prop: "y", from: capY + 16, to: capY, start: 1.1, duration: 0.5, ease: outQuint });
  }

  // Continuous gentle float (pure in t). floatWrap owns y + rotation; the
  // timeline only drives the inner riser — no property is written twice.
  const FLOAT_AT = 1.0;
  const PERIOD = 3.0;
  const amp = h * 0.01;
  const update = (t: number): void => {
    const tau = t - FLOAT_AT;
    if (tau <= 0) {
      floatWrap.y = cy;
      floatWrap.rotation = 0;
      return;
    }
    const env = Math.min(1, tau / 1.0);
    floatWrap.y = cy + Math.sin((tau / PERIOD) * Math.PI * 2) * amp * env;
    floatWrap.rotation = Math.sin((tau / (PERIOD * 1.3)) * Math.PI * 2) * 0.006 * env;
  };

  return { timeline, duration: 4.0, update };
}

export const deviceMockup: TemplateDefinition = {
  id: "device-mockup",
  name: "Device Mockup",
  tagline: "Your app or site inside a floating device.",
  category: "showcase",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "9:16",
  loopable: false,
  posterTime: 2.8,
  palettes: PALETTES,
  fields: [
    { key: "screenshot", type: "image", label: "Screenshot", default: "", optional: true, help: "A screenshot of your app or site; fills the device screen." },
    { key: "caption", type: "text", label: "Caption", default: "Try it free in your browser", maxLength: 44, optional: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
