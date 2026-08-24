import { Container, Graphics, Sprite, FillGradient } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outQuint,
  makeOutBack,
  type Aspect,
  type BuiltTemplate,
  type MakeTextOptions,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;

// Neutral device-chrome tones (fixed regardless of palette, like sibling
// device/browser mockups — only accent/background/text follow the palette).
const BEZEL = "#17181D";
const DECK = "#E7E9ED";
const DECK_EDGE = "#C9CCD3";
const SCREEN_OFF = "#0B0C10";
const CHROME_DARK = "#3A3C44";
const UI_BLOCK = "#E7EAEF";
const UI_CARD = "#F1F3F6";

const PALETTES: Palette[] = [
  { id: "ember", name: "Ember", colors: { background: "#FFF4EE", accent: "#FF4D1C", textColor: "#101014", muted: "#8A8F98" } },
  { id: "grape", name: "Grape", colors: { background: "#F3EEFF", accent: "#7C5CFF", textColor: "#241452", muted: "#9891B0" } },
  { id: "sky", name: "Sky", colors: { background: "#EAF2FB", accent: "#2E5BD6", textColor: "#0F1B2A", muted: "#8895A8" } },
  { id: "mint", name: "Mint", colors: { background: "#E9F7EF", accent: "#12B76A", textColor: "#06301F", muted: "#7FA891" } },
];

interface LCfg {
  /** Lid (screen) width as a fraction of canvas width. */
  lidWF: number;
  /** Hinge line (lid/base seam) as a fraction of canvas height. */
  hingeYF: number;
  capF: number;
  capYF: number;
}

const LCFG: Record<Aspect, LCfg> = {
  "1:1": { lidWF: 0.6, hingeYF: 0.53, capF: 0.042, capYF: 0.88 },
  "4:5": { lidWF: 0.64, hingeYF: 0.5, capF: 0.042, capYF: 0.9 },
  "9:16": { lidWF: 0.74, hingeYF: 0.44, capF: 0.046, capYF: 0.76 },
  "16:9": { lidWF: 0.4, hingeYF: 0.58, capF: 0.032, capYF: 0.88 },
};

interface ScreenRect {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  sr: number;
}

/** A macOS-style window mock: traffic dots + a two-column dashboard. */
function placeholderScreen(rect: ScreenRect, accent: string): Container {
  const { sx, sy, sw, sh } = rect;
  const c = new Container();
  const barH = sh * 0.16;
  c.addChild(new Graphics().rect(sx, sy, sw, barH).fill(UI_CARD));
  const dotR = barH * 0.14;
  const dotY = sy + barH / 2;
  const dotX0 = sx + sw * 0.035;
  const dotGap = dotR * 2.6;
  c.addChild(new Graphics().circle(dotX0, dotY, dotR).fill("#FF5F56"));
  c.addChild(new Graphics().circle(dotX0 + dotGap, dotY, dotR).fill("#FFBD2E"));
  c.addChild(new Graphics().circle(dotX0 + dotGap * 2, dotY, dotR).fill("#27C93F"));

  const pad = sw * 0.045;
  const bodyTop = sy + barH + pad;
  const bodyH = sh - barH - pad * 1.6;
  const colGap = pad * 0.8;
  const colW = (sw - pad * 2 - colGap) / 2;
  const leftH = bodyH * 0.62;

  c.addChild(new Graphics().roundRect(sx + pad, bodyTop, colW, leftH, sw * 0.012).fill({ color: accent, alpha: 0.14 }));
  c.addChild(new Graphics().roundRect(sx + pad + colW * 0.1, bodyTop + leftH * 0.16, colW * 0.5, leftH * 0.14, leftH * 0.07).fill(accent));
  c.addChild(new Graphics().roundRect(sx + pad + colW * 0.1, bodyTop + leftH * 0.42, colW * 0.7, leftH * 0.1, leftH * 0.05).fill(UI_BLOCK));
  c.addChild(new Graphics().roundRect(sx + pad + colW * 0.1, bodyTop + leftH * 0.6, colW * 0.55, leftH * 0.1, leftH * 0.05).fill(UI_BLOCK));

  const rightX = sx + pad + colW + colGap;
  const smallH = (leftH - pad * 0.6) / 2;
  c.addChild(new Graphics().roundRect(rightX, bodyTop, colW, smallH, sw * 0.012).fill(UI_CARD));
  c.addChild(new Graphics().circle(rightX + smallH * 0.28, bodyTop + smallH * 0.5, smallH * 0.16).fill(accent));
  c.addChild(new Graphics().roundRect(rightX, bodyTop + smallH + pad * 0.6, colW, smallH, sw * 0.012).fill(UI_CARD));
  c.addChild(new Graphics().circle(rightX + smallH * 0.28, bodyTop + smallH * 1.5 + pad * 0.6, smallH * 0.16).fill(accent));

  const lineY = bodyTop + leftH + pad * 0.5;
  c.addChild(new Graphics().roundRect(sx + pad, lineY, sw - pad * 2, Math.max(3, bodyH * 0.08), bodyH * 0.04).fill(UI_BLOCK));
  return c;
}

