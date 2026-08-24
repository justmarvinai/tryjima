import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  inOutQuint,
  outExpo,
  outQuad,
  outQuint,
  type Aspect,
  type BuiltTemplate,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { layoutWords } from "../shared/words";

// Redacted — the headline begins fully blacked out, word by word, like a
// declassified document. The bars then slide off one at a time to expose the
// text underneath, with one word left redacted for as long as you like.
//
// It is the "here's what they don't tell you" device, and nothing in the
// library does it: `mask-wipe` and `box-wipe` uncover with a travelling edge;
// here each word has its own bar that must be removed individually, and one
// can stay.

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;
const num = (v: unknown, fallback: number): number => (typeof v === "number" && Number.isFinite(v) ? v : fallback);

const PALETTES: Palette[] = [
  { id: "dossier", name: "Dossier", colors: { background: "#F1EEE6", textColor: "#14130F", accent: "#B3261E" } },
  { id: "ink", name: "Ink", colors: { background: "#0D0E11", textColor: "#F2F2EF", accent: "#EF4444" } },
  { id: "manila", name: "Manila", colors: { background: "#EFE2C4", textColor: "#20190C", accent: "#8A1C12" } },
  { id: "steel", name: "Steel", colors: { background: "#E8EBEE", textColor: "#111519", accent: "#1D4ED8" } },
];

interface Layout {
  fontFrac: number;
  maxWidthFrac: number;
  centerFrac: number;
}

function layout(aspect: Aspect): Layout {
  switch (aspect) {
    case "16:9":
      return { fontFrac: 0.082, maxWidthFrac: 0.76, centerFrac: 0.48 };
    case "9:16":
      return { fontFrac: 0.108, maxWidthFrac: 0.86, centerFrac: 0.47 };
    case "4:5":
      return { fontFrac: 0.1, maxWidthFrac: 0.84, centerFrac: 0.475 };
    case "1:1":
    default:
      return { fontFrac: 0.102, maxWidthFrac: 0.84, centerFrac: 0.475 };
  }
}

