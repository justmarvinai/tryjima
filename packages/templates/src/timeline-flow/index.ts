import { Container, Graphics, type Text } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  spring,
  type BuiltTemplate,
  type FontRegistry,
  type MakeTextOptions,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
  type Values,
} from "@jima/engine";
import { makePill } from "../shared/ui";

const str = (v: unknown, fallback: string): string => (typeof v === "string" && v.length > 0 ? v : fallback);
const asList = (v: unknown, fb: string[]): string[] => {
  if (Array.isArray(v)) {
    const a = v.filter((x): x is string => typeof x === "string" && x.length > 0);
    if (a.length) return a;
  }
  return fb;
};

function fitText(fonts: FontRegistry, opts: MakeTextOptions, maxWidth: number): Text {
  const t = makeText(fonts, opts);
  if (maxWidth > 0 && t.width > maxWidth) {
    const shrunk = Math.max(8, Math.floor(opts.size * (maxWidth / t.width)));
    if (shrunk < opts.size) return makeText(fonts, { ...opts, size: shrunk });
  }
  return t;
}

const DEFAULT_MILESTONES = ["Q1 | Launch", "Q2 | 10k users", "Q3 | New app"];
const PER_MILESTONE = 0.5;

interface Milestone {
  date: string;
  label: string;
}

const PALETTES: Palette[] = [
  { id: "ember", name: "Ember", colors: { background: "#FFFFFF", textColor: "#151016", accent: "#FF4D1C", onAccent: "#FFFFFF" } },
  { id: "grape", name: "Grape", colors: { background: "#F4F1FF", textColor: "#241452", accent: "#7C5CFF", onAccent: "#FFFFFF" } },
  { id: "ocean", name: "Ocean", colors: { background: "#EEF4FF", textColor: "#0B1F4D", accent: "#2E7DF6", onAccent: "#FFFFFF" } },
  { id: "midnight", name: "Midnight", colors: { background: "#101014", textColor: "#FAF5EA", accent: "#D8F34D", onAccent: "#101014" } },
];

function resolveMilestones(values: Values): Milestone[] {
  const items = asList(values.milestones, DEFAULT_MILESTONES).slice(0, 4);
  return items.map((it) => {
    const idx = it.indexOf("|");
    if (idx >= 0) {
      const date = it.slice(0, idx).trim();
      const label = it.slice(idx + 1).trim();
      return { date, label: label.length ? label : date };
    }
    return { date: "", label: it.trim() };
  });
}

