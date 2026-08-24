import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  composeUpdates,
  outCubic,
  outExpo,
  makeOutBack,
  squashStretch,
  type Aspect,
  type BuiltTemplate,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { layoutChars } from "../shared/words";

const str = (v: unknown, fallback: string): string => (typeof v === "string" && v.length > 0 ? v : fallback);

const PALETTES: Palette[] = [
  { id: "ink-white", name: "Ink on white", colors: { background: "#FFFFFF", textColor: "#101014", accent: "#FF4D1C" } },
  { id: "cream", name: "Cream", colors: { background: "#FAF5EA", textColor: "#1A1512", accent: "#FF4D1C" } },
  { id: "night", name: "Night", colors: { background: "#101014", textColor: "#FFFFFF", accent: "#D8F34D" } },
  { id: "violet", name: "Violet", colors: { background: "#F3EEFF", textColor: "#2A1A5E", accent: "#7C5CFF" } },
];

function fontFrac(aspect: Aspect): number {
  return aspect === "16:9" ? 0.084 : aspect === "9:16" ? 0.118 : 0.102;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string) => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const headline = str(values.headline, "Drop the beat");
  const showAccentBar = values.accentBar !== false;
  const squashOn = values.squash !== false;

  root.addChild(new Graphics().rect(0, 0, size.width, size.height).fill(bg));

  const fontSize = Math.round(size.width * fontFrac(ctx.aspect));
  const lineHeight = Math.round(fontSize * 1.14);
  const content = new Container();
  root.addChild(content);

  const boxes = layoutChars(headline, fonts, {
    role: "display",
    weight: 700,
    fontSize,
    lineHeight,
    maxWidth: size.width * 0.84,
    align: "center",
    anchorX: size.width / 2,
    centerY: size.height * 0.46,
  });

  const timeline = new JimaTimeline();
  const perChar = 0.03;
  const dropDist = size.height * 0.5;
  const settle = makeOutBack(1.6); // soft bounce on landing
  const squash: ((t: number) => void)[] = [];
  boxes.forEach((box) => {
    const t = makeText(fonts, { text: box.char, role: "display", weight: 700, size: fontSize, color: textColor, anchor: 0.5 });
    t.position.set(box.cx, box.cy);
    t.alpha = 0;
    content.addChild(t);
    const start = 0.3 + box.index * perChar;
    timeline
      .to(t, { prop: "alpha", from: 0, to: 1, start, duration: 0.28, ease: outCubic })
      .to(t, { prop: "y", from: box.cy - dropDist, to: box.cy, start, duration: 0.62, ease: settle });
    // A falling glyph thins and lengthens, then rounds out as it lands — the
    // oldest read in animation for "this has weight".
    if (squashOn) squash.push(squashStretch(timeline, t, { amount: 0.16 }));
  });

  const lastIndex = boxes.length ? boxes[boxes.length - 1]!.index : 0;

  // A quiet accent baseline draws in once every glyph has landed.
  if (boxes.length && showAccentBar) {
    const bottom = Math.max(...boxes.map((b) => b.cy)) + fontSize * 0.64;
    const left = Math.min(...boxes.map((b) => b.cx - b.width / 2));
    const right = Math.max(...boxes.map((b) => b.cx + b.width / 2));
    const cxMid = (left + right) / 2;
    const ruleW = Math.min(right - left, size.width * 0.22);
    const rule = new Graphics().roundRect(-ruleW / 2, 0, ruleW, Math.max(3, fontSize * 0.06), 2).fill(accent);
    rule.position.set(cxMid, bottom);
    rule.alpha = 0;
    rule.scale.set(0.3, 1);
    content.addChild(rule);
    const ruleStart = 0.3 + lastIndex * perChar + 0.15;
    timeline
      .to(rule, { prop: "alpha", from: 0, to: 1, start: ruleStart, duration: 0.5, ease: outCubic })
      .to(rule, { prop: "scale.x", from: 0.3, to: 1, start: ruleStart, duration: 0.6, ease: outExpo });
  }

  const update = composeUpdates(...squash);
  return { timeline, duration: Math.max(2.8, 0.3 + lastIndex * perChar + 1.4), ...(update ? { update } : {}) };
}

export const dropLetters: TemplateDefinition = {
  id: "drop-letters",
  name: "Drop Letters",
  tagline: "Letters fall in from above and settle with a soft bounce.",
  category: "statement",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 2.2,
  palettes: PALETTES,
  fields: [
    { key: "headline", type: "text", label: "Headline", default: "Drop the beat", maxLength: 44, shrinkToFit: true },
    { key: "accentBar", type: "toggle", label: "Accent bar", default: true },
    { key: "squash", type: "toggle", label: "Squash & stretch", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