/** A soft diagonal gradient "sheen" clipped to the screen rect — a glassy reflection. */
function makeSheen(rect: ScreenRect): Graphics {
  const { sx, sy, sw, sh, sr } = rect;
  const grad = new FillGradient({
    type: "linear",
    start: { x: 0, y: 0 },
    end: { x: 0.65, y: 1 },
    colorStops: [
      { offset: 0, color: "rgba(255,255,255,0)" },
      { offset: 0.4, color: "rgba(255,255,255,0.3)" },
      { offset: 0.58, color: "rgba(255,255,255,0.1)" },
      { offset: 1, color: "rgba(255,255,255,0)" },
    ],
    textureSpace: "local",
  });
  return new Graphics().roundRect(sx, sy, sw, sh, sr).fill(grad);
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
  const caption = str(values.caption, "Your work, wherever you open it");
  const showSheen = values.showSheen !== false;

  const w = size.width;
  const h = size.height;

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const L = LCFG[ctx.aspect];
  const cx = w / 2;
  const hingeY = h * L.hingeYF;
  const lidW = w * L.lidWF;
  const lidH = lidW * 0.66;

  const timeline = new JimaTimeline();

  // Hinge-anchored wrapper: base children sit at y >= 0, lid children at y <= 0.
  const floatWrap = new Container();
  floatWrap.position.set(cx, hingeY);
  root.addChild(floatWrap);

  // --- Base (keyboard deck + trackpad notch + front lip) ---
  const baseGroup = new Container();
  baseGroup.alpha = 0;
  floatWrap.addChild(baseGroup);

  const hingeBarH = lidW * 0.018;
  const deckH = lidW * 0.052;
  const lipH = deckH * 0.42;
  const baseW = lidW * 1.05;
  const dr = Math.min(baseW, deckH) * 0.16;
  const padW = lidW * 0.22;
  const padH = deckH * 0.55;

  const shadow = new Graphics().ellipse(0, 0, baseW * 0.46, lipH * 1.5).fill({ color: 0x000000, alpha: 0.16 });
  shadow.position.set(0, hingeBarH + deckH + lipH + lipH * 0.6);
  baseGroup.addChild(shadow);
  baseGroup.addChild(new Graphics().roundRect(-lidW / 2, 0, lidW, hingeBarH, hingeBarH * 0.4).fill(CHROME_DARK));
  baseGroup.addChild(new Graphics().roundRect(-baseW / 2, hingeBarH, baseW, deckH, dr).fill(DECK));
  baseGroup.addChild(
    new Graphics().roundRect(-padW / 2, hingeBarH + deckH * 0.2, padW, padH, padH * 0.32).fill({ color: 0x000000, alpha: 0.07 }),
  );
  baseGroup.addChild(new Graphics().roundRect(-baseW / 2, hingeBarH + deckH, baseW, lipH, dr * 0.6).fill(DECK_EDGE));

  timeline.to(baseGroup, { prop: "alpha", from: 0, to: 1, start: 0, duration: 0.35, ease: outQuad });

  // --- Lid: pivoted at the hinge (0,0); opens via a scaleY reveal. ---
  const lidGroup = new Container();
  lidGroup.alpha = 0;
  lidGroup.scale.set(1, 0.035);
  floatWrap.addChild(lidGroup);

  const bezel = lidW * 0.045;
  const chin = bezel * 1.6;
  const lidR = bezel * 0.55;
  lidGroup.addChild(new Graphics().roundRect(-lidW / 2, -lidH, lidW, lidH, lidR).fill(BEZEL));

  const camW = lidW * 0.07;
  lidGroup.addChild(
    new Graphics().roundRect(-camW / 2, -lidH + bezel * 0.42, camW, Math.max(2, bezel * 0.16), bezel * 0.08).fill(CHROME_DARK),
  );

  const sx = -lidW / 2 + bezel;
  const sy = -lidH + bezel;
  const sw = lidW - 2 * bezel;
  const sh = lidH - bezel - chin;
  const sr = Math.max(2, bezel * 0.35);
  const screenRect: ScreenRect = { sx, sy, sw, sh, sr };

  lidGroup.addChild(new Graphics().roundRect(sx, sy, sw, sh, sr).fill(SCREEN_OFF));

  const screenContent = new Container();
  screenContent.alpha = 0;
  const tex = images.screen ?? null;
  if (tex) {
    const holder = new Container();
    const sprite = new Sprite(tex);
    sprite.anchor.set(0.5);
    const cover = Math.max(sw / tex.width, sh / tex.height);
    sprite.scale.set(cover);
    sprite.position.set(sx + sw / 2, sy + sh / 2);
    holder.addChild(sprite);
    screenContent.addChild(holder);
  } else {
    screenContent.addChild(placeholderScreen(screenRect, accent));
  }
  const screenMask = new Graphics().roundRect(sx, sy, sw, sh, sr).fill(0xffffff);
  lidGroup.addChild(screenContent, screenMask);
  screenContent.mask = screenMask;

  const sheen = showSheen ? makeSheen(screenRect) : null;
  if (sheen) {
    sheen.alpha = 0;
    lidGroup.addChild(sheen);
  }

  const LID_START = 0.35;
  const LID_DUR = 0.85;
  timeline
    .to(lidGroup, { prop: "alpha", from: 0, to: 1, start: 0, duration: 0.3, ease: outQuad })
    .to(lidGroup, { prop: "scale.y", from: 0.035, to: 1, start: LID_START, duration: LID_DUR, ease: makeOutBack(1.15) });

  const SCREEN_ON = LID_START + LID_DUR + 0.05;
  timeline
    .to(screenContent, { prop: "alpha", from: 0, to: 1, start: SCREEN_ON, duration: 0.4, ease: outQuad })
    .to(screenContent, { prop: "scale.x", from: 0.97, to: 1, start: SCREEN_ON, duration: 0.4, ease: outQuad })
    .to(screenContent, { prop: "scale.y", from: 0.97, to: 1, start: SCREEN_ON, duration: 0.4, ease: outQuad });

  if (sheen) {
    timeline.to(sheen, { prop: "alpha", from: 0, to: 0.5, start: SCREEN_ON + 0.15, duration: 0.5, ease: outQuad });
  }

  // --- Caption below the laptop ---
  if (caption.length > 0) {
    const capY = h * L.capYF;
    const capSize = Math.round(w * L.capF);
    const capText = fitText(
      fonts,
      { text: caption, role: "body", weight: 600, size: capSize, color: textColor, anchor: 0.5, align: "center" },
      w * 0.82,
    );
    capText.position.set(cx, capY);
    capText.alpha = 0;
    root.addChild(capText);
    const CAP_START = SCREEN_ON + 0.55;
    timeline
      .to(capText, { prop: "alpha", from: 0, to: 1, start: CAP_START, duration: 0.5, ease: outQuad })
      .to(capText, { prop: "y", from: capY + 16, to: capY, start: CAP_START, duration: 0.55, ease: outQuint });
  }

  // Gentle idle float once everything has settled (pure in t; floatWrap owns
  // y + rotation exclusively — no timeline tween ever touches those props).
  const FLOAT_AT = SCREEN_ON + 0.6;
  const PERIOD = 3.2;
  const amp = h * 0.008;
  const update = (t: number): void => {
    const tau = t - FLOAT_AT;
    if (tau <= 0) {
      floatWrap.y = hingeY;
      floatWrap.rotation = 0;
      return;
    }
    const env = Math.min(1, tau / 1.0);
    floatWrap.y = hingeY + Math.sin((tau / PERIOD) * Math.PI * 2) * amp * env;
    floatWrap.rotation = Math.sin((tau / (PERIOD * 1.3)) * Math.PI * 2) * 0.004 * env;
  };

  return { timeline, duration: 4.0, update };
}

export const laptopMockup: TemplateDefinition = {
  id: "laptop-mockup",
  name: "Laptop Mockup",
  tagline: "A laptop lid opens to reveal your screen.",
  category: "tech",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 2.9,
  fontRoles: { caption: "body" },
  palettes: PALETTES,
  fields: [
    { key: "screen", type: "image", label: "Screen", default: "", optional: true, help: "Fills the laptop screen; shows a labeled dashboard mock when empty." },
    { key: "caption", type: "text", label: "Caption", default: "Your work, wherever you open it", maxLength: 48, optional: true, shrinkToFit: true },
    { key: "showSheen", type: "toggle", label: "Glass sheen", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
