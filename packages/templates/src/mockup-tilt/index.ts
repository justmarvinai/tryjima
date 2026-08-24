import { Container, Graphics, Sprite } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outQuint,
  spring,
  type Aspect,
  type BuiltTemplate,
  type FontRegistry,
  type MakeTextOptions,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { makePill } from "../shared/ui";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;

const SCREEN_BG = "#FFFFFF";
const UI_BLOCK = "#E7EAEF";
const UI_CARD = "#F1F3F6";
const CHROME_DOT = "#CDD2DA";
const CHROME_BAR = "#EFF1F4";

const PALETTES: Palette[] = [
  { id: "ember", name: "Ember", colors: { background: "#FFF3EE", accent: "#FF4D1C", textColor: "#101014", muted: "#5B5B68" } },
  { id: "grape", name: "Grape", colors: { background: "#F3EEFF", accent: "#7C5CFF", textColor: "#241452", muted: "#6B6088" } },
  { id: "sky", name: "Sky", colors: { background: "#EAF2FB", accent: "#2E5BD6", textColor: "#0F1B2A", muted: "#52607A" } },
  { id: "lime-ink", name: "Lime ink", colors: { background: "#101014", accent: "#84CC16", textColor: "#FFFFFF", muted: "#A7ADB8" } },
];

interface MCfg {
  beside: boolean;
  frameMainF: number;
  centerXF: number;
  centerYF: number;
  titleF: number;
}

const MCFG: Record<Aspect, MCfg> = {
  "1:1": { beside: false, frameMainF: 0.66, centerXF: 0.5, centerYF: 0.4, titleF: 0.056 },
  "4:5": { beside: false, frameMainF: 0.7, centerXF: 0.5, centerYF: 0.37, titleF: 0.056 },
  "9:16": { beside: false, frameMainF: 0.82, centerXF: 0.5, centerYF: 0.4, titleF: 0.06 },
  "16:9": { beside: true, frameMainF: 0.62, centerXF: 0.36, centerYF: 0.48, titleF: 0.05 },
};

interface ScreenRect {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  sr: number;
}

/** Draw a clean rounded window frame centered at origin; return its screen rect. */
function drawFrame(parent: Container, fw: number, fh: number, accent: string): ScreenRect {
  const bodyR = Math.min(fw, fh) * 0.06;
  const barH = fh * 0.12;
  const pad = fw * 0.014;
  parent.addChild(
    new Graphics().roundRect(-fw / 2, -fh / 2, fw, fh, bodyR).fill(SCREEN_BG).stroke({ color: 0x000000, width: Math.max(1, fw * 0.003), alpha: 0.08 }),
  );
  // Traffic-light dots.
  const dotR = fh * 0.022;
  const dotY = -fh / 2 + barH * 0.5;
  const dotX0 = -fw / 2 + pad + fw * 0.035;
  const gap = dotR * 2.8;
  parent.addChild(new Graphics().circle(dotX0, dotY, dotR).fill(accent));
  parent.addChild(new Graphics().circle(dotX0 + gap, dotY, dotR).fill(CHROME_DOT));
  parent.addChild(new Graphics().circle(dotX0 + gap * 2, dotY, dotR).fill(CHROME_DOT));
  // Address pill.
  const pill = makePill(fw * 0.44, barH * 0.44, CHROME_BAR);
  pill.position.set(dotX0 + gap * 2 + fw * 0.26, dotY);
  parent.addChild(pill);
  // Divider.
  parent.addChild(new Graphics().rect(-fw / 2 + pad, -fh / 2 + barH, fw - 2 * pad, Math.max(1, fh * 0.003)).fill({ color: 0x000000, alpha: 0.07 }));
  const sx = -fw / 2 + pad;
  const sy = -fh / 2 + barH;
  const sw = fw - 2 * pad;
  const sh = fh - barH - pad;
  const sr = Math.min(fw, fh) * 0.025;
  parent.addChild(new Graphics().roundRect(sx, sy, sw, sh, sr).fill(SCREEN_BG));
  return { sx, sy, sw, sh, sr };
}

