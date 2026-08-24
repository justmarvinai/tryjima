import { Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outCubic,
  outExpo,
  outQuint,
  type Aspect,
  type BuiltTemplate,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { layoutWords, type WordBox } from "../shared/words";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;

const PALETTES: Palette[] = [
  { id: "ink-white", name: "Ink on white", colors: { background: "#FFFFFF", textColor: "#101014", accent: "#FF4D1C" } },
  { id: "cream", name: "Cream", colors: { background: "#FAF5EA", textColor: "#1A1512", accent: "#FF4D1C" } },
  { id: "night", name: "Night", colors: { background: "#101014", textColor: "#FFFFFF", accent: "#D8F34D" } },
  { id: "ocean", name: "Ocean", colors: { background: "#E9F1F5", textColor: "#0B2A38", accent: "#FF4D1C" } },
];

interface L {
  headFrac: number;
  kickerFrac: number;
  maxWidthFrac: number;
  centerYFrac: number;
}

function layout(aspect: Aspect): L {
  switch (aspect) {
    case "16:9":
      return { headFrac: 0.082, kickerFrac: 0.026, maxWidthFrac: 0.74, centerYFrac: 0.52 };
    case "9:16":
      return { headFrac: 0.11, kickerFrac: 0.034, maxWidthFrac: 0.82, centerYFrac: 0.5 };
    case "4:5":
      return { headFrac: 0.1, kickerFrac: 0.032, maxWidthFrac: 0.82, centerYFrac: 0.51 };
    case "1:1":
    default:
      return { headFrac: 0.098, kickerFrac: 0.03, maxWidthFrac: 0.82, centerYFrac: 0.51 };
  }
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const headline = str(values.headline, "Room to breathe");
  // Optional kicker: respect an explicit empty string (hide) vs. unset (default).
  const kickerRaw = typeof values.kicker === "string" ? values.kicker : "INTRODUCING";
  const kicker = kickerRaw.trim().toUpperCase();

  root.addChild(new Graphics().rect(0, 0, size.width, size.height).fill(bg));
  const L = layout(ctx.aspect);
  const cx = size.width / 2;
  const centerY = size.height * L.centerYFrac;
  const maxWidth = size.width * L.maxWidthFrac;

  // --- Headline: wrap + shrink so it never overflows the airy centre block ---
  let headSize = Math.round(size.width * L.headFrac);
  let lineHeight = Math.round(headSize * 1.12);
  const relayout = (): WordBox[] =>
    layoutWords(headline, fonts, {
      role: "display",
      weight: 700,
      fontSize: headSize,
      lineHeight,
      maxWidth,
      align: "center",
      anchorX: cx,
      centerY,
    });
  let boxes = relayout();
  const maxBlockH = size.height * 0.42;
  let lineCount = boxes.length ? Math.max(...boxes.map((b) => b.line)) + 1 : 1;
  for (let g = 0; g < 8 && lineCount * lineHeight > maxBlockH; g++) {
    headSize = Math.round(headSize * 0.9);
    lineHeight = Math.round(headSize * 1.12);
    boxes = relayout();
    lineCount = boxes.length ? Math.max(...boxes.map((b) => b.line)) + 1 : 1;
  }

  const timeline = new JimaTimeline();
  const lineIdx = [...new Set(boxes.map((b) => b.line))].sort((a, b) => a - b);
  const wordsByLine = new Map<number, string[]>();
  for (const b of boxes) {
    const arr = wordsByLine.get(b.line);
    if (arr) arr.push(b.text);
    else wordsByLine.set(b.line, [b.text]);
  }

  // --- Each headline line drifts up, fades in, and its tracking eases open ---
  const drift = headSize * 0.5;
  const finalHeadLS = headSize * 0.03; // very slight
  const headStart = 0.7;
  lineIdx.forEach((li) => {
    const lineText = (wordsByLine.get(li) ?? []).join(" ");
    const cy = boxes.find((b) => b.line === li)?.cy ?? centerY;
    const t = makeText(fonts, {
      text: lineText,
      role: "display",
      weight: 700,
      size: headSize,
      color: textColor,
      anchor: 0.5,
      align: "center",
      letterSpacing: 0,
    });
    t.position.set(cx, cy);
    t.alpha = 0;
    root.addChild(t);
    timeline
      .to(t, { prop: "alpha", from: 0, to: 1, start: headStart, duration: 0.8, ease: outCubic })
      .to(t, { prop: "y", from: cy + drift, to: cy, start: headStart, duration: 1.0, ease: outQuint })
      .to(t, { prop: "style.letterSpacing", from: 0, to: finalHeadLS, start: headStart, duration: 1.0, ease: outExpo });
  });

  const topCy = Math.min(...boxes.map((b) => b.cy));
  const bottomCy = Math.max(...boxes.map((b) => b.cy));

  // --- Kicker: small caps, tracking expands wide as it fades in (premium) ---
  if (kicker.length > 0) {
    const kSize = Math.max(12, Math.round(size.width * L.kickerFrac));
    const kickerY = topCy - headSize * 0.5 - kSize * 1.7;
    const finalKickerLS = kSize * 0.35;
    const kText = makeText(fonts, {
      text: kicker,
      role: "body",
      weight: 600,
      size: kSize,
      color: textColor,
      anchor: 0.5,
      align: "center",
      letterSpacing: 0,
    });
    kText.position.set(cx, kickerY);
    kText.alpha = 0;
    root.addChild(kText);
    const kStart = 0.3;
    timeline
      .to(kText, { prop: "alpha", from: 0, to: 1, start: kStart, duration: 0.7, ease: outCubic })
      .to(kText, { prop: "style.letterSpacing", from: 0, to: finalKickerLS, start: kStart, duration: 1.0, ease: outExpo });
  }

  // --- A thin accent rule draws open beneath the block as a quiet finish ---
  const showAccentBar = values.accentBar !== false;
  if (showAccentBar) {
    const ruleY = bottomCy + headSize * 0.55;
    const ruleW = headSize * 1.6;
    const ruleH = Math.max(2, Math.round(headSize * 0.05));
    const rule = new Graphics().roundRect(-ruleW / 2, -ruleH / 2, ruleW, ruleH, ruleH / 2).fill(accent);
    rule.position.set(cx, ruleY);
    rule.scale.set(0, 1);
    rule.alpha = 0;
    root.addChild(rule);
    const ruleStart = headStart + 0.55;
    timeline
      .to(rule, { prop: "alpha", from: 0, to: 1, start: ruleStart, duration: 0.5, ease: outCubic })
      .to(rule, { prop: "scale.x", from: 0, to: 1, start: ruleStart, duration: 0.7, ease: outExpo });
  }

  return { timeline, duration: 3.4 };
}

export const spacingExpand: TemplateDefinition = {
  id: "spacing-expand",
  name: "Spacing Expand",
  tagline: "A letterspaced kicker opens wide above an airy headline.",
  category: "statement",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 2.4,
  fontRoles: { kicker: "body", headline: "display" },
  palettes: PALETTES,
  fields: [
    { key: "kicker", type: "text", label: "Kicker", default: "INTRODUCING", maxLength: 28, optional: true },
    { key: "headline", type: "text", label: "Headline", default: "Room to breathe", maxLength: 44, shrinkToFit: true },
    { key: "accentBar", type: "toggle", label: "Accent bar", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