function computeDuration(values: Values): number {
  return 1.0 + resolveMilestones(values).length * PER_MILESTONE + 1.2;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const aspect = ctx.aspect;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#151016"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const onAccent = pc("onAccent", "#FFFFFF");
  const title = str(values.title, "Our roadmap");
  const milestones = resolveMilestones(values);
  const n = milestones.length;
  const showConnector = values.connector !== false;

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  root.addChild(new Graphics().rect(0, 0, w, h).fill(bg));
  const timeline = new JimaTimeline();

  const horizontal = aspect === "16:9" || aspect === "1:1";

  // --- Title (centered) ---
  const titleY = h * (aspect === "16:9" ? 0.14 : aspect === "1:1" ? 0.13 : aspect === "9:16" ? 0.145 : 0.11);
  const titleSize = Math.round(minDim * (horizontal ? 0.05 : 0.056));
  const titleText = fitText(
    fonts,
    { text: title, role: "display", weight: 700, size: titleSize, color: textColor, anchor: 0.5, align: "center" },
    w - w * 0.16,
  );
  titleText.position.set(w / 2, titleY);
  titleText.alpha = 0;
  root.addChild(titleText);
  timeline
    .to(titleText, { prop: "alpha", from: 0, to: 1, start: 0.0, duration: 0.4, ease: outQuad })
    .to(titleText, { prop: "y", from: titleY - 16, to: titleY, start: 0.0, duration: 0.55, ease: outExpo });

  const Rdot = minDim * 0.022;
  const baseTh = Math.max(4, minDim * 0.008);
  const dateFont = Math.round(minDim * 0.028);
  const gapPL = minDim * 0.016;

  // --- Baseline (draws first) ---
  const baseStart = 0.45;
  const baseDur = 0.7;
  const dots: { x: number; y: number }[] = [];

  if (horizontal) {
    const marginX = w * 0.09;
    const x0 = marginX;
    const lineLen = w - marginX * 2;
    const baselineY = h * 0.52;
    const cellW = lineLen / n;

    const base = new Graphics().roundRect(0, -baseTh / 2, lineLen, baseTh, baseTh / 2).fill({ color: textColor, alpha: 0.16 });
    base.position.set(x0, baselineY);
    base.scale.set(0, 1);
    root.addChild(base);
    timeline.to(base, { prop: "scale.x", from: 0, to: 1, start: baseStart, duration: baseDur, ease: outExpo });

    for (let i = 0; i < n; i++) dots.push({ x: x0 + (i + 0.5) * cellW, y: baselineY });

    const stemLen = minDim * 0.055;
    const labelFont = Math.round(minDim * (aspect === "16:9" ? 0.034 : 0.038));

    milestones.forEach((m, i) => {
      const { x, y } = dots[i]!;
      const side = i % 2 === 0 ? -1 : 1; // above / below → zigzag
      const dotStart = 1.05 + i * PER_MILESTONE;

      // Stem.
      if (showConnector) {
        const stem = new Graphics();
        if (side < 0) stem.roundRect(-baseTh * 0.35, -stemLen, baseTh * 0.7, stemLen, baseTh * 0.35).fill({ color: accent, alpha: 0.7 });
        else stem.roundRect(-baseTh * 0.35, 0, baseTh * 0.7, stemLen, baseTh * 0.35).fill({ color: accent, alpha: 0.7 });
        stem.position.set(x, y);
        stem.scale.set(1, 0);
        root.addChild(stem);
        timeline.to(stem, { prop: "scale.y", from: 0, to: 1, start: dotStart + 0.1, duration: 0.3, ease: outExpo });
      }

      // Text block (pill + label), centered on x.
      const label = fitText(
        fonts,
        { text: m.label, role: "display", weight: 700, size: labelFont, color: textColor, anchor: 0.5, align: "center" },
        cellW * 0.92,
      );
      const labelH = label.height;
      const pillH = m.date ? Math.round(dateFont * 1.6) : 0;
      const blockH = (m.date ? pillH + gapPL : 0) + labelH;
      const topY = side < 0 ? y - stemLen - blockH : y + stemLen;

      const block = new Container();
      block.position.set(x, 0);
      block.alpha = 0;
      root.addChild(block);

      let pill: Container | null = null;
      if (m.date) {
        const dtext = makeText(fonts, { text: m.date, role: "body", weight: 700, size: dateFont, color: onAccent, anchor: 0.5, letterSpacing: 1 });
        const pw = dtext.width + dateFont * 0.9;
        pill = new Container();
        pill.addChild(makePill(pw, pillH, accent));
        pill.addChild(dtext);
        pill.position.set(0, topY + pillH / 2);
        pill.scale.set(0);
        block.addChild(pill);
      }
      label.position.set(0, topY + (m.date ? pillH + gapPL : 0) + labelH / 2);
      block.addChild(label);

      timeline.to(block, { prop: "alpha", from: 0, to: 1, start: dotStart + 0.25, duration: 0.35, ease: outQuad });
      if (pill) {
        timeline
          .to(pill, { prop: "scale.x", from: 0, to: 1, start: dotStart + 0.2, duration: 0.5, ease: spring(0.5) })
          .to(pill, { prop: "scale.y", from: 0, to: 1, start: dotStart + 0.2, duration: 0.5, ease: spring(0.5) });
      }
    });
  } else {
    const lineX = w * 0.16;
    const bandTop = aspect === "9:16" ? 380 : h * 0.27;
    const bandBot = aspect === "9:16" ? h - 430 : h * 0.9;
    const lineLen = bandBot - bandTop;
    const cellH = lineLen / n;

    const base = new Graphics().roundRect(-baseTh / 2, 0, baseTh, lineLen, baseTh / 2).fill({ color: textColor, alpha: 0.16 });
    base.position.set(lineX, bandTop);
    base.scale.set(1, 0);
    root.addChild(base);
    timeline.to(base, { prop: "scale.y", from: 0, to: 1, start: baseStart, duration: baseDur, ease: outExpo });

    for (let i = 0; i < n; i++) dots.push({ x: lineX, y: bandTop + (i + 0.5) * cellH });

    const labelX = lineX + Rdot + minDim * 0.03;
    const labelMaxW = w - w * 0.06 - labelX;
    const labelFont = Math.round(w * 0.05);

    milestones.forEach((m, i) => {
      const { x, y } = dots[i]!;
      const dotStart = 1.05 + i * PER_MILESTONE;

      // Stem (horizontal, dot → label block).
      if (showConnector) {
        const stemLen = labelX - (x + Rdot) - minDim * 0.012;
        const stem = new Graphics().roundRect(0, -baseTh * 0.35, stemLen, baseTh * 0.7, baseTh * 0.35).fill({ color: accent, alpha: 0.7 });
        stem.position.set(x + Rdot, y);
        stem.scale.set(0, 1);
        root.addChild(stem);
        timeline.to(stem, { prop: "scale.x", from: 0, to: 1, start: dotStart + 0.1, duration: 0.3, ease: outExpo });
      }

      const label = fitText(
        fonts,
        { text: m.label, role: "display", weight: 700, size: labelFont, color: textColor, anchor: { x: 0, y: 0.5 } },
        labelMaxW,
      );
      const labelH = label.height;
      const pillH = m.date ? Math.round(dateFont * 1.6) : 0;
      const blockH = (m.date ? pillH + gapPL : 0) + labelH;
      const topY = y - blockH / 2;

      const block = new Container();
      block.position.set(labelX, 0);
      block.alpha = 0;
      root.addChild(block);

      let pill: Container | null = null;
      if (m.date) {
        const dtext = makeText(fonts, { text: m.date, role: "body", weight: 700, size: dateFont, color: onAccent, anchor: 0.5, letterSpacing: 1 });
        const pw = dtext.width + dateFont * 0.9;
        pill = new Container();
        pill.addChild(makePill(pw, pillH, accent));
        pill.addChild(dtext);
        pill.position.set(pw / 2, topY + pillH / 2);
        pill.scale.set(0);
        block.addChild(pill);
      }
      label.position.set(0, topY + (m.date ? pillH + gapPL : 0) + labelH / 2);
      block.addChild(label);

      timeline.to(block, { prop: "alpha", from: 0, to: 1, start: dotStart + 0.25, duration: 0.35, ease: outQuad });
      if (pill) {
        timeline
          .to(pill, { prop: "scale.x", from: 0, to: 1, start: dotStart + 0.2, duration: 0.5, ease: spring(0.5) })
          .to(pill, { prop: "scale.y", from: 0, to: 1, start: dotStart + 0.2, duration: 0.5, ease: spring(0.5) });
      }
    });
  }

  // --- Dots (on top of the baseline) ---
  dots.forEach((d, i) => {
    const dotStart = 1.05 + i * PER_MILESTONE;
    const dot = new Container();
    dot.position.set(d.x, d.y);
    dot.addChild(new Graphics().circle(0, 0, Rdot * 1.7).fill(bg)); // halo cuts the baseline
    dot.addChild(new Graphics().circle(0, 0, Rdot).fill(accent));
    dot.addChild(new Graphics().circle(0, 0, Rdot * 0.4).fill(bg)); // center → target look
    dot.scale.set(0);
    root.addChild(dot);
    timeline
      .to(dot, { prop: "scale.x", from: 0, to: 1, start: dotStart, duration: 0.6, ease: spring(0.45) })
      .to(dot, { prop: "scale.y", from: 0, to: 1, start: dotStart, duration: 0.6, ease: spring(0.45) });
  });

  return { timeline, duration: computeDuration(values) };
}

export const timelineFlow: TemplateDefinition = {
  id: "timeline-flow",
  name: "Timeline Flow",
  tagline: "Milestones pop in along a drawn timeline.",
  category: "educational",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 2.8,
  estimateDuration: computeDuration,
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Title", default: "Our roadmap", maxLength: 40, shrinkToFit: true },
    { key: "milestones", type: "textlist", label: "Milestones", default: DEFAULT_MILESTONES, minItems: 2, maxItems: 4, maxLength: 32, help: "Use \"date | label\", e.g. \"Q1 | Launch\"." },
    { key: "connector", type: "toggle", label: "Connector line", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
