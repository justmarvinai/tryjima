import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuint,
  outQuad,
  inOutQuint,
  makeOutBack,
  type Aspect,
  type BuiltTemplate,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";

const str = (v: unknown, fallback: string): string => (typeof v === "string" && v.length > 0 ? v : fallback);

const PALETTES: Palette[] = [
  { id: "ivory", name: "Invitation ivory", colors: { background: "#FBF7EF", textColor: "#2A2416", accent: "#B5892A" } },
  { id: "ink-formal", name: "Ink formal", colors: { background: "#12141C", textColor: "#F4F1E9", accent: "#C9A24B" } },
  { id: "coral-festive", name: "Coral festive", colors: { background: "#FFF2EE", textColor: "#3A1206", accent: "#FF4D1C" } },
  { id: "sage-calm", name: "Sage calm", colors: { background: "#EDF3ED", textColor: "#16281C", accent: "#2F8F5B" } },
];

function fontFrac(aspect: Aspect): number {
  return aspect === "16:9" ? 0.06 : aspect === "9:16" ? 0.082 : 0.072;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string) => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FBF7EF"));
  const textColor = str(values.textColor, pc("textColor", "#2A2416"));
  const accent = str(values.accent, pc("accent", "#B5892A"));
  const eyebrow = str(values.eyebrow, "SAVE THE DATE");
  const eventName = str(values.eventName, "Jima Live 2026");
  const date = str(values.date, "12 · 09 · 2026");
  const place = str(values.place, "");
  const frameOn = values.frame !== false;

  root.addChild(new Graphics().rect(0, 0, size.width, size.height).fill(bg));

  const timeline = new JimaTimeline();
  const cx = size.width / 2;
  const cy = size.height * 0.5;
  const fontSize = Math.round(size.width * fontFrac(ctx.aspect));

  // Border frame drawn clockwise.
  if (frameOn) {
    const m = size.width * 0.07;
    const th = Math.max(2, size.width * 0.006);
    const w = size.width - m * 2;
    const h = size.height - m * 2;
    const top = new Graphics().rect(0, 0, w, th).fill(accent);
    top.position.set(m, m);
    top.scale.set(0, 1);
    const right = new Graphics().rect(0, 0, th, h).fill(accent);
    right.position.set(size.width - m - th, m);
    right.scale.set(1, 0);
    const bottom = new Graphics().rect(0, 0, w, th).fill(accent);
    bottom.pivot.set(w, 0);
    bottom.position.set(size.width - m, size.height - m - th);
    bottom.scale.set(0, 1);
    const left = new Graphics().rect(0, 0, th, h).fill(accent);
    left.pivot.set(0, h);
    left.position.set(m, size.height - m);
    left.scale.set(1, 0);
    root.addChild(top, right, bottom, left);
    timeline
      .to(top, { prop: "scale.x", from: 0, to: 1, start: 0.0, duration: 0.3, ease: inOutQuint })
      .to(right, { prop: "scale.y", from: 0, to: 1, start: 0.28, duration: 0.3, ease: inOutQuint })
      .to(bottom, { prop: "scale.x", from: 0, to: 1, start: 0.56, duration: 0.3, ease: inOutQuint })
      .to(left, { prop: "scale.y", from: 0, to: 1, start: 0.84, duration: 0.3, ease: inOutQuint });
  }

  // Eyebrow (letter-spacing in).
  const eyeSize = Math.round(fontSize * 0.34);
  const eye = makeText(fonts, { text: eyebrow.toUpperCase(), role: "body", weight: 600, size: eyeSize, color: accent, anchor: 0.5, letterSpacing: 6 });
  eye.position.set(cx, cy - fontSize * 1.7);
  eye.alpha = 0;
  root.addChild(eye);
  timeline
    .to(eye, { prop: "alpha", from: 0, to: 1, start: 0.4, duration: 0.5, ease: outQuad })
    .to(eye, { prop: "style.letterSpacing", from: eyeSize * 0.5, to: 6, start: 0.4, duration: 0.5, ease: outQuint });

  // Event name rises under a clip mask.
  const nameHolder = new Container();
  nameHolder.position.set(cx, cy - fontSize * 0.7);
  root.addChild(nameHolder);
  const nameMask = new Graphics().rect(-size.width / 2, -fontSize * 0.8, size.width, fontSize * 1.6).fill(0xffffff);
  nameHolder.addChild(nameMask);
  const nameText = makeText(fonts, { text: eventName, role: "display", weight: 700, size: fontSize, color: textColor, anchor: 0.5 });
  nameText.mask = nameMask;
  nameHolder.addChild(nameText);
  timeline.to(nameText, { prop: "y", from: fontSize * 1.2, to: 0, start: 0.9, duration: 0.6, ease: outQuint });

  // Date groups roll up with a landing tick.
  const tokens = date.split(/\s+/).filter(Boolean);
  const dateSize = Math.round(fontSize * 0.82);
  const gap = dateSize * 0.4;
  const widths = tokens.map((tok) => fonts.measure(tok, { family: fonts.family("display"), weight: 700, size: dateSize }));
  const totalW = widths.reduce((a, b) => a + b, 0) + gap * (tokens.length - 1);
  let cursor = cx - totalW / 2;
  const dateY = cy + fontSize * 0.6;
  tokens.forEach((tok, i) => {
    const gx = cursor + widths[i]! / 2;
    cursor += widths[i]! + gap;
    const holder = new Container();
    holder.position.set(gx, dateY);
    root.addChild(holder);
    const maskG = new Graphics().rect(-widths[i]! / 2 - 4, -dateSize * 0.75, widths[i]! + 8, dateSize * 1.5).fill(0xffffff);
    holder.addChild(maskG);
    const t = makeText(fonts, { text: tok, role: "display", weight: 700, size: dateSize, color: tok === "·" ? accent : textColor, anchor: 0.5 });
    t.mask = maskG;
    holder.addChild(t);
    const start = 1.5 + i * 0.14;
    timeline
      .to(t, { prop: "y", from: dateSize * 1.1, to: 0, start, duration: 0.5, ease: makeOutBack(1.5) })
      .to(holder, { prop: "scale.y", from: 1, to: 1.08, start: start + 0.45, duration: 0.1, ease: outQuad })
      .to(holder, { prop: "scale.y", from: 1.08, to: 1, start: start + 0.55, duration: 0.14, ease: outQuad });
  });

  if (place.length > 0) {
    const placeText = makeText(fonts, { text: place, role: "body", weight: 500, size: Math.round(fontSize * 0.34), color: textColor, anchor: 0.5 });
    placeText.position.set(cx, dateY + fontSize * 1.2);
    placeText.alpha = 0;
    root.addChild(placeText);
    timeline.to(placeText, { prop: "alpha", from: 0, to: 0.85, start: 2.9, duration: 0.4, ease: outQuad });
  }

  return { timeline, duration: 5.0 };
}

export const saveTheDate: TemplateDefinition = {
  id: "save-the-date",
  name: "Save the Date",
  tagline: "A date rolls into place on a bordered card.",
  category: "event",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 3.0,
  palettes: PALETTES,
  fields: [
    { key: "eyebrow", type: "text", label: "Eyebrow", default: "SAVE THE DATE", maxLength: 24 },
    { key: "eventName", type: "text", label: "Event name", default: "Jima Live 2026", maxLength: 48, shrinkToFit: true },
    { key: "date", type: "text", label: "Date", default: "12 · 09 · 2026", maxLength: 16 },
    { key: "place", type: "text", label: "Place", default: "Online · 6 PM CET", maxLength: 48, optional: true },
    { key: "frame", type: "toggle", label: "Border frame", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
