import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outQuint,
  spring,
  makeOutBack,
  safeRect,
  type Aspect,
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

// Neutral device chrome (fixed regardless of palette, like sibling mockups).
const BEZEL = "#17181D";
const SCREEN_BG = "#FFFFFF";
const DECK = "#E7E9ED";
const DECK_EDGE = "#C9CCD3";
const CHROME_DARK = "#3A3C44";
const SPEAKER = "#3A3C44";

const PALETTES: Palette[] = [
  { id: "ember", name: "Ember", colors: { background: "#FFF4EE", accent: "#FF4D1C", textColor: "#101014", onAccent: "#FFFFFF", muted: "#E4E7EC" } },
  { id: "grape", name: "Grape", colors: { background: "#F3EEFF", accent: "#7C5CFF", textColor: "#241452", onAccent: "#FFFFFF", muted: "#E7E2F4" } },
  { id: "sky", name: "Sky", colors: { background: "#EAF2FB", accent: "#2E5BD6", textColor: "#0F1B2A", onAccent: "#FFFFFF", muted: "#DEE7F3" } },
  { id: "mint", name: "Mint", colors: { background: "#E9F7EF", accent: "#12B76A", textColor: "#06301F", onAccent: "#FFFFFF", muted: "#DCEDE3" } },
];

interface Cfg {
  lidWF: number;
  cyF: number;
  tabletDX: number;
  tabletDY: number;
  phoneDX: number;
  phoneDY: number;
}

const CFG: Record<Aspect, Cfg> = {
  "1:1": { lidWF: 0.54, cyF: 0.45, tabletDX: -0.5, tabletDY: 0.16, phoneDX: 0.56, phoneDY: 0.22 },
  "4:5": { lidWF: 0.56, cyF: 0.44, tabletDX: -0.5, tabletDY: 0.16, phoneDX: 0.56, phoneDY: 0.22 },
  "9:16": { lidWF: 0.58, cyF: 0.42, tabletDX: -0.46, tabletDY: 0.2, phoneDX: 0.5, phoneDY: 0.26 },
  "16:9": { lidWF: 0.4, cyF: 0.46, tabletDX: -0.5, tabletDY: 0.18, phoneDX: 0.56, phoneDY: 0.24 },
};

