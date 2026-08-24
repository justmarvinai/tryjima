import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  spring,
  makeOutBack,
  type Aspect,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { dashedPath, makePill } from "../shared/ui";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const DEG = Math.PI / 180;

function fitSize(
  fonts: FontRegistry,
  text: string,
  role: FontRole,
  weight: number,
  size: number,
  maxWidth: number,
  letterSpacing = 0,
): number {
  const w = fonts.measure(text, {
    family: fonts.family(role),
    weight,
    size,
    ...(letterSpacing ? { letterSpacing } : {}),
  });
  return w > maxWidth ? Math.max(10, Math.floor((size * maxWidth) / w)) : size;
}

const PALETTES: Palette[] = [
  { id: "ember", name: "Ember", colors: { background: "#FFF3EE", textColor: "#2A0F06", accent: "#FF4D1C" } },
  { id: "grape", name: "Grape", colors: { background: "#F3EEFF", textColor: "#2A1A5E", accent: "#7C5CFF" } },
  { id: "pine", name: "Pine", colors: { background: "#EAF3EE", textColor: "#0B2A1E", accent: "#17A34A" } },
  { id: "berry", name: "Berry", colors: { background: "#FFEEF6", textColor: "#3A0A28", accent: "#FF2E9E" } },
];

interface L {
  ticketW: number;
  ticketH: number;
  cy: number;
}

