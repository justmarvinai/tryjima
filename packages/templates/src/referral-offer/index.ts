import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
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

// Referral — "give €10, get €10": two panels facing each other across an arrow
// that draws between them, then the code drops in underneath. The offer whose
// whole meaning is the symmetry, so the layout is the message.
//
// `coupon-reveal` hands one person a code. This one is a transaction between
// two people, and the arrow is what says so.

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;

const PALETTES: Palette[] = [
  { id: "mint", name: "Mint", colors: { background: "#F1F7F3", textColor: "#0F1F17", accent: "#0F9D6E" } },
  { id: "ink", name: "Ink", colors: { background: "#111216", textColor: "#F4F5F7", accent: "#4ADE80" } },
  { id: "coral", name: "Coral", colors: { background: "#FFF4F0", textColor: "#1E1310", accent: "#E8503A" } },
  { id: "violet", name: "Violet", colors: { background: "#F3F0FB", textColor: "#1A1330", accent: "#6D3BE4" } },
];

interface Layout {
  panelFrac: number;
  amountFrac: number;
  centerFrac: number;
  stacked: boolean;
}

function layout(aspect: Aspect): Layout {
  switch (aspect) {
    case "16:9":
      return { panelFrac: 0.3, amountFrac: 0.072, centerFrac: 0.48, stacked: false };
    case "9:16":
      return { panelFrac: 0.76, amountFrac: 0.1, centerFrac: 0.45, stacked: true };
    case "4:5":
      return { panelFrac: 0.42, amountFrac: 0.076, centerFrac: 0.47, stacked: false };
    case "1:1":
    default:
      return { panelFrac: 0.4, amountFrac: 0.074, centerFrac: 0.47, stacked: false };
  }
}