function placeholderUI(rect: ScreenRect, accent: string): Container {
  const { sx, sy, sw, sh } = rect;
  const c = new Container();
  const headerH = sh * 0.2;
  c.addChild(new Graphics().rect(sx, sy, sw, headerH).fill(accent));
  c.addChild(new Graphics().circle(sx + sw * 0.12, sy + headerH * 0.5, headerH * 0.26).fill({ color: 0xffffff, alpha: 0.95 }));
  c.addChild(new Graphics().roundRect(sx + sw * 0.24, sy + headerH * 0.4, sw * 0.4, headerH * 0.2, headerH * 0.1).fill({ color: 0xffffff, alpha: 0.9 }));
  let y = sy + headerH + sh * 0.1;
  const rowH = sh * 0.055;
  for (const wdt of [0.74, 0.88, 0.6]) {
    c.addChild(new Graphics().roundRect(sx + sw * 0.09, y, sw * wdt, rowH, rowH * 0.5).fill(UI_BLOCK));
    y += sh * 0.11;
  }
  c.addChild(new Graphics().roundRect(sx + sw * 0.09, y + sh * 0.02, sw * 0.82, sh * 0.22, sh * 0.03).fill(UI_CARD));
  c.addChild(new Graphics().roundRect(sx + sw * 0.09, y + sh * 0.3, sw * 0.4, sh * 0.07, sh * 0.035).fill(accent));
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
  const bg = str(values.background, pc("background", "#FFF3EE"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const muted = pc("muted", "#5B5B68");
  const title = str(values.title, "Your site, in motion");
  const caption = str(values.caption, "See it live");

  root.addChild(new Graphics().rect(0, 0, size.width, size.height).fill(bg));

  const w = size.width;
  const h = size.height;
  const cfg = MCFG[ctx.aspect];
  const timeline = new JimaTimeline();

  const fw = cfg.beside ? h * cfg.frameMainF * 1.5 : w * cfg.frameMainF;
  const fh = cfg.beside ? h * cfg.frameMainF : w * cfg.frameMainF * 0.64;
  const fx = w * cfg.centerXF;
  const cy = h * cfg.centerYF;

  // Ground-anchored soft shadow (reacts to the float; never moves).
  const groundY = cy + fh * 0.46;
  const shadow = new Graphics().ellipse(0, 0, fw * 0.44, fh * 0.06).fill({ color: 0x000000, alpha: 0.18 });
  shadow.position.set(fx, groundY);
  shadow.alpha = 0;
  root.addChild(shadow);
  timeline.to(shadow, { prop: "alpha", from: 0, to: 1, start: 0.6, duration: 0.5, ease: outQuad });

  // floatWrap (drift) → tilt (perspective skew) → riser (entrance) → frame.
  const floatWrap = new Container();
  floatWrap.position.set(fx, cy);
  const tilt = new Container();
  const riser = new Container();
  riser.alpha = 0;
  riser.scale.set(0.92);
  floatWrap.addChild(tilt);
  tilt.addChild(riser);
  root.addChild(floatWrap);

  const rect = drawFrame(riser, fw, fh, accent);

  // Screen content (screenshot cover-fit or placeholder UI), clipped to screen.
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
    .to(riser, { prop: "y", from: 44, to: 0, start: 0.2, duration: 0.8, ease: outQuint })
    .to(riser, { prop: "scale.x", from: 0.92, to: 1, start: 0.2, duration: 0.8, ease: spring(0.55) })
    .to(riser, { prop: "scale.y", from: 0.92, to: 1, start: 0.2, duration: 0.8, ease: spring(0.55) });

  // Title + caption (upright, outside the tilt): beside on 16:9, else below.
  const titleSize = Math.round(w * cfg.titleF);
  const capSize = Math.round(titleSize * 0.5);
  if (cfg.beside) {
    const textX = w * 0.63;
    const maxW = w - textX - w * 0.06;
    const titleText = fitText(
      fonts,
      { text: title, role: "display", weight: 700, size: titleSize, color: textColor, anchor: { x: 0, y: 1 } },
      maxW,
    );
    const titleY = caption.length > 0 ? cy - capSize * 0.3 : cy + titleSize * 0.3;
    titleText.position.set(textX, titleY);
    titleText.alpha = 0;
    root.addChild(titleText);
    timeline
      .to(titleText, { prop: "alpha", from: 0, to: 1, start: 1.0, duration: 0.5, ease: outQuad })
      .to(titleText, { prop: "x", from: textX - 16, to: textX, start: 1.0, duration: 0.6, ease: outQuint });
    if (caption.length > 0) {
      const capText = fitText(
        fonts,
        { text: caption, role: "body", weight: 500, size: capSize, color: muted, anchor: { x: 0, y: 0 } },
        maxW,
      );
      capText.position.set(textX, titleY + capSize * 0.7);
      capText.alpha = 0;
      root.addChild(capText);
      timeline
        .to(capText, { prop: "alpha", from: 0, to: 1, start: 1.25, duration: 0.5, ease: outQuad })
        .to(capText, { prop: "x", from: textX - 12, to: textX, start: 1.25, duration: 0.6, ease: outQuint });
    }
  } else {
    const botSafe = ctx.aspect === "9:16" ? 400 : Math.round(Math.min(w, h) * 0.06);
    const titleY = Math.min(groundY + fh * 0.14 + titleSize, h - botSafe - capSize * 1.6);
    const titleText = fitText(
      fonts,
      { text: title, role: "display", weight: 700, size: titleSize, color: textColor, anchor: 0.5, align: "center" },
      w * 0.84,
    );
    titleText.position.set(w / 2, titleY);
    titleText.alpha = 0;
    root.addChild(titleText);
    timeline
      .to(titleText, { prop: "alpha", from: 0, to: 1, start: 1.0, duration: 0.5, ease: outQuad })
      .to(titleText, { prop: "y", from: titleY + 16, to: titleY, start: 1.0, duration: 0.6, ease: outQuint });
    if (caption.length > 0) {
      const capY = titleY + titleSize * 0.9;
      const capText = fitText(
        fonts,
        { text: caption, role: "body", weight: 500, size: capSize, color: muted, anchor: 0.5, align: "center" },
        w * 0.8,
      );
      capText.position.set(w / 2, capY);
      capText.alpha = 0;
      root.addChild(capText);
      timeline
        .to(capText, { prop: "alpha", from: 0, to: 1, start: 1.25, duration: 0.5, ease: outQuad })
        .to(capText, { prop: "y", from: capY + 12, to: capY, start: 1.25, duration: 0.6, ease: outQuint });
    }
  }

  // Constant perspective tilt + gentle drift (pure in t). floatWrap owns y +
  // rotation; tilt owns skew; the timeline owns only the inner riser + shadow
  // alpha — no property is written twice. shadow.scale reacts to the bob.
  const baseSkewX = 0.09;
  const baseSkewY = -0.045;
  const baseRot = -0.02;
  const FLOAT_AT = 1.0;
  const PERIOD = 3.4;
  const amp = h * 0.012;
  const update = (t: number): void => {
    const tau = t - FLOAT_AT;
    const env = tau <= 0 ? 0 : Math.min(1, tau / 1.1);
    const phase = tau <= 0 ? 0 : (tau / PERIOD) * Math.PI * 2;
    const bob = Math.sin(phase) * amp * env;
    floatWrap.y = cy + bob;
    floatWrap.rotation = baseRot + Math.sin((tau / (PERIOD * 1.35)) * Math.PI * 2) * 0.008 * env;
    tilt.skew.x = baseSkewX + Math.sin(phase) * 0.012 * env;
    tilt.skew.y = baseSkewY + Math.cos(phase) * 0.006 * env;
    const lift = env === 0 ? 0 : (-bob / amp) * env;
    const s = 1 - 0.1 * lift;
    shadow.scale.set(s, s);
  };

  return { timeline, duration: 4.0, update };
}

export const mockupTilt: TemplateDefinition = {
  id: "mockup-tilt",
  name: "Mockup Tilt",
  tagline: "A screenshot floats at a slight 3D tilt.",
  category: "showcase",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 2.6,
  palettes: PALETTES,
  fields: [
    { key: "screenshot", type: "image", label: "Screenshot", default: "", optional: true, help: "A screenshot of your app or site; fills the screen." },
    { key: "title", type: "text", label: "Title", default: "Your site, in motion", maxLength: 40, shrinkToFit: true },
    { key: "caption", type: "text", label: "Caption", default: "See it live", maxLength: 40, optional: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