const LIFT_START = 0.75;
const PER_WORD = 0.19;
const DURATION = 4.6;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F1EEE6"));
  const textColor = str(values.textColor, pc("textColor", "#14130F"));
  const accent = str(values.accent, pc("accent", "#B3261E"));
  const headline = str(values.headline, "They never tell you this part");
  const stamp = str(values.stamp, "").trim();
  const keepIndex = Math.round(num(values.keepRedacted, 0));
  const showStamp = on(values.showStamp);

  root.addChild(new Graphics().rect(0, 0, size.width, size.height).fill(bg));

  const L = layout(ctx.aspect);
  const cx = size.width / 2;
  const centerY = size.height * L.centerFrac;
  const maxWidth = size.width * L.maxWidthFrac;

  let fontSize = Math.round(size.width * L.fontFrac);
  let lineHeight = Math.round(fontSize * 1.34);
  const relayout = () =>
    layoutWords(headline, fonts, {
      role: "display",
      weight: 700,
      fontSize,
      lineHeight,
      maxWidth,
      align: "center",
      anchorX: cx,
      centerY,
    });
  let boxes = relayout();
  let lines = boxes.length ? Math.max(...boxes.map((b) => b.line)) + 1 : 1;
  for (let guard = 0; guard < 8 && lines * lineHeight > size.height * 0.56; guard++) {
    fontSize = Math.round(fontSize * 0.9);
    lineHeight = Math.round(fontSize * 1.34);
    boxes = relayout();
    lines = boxes.length ? Math.max(...boxes.map((b) => b.line)) + 1 : 1;
  }

  const timeline = new JimaTimeline();
  if (boxes.length === 0) return { timeline, duration: DURATION };

  // 0 means "reveal everything"; otherwise the nth word (1-based) stays covered.
  const keep = keepIndex > 0 && keepIndex <= boxes.length ? keepIndex - 1 : -1;
  const barPadX = fontSize * 0.14;
  const barH = fontSize * 0.92;

  boxes.forEach((box, i) => {
    const word = makeText(fonts, {
      text: box.text,
      role: "display",
      weight: 700,
      size: fontSize,
      color: textColor,
      anchor: 0.5,
    });
    word.position.set(box.cx, box.cy);
    root.addChild(word);

    const barW = box.width + barPadX * 2;
    // Each bar is its own container so the wipe can clip it without touching
    // the neighbours — a single shared mask would uncover them all at once.
    const holder = new Container();
    root.addChild(holder);
    const bar = new Graphics()
      .roundRect(-barW / 2, -barH / 2, barW, barH, fontSize * 0.05)
      .fill(i === keep ? accent : textColor);
    bar.position.set(box.cx, box.cy - fontSize * 0.06);
    holder.addChild(bar);

    // The kept word never loses its bar — no clip, no lift.
    if (i === keep) return;

    // The bar slides out sideways behind its own clip, so it looks lifted off
    // the page rather than fading.
    const clip = new Graphics()
      .rect(box.cx - barW / 2, box.cy - barH, barW, barH * 2)
      .fill("#FFFFFF");
    root.addChild(clip);
    holder.mask = clip;

    const at = LIFT_START + i * PER_WORD;
    const dir = i % 2 === 0 ? 1 : -1;
    timeline
      .to(holder, { prop: "x", from: 0, to: dir * (barW + fontSize * 0.2), start: at, duration: 0.5, ease: inOutQuint })
      .to(holder, { prop: "alpha", from: 1, to: 0, start: at + 0.34, duration: 0.18, ease: outQuad });

    // The word itself gives a small settle as its cover leaves.
    word.alpha = 0.999;
    timeline
      .to(word, { prop: "y", from: box.cy + fontSize * 0.07, to: box.cy, start: at + 0.1, duration: 0.55, ease: outExpo })
      .to(word, { prop: "alpha", from: 0.999, to: 1, start: at + 0.1, duration: 0.2, ease: outQuad });
  });

  const lastAt = LIFT_START + boxes.length * PER_WORD;

  if (showStamp && stamp.length > 0) {
    const stampSize = Math.round(size.width * 0.026);
    const label = makeText(fonts, {
      text: stamp.toUpperCase(),
      role: "body",
      weight: 800,
      size: stampSize,
      color: accent,
      anchor: 0.5,
      letterSpacing: stampSize * 0.16,
    });
    const padX = stampSize * 0.75;
    const padY = stampSize * 0.45;
    const w = label.width + padX * 2;
    const h = stampSize + padY * 2;
    const box = new Graphics()
      .roundRect(-w / 2, -h / 2, w, h, stampSize * 0.18)
      .stroke({ color: accent, width: Math.max(3, stampSize * 0.13) });
    const holder = new Container();
    holder.addChild(box, label);
    const top = Math.min(...boxes.map((b) => b.cy)) - lineHeight * 0.85;
    holder.position.set(cx, top);
    holder.rotation = -0.06;
    holder.alpha = 0;
    holder.scale.set(1.5);
    root.addChild(holder);
    timeline
      .to(holder, { prop: "alpha", from: 0, to: 1, start: 0.2, duration: 0.2, ease: outQuad })
      .to(holder, { prop: "scale.x", from: 1.5, to: 1, start: 0.2, duration: 0.45, ease: outExpo })
      .to(holder, { prop: "scale.y", from: 1.5, to: 1, start: 0.2, duration: 0.45, ease: outExpo });
  }

  const ruleY = Math.max(...boxes.map((b) => b.cy)) + lineHeight * 0.75;
  const ruleH = Math.max(2, Math.round(size.width * 0.002));
  const rule = new Graphics().rect(-maxWidth / 2, -ruleH / 2, maxWidth, ruleH).fill(textColor);
  rule.position.set(cx, ruleY);
  rule.alpha = 0.25;
  rule.scale.x = 0;
  root.addChild(rule);
  timeline.to(rule, { prop: "scale.x", from: 0, to: 1, start: lastAt * 0.5, duration: 1.1, ease: outQuint });

  return { timeline, duration: DURATION };
}

export const redactReveal: TemplateDefinition = {
  id: "redact-reveal",
  name: "Redacted",
  tagline: "The headline starts blacked out; the bars slide off word by word — keep one covered.",
  category: "statement",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "4:5",
  loopable: false,
  posterTime: 3.6,
  fontRoles: { headline: "display", stamp: "body" },
  palettes: PALETTES,
  fields: [
    {
      key: "headline",
      type: "text",
      label: "Headline",
      default: "They never tell you this part",
      maxLength: 70,
      shrinkToFit: true,
    },
    { key: "stamp", type: "text", label: "Stamp", default: "Declassified", maxLength: 22, optional: true },
    { key: "showStamp", type: "toggle", label: "Show stamp", default: true },
    {
      key: "keepRedacted",
      type: "slider",
      label: "Keep word redacted",
      default: 0,
      min: 0,
      max: 8,
      step: 1,
      help: "0 reveals everything. Otherwise the nth word stays covered.",
    },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text & bars", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