const HEAD_AT = 0.2;
const PANEL_AT = 0.6;
const ARROW_AT = 1.15;
const CODE_AT = 1.6;
const DURATION = 5.0;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F1F7F3"));
  const textColor = str(values.textColor, pc("textColor", "#0F1F17"));
  const accent = str(values.accent, pc("accent", "#0F9D6E"));
  const heading = str(values.heading, "Refer a friend");
  const giveAmount = str(values.giveAmount, "€10");
  const giveLabel = str(values.giveLabel, "for them");
  const getAmount = str(values.getAmount, "€10");
  const getLabel = str(values.getLabel, "for you");
  const code = str(values.code, "").trim();
  const footnote = str(values.footnote, "").trim();
  const showArrow = on(values.showArrow);

  root.addChild(new Graphics().rect(0, 0, size.width, size.height).fill(bg));

  const L = layout(ctx.aspect);
  const cx = size.width / 2;
  const cy = size.height * L.centerFrac;
  const amountSize = Math.round(size.width * L.amountFrac);
  const panelW = size.width * L.panelFrac;
  const panelH = amountSize * 3.4;
  const gap = L.stacked ? amountSize * 1.5 : size.width * 0.055;

  const timeline = new JimaTimeline();

  // --- Heading ---
  const headSize = Math.round(amountSize * 0.62);
  const h = makeText(fonts, { text: heading, role: "display", weight: 800, size: headSize, color: textColor, anchor: 0.5 });
  const headY = cy - (L.stacked ? panelH * 1.35 : panelH * 0.98);
  if (h.width > size.width * 0.86) h.scale.set((size.width * 0.86) / h.width);
  h.position.set(cx, headY);
  h.alpha = 0;
  root.addChild(h);
  timeline
    .to(h, { prop: "alpha", from: 0, to: 1, start: HEAD_AT, duration: 0.4, ease: outQuad })
    .to(h, { prop: "y", from: headY + headSize * 0.35, to: headY, start: HEAD_AT, duration: 0.75, ease: outExpo });

  // --- The two panels ---
  const makePanel = (amount: string, label: string, filled: boolean, at: number, x: number, y: number): void => {
    const panel = new Container();
    panel.position.set(x, y);
    root.addChild(panel);
    const body = new Graphics().roundRect(-panelW / 2, -panelH / 2, panelW, panelH, amountSize * 0.4);
    if (filled) body.fill(accent);
    else body.fill({ color: accent, alpha: 0.1 }).stroke({ color: accent, width: Math.max(3, size.width * 0.0026), alpha: 0.8 });
    panel.addChild(body);

    const a = makeText(fonts, {
      text: amount,
      role: "display",
      weight: 800,
      size: amountSize,
      color: filled ? bg : accent,
      anchor: 0.5,
    });
    if (a.width > panelW * 0.8) a.scale.set((panelW * 0.8) / a.width);
    a.y = -amountSize * 0.34;
    panel.addChild(a);

    const l = makeText(fonts, {
      text: label,
      role: "body",
      weight: 700,
      size: amountSize * 0.36,
      color: filled ? bg : textColor,
      anchor: 0.5,
    });
    l.alpha = filled ? 0.86 : 0.66;
    l.y = amountSize * 0.66;
    panel.addChild(l);

    panel.alpha = 0;
    timeline
      .to(panel, { prop: "alpha", from: 0, to: 1, start: at, duration: 0.35, ease: outQuad })
      .to(panel, { prop: "scale.x", from: 0.82, to: 1, start: at, duration: 0.65, ease: outBack })
      .to(panel, { prop: "scale.y", from: 0.82, to: 1, start: at, duration: 0.65, ease: outBack });
  };

  if (L.stacked) {
    makePanel(giveAmount, giveLabel, true, PANEL_AT, cx, cy - (panelH + gap) / 2);
    makePanel(getAmount, getLabel, false, PANEL_AT + 0.18, cx, cy + (panelH + gap) / 2);
  } else {
    makePanel(giveAmount, giveLabel, true, PANEL_AT, cx - (panelW + gap) / 2, cy);
    makePanel(getAmount, getLabel, false, PANEL_AT + 0.18, cx + (panelW + gap) / 2, cy);
  }

  // --- The arrow between them ---
  if (showArrow) {
    const arrow = new Container();
    arrow.position.set(cx, cy);
    const s = amountSize * 0.5;
    const w = Math.max(3, size.width * 0.0028);
    const shaft = new Graphics().poly([-s * 0.6, 0, s * 0.6, 0], false).stroke({ color: textColor, width: w, cap: "round" });
    const headG = new Graphics()
      .poly([s * 0.15, -s * 0.32, s * 0.6, 0, s * 0.15, s * 0.32], false)
      .stroke({ color: textColor, width: w, cap: "round", join: "round" });
    arrow.addChild(shaft, headG);
    arrow.alpha = 0.65;
    if (L.stacked) arrow.rotation = Math.PI / 2;
    arrow.scale.set(0);
    root.addChild(arrow);
    timeline
      .to(arrow, { prop: "scale.x", from: 0, to: 1, start: ARROW_AT, duration: 0.5, ease: outBack })
      .to(arrow, { prop: "scale.y", from: 0, to: 1, start: ARROW_AT, duration: 0.5, ease: outBack });
  }

  // --- Code ---
  const belowY = cy + (L.stacked ? panelH * 1.35 : panelH * 0.9);
  if (code.length > 0) {
    const cSize = Math.round(amountSize * 0.4);
    const cText = makeText(fonts, {
      text: code.toUpperCase(),
      role: "mono",
      weight: 700,
      size: cSize,
      color: textColor,
      anchor: 0.5,
      letterSpacing: cSize * 0.14,
    });
    const w = cText.width + cSize * 2.2;
    const hh = cSize * 2.4;
    const holder = new Container();
    holder.addChild(
      new Graphics()
        .roundRect(-w / 2, -hh / 2, w, hh, cSize * 0.35)
        .fill({ color: textColor, alpha: 0.05 })
        .stroke({ color: textColor, width: Math.max(2, size.width * 0.0016), alpha: 0.32 }),
      cText,
    );
    holder.position.set(cx, belowY);
    holder.alpha = 0;
    root.addChild(holder);
    timeline
      .to(holder, { prop: "alpha", from: 0, to: 1, start: CODE_AT, duration: 0.35, ease: outQuad })
      .to(holder, { prop: "y", from: belowY + cSize * 0.7, to: belowY, start: CODE_AT, duration: 0.75, ease: outQuint });
  }

  if (footnote.length > 0) {
    const f = makeText(fonts, {
      text: footnote,
      role: "body",
      weight: 500,
      size: amountSize * 0.3,
      color: textColor,
      anchor: 0.5,
      align: "center",
    });
    const fy = belowY + amountSize * (code ? 1.1 : 0.4);
    f.alpha = 0;
    f.position.set(cx, fy);
    root.addChild(f);
    timeline.to(f, { prop: "alpha", from: 0, to: 0.55, start: CODE_AT + 0.35, duration: 0.5, ease: outQuad });
  }

  return { timeline, duration: DURATION };
}

export const referralOffer: TemplateDefinition = {
  id: "referral-offer",
  name: "Referral",
  tagline: "Give this, get that — two panels facing each other across an arrow.",
  category: "promo",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 3.4,
  fontRoles: { heading: "display", code: "mono" },
  palettes: PALETTES,
  fields: [
    { key: "heading", type: "text", label: "Heading", default: "Refer a friend", maxLength: 32, shrinkToFit: true },
    { key: "giveAmount", type: "text", label: "They get", default: "€10", maxLength: 12 },
    { key: "giveLabel", type: "text", label: "They-get label", default: "for them", maxLength: 20 },
    { key: "getAmount", type: "text", label: "You get", default: "€10", maxLength: 12 },
    { key: "getLabel", type: "text", label: "You-get label", default: "for you", maxLength: 20 },
    { key: "code", type: "text", label: "Code", default: "FIKA10", maxLength: 16, optional: true },
    { key: "footnote", type: "text", label: "Small print", default: "On their first order over €40", maxLength: 50, optional: true },
    { key: "showArrow", type: "toggle", label: "Arrow", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