interface ScreenRect {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  sr: number;
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

/** The shared brand UI: an accent header (brand name + logo dot) + skeleton rows + a card. */
function brandUI(
  fonts: FontRegistry,
  rect: ScreenRect,
  accent: string,
  onAccent: string,
  muted: string,
  brand: string,
): Container {
  const { sx, sy, sw, sh } = rect;
  const c = new Container();
  const headerH = sh * 0.17;
  c.addChild(new Graphics().rect(sx, sy, sw, headerH).fill(accent));
  c.addChild(new Graphics().circle(sx + sw * 0.11, sy + headerH * 0.5, headerH * 0.24).fill({ color: onAccent, alpha: 0.95 }));
  const lbl = fitText(
    fonts,
    { text: brand, role: "display", weight: 700, size: Math.round(headerH * 0.44), color: onAccent, anchor: { x: 0, y: 0.5 } },
    sw * 0.64,
  );
  lbl.position.set(sx + sw * 0.2, sy + headerH * 0.52);
  c.addChild(lbl);

  let y = sy + headerH + sh * 0.08;
  const rowH = sh * 0.045;
  for (const wd of [0.72, 0.54, 0.64]) {
    c.addChild(new Graphics().roundRect(sx + sw * 0.09, y, sw * wd, rowH, rowH * 0.5).fill({ color: muted, alpha: 1 }));
    y += sh * 0.085;
  }
  c.addChild(new Graphics().roundRect(sx + sw * 0.09, y + sh * 0.02, sw * 0.82, sh * 0.2, sh * 0.03).fill({ color: muted, alpha: 0.55 }));
  c.addChild(new Graphics().circle(sx + sw * 0.22, y + sh * 0.12, sh * 0.05).fill(accent));
  c.addChild(new Graphics().roundRect(sx + sw * 0.09, y + sh * 0.26, sw * 0.34, sh * 0.06, sh * 0.03).fill(accent));
  return c;
}

function putScreen(parent: Container, rect: ScreenRect, ui: Container): void {
  parent.addChild(new Graphics().roundRect(rect.sx, rect.sy, rect.sw, rect.sh, rect.sr).fill(SCREEN_BG));
  const mask = new Graphics().roundRect(rect.sx, rect.sy, rect.sw, rect.sh, rect.sr).fill(0xffffff);
  parent.addChild(ui, mask);
  ui.mask = mask;
}

function drawLaptop(parent: Container, lidW: number, uiFor: (r: ScreenRect) => Container): void {
  const lidH = lidW * 0.62;
  const bezel = lidW * 0.03;
  const hingeH = lidW * 0.016;
  const deckH = lidW * 0.05;
  const lipH = deckH * 0.42;
  const baseW = lidW * 1.06;
  const totalH = lidH + hingeH + deckH + lipH;
  const top = -totalH / 2;

  parent.addChild(new Graphics().ellipse(0, top + totalH + lipH * 0.4, baseW * 0.5, lipH * 1.6).fill({ color: 0x000000, alpha: 0.14 }));

  // Lid.
  const lidR = bezel * 1.2;
  parent.addChild(new Graphics().roundRect(-lidW / 2, top, lidW, lidH, lidR).fill(BEZEL));
  const cam = lidW * 0.06;
  parent.addChild(new Graphics().roundRect(-cam / 2, top + bezel * 0.4, cam, Math.max(2, bezel * 0.14), bezel * 0.07).fill(CHROME_DARK));
  const rect: ScreenRect = { sx: -lidW / 2 + bezel, sy: top + bezel, sw: lidW - 2 * bezel, sh: lidH - 2 * bezel, sr: Math.max(2, bezel * 0.4) };
  putScreen(parent, rect, uiFor(rect));

  // Base: hinge bar + deck + trackpad + front lip.
  let by = top + lidH;
  parent.addChild(new Graphics().roundRect(-lidW / 2, by, lidW, hingeH, hingeH * 0.4).fill(CHROME_DARK));
  by += hingeH;
  const dr = deckH * 0.2;
  parent.addChild(new Graphics().roundRect(-baseW / 2, by, baseW, deckH, dr).fill(DECK));
  parent.addChild(new Graphics().roundRect(-baseW * 0.11, by + deckH * 0.2, baseW * 0.22, deckH * 0.55, deckH * 0.16).fill({ color: 0x000000, alpha: 0.07 }));
  by += deckH;
  parent.addChild(new Graphics().roundRect(-baseW / 2, by, baseW, lipH, dr * 0.6).fill(DECK_EDGE));
}

function drawTablet(parent: Container, tw: number, uiFor: (r: ScreenRect) => Container): void {
  const th = tw * 1.36;
  const bodyR = Math.min(tw, th) * 0.08;
  const bezel = Math.min(tw, th) * 0.04;
  parent.addChild(new Graphics().roundRect(-tw / 2, -th / 2 + th * 0.02, tw, th, bodyR).fill({ color: 0x000000, alpha: 0.18 }));
  parent.addChild(new Graphics().roundRect(-tw / 2, -th / 2, tw, th, bodyR).fill(BEZEL));
  parent.addChild(new Graphics().circle(0, -th / 2 + bezel * 0.5, Math.max(2, bezel * 0.16)).fill("#565961"));
  const rect: ScreenRect = { sx: -tw / 2 + bezel, sy: -th / 2 + bezel, sw: tw - 2 * bezel, sh: th - 2 * bezel, sr: Math.max(2, bodyR - bezel * 0.4) };
  putScreen(parent, rect, uiFor(rect));
}

function drawPhone(parent: Container, pw: number, uiFor: (r: ScreenRect) => Container): void {
  const ph = pw * 2.06;
  const bodyR = pw * 0.16;
  const bezel = pw * 0.055;
  parent.addChild(new Graphics().roundRect(-pw / 2, -ph / 2 + ph * 0.02, pw, ph, bodyR).fill({ color: 0x000000, alpha: 0.22 }));
  parent.addChild(new Graphics().roundRect(-pw / 2, -ph / 2, pw, ph, bodyR).fill(BEZEL));
  const speakerW = pw * 0.16;
  parent.addChild(new Graphics().roundRect(-speakerW / 2, -ph / 2 + bezel * 0.5, speakerW, Math.max(3, pw * 0.02), pw * 0.01).fill(SPEAKER));
  const rect: ScreenRect = { sx: -pw / 2 + bezel, sy: -ph / 2 + bezel, sw: pw - 2 * bezel, sh: ph - 2 * bezel, sr: Math.max(3, bodyR - bezel * 0.5) };
  putScreen(parent, rect, uiFor(rect));
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFF4EE"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const onAccent = pc("onAccent", "#FFFFFF");
  const muted = pc("muted", "#E4E7EC");
  const brand = str(values.brandName, "Northwind");
  const caption = str(values.caption, "One brand. Every screen.");
  const showPhone = values.showPhone !== false;
  const showTablet = values.showTablet !== false;

  const w = size.width;
  const h = size.height;

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const cfg = CFG[ctx.aspect];
  const safe = safeRect(ctx.aspect);
  const lidW = w * cfg.lidWF;
  const ccx = w / 2;
  const ccy = h * cfg.cyF;

  const timeline = new JimaTimeline();
  const uiFor = (r: ScreenRect): Container => brandUI(fonts, r, accent, onAccent, muted, brand);

  // floatWrap owns the gentle idle drift; each device's own container owns its
  // entrance transform — no property is written by both.
  const floatWrap = new Container();
  floatWrap.position.set(ccx, ccy);
  root.addChild(floatWrap);

  // --- Laptop (back / center, settles first) ---
  const laptop = new Container();
  laptop.position.set(0, 0);
  laptop.alpha = 0;
  laptop.scale.set(0.86);
  floatWrap.addChild(laptop);
  drawLaptop(laptop, lidW, uiFor);
  const lapRise = h * 0.06;
  timeline
    .to(laptop, { prop: "alpha", from: 0, to: 1, start: 0.15, duration: 0.4, ease: outQuad })
    .to(laptop, { prop: "y", from: lapRise, to: 0, start: 0.15, duration: 0.8, ease: outQuint })
    .to(laptop, { prop: "scale.x", from: 0.86, to: 1, start: 0.15, duration: 0.8, ease: spring(0.55) })
    .to(laptop, { prop: "scale.y", from: 0.86, to: 1, start: 0.15, duration: 0.8, ease: spring(0.55) });

  // --- Tablet (front-left, tilted) ---
  if (showTablet) {
    const tabletW = lidW * 0.47;
    const tdx = lidW * cfg.tabletDX;
    const tdy = lidW * cfg.tabletDY;
    const tRot = -6 * DEG;
    const tablet = new Container();
    tablet.position.set(tdx - lidW * 0.16, tdy);
    tablet.alpha = 0;
    tablet.rotation = -18 * DEG;
    tablet.scale.set(0.8);
    floatWrap.addChild(tablet);
    drawTablet(tablet, tabletW, uiFor);
    const st = 0.45;
    timeline
      .to(tablet, { prop: "alpha", from: 0, to: 1, start: st, duration: 0.4, ease: outQuad })
      .to(tablet, { prop: "x", from: tdx - lidW * 0.16, to: tdx, start: st, duration: 0.8, ease: outQuint })
      .to(tablet, { prop: "rotation", from: -18 * DEG, to: tRot, start: st, duration: 0.8, ease: makeOutBack(1.3) })
      .to(tablet, { prop: "scale.x", from: 0.8, to: 1, start: st, duration: 0.8, ease: spring(0.55) })
      .to(tablet, { prop: "scale.y", from: 0.8, to: 1, start: st, duration: 0.8, ease: spring(0.55) });
  }

  // --- Phone (front-right, tilted, on top) ---
  if (showPhone) {
    const phoneW = lidW * 0.24;
    const pdx = lidW * cfg.phoneDX;
    const pdy = lidW * cfg.phoneDY;
    const pRot = 7 * DEG;
    const phone = new Container();
    phone.position.set(pdx + lidW * 0.16, pdy);
    phone.alpha = 0;
    phone.rotation = 20 * DEG;
    phone.scale.set(0.8);
    floatWrap.addChild(phone);
    drawPhone(phone, phoneW, uiFor);
    const st = 0.62;
    timeline
      .to(phone, { prop: "alpha", from: 0, to: 1, start: st, duration: 0.4, ease: outQuad })
      .to(phone, { prop: "x", from: pdx + lidW * 0.16, to: pdx, start: st, duration: 0.8, ease: outQuint })
      .to(phone, { prop: "rotation", from: 20 * DEG, to: pRot, start: st, duration: 0.8, ease: makeOutBack(1.3) })
      .to(phone, { prop: "scale.x", from: 0.8, to: 1, start: st, duration: 0.8, ease: spring(0.55) })
      .to(phone, { prop: "scale.y", from: 0.8, to: 1, start: st, duration: 0.8, ease: spring(0.55) });
  }

  // --- Caption below the cluster, clamped clear of the safe zone ---
  if (caption.length > 0) {
    const capSize = Math.round(w * (ctx.aspect === "16:9" ? 0.03 : 0.038));
    const capY = Math.min(safe.y + safe.height - capSize * 0.7, ccy + lidW * 0.52);
    const capText = fitText(
      fonts,
      { text: caption, role: "body", weight: 600, size: capSize, color: textColor, anchor: 0.5, align: "center" },
      safe.width * 0.9,
    );
    capText.position.set(ccx, capY);
    capText.alpha = 0;
    root.addChild(capText);
    timeline
      .to(capText, { prop: "alpha", from: 0, to: 1, start: 1.4, duration: 0.5, ease: outQuad })
      .to(capText, { prop: "y", from: capY + 16, to: capY, start: 1.4, duration: 0.55, ease: outQuint });
  }

  // Gentle idle float (pure in t; floatWrap owns y + rotation exclusively).
  const FLOAT_AT = 1.5;
  const PERIOD = 3.4;
  const amp = h * 0.008;
  const update = (t: number): void => {
    const tau = t - FLOAT_AT;
    if (tau <= 0) {
      floatWrap.y = ccy;
      floatWrap.rotation = 0;
      return;
    }
    const env = Math.min(1, tau / 1.0);
    floatWrap.y = ccy + Math.sin((tau / PERIOD) * Math.PI * 2) * amp * env;
    floatWrap.rotation = Math.sin((tau / (PERIOD * 1.4)) * Math.PI * 2) * 0.004 * env;
  };

  return { timeline, duration: 4.0, update };
}

export const deviceFamily: TemplateDefinition = {
  id: "device-family",
  name: "Device Family",
  tagline: "A laptop, tablet and phone show the same brand, side by side.",
  category: "tech",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 2.9,
  fontRoles: { brandName: "display", caption: "body" },
  palettes: PALETTES,
  fields: [
    { key: "brandName", type: "text", label: "Brand name", default: "Northwind", maxLength: 18, shrinkToFit: true },
    { key: "caption", type: "text", label: "Caption", default: "One brand. Every screen.", maxLength: 40, optional: true, shrinkToFit: true },
    { key: "showTablet", type: "toggle", label: "Show tablet", default: true },
    { key: "showPhone", type: "toggle", label: "Show phone", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
