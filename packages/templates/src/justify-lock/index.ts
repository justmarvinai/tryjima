import { Container, Graphics, type Text } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  inOutQuint,
  outExpo,
  outQuad,
  type Aspect,
  type BuiltTemplate,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";

// Justify Lock — the headline arrives ragged, then each line stretches or
// compresses horizontally until every line hits the same measure, snapping the
// block into a hard-justified rectangle. It is the one piece of typographic
// craft the library did not have: `spacing-expand` opens tracking uniformly on
// one line; this re-fits *each line independently* to a shared width, which is
// what justification actually is.

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;

const PALETTES: Palette[] = [
  { id: "editorial", name: "Editorial", colors: { background: "#F4F2ED", textColor: "#141414", accent: "#B4472B" } },
  { id: "ink", name: "Ink", colors: { background: "#101010", textColor: "#F6F4EF", accent: "#D8C48A" } },
  { id: "navy", name: "Navy", colors: { background: "#EAEEF5", textColor: "#0E1B2E", accent: "#1E4FA3" } },
  { id: "olive", name: "Olive", colors: { background: "#EFEEE3", textColor: "#1E2016", accent: "#5C6B2F" } },
];

interface Layout {
  measureFrac: number;
  lineFrac: number;
  centerFrac: number;
}

function layout(aspect: Aspect): Layout {
  switch (aspect) {
    case "16:9":
      return { measureFrac: 0.6, lineFrac: 0.115, centerFrac: 0.48 };
    case "9:16":
      return { measureFrac: 0.8, lineFrac: 0.135, centerFrac: 0.46 };
    case "4:5":
      return { measureFrac: 0.78, lineFrac: 0.128, centerFrac: 0.47 };
    case "1:1":
    default:
      return { measureFrac: 0.76, lineFrac: 0.128, centerFrac: 0.47 };
  }
}

const LINE_IN = 0.3;
const LINE_STAGGER = 0.13;
const LOCK_START = 1.15;
const LOCK_DUR = 0.9;
const DURATION = 4.2;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F4F2ED"));
  const textColor = str(values.textColor, pc("textColor", "#141414"));
  const accent = str(values.accent, pc("accent", "#B4472B"));
  const raw = Array.isArray(values.lines) ? (values.lines as unknown[]) : [];
  const lines = raw.map((v) => String(v ?? "").trim().toUpperCase()).filter((s) => s.length > 0).slice(0, 5);
  const kicker = str(values.kicker, "").trim();
  const showRules = on(values.showRules);

  root.addChild(new Graphics().rect(0, 0, size.width, size.height).fill(bg));

  const timeline = new JimaTimeline();
  if (lines.length === 0) return { timeline, duration: DURATION };

  const L = layout(ctx.aspect);
  const cx = size.width / 2;
  const measure = size.width * L.measureFrac;
  const lineH = size.height * L.lineFrac;
  const blockTop = size.height * L.centerFrac - (lines.length * lineH) / 2;

  // Every line is set at the size that would make the *longest* line fill the
  // measure, so the justification is achieved by horizontal scaling rather than
  // by tracking — the point is that the type visibly stretches.
  const probe = Math.round(lineH * 0.78);
  const style = { family: fonts.family("display"), weight: 800, size: probe };
  const natural = lines.map((s) => Math.max(1, fonts.measure(s, style)));
  const longest = Math.max(...natural);
  const fontSize = Math.round((probe * measure) / longest);
  const finalWidths = natural.map((w) => (w * fontSize) / probe);

  const kickerY = blockTop - lineH * 0.55;
  if (kicker.length > 0) {
    const k = makeText(fonts, {
      text: kicker.toUpperCase(),
      role: "body",
      weight: 700,
      size: Math.round(size.width * 0.019),
      color: accent,
      anchor: { x: 0, y: 0.5 },
      letterSpacing: size.width * 0.004,
    });
    k.position.set(cx - measure / 2, kickerY);
    k.alpha = 0;
    root.addChild(k);
    timeline
      .to(k, { prop: "alpha", from: 0, to: 1, start: 0.1, duration: 0.4, ease: outQuad })
      .to(k, { prop: "x", from: cx - measure / 2 - size.width * 0.03, to: cx - measure / 2, start: 0.1, duration: 0.7, ease: outExpo });
  }

  lines.forEach((line, i) => {
    const y = blockTop + lineH * (i + 0.5);
    // Anchored on the left edge of the measure so scale.x stretches rightward
    // into the justified rectangle rather than growing from the centre.
    const holder = new Container();
    holder.position.set(cx - measure / 2, y);
    root.addChild(holder);

    const t: Text = makeText(fonts, {
      text: line,
      role: "display",
      weight: 800,
      size: fontSize,
      color: textColor,
      anchor: { x: 0, y: 0.5 },
    });
    holder.addChild(t);

    const ragged = finalWidths[i]! / measure;
    holder.scale.x = ragged;
    holder.alpha = 0;
    const inAt = LINE_IN + i * LINE_STAGGER;
    timeline
      .to(holder, { prop: "alpha", from: 0, to: 1, start: inAt, duration: 0.45, ease: outQuad })
      .to(holder, { prop: "y", from: y + lineH * 0.35, to: y, start: inAt, duration: 0.7, ease: outExpo })
      // The lock: each line's own ragged ratio is driven to exactly 1.
      .to(holder, {
        prop: "scale.x",
        from: ragged,
        to: 1,
        start: LOCK_START + i * 0.06,
        duration: LOCK_DUR,
        ease: inOutQuint,
      });
  });

  if (showRules) {
    const ruleH = Math.max(2, Math.round(size.width * 0.0018));
    for (let i = 0; i <= lines.length; i++) {
      const y = blockTop + lineH * i;
      const rule = new Graphics().rect(0, -ruleH / 2, measure, ruleH).fill(accent);
      rule.position.set(cx - measure / 2, y);
      rule.alpha = i === 0 || i === lines.length ? 0.9 : 0.22;
      rule.scale.x = 0;
      root.addChild(rule);
      timeline.to(rule, {
        prop: "scale.x",
        from: 0,
        to: 1,
        start: LOCK_START + LOCK_DUR * 0.35 + i * 0.05,
        duration: 0.7,
        ease: outExpo,
      });
    }
  }

  return { timeline, duration: DURATION };
}

export const justifyLock: TemplateDefinition = {
  id: "justify-lock",
  name: "Justify Lock",
  tagline: "Ragged lines stretch until every one hits the same measure and the block locks.",
  category: "statement",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "4:5",
  loopable: false,
  posterTime: 3.2,
  fontRoles: { headline: "display", kicker: "body" },
  palettes: PALETTES,
  fields: [
    {
      key: "lines",
      type: "textlist",
      label: "Lines",
      default: ["Set it", "flush", "both sides"],
      minItems: 1,
      maxItems: 5,
      maxLength: 22,
    },
    { key: "kicker", type: "text", label: "Kicker", default: "Typography", maxLength: 24, optional: true },
    { key: "showRules", type: "toggle", label: "Measure rules", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  estimateDuration: () => DURATION,
  build,
};