function layout(aspect: Aspect, w: number, h: number): L {
  const f: Record<Aspect, { tw: number; th: number; cy: number }> = {
    "1:1": { tw: 0.78, th: 0.46, cy: 0.42 },
    "4:5": { tw: 0.8, th: 0.48, cy: 0.42 },
    "9:16": { tw: 0.82, th: 0.52, cy: 0.42 },
    "16:9": { tw: 0.52, th: 0.27, cy: 0.44 },
  };
  const b = f[aspect];
  return { ticketW: w * b.tw, ticketH: w * b.th, cy: h * b.cy };
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string) => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFF3EE"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const onAcc = "#FFFFFF";
  const showPerforation = values.perforation !== false;
  const showShine = values.shine !== false;

  const w = size.width;
  const h = size.height;
  const cx = w / 2;
  const minDim = Math.min(w, h);
  const { ticketW, ticketH, cy } = layout(ctx.aspect, w, h);

  root.addChild(new Graphics().rect(0, 0, w, h).fill(bg));
  const timeline = new JimaTimeline();

  // --- Ticket (drops + springs in) ---
  const ticket = new Container();
  ticket.position.set(cx, cy);
  ticket.alpha = 0;
  ticket.addChild(new Graphics().roundRect(-ticketW / 2, -ticketH / 2, ticketW, ticketH, minDim * 0.03).fill(accent));

  // Perforation + punched notches at the divider line.
  let perfG: Graphics | null = null;
  if (showPerforation) {
    const perfY = -ticketH * 0.05;
    const perfPad = ticketW * 0.08;
    perfG = new Graphics();
    dashedPath(perfG, [-ticketW / 2 + perfPad, perfY, ticketW / 2 - perfPad, perfY], {
      dash: 10,
      gap: 9,
      width: Math.max(2, minDim * 0.006),
      color: onAcc,
      cap: "round",
    });
    perfG.alpha = 0;
    ticket.addChild(perfG);
    const notchR = ticketH * 0.085;
    ticket.addChild(new Graphics().circle(-ticketW / 2, perfY, notchR).fill(bg));
    ticket.addChild(new Graphics().circle(ticketW / 2, perfY, notchR).fill(bg));
  }

  // Discount (top).
  const discRaw = str(values.discount, "20% OFF");
  const discSize = fitSize(fonts, discRaw, "display", 700, Math.round(ticketH * 0.24), ticketW * 0.82);
  const disc = makeText(fonts, { text: discRaw, role: "display", weight: 700, size: discSize, color: onAcc, anchor: 0.5, align: "center" });
  disc.position.set(0, -ticketH * 0.275);
  disc.alpha = 0;
  ticket.addChild(disc);

  // Code box (bottom) — dashed border + mono code.
  const codeRaw = str(values.code, "JIMA20");
  const boxW = ticketW * 0.62;
  const boxH = ticketH * 0.24;
  const boxY = ticketH * 0.12;
  const codeBox = new Container();
  codeBox.position.set(0, boxY);
  const bx = -boxW / 2;
  const by = -boxH / 2;
  const borderG = new Graphics();
  dashedPath(borderG, [bx, by, bx + boxW, by, bx + boxW, by + boxH, bx, by + boxH, bx, by], {
    dash: 12,
    gap: 8,
    width: Math.max(2, minDim * 0.005),
    color: onAcc,
    cap: "square",
  });
  codeBox.addChild(borderG);
  const codeSize = fitSize(fonts, codeRaw, "mono", 700, Math.round(boxH * 0.5), boxW * 0.8, 4);
  codeBox.addChild(makeText(fonts, { text: codeRaw, role: "mono", weight: 700, size: codeSize, color: onAcc, anchor: 0.5, letterSpacing: 4 }));
  codeBox.alpha = 0;
  codeBox.scale.set(0.8);
  ticket.addChild(codeBox);

  // Fine print (optional).
  const detailRaw = str(values.detail, "");
  if (detailRaw.length > 0) {
    const dSize = fitSize(fonts, detailRaw, "body", 500, Math.round(ticketH * 0.075), ticketW * 0.8);
    const det = makeText(fonts, { text: detailRaw, role: "body", weight: 500, size: dSize, color: onAcc, anchor: 0.5, align: "center" });
    det.position.set(0, ticketH * 0.36);
    det.alpha = 0;
    ticket.addChild(det);
    timeline.to(det, { prop: "alpha", from: 0, to: 0.85, start: 2.0, duration: 0.5, ease: outQuad });
  }

  // Shine sweep (masked to the ticket, sweeps once).
  if (showShine) {
    const shineMask = new Graphics().roundRect(-ticketW / 2, -ticketH / 2, ticketW, ticketH, minDim * 0.03).fill(onAcc);
    ticket.addChild(shineMask);
    const shineW = ticketW * 0.16;
    const shine = new Graphics()
      .poly([-shineW / 2, -ticketH * 0.7, shineW / 2, -ticketH * 0.7, shineW / 2 - ticketH * 0.35, ticketH * 0.7, -shineW / 2 - ticketH * 0.35, ticketH * 0.7])
      .fill({ color: "#FFFFFF", alpha: 0.22 });
    shine.mask = shineMask;
    const shineFrom = -ticketW / 2 - shineW * 2;
    shine.x = shineFrom;
    ticket.addChild(shine);
    timeline.to(shine, { prop: "x", from: shineFrom, to: ticketW / 2 + shineW * 2, start: 1.9, duration: 0.7, ease: outQuad });
  }

  root.addChild(ticket);
  timeline
    .to(ticket, { prop: "alpha", from: 0, to: 1, start: 0.2, duration: 0.3, ease: outQuad })
    .to(ticket, { prop: "y", from: cy - h * 0.35, to: cy, start: 0.2, duration: 0.8, ease: spring(0.5) })
    .to(ticket, { prop: "rotation", from: -4 * DEG, to: 0, start: 0.2, duration: 0.7, ease: outExpo });

  // Entrances for ticket contents.
  timeline
    .to(disc, { prop: "alpha", from: 0, to: 1, start: 0.9, duration: 0.35, ease: outQuad })
    .to(disc, { prop: "scale.x", from: 0.6, to: 1, start: 0.9, duration: 0.5, ease: makeOutBack(2) })
    .to(disc, { prop: "scale.y", from: 0.6, to: 1, start: 0.9, duration: 0.5, ease: makeOutBack(2) })
    .to(codeBox, { prop: "alpha", from: 0, to: 1, start: 1.4, duration: 0.4, ease: outQuad })
    .to(codeBox, { prop: "scale.x", from: 0.8, to: 1, start: 1.4, duration: 0.5, ease: makeOutBack(1.8) })
    .to(codeBox, { prop: "scale.y", from: 0.8, to: 1, start: 1.4, duration: 0.5, ease: makeOutBack(1.8) });
  if (perfG) {
    timeline.to(perfG, { prop: "alpha", from: 0, to: 1, start: 1.0, duration: 0.4, ease: outQuad });
  }

  // --- CTA pill (below the ticket) ---
  const ctaRaw = str(values.cta, "Copy code");
  const ctaSize = Math.round(minDim * 0.04);
  const ctaLabel = makeText(fonts, { text: ctaRaw, role: "display", weight: 700, size: ctaSize, color: onAcc, anchor: 0.5 });
  const ctaW = ctaLabel.width + ctaSize * 1.7;
  const ctaH = ctaSize * 2.0;
  const ctaC = new Container();
  ctaC.position.set(cx, cy + ticketH / 2 + minDim * 0.1);
  ctaC.addChild(makePill(ctaW, ctaH, accent));
  ctaC.addChild(ctaLabel);
  ctaC.scale.set(0);
  root.addChild(ctaC);
  timeline
    .to(ctaC, { prop: "scale.x", from: 0, to: 1, start: 2.4, duration: 0.55, ease: spring(0.45) })
    .to(ctaC, { prop: "scale.y", from: 0, to: 1, start: 2.4, duration: 0.55, ease: spring(0.45) })
    .to(ctaC, { prop: "scale.x", from: 1, to: 1.05, start: 3.1, duration: 0.22, ease: outQuad })
    .to(ctaC, { prop: "scale.x", from: 1.05, to: 1, start: 3.32, duration: 0.28, ease: outQuad })
    .to(ctaC, { prop: "scale.y", from: 1, to: 1.05, start: 3.1, duration: 0.22, ease: outQuad })
    .to(ctaC, { prop: "scale.y", from: 1.05, to: 1, start: 3.32, duration: 0.28, ease: outQuad });

  return { timeline, duration: 4.0 };
}

export const couponReveal: TemplateDefinition = {
  id: "coupon-reveal",
  name: "Coupon Reveal",
  tagline: "A coupon ticket springs in and shines to reveal the code.",
  category: "promo",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 2.6,
  palettes: PALETTES,
  fields: [
    { key: "discount", type: "text", label: "Discount", default: "20% OFF", maxLength: 12, shrinkToFit: true },
    { key: "code", type: "text", label: "Code", default: "JIMA20", maxLength: 16 },
    { key: "detail", type: "text", label: "Fine print", default: "Min. spend $30 · ends Sunday", maxLength: 44, optional: true },
    { key: "cta", type: "text", label: "Button", default: "Copy code", maxLength: 20 },
    { key: "perforation", type: "toggle", label: "Perforation", default: true },
    { key: "shine", type: "toggle", label: "Shine sweep", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
