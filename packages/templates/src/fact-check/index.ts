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
import { makeIcon } from "../shared/icons";

// Source Card — the citation overlay: a verdict chip (True / Misleading /
// Needs context), the claim, and where it came from. It slides in from the edge
// while the claim is on screen, which is exactly when a viewer wants it.
//
// `key-point` states a takeaway and `alert-banner` shouts; neither carries a
// source. This one exists to make a claim checkable, so the source line is a
// first-class field, not a footnote.

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;

const PALETTES: Palette[] = [
  { id: "verified", name: "Verified", colors: { background: "#0E1116", textColor: "#F3F5F8", accent: "#22C55E" } },
  { id: "caution", name: "Caution", colors: { background: "#16120A", textColor: "#FAF6EC", accent: "#F59E0B" } },
  { id: "false", name: "False", colors: { background: "#160E10", textColor: "#FAF0F1", accent: "#EF4444" } },
  { id: "paper", name: "Paper", colors: { background: "#F5F4F0", textColor: "#14161A", accent: "#2563EB" } },
];

interface Layout {
  cardFrac: number;
  sideFrac: number;
  claimFrac: number;
  centerFrac: number;
}

function layout(aspect: Aspect): Layout {
  switch (aspect) {
    case "16:9":
      return { cardFrac: 0.42, sideFrac: 0.06, claimFrac: 0.03, centerFrac: 0.68 };
    case "9:16":
      return { cardFrac: 0.86, sideFrac: 0.07, claimFrac: 0.042, centerFrac: 0.7 };
    case "4:5":
      return { cardFrac: 0.84, sideFrac: 0.08, claimFrac: 0.038, centerFrac: 0.7 };
    case "1:1":
    default:
      return { cardFrac: 0.8, sideFrac: 0.1, claimFrac: 0.038, centerFrac: 0.7 };
  }
}

const IN_AT = 0.3;
const DURATION = 5.2;

