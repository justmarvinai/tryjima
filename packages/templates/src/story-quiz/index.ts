import { Container, Graphics, type Text } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  spring,
  makeOutBack,
  shrinkToFit,
  safeRect,
  type BuiltTemplate,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { makeIcon } from "../shared/icons";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const num = (v: unknown, fallback: number): number => (typeof v === "number" ? v : fallback);
const asItems = (v: unknown, fallback: string[]): string[] => {
  if (Array.isArray(v)) {
    const arr = v.filter((s): s is string => typeof s === "string" && s.length > 0);
    if (arr.length) return arr;
  }
  return fallback;
};

const PALETTES: Palette[] = [
  { id: "sunny", name: "Sunny", colors: { background: "#F2F0FF", textColor: "#1A1330", accent: "#5B3DF5", chipBg: "#FFFFFF", muted: "#DCD8F5", onAccent: "#FFFFFF" } },
  { id: "hot-pink", name: "Hot pink", colors: { background: "#FF5B72", textColor: "#3A0A12", accent: "#FF5B72", chipBg: "#FFFFFF", muted: "#FFD2D8", onAccent: "#FFFFFF" } },
  { id: "midnight", name: "Midnight", colors: { background: "#14151F", textColor: "#FFFFFF", accent: "#7C5CFF", chipBg: "#22232F", muted: "#3D3E4C", onAccent: "#FFFFFF" } },
  { id: "mint-pop", name: "Mint pop", colors: { background: "#0EA36B", textColor: "#04231A", accent: "#0EA36B", chipBg: "#FFFFFF", muted: "#CDF2E5", onAccent: "#FFFFFF" } },
];

interface Chip {
  c: Container;
  fillOverlay: Graphics;
  check: Graphics;
  label: Text;
  ring?: Graphics;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F2F0FF"));
  const textColor = str(values.textColor, pc("textColor", "#1A1330"));
  const accent = str(values.accent, pc("accent", "#5B3DF5"));
  const chipBg = pc("chipBg", "#FFFFFF");
  const muted = pc("muted", "#DCD8F5");
  const onAccent = pc("onAccent", "#FFFFFF");

  const question = str(values.question, "Which is bigger?");
  const options = asItems(values.options, ["The Sun", "The Moon"]).slice(0, 4);
  const n = Math.max(2, options.length);
  const correctIdx = Math.min(n, Math.max(1, Math.round(num(values.correct, 1)))) - 1;

  const bgRect = new Graphics().rect(0, 0, size.width, size.height).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();
  const minDim = Math.min(size.width, size.height);
  const safe = safeRect(ctx.aspect);
  const cx = size.width / 2;

  const familyDisplay = fonts.family("display");
  const measure = (s: string, sz: number): number => fonts.measure(s, { family: familyDisplay, weight: 700, size: sz });

  const clusterW = Math.min(safe.width * 0.94, minDim * 0.82);

  // --- Question pill ---
  const qBase = Math.round(minDim * 0.05);
  const qPadX = Math.round(minDim * 0.05);
  const qPadY = Math.round(minDim * 0.032);
  const qSize = shrinkToFit(question, measure, { maxWidth: clusterW - qPadX * 2, baseSize: qBase, minSize: Math.round(qBase * 0.55) });
  const qWidth = Math.min(measure(question, qSize) + qPadX * 2, clusterW);
  const qHeight = qSize + qPadY * 2;

  // --- Option chips (height eases down as more options are added) ---
  const chipFontBase = Math.round(minDim * (n >= 4 ? 0.036 : n === 3 ? 0.039 : 0.042));
  const chipH = Math.round(minDim * (n >= 4 ? 0.115 : n === 3 ? 0.13 : 0.145));
  const chipGap = Math.round(chipH * 0.22);
  const chipW = clusterW;
  const chipRadius = chipH * 0.28;

  const gapQA = Math.round(minDim * 0.045);
  const totalH = qHeight + gapQA + n * chipH + (n - 1) * chipGap;
  const top = safe.y + safe.height / 2 - totalH / 2;
  const qCenterY = top + qHeight / 2;
  const chipCenterY = (i: number): number => top + qHeight + gapQA + chipH * i + chipGap * i + chipH / 2;

  const qPill = new Container();
  qPill.addChild(new Graphics().roundRect(-qWidth / 2, -qHeight / 2, qWidth, qHeight, qHeight / 2).fill(chipBg));
  qPill.addChild(makeText(fonts, { text: question, role: "display", weight: 700, size: qSize, color: textColor, anchor: 0.5, align: "center" }));
  qPill.position.set(cx, qCenterY + 36);
  qPill.alpha = 0;
  qPill.scale.set(0.7);
  root.addChild(qPill);
  timeline
    .to(qPill, { prop: "alpha", from: 0, to: 1, start: 0.1, duration: 0.3, ease: outQuad })
    .to(qPill, { prop: "scale.x", from: 0.7, to: 1, start: 0.1, duration: 0.55, ease: spring(0.45) })
    .to(qPill, { prop: "scale.y", from: 0.7, to: 1, start: 0.1, duration: 0.55, ease: spring(0.45) })
    .to(qPill, { prop: "y", from: qCenterY + 36, to: qCenterY, start: 0.1, duration: 0.55, ease: outExpo });

  // --- Option chips ---
  const chips: Chip[] = [];
  const chipFitLabel = (text: string): number =>
    shrinkToFit(text, measure, { maxWidth: chipW - qPadX * 2 - chipFontBase * 1.8, baseSize: chipFontBase, minSize: Math.round(chipFontBase * 0.6) });