/** Greedy wrap for the claim, capped at three lines by shrinking. */
function wrap(text: string, measure: (s: string, size: number) => number, size: number, maxWidth: number) {
  let s = size;
  for (let guard = 0; guard < 12; guard++) {
    const words = text.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let cur = "";
    for (const w of words) {
      const next = cur ? `${cur} ${w}` : w;
      if (measure(next, s) <= maxWidth || cur === "") cur = next;
      else {
        lines.push(cur);
        cur = w;
      }
    }
    if (cur) lines.push(cur);
    if (lines.length <= 3) return { lines, size: s };
    s = Math.round(s * 0.92);
  }
  return { lines: [text], size: s };
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#0E1116"));
  const textColor = str(values.textColor, pc("textColor", "#F3F5F8"));
  const accent = str(values.accent, pc("accent", "#22C55E"));
  const verdict = str(values.verdict, "True").trim();
  const claim = str(values.claim, "Short-form video gets 2.5× the reach of static posts");
  const source = str(values.source, "").trim();
  const showIcon = on(values.showIcon);

  root.addChild(new Graphics().rect(0, 0, size.width, size.height).fill(bg));

  const L = layout(ctx.aspect);
  const cardW = size.width * L.cardFrac;
  const claimSize = Math.round(size.width * L.claimFrac);
  const chipSize = Math.round(claimSize * 0.6);
  const srcSize = Math.round(claimSize * 0.6);
  const padX = claimSize * 0.85;
  const padY = claimSize * 0.75;

  const measureBody = (s: string, sz: number) => fonts.measure(s, { family: fonts.family("body"), weight: 600, size: sz });
  const iconW = showIcon ? claimSize * 1.9 : 0;
  const textW = cardW - padX * 2 - iconW;
  const body = wrap(claim, measureBody, claimSize, textW);
  const lineH = body.size * 1.28;

  const chipH = chipSize * 2.05;
  const cardH = padY * 2 + chipH + claimSize * 0.5 + body.lines.length * lineH + (source ? srcSize * 1.9 : 0);
  const cx = size.width / 2;
  const cy = size.height * L.centerFrac;

  const timeline = new JimaTimeline();
  const group = new Container();
  group.position.set(cx, cy);
  root.addChild(group);

  group.addChild(
    new Graphics()
      .roundRect(-cardW / 2, -cardH / 2, cardW, cardH, claimSize * 0.5)
      .fill({ color: bg, alpha: 0.92 })
      .stroke({ color: textColor, width: Math.max(1, size.width * 0.0011), alpha: 0.16 }),
  );

  // The accent edge — a thick rule down the leading side, which is how every
  // credible source card in the wild reads.
  const edgeW = Math.max(4, size.width * 0.005);
  group.addChild(
    new Graphics()
      .roundRect(-cardW / 2, -cardH / 2, edgeW * 2.2, cardH, claimSize * 0.5)
      .fill(accent),
  );

  const contentLeft = -cardW / 2 + padX;
  const top = -cardH / 2 + padY;

  // --- Verdict chip ---
  const chipLabel = makeText(fonts, {
    text: verdict.toUpperCase(),
    role: "body",
    weight: 800,
    size: chipSize,
    color: bg,
    anchor: { x: 0, y: 0.5 },
    letterSpacing: chipSize * 0.08,
  });
  const iconSize = chipSize * 1.05;
  const icon = showIcon ? makeIcon("check", iconSize, { color: bg }) : null;
  const chipW = chipLabel.width + chipSize * (icon ? 2.5 : 1.5);
  const chip = new Graphics().roundRect(0, -chipH / 2, chipW, chipH, chipH / 2).fill(accent);
  const chipHolder = new Container();
  chipHolder.addChild(chip);
  if (icon) {
    icon.position.set(chipSize * 0.8, 0);
    chipHolder.addChild(icon);
  }
  chipLabel.x = chipSize * (icon ? 1.5 : 0.75);
  chipHolder.addChild(chipLabel);
  chipHolder.position.set(contentLeft, top + chipH / 2);
  group.addChild(chipHolder);
  chipHolder.scale.set(0);
  timeline
    .to(chipHolder, { prop: "scale.x", from: 0, to: 1, start: IN_AT + 0.25, duration: 0.5, ease: outBack })
    .to(chipHolder, { prop: "scale.y", from: 0, to: 1, start: IN_AT + 0.25, duration: 0.5, ease: outBack });

  // --- Claim ---
  const claimTop = top + chipH + claimSize * 0.5;
  body.lines.forEach((line, i) => {
    const t = makeText(fonts, {
      text: line,
      role: "body",
      weight: 600,
      size: body.size,
      color: textColor,
      anchor: { x: 0, y: 0.5 },
    });
    t.position.set(contentLeft, claimTop + lineH * (i + 0.5));
    t.alpha = 0;
    group.addChild(t);
    const at = IN_AT + 0.4 + i * 0.09;
    timeline
      .to(t, { prop: "alpha", from: 0, to: 1, start: at, duration: 0.4, ease: outQuad })
      .to(t, { prop: "x", from: contentLeft - claimSize * 0.25, to: contentLeft, start: at, duration: 0.7, ease: outExpo });
  });

  // --- Source line ---
  if (source.length > 0) {
    const y = claimTop + body.lines.length * lineH + srcSize * 0.95;
    const s = makeText(fonts, {
      text: source,
      role: "body",
      weight: 500,
      size: srcSize,
      color: textColor,
      anchor: { x: 0, y: 0.5 },
    });
    s.alpha = 0;
    s.position.set(contentLeft, y);
    group.addChild(s);
    timeline
      .to(s, { prop: "alpha", from: 0, to: 0.6, start: IN_AT + 0.8, duration: 0.5, ease: outQuad })
      .to(s, { prop: "y", from: y + srcSize * 0.35, to: y, start: IN_AT + 0.8, duration: 0.75, ease: outQuint });
  }

  // The card slides in from the leading edge.
  group.alpha = 0;
  timeline
    .to(group, { prop: "alpha", from: 0, to: 1, start: IN_AT, duration: 0.35, ease: outQuad })
    .to(group, { prop: "x", from: cx - cardW * 0.24, to: cx, start: IN_AT, duration: 0.8, ease: outExpo });

  return { timeline, duration: DURATION };
}

export const factCheck: TemplateDefinition = {
  id: "fact-check",
  name: "Source Card",
  tagline: "A verdict chip, the claim, and where it came from — the citation overlay.",
  category: "overlay",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "9:16",
  loopable: false,
  posterTime: 3.2,
  fontRoles: { claim: "body", source: "body" },
  palettes: PALETTES,
  fields: [
    { key: "verdict", type: "text", label: "Verdict", default: "True", maxLength: 18 },
    {
      key: "claim",
      type: "text",
      label: "Claim",
      default: "Short-form video gets 2.5× the reach of static posts",
      maxLength: 130,
    },
    { key: "source", type: "text", label: "Source", default: "Source: HubSpot, 2025 State of Marketing", maxLength: 60, optional: true },
    { key: "showIcon", type: "toggle", label: "Verdict icon", default: true },
    { key: "background", type: "color", label: "Card", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Verdict colour", default: "", optional: true },
  ],
  build,
};