  options.forEach((opt, i) => {
    const c = new Container();
    c.addChild(
      new Graphics()
        .roundRect(-chipW / 2, -chipH / 2, chipW, chipH, chipRadius)
        .fill(chipBg)
        .stroke({ color: muted, width: Math.max(1, chipH * 0.012) }),
    );

    // Accent fill overlay, revealed only for the correct chip.
    const fillOverlay = new Graphics().roundRect(-chipW / 2, -chipH / 2, chipW, chipH, chipRadius).fill(accent);
    fillOverlay.alpha = 0;
    c.addChild(fillOverlay);

    const labelSize = chipFitLabel(opt);
    const labelText = makeText(fonts, { text: opt, role: "display", weight: 700, size: labelSize, color: textColor, anchor: { x: 0, y: 0.5 } });
    labelText.position.set(-chipW / 2 + qPadX, 0);
    c.addChild(labelText);

    const checkSize = chipH * 0.38;
    const check = makeIcon("check", checkSize, { color: onAccent });
    check.position.set(chipW / 2 - qPadX - checkSize * 0.5, 0);
    check.scale.set(0);
    c.addChild(check);

    let ring: Graphics | undefined;
    if (i === correctIdx) {
      const ringPad = Math.max(3, chipH * 0.045);
      ring = new Graphics()
        .roundRect(-chipW / 2 - ringPad, -chipH / 2 - ringPad, chipW + ringPad * 2, chipH + ringPad * 2, chipRadius + ringPad)
        .stroke({ color: accent, width: Math.max(2, chipH * 0.03) });
      ring.alpha = 0;
      c.addChild(ring);
    }

    const rowY = chipCenterY(i);
    c.position.set(cx, rowY + 40);
    c.alpha = 0;
    c.scale.set(0.85);
    root.addChild(c);

    const start = 0.35 + i * 0.16;
    timeline
      .to(c, { prop: "alpha", from: 0, to: 1, start, duration: 0.3, ease: outQuad })
      .to(c, { prop: "scale.x", from: 0.85, to: 1, start, duration: 0.55, ease: spring(0.42) })
      .to(c, { prop: "scale.y", from: 0.85, to: 1, start, duration: 0.55, ease: spring(0.42) })
      .to(c, { prop: "y", from: rowY + 40, to: rowY, start, duration: 0.55, ease: outExpo });

    chips.push(ring ? { c, fillOverlay, check, label: labelText, ring } : { c, fillOverlay, check, label: labelText });
  });

  // --- Reveal beat: the correct chip fills + checks; the rest dim slightly ---
  const lastStart = 0.35 + (n - 1) * 0.16;
  const REVEAL_AT = lastStart + 0.55 + 0.35;
  chips.forEach((chip, i) => {
    if (i === correctIdx) {
      timeline
        .to(chip.fillOverlay, { prop: "alpha", from: 0, to: 1, start: REVEAL_AT, duration: 0.3, ease: outQuad })
        .to(chip.check, { prop: "scale.x", from: 0, to: 1, start: REVEAL_AT + 0.1, duration: 0.4, ease: makeOutBack(2) })
        .to(chip.check, { prop: "scale.y", from: 0, to: 1, start: REVEAL_AT + 0.1, duration: 0.4, ease: makeOutBack(2) })
        .to(chip.c, { prop: "scale.x", from: 1, to: 1.045, start: REVEAL_AT, duration: 0.16, ease: outQuad })
        .to(chip.c, { prop: "scale.y", from: 1, to: 1.045, start: REVEAL_AT, duration: 0.16, ease: outQuad })
        .to(chip.c, { prop: "scale.x", from: 1.045, to: 1, start: REVEAL_AT + 0.16, duration: 0.28, ease: outQuad })
        .to(chip.c, { prop: "scale.y", from: 1.045, to: 1, start: REVEAL_AT + 0.16, duration: 0.28, ease: outQuad });
      if (chip.ring) {
        timeline.to(chip.ring, { prop: "alpha", from: 0, to: 1, start: REVEAL_AT, duration: 0.3, ease: outQuad });
      }
    } else {
      timeline.to(chip.c, { prop: "alpha", from: 1, to: 0.6, start: REVEAL_AT, duration: 0.35, ease: outQuad });
    }
  });

  // Recolor the correct chip's label onto the accent fill once it reveals. Pure in
  // t (recomputed fresh each call) with a cache so the (expensive) style write only
  // happens on the frame the value actually changes — mirrors text-scramble's idiom.
  const correctLabel = chips[correctIdx]?.label;
  const RECOLOR_AT = REVEAL_AT + 0.05;
  let appliedColor = textColor;
  const update = correctLabel
    ? (t: number): void => {
        const wantColor = t >= RECOLOR_AT ? onAccent : textColor;
        if (appliedColor !== wantColor) {
          correctLabel.style.fill = wantColor;
          appliedColor = wantColor;
        }
      }
    : undefined;

  return update ? { timeline, duration: 4.4, update } : { timeline, duration: 4.4 };
}

export const storyQuiz: TemplateDefinition = {
  id: "story-quiz",
  name: "Story Quiz",
  tagline: "A quiz sticker's options settle in, then the right answer lights up.",
  category: "social",
  aspects: ["9:16", "1:1", "4:5", "16:9"],
  defaultAspect: "9:16",
  loopable: false,
  posterTime: 3.4,
  fontRoles: { question: "display" },
  palettes: PALETTES,
  fields: [
    { key: "question", type: "text", label: "Question", default: "Which is bigger?", maxLength: 40, shrinkToFit: true },
    { key: "options", type: "textlist", label: "Options", default: ["The Sun", "The Moon"], minItems: 2, maxItems: 4, maxLength: 22 },
    { key: "correct", type: "slider", label: "Correct option", default: 1, min: 1, max: 4, step: 1, help: "Which option (1-4) highlights as correct." },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
